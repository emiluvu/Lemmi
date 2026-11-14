// Production-build wiring smoke. Identity provider and robot are explicit local fixtures;
// all HTTPS/WSS certificate checks remain enabled. No real sends, audio or private data.
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const directory = await mkdtemp(join(tmpdir(), 'lemmi-control-smoke-'));
const keyPath = join(directory, 'key.pem');
const certPath = join(directory, 'cert.pem');
const children: ReturnType<typeof Bun.spawn>[] = [];
let proxy: ReturnType<typeof Bun.serve> | undefined;
let identity: ReturnType<typeof Bun.serve> | undefined;
function availablePort() {
  const reservation = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: () => new Response() });
  const port = reservation.port!;
  reservation.stop(true);
  return port;
}
async function until(predicate: () => boolean | Promise<boolean>) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await Bun.sleep(25);
  }
  throw new Error('Control smoke timed out');
}
function requireValue(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
try {
  const certificate = Bun.spawnSync(
    [
      'openssl',
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-keyout',
      keyPath,
      '-out',
      certPath,
      '-days',
      '1',
      '-subj',
      '/CN=localhost',
      '-addext',
      'subjectAltName=DNS:localhost,IP:127.0.0.1',
    ],
    { stdout: 'ignore', stderr: 'ignore' },
  );
  requireValue(certificate.exitCode === 0, 'OpenSSL test certificate generation failed');
  const ca = await Bun.file(certPath).text();
  const tls = { key: Bun.file(keyPath), cert: Bun.file(certPath) };
  const managedToken = crypto.randomUUID();
  const clientSecret = crypto.randomUUID();
  identity = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    tls,
    async fetch(request) {
      const token = (await request.formData()).get('token');
      if (
        request.headers.get('authorization') !==
        `Basic ${Buffer.from(`fixture-client:${clientSecret}`).toString('base64')}`
      )
        return new Response(null, { status: 401 });
      return Response.json({
        active: token === managedToken,
        iss: 'https://fixture-issuer.invalid',
        aud: 'lemmi-control',
        sub: 'fixture-caregiver-alex',
        exp: Math.floor(Date.now() / 1000) + 300,
        token_type: 'Bearer',
      });
    },
  });
  const gatewayPort = availablePort();
  const webPort = availablePort();
  let origin = '';
  const tlsProxy = Bun.serve<{ upstream: WebSocket }>({
    hostname: '127.0.0.1',
    port: 0,
    tls,
    async fetch(request, server) {
      const url = new URL(request.url);
      const headers = new Headers(request.headers);
      headers.set('host', new URL(origin).host);
      headers.set('x-forwarded-proto', 'https');
      if (url.pathname === '/v1/device-stream') {
        const upstream = new WebSocket(`ws://127.0.0.1:${gatewayPort}/v1/device-stream`, {
          headers: Object.fromEntries(headers),
        });
        try {
          await new Promise<void>((resolve, reject) => {
            upstream.onopen = () => resolve();
            upstream.onerror = () => reject(new Error('Fixture upstream unavailable'));
          });
          return server.upgrade(request, { data: { upstream } })
            ? undefined
            : new Response(null, { status: 400 });
        } catch {
          upstream.close();
          return new Response(null, { status: 502 });
        }
      }
      if (
        !/^\/v1\/(devices\/stackchan-alex\/(pairings|revoke)|device-pairings\/claim)$/.test(
          url.pathname,
        )
      )
        return new Response(null, { status: 404 });
      try {
        return await fetch(`http://127.0.0.1:${webPort}${url.pathname}${url.search}`, {
          method: request.method,
          headers,
          body: request.body,
          redirect: 'error',
        });
      } catch {
        return new Response(null, { status: 503 });
      }
    },
    websocket: {
      open(ws) {
        ws.data.upstream.onmessage = (event) => ws.send(String(event.data));
        ws.data.upstream.onclose = () => ws.close();
      },
      message(ws, message) {
        ws.data.upstream.send(message);
      },
      close(ws) {
        ws.data.upstream.close();
      },
    },
  });
  proxy = tlsProxy as ReturnType<typeof Bun.serve>;
  origin = `https://127.0.0.1:${tlsProxy.port}`;
  const env = {
    ...process.env,
    LEMMI_MODE: 'live',
    LEMMI_PUBLIC_ORIGIN: origin,
    LEMMI_CONTROL_TOKEN: crypto.randomUUID(),
    GATEWAY_PORT: String(gatewayPort),
    HOST: '127.0.0.1',
    PORT: String(webPort),
    ORIGIN: origin,
    ADDRESS_HEADER: '',
    HOST_HEADER: '',
    PROTOCOL_HEADER: '',
    NODE_EXTRA_CA_CERTS: certPath,
    LEMMI_AUTH_INTROSPECTION_URL: `https://127.0.0.1:${identity.port}/introspect`,
    LEMMI_AUTH_ISSUER: 'https://fixture-issuer.invalid',
    LEMMI_AUTH_AUDIENCE: 'lemmi-control',
    LEMMI_AUTH_CLIENT_ID: 'fixture-client',
    LEMMI_AUTH_CLIENT_SECRET: clientSecret,
    LEMMI_CAREGIVER_SUBJECT: 'fixture-caregiver-alex',
  };
  for (const script of ['apps/realtime/src/index.ts', 'apps/web/build/index.js'])
    children.push(
      Bun.spawn([process.execPath, script], { env, stdout: 'ignore', stderr: 'inherit' }),
    );
  async function call(path: string, input: unknown, token?: string, requestOrigin = origin) {
    return fetch(`${origin}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: requestOrigin,
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(input),
      tls: { ca },
      signal: AbortSignal.timeout(3000),
    });
  }
  await until(async () => {
    try {
      return (await call('/v1/device-pairings/claim', {})).status === 400;
    } catch {
      return false;
    }
  });
  const pairPath = '/v1/devices/stackchan-alex/pairings';
  const input = {
    deviceId: 'stackchan-alex',
    profileId: 'profile-alex',
    commandId: crypto.randomUUID(),
  };
  requireValue((await call(pairPath, input)).status === 401, 'Missing caregiver token accepted');
  requireValue(
    (await call(pairPath, input, managedToken, 'https://foreign.invalid')).status === 403,
    'Foreign origin accepted',
  );
  requireValue(
    (await call(pairPath, { ...input, profileId: 'preview-sam' }, managedToken)).status === 403,
    'Preview profile accepted',
  );
  requireValue(
    (await fetch(`${origin}${pairPath}`, { tls: { ca } })).status === 405,
    'GET permitted a pairing operation',
  );
  const paired = await call(pairPath, input, managedToken);
  requireValue(paired.status === 200, `Production pairing route failed (${paired.status})`);
  const pairing = ((await paired.json()) as any).data;
  const claimed = await call('/v1/device-pairings/claim', {
    pairingId: pairing.pairingId,
    code: pairing.code,
    localConfirmed: true,
  });
  requireValue(claimed.status === 200, 'Production local-confirmation route failed');
  requireValue(
    claimed.headers.get('cache-control') === 'no-store',
    'Credential response could be cached',
  );
  const device = ((await claimed.json()) as any).data;
  const harness = Bun.spawn([process.execPath, 'scripts/fake-device.ts'], {
    env: { ...env, LEMMI_DEVICE_CREDENTIAL: device.credential, LEMMI_DEVICE_CA_FILE: certPath },
    stdin: 'pipe',
    stdout: 'pipe',
    stderr: 'inherit',
  });
  children.push(harness);
  let output = '';
  const reading = (async () => {
    for await (const chunk of harness.stdout as ReadableStream<Uint8Array>)
      output += new TextDecoder().decode(chunk);
  })();
  let position = 0;
  async function observed(text: string) {
    await until(() => output.indexOf(text, position) >= 0);
    position = output.indexOf(text, position) + text.length;
  }
  await observed('Authenticated computer harness');
  (harness.stdin as Bun.FileSink).write('start\n');
  await observed('Session: ready');
  (harness.stdin as Bun.FileSink).write('pause\n');
  await observed('Session: paused');
  (harness.stdin as Bun.FileSink).write('resume\n');
  await observed('Session: ready');
  (harness.stdin as Bun.FileSink).end();
  const revoked = await call(
    '/v1/devices/stackchan-alex/revoke',
    { deviceId: 'stackchan-alex', commandId: crypto.randomUUID() },
    managedToken,
  );
  requireValue(revoked.status === 200, 'Production revoke route failed');
  await harness.exited;
  await reading;
  requireValue(
    !output.includes(device.credential) && !output.includes(pairing.code),
    'Provisioning secret reached harness output',
  );
  requireValue(
    output.includes('Control harness closed'),
    'Revocation did not close the computer client',
  );
  console.info(
    'PASS: production SvelteKit routes → fixture managed identity over verified HTTPS → gateway pairing → verified WSS computer harness → start/pause/resume/revoke. No real provider, hardware, media or notifications.',
  );
} finally {
  for (const child of children) if (child.exitCode === null) child.kill();
  await Promise.all(children.map((child) => child.exited));
  proxy?.stop(true);
  identity?.stop(true);
  await rm(directory, { recursive: true });
}
