import { expect, test } from 'bun:test';
import {
  DeviceAccess,
  PAIRING_TTL_MS,
  DEVICE_TTL_MS,
  authenticateCaregiver,
  caregiverAuthConfig,
  controlConfig,
  SessionCoordinator,
} from '@lemmi/server';
import {
  ClaimDeviceInputSchema,
  ClaimDeviceResultSchema,
  PairDeviceInputSchema,
  DeviceEventSchema,
  createClients,
  createHttpTransport,
  type Result,
} from '@lemmi/contracts';
import {
  controlHelloFixture,
  controlEventFixtures,
  controlServerEventFixtures,
} from '@lemmi/contracts/fixtures';
import { ServerEventSchema } from '@lemmi/contracts';

function data<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(result.error.code);
  return result.data;
}
const pair = { deviceId: 'stackchan-alex', profileId: 'profile-alex', commandId: 'pair-1' };
const claim = (value: ReturnType<DeviceAccess['pair']>) => {
  const p = data(value);
  return { pairingId: p.pairingId, code: p.code, localConfirmed: true as const };
};

test('pairing is scoped, bounded, explicitly confirmed, single use and retry-safe', () => {
  const access = new DeviceAccess();
  expect(access.pair('caregiver', { ...pair, profileId: 'preview-sam' }).ok).toBe(false);
  expect(access.pair('caregiver', { ...pair, deviceId: 'other-device' }).ok).toBe(false);
  const first = access.pair('caregiver', pair);
  expect(access.pair('caregiver', pair)).toEqual(first);
  expect(access.pair('caregiver', { ...pair, commandId: 'second' }).ok).toBe(false);
  const input = claim(first);
  expect(ClaimDeviceInputSchema.safeParse({ ...input, localConfirmed: false }).success).toBe(false);
  expect(access.claim({ ...input, code: 'x'.repeat(24) }).ok).toBe(false);
  const issued = data(access.claim(input));
  expect(access.authenticate(issued.credential)?.profileId).toBe('profile-alex');
  expect(access.authenticate('local-mock-only')).toBeNull();
  expect(access.claim(input).ok).toBe(false);
  expect(access.pair('caregiver', pair).ok).toBe(false);
  expect(access.pair('caregiver', { ...pair, commandId: 'replacement' }).ok).toBe(false);
});

test('pairing and credentials expire; revocation retry cannot revoke a replacement; restart invalidates', () => {
  let now = 1_000_000;
  let revocations = 0;
  const access = new DeviceAccess(
    () => now,
    () => revocations++,
  );
  const expired = claim(access.pair('caregiver', pair));
  now += PAIRING_TTL_MS;
  expect(access.claim(expired).ok).toBe(false);
  const issued = data(
    access.claim(claim(access.pair('caregiver', { ...pair, commandId: 'fresh' }))),
  );
  const identity = access.authenticate(issued.credential)!;
  const revoke = { deviceId: pair.deviceId, commandId: 'revoke' };
  expect(access.revoke('caregiver', { ...revoke, deviceId: 'other' }).ok).toBe(false);
  access.revoke('caregiver', revoke);
  expect(access.current(identity)).toBe(false);
  expect(access.authenticate(issued.credential)).toBeNull();
  const replacement = data(
    access.claim(claim(access.pair('caregiver', { ...pair, commandId: 'new-pair' }))),
  );
  access.revoke('caregiver', revoke);
  expect(access.authenticate(replacement.credential)).not.toBeNull();
  expect(revocations).toBe(1);
  expect(new DeviceAccess().authenticate(replacement.credential)).toBeNull();
  now += DEVICE_TTL_MS;
  expect(access.authenticate(replacement.credential)).toBeNull();
  expect(revocations).toBe(2);
});

test('claim guessing is limited without an unbounded peer map', () => {
  const access = new DeviceAccess();
  const input = claim(access.pair('caregiver', pair));
  for (let i = 0; i < 20; i++) access.claim({ ...input, code: 'x'.repeat(24) });
  const result = access.claim(input);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error.code).toBe('UNAVAILABLE');
});

test('access revocation remains available at pairing command-history capacity', () => {
  let now = Date.now();
  const access = new DeviceAccess(() => now);
  for (let index = 0; index < 127; index++) {
    now += 60_000; // Exercise history capacity independently of the claim-rate limit.
    data(access.claim(claim(access.pair('caregiver', { ...pair, commandId: `pair-${index}` }))));
    data(access.revoke('caregiver', { deviceId: pair.deviceId, commandId: `revoke-${index}` }));
  }
  data(access.revoke('caregiver', { deviceId: pair.deviceId, commandId: 'extra-history-entry' }));
  const issued = data(
    access.claim(claim(access.pair('caregiver', { ...pair, commandId: 'last-pair' }))),
  );
  expect(access.authenticate(issued.credential)).not.toBeNull();
  expect(
    access.revoke('caregiver', { deviceId: pair.deviceId, commandId: 'revoke-at-capacity' }).ok,
  ).toBe(true);
  expect(access.authenticate(issued.credential)).toBeNull();
  expect(access.pair('caregiver', { ...pair, commandId: 'over-capacity' }).ok).toBe(false);
});

