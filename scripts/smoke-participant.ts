// Real production HTTP + verified TLS/WSS + isolated PostgreSQL; model is a fixture.
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { database, migrate, PrivateMedia, DataRepository } from '@lemmi/server';
import { ServerEventSchema, ok, type ServerEvent } from '@lemmi/contracts';
import { startControlGateway } from '../apps/realtime/src/control';

const url = process.env.LEMMI_TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_test'))
  throw new Error('Dedicated _test database required');
const directory = await mkdtemp(join(tmpdir(), 'lemmi-participant-smoke-'));
const sql = database(url);
const accessKey = crypto.randomUUID(),
  internalToken = crypto.randomUUID();
let gateway: ReturnType<typeof startControlGateway> | undefined;
let web: ReturnType<typeof Bun.spawn> | undefined;
let proxy: ReturnType<typeof Bun.serve<{ upstream: WebSocket }>> | undefined;
const clients: WebSocket[] = [];
function check(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
async function until(predicate: () => boolean | Promise<boolean>) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await Bun.sleep(20);
  }
  throw new Error('Participant smoke deadline');
}
try {
  await migrate(sql);
  await sql`TRUNCATE lemmi.profiles CASCADE`;
  const cert = join(directory, 'cert.pem'),
    key = join(directory, 'key.pem');
  check(
    Bun.spawnSync(
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
    ).exitCode === 0,
    'Certificate fixture failed',
  );
  const ca = await Bun.file(cert).text();
  const reservation = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: () => new Response() });
  const webPort = reservation.port!;
  reservation.stop(true);
  let origin = '',
    gatewayPort = 0;
  proxy = Bun.serve<{ upstream: WebSocket }>({
    hostname: '127.0.0.1',
    port: 0,
    tls: { key: Bun.file(key), cert: Bun.file(cert) },
    async fetch(request, server) {
      const path = new URL(request.url).pathname;
      const headers = new Headers(request.headers);
      headers.set('host', new URL(origin).host);
      headers.set('x-forwarded-proto', 'https');
      if (path === '/v1/device-stream') {
        const upstream = new WebSocket(`ws://127.0.0.1:${gatewayPort}${path}`, {
          headers: Object.fromEntries(headers),
        });
        try {
          await new Promise<void>((resolve, reject) => {
            upstream.onopen = () => resolve();
            upstream.onerror = () => reject(new Error('Upstream denied'));
          });
          return server.upgrade(request, { data: { upstream } })
            ? undefined
            : new Response(null, { status: 400 });
        } catch {
          upstream.close();
          return new Response(null, { status: 403 });
        }
      }
      if (
        !/^\/(access(?:\/logout)?|participant|caregiver|_app\/.*|fonts\/nunito-latin-variable\.ttf|images\/(?:avatars\/(?:dog|cat|bunny|bird|lemming)\.png|surfaces\/(?:cream-paper-v1|conversation-meadow-v1)\.png)|v1\/demo\/(profiles|profile-update|conversation-lock|conversation-exit|enroll|current|release|photo-assets\/(?:photo-story-garden|photo-story-park)))$/.test(
          path,
        )
      )
        return new Response(null, { status: 404 });
      try {
        return await fetch(`http://127.0.0.1:${webPort}${path}`, {
          method: request.method,
          headers,
          body: request.body,
          redirect: 'manual',
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
        ws.data.upstream.send(String(message));
      },
      close(ws) {
        ws.data.upstream.close();
      },
    },
  });
  origin = `https://127.0.0.1:${proxy.port}`;
  const repo = new DataRepository(sql, await PrivateMedia.create(join(directory, 'private-media')));
  function start(port: number) {
    return startControlGateway({
      publicOrigin: origin,
      internalToken,
      accessKey,
      port,
      repository: repo,
      caregiverSubject: 'fixture-caregiver',
      demoEnrollment: true,
      chatAdapter: {
        async complete() {
          return ok({ text: 'We can enjoy the garden.', language: 'en' });
        },
      },
    });
  }
  gateway = start(0);
  await gateway.ready;
  gatewayPort = gateway.server.port!;
  web = Bun.spawn([process.execPath, 'apps/web/build/index.js'], {
    stdout: 'ignore',
    stderr: 'ignore',
    env: {
      ...process.env,
      LEMMI_MODE: 'live',
      LEMMI_DEMO_ENROLLMENT: '1',
      LEMMI_CAREGIVER_EXIT_PASSWORD: '7631',
      HOST: '127.0.0.1',
      PORT: String(webPort),
      ORIGIN: origin,
      LEMMI_PUBLIC_ORIGIN: origin,
      GATEWAY_PORT: String(gatewayPort),
      LEMMI_CONTROL_TOKEN: internalToken,
      LEMMI_ACCESS_KEY: accessKey,
    },
  });
  async function request(
    path: string,
    method = 'GET',
    body?: unknown,
    cookie?: string,
    keyHeader = false,
  ) {
    return fetch(origin + path, {
      method,
      headers: {
        origin,
        ...(cookie ? { cookie } : {}),
        ...(keyHeader ? { 'x-lemmi-access-key': accessKey } : {}),
        'content-type': 'application/json',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      tls: { ca, rejectUnauthorized: true },
      redirect: 'manual',
    });
  }
  await until(
    async () =>
      (await request('/v1/demo/profiles', 'GET', undefined, undefined, true)).status === 200,
  );
  check((await request('/v1/demo/profiles')).status === 401, 'Setup bypassed private gate');
  const unlock = await fetch(origin + '/access', {
    method: 'POST',
    headers: { origin, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ key: accessKey }),
    tls: { ca, rejectUnauthorized: true },
  });
  const gateCookie = unlock.headers.get('set-cookie')?.split(';')[0];
  check(gateCookie, 'Unlock cookie missing');
  const page = await request('/participant', 'GET', undefined, gateCookie);
  const html = await page.text();
  check(
    page.status === 200 && html.includes('Choose a participant') && html.includes('caregiver exit'),
    'Production participant setup page failed',
  );
  const navigationCookie = page.headers.get('set-cookie')?.split(';')[0];
  check(navigationCookie, 'Conversation navigation cookie missing');
  const lockedCookie = `${gateCookie}; ${navigationCookie}`;
  check(
    (await request('/caregiver', 'GET', undefined, lockedCookie)).status === 303,
    'Conversation exit navigation bypass',
  );
  check(
    (await request('/v1/demo/profiles', 'POST', { preferredName: 'Blocked fixture' }, lockedCookie))
      .status === 403,
    'Locked browser changed profiles',
  );
  check(
    (await request('/v1/demo/conversation-exit', 'POST', { password: '1111' }, lockedCookie))
      .status === 401,
    'Wrong exit code accepted',
  );
  const exited = await request(
    '/v1/demo/conversation-exit',
    'POST',
    { password: '7631' },
    lockedCookie,
  );
  check(
    exited.status === 200 && exited.headers.get('set-cookie')?.includes('Max-Age=0'),
    'Configured exit code did not clear navigation lock',
  );
  for (const [path, mime] of [
    ['/fonts/nunito-latin-variable.ttf', 'font/ttf'],
    ['/images/avatars/lemming.png', 'image/png'],
    ['/images/surfaces/cream-paper-v1.png', 'image/png'],
  ]) {
    const asset = await request(path!, 'GET', undefined, gateCookie);
    check(
      asset.ok && (asset.headers.get('content-type') ?? '').includes(mime!),
      'Participant UI asset failed',
    );
    await asset.body?.cancel();
  }
  check(
    (await request('/images/README.md', 'GET', undefined, gateCookie)).status === 404,
    'Static asset allowlist too broad',
  );
  const profiles = (await (
    await request('/v1/demo/profiles', 'GET', undefined, gateCookie)
  ).json()) as any;
  check(
    profiles.ok && profiles.data.some((p: any) => p.id === 'profile-alex'),
    'Alex missing from selector',
  );
  const created = (await (
    await request('/v1/demo/profiles', 'POST', { preferredName: 'Casey' }, gateCookie)
  ).json()) as any;
  check(
    created.ok && created.data.preferredName === 'Casey' && created.data.id !== 'profile-alex',
    'Independent profile creation failed',
  );
  const edit = {
    profileId: created.data.id,
    expectedRevision: 0,
    commandId: crypto.randomUUID(),
    patch: { preferredName: 'Casey', avatarId: 'cat' },
  };
  const editedResponse = await request('/v1/demo/profile-update', 'POST', edit, gateCookie);
  const edited = (await editedResponse.json()) as any;
  check(
    editedResponse.status === 200 &&
      edited.ok &&
      edited.data.avatarId === 'cat' &&
      edited.data.revision === 1 &&
      Object.keys(edited.data).length === 5,
    'Durable safe demo identity edit failed',
  );
  check(
    (
      await request(
        '/v1/demo/profile-update',
        'POST',
        { ...edit, commandId: crypto.randomUUID() },
        gateCookie,
      )
    ).status === 409,
    'Stale demo edit overwrote current data',
  );
  check(
    (
      await request(
        '/v1/demo/profile-update',
        'POST',
        { ...edit, patch: { ...edit.patch, interests: [] } },
        gateCookie,
      )
    ).status === 400,
    'Demo edit accepted private fields',
  );
  const enrolled = await request(
    '/v1/demo/enroll',
    'POST',
    { profileId: 'profile-alex', endpoint: 'browser' },
    gateCookie,
  );
  const safe = (await enrolled.json()) as any;
  const endpointCookie = enrolled.headers.get('set-cookie')?.split(';')[0];
  check(
    safe.ok &&
      !('credential' in safe.data) &&
      endpointCookie &&
      enrolled.headers.get('set-cookie')?.includes('HttpOnly'),
    'Browser token leaked or cookie missing',
  );
  const browserCookie = `${gateCookie}; ${endpointCookie}`;
  const robot = (await (
    await request(
      '/v1/demo/enroll',
      'POST',
      { profileId: created.data.id, endpoint: 'robot' },
      undefined,
      true,
    )
  ).json()) as any;
  check(robot.ok && robot.data.credential, 'Robot provisioning failed');
  async function connect(headers: Record<string, string>, endpoint: 'browser' | 'robot') {
    const socket = new WebSocket(origin.replace('https:', 'wss:') + '/v1/device-stream', {
      headers,
      tls: { ca, rejectUnauthorized: true },
    });
    clients.push(socket);
    const events: ServerEvent[] = [];
    let sequence = 0;
    socket.onmessage = (message) =>
      events.push(ServerEventSchema.parse(JSON.parse(String(message.data))));
    await new Promise<void>((resolve, reject) => {
      socket.onopen = () => resolve();
      socket.onerror = () => reject(new Error('Verified WSS failed'));
    });
    function send(type: string, payload: unknown = {}) {
      const session = [...events].reverse().find((event) => event.type === 'state.changed');
      const current = session?.type === 'state.changed' ? session.payload.session : null;
      socket.send(
        JSON.stringify({
          protocol_version: 1,
          event_id: crypto.randomUUID(),
          session_id: type === 'input.start' ? null : (current?.id ?? null),
          generation: type === 'input.start' ? 0 : (current?.generation ?? 0),
          turn_id: null,
          sequence: sequence++,
          type,
          payload,
        }),
      );
    }
    send('device.hello', {
      firmwareVersion: 'participant-smoke',
      endpoint,
      cameraSupported: false,
      pettingSupported: false,
      audio: { supported: false },
    });
    await until(() => events.some((event) => event.type === 'device.ready'));
    return { socket, events, send };
  }
  const browser = await connect({ cookie: browserCookie, origin }, 'browser');
  const device = await connect(
    { 'x-lemmi-access-key': accessKey, authorization: `Bearer ${robot.data.credential}` },
    'robot',
  );
  browser.send('input.start');
  device.send('input.start');
  await until(() =>
    [browser, device].every((client) =>
      client.events.some(
        (event) => event.type === 'state.changed' && event.payload.session?.phase === 'ready',
      ),
    ),
  );
  browser.send('input.text', { text: 'Hello fictional garden', language: 'en' });
  await until(() => browser.events.some((event) => event.type === 'response.text'));
  check(!device.events.some((event) => event.type === 'response.text'), 'Cross-profile reply leak');
  let boundary = browser.events.length;
  browser.send('input.text', { text: 'Start Photo Story', language: 'en' });
  await until(() => browser.events.slice(boundary).some((event) => event.type === 'response.text'));
  check(
    browser.events
      .slice(boundary)
      .some(
        (event) =>
          event.type === 'activity.changed' && event.payload.activity?.activityId === 'photo_album',
      ),
    'Reviewed spoken-phrase transport did not select Photo Story',
  );
  boundary = browser.events.length;
  browser.send('input.text', { text: 'Back to conversation', language: 'en' });
  await until(() => browser.events.slice(boundary).some((event) => event.type === 'response.text'));
  // Public Photo Story uses the existing browser identity and scoped current-scene read.
  browser.send('input.photo.start');
  await until(() =>
    browser.events.some(
      (event) =>
        event.type === 'activity.changed' &&
        event.payload.activity?.activityId === 'photo_album' &&
        event.payload.activity.currentAssetId === 'photo-story-garden',
    ),
  );
  const scene = await request(
    '/v1/demo/photo-assets/photo-story-garden',
    'GET',
    undefined,
    browserCookie,
  );
  check(
    scene.status === 200 && scene.headers.get('content-type') === 'image/svg+xml',
    `Scoped current photo scene failed: status ${scene.status}, media type ${scene.headers.get('content-type')}`,
  );
  check((await scene.text()).includes('<svg'), 'Reviewed scene bytes missing');
  check(
    (await request('/v1/demo/photo-assets/photo-story-park', 'GET', undefined, browserCookie))
      .status === 404,
    'Noncurrent scene was exposed',
  );
  check(
    (await request('/v1/demo/photo-assets/photo-story-garden', 'GET', undefined, gateCookie))
      .status === 401,
    'Gate key alone read participant media',
  );
  const photoEvent = [...browser.events]
    .reverse()
    .find((event) => event.type === 'activity.changed');
  check(
    photoEvent?.type === 'activity.changed' &&
      photoEvent.payload.activity?.activityId === 'photo_album',
    'Photo projection missing',
  );
  const photo = photoEvent.payload.activity;
  const afterTalk = browser.events.length;
  browser.send('input.photo.action', {
    instanceId: photo.instanceId,
    expectedRevision: photo.revision,
    action: { type: 'photo.talk' },
  });
  await until(() =>
    browser.events.slice(afterTalk).some((event) => event.type === 'response.text'),
  );
  check(
    !device.events.some((event) => event.type === 'activity.changed'),
    'Robot received unsupported photo stream',
  );
  browser.send('input.stop');
  await until(() =>
    browser.events.some(
      (event) => event.type === 'state.changed' && event.payload.session?.phase === 'ended',
    ),
  );
  check(
    (await request('/v1/demo/photo-assets/photo-story-garden', 'GET', undefined, browserCookie))
      .status === 404,
    'Ended photo scene remained accessible',
  );
  const current = (await (
    await request('/v1/demo/current', 'GET', undefined, browserCookie)
  ).json()) as any;
  check(
    current.ok && current.data.profileId === 'profile-alex' && !('credential' in current.data),
    'Assignment recovery failed',
  );
  browser.socket.close();
  device.socket.close();
  await Bun.sleep(40);
  await gateway.flush();
  gateway.stop();
  await gateway.data?.close();
  gateway = start(gatewayPort);
  await gateway.ready;
  const retained = (await (
    await request('/v1/demo/current', 'GET', undefined, browserCookie)
  ).json()) as any;
  check(
    retained.ok && retained.data.deviceId === safe.data.deviceId,
    'Enrollment lost on gateway restart',
  );
  const reconnected = await connect({ cookie: browserCookie, origin }, 'browser');
  await until(() => reconnected.events.some((event) => event.type === 'state.changed'));
  check(
    !reconnected.events.some(
      (event) => event.type === 'state.changed' && event.payload.session?.captureGrant,
    ),
    'Restart restored capture',
  );
  const released = await request('/v1/demo/release', 'POST', {}, browserCookie);
  check(released.status === 200, 'Browser release failed');
  const after = await request('/v1/demo/current', 'GET', undefined, browserCookie);
  check(after.status === 403, 'Revoked browser cookie accepted');
  console.info(
    'PASS: production participant selector/profile creation, cookie enrollment, verified simultaneous browser/robot WSS, isolated chat, durable restart assignment and individual release; scoped public Photo Story media/opening/Stop and gate-only/noncurrent/ended denials. Model and clients are fixtures; no real microphone or speaker.',
  );
} finally {
  for (const client of clients) client.close();
  if (web) {
    web.kill();
    await web.exited;
  }
  proxy?.stop(true);
  gateway?.stop();
  await gateway?.data?.close();
  await sql.close();
  await rm(directory, { recursive: true, force: true });
}
