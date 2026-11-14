import { randomUUID } from 'node:crypto';
import {
  DeviceAccess,
  CONTROL_DEVICE_ID,
  CONTROL_PROFILE_ID,
  type DeviceIdentity,
} from '../device-access';
import {
  fail,
  type PairDeviceInput,
  type ClaimDeviceInput,
  type RevokeDeviceInput,
} from '@lemmi/contracts';
import { DataRepository, DataError } from './repository';
import { sha256 } from './private-media';

// One gateway owns ephemeral pairing secrets and live sockets; the DB commits credential
// issuance/revocation before success. Restart retains only explicitly persistent keys;
// it never restores capture/sessions/codes. No plaintext credential/code is stored in PostgreSQL.
export class DatabaseDeviceAuthority {
  readonly bootId = randomUUID();
  readonly access: DeviceAccess;
  private pending = Promise.resolve();
  private issuedIdentity: DeviceIdentity | null = null;
  private enrollingActor: string | null = null;
  constructor(
    private repository: DataRepository,
    now: () => number,
    invalidated: () => void,
  ) {
    this.access = new DeviceAccess(now, invalidated, true);
  }
  async start() {
    await this.repository.restart(this.bootId);
    const rows = await this.repository
      .sql`SELECT d.credential_id,d.credential_hash FROM lemmi.devices d JOIN lemmi.profiles p ON p.id=d.profile_id WHERE d.id='stackchan-alex' AND d.profile_id='profile-alex' AND d.boot_id=${this.bootId}::uuid AND d.credential_persistent AND d.revoked_at IS NULL AND p.deletion_state='active'`;
    if (rows.length) {
      this.issuedIdentity = {
        deviceId: CONTROL_DEVICE_ID,
        profileId: CONTROL_PROFILE_ID,
        credentialId: rows[0].credential_id,
        expiresAt: null,
      };
      this.access.restoreCredential(rows[0].credential_hash, this.issuedIdentity);
    }
    const receipts = await this.repository
      .sql`SELECT subject,command_id FROM lemmi.device_revocations WHERE profile_id='profile-alex' LIMIT 257`;
    if (receipts.length > 256) throw new Error('Device revocation history capacity exceeded');
    for (const receipt of receipts)
      this.access.rememberRevocation(receipt.subject, receipt.command_id);
  }
  private serial<T>(work: () => Promise<T>): Promise<T> {
    const result = this.pending.then(work);
    this.pending = result.then(
      () => {},
      () => {},
    );
    return result;
  }
  pair(actor: string, input: PairDeviceInput) {
    return this.serial(async () => {
      if (input.deviceId !== CONTROL_DEVICE_ID || input.profileId !== CONTROL_PROFILE_ID)
        return fail('FORBIDDEN', 'Device/profile is not assigned');
      return this.repository
        .deviceMutation(actor, this.bootId, async (tx) => {
          const current =
            await tx`SELECT credential_id FROM lemmi.devices WHERE id=${input.deviceId} AND revoked_at IS NULL AND (credential_persistent OR credential_expires_at>now())`;
          if (current.length && current[0].credential_id)
            return fail('REVISION_CONFLICT', 'Revoke the paired device before pairing again');
          const receipts =
            await tx`SELECT count(*)::int AS n FROM lemmi.device_revocations WHERE profile_id=${input.profileId}`;
          if (receipts[0].n >= 256)
            return fail('UNAVAILABLE', 'Device revocation history capacity reached');
          const result = this.access.pair(actor, input);
          if (result.ok) this.enrollingActor = actor;
          return result;
        })
        .catch((error) =>
          fail(
            error instanceof DataError ? error.code : 'UNAVAILABLE',
            'Device pairing scope or storage is unavailable',
          ),
        );
    });
  }
  claim(input: ClaimDeviceInput) {
    return this.serial(async () => {
      const result = this.access.claim(input);
      if (!result.ok) return result;
      const actor = this.enrollingActor;
      this.enrollingActor = null;
      const identity = this.access.authenticate(result.data.credential)!;
      this.issuedIdentity = identity;
      try {
        const rows = await this.repository
          .sql`UPDATE lemmi.devices SET credential_id=${identity.credentialId}::uuid,credential_hash=${sha256(result.data.credential)},credential_expires_at=${identity.expiresAt === null ? null : new Date(identity.expiresAt)},credential_persistent=${identity.expiresAt === null},revoked_at=NULL WHERE id=${identity.deviceId} AND profile_id=${identity.profileId} AND boot_id=${this.bootId}::uuid AND (credential_id IS NULL OR revoked_at IS NOT NULL OR (NOT credential_persistent AND credential_expires_at<=now())) AND EXISTS (SELECT 1 FROM lemmi.profiles WHERE id=${identity.profileId} AND deletion_state='active') AND EXISTS (SELECT 1 FROM lemmi.profile_access WHERE profile_id=${identity.profileId} AND subject=${actor} AND role='caregiver') RETURNING id`;
        if (!rows.length) throw new Error('Assignment unavailable');
        if (!this.access.current(identity)) {
          await this.repository
            .sql`UPDATE lemmi.devices SET credential_id=NULL,credential_hash=NULL,credential_expires_at=NULL,credential_persistent=false,revoked_at=now() WHERE id='stackchan-alex' AND credential_id=${identity.credentialId}::uuid`;
          return fail('REVISION_CONFLICT', 'Pairing was revoked while committing');
        }
        this.issuedIdentity = identity;
        return result;
      } catch {
        this.access.revoke('database', { deviceId: 'stackchan-alex', commandId: randomUUID() });
        return fail('UNAVAILABLE', 'Device credential was not committed; pair again');
      }
    });
  }
  revoke(actor: string, input: RevokeDeviceInput) {
    // Caller is the authenticated HTTP boundary. Stop current local work immediately,
    // before any DB wait; durable scope is checked again before reporting success.
    const issued = this.issuedIdentity;
    const result = this.access.revoke(actor, input);
    if (!result.ok) return Promise.resolve(result);
    return this.serial(async () => {
      return this.repository
        .deviceMutation(actor, this.bootId, async (tx) => {
          const receipt =
            await tx`SELECT 1 FROM lemmi.device_revocations WHERE profile_id='profile-alex' AND subject=${actor} AND command_id=${input.commandId}`;
          if (receipt.length) return result;
          if (issued && !this.access.current(issued))
            await tx`UPDATE lemmi.devices SET credential_id=NULL,credential_hash=NULL,credential_expires_at=NULL,credential_persistent=false,revoked_at=now() WHERE id='stackchan-alex' AND credential_id=${issued.credentialId}::uuid AND boot_id=${this.bootId}::uuid`;
          const count =
            await tx`SELECT count(*)::int AS n FROM lemmi.device_revocations WHERE profile_id='profile-alex'`;
          // Revocation stays available at capacity; further enrollment is blocked then.
          if (count[0].n < 256)
            await tx`INSERT INTO lemmi.device_revocations (profile_id,subject,command_id) VALUES ('profile-alex',${actor},${input.commandId})`;
          return result;
        })
        .catch((error) =>
          fail(
            error instanceof DataError ? error.code : 'UNAVAILABLE',
            'Device revocation was not committed',
          ),
        );
    });
  }
  async authenticate(secret: string): Promise<DeviceIdentity | null> {
    const identity = this.access.authenticate(secret);
    if (!identity) return null;
    const rows = await this.repository
      .sql`SELECT 1 FROM lemmi.devices d JOIN lemmi.profiles p ON p.id=d.profile_id WHERE d.id=${identity.deviceId} AND d.profile_id=${identity.profileId} AND d.credential_id=${identity.credentialId}::uuid AND d.credential_hash=${sha256(secret)} AND d.boot_id=${this.bootId}::uuid AND (d.credential_persistent OR d.credential_expires_at>now()) AND d.revoked_at IS NULL AND p.deletion_state='active'`;
    return rows.length && this.access.current(identity) ? identity : null;
  }
  async verifyCurrent() {
    const current = this.issuedIdentity;
    if (!current || !this.access.current(current)) return false;
    const rows = await this.repository
      .sql`SELECT credential_id FROM lemmi.devices d JOIN lemmi.profiles p ON p.id=d.profile_id WHERE d.id='stackchan-alex' AND d.credential_id=${current.credentialId}::uuid AND d.boot_id=${this.bootId}::uuid AND d.revoked_at IS NULL AND (d.credential_persistent OR d.credential_expires_at>now()) AND p.deletion_state='active'`;
    if (!rows.length) {
      this.access.revoke('database', { deviceId: 'stackchan-alex', commandId: randomUUID() });
      return false;
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
