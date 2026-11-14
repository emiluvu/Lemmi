import { expect, test } from 'bun:test';
import { ok, type CommunicationPreset, type ProfileDetail } from '@lemmi/contracts';
import { caregiverProfile } from '@lemmi/contracts/fixtures';
import { SessionCoordinator, type ChatAdapter, type SpeechAdapters } from '@lemmi/server';

const profile = (preset: CommunicationPreset = 'guided', revision = 0): ProfileDetail => ({
  ...caregiverProfile,
  revision,
  communicationSupport: { preset, configVersion: 1 },
  privacyRevision: 0,
  policyRevision: 0,
  approvedFacts: [],
});
const control = (c: SessionCoordinator, type: string, extra: Record<string, unknown> = {}) => {
  const snapshot = c.snapshot()!;
  return c.handle('session.command', {
    sessionId: snapshot.id,
    expectedGeneration: snapshot.generation,
    commandId: crypto.randomUUID(),
    action: { type, ...extra },
  });
};
const say = (c: SessionCoordinator, text: string) => {
  const snapshot = c.snapshot()!;
  return c.submitText({
    sessionId: snapshot.id,
    expectedGeneration: snapshot.generation,
    commandId: crypto.randomUUID(),
    text,
    language: 'en',
  });
};
function setup(chat?: ChatAdapter, tts?: SpeechAdapters['tts']) {
  const c = new SessionCoordinator(
    'live',
    chat ?? {
      async complete() {
        return ok({ text: 'Flowers can grow in a garden.', language: 'en' });
      },
    },
    {
      stt: {
        async transcribe() {
          return ok({ text: 'I cannot breathe', language: 'en' });
        },
      },
      tts: tts ?? {
        async synthesize() {
          return ok({
            pcm: new Uint8Array(882),
            sampleRate: 22050,
            channels: 1,
            encoding: 'pcm_s16le',
            language: 'en',
          });
        },
      },
    },
  );
  c.acceptPersistentProfile(profile());
  const started = c.handle('session.start', {
    profileId: 'profile-alex',
    endpoint: 'robot',
    commandId: crypto.randomUUID(),
  });
  if (!started.ok) throw new Error('Fixture session start failed');
  expect(control(c, 'teaching.start').ok).toBe(true);
  return c;
}
function delayedTts() {
  let entered!: () => void;
  const began = new Promise<void>((resolve) => {
    entered = resolve;
  });
  let finish!: (value: any) => void, signal!: AbortSignal;
  const tts: SpeechAdapters['tts'] = {
    synthesize(_input, canceled) {
      signal = canceled;
      entered();
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
  };
  return {
    tts,
    began,
    finish: () =>
      finish(
        ok({
          pcm: new Uint8Array(882),
          sampleRate: 22050,
          channels: 1,
          encoding: 'pcm_s16le',
          language: 'en',
        }),
      ),
    signal: () => signal,
  };
}
const speakPrompt = (c: SessionCoordinator) => {
  const snapshot = c.snapshot()!;
  return c.speakTeachingPrompt(
    {
      sessionId: snapshot.id,
      expectedGeneration: snapshot.generation,
      commandId: crypto.randomUUID(),
      language: 'en',
    },
    [22050],
  );
};
const saveFuture = (c: SessionCoordinator) => {
  c.pauseForProfileUpdate({ communicationSupport: { preset: 'quiet', configVersion: 1 } });
  c.acceptPersistentProfile(profile('quiet', 1), false);
};
const applySaved = (c: SessionCoordinator) => {
  const snapshot = c.snapshot()!;
  return c.applyCommunicationSupport(
    {
      profileId: 'profile-alex',
      expectedProfileRevision: 1,
      sessionId: snapshot.id,
      expectedGeneration: snapshot.generation,
      commandId: crypto.randomUUID(),
    },
    profile('quiet', 1),
    'fixture-caregiver',
  );
};

test('future support save preserves the teaching presentation and approved prompt synthesis', async () => {
  const delayed = delayedTts(),
    c = setup(undefined, delayed.tts);
  const pending = speakPrompt(c);
  await delayed.began;
  const before = c.snapshot()!;
  saveFuture(c);
  expect(c.snapshot()).toEqual(before);
  expect(delayed.signal().aborted).toBe(false);
  delayed.finish();
  expect((await pending).ok).toBe(true);
  expect(c.speechOutputInfo()).not.toBeNull();
  control(c, 'stop');
});

test('future support save preserves fixed concern synthesis while teaching remains paused', async () => {
  const delayed = delayedTts(),
    c = setup(undefined, delayed.tts);
  expect(control(c, 'mute', { muted: false }).ok).toBe(true);
  const snapshot = c.snapshot()!;
  expect(
    c.requestCapture(
      {
        sessionId: snapshot.id,
        expectedGeneration: snapshot.generation,
        commandId: crypto.randomUUID(),
        language: 'en',
      },
      [22050],
    ).ok,
  ).toBe(true);
  const capture = c.snapshot()!,
    grant = capture.captureGrant!;
  const scope = {
    sessionId: capture.id,
    expectedGeneration: capture.generation,
    turnId: grant.turnId,
    leaseId: grant.leaseId,
    streamId: grant.streamId,
  };
  expect(
    c.acceptCaptureChunk({
      ...scope,
      chunkIndex: 0,
      encoding: 'pcm_s16le',
      data: Buffer.alloc(640, 1).toString('base64'),
    }).ok,
  ).toBe(true);
  const pending = c.finishCapture({ ...scope, chunkCount: 1 });
  await delayed.began;
  const before = c.snapshot()!;
  expect(before.phase).toBe('paused');
  saveFuture(c);
  expect(c.snapshot()).toEqual(before);
  expect(delayed.signal().aborted).toBe(false);
  delayed.finish();
  expect((await pending).ok).toBe(true);
  expect(c.snapshot()?.phase).toBe('paused');
  expect(c.speechOutputInfo()).not.toBeNull();
  control(c, 'stop');
});

test('context changes cancel teaching prompt synthesis and cannot expose an old prompt after interests change', async () => {
  const delayed = delayedTts(),
    c = setup(undefined, delayed.tts);
  const pending = speakPrompt(c);
  await delayed.began;
  const before = c.snapshot()!;
  const release = c.beginProfileUpdate({ interests: [] });
  c.acceptPersistentProfile({ ...profile('guided', 1), interests: [] }, true);
  release();
  expect(delayed.signal().aborted).toBe(true);
  expect((await pending).ok).toBe(false);
  delayed.finish();
  expect(c.snapshot()).toMatchObject({
    phase: 'paused',
    generation: before.generation + 1,
    captureGrant: null,
  });
  expect(c.snapshot()?.teaching?.entityId).toBeNull();
  expect(c.snapshot()?.teaching?.prompt).toBeNull();
  expect(c.speechOutputInfo()).toBeNull();
});

test('context changes cancel a teaching model turn and clear participant text rather than adopting it as biography', async () => {
  let entered!: () => void, finish!: (value: any) => void, signal!: AbortSignal;
  const began = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const c = setup({
    complete(_input, canceled) {
      signal = canceled;
      entered();
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
  });
  const pending = say(c, 'private-teaching-turn-marker');
  await began;
  const release = c.beginProfileUpdate({ preferredName: 'Updated fictional name' });
  c.acceptPersistentProfile(
    { ...profile('guided', 1), preferredName: 'Updated fictional name' },
    true,
  );
  release();
  expect(signal.aborted).toBe(true);
  expect((await pending).ok).toBe(false);
  finish(ok({ text: 'Old private response', language: 'en' }));
  expect(c.snapshot()?.phase).toBe('paused');
  expect(c.snapshot()?.captureGrant).toBeNull();
  expect(JSON.stringify(c)).not.toContain('private-teaching-turn-marker');
  expect(JSON.stringify(c.persistenceSnapshot())).not.toContain('Old private response');
});

test('apply saved support cancels pending teaching synthesis and refreshes its prompt at the new paused generation', async () => {
  const delayed = delayedTts(),
    c = setup(undefined, delayed.tts);
  const pending = speakPrompt(c);
  await delayed.began;
  const before = c.snapshot()!;
  saveFuture(c);
  expect(applySaved(c).ok).toBe(true);
  expect(delayed.signal().aborted).toBe(true);
  expect((await pending).ok).toBe(false);
  delayed.finish();
  const after = c.snapshot()!;
  expect(after).toMatchObject({
    phase: 'paused',
    generation: before.generation + 1,
    communicationSupport: { preset: 'quiet' },
    captureGrant: null,
  });
  expect(after.teaching?.entityId).toBe(before.teaching?.entityId);
  expect(after.teaching?.presentationId).not.toBe(before.teaching?.presentationId);
  expect(after.teaching?.prompt).not.toContain('?');
  expect(c.speechOutputInfo()).toBeNull();
  expect(control(c, 'resume').ok).toBe(true);
  expect(c.snapshot()?.captureGrant).toBeNull();
});

test('apply saved support cancels a teaching model request before an old-style reply can be emitted', async () => {
  let entered!: () => void, finish!: (value: any) => void, signal!: AbortSignal;
  const began = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const c = setup({
    complete(_input, canceled) {
      signal = canceled;
      entered();
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
  });
  const pending = say(c, 'I grow flowers');
  await began;
  saveFuture(c);
  expect(applySaved(c).ok).toBe(true);
  expect(signal.aborted).toBe(true);
  expect((await pending).ok).toBe(false);
  finish(ok({ text: 'Would you tell me more about flowers?', language: 'en' }));
  expect(c.snapshot()).toMatchObject({
    phase: 'paused',
    communicationSupport: { preset: 'quiet' },
    captureGrant: null,
  });
  expect(c.speechOutputInfo()).toBeNull();
});

test('future support save retains current authoritative teaching eligibility at a nonzero policy revision', () => {
  const c = setup(),
    snapshot = c.snapshot()!;
  expect(
    c.applyTeachingEligibility({
      profileId: snapshot.profileId,
      sessionId: snapshot.id,
      policyRevision: 1,
      permittedEntityIds: ['topic:gardening', 'topic:beaches'],
      sessionHiddenIds: [],
      available: true,
    }).ok,
  ).toBe(true);
  expect(control(c, 'resume').ok).toBe(true);
  const before = c.snapshot()!;
  c.pauseForProfileUpdate({ communicationSupport: { preset: 'quiet', configVersion: 1 } });
  c.acceptPersistentProfile({ ...profile('quiet', 1), policyRevision: 1 }, false);
  expect(c.snapshot()).toEqual(before);
  expect(control(c, 'teaching.next').ok).toBe(true);
  expect(c.snapshot()?.teaching?.entityId).toBe('topic:beaches');
  expect(c.snapshot()?.communicationSupport.preset).toBe('guided');
});

test('a pending context save fences teaching controls and prompt synthesis while Finish and Stop remain available', async () => {
  const c = setup();
  const release = c.beginProfileUpdate({ interests: [] });
  for (const type of [
    'teaching.start',
    'teaching.next',
    'teaching.not_sure',
    'teaching.prefer',
    'teaching.avoid',
  ])
    expect(control(c, type).ok).toBe(false);
  expect((await speakPrompt(c)).ok).toBe(false);
  expect(control(c, 'teaching.finish').ok).toBe(true);
  expect(c.snapshot()?.captureGrant).toBeNull();
  expect(control(c, 'stop').ok).toBe(true);
  expect(c.snapshot()?.phase).toBe('ended');
  release();
});
