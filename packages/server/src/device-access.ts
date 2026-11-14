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
  expiresAt: number;
  credentialId: string;
};

// Deliberately ephemeral: restart revokes every code/credential. No secret files or DB substitute.
export class DeviceAccess {
  private pairing: {
    actor: string;
    input: PairDeviceInput;
    result: PairDeviceResult;
    expiresAt: number;
  } | null = null;
  private credential: { hash: Buffer; identity: DeviceIdentity } | null = null;
  private commands = new Map<string, string>();
  private claimAttempts = 0;
  private claimWindow = 0;
  constructor(
    private readonly now = Date.now,
    private readonly invalidated = () => {},
  ) {}
  sweep() {
    if (this.pairing && this.pairing.expiresAt <= this.now()) this.pairing = null;
    if (this.credential && this.credential.identity.expiresAt <= this.now()) {
      this.credential = null;
      this.invalidated();
    }
  }

  pair(actor: string, input: PairDeviceInput): Result<PairDeviceResult> {
    this.sweep();
    if (input.profileId !== CONTROL_PROFILE_ID || input.deviceId !== CONTROL_DEVICE_ID)
      return fail('FORBIDDEN', 'Device/profile is not assigned');
    const key = `${actor}:pair:${input.commandId}`;
    const body = JSON.stringify(input);
    if (this.commands.has(key)) {
      if (this.commands.get(key) !== body) return fail('REVISION_CONFLICT', 'Command ID reused');
      if (
        this.pairing?.input.commandId === input.commandId &&
        this.pairing.actor === actor &&
        this.pairing.expiresAt > this.now()
      )
        return ok(structuredClone(this.pairing.result));
      return fail('REVISION_CONFLICT', 'Pairing is no longer available; use a new command ID');
    }
    if (this.commands.size >= 256)
      return fail('UNAVAILABLE', 'Control capacity reached; restart required');
    if (this.credential && this.credential.identity.expiresAt > this.now())
      return fail('REVISION_CONFLICT', 'Revoke the paired device before pairing again');
    if (this.pairing && this.pairing.expiresAt > this.now())
      return fail('REVISION_CONFLICT', 'A pairing is already pending');
    const expiresAt = this.now() + PAIRING_TTL_MS;
    const result = {
      pairingId: crypto.randomUUID(),
      deviceId: input.deviceId,
      profileId: input.profileId,
      code: randomBytes(18).toString('base64url'),
      expiresAt: new Date(expiresAt).toISOString(),
    };
    this.pairing = { actor, input: structuredClone(input), result, expiresAt };
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
    const pending = this.pairing;
    if (
      !pending ||
      pending.expiresAt <= this.now() ||
      pending.result.pairingId !== input.pairingId ||
      !secretMatches(pending.result.code, input.code) ||
      input.localConfirmed !== true
    )
      return fail('UNAUTHORIZED', 'Pairing is invalid, expired or consumed');
    this.pairing = null;
    const credential = randomBytes(32).toString('base64url');
    const identity = {
      deviceId: pending.input.deviceId,
      profileId: pending.input.profileId,
      credentialId: crypto.randomUUID(),
      expiresAt: this.now() + DEVICE_TTL_MS,
    };
    this.credential = { hash: digest(credential), identity };
    return ok({
      deviceId: identity.deviceId,
      profileId: identity.profileId,
      credential,
      expiresAt: new Date(identity.expiresAt).toISOString(),
    });
  }

  authenticate(secret: string): DeviceIdentity | null {
    this.sweep();
    const c = this.credential;
    return c && c.identity.expiresAt > this.now() && timingSafeEqual(c.hash, digest(secret))
      ? { ...c.identity }
      : null;
  }
  current(identity: DeviceIdentity) {
    return (
      !!this.credential &&
      this.credential.identity.credentialId === identity.credentialId &&
      this.credential.identity.expiresAt > this.now()
    );
  }
  revoke(actor: string, input: RevokeDeviceInput): Result<{ revoked: true }> {
    if (input.deviceId !== CONTROL_DEVICE_ID) return fail('FORBIDDEN', 'Device is not assigned');
    const key = `${actor}:revoke:${input.commandId}`;
    // A retry must never revoke a newly paired credential a second time.
    if (this.commands.has(key)) return ok({ revoked: true });
    // Revocation remains available at capacity. New pairings are already blocked then,
    // so an uncached retry cannot affect a replacement credential before restart.
    if (this.commands.size < 256) this.commands.set(key, JSON.stringify(input));
    this.pairing = null;
    this.credential = null;
    this.invalidated();
    return ok({ revoked: true });
  }
}
