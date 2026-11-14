import { expect, test } from 'bun:test';
import {
  ok,
  fail,
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
    spoken?: string;
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
        async synthesize(input, signal) {
          seen.spoken = input.text;
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

test('teaching deadline cancels queued prompt audio and an in-flight prompt synthesis', async () => {
  const queued = setup();
  queued.control({ type: 'teaching.start' });
  const s = queued.coordinator.snapshot()!;
  expect(
    (
      await queued.coordinator.speakTeachingPrompt(
        {
          sessionId: s.id,
          expectedGeneration: s.generation,
          commandId: 'read-prompt',
          language: 'en',
        },
        [22050],
      )
    ).ok,
  ).toBe(true);
  expect(queued.coordinator.speechOutputInfo()).not.toBeNull();
  queued.advance(15 * 60_000);
  expect(queued.coordinator.sweepTeaching()).toBe(true);
  expect(queued.coordinator.speechOutputInfo()).toBeNull();
  expect(queued.output.every((byte) => byte === 0)).toBe(true);
  expect(queued.coordinator.snapshot()?.captureGrant).toBeNull();

  let finish!: (value: any) => void, canceled!: AbortSignal;
  const late = setup({
    tts: {
      synthesize(_input, signal) {
        canceled = signal;
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
    },
  });
  late.control({ type: 'teaching.start' });
  const t = late.coordinator.snapshot()!;
  const pending = late.coordinator.speakTeachingPrompt(
    {
      sessionId: t.id,
      expectedGeneration: t.generation,
      commandId: 'pending-prompt',
      language: 'en',
    },
    [22050],
  );
  await tick();
  late.control({ type: 'mute', muted: true });
  expect(canceled.aborted).toBe(false); // mic mute does not cancel unrelated approved output
  late.advance(15 * 60_000);
  late.coordinator.sweepTeaching();
  expect(canceled.aborted).toBe(true);
  const pcm = new Uint8Array(882).fill(9);
  finish(ok({ pcm, sampleRate: 22050, encoding: 'pcm_s16le', channels: 1, language: 'en' }));
  expect((await pending).ok).toBe(false);
  await tick();
  expect(pcm.every((byte) => byte === 0)).toBe(true);
  expect(late.coordinator.snapshot()?.teaching).toBeNull();
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
    expect(!!f.coordinator.speechOutputInfo()).toBe(text === "Don't ask about that");
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

const concernSpeech = (tts?: SpeechAdapters['tts'], text = 'I cannot breathe') =>
  setup({
    stt: {
      async transcribe() {
        return ok({ text, language: 'en' });
      },
    },
    ...(tts ? { tts } : {}),
  });
const fixedReceipt = (f: ReturnType<typeof setup>, status: string, playedChunks: number) => {
  const s = f.coordinator.snapshot()!,
    metadata = f.coordinator.speechOutputInfo()!;
  return f.coordinator.playbackReceipt({
    sessionId: s.id,
    expectedGeneration: s.generation,
    turnId: metadata.turnId,
    leaseId: metadata.leaseId,
    streamId: metadata.streamId,
    status,
    playedChunks,
  });
};

test('recognized concerns/refusal use fresh fixed output authority and finish still paused', async () => {
  for (const text of [
    'I cannot breathe',
    'I took too many pills',
    'I feel unwell',
    "Don't ask about that",
  ]) {
    const f = concernSpeech(undefined, text),
      c = f.coordinator;
    ready(f);
    const original = f.scope();
    f.chunk();
    const result = await f.end();
    expect(result.ok).toBe(true);
    if (!result.ok || result.data.kind !== 'reply') throw new Error('Missing fixed reply');
    expect(result.data.reply.source).toBe('fixed');
    expect(f.seen.spoken).toBe(result.data.reply.text);
    expect(f.seen.model).toBeUndefined();
    const metadata = c.speechOutputInfo()!;
    expect(metadata.turnId).toBe(result.data.reply.turnId);
    expect(metadata.turnId).not.toBe(original.turnId);
    expect(c.isCurrentTextReply(original.turnId)).toBe(false);
    expect(c.isCurrentTextReply(metadata.turnId)).toBe(true);
    expect(metadata.streamId).not.toBe(original.streamId);
    expect(c.snapshot()?.generation).toBe(original.expectedGeneration + 1);
    expect(c.snapshot()?.phase).toBe('paused');
    expect(c.snapshot()?.captureGrant).toBeNull();
    expect(f.start().ok).toBe(false);
    expect((await c.finishCapture({ ...original, chunkCount: 1 })).ok).toBe(false);
    c.drainSpeechOutput();
    expect(
      c.playbackReceipt({
        ...original,
        streamId: metadata.streamId,
        status: 'started',
        playedChunks: 0,
      }).ok,
    ).toBe(false);
    expect(fixedReceipt(f, 'started', 0).ok).toBe(true);
    expect(c.snapshot()?.phase).toBe('paused');
    f.control({ type: 'mute', muted: true });
    expect(c.speechOutputInfo()).toEqual(metadata);
    for (const played of [4, 8]) {
      expect(fixedReceipt(f, 'progress', played).ok).toBe(true);
      c.drainSpeechOutput();
    }
    expect(fixedReceipt(f, 'completed', 12).ok).toBe(true);
    expect(c.isCurrentTextReply(metadata.turnId)).toBe(false);
    expect(c.snapshot()?.phase).toBe('paused');
    expect(c.snapshot()?.captureGrant).toBeNull();
    expect(c.speechOutputInfo()).toBeNull();
    expect(f.output.every((x) => x === 0)).toBe(true);
    expect(JSON.stringify(c.persistenceSnapshot())).not.toContain(text);
  }
});

function interruptFixed(f: ReturnType<typeof setup>, action: string) {
  if (action === 'disconnect') f.coordinator.disconnect();
  else if (action === 'revoke') f.coordinator.revokeDeviceAccess();
  else if (action === 'profile') f.coordinator.pauseForProfileUpdate({ approvedFacts: [] });
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
}

test('fixed synthesis cancels on controls/context changes and wipes adapter results that arrive late', async () => {
  for (const action of [
    'stop',
    'pause',
    'help',
    'mute',
    'handoff',
    'disconnect',
    'revoke',
    'profile',
    'resume',
  ]) {
    let finish!: (value: any) => void, canceled!: AbortSignal, entered!: () => void;
    const began = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const f = concernSpeech({
      synthesize(_input, signal) {
        canceled = signal;
        entered();
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
    });
    ready(f);
    f.chunk();
    const work = f.end();
    await began;
    expect(f.coordinator.snapshot()?.phase).toBe('paused');
    interruptFixed(f, action);
    expect(canceled.aborted).toBe(true);
    expect((await work).ok).toBe(false);
    const late = new Uint8Array(882).fill(7);
    finish(
      ok({ pcm: late, sampleRate: 22050, encoding: 'pcm_s16le', channels: 1, language: 'en' }),
    );
    await tick();
    expect(late.every((x) => x === 0)).toBe(true);
    expect(f.coordinator.speechOutputInfo()).toBeNull();
    expect(f.coordinator.snapshot()?.captureGrant).toBeNull();
    expect(f.coordinator.snapshot()?.phase).toBe(
      ['stop', 'revoke'].includes(action) ? 'ended' : action === 'resume' ? 'ready' : 'paused',
    );
  }
});

test('queued/playing fixed speech is canceled without reopening capture or accepting stale receipts', async () => {
  for (const playing of [false, true])
    for (const action of [
      'stop',
      'pause',
      'help',
      'handoff',
      'disconnect',
      'revoke',
      'profile',
      'resume',
    ]) {
      const f = concernSpeech();
      ready(f);
      f.chunk();
      expect((await f.end()).ok).toBe(true);
      const c = f.coordinator,
        s = c.snapshot()!,
        metadata = c.drainSpeechOutput()!.metadata;
      if (playing) expect(fixedReceipt(f, 'started', 0).ok).toBe(true);
      interruptFixed(f, action);
      expect(c.speechOutputInfo()).toBeNull();
      expect(f.output.every((x) => x === 0)).toBe(true);
      expect(
        c.playbackReceipt({
          sessionId: s.id,
          expectedGeneration: s.generation,
          turnId: metadata.turnId,
          leaseId: metadata.leaseId,
          streamId: metadata.streamId,
          status: 'progress',
          playedChunks: 4,
        }).ok,
      ).toBe(false);
      expect(c.snapshot()?.captureGrant).toBeNull();
    }
});

test('fixed TTS failure and missing receipts stay paused and never grant capture', async () => {
  const failed = concernSpeech({
    async synthesize() {
      return fail('UNAVAILABLE', 'Fixture failure');
    },
  });
  ready(failed);
  failed.chunk();
  expect((await failed.end()).ok).toBe(false);
  expect(failed.coordinator.snapshot()?.phase).toBe('paused');
  expect(failed.coordinator.speechOutputInfo()).toBeNull();
  for (const state of ['queued', 'playing', 'failed-receipt']) {
    const f = concernSpeech();
    ready(f);
    f.chunk();
    await f.end();
    f.coordinator.drainSpeechOutput();
    if (state === 'playing') expect(fixedReceipt(f, 'started', 0).ok).toBe(true);
    if (state === 'failed-receipt') expect(fixedReceipt(f, 'failed', 0).ok).toBe(true);
    else {
      f.advance(6000);
      expect(f.coordinator.sweepSpeech()).toBe(true);
    }
    expect(f.coordinator.snapshot()?.phase).toBe('paused');
    expect(f.coordinator.snapshot()?.captureGrant).toBeNull();
    expect(f.coordinator.speechOutputInfo()).toBeNull();
    expect(f.output.every((x) => x === 0)).toBe(true);
  }
});
