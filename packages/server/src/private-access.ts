import { createHmac, randomUUID } from 'node:crypto';
import { secretMatches } from './device-access';
import { readBounded } from './adapters/types';

const COOKIE = '__Host-lemmi_access';
const TTL_SECONDS = 8 * 60 * 60;
export function privateAccessKey(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const key = env.LEMMI_ACCESS_KEY ?? '';
  if (!key) return null;
  if (
    !/^[\x21-\x7e]{32,256}$/.test(key) ||
    [env.LEMMI_CONTROL_TOKEN, env.LEMMI_MOCK_TOKEN, env.OPENROUTER_API_KEY].some(
      (other) => other && secretMatches(key, other),
    )
  )
    throw new Error('Use an independent private access key of 32 to 256 visible characters');
  return key;
}
const sign = (value: string, key: string) =>
  createHmac('sha256', key).update(value).digest('base64url');
export function accessCookie(key: string, now = Date.now()): string {
  const value = `v1.${Math.floor(now / 1000) + TTL_SECONDS}.${randomUUID()}`;
  return `${COOKIE}=${value}.${sign(value, key)}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${TTL_SECONDS}`;
}
export function hasPrivateAccess(request: Request, key: string | null, now = Date.now()): boolean {
  if (!key) return true;
  const header = request.headers.get('x-lemmi-access-key');
  if (header !== null) return header.length <= 256 && secretMatches(header, key);
  const cookies = (request.headers.get('cookie') ?? '')
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${COOKIE}=`));
  if (cookies.length !== 1) return false;
  const token = cookies[0]!.slice(COOKIE.length + 1);
  if (token.length > 200) return false;
  const parts = token.split('.');
  if (parts.length !== 4 || parts[0] !== 'v1' || !/^\d+$/.test(parts[1]!)) return false;
  const expiry = Number(parts[1]);
  const seconds = Math.floor(now / 1000);
  return (
    Number.isSafeInteger(expiry) &&
    expiry > seconds &&
    expiry <= seconds + TTL_SECONDS &&
    secretMatches(parts[3]!, sign(parts.slice(0, 3).join('.'), key))
  );
}

const page = (message: string) =>
  `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Lemmi private access</title><main><h1>Lemmi private access</h1><p>${message}</p><form method="post" action="/access"><label>Access key <input name="key" type="password" required maxlength="256" autocomplete="off"></label><button type="submit">Unlock</button></form><form method="post" action="/access/logout"><button type="submit">Lock this browser</button></form></main></html>`;
const headers = {
  'Cache-Control': 'no-store',
  'Content-Type': 'text/html; charset=utf-8',
  'Content-Security-Policy':
    "default-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};
export function createPrivateAccessHandler() {
  let windowStart = 0;
  let attempts = 0;
  return async (request: Request, key: string | null, origin: string, now = Date.now()) => {
    const url = new URL(request.url);
    if (!key) return new Response('Private access is not configured', { status: 503, headers });
    if (url.origin !== origin || url.search) return new Response(null, { status: 403, headers });
    if (request.method === 'GET' && url.pathname === '/access')
      return new Response(
        page(
          hasPrivateAccess(request, key, now)
            ? 'This browser is unlocked. Caregiver sign-in is still required for caregiver operations.'
            : 'Enter the private demo access key. Caregiver sign-in is separate.',
        ),
        { headers },
      );
    if (request.method !== 'POST') return new Response(null, { status: 405, headers });
    if (request.headers.get('origin') !== origin)
      return new Response(null, { status: 403, headers });
    if (url.pathname === '/access/logout')
      return new Response(page('This browser is locked.'), {
        headers: {
          ...headers,
          'Set-Cookie': `${COOKIE}=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0`,
        },
      });
    if (url.pathname !== '/access') return new Response(null, { status: 404, headers });
    if (now - windowStart >= 60_000) {
      windowStart = now;
      attempts = 0;
    }
    if (++attempts > 20)
      return new Response('Try again later', {
        status: 429,
        headers: { ...headers, 'Retry-After': '60' },
      });
    try {
      if (
        request.headers.get('content-type')?.split(';')[0] !== 'application/x-www-form-urlencoded'
      )
        return new Response(null, { status: 415, headers });
      const body = await readBounded(new Response(request.body), 4096);
      const form = new URLSearchParams(new TextDecoder().decode(body));
      const submitted = form.get('key') ?? '';
      if (
        form.getAll('key').length !== 1 ||
        submitted.length > 256 ||
        !secretMatches(submitted, key)
      )
        return new Response(page('Access key not accepted.'), { status: 401, headers });
      return new Response(
        page(
          'This browser is unlocked. Caregiver sign-in is still required for caregiver operations.',
        ),
        { headers: { ...headers, 'Set-Cookie': accessCookie(key, now) } },
      );
    } catch {
      return new Response('Invalid access request', { status: 400, headers });
    }
  };
}
