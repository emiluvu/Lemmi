import { fail, type Result } from '@lemmi/contracts';
import type { SpeechAdapters } from './speech-turns';

export interface SpeechConcurrency {
  stt: number;
  tts: number;
}

export function speechConcurrencyConfig(
  env: Record<string, string | undefined> = process.env,
): SpeechConcurrency {
  const count = (key: string) => {
    const value = env[key] ?? '1';
    if (!/^[1-4]$/.test(value)) throw new Error('Speech workers must be 1–4 per engine');
    return Number(value);
  };
  return { stt: count('LEMMI_SPEECH_STT_WORKERS'), tts: count('LEMMI_SPEECH_TTS_WORKERS') };
}

/** One bounded transient queue, FIFO within each independently limited engine. */
export function createScheduledSpeechAdapters(
  adapters: SpeechAdapters,
  capacity = 8,
  concurrency: SpeechConcurrency = { stt: 1, tts: 1 },
): SpeechAdapters {
  if (!Number.isInteger(capacity) || capacity < 0 || capacity > 64)
    throw new Error('Speech queue capacity must be between zero and 64');
  if ([concurrency.stt, concurrency.tts].some((n) => !Number.isInteger(n) || n < 1 || n > 4))
    throw new Error('Speech workers must be 1–4 per engine');
  const limits = { ...concurrency };
  type Kind = keyof SpeechConcurrency;
  type Job = { kind: Kind; start: () => void; canceled: boolean };
  const waiting: Job[] = [];
  const active: SpeechConcurrency = { stt: 0, tts: 0 };
  const canceled = () => fail('UNAVAILABLE', 'Speech request canceled');
  function pump() {
    // A blocked STT must not hold up another participant's ready TTS, or vice versa.
    for (;;) {
      const index = waiting.findIndex((job) => active[job.kind] < limits[job.kind]);
      if (index < 0) return;
      waiting.splice(index, 1)[0]!.start();
    }
  }
  function schedule<T>(
    kind: Kind,
    signal: AbortSignal,
    run: () => Promise<Result<T>>,
    discard?: (result: Result<T>) => void,
  ): Promise<Result<T>> {
    if (signal.aborted) return Promise.resolve(canceled());
    if (active[kind] >= limits[kind] && waiting.length >= capacity)
      return Promise.resolve(fail('UNAVAILABLE', 'Speech capacity reached; retry explicitly'));
    return new Promise((resolve) => {
      let started = false;
      const abort = () => {
        job.canceled = true;
        if (!started) {
          const index = waiting.indexOf(job);
          if (index >= 0) waiting.splice(index, 1);
          signal.removeEventListener('abort', abort);
        }
        resolve(canceled());
      };
      const job: Job = {
        kind,
        canceled: false,
        start() {
          started = true;
          active[kind]++;
          // Keep ownership until the underlying adapter settles, even if it ignores abort.
          void Promise.resolve()
            .then(() => (signal.aborted ? canceled() : run()))
            .then(
              (result) => {
                if (signal.aborted || job.canceled) {
                  discard?.(result);
                  resolve(canceled());
                } else resolve(result);
              },
              () => resolve(fail('UNAVAILABLE', 'Speech service unavailable')),
            )
            .finally(() => {
              signal.removeEventListener('abort', abort);
              active[kind]--;
              pump();
            });
        },
      };
      signal.addEventListener('abort', abort, { once: true });
      if (active[kind] >= limits[kind]) waiting.push(job);
      else job.start();
    });
  }
  return {
    onTiming: adapters.onTiming,
    stt: {
      transcribe: (input, signal) =>
        schedule('stt', signal, () => adapters.stt.transcribe(input, signal)),
    },
    tts: {
      synthesize: (input, signal) =>
        schedule(
          'tts',
          signal,
          () => adapters.tts.synthesize(input, signal),
          (result) => {
            if (result.ok) result.data.pcm.fill(0);
          },
        ),
    },
  };
}
