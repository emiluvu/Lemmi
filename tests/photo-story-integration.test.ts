import { test, expect } from 'bun:test';
import { SessionCoordinator, type ChatAdapter, type SpeechAdapters } from '@lemmi/server';
import {
  ok,
  fail,
  type SessionSnapshot,
  type ActivityView,
  type Result,
  type Journal,
} from '@lemmi/contracts';
import {
  photoStoryDemoPack,
  photoEventRecap,
  alexProfileDetail,
  createActivity,
  reduceActivity,
  projectActivity,
} from '@lemmi/activities';
import { contextFor } from '@lemmi/contracts/fixtures';
import { reviewedPhotoDemo } from '../packages/server/src/adapters/photo-story-demo';

function value<T>(result: Result<unknown>): T {
  if (!result.ok) throw new Error(result.error.message);
  return result.data as T;
}
function setup(
  preset: 'conversational' | 'guided' | 'quiet' = 'guided',
  chat: ChatAdapter = reviewedPhotoDemo(),
  speech?: SpeechAdapters,
  available = ['photo-story-garden', 'photo-story-park'],
) {
  const c = new SessionCoordinator('live', chat, speech, Date.now, undefined, {
    localOnly: true,
    profileId: 'profile-alex',
    pack: photoStoryDemoPack,
    availableAssetIds: available,
  });
  c.acceptPersistentProfile({
    ...alexProfileDetail,
    communicationSupport: { preset, configVersion: 1 },
  });
  let s = value<SessionSnapshot>(
    c.handle('session.start', {
      profileId: 'profile-alex',
      endpoint: 'browser',
      commandId: crypto.randomUUID(),
    }),
  );
  let a = value<ActivityView>(
    c.handle('activities.start', {
      sessionId: s.id,
      commandId: crypto.randomUUID(),
      activityId: 'photo_album',
      packId: photoStoryDemoPack.id,
      packVersion: 1,
    }),
  );
  function action(type: 'photo.talk' | 'photo.skip' | 'photo.just_look') {
    a = value(
      c.handle('activities.submit', {
        sessionId: s.id,
        instanceId: a.instanceId,
        expectedRevision: a.revision,
        commandId: crypto.randomUUID(),
        action: { type },
      }),
    );
  }
  action('photo.talk');
  const command = (text: string, purpose?: 'photo_opening' | 'photo_repeat') => ({
    sessionId: s.id,
    expectedGeneration: c.snapshot()!.generation,
    commandId: crypto.randomUUID(),
    text,
    language: 'en' as const,
    ...(purpose ? { purpose } : {}),
  });
  return {
    c,
    s,
    action,
    command,
    get view() {
      return a;
    },
  };
}

