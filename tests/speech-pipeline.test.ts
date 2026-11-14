import { expect, test } from 'bun:test';
import {
  ok,
  SessionSnapshotSchema,
  DeviceEventSchema,
  ServerEventSchema,
  type SessionSnapshot,
} from '@lemmi/contracts';
import { SessionCoordinator, type SpeechAdapters, type ChatAdapter } from '@lemmi/server';
import { elapsedEpochClock } from '../packages/server/src/elapsed-clock';
import {
  speechCaptureSessionFixture,
  speechDeviceEventFixtures,
  speechServerEventFixtures,
  caregiverProfile,
} from '@lemmi/contracts/fixtures';

const frame = Buffer.alloc(640, 1).toString('base64');
function setup(overrides: Partial<SpeechAdapters> & { chat?: ChatAdapter } = {}) {
  let now = 1_800_000_000_000;
  const output = new Uint8Array(882 * 12).fill(3);
  const seen: {
    input?: Uint8Array;
    model?: string;
    sttSignal?: AbortSignal;
    ttsSignal?: AbortSignal;
  } = {};
  const coordinator = new SessionCoordinator(
    'live',
    overrides.chat ?? {
      async complete(input) {
        seen.model = input.text;
        return ok({ text: 'We can enjoy the garden.', language: 'en' });
      },
    },
    {
      stt: overrides.stt ?? {
        async transcribe(input, signal) {
          seen.input = input.pcm;
          seen.sttSignal = signal;
          return ok({ text: 'A fictional garden greeting', language: 'en' });
        },
      },
      tts: overrides.tts ?? {
        async synthesize(_input, signal) {
          seen.ttsSignal = signal;
          return ok({
            pcm: output,
            sampleRate: 22050,
            channels: 1,
            encoding: 'pcm_s16le',
            language: 'en',
          });
        },
      },
    },
    () => now,
  );
  coordinator.handle('session.start', {
    profileId: 'profile-alex',
    commandId: crypto.randomUUID(),
    endpoint: 'robot',
  });
  const control = (action: unknown) => {
    const s = coordinator.snapshot()!;
    return coordinator.handle('session.command', {
      sessionId: s.id,
      expectedGeneration: s.generation,
      commandId: crypto.randomUUID(),
      action,
    });
  };
  const start = (commandId = crypto.randomUUID(), language = 'en') => {
    const s = coordinator.snapshot()!;
    return coordinator.requestCapture(
      {
        sessionId: s.id,
        expectedGeneration: s.generation,
        commandId,
        language,
      },
      [22050],
    );
  };
  const scope = (s: SessionSnapshot = coordinator.snapshot()!) => ({
    sessionId: s.id,
    expectedGeneration: s.generation,
    turnId: s.captureGrant!.turnId,
    streamId: s.captureGrant!.streamId,
    leaseId: s.leaseId,
  });
  const chunk = (index = 0) =>
    coordinator.acceptCaptureChunk({
      ...scope(),
      chunkIndex: index,
      encoding: 'pcm_s16le',
      data: frame,
    });
  const end = (count = 1) => coordinator.finishCapture({ ...scope(), chunkCount: count });
  return {
    coordinator,
    control,
    start,
    scope,
    chunk,
    end,
    output,
    seen,
    advance: (ms: number) => {
      now += ms;
    },
  };
}
const ready = (f: ReturnType<typeof setup>) => {
  f.control({ type: 'mute', muted: false });
  expect(f.start().ok).toBe(true);
};
const tick = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

