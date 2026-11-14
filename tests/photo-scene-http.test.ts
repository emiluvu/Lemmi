import { expect, test } from 'bun:test';
import { handlePhotoScene } from '../packages/server/src/photo-scene';
import { controlSessionFixture } from '@lemmi/contracts/fixtures';
import { GET } from '../apps/web/src/routes/v1/demo/photo-assets/[assetId]/+server';

const credential = 'photo-scene-test-credential-'.padEnd(43, 'x');
const input = { operation: 'photo.scene.read', credential, assetId: 'photo-story-garden' };
function fixture() {
  const state = {
    identity: {
      profileId: 'profile-alex',
      deviceId: 'browser-photo-fixture',
      credentialId: crypto.randomUUID(),
      endpoint: 'browser',
      expiresAt: null,
    } as any,
    profile: { revision: 0, privacy_revision: 0, policy_revision: 0, is_demo: true },
    snapshot: { ...controlSessionFixture, endpoint: 'browser' as const },
    allowed: true,
    current: true,
    deviceRows: true,
    gatewayRows: true,
    calls: 0,
    invalidateAfterLocks: false,
  };
  const data = {
    devices: {
      bootId: crypto.randomUUID(),
      authenticate: async () => state.identity,
      current: () => {
        state.calls++;
        if (state.invalidateAfterLocks && state.calls === 1) state.snapshot.generation++;
        return state.current;
      },
    },
    repository: {
      profile: async (principal: any, id: string) => {
        expect(principal.kind).toBe('participant');
        expect(id).toBe(state.identity.profileId);
      },
      sql: {
        begin: async (work: any) =>
          work(async (query: TemplateStringsArray) => {
            const text = query.join('');
            if (text.includes('lemmi.profiles')) return [state.profile];
            if (text.includes('lemmi.devices')) return state.deviceRows ? [{ exists: true }] : [];
            return state.gatewayRows ? [{ exists: true }] : [];
          }),
      },
    },
  } as any;
  const sessions = {
    forProfile: (id: string) => {
      expect(id).toBe(state.identity.profileId);
      return { snapshot: () => ({ ...state.snapshot }), photoAssetAllowed: () => state.allowed };
    },
  } as any;
  return { state, data, sessions };
}
test('photo scene read serves only the current authenticated demo profile illustration', async () => {
  const f = fixture();
  const response = await handlePhotoScene(input, f.data, f.sessions);
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toBe('image/svg+xml');
  expect(response.headers.get('cache-control')).toContain('no-store');
  expect(response.headers.get('content-security-policy')).toContain('sandbox');
  expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  expect(await response.text()).toContain('<svg');
});
test('photo scene read rejects unknown paths, caller-selected profile and missing or robot credentials', async () => {
  for (const raw of [
    { ...input, assetId: '../../.env' },
    { ...input, profileId: 'profile-other' },
    { ...input, credential: '' },
  ]) {
    const f = fixture();
    expect((await handlePhotoScene(raw, f.data, f.sessions)).status).toBe(404);
  }
  for (const identity of [null, { ...fixture().state.identity, endpoint: 'robot' }]) {
    const f = fixture();
    f.state.identity = identity;
    expect((await handlePhotoScene(input, f.data, f.sessions)).status).toBe(401);
  }
});
test('photo scene read fails closed on non-demo/stale profile, retired photo, revoke and gateway replacement', async () => {
  for (const change of [
    'notDemo',
    'profileRevision',
    'privacyRevision',
    'policyRevision',
    'notSelected',
    'revoked',
    'gateway',
  ] as const) {
    const f = fixture();
    if (change === 'notDemo') f.state.profile.is_demo = false;
    if (change === 'profileRevision') f.state.profile.revision++;
    if (change === 'privacyRevision') f.state.profile.privacy_revision++;
    if (change === 'policyRevision') f.state.profile.policy_revision++;
    if (change === 'notSelected') f.state.allowed = false;
    if (change === 'revoked') f.state.deviceRows = false;
    if (change === 'gateway') f.state.gatewayRows = false;
    const response = await handlePhotoScene(input, f.data, f.sessions);
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.headers.get('content-type')).not.toBe('image/svg+xml');
  }
});
test('photo scene read rejects a session generation changed during its asynchronous read', async () => {
  const f = fixture();
  f.state.invalidateAfterLocks = true;
  const response = await handlePhotoScene(input, f.data, f.sessions);
  expect(response.status).toBe(409);
  expect(await response.text()).not.toContain('<svg');
});
test('same-profile browser observers can read the selected scene during ordinary speech phase changes', async () => {
  const f = fixture();
  f.state.snapshot.activeEndpointId = 'another-browser-in-the-same-profile';
  f.data.devices.current = () => {
    f.state.snapshot.phase = 'processing';
    return true;
  };
  const response = await handlePhotoScene(input, f.data, f.sessions);
  expect(response.status).toBe(200);
  expect(await response.text()).toContain('<svg');
});