test('same scene gives Conversational open questions, Guided yes/no and Quiet no question', async () => {
  for (const preset of ['conversational', 'guided', 'quiet'] as const) {
    const f = setup(preset);
    const result = value<any>(await f.c.submitText(f.command('Start', 'photo_opening')));
    expect(result.reply.text).toBe(
      preset === 'guided'
        ? 'Do you like flowers?'
        : preset === 'conversational'
          ? 'What do you enjoy about gardens?'
          : 'Flowers in a garden.',
    );
    expect(f.view.activityId).toBe('photo_album');
  }
});
test('uncertainty and repeated answers are valid, with no judgment or biography writes', async () => {
  const f = setup();
  for (const text of ["I don't know", "I'm not sure", 'Roses', 'Roses']) {
    const r = value<any>(await f.c.submitText(f.command(text)));
    expect(r.kind).toBe('reply');
    expect(r.reply.text).not.toMatch(/wrong|failed|remember|again!/i);
  }
  const journal = value<Journal>(f.c.handle('journal.load', { profileId: 'profile-alex' }));
  expect(JSON.stringify(journal)).not.toContain('Roses');
  expect(JSON.stringify(journal)).not.toContain("don't know");
});
test('skip is idempotent and factual, missing media does not produce an invented response', async () => {
  const f = setup();
  const command = {
    sessionId: f.s.id,
    instanceId: f.view.instanceId,
    expectedRevision: f.view.revision,
    commandId: 'skip-once',
    action: { type: 'photo.skip' },
  };
  expect(f.c.handle('activities.submit', command).ok).toBe(true);
  expect(f.c.handle('activities.submit', command).ok).toBe(true);
  const journal = value<Journal>(f.c.handle('journal.load', { profileId: 'profile-alex' }));
  const recap = photoEventRecap(journal, f.s.id);
  expect(recap.skippedPhotoIds).toEqual(['garden-demo']);
  expect(recap.spokenContentIncluded).toBe(false);
  const missing = setup('guided', reviewedPhotoDemo(), undefined, []);
  expect((await missing.c.submitText(missing.command('Start', 'photo_opening'))).ok).toBe(false);
});
test('voice next and end-game route without asking a model to choose an action', async () => {
  let calls = 0;
  const f = setup('guided', {
    async complete() {
      calls++;
      return ok({ text: 'Do you like flowers?', language: 'en' });
    },
  });
  await f.c.submitText(f.command('next photo'));
  expect(calls).toBe(1);
  const journal = value<Journal>(f.c.handle('journal.load', { profileId: 'profile-alex' }));
  expect(photoEventRecap(journal, f.s.id).skippedPhotoIds).toEqual(['garden-demo']);
  const result = value<any>(await f.c.submitText(f.command('end game')));
  expect(result.kind).toBe('control');
  expect(f.c.snapshot()?.phase).toBe('ended');
  expect(calls).toBe(1);
});
test('photo change, pause, and stop suppress an adapter result that ignores cancellation', async () => {
  for (const interrupt of ['skip', 'pause', 'stop']) {
    let finish!: (v: any) => void;
    const started = Promise.withResolvers<void>();
    const f = setup('guided', {
      complete() {
        started.resolve();
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
    });
    const turn = f.c.submitText(f.command('Roses'));
    await started.promise;
    if (interrupt === 'skip') f.action('photo.skip');
    else
      f.c.handle('session.command', {
        sessionId: f.s.id,
        expectedGeneration: f.c.snapshot()!.generation,
        commandId: crypto.randomUUID(),
        action: { type: interrupt },
      });
    finish(ok({ text: 'Late private reply.', language: 'en' }));
    expect((await turn).ok).toBe(false);
    expect(f.c.speechOutputInfo()).toBeNull();
  }
});
test('missing descriptions retain just-look; unavailable providers leave factual events intact', async () => {
  const pack = structuredClone(photoStoryDemoPack);
  if (pack.activityId !== 'photo_album') throw new Error();
  pack.entries[0]!.caption = null;
  pack.entries[0]!.discussionContext = null;
  const ctx = contextFor('s'),
    state = createActivity({ instanceId: 'a' }, pack, ctx);
  expect(() => reduceActivity(state, { type: 'photo.talk' }, pack, ctx)).toThrow();
  expect(projectActivity(state, pack, ctx).assetIds.length).toBe(1);
  const f = setup('guided', {
    async complete() {
      return fail('UNAVAILABLE', 'Provider down');
    },
  });
  expect((await f.c.submitText(f.command('Hello'))).ok).toBe(false);
  f.action('photo.skip');
  const journal = value<Journal>(f.c.handle('journal.load', { profileId: 'profile-alex' }));
  expect(photoEventRecap(journal, f.s.id).skippedPhotoIds).toHaveLength(1);
  expect(() =>
    photoEventRecap(
      {
        ...journal,
        sessions: [
          {
            sessionId: f.s.id,
            events: [
              { type: 'photo_skipped', itemId: 'x', source: 'participant_statement' } as any,
            ],
            summary: null,
          },
        ],
      },
      f.s.id,
    ),
  ).toThrow();
});
test('shared SpeechTurns performs STT, generation, TTS and receipt-backed output; unclear speech stays retryable', async () => {
  let sttText = 'Roses',
    synthesized = '';
  const speech: SpeechAdapters = {
    stt: {
      async transcribe() {
        return ok({ text: sttText, language: 'en' });
      },
    },
    tts: {
      async synthesize(input) {
        synthesized = input.text;
        return ok({
          pcm: new Uint8Array(1280),
          sampleRate: 16000,
          channels: 1,
          encoding: 'pcm_s16le',
          language: 'en',
        });
      },
    },
  };
  const f = setup('guided', reviewedPhotoDemo(), speech);
  const s = value<SessionSnapshot>(
    f.c.handle('session.command', {
      sessionId: f.s.id,
      expectedGeneration: f.c.snapshot()!.generation,
      commandId: 'unmute',
      action: { type: 'mute', muted: false },
    }),
  );
  const capture = value<SessionSnapshot>(
    f.c.requestCapture(
      { sessionId: s.id, expectedGeneration: s.generation, commandId: 'capture', language: 'en' },
      [16000],
    ),
  );
  const grant = capture.captureGrant!;
  const stream = {
    sessionId: s.id,
    expectedGeneration: s.generation,
    turnId: grant.turnId,
    leaseId: grant.leaseId,
    streamId: grant.streamId,
  };
  expect(
    f.c.acceptCaptureChunk({
      ...stream,
      chunkIndex: 0,
      encoding: 'pcm_s16le',
      data: Buffer.alloc(640).toString('base64'),
    }).ok,
  ).toBe(true);
  expect((await f.c.finishCapture({ ...stream, chunkCount: 1 })).ok).toBe(true);
  expect(synthesized).toContain('roses');
  const output = f.c.drainSpeechOutput()!;
  expect(output.chunks.length).toBe(2);
  const receipt = {
    sessionId: s.id,
    expectedGeneration: s.generation,
    turnId: output.metadata.turnId,
    leaseId: output.metadata.leaseId,
    streamId: output.metadata.streamId,
  };
  expect(f.c.playbackReceipt({ ...receipt, status: 'started', playedChunks: 0 }).ok).toBe(true);
  expect(f.c.playbackReceipt({ ...receipt, status: 'completed', playedChunks: 2 }).ok).toBe(true);
  expect(f.c.snapshot()?.captureGrant).toBeNull();
  sttText = '';
  const next = value<SessionSnapshot>(
    f.c.requestCapture(
      { sessionId: s.id, expectedGeneration: s.generation, commandId: 'unclear', language: 'en' },
      [16000],
    ),
  ).captureGrant!;
  const second = { ...stream, turnId: next.turnId, streamId: next.streamId };
  f.c.acceptCaptureChunk({
    ...second,
    chunkIndex: 0,
    encoding: 'pcm_s16le',
    data: Buffer.alloc(640).toString('base64'),
  });
  expect((await f.c.finishCapture({ ...second, chunkCount: 1 })).ok).toBe(false);
  expect(f.c.snapshot()?.captureGrant).toBeNull();
});
test('TTS failure preserves current text, Repeat reuses the current question without a model call', async () => {
  const speech: SpeechAdapters = {
    stt: {
      async transcribe() {
        return fail('UNAVAILABLE', 'off');
      },
    },
    tts: {
      async synthesize() {
        return fail('UNAVAILABLE', 'off');
      },
    },
  };
  let calls = 0;
  const f = setup(
    'guided',
    {
      async complete() {
        calls++;
        return ok({ text: 'Do you like flowers?', language: 'en' });
      },
    },
    speech,
  );
  const first = value<any>(await f.c.speakText(f.command('Start', 'photo_opening')));
  expect(first.reply.text).toBe('Do you like flowers?');
  expect(f.c.speechOutputInfo()).toBeNull();
  const again = value<any>(await f.c.speakText(f.command('Repeat', 'photo_repeat')));
  expect(again.reply.text).toBe(first.reply.text);
  expect(calls).toBe(1);
});

test('photo rehearsal never enables private operations or activity hosting in the production coordinator', async () => {
  const c = new SessionCoordinator('live', reviewedPhotoDemo());
  const session = value<SessionSnapshot>(
    c.handle('session.start', {
      profileId: 'profile-alex',
      endpoint: 'browser',
      commandId: crypto.randomUUID(),
    }),
  );
  for (const [operation, input] of [
    ['profile.loadCaregiver', { profileId: 'profile-alex' }],
    ['journal.load', { profileId: 'profile-alex' }],
    ['photoStory.status', {}],
    [
      'activities.start',
      {
        sessionId: session.id,
        commandId: crypto.randomUUID(),
        activityId: 'photo_album',
        packId: photoStoryDemoPack.id,
        packVersion: 1,
      },
    ],
  ] as const) {
    const result = c.handle(operation, input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('UNAVAILABLE');
  }
  expect(
    (
      await c.speakText({
        sessionId: session.id,
        expectedGeneration: session.generation,
        commandId: crypto.randomUUID(),
        text: 'Open',
        language: 'en',
        purpose: 'photo_opening',
      })
    ).ok,
  ).toBe(false);
  expect(c.snapshot()?.phase).toBe('ready');
});

test('the Alex rehearsal pack cannot be used by a different fictional profile', async () => {
  let calls = 0;
  const c = new SessionCoordinator(
    'live',
    {
      async complete() {
        calls++;
        return ok({ text: 'Unused', language: 'en' });
      },
    },
    undefined,
    Date.now,
    undefined,
    {
      localOnly: true,
      profileId: 'profile-alex',
      pack: photoStoryDemoPack,
      availableAssetIds: ['photo-story-garden', 'photo-story-park'],
    },
  );
  c.acceptPersistentProfile({
    ...alexProfileDetail,
    id: 'profile-photo-other',
    preferredName: 'Other fictional profile',
    approvedFacts: [],
  });
  const session = value<SessionSnapshot>(
    c.handle('session.start', {
      profileId: 'profile-photo-other',
      endpoint: 'browser',
      commandId: crypto.randomUUID(),
    }),
  );
  expect(
    c.handle('activities.start', {
      sessionId: session.id,
      commandId: crypto.randomUUID(),
      activityId: 'photo_album',
      packId: photoStoryDemoPack.id,
      packVersion: 1,
    }).ok,
  ).toBe(false);
  expect(c.handle('photoStory.status', {}).ok).toBe(false);
  expect(
    (
      await c.speakText({
        sessionId: session.id,
        expectedGeneration: session.generation,
        commandId: crypto.randomUUID(),
        text: 'Open',
        language: 'en',
        purpose: 'photo_opening',
      })
    ).ok,
  ).toBe(false);
  expect(calls).toBe(0);
});

test('photo and teaching remain mutually exclusive and profile changes fence pending photo replies', async () => {
  const started = Promise.withResolvers<void>();
  let release!: (value: ReturnType<typeof ok<{ text: string; language: 'en' }>>) => void;
  const f = setup('guided', {
    complete: () => {
      started.resolve();
      return new Promise((resolve) => {
        release = resolve;
      });
    },
  });
  const attempt = f.c.handle('session.command', {
    sessionId: f.s.id,
    expectedGeneration: f.c.snapshot()!.generation,
    commandId: crypto.randomUUID(),
    action: { type: 'teaching.start' },
  });
  expect(attempt.ok).toBe(false);
  const pending = f.c.submitText(f.command('A fictional garden answer'));
  await started.promise;
  const resumeConfiguration = f.c.beginProfileUpdate({ approvedFacts: [] });
  f.c.acceptPersistentProfile({ ...alexProfileDetail, revision: 1, approvedFacts: [] });
  release(ok({ text: 'A late photo reply', language: 'en' }));
  expect((await pending).ok).toBe(false);
  resumeConfiguration();
  expect(f.c.snapshot()?.phase).toBe('paused');
  expect(
    f.c
      .persistenceSnapshot()!
      .events.every((event) => !JSON.stringify(event).includes('fictional garden answer')),
  ).toBe(true);
});