test('apply-now cancels capture, STT, model, TTS and queued/playing audio without granting a new turn', async () => {
  for (const stage of ['capture', 'stt', 'model', 'tts', 'queued', 'playing'] as const) {
    let finish: ((v: any) => void) | undefined, signal: AbortSignal | undefined;
    let reached!: () => void;
    const entered = new Promise<void>((r) => {
      reached = r;
    });
    const late = new Uint8Array(882).fill(8);
    const delayed = (s: AbortSignal) => {
      signal = s;
      reached();
      return new Promise<any>((r) => {
        finish = r;
      });
    };
    const f = setup({
      ...(stage === 'stt'
        ? {
            stt: {
              transcribe(_i, s) {
                return delayed(s);
              },
            },
          }
        : {}),
      ...(stage === 'model'
        ? {
            chat: {
              complete(_i, s) {
                return delayed(s);
              },
            },
          }
        : {}),
      ...(stage === 'tts'
        ? {
            tts: {
              synthesize(_i, s) {
                return delayed(s);
              },
            },
          }
        : {}),
    });
    ready(f);
    f.chunk();
    const pending = stage === 'capture' ? undefined : f.end();
    await tick();
    if (['stt', 'model', 'tts'].includes(stage)) await entered;
    if (stage === 'queued' || stage === 'playing') expect((await pending!).ok).toBe(true);
    if (stage === 'playing') {
      const s = f.coordinator.snapshot()!,
        out = f.coordinator.drainSpeechOutput()!.metadata;
      expect(
        f.coordinator.playbackReceipt({
          sessionId: s.id,
          expectedGeneration: s.generation,
          turnId: out.turnId,
          leaseId: out.leaseId,
          streamId: out.streamId,
          status: 'started',
          playedChunks: 0,
        }).ok,
      ).toBe(true);
      expect(f.coordinator.snapshot()?.phase).toBe('speaking');
    }
    const old = f.coordinator.snapshot()!;
    const profile = {
      ...caregiverProfile,
      revision: 1,
      communicationSupport: { preset: 'quiet' as const, configVersion: 1 as const },
      approvedFacts: [],
      privacyRevision: 0,
      policyRevision: 0,
    };
    f.coordinator.acceptPersistentProfile(profile);
    expect(f.coordinator.snapshot()?.communicationSupport.preset).toBe('guided');
    expect(
      f.coordinator.applyCommunicationSupport(
        {
          profileId: 'profile-alex',
          expectedProfileRevision: 1,
          sessionId: old.id,
          expectedGeneration: old.generation,
          commandId: crypto.randomUUID(),
        },
        profile,
        'fixture-caregiver',
      ).ok,
    ).toBe(true);
    expect(f.coordinator.snapshot()).toMatchObject({
      phase: 'paused',
      generation: old.generation + 1,
      captureGrant: null,
      micMuted: false,
      communicationSupport: { preset: 'quiet' },
    });
    expect(f.coordinator.speechOutputInfo()).toBeNull();
    expect(f.coordinator.drainSpeechOutput()).toBeNull();
    if (signal) expect(signal.aborted).toBe(true);
    if (pending && ['stt', 'model', 'tts'].includes(stage)) expect((await pending).ok).toBe(false);
    if (finish)
      finish(
        stage === 'tts'
          ? ok({ pcm: late, sampleRate: 22050, channels: 1, encoding: 'pcm_s16le', language: 'en' })
          : ok({ text: 'late-private-marker', language: 'en' }),
      );
    await tick();
    if (stage === 'tts') expect(late.every((b) => b === 0)).toBe(true);
    if (stage === 'queued' || stage === 'playing')
      expect(f.output.every((b) => b === 0)).toBe(true);
    expect(JSON.stringify(f.coordinator)).not.toContain('late-private-marker');
    expect(f.control({ type: 'resume' }).ok).toBe(true);
    expect(f.coordinator.snapshot()).toMatchObject({
      phase: 'ready',
      captureGrant: null,
      communicationSupport: { preset: 'quiet' },
    });
  }
});

test('speech deadlines retain epoch shape but follow elapsed time despite wall-clock corrections', () => {
  let wall = 1_800_000_000_000,
    elapsed = 100;
  const clock = elapsedEpochClock(
      () => wall,
      () => elapsed,
    ),
    began = clock();
  elapsed += 1257;
  wall -= 1675;
  expect(clock() - began).toBe(1257);
  expect(new Date(clock()).toISOString()).toBe(new Date(began + 1257).toISOString());
  elapsed += 18_743;
  wall += 50_000;
  expect(clock() - began).toBe(20_000);
});

