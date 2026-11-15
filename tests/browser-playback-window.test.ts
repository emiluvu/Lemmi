import { expect, test } from 'bun:test';
import {
  DeviceEventSchema,
  ServerEventSchema,
  ok,
  type ServerEvent,
  type SessionSnapshot,
  type SpeechOutputStart,
} from '@lemmi/contracts';
import { startControlGateway } from '../apps/realtime/src/control';

async function endpoint(kind: 'browser' | 'robot', requested?: 4 | 12) {
  const internal = crypto.randomUUID();
  const output = new Uint8Array(882 * 24).fill(7);
  const gateway = startControlGateway({
    publicOrigin: 'https://window.fixture.invalid',
    internalToken: internal,
    port: 0,
    devices: [{ profileId: 'profile-alex', deviceId: 'window-fixture', endpoint: kind }],
    chatAdapter: {
      async complete() {
        return ok({ text: 'A fictional garden.', language: 'en' });
      },
    },
    speech: {
      stt: {
        async transcribe() {
          return ok({ text: 'A fictional greeting', language: 'en' });
        },
      },
      tts: {
        async synthesize() {
          return ok({
            pcm: output,
            sampleRate: 22050,
            encoding: 'pcm_s16le',
            channels: 1,
            language: 'en',
          });
        },
      },
    },
  });
  const base = `http://127.0.0.1:${gateway.server.port}`;
  async function provision(action: string, body: unknown) {
    const r = await fetch(base + '/internal/control/' + action, {
      method: 'POST',
      headers: { authorization: `Bearer ${internal}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const value = (await r.json()) as any;
    if (!value.ok) throw new Error('Playback-window fixture provisioning failed');
    return value.data;
  }
  const pairing = await provision('pair', {
    actor: 'fixture-caregiver',
    input: {
      profileId: 'profile-alex',
      deviceId: 'window-fixture',
      commandId: crypto.randomUUID(),
    },
  });
  const claimed = await provision('claim', {
    pairingId: pairing.pairingId,
    code: pairing.code,
    localConfirmed: true,
  });
  const socket = new WebSocket(base.replace('http:', 'ws:') + '/v1/device-stream', {
    headers: {
      host: 'window.fixture.invalid',
      'x-forwarded-proto': 'https',
      authorization: `Bearer ${claimed.credential}`,
    },
  });
  const events: ServerEvent[] = [];
  let session: SessionSnapshot | null = null;
  let sequence = 0;
  socket.onmessage = (message) => {
    const event = ServerEventSchema.parse(JSON.parse(String(message.data)));
    events.push(event);
    if (event.type === 'state.changed') session = event.payload.session;
  };
  async function until(condition: () => boolean) {
    const deadline = Date.now() + 3000;
    while (!condition()) {
      if (Date.now() > deadline) throw new Error('Playback-window fixture timed out');
      await Bun.sleep(2);
    }
  }
  function send(type: string, payload: unknown = {}, turnId: string | null = null) {
    const id = crypto.randomUUID();
    socket.send(
      JSON.stringify(
        DeviceEventSchema.parse({
          protocol_version: 1,
          event_id: id,
          session_id: session?.id ?? null,
          generation: session?.generation ?? 0,
          sequence: sequence++,
          turn_id: turnId,
          type,
          payload,
        }),
      ),
    );
    return id;
  }
  async function acknowledged(id: string) {
    await until(() => events.some((e) => e.type === 'command.ack' && e.payload.commandId === id));
  }
  async function barrier() {
    const after = events.length;
    send('heartbeat');
    await until(() => events.slice(after).some((e) => e.type === 'heartbeat'));
  }
  try {
    await until(() => socket.readyState === WebSocket.OPEN);
    send('device.hello', {
      firmwareVersion: 'window-fixture',
      endpoint: kind,
      cameraSupported: false,
      pettingSupported: false,
      audio: { encoding: 'pcm_s16le', sampleRate: 16000, channels: 1, frameMs: 20 },
      playback: {
        encoding: 'pcm_s16le',
        channels: 1,
        sampleRates: [22050],
        ...(requested ? { outputWindowChunks: requested } : {}),
      },
    });
    await until(() => events.some((e) => e.type === 'device.ready'));
    const ready = events.find((e) => e.type === 'device.ready')!;
    if (ready.type !== 'device.ready' || ready.payload.audio === false)
      throw new Error('Audio not negotiated');
    const window = ready.payload.audio.outputWindowChunks;
    await acknowledged(send('input.start'));
    await until(() => events.some((e) => e.type === 'response.start'));
    const event = events.find((e) => e.type === 'response.start')!;
    if (event.type !== 'response.start') throw new Error('Missing output metadata');
    const metadata: SpeechOutputStart = event.payload;
    await until(() => events.filter((e) => e.type === 'audio.chunk').length >= window);
    await barrier();
    return {
      events,
      output,
      metadata,
      window,
      send,
      until,
      acknowledged,
      barrier,
      count: () => events.filter((e) => e.type === 'audio.chunk').length,
      session: () => session!,
      receipt(status: string, playedChunks: number) {
        return send(
          'audio.receipt',
          { leaseId: metadata.leaseId, streamId: metadata.streamId, status, playedChunks },
          metadata.turnId,
        );
      },
      close() {
        socket.close();
        gateway.stop();
      },
    };
  } catch (error) {
    socket.close();
    gateway.stop();
    throw error;
  }
}

test('browser opts into twelve queued frames; started/zero progress grant no credit and consumed progress grants exactly its count', async () => {
  const d = await endpoint('browser', 12);
  try {
    expect(d.window).toBe(12);
    expect(d.count()).toBe(12);
    await d.acknowledged(d.receipt('started', 0));
    await d.barrier();
    expect(d.count()).toBe(12);
    await d.acknowledged(d.receipt('progress', 0));
    await d.barrier();
    expect(d.count()).toBe(12);
    const invalid = d.receipt('progress', 13);
    await d.acknowledged(invalid);
    expect(
      d.events.some(
        (e) =>
          e.type === 'error' &&
          e.payload.commandId === invalid &&
          e.payload.code === 'REVISION_CONFLICT',
      ),
    ).toBe(true);
    expect(d.count()).toBe(12);
    await d.acknowledged(d.receipt('progress', 2));
    await d.until(() => d.count() === 14);
    await d.barrier();
    expect(d.count()).toBe(14);
  } finally {
    d.close();
  }
});

test('legacy browser stays at four frames and a robot cannot opt into the browser window', async () => {
  for (const [kind, requested] of [
    ['browser', undefined],
    ['robot', 12],
  ] as const) {
    const d = await endpoint(kind, requested);
    try {
      expect(d.window).toBe(4);
      expect(d.count()).toBe(4);
    } finally {
      d.close();
    }
  }
});

test('Stop retires a twelve-frame queue, wipes PCM and rejects stale completion without emitting more chunks', async () => {
  const d = await endpoint('browser', 12);
  try {
    const oldGeneration = d.session().generation;
    await d.acknowledged(d.send('input.stop'));
    await d.until(() => d.session().phase === 'ended');
    expect(d.session().generation).toBeGreaterThan(oldGeneration);
    expect(d.session().captureGrant).toBeNull();
    expect(d.output.every((byte) => byte === 0)).toBe(true);
    const completion = d.receipt('completed', 12);
    await d.acknowledged(completion);
    await d.barrier();
    expect(
      d.events.some(
        (e) =>
          e.type === 'error' &&
          e.payload.commandId === completion &&
          e.payload.code === 'REVISION_CONFLICT',
      ),
    ).toBe(true);
    expect(d.count()).toBe(12);
  } finally {
    d.close();
  }
});
