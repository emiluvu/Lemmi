import { afterAll, beforeAll, expect, test } from 'bun:test';
import { startControlGateway } from '../apps/realtime/src/control';
import { handleDeviceHttp, DEVICE_TTL_MS } from '@lemmi/server';
import { ServerEventSchema, ok, type ServerEvent, type SessionSnapshot } from '@lemmi/contracts';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { controlHelloFixture } from '@lemmi/contracts/fixtures';

const publicOrigin = 'https://lemmi.invalid';
const internalToken = crypto.randomUUID();
const auth = {
  endpoint: 'https://identity.invalid/introspect',
  issuer: 'https://identity.invalid',
  audience: 'lemmi',
  clientId: 'server',
  clientSecret: 'private-test-only',
  subject: 'caregiver-alex',
};
let now = Date.now();
let gateway: ReturnType<typeof startControlGateway>;
let base = '';
let delayedChat: { finish: (result: any) => void; signal: AbortSignal } | null = null;
beforeAll(() => {
  gateway = startControlGateway({
    publicOrigin,
    internalToken,
    port: 0,
    now: () => now,
    chatAdapter: {
      async complete(input, signal) {
        if (input.text === 'pending fictional fixture')
          return new Promise((resolve) => {
            delayedChat = { finish: resolve, signal };
          });
        return ok({ text: 'Hello. We can take our time.', language: input.language });
      },
    },
  });
  base = `http://127.0.0.1:${gateway.server.port}`;
});
afterAll(() => gateway?.stop());
async function providerFetch(url: string | URL | Request, init?: RequestInit) {
  if (url === auth.endpoint) {
    const token = new URLSearchParams(String(init?.body)).get('token');
    return Response.json({
      active: token === 'authorized' || token === 'unassigned',
      sub: token === 'unassigned' ? 'someone-else' : auth.subject,
      iss: auth.issuer,
      aud: auth.audience,
      token_type: 'Bearer',
      exp: Math.floor(Date.now() / 1000) + 300,
    });
  }
  return fetch(url, init);
}
async function http(
  action: 'pairings' | 'claim' | 'revoke',
  input: unknown,
  token = 'authorized',
  origin = publicOrigin,
  deviceId = 'stackchan-alex',
) {
  const path =
    action === 'claim' ? '/v1/device-pairings/claim' : `/v1/devices/${deviceId}/${action}`;
  return handleDeviceHttp(
    new Request(`${publicOrigin}${path}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, origin, 'content-type': 'application/json' },
      body: JSON.stringify(input),
    }),
    { action, ...(action === 'claim' ? {} : { deviceId }) },
    { publicOrigin, internalToken, accessKey: null, gatewayPort: gateway.server.port!, auth },
    providerFetch,
  );
}
async function issue() {
  const pairResponse = await http('pairings', {
    deviceId: 'stackchan-alex',
    profileId: 'profile-alex',
    commandId: crypto.randomUUID(),
  });
  expect(pairResponse.status).toBe(200);
  const p = ((await pairResponse.json()) as any).data;
  const response = await http('claim', {
    pairingId: p.pairingId,
    code: p.code,
    localConfirmed: true,
  });
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store');
  return ((await response.json()) as any).data.credential as string;
}
function socketClient(
  credential: string,
  url = base.replace('http:', 'ws:') + '/v1/device-stream',
  tls?: { ca: string },
) {
  const socket = new WebSocket(url, {
    headers: {
      authorization: `Bearer ${credential}`,
      host: 'lemmi.invalid',
      'x-forwarded-proto': 'https',
    },
    ...(tls ? { tls } : {}),
  });
  const messages: ServerEvent[] = [];
  const waiters = new Set<() => void>();
  let sequence = 0;
  const opened = new Promise<void>((resolve, reject) => {
    socket.onopen = () => resolve();
    socket.onerror = () => reject(new Error('Control connection failed'));
  });
  const closed = new Promise<void>((resolve) => {
    socket.onclose = () => resolve();
  });
  socket.onmessage = (event) => {
    messages.push(ServerEventSchema.parse(JSON.parse(String(event.data))));
    for (const notify of waiters) notify();
  };
  function wait(predicate: (event: ServerEvent) => boolean): Promise<ServerEvent> {
    return new Promise((resolve, reject) => {
      const check = () => {
        const found = messages.find(predicate);
        if (found) {
          clearTimeout(timer);
          waiters.delete(check);
          resolve(found);
        }
      };
      const timer = setTimeout(() => {
        waiters.delete(check);
        reject(new Error('Expected control event did not arrive'));
      }, 2000);
      waiters.add(check);
      check();
    });
  }
  function send(
    type: string,
    session: SessionSnapshot | null = null,
    payload: unknown = {},
    eventId = crypto.randomUUID(),
    seq = sequence++,
  ) {
    socket.send(
      JSON.stringify({
        protocol_version: 1,
        event_id: eventId,
        session_id: session?.id ?? null,
        turn_id: null,
        generation: session?.generation ?? 0,
        sequence: seq,
        type,
        payload,
      }),
    );
    return eventId;
  }
  async function hello() {
    await opened;
    send('device.hello', null, controlHelloFixture.payload);
    await wait((e) => e.type === 'device.ready');
    await wait((e) => e.type === 'state.changed');
  }
  async function command(type: string, session: SessionSnapshot | null, payload: unknown = {}) {
    const id = send(type, session, payload);
    await wait((e) => e.type === 'command.ack' && e.payload.commandId === id);
    // Server emits ack before its current snapshot, so wait for that following event.
    return await new Promise<SessionSnapshot | null>((resolve, reject) => {
      const check = () => {
        const index = messages.findIndex(
          (e) => e.type === 'command.ack' && e.payload.commandId === id,
        );
        const event = messages.slice(index + 1).find((e) => e.type === 'state.changed');
        if (event?.type === 'state.changed') {
          clearTimeout(timer);
          waiters.delete(check);
          resolve(event.payload.session);
        }
      };
      const timer = setTimeout(() => {
        waiters.delete(check);
        reject(new Error('Missing current snapshot'));
      }, 2000);
      waiters.add(check);
      check();
    });
  }
  return { socket, opened, closed, messages, send, wait, hello, command };
}

test('public device HTTP verifies caregiver ownership, origin, path and private gateway authentication', async () => {
  const input = {
    deviceId: 'stackchan-alex',
    profileId: 'profile-alex',
    commandId: 'unauthorized',
  };
  expect((await http('pairings', input, 'invalid')).status).toBe(401);
  expect((await http('pairings', input, 'unassigned')).status).toBe(403);
  expect((await http('pairings', input, 'authorized', 'https://evil.invalid')).status).toBe(403);
  expect((await http('pairings', { ...input, profileId: 'preview-sam' })).status).toBe(403);
  expect((await http('pairings', input, 'authorized', publicOrigin, 'another-device')).status).toBe(
    403,
  );
  expect((await http('pairings', { ...input, actor: 'forged' })).status).toBe(400);
  expect(
    (await http('claim', { pairingId: 'missing', code: 'x'.repeat(24), localConfirmed: false }))
      .status,
  ).toBe(400);
  expect(
    (await fetch(`${base}/internal/control/pair`, { method: 'POST', body: '{}' })).status,
  ).toBe(401);
  expect(
    (
      await fetch(`${base}/v1/device-stream`, {
        headers: {
          host: 'lemmi.invalid',
          'x-forwarded-proto': 'https',
          authorization: 'Bearer local-mock-only',
        },
      })
    ).status,
  ).toBe(401);
  expect(
    (
      await fetch(`${base}/v1/device-stream?token=forbidden`, {
        headers: { host: 'lemmi.invalid', 'x-forwarded-proto': 'https' },
      })
    ).status,
  ).toBe(403);
});

test('paired controls share one authority; stale/replayed inputs, unsupported media, reconnect and revocation fail safely', async () => {
  const credential = await issue();
  const client = socketClient(credential);
  try {
    await client.hello();
    const ready = client.messages.find((e) => e.type === 'device.ready');
    expect(ready?.type === 'device.ready' && ready.payload.audio).toBe(false);
    expect(ready?.type === 'device.ready' && ready.payload.camera).toBe(false);
    // Help works as a fixed route even without a conversation; unavailable is honest.
    const helpId = client.send('input.help');
    const help = await client.wait((e) => e.type === 'error' && e.payload.commandId === helpId);
    expect(help.type === 'error' && help.payload.code).toBe('UNAVAILABLE');
    expect(
      client.messages.some(
        (e) => e.type === 'command.ack' && e.payload.commandId === helpId && !e.payload.applied,
      ),
    ).toBe(true);
    let session = (await client.command('input.start', null))!;
    expect(session.mode).toBe('live');
    expect(session.phase).toBe('ready');
    expect(session.captureGrant).toBeNull();
    const original = session;
    session = (await client.command('input.mute', session, { muted: false }))!;
    expect(session.micMuted).toBe(false);
    expect(session.captureGrant).toBeNull();
    expect(session.generation).toBe(original.generation);
    const mediaId = client.send('audio.chunk', session, {
      leaseId: session.leaseId,
      streamId: 'rejected',
      encoding: 'pcm_s16le',
      data: Buffer.alloc(640).toString('base64'),
    });
    await client.wait(
      (e) =>
        e.type === 'error' && e.payload.commandId === mediaId && e.payload.code === 'UNAVAILABLE',
    );
    session = (await client.command('input.pause', session))!;
    const staleId = client.send('input.resume', original);
    await client.wait(
      (e) =>
        e.type === 'error' &&
        e.payload.commandId === staleId &&
        e.payload.code === 'REVISION_CONFLICT',
    );
    const replayId = client.send('input.resume', session, {}, crypto.randomUUID(), 0);
    await client.wait(
      (e) =>
        e.type === 'error' &&
        e.payload.commandId === replayId &&
        e.payload.code === 'REVISION_CONFLICT',
    );
    session = (await client.command('input.resume', session))!;
    expect(session.phase).toBe('ready');
    expect(session.captureGrant).toBeNull();
    client.socket.close();
    await client.closed;
    const reconnected = socketClient(credential);
    try {
      await reconnected.hello();
      const state = reconnected.messages.find((e) => e.type === 'state.changed');
      expect(state?.type === 'state.changed' && state.payload.session?.phase).toBe('paused');
      expect(state?.type === 'state.changed' && state.payload.session?.captureGrant).toBeNull();
      const response = await http('revoke', {
        deviceId: 'stackchan-alex',
        commandId: 'revoke-active',
      });
      expect(response.status).toBe(200);
      await reconnected.closed;
      expect(
        (
          await fetch(`${base}/v1/device-stream`, {
            headers: {
              host: 'lemmi.invalid',
              'x-forwarded-proto': 'https',
              authorization: `Bearer ${credential}`,
            },
          })
        ).status,
      ).toBe(401);
    } finally {
      reconnected.socket.close();
    }
  } finally {
    client.socket.close();
  }
});

test('old revoke retry preserves a new pairing; device credential expiry closes the current socket', async () => {
  const credential = await issue();
  expect(
    (await http('revoke', { deviceId: 'stackchan-alex', commandId: 'revoke-active' })).status,
  ).toBe(200);
  const client = socketClient(credential);
  try {
    await client.hello();
    const session = await client.command('input.start', null);
    expect(session?.phase).toBe('ready');
    now += DEVICE_TTL_MS;
    await client.closed;
    expect(
      (
        await fetch(`${base}/v1/device-stream`, {
          headers: {
            host: 'lemmi.invalid',
            'x-forwarded-proto': 'https',
            authorization: `Bearer ${credential}`,
          },
        })
      ).status,
    ).toBe(401);
  } finally {
    client.socket.close();
  }
});

test('a silent connected device times out; reconnect remains paused and Stop ends the session', async () => {
  const credential = await issue();
  const client = socketClient(credential);
  await client.hello();
  await client.command('input.start', null);
  now += 6500;
  await client.closed;
  const next = socketClient(credential);
  try {
    await next.hello();
    const event = next.messages.find((e) => e.type === 'state.changed');
    const paused = event?.type === 'state.changed' ? event.payload.session! : null;
    expect(paused?.phase).toBe('paused');
    const ended = await next.command('input.stop', paused);
    expect(ended?.phase).toBe('ended');
    const id = next.send('input.resume', ended);
    await next.wait(
      (e) =>
        e.type === 'error' && e.payload.commandId === id && e.payload.code === 'REVISION_CONFLICT',
    );
  } finally {
    next.socket.close();
    await next.closed;
    await http('revoke', { deviceId: 'stackchan-alex', commandId: crypto.randomUUID() });
  }
});

test('WSS control crosses a TLS proxy with certificate verification enabled', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lemmi-control-tls-'));
  const key = join(directory, 'key.pem');
  const cert = join(directory, 'cert.pem');
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
  if (generated.exitCode !== 0) {
    await rm(directory, { recursive: true });
    throw new Error('Test TLS certificate generation failed');
  }
  const proxy = Bun.serve<{ upstream: WebSocket }>({
    hostname: '127.0.0.1',
    port: 0,
    tls: { cert: Bun.file(cert), key: Bun.file(key) },
    async fetch(request, server) {
      const upstream = new WebSocket(base.replace('http:', 'ws:') + '/v1/device-stream', {
        headers: {
          authorization: request.headers.get('authorization') ?? '',
          host: 'lemmi.invalid',
          'x-forwarded-proto': 'https',
        },
      });
      try {
        await new Promise<void>((resolve, reject) => {
          upstream.onopen = () => resolve();
          upstream.onerror = () => reject(new Error('Upstream unavailable'));
        });
        return server.upgrade(request, { data: { upstream } })
          ? undefined
          : new Response(null, { status: 400 });
      } catch {
        upstream.close();
        return new Response(null, { status: 502 });
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
  const credential = await issue();
  const client = socketClient(credential, `wss://127.0.0.1:${proxy.port}/v1/device-stream`, {
    ca: await Bun.file(cert).text(),
  });
  try {
    await client.hello();
    const session = await client.command('input.start', null);
    expect(session?.mode).toBe('live');
    expect(session?.captureGrant).toBeNull();
    await client.command('input.stop', session);
  } finally {
    client.socket.close();
    await client.closed;
    proxy.stop(true);
    await http('revoke', { deviceId: 'stackchan-alex', commandId: crypto.randomUUID() });
    await rm(directory, { recursive: true });
  }
});

