import { test, expect } from 'bun:test';
import {
  SessionCoordinator,
  type ChatAdapter,
  type SttAdapter,
  type TtsAdapter,
} from '@lemmi/server';
import {
  SessionSnapshotSchema,
  ActivityViewSchema,
  PhotoStoryResultSchema,
  ok,
  fail,
  type PhotoStoryCommand,
} from '@lemmi/contracts';
import { photoStoryDemoPack } from '@lemmi/activities';
import { speechPcm } from '../apps/web/src/lib/speech-pcm';
import { createReviewedPhotoAdapter } from '@lemmi/server';

function setup(overrides: { chat?: ChatAdapter; stt?: SttAdapter; tts?: TtsAdapter } = {}) {
  const c = new SessionCoordinator(
    'live',
    overrides.chat ?? {
      async complete() {
        return ok({ text: 'What do you enjoy about roses?', language: 'en' });
      },
    },
    {
      pack: photoStoryDemoPack,
      chatMode: 'reviewed_demo',
      sttEnabled: true,
      ttsEnabled: true,
      speech: {
        stt: overrides.stt ?? {
          async transcribe() {
            return ok({ text: 'Roses', language: 'en' });
          },
        },
        tts: overrides.tts ?? {
          async synthesize() {
            return ok({
              pcm: new Uint8Array(320),
              sampleRate: 16000,
              encoding: 'pcm_s16le',
              channels: 1,
              language: 'en',
            });
          },
        },
      },
    },
  );
  const started = c.handle('session.start', {
    profileId: 'profile-alex',
    commandId: crypto.randomUUID(),
    endpoint: 'browser',
  });
  if (!started.ok) throw new Error('session');
  let session = SessionSnapshotSchema.parse(started.data);
  const a = c.handle('activities.start', {
    sessionId: session.id,
    commandId: crypto.randomUUID(),
    activityId: 'photo_album',
    packId: 'alex-photo-story-demo',
    packVersion: 1,
  });
  if (!a.ok) throw new Error('activity');
  let activity = ActivityViewSchema.parse(a.data);
  const action = (action: unknown) => {
    const r = c.handle('activities.submit', {
      sessionId: session.id,
      instanceId: activity.instanceId,
      commandId: crypto.randomUUID(),
      expectedRevision: activity.revision,
      action,
    });
    if (!r.ok) throw new Error(r.error.message);
    activity = ActivityViewSchema.parse(r.data);
    return activity;
  };
  action({ type: 'photo.talk' });
  const control = (action: unknown) => {
    const r = c.handle('session.command', {
      sessionId: session.id,
      commandId: crypto.randomUUID(),
      expectedGeneration: c.snapshot()!.generation,
      action,
    });
    if (!r.ok) throw new Error(r.error.message);
    session = SessionSnapshotSchema.parse(r.data);
    return session;
  };
  const command = (input: PhotoStoryCommand['input']): PhotoStoryCommand => ({
    sessionId: session.id,
    instanceId: activity.instanceId,
    commandId: crypto.randomUUID(),
    expectedGeneration: c.snapshot()!.generation,
    expectedRevision: activity.revision,
    input,
  });
  return { c, action, control, command };
}
test('photo opening and follow-up reuse chat with caption data; TTS repeats the authorized response', async () => {
  const inputs: string[] = [];
  const { c, command } = setup({
    chat: {
      async complete(input) {
        inputs.push(input.system);
        return ok({ text: 'What do you like about roses?', language: 'en' });
      },
    },
  });
  const opening = await c.photoStory(command({ type: 'opening' }));
  expect(opening.ok).toBe(true);
  if (!opening.ok || !opening.data.reply) throw new Error('reply');
  expect(inputs[0]).toContain('Roses and other flowers');
  expect(inputs[0]).toContain('image itself was not analyzed');
  const audio = await c.photoStory(
    command({ type: 'synthesize', turnId: opening.data.reply.turnId }),
  );
  expect(audio.ok).toBe(true);
  if (!audio.ok) throw new Error('audio');
  expect(PhotoStoryResultSchema.safeParse(audio.data).success).toBe(true);
  expect(audio.data.session.captureGrant).toBeNull();
  expect(audio.data.session.phase).toBe('speaking');
  await c.photoStory(command({ type: 'playback_end', turnId: opening.data.reply.turnId }));
  const repeat = await c.photoStory(command({ type: 'repeat' }));
  expect(repeat.ok).toBe(true);
  expect(inputs).toHaveLength(1);
});
test('voice requires explicit unmute and listening grant; completion returns capture off', async () => {
  const { c, control, command } = setup();
  expect(
    (await c.photoStory(command({ type: 'audio', captureTurnId: 'invented', pcmBase64: 'AAAA' })))
      .ok,
  ).toBe(false);
  control({ type: 'mute', muted: false });
  expect(c.snapshot()!.captureGrant).toBeNull();
  const granted = control({ type: 'speak' });
  expect(granted.phase).toBe('listening');
  const r = await c.photoStory(
    command({ type: 'audio', captureTurnId: granted.captureGrant!.turnId, pcmBase64: 'AAAAAA==' }),
  );
  expect(r.ok).toBe(true);
  expect(c.snapshot()!.phase).toBe('waiting');
  expect(c.snapshot()!.captureGrant).toBeNull();
});
test('empty transcript gives patient text without model generation', async () => {
  let calls = 0;
  const { c, control, command } = setup({
    stt: {
      async transcribe() {
        return ok({ text: '', language: 'en' });
      },
    },
    chat: {
      async complete() {
        calls++;
        return fail('UNAVAILABLE', 'unexpected');
      },
    },
  });
  control({ type: 'mute', muted: false });
  const s = control({ type: 'speak' });
  const r = await c.photoStory(
    command({ type: 'audio', captureTurnId: s.captureGrant!.turnId, pcmBase64: 'AAAAAA==' }),
  );
  expect(r.ok).toBe(true);
  expect(calls).toBe(0);
  if (r.ok) expect(r.data.notice).toContain('try again');
});
test('Stop during STT rejects its late transcript and prevents chat', async () => {
  let resolve!: (v: any) => void;
  let calls = 0;
  const { c, control, command } = setup({
    stt: {
      transcribe: () =>
        new Promise((r) => {
          resolve = r;
        }),
    },
    chat: {
      async complete() {
        calls++;
        return fail('UNAVAILABLE', 'unexpected');
      },
    },
  });
  control({ type: 'mute', muted: false });
  const s = control({ type: 'speak' });
  const pending = c.photoStory(
    command({ type: 'audio', captureTurnId: s.captureGrant!.turnId, pcmBase64: 'AAAAAA==' }),
  );
  control({ type: 'stop' });
  resolve(ok({ text: 'Roses', language: 'en' }));
  expect((await pending).ok).toBe(false);
  expect(calls).toBe(0);
  expect(c.snapshot()!.phase).toBe('ended');
});
test('Next cancels pending TTS and invalidates repeat against the old photo', async () => {
  let resolve!: (v: any) => void;
  const { c, action, command } = setup({
    tts: {
      synthesize: () =>
        new Promise((r) => {
          resolve = r;
        }),
    },
  });
  const opening = await c.photoStory(command({ type: 'opening' }));
  if (!opening.ok || !opening.data.reply) throw new Error('reply');
  const pending = c.photoStory(command({ type: 'synthesize', turnId: opening.data.reply.turnId }));
  action({ type: 'photo.next' });
  resolve(
    ok({
      pcm: new Uint8Array(320),
      sampleRate: 16000,
      encoding: 'pcm_s16le',
      channels: 1,
      language: 'en',
    }),
  );
  expect((await pending).ok).toBe(false);
  expect((await c.photoStory(command({ type: 'repeat' }))).ok).toBe(false);
});
test('mute cancels recognition without leaving the session processing', async () => {
  let resolve!: (v: any) => void;
  const { c, control, command } = setup({
    stt: {
      transcribe: () =>
        new Promise((r) => {
          resolve = r;
        }),
    },
  });
  control({ type: 'mute', muted: false });
  const s = control({ type: 'speak' });
  const pending = c.photoStory(
    command({ type: 'audio', captureTurnId: s.captureGrant!.turnId, pcmBase64: 'AAAAAA==' }),
  );
  control({ type: 'mute', muted: true });
  resolve(ok({ text: 'Roses', language: 'en' }));
  expect((await pending).ok).toBe(false);
  expect(c.snapshot()!.phase).toBe('waiting');
});
test('model/service failures stay explicit; duplicate speech commands cannot replay', async () => {
  const { c, command } = setup({
    chat: {
      async complete() {
        return fail('UNAVAILABLE', 'fixture outage');
      },
    },
  });
  expect(await c.photoStory(command({ type: 'opening' }))).toEqual(
    fail('UNAVAILABLE', 'fixture outage'),
  );
  const ready = setup();
  const op = await ready.c.photoStory(ready.command({ type: 'opening' }));
  if (!op.ok || !op.data.reply) throw new Error('reply');
  const cmd = ready.command({ type: 'synthesize', turnId: op.data.reply.turnId });
  expect((await ready.c.photoStory(cmd)).ok).toBe(true);
  expect((await ready.c.photoStory(cmd)).ok).toBe(false);
});
test('microphone PCM conversion respects real sample rate, clips and bounds captured media', () => {
  const bytes = speechPcm([new Float32Array([1, -1, 0.5, -0.5])], 16000);
  const view = new DataView(bytes.buffer);
  expect(view.getInt16(0, true)).toBe(32767);
  expect(view.getInt16(2, true)).toBe(-32768);
  expect(speechPcm([new Float32Array(48000)], 48000).length).toBe(32000);
  expect(() => speechPcm([new Float32Array(320001)], 16000)).toThrow();
});
test('reviewed demo uses guided photo wording despite Quiet instructions being documented in the same prompt', async () => {
  const { c, command } = setup({ chat: createReviewedPhotoAdapter() });
  const result = await c.photoStory(command({ type: 'opening' }));
  expect(result.ok).toBe(true);
  if (!result.ok || !result.data.reply) throw new Error('reply');
  expect(result.data.reply.text).toContain('?');
});
test('participant words and model responses never enter persistence snapshots', async () => {
  const { c, command } = setup();
  expect((await c.photoStory(command({ type: 'text', text: 'Roses' }))).ok).toBe(true);
  expect(JSON.stringify(c.persistenceSnapshot())).not.toContain('Roses');
  expect(JSON.stringify(c.persistenceSnapshot())).not.toContain('What do you enjoy');
});
