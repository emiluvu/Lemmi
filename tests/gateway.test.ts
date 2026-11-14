import { test, beforeAll, afterAll, expect } from 'bun:test';
import { ServerEventSchema, type ServerEvent } from '@lemmi/contracts';
let child: ReturnType<typeof Bun.spawn>;
let base = '';
const token = crypto.randomUUID();
beforeAll(async () => {
  child = Bun.spawn([process.execPath, 'apps/realtime/src/index.ts'], {
    cwd: process.cwd(),
    env: { ...process.env, GATEWAY_PORT: '0', LEMMI_MODE: 'mock', LEMMI_MOCK_TOKEN: token },
    stdout: 'pipe',
    stderr: 'inherit',
  });
  const reader = (child.stdout as ReadableStream<Uint8Array>).getReader();
  const timeout = AbortSignal.timeout(5000);
  let output = '';
  while (!output.includes('(no live services)')) {
    timeout.throwIfAborted();
    const result = await reader.read();
    if (result.done) throw new Error('Gateway failed to start');
    output += new TextDecoder().decode(result.value);
  }
  reader.releaseLock();
  const match = output.match(/http:\/\/127.0.0.1:(\d+)/);
  if (!match) throw new Error('Missing gateway port');
  base = `http://127.0.0.1:${match[1]}`;
});
afterAll(async () => {
  child?.kill();
  if (child) await child.exited;
});
async function call(op: string, input: unknown) {
  return fetch(`${base}/internal/mock/${op}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
}
test('HTTP gateway requires local token, rejects cross origin, validates inputs and separates live operations', async () => {
  expect((await fetch(`${base}/health`)).status).toBe(401);
  expect(
    (
      await fetch(`${base}/health`, {
        headers: { Authorization: `Bearer ${token}`, origin: 'https://evil.invalid' },
      })
    ).status,
  ).toBe(403);
  const valid = await call('profile.load', { profileId: 'profile-alex' });
  expect(valid.status).toBe(200);
  expect(valid.headers.get('cache-control')).toBe('no-store');
  expect((await call('profile.load', { profileId: 'preview-sam' })).status).toBe(403);
  expect(
    (await call('profile.load', { profileId: 'profile-alex', destination: 'injected' })).status,
  ).toBe(400);
  expect(
    (await call('help.create', { profileId: 'profile-alex', commandId: 'real-help', mode: 'real' }))
      .status,
  ).toBe(503);
});
test('real WebSocket fake-device exchange uses validated snapshots and disconnect pauses same HTTP session', async () => {
  const response = await call('session.start', {
    profileId: 'profile-alex',
    commandId: 'ws-session',
    endpoint: 'robot',
  });
  const { data: session } = (await response.json()) as any;
  const messages: ServerEvent[] = [];
  const socket = new WebSocket(base.replace('http:', 'ws:') + '/v1/device-stream', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const closed = new Promise<void>((resolve) => {
    socket.onclose = () => resolve();
  });
  await new Promise<void>((resolve, reject) => {
    socket.onopen = () => resolve();
    socket.onerror = () => reject(new Error('WebSocket failed'));
  });
  socket.onmessage = (event) =>
    messages.push(ServerEventSchema.parse(JSON.parse(String(event.data))));
  const envelope = {
    protocol_version: 1,
    event_id: 'hello',
    session_id: null,
    turn_id: null,
    generation: 0,
    sequence: 0,
    type: 'device.hello',
    payload: {
      firmwareVersion: 'test',
      cameraSupported: false,
      pettingSupported: false,
      audio: { encoding: 'pcm_s16le', sampleRate: 16000, channels: 1, frameMs: 20 },
    },
  };
  socket.send(JSON.stringify(envelope));
  await Bun.sleep(30);
  expect(
    messages.some((m) => m.type === 'state.changed' && m.payload.session?.id === session.id),
  ).toBe(true);
  socket.send(
    JSON.stringify({
      ...envelope,
      type: 'audio.chunk',
      sequence: 1,
      payload: {
        leaseId: session.leaseId,
        streamId: 'input',
        encoding: 'pcm_s16le',
        data: Buffer.alloc(640).toString('base64'),
      },
      session_id: session.id,
    }),
  );
  await Bun.sleep(30);
  expect(messages.some((m) => m.type === 'error' && m.payload.code === 'UNAVAILABLE')).toBe(true);
  socket.close();
  await closed;
  const current = (await (await call('session.get', { sessionId: session.id })).json()) as any;
  expect(current.data.phase).toBe('paused');
  expect(current.data.generation).toBeGreaterThan(session.generation);
  expect(current.data.captureGrant).toBeNull();
  const command = async (type: string) => {
    const latest = ((await (await call('session.get', { sessionId: session.id })).json()) as any)
      .data;
    const response = await call('session.command', {
      sessionId: latest.id,
      expectedGeneration: latest.generation,
      commandId: crypto.randomUUID(),
      action: { type },
    });
    expect(response.status).toBe(200);
    return ((await response.json()) as any).data;
  };
  await command('resume');
  const teaching = await command('teaching.start');
  const reply = await call('conversation.submit', {
    sessionId: session.id,
    expectedGeneration: teaching.generation,
    commandId: crypto.randomUUID(),
    text: 'I like growing roses',
    language: 'en',
  });
  expect(reply.status).toBe(200);
  expect(reply.headers.get('cache-control')).toBe('no-store');
  expect(((await reply.json()) as any).data.reply.source).toBe('scripted');
  const journal = await (await call('journal.load', { profileId: 'profile-alex' })).json();
  expect(JSON.stringify(journal)).not.toContain('I like growing roses');
  await command('stop');
});
