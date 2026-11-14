import { randomBytes, randomUUID } from 'node:crypto';
import type { TransactionSQL } from 'bun';
import { DeviceAccess, type DeviceIdentity } from '../device-access';
import {
  fail,
  ok,
  type PairDeviceInput,
  type ClaimDeviceInput,
  type RevokeDeviceInput,
  type Result,
} from '@lemmi/contracts';
import { DataRepository, DataError } from './repository';
import { sha256 } from './private-media';

// Pairing codes are transient; only credential hashes persist. Restart ends sessions but
// preserves enrolled endpoints. A separate gateway epoch prevents stale processes writing.
export class DatabaseDeviceAuthority {
  readonly bootId = randomUUID();
  readonly access: DeviceAccess;
  private pending = Promise.resolve();
  private revision = 0;
  private enrollingActors = new Map<
    string,
    { actor: string; deviceId: string; expiresAt: number }
  >();
  private blockedDevices = new Set<string>();
  private owners = new Map<string, Set<string>>();
  private revokedCommands = new Map<string, string | null>();
  private pendingRevocations = new Map<string, Promise<Result<{ revoked: true }>>>();
  constructor(
    private repository: DataRepository,
    private now: () => number,
    private invalidated: (deviceId?: string) => void,
  ) {
    this.access = new DeviceAccess(now, invalidated, true);
  }
  async start() {
    await this.repository.restart(this.bootId);
    const rows = await this.repository
      .sql`SELECT d.id,d.profile_id,d.endpoint,a.subject FROM lemmi.devices d JOIN lemmi.profile_access a ON a.profile_id=d.profile_id WHERE a.role='caregiver'`;
    const receipts = await this.repository
      .sql`SELECT device_id,actor,command_id,credential_id FROM lemmi.device_revocations LIMIT 10000`;
    for (const row of receipts)
      this.revokedCommands.set(
        `${row.actor}:${row.device_id}:${row.command_id}`,
        row.credential_id,
      );
    for (const row of rows) {
      this.access.assign(row.profile_id, row.id, row.endpoint);
      const owners = this.owners.get(row.id) ?? new Set<string>();
      owners.add(row.subject);
      this.owners.set(row.id, owners);
    }
  }
  private serial<T>(work: () => Promise<T>): Promise<T> {
    const result = this.pending.then(work);
    this.pending = result.then(
      () => {},
      () => {},
    );
    return result;
  }
  private async authorized<T>(
    actor: string,
    profileId: string,
    work: (tx: TransactionSQL) => Promise<T>,
  ) {
    return this.repository.sql.begin(async (tx) => {
      // Match profile writers' lock order; membership and gateway ownership remain
      // current until credential issuance/revocation commits.
      const profile =
        await tx`SELECT 1 FROM lemmi.profiles WHERE id=${profileId} AND deletion_state='active' FOR UPDATE`;
      if (!profile.length) throw new DataError('FORBIDDEN', 'Profile is not assigned');
      const epoch =
        await tx`SELECT 1 FROM lemmi.gateway_state WHERE singleton AND boot_id=${this.bootId}::uuid FOR SHARE`;
      if (!epoch.length) throw new DataError('UNAVAILABLE', 'Gateway ownership changed');
      const member =
        await tx`SELECT 1 FROM lemmi.profile_access WHERE profile_id=${profileId} AND subject=${actor} AND role='caregiver' FOR SHARE`;
      if (!member.length) throw new DataError('FORBIDDEN', 'Caregiver is not assigned');
      return work(tx);
    }) as Promise<T>;
  }
  pair(actor: string, input: PairDeviceInput) {
    return this.serial(async () => {
      if (this.revokedCommands.size >= 10000)
        return fail('UNAVAILABLE', 'Device receipt capacity reached');
      try {
        return await this.authorized(actor, input.profileId, async (tx) => {
          await tx`INSERT INTO lemmi.devices (id,profile_id,boot_id) SELECT ${input.deviceId},${input.profileId},${this.bootId}::uuid WHERE (SELECT count(*) FROM lemmi.devices)<1000 ON CONFLICT DO NOTHING`;
          const rows =
            await tx`SELECT profile_id,credential_id,credential_expires_at,credential_persistent,revoked_at,endpoint FROM lemmi.devices WHERE id=${input.deviceId} FOR UPDATE`;
          if (!rows.length || rows[0].profile_id !== input.profileId)
            return fail('FORBIDDEN', 'Device/profile is not assigned');
          if (
            rows[0].credential_id &&
            !rows[0].revoked_at &&
            (rows[0].credential_persistent ||
              new Date(rows[0].credential_expires_at).getTime() > this.now())
          )
            return fail('REVISION_CONFLICT', 'Revoke the paired device before pairing again');
          this.access.assign(input.profileId, input.deviceId, rows[0].endpoint);
          const owners = this.owners.get(input.deviceId) ?? new Set<string>();
          owners.add(actor);
          this.owners.set(input.deviceId, owners);
          const result = this.access.pair(actor, input);
          if (result.ok) {
            // At most one pending actor per device; expired codes cannot grow this map.
            for (const [id, pending] of this.enrollingActors)
              if (pending.deviceId === input.deviceId || pending.expiresAt <= this.now())
                this.enrollingActors.delete(id);
            this.enrollingActors.set(result.data.pairingId, {
              actor,
              deviceId: input.deviceId,
              expiresAt: Date.parse(result.data.expiresAt),
            });
          }
          return result;
        });
      } catch (error) {
        return fail(
          error instanceof DataError ? error.code : 'UNAVAILABLE',
          'Device pairing scope or storage is unavailable',
        );
      }
    });
  }
  claim(input: ClaimDeviceInput) {
    return this.serial(async () => {
      if (this.revokedCommands.size >= 10000)
        return fail('UNAVAILABLE', 'Device receipt capacity reached');
      const result = this.access.claim(input);
      if (!result.ok) return result;
      const identity = this.access.authenticate(result.data.credential)!;
      const actor = this.enrollingActors.get(input.pairingId)?.actor;
      this.enrollingActors.delete(input.pairingId);
      try {
        if (!actor) throw new DataError('FORBIDDEN', 'Enrollment actor unavailable');
        const rows = await this.authorized(actor, identity.profileId, async (tx) => {
          return tx`UPDATE lemmi.devices SET credential_id=${identity.credentialId}::uuid,credential_hash=${sha256(result.data.credential)},credential_expires_at=${identity.expiresAt === null ? null : new Date(identity.expiresAt)},credential_persistent=${identity.expiresAt === null},revoked_at=NULL WHERE id=${identity.deviceId} AND profile_id=${identity.profileId} AND (credential_id IS NULL OR revoked_at IS NOT NULL OR (NOT credential_persistent AND credential_expires_at<=now())) RETURNING id`;
        });
        if (!rows.length) throw new Error('Assignment unavailable');
        if (!this.access.current(identity)) {
          await this.repository
            .sql`UPDATE lemmi.devices SET credential_id=NULL,credential_hash=NULL,credential_expires_at=NULL,credential_persistent=false,revoked_at=now() WHERE id=${identity.deviceId} AND credential_id=${identity.credentialId}::uuid`;
          return fail('REVISION_CONFLICT', 'Pairing was revoked while committing');
        }
        this.blockedDevices.delete(identity.deviceId);
        return result;
      } catch {
        this.access.revoke('database', { deviceId: identity.deviceId, commandId: randomUUID() });
        return fail('UNAVAILABLE', 'Device credential was not committed; pair again');
      }
    });
  }
  revoke(actor: string, input: RevokeDeviceInput) {
    if (!this.owners.get(input.deviceId)?.has(actor))
      return Promise.resolve(fail('FORBIDDEN', 'Device is not assigned'));
    const key = `${actor}:${input.deviceId}:${input.commandId}`;
    const pending = this.pendingRevocations.get(key);
    if (pending) return pending;
    if (this.revokedCommands.has(key)) return Promise.resolve(ok({ revoked: true as const }));
    const issued = this.access.identities().find((value) => value.deviceId === input.deviceId);
    // Fence lazy DB authentication immediately, even before this device reconnects after boot.
    this.revision++;
    this.blockedDevices.add(input.deviceId);
    const result = this.access.revoke(actor, input);
    if (!result.ok) return Promise.resolve(result);
    // Cache before SQL so concurrent retries cannot affect a replacement credential.
    if (this.revokedCommands.size < 10000)
      this.revokedCommands.set(key, issued?.credentialId ?? null);
    const work: Promise<Result<{ revoked: true }>> = this.serial(async () => {
      try {
        return await this.repository.sql.begin(async (tx) => {
          const epoch =
            await tx`SELECT 1 FROM lemmi.gateway_state WHERE singleton AND boot_id=${this.bootId}::uuid FOR SHARE`;
          if (!epoch.length) return fail('UNAVAILABLE', 'Gateway ownership changed');
          const rows =
            await tx`SELECT d.profile_id,d.credential_id FROM lemmi.devices d JOIN lemmi.profile_access a ON a.profile_id=d.profile_id WHERE d.id=${input.deviceId} AND a.subject=${actor} AND a.role='caregiver' FOR UPDATE OF d`;
          if (!rows.length) return fail('FORBIDDEN', 'Device is not assigned');
          const previous =
            await tx`SELECT 1 FROM lemmi.device_revocations WHERE device_id=${input.deviceId} AND actor=${actor} AND command_id=${input.commandId}`;
          if (previous.length) return ok({ revoked: true as const });
          const credentialId = issued?.credentialId ?? rows[0].credential_id;
          if (this.revokedCommands.has(key)) {
            await tx`INSERT INTO lemmi.device_revocations(device_id,actor,command_id,credential_id) VALUES (${input.deviceId},${actor},${input.commandId},${credentialId}::uuid) ON CONFLICT DO NOTHING`;
            this.revokedCommands.set(key, credentialId);
          }
          await tx`UPDATE lemmi.devices SET credential_id=NULL,credential_hash=NULL,credential_expires_at=NULL,credential_persistent=false,revoked_at=now() WHERE id=${input.deviceId} AND credential_id IS NOT DISTINCT FROM ${credentialId}::uuid`;
          return result;
        });
      } catch (error) {
        // Failed durable revocation stays locally fenced and can be retried with the same ID.
        this.revokedCommands.delete(key);
        throw error;
      }
    })
      .then((value) => {
        if (!value.ok) this.revokedCommands.delete(key);
        return value;
      })
      .finally(() => this.pendingRevocations.delete(key));
    this.pendingRevocations.set(key, work);
    return work;
  }

