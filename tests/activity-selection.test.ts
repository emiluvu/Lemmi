import { expect, test } from 'bun:test';
import {
  ok,
  type ConversationTextResult,
  type Result,
  type SessionSnapshot,
} from '@lemmi/contracts';
import { caregiverProfile } from '@lemmi/contracts/fixtures';
import { publicPhotoStoryPack } from '@lemmi/activities';
import {
  SessionCoordinator,
  type SpeechAdapters,
  type ConversationDecisionAdapter,
} from '@lemmi/server';
import { requestedActivity } from '../packages/server/src/adapters/input-routing';

function value<T>(result: Result<unknown>): T {
  if (!result.ok) throw new Error(result.error.message);
  return result.data as T;
}
function fixture(
  voiceText = 'Start Teach Lemmi',
  tts?: SpeechAdapters['tts'],
  decisions?: ConversationDecisionAdapter,
) {
  let modelCalls = 0;
  const prompts: string[] = [];
  let recognizedText = voiceText;
  const c = new SessionCoordinator(
    'live',
    {
      async complete(input) {
        modelCalls++;
        prompts.push(input.system);
        return ok({ text: 'A garden has flowers.', language: 'en' });
      },
    },
    {
      stt: {
        async transcribe() {
          return ok({ text: recognizedText, language: 'en' });
        },
      },
      tts: tts ?? {
        async synthesize() {
          return ok({
            pcm: new Uint8Array(1280),
            sampleRate: 16000,
            channels: 1,
            encoding: 'pcm_s16le',
            language: 'en',
          });
        },
      },
    },
    Date.now,
    undefined,
    {
      publicDemo: true,
      profileId: 'profile-alex',
      pack: publicPhotoStoryPack,
      availableAssetIds: ['photo-story-garden', 'photo-story-park'],
    },
    decisions,
  );
  c.acceptPersistentProfile({
    ...caregiverProfile,
    privacyRevision: 0,
    policyRevision: 0,
    approvedFacts: [],
  });
  c.authorizePublicPhotoDemo(true);
  value(
    c.handle('session.start', {
      profileId: 'profile-alex',
      endpoint: 'browser',
      commandId: crypto.randomUUID(),
    }),
  );
  const say = (text: string, commandId: string = crypto.randomUUID()) => {
    const s = c.snapshot()!;
    return c.submitText({
      sessionId: s.id,
      expectedGeneration: s.generation,
      commandId,
      text,
      language: 'en',
    });
  };
  const capture = async () => {
    let s = c.snapshot()!;
    value(
      c.handle('session.command', {
        sessionId: s.id,
        expectedGeneration: s.generation,
        commandId: crypto.randomUUID(),
        action: { type: 'mute', muted: false },
      }),
    );
    s = c.snapshot()!;
    const listening = value<SessionSnapshot>(
      c.requestCapture(
        {
          sessionId: s.id,
          expectedGeneration: s.generation,
          commandId: crypto.randomUUID(),
          language: 'en',
        },
        [16000],
      ),
    );
    const grant = listening.captureGrant!;
    const stream = {
      sessionId: s.id,
      expectedGeneration: s.generation,
      turnId: grant.turnId,
      leaseId: grant.leaseId,
      streamId: grant.streamId,
    };
    value(
      c.acceptCaptureChunk({
        ...stream,
        chunkIndex: 0,
        encoding: 'pcm_s16le',
        data: Buffer.alloc(640).toString('base64'),
      }),
    );
    return c.finishCapture({ ...stream, chunkCount: 1 });
  };
  return {
    c,
    say,
    capture,
    calls: () => modelCalls,
    prompts,
    setRecognizedText: (text: string) => {
      recognizedText = text;
    },
  };
}