const config = {
  endpoint: 'https://identity.invalid/introspect',
  issuer: 'https://identity.invalid',
  audience: 'lemmi',
  clientId: 'server',
  clientSecret: 'private',
  subject: 'caregiver-alex',
};
test('caregiver identity is verified with issuer/audience/expiry and server-owned assignment', async () => {
  const now = Date.now();
  const valid = {
    active: true,
    iss: config.issuer,
    aud: [config.audience],
    sub: config.subject,
    exp: Math.floor(now / 1000) + 300,
    token_type: 'Bearer',
  };
  const request = new Request('https://lemmi.invalid/v1/devices/stackchan-alex/pairings', {
    headers: { authorization: 'Bearer opaque-provider-access-token' },
  });
  const verifier = (body: unknown) =>
    authenticateCaregiver(
      request,
      config,
      async (url, init) => {
        expect(url).toBe(config.endpoint);
        expect(init?.redirect).toBe('error');
        expect(init?.body).toContain('token=opaque-provider-access-token');
        return Response.json(body);
      },
      now,
    );
  expect(data(await verifier(valid)).profileId).toBe('profile-alex');
  for (const patch of [
    { active: false },
    { iss: 'other' },
    { aud: 'other' },
    { exp: 0 },
    { exp: valid.exp + 7200 },
    { nbf: Math.floor(now / 1000) + 10 },
    { nbf: 'malformed' },
    { token_type: 'ID' },
  ])
    expect((await verifier({ ...valid, ...patch })).ok).toBe(false);
  const unrelated = await verifier({ ...valid, sub: 'unassigned-caregiver' });
  expect(unrelated.ok).toBe(false);
  if (!unrelated.ok) expect(unrelated.error.code).toBe('FORBIDDEN');
  expect(
    (
      await authenticateCaregiver(request, config, async () => {
        throw new Error('private provider detail');
      })
    ).ok,
  ).toBe(false);
  expect((await authenticateCaregiver(new Request(request.url), config)).ok).toBe(false);
});

test('VoidAuth client binding is opt-in and rejects foreign tokens without audience fallback', async () => {
  const now = Date.now();
  const request = new Request('https://lemmi.invalid', {
    headers: { authorization: 'Bearer opaque-voidauth-access-token' },
  });
  const valid = {
    active: true,
    iss: config.issuer,
    client_id: config.clientId,
    sub: config.subject,
    exp: Math.floor(now / 1000) + 300,
    token_type: 'Bearer',
  };
  const verify = (body: unknown, tokenBinding: 'audience' | 'client_id' = 'client_id') =>
    authenticateCaregiver(
      request,
      { ...config, tokenBinding },
      async () => Response.json(body),
      now,
    );
  expect((await verify(valid)).ok).toBe(true);
  expect((await verify(valid, 'audience')).ok).toBe(false);
  for (const patch of [
    { client_id: 'another-app', aud: config.audience },
    { client_id: undefined },
    { aud: 'another-resource' },
    { aud: null },
    { iss: 'another-issuer' },
    { sub: 'another-caregiver' },
    { token_type: 'RefreshToken' },
    { exp: 0 },
    { active: false },
  ])
    expect((await verify({ ...valid, ...patch })).ok).toBe(false);
  const env = {
    LEMMI_AUTH_INTROSPECTION_URL: config.endpoint,
    LEMMI_AUTH_ISSUER: config.issuer,
    LEMMI_AUTH_CLIENT_ID: config.clientId,
    LEMMI_AUTH_CLIENT_SECRET: config.clientSecret,
    LEMMI_CAREGIVER_SUBJECT: config.subject,
  };
  expect(() => caregiverAuthConfig(env)).toThrow();
  expect(caregiverAuthConfig({ ...env, LEMMI_AUTH_TOKEN_BINDING: 'client_id' }).tokenBinding).toBe(
    'client_id',
  );
  expect(() => caregiverAuthConfig({ ...env, LEMMI_AUTH_TOKEN_BINDING: 'automatic' })).toThrow();
});

