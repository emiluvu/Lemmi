import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import {
  fail,
  ok,
  type Result,
  type PairDeviceInput,
  type PairDeviceResult,
  type ClaimDeviceInput,
  type ClaimDeviceResult,
  type RevokeDeviceInput,
} from '@lemmi/contracts';

const digest = (secret: string) => createHash('sha256').update(secret).digest();
export const secretMatches = (a: string, b: string) => timingSafeEqual(digest(a), digest(b));
export const CONTROL_PROFILE_ID = 'profile-alex';
export const CONTROL_DEVICE_ID = 'stackchan-alex';
export const PAIRING_TTL_MS = 5 * 60_000;
export const DEVICE_TTL_MS = 60 * 60_000;
export type DeviceIdentity = {
  deviceId: string;
  profileId: string;
  expiresAt: number | null;
  credentialId: string;
  endpoint?: 'browser' | 'robot';
};

// Bounded in-memory transport authority. DatabaseDeviceAuthority restores verified durable credentials.
export class DeviceAccess {
  private pairings = new Map<
    string,
    {
      actor: string;
      input: PairDeviceInput;
      result: PairDeviceResult;
      expiresAt: number;
    }
  >();
  private credentials = new Map<string, { hash: Buffer; identity: DeviceIdentity }>();
  private assignments = new Map<string, { profileId: string; endpoint: 'browser' | 'robot' }>([
    [CONTROL_DEVICE_ID, { profileId: CONTROL_PROFILE_ID, endpoint: 'robot' }],
  ]);
  private commands = new Map<string, string>();
  private claimAttempts = 0;
  private claimWindow = 0;
  constructor(
    private readonly now = Date.now,
    private readonly invalidated: (deviceId?: string) => void = () => {},
    private readonly persistentAllowed = false,
  ) {}
  assign(profileId: string, deviceId: string, endpoint: 'browser' | 'robot' = 'robot') {
    const old = this.assignments.get(deviceId);
    if (old && (old.profileId !== profileId || old.endpoint !== endpoint)) {
      this.credentials.delete(deviceId);
      this.pairings.delete(deviceId);
      this.invalidated(deviceId);
    }
    this.assignments.set(deviceId, { profileId, endpoint });
  }
  register(secret: string, identity: DeviceIdentity) {
    this.assign(identity.profileId, identity.deviceId, identity.endpoint ?? 'robot');
    this.credentials.set(identity.deviceId, { hash: digest(secret), identity: { ...identity } });
  }
  restoreCredential(hash: string, identity: DeviceIdentity) {
    if (!this.persistentAllowed || !/^[0-9a-f]{64}$/.test(hash) || identity.expiresAt !== null)
      throw new Error('Invalid durable device credential');
    this.assign(identity.profileId, identity.deviceId, identity.endpoint ?? 'robot');
    this.credentials.set(identity.deviceId, {
      hash: Buffer.from(hash, 'hex'),
      identity: { ...identity },
    });
  }
  rememberRevocation(actor: string, commandId: string) {
    if (!this.persistentAllowed || this.commands.size >= 256)
      throw new Error('Invalid revocation restore');
    this.commands.set(
      `${actor}:revoke:${CONTROL_DEVICE_ID}:${commandId}`,
      JSON.stringify({ deviceId: CONTROL_DEVICE_ID, commandId }),
    );
  }
  identities() {
    return [...this.credentials.values()].map((v) => ({ ...v.identity }));
  }
  sweep() {
    for (const [id, pairing] of this.pairings)
      if (pairing.expiresAt <= this.now()) this.pairings.delete(id);
    for (const [id, credential] of this.credentials)
      if (credential.identity.expiresAt !== null && credential.identity.expiresAt <= this.now()) {
        this.credentials.delete(id);
        this.invalidated(id);
      }
  }