test('concurrent authenticated upgrades cannot claim two device connections', async () => {
  const credential = await issue();
  const first = socketClient(credential);
  const second = socketClient(credential);
  const results = await Promise.allSettled([first.opened, second.opened]);
  const winner = results[0]?.status === 'fulfilled' ? first : second;
  try {
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    await winner.hello();
  } finally {
    first.socket.close();
    second.socket.close();
    await winner.closed;
    await http('revoke', { deviceId: 'stackchan-alex', commandId: crypto.randomUUID() });
  }
});

test('authenticated text replies deduplicate and never block heartbeat or Stop', async () => {
  const credential = await issue();
  const client = socketClient(credential);
  try {
    await client.hello();
    const ready = client.messages.find((e) => e.type === 'device.ready');
    expect(ready?.type === 'device.ready' && ready.payload.textChat).toBe(true);
    const session = (await client.command('input.start', null))!;
    const id = client.send('input.text', session, { text: 'Hello', language: 'en' });
    const reply = await client.wait((e) => e.type === 'response.text' && e.payload.turnId === id);
    expect(reply.type === 'response.text' && reply.payload.text).toBe(
      'Hello. We can take our time.',
    );
    const replayFrom = client.messages.length;
    client.send('input.text', session, { text: 'Hello', language: 'en' }, id);
    client.send('heartbeat', session);
    await client.wait((e) => client.messages.indexOf(e) >= replayFrom && e.type === 'heartbeat');
    expect(
      client.messages.filter((e) => e.type === 'response.text' && e.payload.turnId === id),
    ).toHaveLength(1);
    const pendingFrom = client.messages.length;
    const pendingId = client.send('input.text', session, {
      text: 'pending fictional fixture',
      language: 'en',
    });
    await client.wait(
      (e) =>
        client.messages.indexOf(e) >= pendingFrom &&
        e.type === 'state.changed' &&
        e.payload.session?.phase === 'processing',
    );
    const beatFrom = client.messages.length;
    client.send('heartbeat', session);
    await client.wait((e) => client.messages.indexOf(e) >= beatFrom && e.type === 'heartbeat');
    const ended = await client.command('input.stop', session);
    expect(ended?.phase).toBe('ended');
    expect(delayedChat?.signal.aborted).toBe(true);
    delayedChat?.finish(ok({ text: 'late output must be discarded', language: 'en' }));
    const doneFrom = client.messages.length;
    client.send('heartbeat', ended);
    await client.wait((e) => client.messages.indexOf(e) >= doneFrom && e.type === 'heartbeat');
    expect(
      client.messages.some((e) => e.type === 'response.text' && e.payload.turnId === pendingId),
    ).toBe(false);
  } finally {
    client.socket.close();
    await client.closed;
    await http('revoke', { deviceId: 'stackchan-alex', commandId: crypto.randomUUID() });
  }
});
