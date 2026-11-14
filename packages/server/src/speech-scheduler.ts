import { fail, type Result } from '@lemmi/contracts';
import type { SpeechAdapters } from './speech-turns';

/** One bounded, transient FIFO shared by every session using the local speech engines. */
export function createScheduledSpeechAdapters(
  adapters: SpeechAdapters,
  capacity = 8,
): SpeechAdapters {
  if (!Number.isInteger(capacity) || capacity < 0 || capacity > 64)
    throw new Error('Speech queue capacity must be between zero and 64');
  type Job = { start: () => void; canceled: boolean };
  const waiting: Job[] = [];
  let active = false;
  const canceled = () => fail('UNAVAILABLE', 'Speech request canceled');
  function pump() {
    if (active) return;
    const next = waiting.shift();
    if (next) next.start();
  }
  function schedule<T>(
    signal: AbortSignal,
    run: () => Promise<Result<T>>,
    discard?: (result: Result<T>) => void,
  ): Promise<Result<T>> {
    if (signal.aborted) return Promise.resolve(canceled());
    if (active && waiting.length >= capacity)
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
        canceled: false,
        start() {
          started = true;
          active = true;
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
              active = false;
              pump();
            });
        },
      };
      signal.addEventListener('abort', abort, { once: true });
      if (active) waiting.push(job);
      else job.start();
    });
  }
  return {
    stt: {
      transcribe: (input, signal) => schedule(signal, () => adapters.stt.transcribe(input, signal)),
    },
    tts: {
      synthesize: (input, signal) =>
        schedule(
          signal,
          () => adapters.tts.synthesize(input, signal),
          (result) => {
            if (result.ok) result.data.pcm.fill(0);
          },
        ),
    },
  };
}
