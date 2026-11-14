import { expect, test } from 'bun:test';
import {
  privateAccessKey,
  controlConfig,
  accessCookie,
  hasPrivateAccess,
  createPrivateAccessHandler,
} from '@lemmi/server';
import { startControlGateway } from '../apps/realtime/src/control';

const key = 'private-access-fixture-independent-1234567890';
const origin = 'https://lemmi.invalid';
const now = 1_800_000_000_000;
const request = (headers: Record<string, string> = {}) => new Request(origin, { headers });
test('private gate is independent, rejects malformed secrets, and preserves legacy opt-out', () => {
  expect(() =>
    controlConfig({
      LEMMI_MODE: 'live',
      LEMMI_PUBLIC_ORIGIN: origin,
      LEMMI_CONTROL_TOKEN: 'i'.repeat(40),
    }),
  ).toThrow('LEMMI_ACCESS_KEY is required');
  expect(privateAccessKey({})).toBeNull();
  expect(privateAccessKey({ LEMMI_ACCESS_KEY: key })).toBe(key);
  for (const value of ['short', key + '\n', 'x'.repeat(257)])
    expect(() => privateAccessKey({ LEMMI_ACCESS_KEY: value })).toThrow();
  expect(() => privateAccessKey({ LEMMI_ACCESS_KEY: key, LEMMI_CONTROL_TOKEN: key })).toThrow();
  expect(hasPrivateAccess(request(), null)).toBe(true);
  expect(hasPrivateAccess(request(), key)).toBe(false);
  expect(hasPrivateAccess(request({ 'X-Lemmi-Access-Key': key }), key)).toBe(true);
  expect(hasPrivateAccess(request({ Authorization: `Bearer ${key}` }), key)).toBe(false);
});
test('browser cookies are signed, expiring, host-only and invalid after key rotation', () => {
  const cookie = accessCookie(key, now);
  expect(cookie).toContain('Secure; HttpOnly; SameSite=Strict');
  expect(cookie).not.toContain(key);
  const headers = { cookie: cookie.split(';')[0]! };
  expect(hasPrivateAccess(request(headers), key, now)).toBe(true);
  expect(hasPrivateAccess(request(headers), key, now + 8 * 60 * 60_000)).toBe(false);
  expect(hasPrivateAccess(request(headers), key + 'rotated', now)).toBe(false);
  expect(hasPrivateAccess(request({ cookie: headers.cookie + 'tampered' }), key, now)).toBe(false);
  expect(
    hasPrivateAccess(request({ cookie: headers.cookie + '; ' + headers.cookie }), key, now),
  ).toBe(false);
});
test('unlock requires same-origin form POST, bounds guessing and supports explicit browser lock', async () => {
  const handler = createPrivateAccessHandler();
  const unlock = (submitted: string, from = origin) =>
    handler(
      new Request(origin + '/access', {
        method: 'POST',
        headers: { origin: from, 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ key: submitted }),
      }),
      key,
      origin,
      now,
    );
  expect((await unlock(key, 'https://foreign.invalid')).status).toBe(403);
  expect(
    (await handler(new Request(origin + '/access?key=forbidden'), key, origin, now)).status,
  ).toBe(403);
  expect((await unlock('incorrect')).status).toBe(401);
  const response = await unlock(key);
  expect(response.status).toBe(200);
  expect(response.headers.get('set-cookie')).toContain('__Host-lemmi_access=');
  expect(await response.text()).not.toContain(key);
  const locked = await handler(
    new Request(origin + '/access/logout', {
      method: 'POST',
      headers: { origin },
    }),
    key,
    origin,
    now,
  );
  expect(locked.headers.get('set-cookie')).toContain('Max-Age=0');
  for (let i = 0; i < 18; i++) await unlock('incorrect');
  expect((await unlock(key)).status).toBe(429);
  expect((await handler(new Request(origin + '/access'), null, origin, now)).status).toBe(503);
});
test('access pages preserve native form origins while rejecting opaque and missing origins', async () => {
  const handler = createPrivateAccessHandler();
  const page = await handler(new Request(origin + '/access'), key, origin, now);
  expect(page.headers.get('referrer-policy')).toBe('same-origin');
  for (const from of ['null', undefined]) {
    const headers = new Headers({ 'content-type': 'application/x-www-form-urlencoded' });
    if (from !== undefined) headers.set('origin', from);
    for (const path of ['/access', '/access/logout']) {
      const response = await handler(
        new Request(origin + path, {
          method: 'POST',
          headers,
          body: new URLSearchParams({ key }),
        }),
        key,
        origin,
        now,
      );
      expect(response.status).toBe(403);
      expect(response.headers.has('set-cookie')).toBe(false);
    }
  }
});
test('outer access alone does not authorize a device or expose the private gateway seam', async () => {
  const gateway = startControlGateway({
    publicOrigin: origin,
    internalToken: crypto.randomUUID(),
    port: 0,
    accessKey: key,
  });
  try {
    const base = `http://127.0.0.1:${gateway.server.port}`;
    const headers = { host: 'lemmi.invalid', 'x-forwarded-proto': 'https' };
    const denied = await fetch(base + '/v1/device-stream', { headers });
    expect(((await denied.json()) as any).error.message).toBe('Private access key required');
    const scoped = await fetch(base + '/v1/device-stream', {
      headers: { ...headers, 'X-Lemmi-Access-Key': key },
    });
    expect(((await scoped.json()) as any).error.message).toBe(
      'Current paired device credential required',
    );
    expect(
      (
        await fetch(base + '/internal/control/pair', {
          method: 'POST',
          headers: { 'X-Lemmi-Access-Key': key },
          body: '{}',
        })
      ).status,
    ).toBe(401);
  } finally {
    gateway.stop();
  }
});