  async enroll(
    actor: string,
    profileId: string,
    endpoint: 'browser' | 'robot',
    previousCredential?: string,
  ) {
    const previous = previousCredential ? await this.authenticate(previousCredential) : null;
    if (previousCredential && !previous)
      throw new DataError('FORBIDDEN', 'Previous endpoint access has ended');
    if (previous) {
      const revoked = await this.revoke(actor, {
        deviceId: previous.deviceId,
        commandId: randomUUID(),
      });
      if (!revoked.ok) throw new DataError('UNAVAILABLE', 'Previous endpoint revocation failed');
    }
    return this.serial(async () => {
      if (this.revokedCommands.size >= 10000)
        throw new DataError('UNAVAILABLE', 'Device receipt capacity reached');
      const deviceId = `${endpoint}-${randomUUID()}`;
      const credential = randomBytes(32).toString('base64url');
      const expiresAt = this.now() + 30 * 24 * 60 * 60_000;
      const identity: DeviceIdentity = {
        deviceId,
        profileId,
        endpoint,
        credentialId: randomUUID(),
        expiresAt,
      };
      const rows = await this.authorized(actor, profileId, async (tx) => {
        return tx`INSERT INTO lemmi.devices (id,profile_id,endpoint,credential_id,credential_hash,credential_expires_at,boot_id) SELECT ${deviceId},${profileId},${endpoint},${identity.credentialId}::uuid,${sha256(credential)},${new Date(expiresAt)},${this.bootId}::uuid WHERE EXISTS (SELECT 1 FROM lemmi.profiles WHERE id=${profileId} AND deletion_state='active' AND is_demo) AND (SELECT count(*) FROM lemmi.devices)<1000 RETURNING id`;
      });
      if (!rows.length)
        throw new DataError('UNAVAILABLE', 'Demo enrollment unavailable or capacity reached');
      this.blockedDevices.delete(deviceId);
      this.access.register(credential, identity);
      this.owners.set(deviceId, new Set([actor]));
      return {
        deviceId,
        profileId,
        credential,
        expiresAt: new Date(expiresAt).toISOString(),
        endpoint,
      };
    });
  }
  async authenticate(secret: string): Promise<DeviceIdentity | null> {
    if (secret.length < 40 || secret.length > 100) return null;
    const revision = this.revision;
    const rows = await this.repository
      .sql`SELECT d.id,d.profile_id,d.endpoint,d.credential_id,d.credential_expires_at,d.credential_persistent FROM lemmi.devices d JOIN lemmi.profiles p ON p.id=d.profile_id WHERE d.credential_hash=${sha256(secret)} AND EXISTS (SELECT 1 FROM lemmi.gateway_state WHERE singleton AND boot_id=${this.bootId}::uuid) AND (d.credential_persistent OR d.credential_expires_at>now()) AND d.revoked_at IS NULL AND p.deletion_state='active'`;
    if (!rows.length || revision !== this.revision) return null;
    const row = rows[0];
    if (this.blockedDevices.has(row.id)) return null;
    const identity: DeviceIdentity = {
      deviceId: row.id,
      profileId: row.profile_id,
      endpoint: row.endpoint,
      credentialId: row.credential_id,
      expiresAt: row.credential_persistent ? null : new Date(row.credential_expires_at).getTime(),
    };
    if (identity.expiresAt !== null && identity.expiresAt <= this.now()) return null;
    this.access.register(secret, identity);
    return identity;
  }
  async verifyCurrent() {
    const epoch = await this.repository
      .sql`SELECT 1 FROM lemmi.gateway_state WHERE singleton AND boot_id=${this.bootId}::uuid`;
    if (!epoch.length) return false;
    for (const current of this.access.identities()) {
      const rows = await this.repository
        .sql`SELECT 1 FROM lemmi.devices d JOIN lemmi.profiles p ON p.id=d.profile_id WHERE d.id=${current.deviceId} AND d.credential_id=${current.credentialId}::uuid AND d.revoked_at IS NULL AND (d.credential_persistent OR d.credential_expires_at>now()) AND p.deletion_state='active'`;
      if (!rows.length) {
        this.revision++;
        this.access.revoke('database', { deviceId: current.deviceId, commandId: randomUUID() });
      }
    }
    return true;
  }
  current(identity: DeviceIdentity) {
    return this.access.current(identity);
  }
  sweep() {
    this.access.sweep();
  }
}