  pair(actor: string, input: PairDeviceInput): Result<PairDeviceResult> {
    this.sweep();
    if (this.assignments.get(input.deviceId)?.profileId !== input.profileId)
      return fail('FORBIDDEN', 'Device/profile is not assigned');
    if (input.credentialMode === 'persistent' && !this.persistentAllowed)
      return fail('UNAVAILABLE', 'Persistent credentials require database mode');
    const pending = this.pairings.get(input.deviceId);
    const credential = this.credentials.get(input.deviceId);
    const key = `${actor}:pair:${input.deviceId}:${input.commandId}`;
    const body = JSON.stringify(input);
    if (this.commands.has(key)) {
      if (this.commands.get(key) !== body) return fail('REVISION_CONFLICT', 'Command ID reused');
      if (
        pending?.input.commandId === input.commandId &&
        pending.actor === actor &&
        pending.expiresAt > this.now()
      )
        return ok(structuredClone(pending.result));
      return fail('REVISION_CONFLICT', 'Pairing is no longer available; use a new command ID');
    }
    if (this.commands.size >= 256)
      return fail('UNAVAILABLE', 'Control capacity reached; restart required');
    if (
      credential &&
      (credential.identity.expiresAt === null || credential.identity.expiresAt > this.now())
    )
      return fail('REVISION_CONFLICT', 'Revoke the paired device before pairing again');
    if (pending && pending.expiresAt > this.now())
      return fail('REVISION_CONFLICT', 'A pairing is already pending');
    const expiresAt = this.now() + PAIRING_TTL_MS;
    const result = {
      pairingId: crypto.randomUUID(),
      deviceId: input.deviceId,
      profileId: input.profileId,
      code: randomBytes(18).toString('base64url'),
      expiresAt: new Date(expiresAt).toISOString(),
    };
    this.pairings.set(input.deviceId, { actor, input: structuredClone(input), result, expiresAt });
    this.commands.set(key, body);
    return ok(structuredClone(result));
  }

  claim(input: ClaimDeviceInput): Result<ClaimDeviceResult> {
    this.sweep();
    if (this.now() - this.claimWindow >= 60_000) {
      this.claimWindow = this.now();
      this.claimAttempts = 0;
    }
    if (++this.claimAttempts > 20)
      return fail('UNAVAILABLE', 'Pairing attempts limited; retry later');
    const pending = [...this.pairings.values()].find((p) => p.result.pairingId === input.pairingId);
    if (
      !pending ||
      pending.expiresAt <= this.now() ||
      pending.result.pairingId !== input.pairingId ||
      !secretMatches(pending.result.code, input.code) ||
      input.localConfirmed !== true
    )
      return fail('UNAUTHORIZED', 'Pairing is invalid, expired or consumed');
    this.pairings.delete(pending.input.deviceId);
    const credential = randomBytes(32).toString('base64url');
    const identity = {
      deviceId: pending.input.deviceId,
      profileId: pending.input.profileId,
      credentialId: crypto.randomUUID(),
      expiresAt: pending.input.credentialMode === 'persistent' ? null : this.now() + DEVICE_TTL_MS,
    };
    this.register(credential, {
      ...identity,
      endpoint: this.assignments.get(identity.deviceId)?.endpoint,
    });
    return ok({
      deviceId: identity.deviceId,
      profileId: identity.profileId,
      credential,
      expiresAt: identity.expiresAt === null ? null : new Date(identity.expiresAt).toISOString(),
    });
  }

  authenticate(secret: string): DeviceIdentity | null {
    this.sweep();
    const hash = digest(secret);
    const value = [...this.credentials.values()].find((c) => timingSafeEqual(c.hash, hash));
    return value ? { ...value.identity } : null;
  }
  current(identity: DeviceIdentity) {
    const value = this.credentials.get(identity.deviceId)?.identity;
    return (
      !!value &&
      value.credentialId === identity.credentialId &&
      value.profileId === identity.profileId &&
      (value.expiresAt === null || value.expiresAt > this.now())
    );
  }
  revoke(actor: string, input: RevokeDeviceInput): Result<{ revoked: true }> {
    if (!this.assignments.has(input.deviceId)) return fail('FORBIDDEN', 'Device is not assigned');
    const key = `${actor}:revoke:${input.deviceId}:${input.commandId}`;
    // A retry must never revoke a newly paired credential a second time.
    if (this.commands.has(key)) return ok({ revoked: true });
    // Revocation remains available at capacity. New pairings are already blocked then,
    // so an uncached retry cannot affect a replacement credential before restart.
    if (this.commands.size < 256) this.commands.set(key, JSON.stringify(input));
    this.pairings.delete(input.deviceId);
    this.credentials.delete(input.deviceId);
    this.invalidated(input.deviceId);
    return ok({ revoked: true });
  }
}
