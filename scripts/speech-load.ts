// Fixed fictional phrases and in-memory PCM only; no mic, model API, files or transcript logs.
import {
  createLocalSpeechAdapters,
  localSpeechConfig,
} from '../packages/server/src/adapters/local-speech';
import { captureFixture } from './speech-fixture';
import type { Result } from '@lemmi/contracts';

const selected = localSpeechConfig();
if (!selected.ok) throw new Error(selected.error.message);
if (selected.data.sttBackend !== 'local-http' || selected.data.ttsBackend !== 'local-http')
  throw new Error('Configure both local speech adapters for the load probe');
const adapters = createLocalSpeechAdapters(selected.data);
const levels = (process.env.LEMMI_SPEECH_LOAD_CONCURRENCY ?? '1,2,4').split(',').map(Number);
const rounds = Number(process.env.LEMMI_SPEECH_LOAD_ROUNDS ?? '3');
if (
  !levels.length ||
  levels.length > 8 ||
  levels.some((n) => !Number.isInteger(n) || n < 1 || n > 8) ||
  !Number.isInteger(rounds) ||
  rounds < 1 ||
  rounds > 10
)
  throw new Error('Load probe requires 1–8 concurrent jobs and 1–10 rounds');
const controller = new AbortController();
const stop = () => controller.abort();
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
const phrase = { text: 'Hello. The garden is quiet today.', language: 'en' as const };
let pcm: Uint8Array | undefined;
try {
  // Warm fixed-phrase synthesis independently. Cold-start/model load is measured at service startup.
  const fixture = await adapters.tts.synthesize(phrase, controller.signal);
  if (!fixture.ok) throw new Error('TTS fixture unavailable; no fallback used');
  try {
    pcm = captureFixture(fixture.data, 250);
  } finally {
    fixture.data.pcm.fill(0);
  }
  const warm = await adapters.stt.transcribe({ pcm, language: 'en' }, controller.signal);
  if (!warm.ok || !/\bgarden\b/i.test(warm.data.text))
    throw new Error('Fixed synthetic STT probe failed');

  // These direct adapter probes deliberately do not use gateway admission: excess service
  // capacity must reject explicitly. This measures engine service throughput, not user sessions.
  for (const concurrent of levels) {
    for (const mode of ['stt', 'tts', 'mixed'] as const) {
      const durations: number[] = [];
      let passed = 0,
        failed = 0;
      const began = performance.now();
      for (let round = 0; round < rounds; round++) {
        await Promise.all(
          Array.from({ length: concurrent }, async (_, index) => {
            const kind = mode === 'mixed' ? (index % 2 ? 'stt' : 'tts') : mode;
            const start = performance.now();
            let result: Result<unknown>;
            if (kind === 'stt') {
              const transcript = await adapters.stt.transcribe(
                { pcm: pcm!, language: 'en' },
                controller.signal,
              );
              result = transcript;
              if (transcript.ok && !/\bgarden\b/i.test(transcript.data.text)) {
                failed++;
                return;
              }
            } else {
              const speech = await adapters.tts.synthesize(phrase, controller.signal);
              result = speech;
              if (speech.ok) speech.data.pcm.fill(0);
            }
            if (result.ok) {
              passed++;
              durations.push(performance.now() - start);
            } else failed++;
          }),
        );
        controller.signal.throwIfAborted();
      }
      const wallMs = performance.now() - began;
      durations.sort((a, b) => a - b);
      const percentile = (p: number) =>
        durations.length ? Math.round(durations[Math.ceil(durations.length * p) - 1]!) : null;
      console.info(
        JSON.stringify({
          test: 'synthetic private speech load',
          mode,
          concurrent,
          rounds,
          passed,
          failed,
          p50Ms: percentile(0.5),
          p95Ms: percentile(0.95),
          wallMs: Math.round(wallMs),
          successfulJobsPerSecond: Math.round((passed * 10000) / wallMs) / 10,
          audioSaved: false,
          transcriptLogged: false,
          gatewayOrHardwareTested: false,
        }),
      );
    }
  }
} finally {
  pcm?.fill(0);
  controller.abort();
  process.off('SIGINT', stop);
  process.off('SIGTERM', stop);
}
