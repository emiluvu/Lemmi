import { expect, test } from 'bun:test';
import { handlePhotoScene } from '../packages/server/src/photo-scene';
import { controlSessionFixture } from '@lemmi/contracts/fixtures';
import { DataError } from '../packages/server/src/data/repository';
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

const privateId = 'f1000000-0000-4000-8000-000000000001';
test('current Alex photo uses attached private storage with scoped revision guards', async () => {
  const f = fixture();
  f.data.repository.asset = async (
    principal: any,
    id: string,
    bytes: boolean,
    demoOnly: boolean,
    guard: any,
  ) => {
    expect(principal.profileId).toBe('profile-alex');
    expect(id).toBe(privateId);
    expect(bytes).toBe(true);
    expect(demoOnly).toBe(true);
    expect(guard.token.profileRevision).toBe(0);
    expect(guard.current()).toBe(true);
    return {
      metadata: { profileId: 'profile-alex', kind: 'image', mediaType: 'image/png' },
      bytes: Buffer.from('private-test-image'),
    };
  };
  const response = await handlePhotoScene({ ...input, assetId: privateId }, f.data, f.sessions);
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toBe('image/png');
  expect(response.headers.get('cache-control')).toContain('no-store');
  expect(await response.text()).toBe('private-test-image');
});
test('private reads deny other profiles, removed/retired assets and late session changes', async () => {
  const wrong = fixture();
  wrong.state.identity.profileId = 'profile-casey';
  expect(
    (await handlePhotoScene({ ...input, assetId: privateId }, wrong.data, wrong.sessions)).status,
  ).toBe(403);
  const gone = fixture();
  gone.data.repository.asset = async () => {
    throw new DataError('NOT_FOUND', 'Asset unavailable');
  };
  expect(
    (await handlePhotoScene({ ...input, assetId: privateId }, gone.data, gone.sessions)).status,
  ).toBe(404);
  const stale = fixture();
  stale.data.repository.asset = async () => {
    stale.state.snapshot.generation++;
    return {
      metadata: { profileId: 'profile-alex', kind: 'image', mediaType: 'image/png' },
      bytes: Buffer.from('must-not-return'),
    };
  };
  const response = await handlePhotoScene(
    { ...input, assetId: privateId },
    stale.data,
    stale.sessions,
  );
  expect(response.status).toBe(409);
  expect(await response.text()).not.toContain('must-not-return');
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

test('private UUID proxy serves bounded PNG only with protected response headers', async () => {
  await configured(async () => {
    const id = 'f1000000-0000-4000-8000-000000000001';
    globalThis.fetch = (async (_url: string, options: RequestInit) => {
      expect(JSON.parse(String(options.body)).assetId).toBe(id);
      return new Response(new Uint8Array([137, 80, 78, 71]), {
        headers: { 'content-type': 'image/png', 'set-cookie': 'untrusted=1' },
      });
    }) as any;
    const response = await GET(request(id));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(response.headers.has('set-cookie')).toBe(false);
    globalThis.fetch = (async () =>
      new Response('<svg/>', { headers: { 'content-type': 'image/svg+xml' } })) as any;
    expect((await GET(request(id))).status).toBe(503);
    globalThis.fetch = (async () =>
      new Response(new Uint8Array(5 * 1024 * 1024 + 1), {
        headers: { 'content-type': 'image/png' },
      })) as any;
    expect((await GET(request(id))).status).toBe(503);
  });
});