test('capture requires explicit fresh action; unmute alone never grants, IDs bind each turn', async () => {
  const f = setup(),
    { coordinator: c } = f;
  expect(f.start().ok).toBe(false);
  f.control({ type: 'mute', muted: false });
  expect(c.snapshot()?.captureGrant).toBeNull();
  const id = crypto.randomUUID();
  expect(f.start(id).ok).toBe(true);
  const grant = c.snapshot()!.captureGrant!;
  expect(SessionSnapshotSchema.safeParse(c.snapshot()).success).toBe(true);
  expect(f.start(id).ok).toBe(true);
  expect(c.snapshot()!.captureGrant).toEqual(grant);
  expect(
    c.acceptCaptureChunk({
      ...f.scope(),
      streamId: 'foreign-stream',
      chunkIndex: 0,
      encoding: 'pcm_s16le',
      data: frame,
    }).ok,
  ).toBe(false);
  expect(f.chunk().ok).toBe(true);
  f.control({ type: 'mute', muted: true });
  expect(c.snapshot()?.phase).toBe('waiting');
  f.control({ type: 'mute', muted: false });
  expect(c.snapshot()?.captureGrant).toBeNull();
  expect(f.start(id).ok).toBe(false);
});

test('STT → chat → TTS is transient, output waits for truthful receipts and never starts capture', async () => {
  const f = setup(),
    { coordinator: c } = f;
  ready(f);
  expect(f.chunk().ok).toBe(true);
  const ending = f.scope();
  const result = await c.finishCapture({ ...ending, chunkCount: 1 });
  expect(result.ok).toBe(true);
  expect(f.seen.model).toBe('A fictional garden greeting');
  expect(f.seen.input?.every((x) => x === 0)).toBe(true);
  expect(c.snapshot()?.phase).toBe('processing');
  expect(c.snapshot()?.captureGrant).toBeNull();
  const metadata = c.speechOutputInfo()!;
  const receipt = (status: string, playedChunks: number, streamId = metadata.streamId) =>
    c.playbackReceipt({ ...ending, streamId, status, playedChunks });
  let batch = c.drainSpeechOutput()!;
  expect(batch.start).toBe(true);
  expect(batch.chunks).toHaveLength(4);
  expect(batch.end).toBe(false);
  expect(receipt('completed', 12).ok).toBe(false);
  expect(receipt('started', 0, 'forged-stream').ok).toBe(false);
  expect(receipt('started', 0).ok).toBe(true);
  expect(c.snapshot()?.phase).toBe('speaking');
  expect(c.drainSpeechOutput()?.chunks).toHaveLength(0);
  expect(receipt('progress', 4).ok).toBe(true);
  batch = c.drainSpeechOutput()!;
  expect(batch.chunks.map((x) => x.chunkIndex)).toEqual([4, 5, 6, 7]);
  expect(receipt('progress', 2).ok).toBe(false);
  expect(receipt('progress', 8).ok).toBe(true);
  batch = c.drainSpeechOutput()!;
  expect(batch.end).toBe(true);
  expect(receipt('completed', 12).ok).toBe(true);
  expect(c.snapshot()?.phase).toBe('waiting');
  expect(c.snapshot()?.captureGrant).toBeNull();
  expect(f.output.every((x) => x === 0)).toBe(true);
  expect(receipt('completed', 12).ok).toBe(false);
  expect(JSON.stringify(c.persistenceSnapshot())).not.toContain('garden');
});

test('capture gaps, backlog, incomplete end, expiration and frame bounds invalidate capture', async () => {
  for (const invalid of ['gap', 'backlog', 'end', 'timeout', 'base64']) {
    const f = setup();
    ready(f);
    if (invalid === 'gap') expect(f.chunk(1).ok).toBe(false);
    if (invalid === 'base64')
      expect(
        f.coordinator.acceptCaptureChunk({
          ...f.scope(),
          chunkIndex: 0,
          encoding: 'pcm_s16le',
          data: 'A'.repeat(856),
        }).ok,
      ).toBe(false);
    if (invalid === 'backlog') {
      for (let i = 0; i < 50; i++) expect(f.chunk(i).ok).toBe(true);
      expect(f.chunk(50).ok).toBe(false);
    }
    if (invalid === 'end') {
      f.chunk();
      expect((await f.end(2)).ok).toBe(false);
    }
    if (invalid === 'timeout') {
      f.advance(20_000);
      expect(f.coordinator.sweepSpeech()).toBe(true);
    }
    expect(f.coordinator.snapshot()?.captureGrant).toBeNull();
    expect(f.coordinator.snapshot()?.phase).toBe('waiting');
  }
});

