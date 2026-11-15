import { expect, test } from 'bun:test';
import { handle } from '../apps/web/src/hooks.server';
import { accessCookie } from '@lemmi/server';
import { participantEntryGuard } from '../apps/web/src/lib/server/participant-entry';
import { participantProfile } from '@lemmi/contracts/fixtures';

const origin = 'https://demo-pages.fixture.invalid';
const key = 'independent-demo-page-key-12345678901234567890';
async function configured(work: () => Promise<void>) {
  const settings = {
    LEMMI_MODE: 'live',
    LEMMI_DEMO_ENROLLMENT: '1',
    LEMMI_PUBLIC_ORIGIN: origin,
    LEMMI_CONTROL_TOKEN: 'independent-internal-page-fixture-1234567890',
    LEMMI_ACCESS_KEY: key,
  };
  const previous = Object.fromEntries(Object.keys(settings).map((k) => [k, process.env[k]]));
  Object.assign(process.env, settings);
  try {
    await work();
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}
async function page(path: string, unlocked = false, headers: Record<string, string> = {}) {
  const request = new Request(origin + path, {
    headers: {
      'x-forwarded-proto': 'https',
      ...(unlocked ? { cookie: accessCookie(key).split(';')[0]! } : {}),
      ...headers,
    },
  });
  let resolved = false;
  const response = await handle({
    event: { url: new URL(request.url), request, getClientAddress: () => '127.0.0.1' },
    resolve: async () => {
      resolved = true;
      return new Response('safe demo page');
    },
  } as any);
  return { response, resolved };
}
test('designed demo pages require the domain gate and root opens the caregiver workspace', async () => {
  await configured(async () => {
    for (const path of [
      '/caregiver',
      '/caregiver/settings',
      '/caregiver/check-in',
      '/caregiver/sign-in',
    ]) {
      const locked = await page(path);
      expect(locked.response.status).toBe(303);
      expect(locked.response.headers.get('location')).toBe('/access');
      expect(locked.resolved).toBe(false);
      const unlocked = await page(path, true);
      expect(unlocked.response.status).toBe(200);
      expect(unlocked.response.headers.get('cache-control')).toBe('no-store');
      expect(unlocked.resolved).toBe(true);
    }
    const root = await page('/', true);
    expect(root.response.status).toBe(303);
    expect(root.response.headers.get('location')).toBe('/caregiver');
    expect(root.resolved).toBe(false);
    const unselected = await page('/participant/conversation', true);
    expect(unselected.response.status).toBe(303);
    expect(unselected.response.headers.get('location')).toBe('/caregiver');
    expect(unselected.response.headers.get('set-cookie')).toBeNull();
    expect(unselected.resolved).toBe(false);
  });
});

test('participant entry requires the selected enrolled profile and does not enroll, substitute or lock on failure', async () => {
  await configured(async () => {
    const request = (query = '', extra = '') =>
      new Request(origin + '/participant/conversation' + query, {
        headers: {
          cookie: `${accessCookie(key).split(';')[0]}; __Host-lemmi_endpoint=${'a'.repeat(43)}${extra}`,
        },
      });
    let calls = 0;
    const fetcher = async (_url: unknown, init?: RequestInit) => {
      calls++;
      const input = JSON.parse(init?.body as string);
      expect(input.operation).toBe('endpoint.current');
      expect(input.endpoint).toBe('browser');
      return Response.json({
        ok: true,
        data: {
          deviceId: 'selected-browser',
          profileId: participantProfile.id,
          endpoint: 'browser',
          expiresAt: new Date(Date.now() + 60000).toISOString(),
          profile: participantProfile,
        },
      });
    };
    expect(await participantEntryGuard(request('?profile=profile-alex'), fetcher)).toBeNull();
    expect(await participantEntryGuard(request(), fetcher)).toBeNull();
    const mismatch = await participantEntryGuard(request('?profile=another-profile'), fetcher);
    expect(mismatch?.status).toBe(303);
    expect(mismatch?.headers.get('location')).toBe('/caregiver');
    expect(mismatch?.headers.get('set-cookie')).toBeNull();
    const expired = await participantEntryGuard(request(), async () =>
      Response.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Expired' } }),
    );
    expect(expired?.status).toBe(303);
    expect(expired?.headers.get('set-cookie')).toContain('__Host-lemmi_endpoint=;');
    const failed = await participantEntryGuard(request(), async () =>
      Response.json({ unexpected: true }),
    );
    expect(failed?.status).toBe(503);
    // An existing conversation still requires its exit code, including expired enrollment.
    expect(
      await participantEntryGuard(request('', '; lemmi_conversation_lock=live.fixture'), fetcher),
    ).toBeNull();
    expect(calls).toBe(3);
  });
});
test('public demo routes do not open mock operations or bypass the trusted proxy and demo switch', async () => {
  await configured(async () => {
    expect((await page('/v1/mock/overview.load', true)).resolved).toBe(false);
    expect((await page('/caregiver', true, { 'x-forwarded-proto': 'http' })).response.status).toBe(
      403,
    );
    process.env.LEMMI_DEMO_ENROLLMENT = '0';
    for (const path of ['/', '/caregiver', '/participant/conversation']) {
      const result = await page(path, true);
      expect(result.response.status).toBe(404);
      expect(result.resolved).toBe(false);
    }
  });
});

test('main UI review redirects only explicit local mock routes and cannot bypass the live gate', async () => {
  const previous = process.env.LEMMI_UI_PREVIEW;
  const mode = process.env.LEMMI_MODE;
  process.env.LEMMI_UI_PREVIEW = '1';
  try {
    process.env.LEMMI_MODE = 'mock';
    for (const [path, destination] of [
      ['/caregiver', '/preview/application'],
      ['/participant/conversation', '/preview/application?screen=conversation'],
      ['/participant', '/preview/application?screen=conversation'],
    ] as const) {
      let resolved = false;
      const request = new Request('http://127.0.0.1:5187' + path);
      const response = await handle({
        event: { url: new URL(request.url), request, getClientAddress: () => '127.0.0.1' },
        resolve: async () => {
          resolved = true;
          return new Response();
        },
      } as any);
      expect(response.status).toBe(303);
      expect(response.headers.get('location')).toBe(destination);
      expect(resolved).toBe(false);
    }
    await configured(async () => {
      const locked = await page('/caregiver');
      expect(locked.response.headers.get('location')).toBe('/access');
    });
  } finally {
    if (previous === undefined) delete process.env.LEMMI_UI_PREVIEW;
    else process.env.LEMMI_UI_PREVIEW = previous;
    if (mode === undefined) delete process.env.LEMMI_MODE;
    else process.env.LEMMI_MODE = mode;
  }
});
