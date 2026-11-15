import { expect, test } from 'bun:test';
import { startControlGateway } from '../apps/realtime/src/control';
import { BrowserConversation } from '../apps/web/src/lib/features/browser-conversation';
import {
  DeviceEventSchema,
  ProfileDetailSchema,
  ServerEventSchema,
  ok,
  fail,
  type ServerEvent,
  type SessionSnapshot,
} from '@lemmi/contracts';
import type { ChatAdapter, SpeechAdapters } from '@lemmi/server';
import type { TransportDiagnostic } from '../apps/realtime/src/transport-diagnostics';

import { caregiverProfile } from '@lemmi/contracts/fixtures';

async function device(
  options: {
    speech?: SpeechAdapters;
    chat?: ChatAdapter;
    negotiate?: boolean;
    transportDiagnostics?: { deviceId: string; emit: (observation: TransportDiagnostic) => void };

    manualStart?: boolean;
    photo?: boolean;
    language?: 'en' | 'de';
    disableSpeech?: boolean;
  } = {},
) {
  const internal = crypto.randomUUID(),
    accessKey = crypto.randomUUID();
  const output = new Uint8Array(882 * 12).fill(2);
  const defaultSpeech: SpeechAdapters = {
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
  };
  let opening = !options.manualStart;
  const gateway = startControlGateway({
    publicOrigin: 'https://speech.invalid',
    internalToken: internal,
    accessKey,
    port: 0,
    transportDiagnostics: options.transportDiagnostics,

    demoEnrollment: options.photo,
    ...(options.photo
      ? {
          devices: [
            { profileId: 'profile-alex', deviceId: 'stackchan-alex', endpoint: 'browser' as const },
          ],
          profiles: [
            ProfileDetailSchema.parse({
              ...caregiverProfile,
              privacyRevision: 0,
              policyRevision: 0,
              approvedFacts: [],
              context: {
                photos: [
                  {
                    assetId: 'f1000000-0000-4000-8000-000000000001',
                    description: 'Alex tending roses in a garden.',
                    portrait: false,
                  },
                ],
              },
            }),
          ],
        }
      : {}),
    chatAdapter: options.chat ?? {
      async complete() {
        return ok({ text: 'We can enjoy the garden.', language: 'en' });
      },
    },
    languageForProfile: () => options.language ?? 'en',
    speech: options.disableSpeech
      ? undefined
      : {
          stt: options.speech?.stt ?? {
            async transcribe() {
              return ok({ text: 'A fictional garden greeting', language: 'en' });
            },
          },
          tts: {
            async synthesize(input, signal) {
              if (opening)
                return ok({
                  pcm: new Uint8Array(882 * 4).fill(1),
                  sampleRate: 22050,
                  encoding: 'pcm_s16le',
                  channels: 1,
                  language: 'en',
                });
              return (options.speech?.tts ?? defaultSpeech.tts).synthesize(input, signal);
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
    ...(options.photo ? { endpoint: 'browser' } : {}),
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
  async function completeOutput() {
    await until(() => events.some((e) => e.type === 'response.start'));
    const start = [...events].reverse().find((e) => e.type === 'response.start')!;
    if (start.type !== 'response.start') throw new Error('Missing output');
    const meta = start.payload;
    const receipt = (status: string, playedChunks: number) =>
      send(
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
    let played = 0;
    while (played < meta.chunkCount) {
      await until(
        () =>
          events.filter((e) => e.type === 'audio.chunk' && e.turn_id === meta.turnId).length >
          played,
      );
      played = events.filter((e) => e.type === 'audio.chunk' && e.turn_id === meta.turnId).length;
      if (played < meta.chunkCount) receipt('progress', played);
    }
    await until(() => events.some((e) => e.type === 'audio.end' && e.turn_id === meta.turnId));
    receipt('completed', meta.chunkCount);
    await until(() => session?.phase === 'waiting');
  }
  if (!options.manualStart) {
    send('input.start');
    if (options.negotiate === false || options.disableSpeech)
      await until(() => session?.phase === 'waiting');
    else await completeOutput();
    opening = false;
    send('input.mute', { muted: false });
    await until(() => session?.micMuted === false);
    events.splice(0, events.length, ...events.filter((e) => e.type === 'device.ready'));
  }
  return {
    gateway,
    ws,
    output,
    events,
    until,
    send,
    session: () => session!,
    completeOutput,
    async startTeaching() {
      send('input.teaching.start');
      await until(() => events.some((e) => e.type === 'response.start'));
      expect(session?.teaching?.choosingTopic).toBe(true);
      expect(session?.teaching?.prompt).toContain('gardening');
      expect(session?.teaching?.prompt).toContain('beaches');
      for (let i = events.length - 1; i >= 0; i--)
        if (events[i]!.type.startsWith('response.') || events[i]!.type.startsWith('audio.'))
          events.splice(i, 1);
      send('input.teaching.select', { entityId: 'topic:gardening' });
      await until(() => events.some((e) => e.type === 'response.start'));
    },
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

test('explicit Start speaks first, Photo Story introduces its scene, Resume repeats it without capture', async () => {
  const prompts: string[] = [];
  let finishResume!: (value: any) => void;
  let resumeSignal!: AbortSignal;
  const latePcm = new Uint8Array(882 * 4).fill(3);
  const d = await device({
    manualStart: true,
    photo: true,
    speech: {
      stt: {
        async transcribe() {
          throw new Error('Capture was not requested');
        },
      },
      tts: {
        async synthesize(input, signal) {
          prompts.push(input.text);
          if (prompts.length === 4) {
            resumeSignal = signal;
            return new Promise((resolve) => {
              finishResume = resolve;
            });
          }
          return ok({
            pcm: new Uint8Array(882 * 4).fill(1),
            sampleRate: 22050,
            encoding: 'pcm_s16le',
            channels: 1,
            language: 'en',
          });
        },
      },
    },
  });
  try {
    expect(prompts).toHaveLength(0);
    d.send('input.start');
    await d.completeOutput();
    expect(prompts[0]).toContain("I'm Lemmi");
    expect(prompts[0]).toBe("Hi, I'm Lemmi. We can take our time.");
    expect(d.session().captureGrant).toBeNull();
    d.events.length = 0;
    d.send('input.photo.start');
    await d.completeOutput();
    const scene = [...d.events].reverse().find((e) => e.type === 'activity.changed');
    if (scene?.type !== 'activity.changed' || scene.payload.activity?.activityId !== 'photo_album')
      throw new Error('Missing photo');
    const assetId = scene.payload.activity.currentAssetId;
    expect(prompts[1]).toContain('Alex tending roses');
    expect(prompts[1]).toContain('?');
    d.send('input.pause');
    await d.until(() => d.session().phase === 'paused');
    const count = prompts.length;
    await Bun.sleep(30);
    expect(prompts).toHaveLength(count);
    d.events.length = 0;
    d.send('input.resume');
    await d.completeOutput();
    expect(prompts[2]).toBe(`We're looking at the same picture. ${prompts[1]}`);
    const resumed = [...d.events].reverse().find((e) => e.type === 'activity.changed');
    expect(
      resumed?.type === 'activity.changed' &&
        resumed.payload.activity?.activityId === 'photo_album' &&
        resumed.payload.activity.currentAssetId,
    ).toBe(assetId);
    expect(d.session().captureGrant).toBeNull();
    expect(d.session().micMuted).toBe(true);
    await Bun.sleep(30);
    expect(prompts).toHaveLength(3);
    d.send('input.pause');
    await d.until(() => d.session().phase === 'paused');
    d.events.length = 0;
    d.send('input.resume');
    await d.until(() => !!finishResume);
    d.send('input.stop');
    await d.until(() => d.session().phase === 'ended');
    expect(resumeSignal.aborted).toBe(true);
    finishResume(
      ok({ pcm: latePcm, sampleRate: 22050, encoding: 'pcm_s16le', channels: 1, language: 'en' }),
    );
    await Bun.sleep(30);
    expect(
      d.events.some((e) => ['response.start', 'response.text', 'audio.chunk'].includes(e.type)),
    ).toBe(false);
    expect(latePcm.every((n) => n === 0)).toBe(true);
    expect(d.session().phase).toBe('ended');
  } finally {
    d.close();
  }
});

test('a failure from the current recognition turn remains visible and capture stays off', async () => {
  const d = await device({
    speech: {
      stt: {
        async transcribe() {
          return fail('UNAVAILABLE', 'Fixture recognition unavailable');
        },
      },
      tts: {
        async synthesize() {
          throw new Error('No reply synthesis expected');
        },
      },
    },
  });
  try {
    const input = await d.capture();
    const id = input.finish();
    await d.until(() =>
      d.events.some((event) => event.type === 'error' && event.payload.commandId === id),
    );
    expect(
      d.events.find((event) => event.type === 'error' && event.payload.commandId === id),
    ).toMatchObject({ payload: { code: 'UNAVAILABLE' } });
    expect(d.session().phase).toBe('waiting');
    expect(d.session().captureGrant).toBeNull();
    expect(d.events.some((event) => event.type === 'response.start')).toBe(false);
  } finally {
    d.close();
  }
});

for (const stage of ['recognition', 'model', 'synthesis'] as const) {
  test(`canceled ${stage} cannot send an old error into the resumed listening attempt`, async () => {
    let entered = false;
    let syntheses = 0;
    let release!: () => void;
    const blocked = () =>
      new Promise<any>((resolve) => {
        release = () => resolve(fail('UNAVAILABLE', 'Canceled fixture adapter'));
      });
    const d = await device({
      chat: {
        async complete() {
          if (stage === 'model') {
            entered = true;
            return blocked();
          }
          return ok({ text: 'A fictional garden.', language: 'en' });
        },
      },
      speech: {
        stt: {
          async transcribe() {
            if (stage === 'recognition') {
              entered = true;
              return blocked();
            }
            return ok({ text: 'A fictional greeting', language: 'en' });
          },
        },
        tts: {
          async synthesize() {
            if (stage === 'synthesis' && syntheses++ === 0) {
              entered = true;
              return blocked();
            }
            return ok({
              pcm: new Uint8Array(882 * 4),
              sampleRate: 22050,
              encoding: 'pcm_s16le',
              channels: 1,
              language: 'en',
            });
          },
        },
      },
    });
    try {
      const input = await d.capture();
      const canceledCommand = input.finish();
      await d.until(() => entered);
      d.send('input.pause');
      await d.until(() => d.session().phase === 'paused');
      release();
      d.send('input.resume');
      await d.completeOutput();
      await Bun.sleep(30);
      expect(
        d.events.filter((e) => e.type === 'error' && e.payload.commandId === canceledCommand),
      ).toEqual([]);
      const next = await d.capture();
      expect(next.grant.turnId).not.toBe(input.grant.turnId);
      expect(d.session().phase).toBe('listening');
    } finally {
      d.close();
    }
  });
}

test('one listening choice sustains 30 paced turns across Photo Story entry and exit', async () => {
  let recognized = 0;
  const d = await device({
    photo: true,
    speech: {
      stt: {
        async transcribe() {
          recognized++;
          return ok({
            text:
              recognized === 10
                ? 'Can we play the Photo Story game?'
                : recognized === 20
                  ? 'Back to conversation'
                  : 'A fictional garden greeting',
            language: 'en',
          });
        },
      },
      tts: {
        async synthesize() {
          return ok({
            pcm: new Uint8Array(882 * 4),
            sampleRate: 22050,
            encoding: 'pcm_s16le',
            channels: 1,
            language: 'en',
          });
        },
      },
    },
  });
  let completed = 0,
    epoch = 0;
  const errors: string[] = [];
  const audio = {
    hasOutput: false,
    prepare: async () => true,
    cancelInput: () => {
      epoch++;
    },
    async speak() {
      const captured = epoch;
      await Bun.sleep(100);
      if (captured !== epoch) return;
      const input = await d.capture();
      loop.submitted(d.session());
      input.finish();
    },
  };
  const loop = new BrowserConversation(
    {
      get session() {
        return d.session();
      },
      send(type, payload) {
        d.send(type, payload);
        return true;
      },
    },
    audio,
    'stackchan-alex',
    () => {},
    (message) => errors.push(message),
  );
  const receive = d.ws.onmessage!;
  d.ws.onmessage = (message) => {
    receive.call(d.ws, message);
    const event = ServerEventSchema.parse(JSON.parse(String(message.data)));
    if (event.type === 'response.start') {
      audio.hasOutput = true;
      const token = d.session();
      void (async () => {
        await Bun.sleep(120);
        await d.completeOutput();
        audio.hasOutput = false;
        completed++;
        if (completed === 30) loop.stop();
        else loop.playbackCompleted(token);
      })().catch((error) => errors.push(error.message));
    }
    if (event.type === 'error') errors.push(event.payload.message);
    loop.receive(event);
  };
  try {
    await loop.start();
    const deadline = Date.now() + 12_000;
    while (completed < 30 && !errors.length && Date.now() < deadline) await Bun.sleep(10);
    expect(errors).toEqual([]);
    expect(completed).toBe(30);
    expect(recognized).toBe(30);
    expect(
      d.events.some(
        (event) =>
          event.type === 'activity.changed' &&
          event.payload.activity?.activityId === 'photo_album' &&
          event.payload.activity.currentAssetId,
      ),
    ).toBe(true);
    expect(d.session().phase).toBe('waiting');
    expect(d.session().captureGrant).toBeNull();
  } finally {
    loop.stop();
    d.close();
  }
}, 15_000);

test('Stop during the automatic opening cancels pending TTS and suppresses all late output', async () => {
  let finish!: (value: any) => void;
  let signal!: AbortSignal;
  const pcm = new Uint8Array(882 * 4).fill(3);
  const d = await device({
    manualStart: true,
    speech: {
      stt: {
        async transcribe() {
          throw new Error('No capture');
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
    d.send('input.start');
    await d.until(() => !!finish);
    d.send('input.stop');
    await d.until(() => d.session().phase === 'ended');
    expect(signal.aborted).toBe(true);
    finish(ok({ pcm, sampleRate: 22050, encoding: 'pcm_s16le', channels: 1, language: 'en' }));
    await Bun.sleep(30);
    expect(
      d.events.some((e) => ['response.start', 'response.text', 'audio.chunk'].includes(e.type)),
    ).toBe(false);
    expect(pcm.every((n) => n === 0)).toBe(true);
    expect(d.session().phase).toBe('ended');
  } finally {
    d.close();
  }
});

test('teaching commands share the authorized gateway and read reviewed prompts without opening capture', async () => {
  const d = await device();
  try {
    expect(d.events.find((e) => e.type === 'device.ready')!.payload).toHaveProperty(
      'teaching',
      true,
    );
    await d.startTeaching();
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
    await d.startTeaching();
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

test('spoken teaching Next crosses WSS with a fresh generation and audible replacement reply', async () => {
  const d = await device({
    speech: {
      stt: {
        async transcribe() {
          return ok({ text: 'Different topic', language: 'en' });
        },
      },
      tts: {
        async synthesize() {
          return ok({
            pcm: new Uint8Array(882 * 4).fill(3),
            sampleRate: 22050,
            encoding: 'pcm_s16le',
            channels: 1,
            language: 'en',
          });
        },
      },
    },
  });
  try {
    await d.startTeaching();
    await d.until(() => d.events.some((e) => e.type === 'response.start'));
    d.send('input.pause');
    await d.until(() => d.session().phase === 'paused');
    d.send('input.resume');
    d.events.length = 0;
    await d.completeOutput();
    d.events.length = 0;
    const input = await d.capture(),
      generation = d.session().generation;
    input.finish();
    await d.until(() => d.events.filter((e) => e.type === 'response.start').length === 1);
    const reply = d.events.find((e) => e.type === 'response.text');
    expect(reply?.type).toBe('response.text');
    if (reply?.type !== 'response.text') throw new Error('Missing fixed teaching reply');
    expect(reply.payload.source).toBe('fixed');
    expect(reply.payload.turnId).not.toBe(input.grant.turnId);
    expect(reply.generation).toBeGreaterThan(generation);
    expect(d.session().teaching?.entityId).toBe('topic:beaches');
    expect(d.events.some((e) => e.type === 'error' && e.payload.code === 'REVISION_CONFLICT')).toBe(
      false,
    );
    expect(d.session().captureGrant).toBeNull();
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
    const concernAfter = d.events.length;
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
        .slice(concernAfter)
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

test('selected transport diagnostics observe accepted uplink, mute cancellation and peer close without content', async () => {
  const observations: TransportDiagnostic[] = [];
  const d = await device({
    transportDiagnostics: { deviceId: 'stackchan-alex', emit: (o) => observations.push(o) },
  });
  try {
    const input = await d.capture();
    await d.until(() =>
      d.events.some((e) => e.type === 'state.changed' && e.payload.session?.phase === 'listening'),
    );
    await Bun.sleep(30);
    d.send('input.mute', { muted: true });
    await d.until(() => d.session().micMuted);
    input.finish();
    await d.until(() =>
      d.events.some((e) => e.type === 'error' && e.payload.code === 'REVISION_CONFLICT'),
    );
    expect(d.session().captureGrant).toBeNull();
    d.send('input.stop');
    await d.until(() => d.session().phase === 'ended');
    d.ws.close(1000, 'PRIVATE_PEER_CLOSE_TEXT');
    await d.until(() => observations.some((o) => o.event === 'close'));
    const closed = observations.find((o) => o.event === 'close')!;
    expect(closed.acceptedCaptureFrames).toBe(2);
    expect(closed.receivedBytes).toBeGreaterThan(1700);
    expect(closed.lastErrorCode).toBe('REVISION_CONFLICT');
    expect(closed.rejectedEvents).toBeGreaterThan(0);
    expect(closed.closeCode).toBe(1000);
    expect(closed.localCloseReason).toBeNull();
    const serialized = JSON.stringify(observations);
    for (const secret of [
      'PRIVATE_PEER_CLOSE_TEXT',
      'profile-alex',
      'stackchan-alex',
      input.grant.turnId,
      input.grant.streamId,
      input.grant.leaseId,
      Buffer.alloc(640, 1).toString('base64'),
      'fictional-audio-fixture',
    ])
      expect(serialized).not.toContain(secret);
  } finally {
    d.close();
  }
});

test('transport diagnostics identify local capture rate-limit closure', async () => {
  const observations: TransportDiagnostic[] = [];
  const d = await device({
    transportDiagnostics: { deviceId: 'stackchan-alex', emit: (o) => observations.push(o) },
  });
  try {
    d.send('input.speak', { language: 'en' });
    await d.until(() => d.session().phase === 'listening');
    const grant = d.session().captureGrant!;
    for (let chunkIndex = 0; chunkIndex < 61; chunkIndex++)
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
    await d.until(() => observations.some((o) => o.event === 'close'));
    const closed = observations.find((o) => o.event === 'close')!;
    expect(closed.localCloseReason).toBe('Capture rate limit');
    expect(closed.closeCode).toBe(1008);
  } finally {
    d.close();
  }
});

test('transport diagnostics stay silent for an unselected endpoint', async () => {
  const observations: TransportDiagnostic[] = [];
  const d = await device({
    transportDiagnostics: {
      deviceId: 'another-enrolled-device',
      emit: (o) => observations.push(o),
    },
  });
  try {
    const input = await d.capture();
    input.finish();
    await d.until(() => d.events.some((e) => e.type === 'response.start'));
    d.ws.close();
    await d.until(() => d.ws.readyState === WebSocket.CLOSED);
    expect(observations).toEqual([]);
  } finally {
    d.close();
  }
});

test('a failing transport diagnostic sink cannot prevent Stop or mute', async () => {
  const d = await device({
    transportDiagnostics: {
      deviceId: 'stackchan-alex',
      emit: () => {
        throw new Error('fixture sink unavailable');
      },
    },
  });
  try {
    await d.capture();
    d.send('input.mute', { muted: true });
    await d.until(() => d.session().micMuted);
    expect(d.session().captureGrant).toBeNull();
    d.send('input.stop');
    await d.until(() => d.session().phase === 'ended');
  } finally {
    d.close();
  }
});

test('paced 50-fps uplink is accepted with bounded aggregate diagnostics and no per-frame replies', async () => {
  const observations: TransportDiagnostic[] = [];
  const d = await device({
    transportDiagnostics: { deviceId: 'stackchan-alex', emit: (o) => observations.push(o) },
  });
  try {
    d.send('input.speak', { language: 'en' });
    await d.until(() => d.session().phase === 'listening');
    const grant = d.session().captureGrant!;
    const eventCount = d.events.length;
    for (let chunkIndex = 0; chunkIndex < 75; chunkIndex++) {
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
      await Bun.sleep(20);
    }
    expect(d.events.slice(eventCount).filter((e) => e.type !== 'heartbeat')).toEqual([]);
    d.send(
      'audio.end',
      { leaseId: grant.leaseId, streamId: grant.streamId, chunkCount: 75 },
      grant.turnId,
    );
    await d.until(() => d.events.some((e) => e.type === 'response.start'));
    expect(observations.find((o) => o.event === 'capture_end')?.acceptedCaptureFrames).toBe(75);
    expect(observations.filter((o) => o.event === 'sample').length).toBeGreaterThan(0);
    expect(observations.length).toBeLessThan(8);
    expect(d.events.filter((e) => e.type === 'error')).toEqual([]);
    d.send('input.stop');
    await d.until(() => d.session().phase === 'ended');
  } finally {
    d.close();
  }
});

for (const language of ['en', 'de'] as const)
  for (const mode of ['no-playback', 'disabled', 'tts-failure'] as const)
    test(`${language} Start/Resume sends current approved text with ${mode} and no capture`, async () => {
      const d = await device({
        manualStart: true,
        language,
        negotiate: mode !== 'no-playback',
        disableSpeech: mode === 'disabled',
        speech: {
          stt: {
            async transcribe() {
              throw new Error('No capture requested');
            },
          },
          tts: {
            async synthesize() {
              return fail('UNAVAILABLE', 'Fixture voice unavailable');
            },
          },
        },
      });
      try {
        for (const type of ['input.start', 'input.resume']) {
          d.events.length = 0;
          d.send(type);
          await d.until(() => d.events.some((e) => e.type === 'response.text'));
          const reply = d.events.find((e) => e.type === 'response.text')!;
          expect(reply.type === 'response.text' && reply.payload.language).toBe(language);
          expect(reply.type === 'response.text' && reply.payload.text).toContain(
            language === 'de'
              ? type === 'input.start'
                ? 'Hallo'
                : 'Wir sind wieder'
              : type === 'input.start'
                ? 'Hi'
                : "We're back",
          );
          expect(d.events.some((e) => ['response.start', 'audio.chunk'].includes(e.type))).toBe(
            false,
          );
          expect(d.session().captureGrant).toBeNull();
          d.send('input.pause');
          await d.until(() => d.session().phase === 'paused');
        }
      } finally {
        d.close();
      }
    });
