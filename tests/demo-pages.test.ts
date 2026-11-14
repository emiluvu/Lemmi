import { expect, test } from 'bun:test';
import { handle } from '../apps/web/src/hooks.server';
import { accessCookie } from '@lemmi/server';

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
      '/participant/conversation',
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