test('configuration refuses plaintext identity endpoints, public origins and reused mock credentials', () => {
  expect(() => caregiverAuthConfig({})).toThrow();
  expect(() =>
    caregiverAuthConfig({
      LEMMI_AUTH_INTROSPECTION_URL: 'http://identity.invalid',
      LEMMI_AUTH_ISSUER: 'issuer',
      LEMMI_AUTH_AUDIENCE: 'aud',
      LEMMI_AUTH_CLIENT_ID: 'id',
      LEMMI_AUTH_CLIENT_SECRET: 'secret',
      LEMMI_CAREGIVER_SUBJECT: 'subject',
    }),
  ).toThrow();
  expect(() =>
    controlConfig({
      LEMMI_PUBLIC_ORIGIN: 'http://lemmi.invalid',
      LEMMI_CONTROL_TOKEN: 'x'.repeat(40),
    }),
  ).toThrow();
  expect(() =>
    controlConfig({
      LEMMI_PUBLIC_ORIGIN: 'https://lemmi.invalid',
      LEMMI_CONTROL_TOKEN: 'x'.repeat(40),
      LEMMI_MOCK_TOKEN: 'x'.repeat(40),
    }),
  ).toThrow();
});

test('unsupported audio is representable and live client uses the resource routes', async () => {
  for (const event of [controlHelloFixture, ...controlEventFixtures])
    expect(DeviceEventSchema.safeParse(event).success).toBe(true);
  for (const event of controlServerEventFixtures)
    expect(ServerEventSchema.safeParse(event).success).toBe(true);
  const event = {
    protocol_version: 1,
    event_id: 'hello',
    session_id: null,
    turn_id: null,
    generation: 0,
    sequence: 0,
    type: 'device.hello',
    payload: {
      firmwareVersion: 'control-test',
      cameraSupported: false,
      pettingSupported: false,
      audio: { supported: false },
    },
  };
  expect(DeviceEventSchema.safeParse(event).success).toBe(true);
  const paths: string[] = [];
  const clients = createClients(
    createHttpTransport('live', async (path) => {
      paths.push(String(path));
      return Response.json({
        ok: false,
        error: { code: 'UNAVAILABLE', message: 'explicit fixture' },
      });
    }),
  );
  await clients.device.pair(pair);
  await clients.device.revoke({ deviceId: pair.deviceId, commandId: 'revoke' });
  await clients.device.claim({ pairingId: 'pairing', code: 'x'.repeat(24), localConfirmed: true });
  expect(paths).toEqual([
    '/v1/devices/stackchan-alex/pairings',
    '/v1/devices/stackchan-alex/revoke',
    '/v1/device-pairings/claim',
  ]);
});

test('live Stop and access revocation still work at command capacity; leases differ between sessions', () => {
  const c = new SessionCoordinator('live');
  const start = (commandId: string) =>
    data(
      c.handle('session.start', { profileId: 'profile-alex', commandId, endpoint: 'robot' }),
    ) as any;
  const first = start('start');
  for (let i = 0; i < 260; i++)
    c.handle('session.command', {
      commandId: `mute-${i}`,
      sessionId: first.id,
      expectedGeneration: 0,
      action: { type: 'mute', muted: true },
    });
  expect(
    c.handle('session.command', {
      commandId: 'stop',
      sessionId: first.id,
      expectedGeneration: 0,
      action: { type: 'stop' },
    }).ok,
  ).toBe(true);
  expect(c.snapshot()?.phase).toBe('ended');
  const fresh = new SessionCoordinator('live');
  const a = data(
    fresh.handle('session.start', { profileId: 'profile-alex', commandId: 'a', endpoint: 'robot' }),
  ) as any;
  fresh.revokeDeviceAccess();
  const b = data(
    fresh.handle('session.start', { profileId: 'profile-alex', commandId: 'b', endpoint: 'robot' }),
  ) as any;
  expect(a.leaseId).not.toBe(b.leaseId);
});

test('persistent enrollment is explicit, requires database mode and validates nullable expiry', () => {
  const access = new DeviceAccess();
  expect(access.pair('caregiver', { ...pair, credentialMode: 'persistent' }).ok).toBe(false);
  expect(access.pair('caregiver', pair).ok).toBe(true);
  expect(PairDeviceInputSchema.safeParse({ ...pair, credentialMode: 'persistent' }).success).toBe(
    true,
  );
  expect(PairDeviceInputSchema.safeParse({ ...pair, credentialMode: 'admin' }).success).toBe(false);
  expect(
    ClaimDeviceInputSchema.safeParse({
      pairingId: 'fixture',
      code: 'x'.repeat(24),
      localConfirmed: true,
      credentialMode: 'persistent',
    }).success,
  ).toBe(false);
  expect(
    ClaimDeviceResultSchema.safeParse({
      deviceId: pair.deviceId,
      profileId: pair.profileId,
      credential: 'x'.repeat(43),
      expiresAt: null,
    }).success,
  ).toBe(true);
});