test('Stop, pause, mute, help, handoff, disconnect and revoke abort recognition and discard late work', async () => {
  for (const action of ['stop', 'pause', 'mute', 'help', 'handoff', 'disconnect', 'revoke']) {
    let finish!: (value: any) => void;
    let signal!: AbortSignal;
    const f = setup({
      stt: {
        transcribe(_input, s) {
          signal = s;
          return new Promise((resolve) => {
            finish = resolve;
          });
        },
      },
    });
    ready(f);
    f.chunk();
    const work = f.end();
    await tick();
    if (action === 'disconnect') f.coordinator.disconnect();
    else if (action === 'revoke') f.coordinator.revokeDeviceAccess();
    else if (action === 'help')
      f.coordinator.handle('help.create', {
        profileId: 'profile-alex',
        commandId: crypto.randomUUID(),
        mode: 'real',
      });
    else
      f.control(
        action === 'mute'
          ? { type: 'mute', muted: true }
          : action === 'handoff'
            ? { type: 'handoff', endpoint: 'browser' }
            : { type: action },
      );
    expect(signal.aborted).toBe(true);
    expect((await work).ok).toBe(false);
    finish(ok({ text: 'late private marker', language: 'en' }));
    await tick();
    expect(f.seen.model).toBeUndefined();
    expect(f.coordinator.speechOutputInfo()).toBeNull();
    expect(f.coordinator.snapshot()?.captureGrant).toBeNull();
  }
});

