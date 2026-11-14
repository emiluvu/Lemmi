// Actual loopback app → single coordinator → local STT/TTS. Synthetic text only; no saved audio.
import {
  createClients,
  createHttpTransport,
  type Result,
  type PhotoStoryCommand,
} from '@lemmi/contracts';
import { localSpeechConfig, createLocalSpeechAdapters } from '@lemmi/server';
import { speechPcm } from '../apps/web/src/lib/speech-pcm';
const clients = createClients(
  createHttpTransport('mock', (url, init) =>
    fetch(new URL(String(url), 'http://127.0.0.1:5173'), init),
  ),
);
function data<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(result.error.message);
  return result.data;
}
const status = data(await clients.photoStory.status());
if (!status.enabled || !status.stt || !status.tts)
  throw new Error('Start the Photo Story demo with local speech enabled');
if (status.session && status.session.phase !== 'ended')
  throw new Error('Stop the existing demo session before smoke testing');
let session = data(
  await clients.session.start({
    profileId: 'profile-alex',
    commandId: crypto.randomUUID(),
    endpoint: 'browser',
  }),
);
let activity = data(
  await clients.activities.start({
    sessionId: session.id,
    commandId: crypto.randomUUID(),
    activityId: 'photo_album',
    packId: 'alex-photo-story-demo',
    packVersion: 1,
  }),
);
const turn = async (input: PhotoStoryCommand['input']) => {
  const value = data(
    await clients.photoStory.turn({
      sessionId: session.id,
      instanceId: activity.instanceId,
      expectedGeneration: session.generation,
      expectedRevision: activity.revision,
      commandId: crypto.randomUUID(),
      input,
    }),
  );
  session = value.session;
  return value;
};
try {
  activity = data(
    await clients.activities.submit({
      sessionId: session.id,
      instanceId: activity.instanceId,
      expectedRevision: activity.revision,
      commandId: crypto.randomUUID(),
      action: { type: 'photo.talk' },
    }),
  );
  const opening = await turn({ type: 'opening' });
  if (!opening.reply) throw new Error('Opening missing');
  const audio = await turn({ type: 'synthesize', turnId: opening.reply.turnId });
  if (!audio.audio) throw new Error('TTS audio missing');
  await turn({ type: 'playback_end', turnId: opening.reply.turnId });
  const cfg = localSpeechConfig();
  if (!cfg.ok) throw new Error('Speech config');
  const local = createLocalSpeechAdapters(cfg.data);
  const synthetic = data(
    await local.tts.synthesize(
      {
        text: 'Roses are beautiful flowers. I enjoy looking at roses in a garden.',
        language: 'en',
      },
      AbortSignal.timeout(20000),
    ),
  );
  const bytes = new DataView(
    synthetic.pcm.buffer,
    synthetic.pcm.byteOffset,
    synthetic.pcm.byteLength,
  );
  const floats = new Float32Array(synthetic.pcm.length / 2);
  for (let i = 0; i < floats.length; i++) floats[i] = bytes.getInt16(i * 2, true) / 32768;
  const pcm = speechPcm([floats], synthetic.sampleRate);
  floats.fill(0);
  synthetic.pcm.fill(0);
  session = data(
    await clients.session.command({
      sessionId: session.id,
      expectedGeneration: session.generation,
      commandId: crypto.randomUUID(),
      action: { type: 'mute', muted: false },
    }),
  );
  session = data(
    await clients.session.command({
      sessionId: session.id,
      expectedGeneration: session.generation,
      commandId: crypto.randomUUID(),
      action: { type: 'speak' },
    }),
  );
  const response = await turn({
    type: 'audio',
    captureTurnId: session.captureGrant!.turnId,
    pcmBase64: Buffer.from(pcm).toString('base64'),
  });
  pcm.fill(0);
  if (!response.reply) throw new Error('No response after synthetic speech');
  const repeated = await turn({ type: 'repeat' });
  if (!repeated.audio) throw new Error('Repeat audio missing');
  await turn({ type: 'playback_end', turnId: response.reply.turnId });
  console.info(
    JSON.stringify({
      result: 'PASS',
      path: 'SvelteKit → shared coordinator → local speech',
      chat: status.chat,
      sttReturnedUsableText: true,
      ttsReturnedPcm: true,
      repeat: true,
      imageAnalyzed: false,
      audioSaved: false,
      transcriptLogged: false,
      humanMicrophoneTested: false,
    }),
  );
} finally {
  session = data(await clients.session.get({ sessionId: session.id }));
  await clients.session.command({
    sessionId: session.id,
    expectedGeneration: session.generation,
    commandId: crypto.randomUUID(),
    action: { type: 'stop' },
  });
}