async function configured(work: () => Promise<void>) {
  const values = {
    LEMMI_MODE: 'live',
    LEMMI_DEMO_ENROLLMENT: '1',
    LEMMI_PUBLIC_ORIGIN: 'https://photo-scene.invalid',
    LEMMI_ACCESS_KEY: 'photo-scene-access-key-independent-1234567890',
    LEMMI_CONTROL_TOKEN: 'photo-scene-internal-token-independent-1234567890',
  };
  const previous = Object.fromEntries(Object.keys(values).map((name) => [name, process.env[name]]));
  Object.assign(process.env, values);
  const oldFetch = globalThis.fetch;
  try {
    await work();
  } finally {
    globalThis.fetch = oldFetch;
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}
function request(
  assetId = 'photo-story-garden',
  options: { cookie?: boolean; gate?: boolean; origin?: string } = {},
) {
  return {
    request: new Request(`https://photo-scene.invalid/v1/demo/photo-assets/${assetId}`, {
      headers: {
        ...(options.cookie === false ? {} : { cookie: `__Host-lemmi_endpoint=${credential}` }),
        ...(options.gate === false ? {} : { 'x-lemmi-access-key': process.env.LEMMI_ACCESS_KEY! }),
        ...(options.origin ? { origin: options.origin } : {}),
      },
    }),
    params: { assetId },
  } as any;
}
test('photo HTTP route requires gate, browser enrollment, exact asset and same-origin request', async () => {
  await configured(async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      throw new Error('Unexpected call');
    }) as any;
    expect((await GET(request('photo-story-garden', { gate: false }))).status).toBe(401);
    expect((await GET(request('photo-story-garden', { cookie: false }))).status).toBe(401);
    expect(
      (await GET(request('photo-story-garden', { origin: 'https://other.invalid' }))).status,
    ).toBe(403);
    expect((await GET(request('private-file'))).status).toBe(404);
    process.env.LEMMI_DEMO_ENROLLMENT = '0';
    expect((await GET(request())).status).toBe(404);
    expect(calls).toBe(0);
  });
});
test('photo HTTP route passes credentials only to the private gateway and bounds/sanitizes its response', async () => {
  await configured(async () => {
    globalThis.fetch = (async (url: string, options: RequestInit) => {
      expect(String(url)).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/internal\/data$/);
      const raw = JSON.parse(String(options.body));
      expect(raw).toEqual(input);
      expect(new Headers(options.headers).get('authorization')).toBe(
        `Bearer ${process.env.LEMMI_CONTROL_TOKEN}`,
      );
      return new Response('<svg></svg>', {
        headers: { 'content-type': 'image/svg+xml', 'set-cookie': 'not-allowed=1' },
      });
    }) as any;
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(response.headers.has('set-cookie')).toBe(false);
    expect(await response.text()).toBe('<svg></svg>');
    globalThis.fetch = (async () =>
      new Response('x'.repeat(65537), { headers: { 'content-type': 'image/svg+xml' } })) as any;
    expect((await GET(request())).status).toBe(503);
    globalThis.fetch = (async () => new Response('private error body', { status: 401 })) as any;
    const denied = await GET(request());
    expect(denied.status).toBe(401);
    expect(await denied.text()).toBe('');
  });
});
