import { expect, test } from 'bun:test';
import { startControlGateway } from '../apps/realtime/src/control';
import {
  DeviceEventSchema,
  ServerEventSchema,
  ok,
  type ServerEvent,
  type SessionSnapshot,
} from '@lemmi/contracts';
import type { ChatAdapter, SpeechAdapters } from '@lemmi/server';

async function device(
  options: { speech?: SpeechAdapters; chat?: ChatAdapter; negotiate?: boolean } = {},
) {
  const internal = crypto.randomUUID(),
    accessKey = crypto.randomUUID();
  const output = new Uint8Array(882 * 12).fill(2);
  const gateway = startControlGateway({
    publicOrigin: 'https://speech.invalid',
    internalToken: internal,
    accessKey,
    port: 0,
    chatAdapter: options.chat ?? {
      async complete() {
        return ok({ text: 'We can enjoy the garden.', language: 'en' });
      },
    },
    speech: options.speech ?? {
      stt: {
        async transcribe() {
          return ok({ text: 'A fictional garden greeting', language: 'en' });
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
  async function privateCall(action: string, body: unknown) {
    const response = await fetch(base + '/internal/control/' + action, {
      method: 'POST',
      headers: { authorization: `Bearer ${internal}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const result = (await response.json()) as any;
    if (!result.ok) throw new Error('Fixture provisioning failed');
    return result.data;
  }
  const pairing = await privateCall('pair', {
    actor: 'fixture-caregiver',
    input: {
      profileId: 'profile-alex',
      deviceId: 'stackchan-alex',
      commandId: crypto.randomUUID(),
    },
  });
  const claim = await privateCall('claim', {
    pairingId: pairing.pairingId,
    code: pairing.code,
    localConfirmed: true,
  });
  const ws = new WebSocket(base.replace('http:', 'ws:') + '/v1/device-stream', {
    headers: {
      host: 'speech.invalid',
      'x-forwarded-proto': 'https',
      authorization: `Bearer ${claim.credential}`,
      'X-Lemmi-Access-Key': accessKey,
    },
  });
  const events: ServerEvent[] = [];
  let session: SessionSnapshot | null = null,
    sequence = 0;
  ws.onmessage = (event) => {
    const parsed = ServerEventSchema.parse(JSON.parse(String(event.data)));
    events.push(parsed);
    if (parsed.type === 'state.changed') session = parsed.payload.session;
  };
  const until = async (predicate: () => boolean) => {
    const deadline = Date.now() + 5000;
    while (!predicate()) {
      if (Date.now() >= deadline) throw new Error('Speech gateway fixture timed out');
      await Bun.sleep(5);
    }
  };
  const send = (type: string, payload: unknown = {}, turnId: string | null = null) => {
    const eventId = crypto.randomUUID();
    ws.send(
      JSON.stringify(
        DeviceEventSchema.parse({
          protocol_version: 1,
          event_id: eventId,
          session_id: session?.id ?? null,
          generation: session?.generation ?? 0,
          sequence: sequence++,
          turn_id: turnId,
          type,
          payload,
        }),
      ),
    );
    return eventId;
  };
  await until(() => ws.readyState === WebSocket.OPEN);
  send('device.hello', {
    firmwareVersion: 'fictional-audio-fixture',
    cameraSupported: false,
    pettingSupported: false,
    audio: { encoding: 'pcm_s16le', sampleRate: 16000, channels: 1, frameMs: 20 },
    ...(options.negotiate === false
      ? {}
      : {
          playback: { encoding: 'pcm_s16le', channels: 1, sampleRates: [22050] },
        }),
  });
  await until(() => events.some((e) => e.type === 'device.ready'));
  const timer = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) send('heartbeat');
  }, 2000);
  send('input.start');
  await until(() => session?.phase === 'ready');
  send('input.mute', { muted: false });
  await until(() => session?.micMuted === false);
  return {
    gateway,
    ws,
    output,
    events,
    until,
    send,
    session: () => session!,
    async capture() {
      send('input.speak', { language: 'en' });
      await until(() => session?.phase === 'listening');
      const grant = session!.captureGrant!;
      for (let chunkIndex = 0; chunkIndex < 2; chunkIndex++)
        send(
          'audio.chunk',
          {
            leaseId: grant.leaseId,
            streamId: grant.streamId,
            chunkIndex,
            encoding: 'pcm_s16le',
            data: Buffer.alloc(640, 1).toString('base64'),
          },
          grant.turnId,
        );
      return {
        grant,
        finish: () =>
          send(
            'audio.end',
            {
              leaseId: grant.leaseId,
              streamId: grant.streamId,
              chunkCount: 2,
            },
            grant.turnId,
          ),
      };
    },
    close() {
      clearInterval(timer);
      ws.close();
      gateway.stop();
    },
  };
}

test('teaching commands share the authorized gateway and read reviewed prompts without opening capture', async () => {
  const d = await device();
  try {
    expect(d.events.find((e) => e.type === 'device.ready')!.payload).toHaveProperty(
      'teaching',
      true,
    );
    d.send('input.teaching.start');
    await d.until(() => d.events.some((e) => e.type === 'response.start'));
    expect(d.session().teaching?.entityId).toBe('topic:gardening');
    expect(d.session().captureGrant).toBeNull();
    const first = d.events.find((e) => e.type === 'response.start')!;
    if (first.type !== 'response.start') throw new Error('Missing prompt playback');
    expect(d.session().phase).toBe('processing');
    d.send('input.teaching.not_sure');
    await d.until(() => d.session().teaching?.entityId === 'topic:beaches');
    await d.until(() => d.events.filter((e) => e.type === 'response.start').length === 2);
    expect(
      d.events.some((e) => e.type === 'response.cancel' && e.turn_id === first.payload.turnId),
    ).toBe(true);
    expect(d.session().captureGrant).toBeNull();
    d.send('input.stop');
    await d.until(() => d.session().phase === 'ended');
    expect(d.session().teaching).toBeNull();
    expect(d.session().captureGrant).toBeNull();
  } finally {
    d.close();
  }
});

test('teaching voice explanation reaches the existing STT/model/TTS path with only the current topic', async () => {
  let context = '';
  const d = await device({
    chat: {
      async complete(input) {
        context = input.system;
        return ok({ text: 'Thank you for sharing.', language: 'en' });
      },
    },
  });
  try {
    d.send('input.teaching.start');
    await d.until(() => d.events.some((e) => e.type === 'response.start'));
    const first = d.events.find((e) => e.type === 'response.start')!;
    if (first.type !== 'response.start') throw new Error('Missing prompt');
    const meta = first.payload;
    const receipt = (status: string, playedChunks: number) =>
      d.send(
        'audio.receipt',
        {
          leaseId: meta.leaseId,
          streamId: meta.streamId,
          status,
          playedChunks,
        },
        meta.turnId,
      );
    receipt('started', 0);
    await d.until(() => d.session().phase === 'speaking');
    receipt('progress', 4);
    await d.until(() => d.events.filter((e) => e.type === 'audio.chunk').length === 8);
    receipt('progress', 8);
    await d.until(() => d.events.some((e) => e.type === 'audio.end'));
    receipt('completed', 12);
    await d.until(() => d.session().phase === 'waiting');
    expect(d.session().captureGrant).toBeNull();
    const input = await d.capture();
    input.finish();
    await d.until(() => d.events.filter((e) => e.type === 'response.start').length === 2);
    expect(context).toContain('Teach Lemmi conversation mode');
    expect(context).toContain('topic:gardening');
    expect(context).not.toContain('Barbara');
    d.send('input.stop');
    await d.until(() => d.session().phase === 'ended');
  } finally {
    d.close();
  }
});

test('negotiated gateway carries PCM → model → PCM with bounded credit and receipt-backed speaking', async () => {
  const d = await device();
  try {
    expect(d.events.find((e) => e.type === 'device.ready')!.payload).toHaveProperty(
      'audio.outputWindowChunks',
      4,
    );
    const input = await d.capture();
    input.finish();
    await d.until(() => d.events.some((e) => e.type === 'response.start'));
    const response = d.events.find((e) => e.type === 'response.start')!;
    if (response.type !== 'response.start') throw new Error('Missing fixture response');
    const meta = response.payload;
    const receipt = (status: string, playedChunks: number) =>
      d.send(
        'audio.receipt',
        {
          leaseId: meta.leaseId,
          streamId: meta.streamId,
          status,
          playedChunks,
        },
        meta.turnId,
      );
    expect(d.session().phase).toBe('processing');
    expect(d.events.filter((e) => e.type === 'audio.chunk')).toHaveLength(4);
    expect(d.events.some((e) => e.type === 'audio.end')).toBe(false);
    receipt('completed', 12);
    await d.until(() =>
      d.events.some((e) => e.type === 'error' && e.payload.code === 'REVISION_CONFLICT'),
    );
    receipt('started', 0);
    await d.until(() => d.session().phase === 'speaking');
    receipt('progress', 4);
    await d.until(() => d.events.filter((e) => e.type === 'audio.chunk').length === 8);
    receipt('progress', 8);
    await d.until(() => d.events.some((e) => e.type === 'audio.end'));
    const chunks = d.events.filter((e) => e.type === 'audio.chunk');
    expect(chunks).toHaveLength(12);
    expect(chunks.every((e) => e.turn_id === input.grant.turnId)).toBe(true);
    receipt('completed', 12);
    await d.until(() => d.session().phase === 'waiting');
    expect(d.session().captureGrant).toBeNull();
    expect(d.output.every((x) => x === 0)).toBe(true);
  } finally {
    d.close();
  }
});

test('negotiation keeps legacy clients capture-off and microphone frames do not hit the old 30-control cap', async () => {
  const old = await device({ negotiate: false });
  try {
    const ready = old.events.find((e) => e.type === 'device.ready')!;
    expect(ready.payload).toHaveProperty('audio', false);
    old.send('input.speak', { language: 'en' });
    await old.until(() => old.events.some((e) => e.type === 'error'));
    expect(old.session().captureGrant).toBeNull();
  } finally {
    old.close();
  }
  const d = await device();
  try {
    d.send('input.speak', { language: 'en' });
    await d.until(() => d.session().phase === 'listening');
    const grant = d.session().captureGrant!;
    for (let chunkIndex = 0; chunkIndex < 45; chunkIndex++)
      d.send(
        'audio.chunk',
        {
          leaseId: grant.leaseId,
          streamId: grant.streamId,
          chunkIndex,
          encoding: 'pcm_s16le',
          data: Buffer.alloc(640, 1).toString('base64'),
        },
        grant.turnId,
      );
    const heartbeat = d.send('heartbeat');
    await d.until(() => d.events.some((e) => e.type === 'heartbeat'));
    expect(d.ws.readyState).toBe(WebSocket.OPEN);
    expect(d.events.filter((e) => e.type === 'error')).toHaveLength(0);
    expect(heartbeat).toBeTruthy();
    d.send('input.stop');
    await d.until(() => d.session().phase === 'ended');
    expect(d.session().captureGrant).toBeNull();
  } finally {
    d.close();
  }
});

test('gateway Stop cancels pending recognition without blocking heartbeat and suppresses late output', async () => {
  let finish!: (result: any) => void, signal!: AbortSignal;
  const d = await device({
    speech: {
      stt: {
        transcribe(_input, canceled) {
          signal = canceled;
          return new Promise((resolve) => {
            finish = resolve;
          });
        },
      },
      tts: {
        async synthesize() {
          throw new Error('Late TTS must not run');
        },
      },
    },
  });
  try {
    const capture = await d.capture();
    capture.finish();
    await d.until(() => !!finish);
    d.send('heartbeat');
    await d.until(() => d.events.some((e) => e.type === 'heartbeat'));
    d.send('input.stop');
    await d.until(() => d.session().phase === 'ended');
    expect(signal.aborted).toBe(true);
    finish(ok({ text: 'late fictional transcript', language: 'en' }));
    await Bun.sleep(25);
    expect(d.events.some((e) => e.type === 'response.start' || e.type === 'response.text')).toBe(
      false,
    );
  } finally {
    d.close();
  }
});

test('mic mute preserves approved gateway output, pause cancels its stream and rejects late receipts', async () => {
  const d = await device();
  try {
    const capture = await d.capture();
    capture.finish();
    await d.until(() => d.events.some((e) => e.type === 'response.start'));
    const response = d.events.find((e) => e.type === 'response.start')!;
    if (response.type !== 'response.start') throw new Error('Missing response');
    d.send('input.mute', { muted: true });
    await d.until(() => d.session().micMuted);
    expect(d.events.some((e) => e.type === 'response.cancel')).toBe(false);
    d.send('input.pause');
    await d.until(() => d.events.some((e) => e.type === 'response.cancel'));
    expect(d.session().phase).toBe('paused');
    expect(d.output.every((x) => x === 0)).toBe(true);
    d.send(
      'audio.receipt',
      {
        leaseId: response.payload.leaseId,
        streamId: response.payload.streamId,
        status: 'completed',
        playedChunks: response.payload.chunkCount,
      },
      response.payload.turnId,
    );
    await d.until(() => d.events.some((e) => e.type === 'error'));
    expect(d.session().phase).toBe('paused');
  } finally {
    d.close();
  }
});

test('urgent voice guidance uses the paused generation, audible PCM and receipts without resuming', async () => {
  const pcm = new Uint8Array(882 * 12).fill(4);
  let modelCalls = 0,
    spoken = '';
  const d = await device({
    chat: {
      async complete() {
        modelCalls++;
        throw new Error('Urgent route must bypass the model');
      },
    },
    speech: {
      stt: {
        async transcribe() {
          return ok({ text: 'I cannot breathe', language: 'en' });
        },
      },
      tts: {
        async synthesize(input) {
          spoken = input.text;
          return ok({ pcm, sampleRate: 22050, encoding: 'pcm_s16le', channels: 1, language: 'en' });
        },
      },
    },
  });
  try {
    const capture = await d.capture(),
      oldGeneration = d.session().generation;
    capture.finish();
    await d.until(() => d.events.some((e) => e.type === 'response.start'));
    const text = d.events.find((e) => e.type === 'response.text');
    const response = d.events.find((e) => e.type === 'response.start');
    if (text?.type !== 'response.text' || response?.type !== 'response.start')
      throw new Error('Missing fixed speech');
    expect(text.payload.source).toBe('fixed');
    expect(text.payload.text).toBe(spoken);
    expect(spoken).toContain('Caregiver contact is not configured');
    expect(modelCalls).toBe(0);
    expect(response.generation).toBe(oldGeneration + 1);
    expect(response.turn_id).toBe(text.payload.turnId);
    expect(response.turn_id).not.toBe(capture.grant.turnId);
    const receipt = (status: string, playedChunks: number) =>
      d.send(
        'audio.receipt',
        {
          leaseId: response.payload.leaseId,
          streamId: response.payload.streamId,
          status,
          playedChunks,
        },
        response.payload.turnId,
      );
    const started = receipt('started', 0);
    await d.until(() =>
      d.events.some(
        (e) => e.type === 'command.ack' && e.payload.commandId === started && e.payload.applied,
      ),
    );
    for (const [played, total] of [
      [4, 8],
      [8, 12],
    ]) {
      receipt('progress', played!);
      await d.until(() => d.events.filter((e) => e.type === 'audio.chunk').length === total);
      expect(d.session().phase).toBe('paused');
    }
    await d.until(() => d.events.some((e) => e.type === 'audio.end'));
    const completed = receipt('completed', 12);
    await d.until(() =>
      d.events.some(
        (e) => e.type === 'command.ack' && e.payload.commandId === completed && e.payload.applied,
      ),
    );
    expect(d.session().phase).toBe('paused');
    expect(d.session().captureGrant).toBeNull();
    expect(pcm.every((x) => x === 0)).toBe(true);
    expect(
      d.events
        .filter((e) => e.type === 'state.changed')
        .every(
          (e) =>
            e.type === 'state.changed' &&
            !['speaking', 'waiting'].includes(e.payload.session?.phase ?? ''),
        ),
    ).toBe(true);
    expect(d.events.some((e) => e.type === 'error')).toBe(false);
  } finally {
    d.close();
  }
});

test('Stop during fixed synthesis suppresses late fixed text/audio and wipes late PCM', async () => {
  let finish!: (value: any) => void, signal!: AbortSignal;
  const d = await device({
    speech: {
      stt: {
        async transcribe() {
          return ok({ text: 'I cannot breathe', language: 'en' });
        },
      },
      tts: {
        synthesize(_input, canceled) {
          signal = canceled;
          return new Promise((resolve) => {
            finish = resolve;
          });
        },
      },
    },
  });
  try {
    const capture = await d.capture();
    capture.finish();
    await d.until(() => !!finish && d.session().phase === 'paused');
    d.send('input.stop');
    await d.until(() => d.session().phase === 'ended');
    expect(signal.aborted).toBe(true);
    const pcm = new Uint8Array(882).fill(5);
    finish(ok({ pcm, sampleRate: 22050, encoding: 'pcm_s16le', channels: 1, language: 'en' }));
    await d.until(() => pcm.every((x) => x === 0));
    expect(
      d.events.some((e) => ['response.text', 'response.start', 'audio.chunk'].includes(e.type)),
    ).toBe(false);
    expect(d.session().captureGrant).toBeNull();
  } finally {
    d.close();
  }
});

test('an explicit pause flushes already approved fixed output and rejects its obsolete receipt', async () => {
  const pcm = new Uint8Array(882 * 12).fill(6);
  const d = await device({
    speech: {
      stt: {
        async transcribe() {
          return ok({ text: 'I cannot breathe', language: 'en' });
        },
      },
      tts: {
        async synthesize() {
          return ok({ pcm, sampleRate: 22050, encoding: 'pcm_s16le', channels: 1, language: 'en' });
        },
      },
    },
  });
  try {
    const capture = await d.capture();
    capture.finish();
    await d.until(() => d.events.some((e) => e.type === 'response.start'));
    const response = d.events.find((e) => e.type === 'response.start');
    if (response?.type !== 'response.start') throw new Error('Missing fixed speech');
    d.send(
      'audio.receipt',
      {
        leaseId: response.payload.leaseId,
        streamId: response.payload.streamId,
        status: 'started',
        playedChunks: 0,
      },
      response.payload.turnId,
    );
    d.send('input.pause');
    await d.until(() => d.events.some((e) => e.type === 'response.cancel'));
    expect(pcm.every((x) => x === 0)).toBe(true);
    d.send(
      'audio.receipt',
      {
        leaseId: response.payload.leaseId,
        streamId: response.payload.streamId,
        status: 'progress',
        playedChunks: 4,
      },
      response.payload.turnId,
    );
    await d.until(() =>
      d.events.some((e) => e.type === 'error' && e.payload.code === 'REVISION_CONFLICT'),
    );
    expect(d.session().phase).toBe('paused');
    expect(d.session().captureGrant).toBeNull();
  } finally {
    d.close();
  }
});
