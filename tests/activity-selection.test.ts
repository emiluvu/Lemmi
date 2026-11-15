import { expect, test } from 'bun:test';
import {
  fail,
  ok,
  type CommunicationPreset,
  type ConversationTextResult,
  type Result,
  type SessionSnapshot,
} from '@lemmi/contracts';
import { caregiverProfile } from '@lemmi/contracts/fixtures';
import { publicPhotoStoryPack } from '@lemmi/activities';
import {
  SessionCoordinator,
  createOpenRouterDecisionAdapter,
  type SpeechAdapters,
  type ConversationDecisionAdapter,
} from '@lemmi/server';
import {
  confirmsActivityOffer,
  requestedActivity,
} from '../packages/server/src/adapters/input-routing';

function value<T>(result: Result<unknown>): T {
  if (!result.ok) throw new Error(result.error.message);
  return result.data as T;
}
function fixture(
  voiceText = 'Start Teach Lemmi',
  tts?: SpeechAdapters['tts'],
  decisions?: ConversationDecisionAdapter,
  preset: CommunicationPreset = caregiverProfile.communicationSupport.preset,
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
    communicationSupport: { preset, configVersion: 1 },
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

test('semantic activity request asks for confirmation, then uses the existing mode transition', async () => {
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
  const question = value<ConversationTextResult>(
    await f.say('Could I explain a little about the flowers?'),
  );
  expect(question.kind === 'reply' && question.reply.text).toBe(
    'Would you like to start Teach Lemmi?',
  );
  expect(f.c.snapshot()?.teaching).toBeNull();
  expect(f.c.photoView()).toBeNull();
  expect(f.calls()).toBe(0);
  value(await f.say('Yes please'));
  expect(f.c.snapshot()?.conversationMode).toBe('teach_lemmi');
  expect(f.c.snapshot()?.captureGrant).toBeNull();
  expect(f.calls()).toBe(0);
});

const noDecision = {
  recap: false,
  declinesRedirect: false,
  redirectTopicIds: [],
  activity: 'none' as const,
};

test('maximum accepted text stays intact through activity classification and a following short turn', async () => {
  const seen: { text: string; history: { role: string; content: string }[] }[] = [];
  const adapter = createOpenRouterDecisionAdapter(
    {
      apiKey: 'fixture-decision-key-only',
      model: 'typesafe/jev-1.14',
      threshold: 0.85,
      timeoutMs: 1000,
      scope: 'activities',
    },
    async (_url, init) => {
      const input = JSON.parse(init!.body as string).state;
      seen.push(input);
      return Response.json({
        answers: {
          activity: {
            type: 'choice',
            choice: 'none',
            confidence: 0.99,
            probabilities: {
              none: 0.99,
              music_playlist: 0.01,
              twenty_questions: 0,
              photo_album: 0,
              object_matching: 0,
              teach_lemmi: 0,
            },
          },
        },
      });
    },
  );
  const f = fixture(undefined, undefined, adapter);
  const text = 'A'.repeat(1000);
  expect((await f.say(text)).ok).toBe(true);
  expect((await f.say('The garden is quiet.')).ok).toBe(true);
  expect(seen).toHaveLength(2);
  expect(seen[0]?.text).toBe(text);
  expect(seen[1]?.history).toContainEqual({ role: 'user', content: text });
  expect(f.calls()).toBe(2);
  expect(f.c.snapshot()?.teaching).toBeNull();
  expect(f.c.snapshot()?.captureGrant).toBeNull();
  expect(JSON.stringify(f.c.persistenceSnapshot())).not.toContain(text);
  expect((await f.say('A'.repeat(1001))).ok).toBe(false);
  expect(seen).toHaveLength(2);
  expect((await f.say('Flowers.')).ok).toBe(true);
  expect(seen).toHaveLength(3);
});

for (const [activity, label] of [
  ['teach_lemmi', 'Teach Lemmi'],
  ['photo_album', 'Photo Story'],
] as const) {
  test(`Quiet semantic ${label} offer uses declarative speech and waits for explicit agreement`, async () => {
    const spoken: string[] = [];
    let classifications = 0;
    const f = fixture(
      'A natural activity request',
      {
        async synthesize(input) {
          spoken.push(input.text);
          return ok({
            pcm: new Uint8Array(1280),
            sampleRate: 16000,
            channels: 1,
            encoding: 'pcm_s16le',
            language: 'en',
          });
        },
      },
      {
        scope: 'activities',
        async classify() {
          classifications++;
          return ok({ ...noDecision, activity });
        },
      },
      'quiet',
    );
    const question = value<any>(await f.capture());
    expect(question.reply.text).toBe(`To start ${label}, say yes.`);
    expect(question.reply.text).not.toContain('?');
    expect(spoken).toEqual([question.reply.text]);
    expect(f.c.snapshot()?.teaching).toBeNull();
    expect(f.c.photoView()).toBeNull();
    const output = f.c.drainSpeechOutput()!;
    const session = f.c.snapshot()!;
    const receipt = {
      sessionId: session.id,
      expectedGeneration: session.generation,
      turnId: output.metadata.turnId,
      leaseId: output.metadata.leaseId,
      streamId: output.metadata.streamId,
    };
    value(f.c.playbackReceipt({ ...receipt, status: 'started', playedChunks: 0 }));
    value(
      f.c.playbackReceipt({ ...receipt, status: 'completed', playedChunks: output.chunks.length }),
    );
    expect(f.c.snapshot()?.phase).toBe('waiting');
    expect(f.c.snapshot()?.captureGrant).toBeNull();
    f.setRecognizedText('Yes please');
    value(await f.capture());
    expect(f.c.snapshot()?.conversationMode).toBe(
      activity === 'teach_lemmi' ? 'teach_lemmi' : 'open',
    );
    if (activity === 'photo_album') expect(f.c.photoView()?.activityId).toBe('photo_album');
    expect(f.c.snapshot()?.generation).toBeGreaterThan(session.generation);
    expect(f.c.snapshot()?.captureGrant).toBeNull();
    expect(classifications).toBe(1);
    expect(f.calls()).toBe(0);
  });
}
function semanticFixture(
  activity: 'teach_lemmi' | 'photo_album' = 'teach_lemmi',
  tts?: SpeechAdapters['tts'],
) {
  let calls = 0;
  const f = fixture('Yes please', tts, {
    async classify(input) {
      calls++;
      return ok({
        ...noDecision,
        activity: input.text === 'A natural activity request' ? activity : 'none',
      });
    },
  });
  return { ...f, classifications: () => calls };
}

test('semantic photo confirmation deduplicates the question and does not retain it in checkpoints', async () => {
  const f = semanticFixture('photo_album');
  const id = crypto.randomUUID();
  const question = value<any>(await f.say('A natural activity request', id));
  expect(question.reply.text).toBe('Would you like to start Photo Story?');
  expect(f.c.photoView()).toBeNull();
  expect(value<any>(await f.say('A natural activity request', id))).toEqual(question);
  expect(f.classifications()).toBe(1);
  expect(JSON.stringify(f.c.persistenceSnapshot())).not.toContain('A natural activity request');
  value(await f.say('Sure'));
  expect(f.c.photoView()).toMatchObject({ activityId: 'photo_album', viewingMode: 'talk' });
  expect(f.classifications()).toBe(1);
  expect(f.calls()).toBe(0);
});

test('an activity confirmation belongs only to the immediate next turn', async () => {
  for (const answer of ['No thank you', 'The sky is blue', 'Who are you?']) {
    const f = semanticFixture();
    value(await f.say('A natural activity request'));
    value(await f.say(answer));
    value(await f.say('Yes please'));
    expect(f.c.snapshot()?.teaching).toBeNull();
  }
  const f = semanticFixture();
  value(await f.say('Yes please'));
  expect(f.c.snapshot()?.teaching).toBeNull();
});

test('Pause, mute, Stop, disconnect and profile changes clear pending activity confirmation', async () => {
  for (const interrupt of ['pause', 'mute', 'stop', 'disconnect', 'profile']) {
    const f = semanticFixture();
    value(await f.say('A natural activity request'));
    const command = (action: Record<string, unknown>) =>
      value(
        f.c.handle('session.command', {
          sessionId: f.c.snapshot()!.id,
          expectedGeneration: f.c.snapshot()!.generation,
          commandId: crypto.randomUUID(),
          action,
        }),
      );
    if (interrupt === 'profile') {
      f.c.pauseForProfileUpdate({ preferredName: 'Alex' });
      f.c.acceptPersistentProfile({
        ...caregiverProfile,
        revision: 1,
        privacyRevision: 0,
        policyRevision: 0,
        approvedFacts: [],
      });
    } else if (interrupt === 'disconnect') f.c.disconnect();
    else command(interrupt === 'mute' ? { type: 'mute', muted: true } : { type: interrupt });
    if (f.c.snapshot()?.phase === 'ended')
      value(
        f.c.handle('session.start', {
          profileId: 'profile-alex',
          endpoint: 'browser',
          commandId: crypto.randomUUID(),
        }),
      );
    else if (f.c.snapshot()?.phase === 'paused') command({ type: 'resume' });
    value(await f.say('Yes please'));
    expect(f.c.snapshot()?.teaching).toBeNull();
  }
});

test('an interrupted semantic decision cannot install a late activity confirmation', async () => {
  for (const interrupt of ['pause', 'mute', 'stop', 'disconnect', 'profile']) {
    let finish!: (value: Result<any>) => void;
    let entered!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const f = fixture(undefined, undefined, {
      async classify(input) {
        if (input.text !== 'A natural activity request') return ok(noDecision);
        entered();
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
    });
    const pending = f.say('A natural activity request');
    await started;
    const command = (action: Record<string, unknown>) =>
      value(
        f.c.handle('session.command', {
          sessionId: f.c.snapshot()!.id,
          expectedGeneration: f.c.snapshot()!.generation,
          commandId: crypto.randomUUID(),
          action,
        }),
      );
    if (interrupt === 'profile') f.c.pauseForProfileUpdate({ preferredName: 'Alex' });
    else if (interrupt === 'disconnect') f.c.disconnect();
    else command(interrupt === 'mute' ? { type: 'mute', muted: true } : { type: interrupt });
    expect((await pending).ok).toBe(false);
    finish(ok({ ...noDecision, activity: 'teach_lemmi' }));
    await Bun.sleep(0);
    if (f.c.snapshot()?.phase === 'ended')
      value(
        f.c.handle('session.start', {
          profileId: 'profile-alex',
          endpoint: 'browser',
          commandId: crypto.randomUUID(),
        }),
      );
    else if (f.c.snapshot()?.phase === 'paused') command({ type: 'resume' });
    value(await f.say('Yes please'));
    expect(f.c.snapshot()?.teaching).toBeNull();
  }
});

test('semantic offer followed by spoken confirmation uses fresh receipt-backed playback', async () => {
  const f = semanticFixture();
  f.setRecognizedText('A natural activity request');
  const question = value<any>(await f.capture());
  expect(question.reply.text).toBe('Would you like to start Teach Lemmi?');
  const output = f.c.drainSpeechOutput()!;
  const s = f.c.snapshot()!;
  const scope = {
    sessionId: s.id,
    expectedGeneration: s.generation,
    turnId: output.metadata.turnId,
    leaseId: output.metadata.leaseId,
    streamId: output.metadata.streamId,
  };
  value(f.c.playbackReceipt({ ...scope, status: 'started', playedChunks: 0 }));
  value(f.c.playbackReceipt({ ...scope, status: 'completed', playedChunks: output.chunks.length }));
  f.setRecognizedText('Yes please');
  const result = value<any>(await f.capture());
  expect(result.session.conversationMode).toBe('teach_lemmi');
  expect(result.session.generation).toBeGreaterThan(s.generation);
  expect(f.c.drainSpeechOutput()?.metadata.turnId).toBe(result.reply.turnId);
  expect(f.c.snapshot()?.captureGrant).toBeNull();
  expect(f.classifications()).toBe(1);
  expect(f.calls()).toBe(0);
});

test('a failed spoken confirmation question clears the offer instead of launching on a later yes', async () => {
  const f = semanticFixture('teach_lemmi', {
    async synthesize() {
      return fail('UNAVAILABLE', 'Fixture unavailable');
    },
  });
  f.setRecognizedText('A natural activity request');
  expect((await f.capture()).ok).toBe(false);
  value(await f.say('Yes please'));
  expect(f.c.snapshot()?.teaching).toBeNull();
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
  for (const name of ['Lemmi', 'Lemmy', 'Lemme', 'Lemi']) {
    expect(requestedActivity(`Let's play Teach ${name}.`)).toBe('teaching');
    expect(requestedActivity(`Can we play the Teach ${name} game?`)).toBe('teaching');
    expect(requestedActivity(`Could we try Teach ${name}, please?`)).toBe('teaching');
  }
  for (const phrase of [
    'I want to teach Lemmi',
    'Can we teach Lemmi?',
    'Could I teach you?',
    'Please teach Lemmi',
    'Let’s teach Lemmi',
  ])
    expect(requestedActivity(phrase)).toBe('teaching');
  for (const phrase of [
    'Could we look at some pictures?',
    'I would like to look through photos',
    'Can you start Photo Story?',
  ])
    expect(requestedActivity(phrase)).toBe('photo');
  for (const text of [
    'I used to play music',
    'Do not start Photo Story',
    'I want to stop',
    'What is a photo story?',
    "Don't play Teach Lemmy",
    'I used to play the Teach Lemmy game',
    'She said "Let\'s play Teach Lemmy"',
    'Can we play Teach Lemmy or stop?',
    'I do not want to teach Lemmi',
    'She said "teach Lemmi"',
    'If I wanted to teach Lemmi tomorrow',
    'Can we teach Lemmi? Actually, no',
  ])
    expect(requestedActivity(text)).toBeNull();
});
test('activity confirmation accepts punctuated consent and rejects qualified or quoted agreement', () => {
  for (const text of ['Yes, please!', 'Yes please.', 'Sure', 'Let’s do that'])
    expect(confirmsActivityOffer(text)).toBe(true);
  for (const text of [
    'Yes, but not now',
    'No, thank you',
    'She said yes please',
    '"Yes please"',
    'Yes please, actually no',
  ])
    expect(confirmsActivityOffer(text)).toBe(false);
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
for (const text of [
  'Let’s play Teach Lemmi',
  "Let's play Teach Lemmy.",
  'Can we play the Teach Lemmy game?',
  'I want to teach Lemmi',
  'Can we teach Lemmi?',
  'Start Photo Story',
  'Explore pictures',
]) {
  test(`STT selection ${text} receives a fresh output turn with receipt-backed playback`, async () => {
    const f = fixture(text);
    const old = f.c.snapshot()!;
    const result = value<any>(await f.capture());
    expect(result.kind).toBe('reply');
    expect(f.c.snapshot()?.conversationMode).toBe(/teach/i.test(text) ? 'teach_lemmi' : 'open');
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