test('explicit mode commands have priority over optional decisions and remain idempotent', async () => {
  let classifications = 0;
  const f = fixture(undefined, undefined, {
    async classify() {
      classifications++;
      throw new Error('The model must not select an explicit command');
    },
  });
  const session = f.c.snapshot()!;
  const commandId = crypto.randomUUID();
  const command = {
    sessionId: session.id,
    expectedGeneration: session.generation,
    commandId,
    text: 'Start Photo Story',
    language: 'en',
  };
  expect((await f.c.submitText(command)).ok).toBe(true);
  const view = f.c.photoView();
  const generation = f.c.snapshot()!.generation;
  expect((await f.c.submitText(command)).ok).toBe(false);
  expect(f.c.photoView()).toEqual(view);
  expect(f.c.snapshot()!.generation).toBe(generation);
  expect(classifications).toBe(0);
  expect(f.calls()).toBe(0);
});

test('semantic activity classification stays advisory when no reviewed command was spoken', async () => {
  const f = fixture(undefined, undefined, {
    async classify() {
      return ok({
        recap: false,
        declinesRedirect: false,
        redirectTopicIds: [],
        activity: 'teach_lemmi',
      });
    },
  });
  expect((await f.say('Could I explain a little about the flowers?')).ok).toBe(true);
  expect(f.c.snapshot()?.teaching).toBeNull();
  expect(f.c.photoView()).toBeNull();
  expect(f.calls()).toBe(1);
  expect(f.prompts[0]).toContain('classification is advisory');
  expect(f.prompts[0]).toContain('Start Teach Lemmi');
});

test('valid maximum-length caller IDs cannot invalidate server-owned mode transitions', async () => {
  for (const phrase of ['Start Teach Lemmi', 'Start Photo Story']) {
    const f = fixture();
    expect((await f.say(phrase, 'x'.repeat(100))).ok).toBe(true);
    expect(f.c.snapshot()?.captureGrant).toBeNull();
    expect(f.c.snapshot()?.phase).toBe('ready');
  }
});

