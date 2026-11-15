import { expect, test } from 'bun:test';
import {
  ok,
  type SessionCommand,
  type Result,
  type ConversationTextResult,
} from '@lemmi/contracts';
import { caregiverProfile } from '@lemmi/contracts/fixtures';
import { publicPhotoStoryPack } from '@lemmi/activities';
import { SessionCoordinator, type SpeechAdapters } from '@lemmi/server';

function value<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(result.error.message);
  return result.data;
}
function fixture(tts?: SpeechAdapters['tts'], language: 'en' | 'de' = 'en') {
  const spoken: string[] = [];
  let modelCalls = 0;
  const c = new SessionCoordinator(
    'live',
    {
      async complete() {
        modelCalls++;
        return ok({ text: 'Thank you for sharing.', language });
      },
    },
    {
      stt: {
        async transcribe() {
          return ok({ text: 'Beaches', language });
        },
      },
      tts: tts ?? {
        async synthesize(input) {
          spoken.push(input.text);
          return ok({
            pcm: new Uint8Array(882),
            sampleRate: 22050,
            channels: 1,
            encoding: 'pcm_s16le',
            language,
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
  );
  c.acceptPersistentProfile({
    ...caregiverProfile,
    language,
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
  const control = (action: SessionCommand['action'], commandId = crypto.randomUUID()) =>
    c.handle('session.command', {
      sessionId: c.snapshot()!.id,
      expectedGeneration: c.snapshot()!.generation,
      commandId,
      action,
    });
  const say = (text: string) =>
    c.submitText({
      sessionId: c.snapshot()!.id,
      expectedGeneration: c.snapshot()!.generation,
      commandId: crypto.randomUUID(),
      text,
      language,
    });
  const speechCommand = () => ({
    sessionId: c.snapshot()!.id,
    expectedGeneration: c.snapshot()!.generation,
    commandId: crypto.randomUUID(),
    language,
  });
  return { c, control, say, speechCommand, spoken, modelCalls: () => modelCalls };
}
function reply(result: Result<ConversationTextResult>) {
  const data = value(result);
  if (data.kind !== 'reply') throw new Error('Expected reply');
  return data.reply.text;
}

test('new teaching starts with an audible eligible menu; a spoken choice selects the reviewed topic', async () => {
  const f = fixture();
  const opening = reply(await f.say('Start Teach Lemmi'));
  expect(opening).toContain("Hi! We're playing Teach Lemmi.");
  expect(opening).toContain('gardening');
  expect(opening).toContain('beaches');
  expect(opening.match(/\?/g)).toHaveLength(1);
  expect(f.c.snapshot()?.teaching?.entityId).toBeNull();
  expect(f.c.snapshot()?.teaching?.choosingTopic).toBe(true);
  expect(f.c.snapshot()?.captureGrant).toBeNull();
  expect(reply(await f.say('Beaches'))).toContain('seaside');
  expect(f.c.snapshot()?.teaching?.entityId).toBe('topic:beaches');
  expect(f.c.snapshot()?.teaching?.choosingTopic).toBe(false);
  expect(f.modelCalls()).toBe(0);
});

test('visible choices reject hidden, unreviewed and stale selections; restarting does not undo refusal', async () => {
  const f = fixture();
  value(f.control({ type: 'teaching.start', offerChoices: true }));
  expect(f.control({ type: 'teaching.select', entityId: 'topic:private' }).ok).toBe(false);
  const old = f.c.snapshot()!;
  value(f.control({ type: 'teaching.select', entityId: 'topic:gardening' }));
  value(f.control({ type: 'teaching.not_sure' }));
  value(f.control({ type: 'teaching.finish' }));
  value(f.control({ type: 'teaching.start', offerChoices: true }));
  expect(f.c.snapshot()?.teaching?.choices?.map((choice) => choice.entityId)).not.toContain(
    'topic:gardening',
  );
  expect(f.c.snapshot()?.teaching?.prompt).not.toContain('gardening');
  expect(f.control({ type: 'teaching.select', entityId: 'topic:gardening' }).ok).toBe(false);
  expect(
    f.c.handle('session.command', {
      sessionId: old.id,
      expectedGeneration: old.generation,
      commandId: crypto.randomUUID(),
      action: { type: 'teaching.select', entityId: 'topic:beaches' },
    }).ok,
  ).toBe(false);
});

test('the menu is synthesized aloud and a recognized topic follows the same authoritative selection path', async () => {
  const f = fixture();
  value(f.control({ type: 'teaching.start', offerChoices: true }));
  value(await f.c.speakTeachingPrompt(f.speechCommand(), [22050]));
  expect(f.spoken[0]).toContain('gardening');
  expect(f.spoken[0]).toContain('beaches');
  const output = f.c.drainSpeechOutput()!;
  const receipt = {
    sessionId: f.c.snapshot()!.id,
    expectedGeneration: f.c.snapshot()!.generation,
    turnId: output.metadata.turnId,
    leaseId: output.metadata.leaseId,
    streamId: output.metadata.streamId,
  };
  value(f.c.playbackReceipt({ ...receipt, status: 'started', playedChunks: 0 }));
  value(
    f.c.playbackReceipt({
      ...receipt,
      status: 'completed',
      playedChunks: output.metadata.chunkCount,
    }),
  );
  value(f.control({ type: 'mute', muted: false }));
  const listening = value(f.c.requestCapture(f.speechCommand(), [22050]));
  const grant = listening.captureGrant!;
  const stream = {
    sessionId: listening.id,
    expectedGeneration: listening.generation,
    turnId: grant.turnId,
    leaseId: grant.leaseId,
    streamId: grant.streamId,
  };
  value(
    f.c.acceptCaptureChunk({
      ...stream,
      chunkIndex: 0,
      encoding: 'pcm_s16le',
      data: Buffer.alloc(640).toString('base64'),
    }),
  );
  const response = value(await f.c.finishCapture({ ...stream, chunkCount: 1 }));
  expect(response.kind).toBe('reply');
  expect(f.c.snapshot()?.teaching?.entityId).toBe('topic:beaches');
  expect(f.c.snapshot()?.generation).toBeGreaterThan(listening.generation);
  expect(f.c.snapshot()?.captureGrant).toBeNull();
  expect(f.modelCalls()).toBe(0);
});

test('Quiet speaks the same eligible choices without adding a question', () => {
  const f = fixture();
  f.c.acceptPersistentProfile({
    ...caregiverProfile,
    communicationSupport: { preset: 'quiet', configVersion: 1 },
    privacyRevision: 0,
    policyRevision: 0,
    approvedFacts: [],
  });
  value(f.control({ type: 'stop' }));
  value(
    f.c.handle('session.start', {
      profileId: 'profile-alex',
      endpoint: 'browser',
      commandId: crypto.randomUUID(),
    }),
  );
  value(f.control({ type: 'teaching.start', offerChoices: true }));
  expect(f.c.snapshot()?.teaching?.prompt).toContain('gardening');
  expect(f.c.snapshot()?.teaching?.prompt).toContain('beaches');
  expect(f.c.snapshot()?.teaching?.prompt).not.toContain('?');
});

test('menu ambiguity does not select a topic or call the model, and Stop still bypasses the menu', async () => {
  const f = fixture();
  value(f.control({ type: 'teaching.start', offerChoices: true }));
  expect(reply(await f.say('She said "Beaches"'))).toContain('What would you like');
  expect(f.c.snapshot()?.teaching?.entityId).toBeNull();
  value(await f.say('Stop'));
  expect(f.c.snapshot()?.phase).toBe('ended');
  expect(f.modelCalls()).toBe(0);
});

test('a refusal of an offered topic removes it without speaking its invitation or calling the model', async () => {
  const f = fixture();
  value(f.control({ type: 'teaching.start', offerChoices: true }));
  const response = reply(await f.say("I don't want to talk about gardening"));
  expect(response).not.toContain('flowers');
  expect(f.c.snapshot()?.teaching?.choices?.map((choice) => choice.entityId)).not.toContain(
    'topic:gardening',
  );
  expect(f.c.snapshot()?.teaching?.entityId).not.toBe('topic:gardening');
  expect(f.modelCalls()).toBe(0);
});

test('no permitted topics offers finishing without inventing a subject', () => {
  const f = fixture();
  value(
    f.c.applyTeachingEligibility({
      profileId: 'profile-alex',
      sessionId: f.c.snapshot()!.id,
      policyRevision: 0,
      permittedEntityIds: [],
      sessionHiddenIds: [],
      available: true,
    }),
  );
  value(f.control({ type: 'resume' }));
  value(f.control({ type: 'teaching.start', offerChoices: true }));
  expect(f.c.snapshot()?.teaching?.choices).toEqual([]);
  expect(f.c.snapshot()?.teaching?.prompt).toContain('No eligible');
  value(f.control({ type: 'teaching.finish' }));
  expect(f.c.snapshot()?.phase).toBe('ready');
  expect(f.c.snapshot()?.captureGrant).toBeNull();
});

test('conversation greetings use fixed English/German speech with capture off and no model call', async () => {
  for (const language of ['en', 'de'] as const) {
    const f = fixture(undefined, language);
    const command = f.speechCommand();
    value(await f.c.speakSessionPrompt(command, [22050]));
    expect(f.spoken).toEqual([
      language === 'en'
        ? "Hi, I'm Lemmi. We can take our time."
        : 'Hallo, ich bin Lemmi. Wir können uns Zeit lassen.',
    ]);
    expect(f.c.snapshot()?.captureGrant).toBeNull();
    expect(f.modelCalls()).toBe(0);
    expect((await f.c.speakSessionPrompt(command, [22050])).ok).toBe(false);
    value(f.control({ type: 'stop' }));
  }
});

test('finishing while the spoken topic menu is being synthesized cancels it and wipes late PCM', async () => {
  let finish!: (result: any) => void;
  let signal!: AbortSignal;
  const f = fixture({
    synthesize(_input, canceled) {
      signal = canceled;
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
  });
  value(f.control({ type: 'teaching.start', offerChoices: true }));
  const pending = f.c.speakTeachingPrompt(f.speechCommand(), [22050]);
  await Bun.sleep(0);
  value(f.control({ type: 'teaching.finish' }));
  expect(signal.aborted).toBe(true);
  const pcm = new Uint8Array(882).fill(7);
  finish(ok({ pcm, sampleRate: 22050, channels: 1, encoding: 'pcm_s16le', language: 'en' }));
  expect((await pending).ok).toBe(false);
  await Bun.sleep(0);
  expect(pcm.every((byte) => byte === 0)).toBe(true);
  expect(f.c.speechOutputInfo()).toBeNull();
  expect(f.c.snapshot()?.phase).toBe('ready');
  expect(f.c.snapshot()?.captureGrant).toBeNull();
});

test('Photo Story announces its name and can finish during a pause without releasing that pause', async () => {
  const f = fixture();
  expect(reply(await f.say('Start Photo Story'))).toContain("Hi! We're playing Photo Story.");
  value(f.control({ type: 'pause' }));
  const photo = f.c.photoView()!;
  value(
    f.c.handle('activities.submit', {
      sessionId: f.c.snapshot()!.id,
      commandId: crypto.randomUUID(),
      instanceId: photo.instanceId,
      expectedRevision: photo.revision,
      action: { type: 'activity.leave' },
    }),
  );
  expect(f.c.photoView()?.phase).toBe('ended');
  expect(f.c.snapshot()?.phase).toBe('paused');
  expect(f.c.snapshot()?.captureGrant).toBeNull();
});

test('unselected teaching replies are bounded and Stop bypasses exhausted turn capacity', async () => {
  const f = fixture();
  value(f.control({ type: 'teaching.start', offerChoices: true }));
  for (let index = 0; index < 256; index++) value(await f.say(`A fictional story ${index}`));
  const exhausted = await f.say('Another fictional story');
  expect(exhausted.ok).toBe(false);
  if (!exhausted.ok) expect(exhausted.error.code).toBe('UNAVAILABLE');
  expect(f.c.snapshot()?.teaching?.entityId).toBeNull();
  expect(f.modelCalls()).toBe(0);
  value(await f.say('Stop'));
  expect(f.c.snapshot()?.phase).toBe('ended');
  expect(f.c.snapshot()?.captureGrant).toBeNull();
});
