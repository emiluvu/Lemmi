// Real local-model check with a fixed fictional phrase. No microphone, files or transcript logs.
import {
  localSpeechConfig,
  createLocalSpeechAdapters,
} from '../packages/server/src/adapters/local-speech';
import { PCM_MAX_BYTES } from '../packages/server/src/adapters/types';
const configResult = localSpeechConfig();
if (!configResult.ok) throw new Error(configResult.error.message);
const config = configResult.data;
if (config.sttBackend !== 'local-http' || config.ttsBackend !== 'local-http')
  throw new Error('Enable both local adapters for this smoke check');
const signal = AbortSignal.timeout(20000);
const health = await fetch(new URL('/health', config.sttUrl), {
  headers: { authorization: `Bearer ${config.token}` },
  redirect: 'error',
  signal,
});
if (!health.ok) throw new Error('Local speech is not ready');
const capabilities = (await health.json()) as any;
if (!capabilities.data?.tts?.languages?.includes('en'))
  throw new Error('English voice is not ready');
const { stt, tts } = createLocalSpeechAdapters(config);
const started = performance.now();
const spoken = await tts.synthesize(
  { text: 'Hello. The garden is quiet today.', language: 'en' },
  signal,
);
if (!spoken.ok) throw new Error(spoken.error.message);
const synthesized = performance.now();
// Test-only in-memory linear resampling. Device adapters must negotiate their real format.
const input = spoken.data;
const source = new DataView(input.pcm.buffer, input.pcm.byteOffset, input.pcm.byteLength);
const count = Math.floor(((input.pcm.byteLength / 2) * 16000) / input.sampleRate);
if (count * 2 > PCM_MAX_BYTES) throw new Error('Generated fixture exceeds input-turn bounds');
const pcm = new Uint8Array(count * 2);
const destination = new DataView(pcm.buffer);
for (let i = 0; i < count; i++) {
  const at = (i * input.sampleRate) / 16000;
  const lo = Math.min(Math.floor(at), input.pcm.length / 2 - 1);
  const hi = Math.min(lo + 1, input.pcm.length / 2 - 1);
  const sample =
    source.getInt16(lo * 2, true) * (1 - (at - lo)) + source.getInt16(hi * 2, true) * (at - lo);
  destination.setInt16(i * 2, Math.round(sample), true);
}
try {
  const transcript = await stt.transcribe({ pcm, language: 'en' }, signal);
  if (!transcript.ok) throw new Error(transcript.error.message);
  if (transcript.data.language !== 'en' || !/\bgarden\b/i.test(transcript.data.text))
    throw new Error('English synthetic fixture was not recognized; inspect quality privately');
  const finished = performance.now();
  console.info(
    JSON.stringify({
      result: 'PASS',
      test: 'local CPU English TTS → in-memory resampling → local STT',
      ttsMs: Math.round(synthesized - started),
      sttMs: Math.round(finished - synthesized),
      sourceSampleRate: input.sampleRate,
      inputBytes: pcm.length,
      rawAudioSaved: false,
      transcriptLogged: false,
      microphoneOrRobotTested: false,
    }),
  );
} finally {
  pcm.fill(0);
  input.pcm.fill(0);
}
