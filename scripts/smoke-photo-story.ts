import { SessionCoordinator, localSpeechConfig, createLocalSpeechAdapters } from '@lemmi/server';
import { photoStoryDemoPack, alexProfileDetail } from '@lemmi/activities';
import { reviewedPhotoDemo } from '../packages/server/src/adapters/photo-story-demo';
import { captureFixture } from './speech-fixture';
import type { Result, SessionSnapshot, ActivityView } from '@lemmi/contracts';
const data = <T>(v: Result<unknown>): T => {
  if (!v.ok) throw new Error(v.error.code);
  return v.data as T;
};
const config = localSpeechConfig();
if (!config.ok || config.data.sttBackend === 'disabled' || config.data.ttsBackend === 'disabled')
  throw new Error('Real speech configuration required');
const adapters = createLocalSpeechAdapters(config.data);
const c = new SessionCoordinator('live', reviewedPhotoDemo(), adapters, Date.now, undefined, {
  localOnly: true,
  profileId: 'profile-alex',
  pack: photoStoryDemoPack,
  availableAssetIds: ['photo-story-garden', 'photo-story-park'],
});
c.acceptPersistentProfile(alexProfileDetail);
const s = data<SessionSnapshot>(
  c.handle('session.start', {
    profileId: 'profile-alex',
    endpoint: 'browser',
    commandId: crypto.randomUUID(),
  }),
);
const a = data<ActivityView>(
  c.handle('activities.start', {
    sessionId: s.id,
    commandId: crypto.randomUUID(),
    activityId: 'photo_album',
    packId: photoStoryDemoPack.id,
    packVersion: 1,
  }),
);
data(
  c.handle('activities.submit', {
    sessionId: s.id,
    instanceId: a.instanceId,
    expectedRevision: a.revision,
    commandId: crypto.randomUUID(),
    action: { type: 'photo.talk' },
  }),
);
const scope = () => ({ sessionId: s.id, expectedGeneration: c.snapshot()!.generation });
function drain() {
  let metadata = c.speechOutputInfo();
  if (!metadata) throw new Error('No real TTS output');
  let played = 0;
  while (true) {
    const out = c.drainSpeechOutput();
    if (!out) throw new Error('Output expired');
    const receipt = {
      ...scope(),
      turnId: metadata.turnId,
      leaseId: metadata.leaseId,
      streamId: metadata.streamId,
    };
    if (!played) data(c.playbackReceipt({ ...receipt, status: 'started', playedChunks: 0 }));
    played += out.chunks.length;
    data(
      c.playbackReceipt({
        ...receipt,
        status: played === metadata.chunkCount ? 'completed' : 'progress',
        playedChunks: played,
      }),
    );
    if (played === metadata.chunkCount) break;
  }
}
data(
  await c.speakText({
    ...scope(),
    commandId: crypto.randomUUID(),
    text: 'Photo Story',
    language: 'en',
    purpose: 'photo_opening',
  }),
);
drain();
const synthetic = data<
  Awaited<ReturnType<typeof adapters.tts.synthesize>> extends Result<infer T> ? T : never
>(
  await adapters.tts.synthesize(
    { text: 'I like roses in the garden.', language: 'en' },
    AbortSignal.timeout(20000),
  ),
);
const pcm = captureFixture(synthetic, 500);
synthetic.pcm.fill(0);
data(
  c.handle('session.command', {
    ...scope(),
    commandId: crypto.randomUUID(),
    action: { type: 'mute', muted: false },
  }),
);
const grant = data<SessionSnapshot>(
  c.requestCapture(
    { ...scope(), commandId: crypto.randomUUID(), language: 'en' },
    [16000, 22050, 24000, 44100, 48000],
  ),
).captureGrant!;
const stream = {
  ...scope(),
  turnId: grant.turnId,
  leaseId: grant.leaseId,
  streamId: grant.streamId,
};
for (let offset = 0; offset < pcm.length; offset += 640) {
  data(
    c.acceptCaptureChunk({
      ...stream,
      chunkIndex: offset / 640,
      encoding: 'pcm_s16le',
      data: Buffer.from(pcm.subarray(offset, offset + 640)).toString('base64'),
    }),
  );
  await Bun.sleep(20);
}
data(await c.finishCapture({ ...stream, chunkCount: pcm.length / 640 }));
pcm.fill(0);
drain();
data(
  c.handle('session.command', {
    ...scope(),
    commandId: crypto.randomUUID(),
    action: { type: 'stop' },
  }),
);
console.info(
  'PASS: Photo Story opening and answer used real local STT/TTS, shared speech ownership and playback receipts; chat was the explicit reviewed fixture. No audio/transcript saved.',
);
