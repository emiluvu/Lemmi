import { randomUUID } from 'node:crypto';
import { DeviceAccess, type DeviceIdentity } from '../device-access';
import {
  fail,
  type PairDeviceInput,
  type ClaimDeviceInput,
  type RevokeDeviceInput,
} from '@lemmi/contracts';
import { DataRepository } from './repository';
import { sha256 } from './private-media';

// One gateway owns ephemeral pairing secrets and live sockets; the DB commits credential
// issuance/revocation before success. Restart revokes persisted credentials, never restores
// capture/sessions/codes. No plaintext credential/code is stored in PostgreSQL.
export class DatabaseDeviceAuthority {
  readonly bootId = randomUUID();
  readonly access: DeviceAccess;
  private pending = Promise.resolve();
  private issuedIdentity: DeviceIdentity | null = null;
  constructor(
    private repository: DataRepository,
    now: () => number,
    invalidated: () => void,
  ) {
    this.access = new DeviceAccess(now, invalidated);
  }
  async start() {
    await this.repository.restart(this.bootId);
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
      // Scope checked again against persisted membership, not only configured provider subject.
      await this.repository.approvedProfile(actor);
      return this.access.pair(actor, input);
    });
  }
  claim(input: ClaimDeviceInput) {
    return this.serial(async () => {
      const result = this.access.claim(input);
      if (!result.ok) return result;
      const identity = this.access.authenticate(result.data.credential)!;
      try {
        const rows = await this.repository
          .sql`UPDATE lemmi.devices SET credential_id=${identity.credentialId}::uuid,credential_hash=${sha256(result.data.credential)},credential_expires_at=${new Date(identity.expiresAt)},boot_id=${this.bootId}::uuid,revoked_at=NULL WHERE id=${identity.deviceId} AND profile_id=${identity.profileId} AND EXISTS (SELECT 1 FROM lemmi.profiles WHERE id=${identity.profileId} AND deletion_state='active') RETURNING id`;
        if (!rows.length) throw new Error('Assignment unavailable');
        if (!this.access.current(identity)) {
          await this.repository
            .sql`UPDATE lemmi.devices SET credential_id=NULL,credential_hash=NULL,credential_expires_at=NULL,revoked_at=now() WHERE id='stackchan-alex' AND credential_id=${identity.credentialId}::uuid`;
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
      await this.repository.approvedProfile(actor);
      if (issued && !this.access.current(issued))
        await this.repository
          .sql`UPDATE lemmi.devices SET credential_id=NULL,credential_hash=NULL,credential_expires_at=NULL,revoked_at=now() WHERE id='stackchan-alex' AND credential_id=${issued.credentialId}::uuid`;
      return result;
    });
  }
  async authenticate(secret: string): Promise<DeviceIdentity | null> {
    const identity = this.access.authenticate(secret);
    if (!identity) return null;
    const rows = await this.repository
      .sql`SELECT 1 FROM lemmi.devices d JOIN lemmi.profiles p ON p.id=d.profile_id WHERE d.id=${identity.deviceId} AND d.profile_id=${identity.profileId} AND d.credential_id=${identity.credentialId}::uuid AND d.credential_hash=${sha256(secret)} AND d.boot_id=${this.bootId}::uuid AND d.credential_expires_at>now() AND d.revoked_at IS NULL AND p.deletion_state='active'`;
    return rows.length && this.access.current(identity) ? identity : null;
  }
  async verifyCurrent() {
    const current = this.issuedIdentity;
    if (!current || !this.access.current(current)) return false;
    const rows = await this.repository
      .sql`SELECT credential_id FROM lemmi.devices d JOIN lemmi.profiles p ON p.id=d.profile_id WHERE d.id='stackchan-alex' AND d.credential_id=${current.credentialId}::uuid AND d.boot_id=${this.bootId}::uuid AND d.revoked_at IS NULL AND d.credential_expires_at>now() AND p.deletion_state='active'`;
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