test('mute cancels pending TTS but preserves already approved playback; Stop flushes both', async () => {
  let finish!: (value: any) => void;
  const f = setup({
    tts: {
      synthesize() {
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
    },
  });
  ready(f);
  f.chunk();
  const work = f.end();
  await tick();
  await tick();
  f.control({ type: 'mute', muted: true });
  expect((await work).ok).toBe(false);
  const late = new Uint8Array(882).fill(5);
  finish(ok({ pcm: late, sampleRate: 22050, encoding: 'pcm_s16le', channels: 1, language: 'en' }));
  await tick();
  expect(late.every((x) => x === 0)).toBe(true);
  const g = setup();
  ready(g);
  g.chunk();
  expect((await g.end()).ok).toBe(true);
  const approved = g.coordinator.speechOutputInfo();
  g.control({ type: 'mute', muted: true });
  expect(g.coordinator.speechOutputInfo()).toEqual(approved);
  expect(g.coordinator.snapshot()?.micMuted).toBe(true);
  g.control({ type: 'stop' });
  expect(g.coordinator.speechOutputInfo()).toBeNull();
  expect(g.output.every((x) => x === 0)).toBe(true);
});

test('empty/foreign-language STT, TTS format failure and missing playback receipts never fabricate success', async () => {
  for (const text of ['', 'Hallo']) {
    const f = setup({
      stt: {
        async transcribe() {
          return ok({ text, language: text ? 'de' : 'en' });
        },
      },
    });
    ready(f);
    f.chunk();
    expect((await f.end()).ok).toBe(false);
    expect(f.coordinator.speechOutputInfo()).toBeNull();
  }
  const f = setup();
  ready(f);
  f.chunk();
  await f.end();
  f.advance(5000);
  expect(f.coordinator.sweepSpeech()).toBe(true);
  expect(f.coordinator.speechOutputInfo()).toBeNull();
  expect(f.output.every((x) => x === 0)).toBe(true);
});

test('new audio events validate while legacy control hello remains audio-disabled', () => {
  expect(SessionSnapshotSchema.safeParse(speechCaptureSessionFixture).success).toBe(true);
  for (const event of speechDeviceEventFixtures)
    expect(DeviceEventSchema.safeParse(event).success).toBe(true);
  for (const event of speechServerEventFixtures)
    expect(ServerEventSchema.safeParse(event).success).toBe(true);
  const base = {
    protocol_version: 1,
    event_id: 'event',
    session_id: 'session',
    turn_id: 'turn',
    generation: 0,
    sequence: 2,
  };
  expect(
    DeviceEventSchema.safeParse({
      ...base,
      type: 'audio.end',
      payload: {
        leaseId: 'lease',
        streamId: 'stream',
        chunkCount: 1,
      },
    }).success,
  ).toBe(true);
  expect(
    ServerEventSchema.safeParse({
      ...base,
      type: 'audio.chunk',
      payload: {
        leaseId: 'lease',
        streamId: 'stream',
        chunkIndex: 0,
        encoding: 'pcm_s16le',
        data: frame,
      },
    }).success,
  ).toBe(true);
});

test('unmute during capture retires the grant, and expired output cannot accept a late receipt', async () => {
  const f = setup();
  ready(f);
  const obsolete = f.scope();
  f.chunk();
  f.control({ type: 'mute', muted: false });
  expect(f.coordinator.snapshot()?.phase).toBe('waiting');
  expect(f.coordinator.snapshot()?.captureGrant).toBeNull();
  expect(
    f.coordinator.acceptCaptureChunk({
      ...obsolete,
      chunkIndex: 1,
      encoding: 'pcm_s16le',
      data: frame,
    }).ok,
  ).toBe(false);
  const g = setup();
  ready(g);
  g.chunk();
  const scope = g.scope();
  await g.end();
  const metadata = g.coordinator.drainSpeechOutput()!.metadata;
  g.advance(5000);
  expect(
    g.coordinator.playbackReceipt({
      ...scope,
      streamId: metadata.streamId,
      status: 'started',
      playedChunks: 0,
    }).ok,
  ).toBe(false);
  expect(g.coordinator.speechOutputInfo()).toBeNull();
  expect(g.coordinator.sweepSpeech()).toBe(true);
  expect(g.coordinator.snapshot()?.phase).toBe('waiting');
});

test('recognized help/Stop/refusal bypass the model and preserve fixed routing behavior', async () => {
  for (const text of ['Help', 'Stop', "Don't ask about that"]) {
    const f = setup({
      stt: {
        async transcribe() {
          return ok({ text, language: 'en' });
        },
      },
    });
    ready(f);
    f.chunk();
    const result = await f.end();
    expect(f.seen.model).toBeUndefined();
    expect(f.coordinator.speechOutputInfo()).toBeNull();
    if (text === 'Help') {
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toContain('no request was created or sent');
    } else expect(result.ok).toBe(true);
    expect(f.coordinator.snapshot()?.phase).toBe(text === 'Stop' ? 'ended' : 'paused');
  }
});

test('profile changes cancel a voice model request; explicit capture retires the previous text receipt', async () => {
  let finish!: (value: any) => void, canceled!: AbortSignal;
  const f = setup({
    chat: {
      complete(_input, signal) {
        canceled = signal;
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
    },
  });
  ready(f);
  f.chunk();
  const work = f.end();
  await tick();
  expect(canceled.aborted).toBe(false);
  f.coordinator.pauseForProfileUpdate({ approvedFacts: [] });
  expect(canceled.aborted).toBe(true);
  expect((await work).ok).toBe(false);
  finish(ok({ text: 'Obsolete context.', language: 'en' }));
  await tick();
  expect(f.coordinator.snapshot()?.phase).toBe('paused');
  expect(f.coordinator.speechOutputInfo()).toBeNull();
  const g = setup(),
    s = g.coordinator.snapshot()!,
    id = crypto.randomUUID();
  await g.coordinator.submitText({
    sessionId: s.id,
    expectedGeneration: s.generation,
    commandId: id,
    text: 'Hello',
    language: 'en',
  });
  expect(g.coordinator.isCurrentTextReply(id)).toBe(true);
  ready(g);
  expect(g.coordinator.isCurrentTextReply(id)).toBe(false);
});

test('maximum capture size and incompatible native TTS rate fail without retaining audio', async () => {
  const f = setup();
  ready(f);
  for (let i = 0; i < 1000; i++) {
    if (i) f.advance(20);
    expect(f.chunk(i).ok).toBe(true);
  }
  expect(f.chunk(1000).ok).toBe(false);
  expect(f.coordinator.snapshot()?.captureGrant).toBeNull();
  const pcm = new Uint8Array(960).fill(7);
  const g = setup({
    tts: {
      async synthesize() {
        return ok({
          pcm,
          sampleRate: 24000,
          encoding: 'pcm_s16le',
          channels: 1,
          language: 'en',
        });
      },
    },
  });
  ready(g);
  g.chunk();
  expect((await g.end()).ok).toBe(false);
  expect(pcm.every((x) => x === 0)).toBe(true);
  expect(g.coordinator.speechOutputInfo()).toBeNull();
});
