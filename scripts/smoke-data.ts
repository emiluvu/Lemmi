// Actual production SvelteKit routes, local PostgreSQL and certificate-verified HTTPS.
// Caregiver identity is an explicit fixture; no accounts/providers/media outside test data.
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { database, migrate, PrivateMedia, DataRepository } from '@lemmi/server';
import { startControlGateway } from '../apps/realtime/src/control';

const url = process.env.LEMMI_TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_test'))
  throw new Error('Use a dedicated PostgreSQL database ending in _test');
const directory = await mkdtemp(join(tmpdir(), 'lemmi-data-smoke-'));
const accessKey = crypto.randomUUID();
const sql = database(url);
let web: ReturnType<typeof Bun.spawn> | undefined;
let gateway: ReturnType<typeof startControlGateway> | undefined;
let proxy: ReturnType<typeof Bun.serve> | undefined;
let identity: ReturnType<typeof Bun.serve> | undefined;
function check(value: boolean, message: string): asserts value {
  if (!value) throw new Error(message);
}
try {
  await migrate(sql);
  await sql`TRUNCATE lemmi.profiles CASCADE`;
  const cert = join(directory, 'cert.pem'),
    key = join(directory, 'key.pem');
  const generated = Bun.spawnSync(
    [
      'openssl',
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-keyout',
      key,
      '-out',
      cert,
      '-days',
      '1',
      '-subj',
      '/CN=localhost',
      '-addext',
      'subjectAltName=DNS:localhost,IP:127.0.0.1',
    ],
    { stdout: 'ignore', stderr: 'ignore' },
  );
  check(generated.exitCode === 0, 'Certificate fixture failed');
  const tls = { key: Bun.file(key), cert: Bun.file(cert) };
  const subject = 'fixture-caregiver',
    token = crypto.randomUUID(),
    internalToken = crypto.randomUUID(),
    clientSecret = crypto.randomUUID();
  identity = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    tls,
    async fetch(request) {
      const secret = `Basic ${Buffer.from(`fixture-client:${clientSecret}`).toString('base64')}`;
      if (request.headers.get('authorization') !== secret)
        return new Response(null, { status: 401 });
      const supplied = (await request.formData()).get('token');
      return Response.json({
        active: supplied === token,
        iss: 'fixture-issuer',
        aud: 'lemmi-data',
        sub: subject,
        exp: Math.floor(Date.now() / 1000) + 300,
        token_type: 'Bearer',
      });
    },
  });
  const reservation = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: () => new Response() });
  const webPort = reservation.port!;
  reservation.stop(true);
  let origin = '';
  proxy = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    tls,
    async fetch(request) {
      const path = new URL(request.url).pathname;
      if (
        !/^\/v1\/(profiles\/|participant\/profiles\/|assets\/|devices\/|device-pairings\/)/.test(
          path,
        )
      )
        return new Response(null, { status: 404 });
      const headers = new Headers(request.headers);
      headers.set('host', new URL(origin).host);
      headers.set('x-forwarded-proto', 'https');
      try {
        return await fetch(`http://127.0.0.1:${webPort}${path}`, {
          method: request.method,
          headers,
          body: request.body,
          redirect: 'error',
        });
      } catch {
        return new Response(null, { status: 503 });
      }
    },
  });
  origin = `https://127.0.0.1:${proxy.port}`;
  const repo = new DataRepository(sql, await PrivateMedia.create(join(directory, 'private-media')));
  gateway = startControlGateway({
    publicOrigin: origin,
    internalToken,
    accessKey,
    port: 0,
    repository: repo,
    caregiverSubject: subject,
  });
  await gateway.ready;
  web = Bun.spawn([process.execPath, 'apps/web/build/index.js'], {
    stdout: 'ignore',
    stderr: 'ignore',
    env: {
      ...process.env,
      LEMMI_MODE: 'live',
      BODY_SIZE_LIMIT: '29M',
      HOST: '127.0.0.1',
      PORT: String(webPort),
      ORIGIN: origin,
      LEMMI_PUBLIC_ORIGIN: origin,
      GATEWAY_PORT: String(gateway.server.port),
      LEMMI_CONTROL_TOKEN: internalToken,
      LEMMI_ACCESS_KEY: accessKey,
      LEMMI_CAREGIVER_SUBJECT: subject,
      LEMMI_AUTH_INTROSPECTION_URL: `https://127.0.0.1:${identity.port}`,
      LEMMI_AUTH_ISSUER: 'fixture-issuer',
      LEMMI_AUTH_AUDIENCE: 'lemmi-data',
      LEMMI_AUTH_CLIENT_ID: 'fixture-client',
      LEMMI_AUTH_CLIENT_SECRET: clientSecret,
      NODE_EXTRA_CA_CERTS: cert,
    },
  });
  const ca = await Bun.file(cert).text();
  async function request(path: string, method = 'GET', body?: unknown, credential: string = token) {
    return fetch(origin + path, {
      method,
      headers: {
        'X-Lemmi-Access-Key': accessKey,
        authorization: `Bearer ${credential}`,
        origin,
        'content-type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      tls: { ca, rejectUnauthorized: true },
    });
  }
  const deadline = Date.now() + 10000;
  let ready = false;
  while (Date.now() < deadline) {
    const response = await request('/v1/profiles/profile-alex');
    if (response.status === 200) {
      ready = true;
      break;
    }
    await Bun.sleep(50);
  }
  check(ready, 'Production web/profile route did not become ready');
  check(
    (
      await fetch(origin + '/v1/profiles/profile-alex', {
        headers: { authorization: `Bearer ${token}` },
        tls: { ca },
      })
    ).status === 401,
    'Profile route bypassed the domain gate',
  );
  const before = await request('/v1/profiles/profile-alex');
  const initial = ((await before.json()) as any).data;
  check(
    initial.preferredName === 'Alex' && initial.approvedFacts.length === 0,
    'Wrong persisted profile',
  );
  const patch = {
    profileId: 'profile-alex',
    commandId: crypto.randomUUID(),
    expectedRevision: initial.revision,
    patch: { preferredName: 'Alex Fictional', avatarId: 'bunny' },
  };
  const updated = await request('/v1/profiles/profile-alex', 'PATCH', patch);
  check(updated.status === 200, 'Profile PATCH failed');
  const retry = await request('/v1/profiles/profile-alex', 'PATCH', patch);
  check(retry.status === 200, 'Idempotent profile retry failed');
  check(
    (
      await request('/v1/profiles/profile-alex', 'PATCH', {
        ...patch,
        commandId: crypto.randomUUID(),
      })
    ).status === 409,
    'Stale profile edit accepted',
  );
  check(
    (await request('/v1/profiles/preview-sam')).status === 403,
    'Preview profile reached live data',
  );
  check(
    (await request('/v1/profiles/profile-alex', 'GET', undefined, 'invalid')).status === 401,
    'Invalid managed token accepted',
  );
  const pairResponse = await request('/v1/devices/stackchan-alex/pairings', 'POST', {
    deviceId: 'stackchan-alex',
    profileId: 'profile-alex',
    commandId: crypto.randomUUID(),
  });
  check(pairResponse.status === 200, 'Pairing failed');
  const pairing = ((await pairResponse.json()) as any).data;
  const claim = await request('/v1/device-pairings/claim', 'POST', {
    pairingId: pairing.pairingId,
    code: pairing.code,
    localConfirmed: true,
  });
  check(claim.status === 200, 'Claim failed');
  const credential = ((await claim.json()) as any).data.credential;
  const safe = await request('/v1/participant/profiles/profile-alex', 'GET', undefined, credential);
  check(safe.status === 200, 'Participant profile failed');
  const text = await safe.text();
  check(
    !text.includes('sensitiveTopicGuidance') && !text.includes('approvedFacts'),
    'Participant data leaked caregiver fields',
  );
  check(
    (await request('/v1/profiles/profile-alex', 'GET', undefined, credential)).status === 401,
    'Device accessed caregiver route',
  );
  const image =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNIqegBAAKsAWn9Yi+6AAAAAElFTkSuQmCC';
  const photoInput = {
    profileId: 'profile-alex',
    commandId: crypto.randomUUID(),
    expectedRevision: 1,
    kind: 'image',
    mediaType: 'image/png',
    source: 'Synthetic test pixel',
    permission: 'Team test fixture',
    caption: 'A fictional pixel',
    discussionContext: 'Private photo context',
    entityIds: ['object:kettle'],
    approved: true,
    dataBase64: image,
  };
  const uploaded = await request('/v1/profiles/profile-alex/photos', 'POST', photoInput);
  check(uploaded.status === 200, 'Photo upload failed');
  const asset = ((await uploaded.json()) as any).data;
  const media = await request(`/v1/assets/${asset.id}`, 'GET', undefined, credential);
  check(media.status === 200, 'Scoped media read failed');
  check(
    Buffer.from(await media.arrayBuffer()).toString('base64') === image,
    'Private media bytes differ',
  );
  check(
    media.headers.get('cache-control')?.includes('no-store') === true,
    'Private media caching allowed',
  );
  const meta = await request(`/v1/assets/${asset.id}/metadata`, 'GET', undefined, credential);
  check(meta.status === 200, 'Asset metadata route failed');
  const metadata = await meta.text();
  check(
    !metadata.includes('discussionContext') && !metadata.includes('storage_key'),
    'Private metadata leaked',
  );
  check(
    (await request(`/v1/profiles/profile-alex/assets/${asset.id}`)).status === 200,
    'Caregiver media route failed',
  );
  check(
    (
      await request('/v1/profiles/profile-alex/photos', 'POST', {
        ...photoInput,
        commandId: crypto.randomUUID(),
        mediaType: 'image/svg+xml',
        dataBase64: 'PHN2Zz4=',
      })
    ).status === 400,
    'Unsupported SVG accepted',
  );
  const unconfigured = await request(
    '/v1/assets/' + crypto.randomUUID(),
    'GET',
    undefined,
    credential,
  );
  check(unconfigured.status === 404, 'Missing asset did not return explicit failure');
  await request('/v1/devices/stackchan-alex/revoke', 'POST', {
    deviceId: 'stackchan-alex',
    commandId: crypto.randomUUID(),
  });
  check(
    (await request('/v1/participant/profiles/profile-alex', 'GET', undefined, credential))
      .status === 403,
    'Revoked participant credential accepted',
  );
  console.info(
    'PASS: production SvelteKit → authenticated gateway → real PostgreSQL profile read/edit/retry/conflict; approved photo upload/read, scoped participant projection, preview denial and committed device revocation. TLS verified; identity is a fixture.',
  );
} catch {
  console.error(
    'FAIL: database production smoke; inspect setup and the explicit assertions locally without logging private request bodies.',
  );
  process.exitCode = 1;
} finally {
  if (web) {
    web.kill();
    await web.exited;
  }
  proxy?.stop(true);
  identity?.stop(true);
  gateway?.stop();
  await gateway?.data?.close();
  await sql.close();
  await rm(directory, { recursive: true, force: true });
}
