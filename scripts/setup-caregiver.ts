// One-time loopback setup: no token persistence, callback logging or browser app session.
import { readFile, writeFile, chmod } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { authenticateCaregiver, caregiverAuthConfig, boundedJson } from '@lemmi/server';

if (!process.argv.includes('--assign-alex'))
  throw new Error(
    'Use --assign-alex to explicitly assign the signed-in caregiver to fictional Alex',
  );
const config = caregiverAuthConfig({
  ...process.env,
  LEMMI_CAREGIVER_SUBJECT: 'pending-setup',
});
const setupPort = Number(process.env.LEMMI_SETUP_PORT ?? 3333);
if (!Number.isInteger(setupPort) || setupPort < 1024 || setupPort > 65535)
  throw new Error('LEMMI_SETUP_PORT must be an integer from 1024 to 65535');
const setupOrigin = `http://127.0.0.1:${setupPort}`;
const redirect = `${setupOrigin}/callback`;
const state = crypto.randomUUID();
const verifier = crypto.randomUUID() + crypto.randomUUID();
const challenge = createHash('sha256').update(verifier).digest('base64url');
const originalEnv = await readFile('.env', 'utf8');
const discovery = await fetch(`${config.issuer}/.well-known/openid-configuration`, {
  redirect: 'error',
  signal: AbortSignal.timeout(10000),
});
if (!discovery.ok) throw new Error('OIDC discovery unavailable');
const metadata = (await boundedJson(discovery, 16384)) as Record<string, unknown>;
if (metadata.issuer !== config.issuer) throw new Error('OIDC discovery issuer mismatch');
function endpoint(name: string) {
  const url = new URL(String(metadata[name]));
  if (url.protocol !== 'https:' || url.origin !== new URL(config.issuer).origin)
    throw new Error('Unexpected OIDC endpoint');
  return url.href;
}
const authorization = new URL(endpoint('authorization_endpoint'));
const tokenEndpoint = endpoint('token_endpoint');
const introspectionEndpoint = endpoint('introspection_endpoint');
if (introspectionEndpoint !== config.endpoint) throw new Error('Introspection endpoint mismatch');
for (const [key, value] of Object.entries({
  client_id: config.clientId,
  redirect_uri: redirect,
  response_type: 'code',
  scope: 'openid',
  state,
  code_challenge: challenge,
  code_challenge_method: 'S256',
}))
  authorization.searchParams.set(key, value);
const basic = `Basic ${Buffer.from(`${encodeURIComponent(config.clientId)}:${encodeURIComponent(config.clientSecret)}`).toString('base64')}`;
let busy = false;
let finish!: (code: number) => void;
const completed = new Promise<number>((resolve) => (finish = resolve));
const server = Bun.serve({
  hostname: '127.0.0.1',
  port: setupPort,
  maxRequestBodySize: 4096,
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method !== 'GET' || url.origin !== setupOrigin || url.pathname !== '/callback')
      return new Response('Not found', { status: 404 });
    if (busy || url.searchParams.get('state') !== state)
      return new Response('Invalid setup callback', { status: 403 });
    busy = true;
    try {
      const code = url.searchParams.get('code');
      if (!code || code.length > 4096) throw new Error('No authorization code');
      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(10000),
        headers: { authorization: basic, 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirect,
          code_verifier: verifier,
        }),
      });
      if (!response.ok) throw new Error('Token exchange rejected');
      const tokens = (await boundedJson(response, 16384)) as Record<string, unknown>;
      if (typeof tokens.access_token !== 'string' || tokens.token_type !== 'Bearer')
        throw new Error('No bearer access token');
      const inspected = await fetch(config.endpoint, {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(10000),
        headers: { authorization: basic, 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token: tokens.access_token, token_type_hint: 'access_token' }),
      });
      if (!inspected.ok) throw new Error('Introspection rejected');
      const claims = (await boundedJson(inspected, 16384)) as Record<string, unknown>;
      if (typeof claims.sub !== 'string' || !/^[a-zA-Z0-9._:@-]{1,256}$/.test(claims.sub))
        throw new Error('No valid subject');
      const verified = await authenticateCaregiver(
        new Request('https://lemmi.invalid', {
          headers: { authorization: `Bearer ${tokens.access_token}` },
        }),
        { ...config, subject: claims.sub },
      );
      if (!verified.ok)
        throw new Error('Caregiver token failed issuer, binding, type or expiry checks');
      if ((await readFile('.env', 'utf8')) !== originalEnv)
        throw new Error('Configuration changed during setup; restart setup');
      const password = process.env.LEMMI_POSTGRES_PASSWORD;
      if (!password) throw new Error('Local database password missing');
      let updated = originalEnv;
      for (const [key, value] of Object.entries({
        LEMMI_CAREGIVER_SUBJECT: claims.sub,
        LEMMI_DATABASE_URL: `postgres://lemmi:${encodeURIComponent(password)}@127.0.0.1:5432/lemmi`,
      })) {
        if (!updated.split('\n').some((line) => line.startsWith(`${key}=`)))
          throw new Error('Expected configuration entry missing');
        updated = updated
          .split('\n')
          .map((line) => (line.startsWith(`${key}=`) ? `${key}=${value}` : line))
          .join('\n');
      }
      await writeFile('.env', updated, { mode: 0o600 });
      await chmod('.env', 0o600);
      console.info(
        'PASS: verified real caregiver identity; private Alex assignment/database configuration saved. Tokens were not saved. Run db:migrate and db:bootstrap before restarting services.',
      );
      setTimeout(() => finish(0), 500);
      return new Response('Lemmi caregiver setup verified. You may close this tab.', {
        headers: {
          'Cache-Control': 'no-store',
          'Content-Security-Policy': "default-src 'none'",
          'Referrer-Policy': 'no-referrer',
        },
      });
    } catch {
      console.error(
        'Caregiver setup failed; check private client settings and token compatibility. No provider details or credentials are logged.',
      );
      setTimeout(() => finish(1), 500);
      return new Response('Setup failed. Return to the terminal.', {
        status: 400,
        headers: { 'Cache-Control': 'no-store' },
      });
    }
  },
});
const timeout = setTimeout(() => finish(1), 5 * 60_000);
console.info(
  'Open this URL in a browser ON THIS MACHINE and sign in as the caregiver to assign to Alex:',
);
console.info(authorization.href);
const result = await completed;
clearTimeout(timeout);
server.stop(true);
process.exitCode = result;