test('activity selection recognizes explicit invitations and leaves incidental/negative mentions alone', () => {
  expect(requestedActivity('Please start Photo Story.')).toBe('photo');
  expect(requestedActivity('Explore pictures')).toBe('photo');
  expect(requestedActivity('Can we play Teach Lemmi?')).toBe('teaching');
  for (const text of [
    'I used to play music',
    'Do not start Photo Story',
    'I want to stop',
    'What is a photo story?',
  ])
    expect(requestedActivity(text)).toBeNull();
});
test('spoken activity selection switches through the shared authority without model action selection', async () => {
  const f = fixture();
  expect(value<ConversationTextResult>(await f.say('Start Teach Lemmi')).kind).toBe('reply');
  expect(f.c.snapshot()?.teaching).not.toBeNull();
  await f.say('Explore pictures');
  expect(f.c.snapshot()?.teaching).toBeNull();
  expect(f.c.photoView()).toMatchObject({ activityId: 'photo_album', viewingMode: 'talk' });
  await f.say('Start Teach Lemmi');
  expect(f.c.photoView()?.phase).toBe('ended');
  expect(f.c.snapshot()?.teaching).not.toBeNull();
  expect(f.calls()).toBe(0);
  expect(f.c.snapshot()?.captureGrant).toBeNull();
});
test('unavailable games remain explicit and paused/stale selections cannot start an activity', async () => {
  const f = fixture();
  const reply = value<any>(await f.say('Play music'));
  expect(reply.reply.text).toContain('not available yet');
  expect(f.c.photoView()).toBeNull();
  const s = f.c.snapshot()!;
  value(
    f.c.handle('session.command', {
      sessionId: s.id,
      expectedGeneration: s.generation,
      commandId: crypto.randomUUID(),
      action: { type: 'pause' },
    }),
  );
  expect((await f.say('Start Teach Lemmi')).ok).toBe(false);
  expect(f.c.snapshot()?.teaching).toBeNull();
  expect(f.calls()).toBe(0);
});
for (const text of ['Let’s play Teach Lemmi', 'Start Photo Story', 'Explore pictures']) {
  test(`STT selection ${text} receives a fresh output turn with receipt-backed playback`, async () => {
    const f = fixture(text);
    const old = f.c.snapshot()!;
    const result = value<any>(await f.capture());
    expect(result.kind).toBe('reply');
    expect(result.session.generation).toBeGreaterThan(old.generation);
    const output = f.c.drainSpeechOutput()!;
    expect(output.chunks.length).toBe(2);
    expect(output.metadata.turnId).toBe(result.reply.turnId);
    const s = f.c.snapshot()!;
    const scope = {
      sessionId: s.id,
      expectedGeneration: s.generation,
      turnId: output.metadata.turnId,
      leaseId: output.metadata.leaseId,
      streamId: output.metadata.streamId,
    };
    expect(f.c.playbackReceipt({ ...scope, status: 'started', playedChunks: 0 }).ok).toBe(true);
    expect(f.c.playbackReceipt({ ...scope, status: 'completed', playedChunks: 2 }).ok).toBe(true);
    expect(f.c.snapshot()?.captureGrant).toBeNull();
    expect(f.calls()).toBe(0);
  });
}
test('Stop during activity selection TTS prevents late playback', async () => {
  let began!: () => void, finish!: (value: any) => void;
  const entered = new Promise<void>((resolve) => {
    began = resolve;
  });
  const f = fixture('Start Photo Story', {
    synthesize() {
      began();
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
  });
  const pending = f.capture();
  await entered;
  const s = f.c.snapshot()!;
  value(
    f.c.handle('session.command', {
      sessionId: s.id,
      expectedGeneration: s.generation,
      commandId: crypto.randomUUID(),
      action: { type: 'stop' },
    }),
  );
  finish(
    ok({
      pcm: new Uint8Array(1280),
      sampleRate: 16000,
      channels: 1,
      encoding: 'pcm_s16le',
      language: 'en',
    }),
  );
  expect((await pending).ok).toBe(false);
  expect(f.c.drainSpeechOutput()).toBeNull();
  expect(f.c.snapshot()?.phase).toBe('ended');
});

test('spoken finish returns to open conversation with fresh playback and without resuming capture', async () => {
  for (const [start, finish] of [
    ['Start Teach Lemmi', 'Finish teaching'],
    ['Start Photo Story', 'Finish Photo Story'],
  ] as const) {
    const f = fixture(finish);
    value(await f.say(start));
    const previous = f.c.snapshot()!;
    const result = value<any>(await f.capture());
    expect(result.reply.text).toBe('We can just talk. Take your time.');
    expect(result.session.generation).toBeGreaterThan(previous.generation);
    expect(f.c.snapshot()?.conversationMode).toBe('open');
    expect(f.c.snapshot()?.teaching).toBeNull();
    expect(f.c.photoView()?.phase ?? 'ended').toBe('ended');
    expect(f.c.drainSpeechOutput()?.metadata.turnId).toBe(result.reply.turnId);
    expect(f.c.snapshot()?.captureGrant).toBeNull();
    expect(f.calls()).toBe(0);
  }
});

test('just-look photo state still accepts voice selection for another mode', async () => {
  const f = fixture('Let us play Teach Lemmi');
  value(await f.say('Start Photo Story'));
  const photo = f.c.photoView()!;
  value(
    f.c.handle('activities.submit', {
      sessionId: f.c.snapshot()!.id,
      instanceId: photo.instanceId,
      expectedRevision: photo.revision,
      commandId: crypto.randomUUID(),
      action: { type: 'photo.just_look' },
    }),
  );
  expect(f.c.photoView()).toMatchObject({ viewingMode: 'just_look' });
  const result = value<any>(await f.capture());
  expect(result.session.conversationMode).toBe('teach_lemmi');
  expect(f.c.photoView()?.phase).toBe('ended');
  expect(f.calls()).toBe(0);
});

test('no eligible teaching topic cannot trap the participant away from voice mode selection', async () => {
  const f = fixture('Switch to Photo Story');
  f.c.acceptPersistentProfile({
    ...caregiverProfile,
    revision: 1,
    interests: [],
    privacyRevision: 0,
    policyRevision: 0,
    approvedFacts: [],
  });
  value(await f.say('Start Teach Lemmi'));
  expect(f.c.snapshot()?.teaching?.entityId).toBeNull();
  value(await f.capture());
  expect(f.c.snapshot()?.teaching).toBeNull();
  expect(f.c.photoView()).toMatchObject({ activityId: 'photo_album', viewingMode: 'talk' });
  expect(f.calls()).toBe(0);
});
