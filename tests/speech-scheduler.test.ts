import { expect, test } from 'bun:test';
import { ok, type Result } from '@lemmi/contracts';
import { createScheduledSpeechAdapters } from '../packages/server/src/speech-scheduler';
import type { SpeechAudio, Transcript } from '../packages/server/src/adapters/types';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => (resolve = done));
  return { promise, resolve };
}
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const pcm = () => ({ pcm: new Uint8Array(640), language: 'en' as const });
const audio = (bytes = new Uint8Array([1, 2])): SpeechAudio => ({
  pcm: bytes,
  sampleRate: 16000,
  encoding: 'pcm_s16le',
  channels: 1,
  language: 'en',
});

test('shared STT and TTS adapters run one job at a time in FIFO order', async () => {
  const first = deferred<Result<Transcript>>();
  const second = deferred<Result<SpeechAudio>>();
  const calls: string[] = [];
  const adapters = createScheduledSpeechAdapters({
    stt: {
      async transcribe() {
        calls.push('stt');
        return first.promise;
      },
    },
    tts: {
      async synthesize(input) {
        calls.push(input.text);
        return second.promise;
      },
    },
  });
  const signal = new AbortController().signal;
  const a = adapters.stt.transcribe(pcm(), signal);
  const b = adapters.tts.synthesize({ text: 'second', language: 'en' }, signal);
  await tick();
  expect(calls).toEqual(['stt']);
  first.resolve(ok({ text: 'fictional greeting', language: 'en' }));
  expect((await a).ok).toBe(true);
  await tick();
  expect(calls).toEqual(['stt', 'second']);
  second.resolve(ok(audio()));
  expect((await b).ok).toBe(true);
});

test('queued cancellation removes only that job and immediately frees queue capacity', async () => {
  const first = deferred<Result<Transcript>>();
  const calls: string[] = [];
  let activeSignal: AbortSignal | undefined;
  const adapters = createScheduledSpeechAdapters(
    {
      stt: {
        async transcribe(_input, signal) {
          activeSignal = signal;
          calls.push('stt');
          return first.promise;
        },
      },
      tts: {
        async synthesize(input) {
          calls.push(input.text);
          return ok(audio());
        },
      },
    },
    1,
  );
  const active = new AbortController();
  const queued = new AbortController();
  const a = adapters.stt.transcribe(pcm(), active.signal);
  const b = adapters.tts.synthesize({ text: 'canceled', language: 'en' }, queued.signal);
  await tick();
  queued.abort();
  expect((await b).ok).toBe(false);
  expect(activeSignal?.aborted).toBe(false);
  const c = adapters.tts.synthesize({ text: 'replacement', language: 'en' }, active.signal);
  first.resolve(ok({ text: 'fictional greeting', language: 'en' }));
  await a;
  expect((await c).ok).toBe(true);
  expect(calls).toEqual(['stt', 'replacement']);
});

test('capacity rejects excess work without executing it or retaining an unbounded queue', async () => {
  const first = deferred<Result<Transcript>>();
  const calls: string[] = [];
  const adapters = createScheduledSpeechAdapters(
    {
      stt: { transcribe: () => first.promise },
      tts: {
        async synthesize(input) {
          calls.push(input.text);
          return ok(audio());
        },
      },
    },
    1,
  );
  const signal = new AbortController().signal;
  const a = adapters.stt.transcribe(pcm(), signal);
  const b = adapters.tts.synthesize({ text: 'accepted', language: 'en' }, signal);
  const rejected = await adapters.tts.synthesize({ text: 'excess', language: 'en' }, signal);
  expect(rejected.ok).toBe(false);
  if (!rejected.ok) expect(rejected.error.code).toBe('UNAVAILABLE');
  first.resolve(ok({ text: 'fictional greeting', language: 'en' }));
  await Promise.all([a, b]);
  expect(calls).toEqual(['accepted']);
});

test('canceling an active uncooperative adapter keeps its slot and wipes late generated audio', async () => {
  const first = deferred<Result<SpeechAudio>>();
  const bytes = new Uint8Array([12, 34]);
  const calls: string[] = [];
  const adapters = createScheduledSpeechAdapters({
    stt: {
      async transcribe() {
        calls.push('next');
        return ok({ text: 'fictional greeting', language: 'en' });
      },
    },
    tts: {
      async synthesize() {
        calls.push('active');
        return first.promise;
      },
    },
  });
  const canceled = new AbortController();
  const current = new AbortController();
  const a = adapters.tts.synthesize({ text: 'first', language: 'en' }, canceled.signal);
  const b = adapters.stt.transcribe(pcm(), current.signal);
  await tick();
  canceled.abort();
  expect((await a).ok).toBe(false);
  await tick();
  expect(calls).toEqual(['active']);
  expect(current.signal.aborted).toBe(false);
  first.resolve(ok(audio(bytes)));
  expect((await b).ok).toBe(true);
  expect(bytes).toEqual(new Uint8Array(2));
  expect(calls).toEqual(['active', 'next']);
});
