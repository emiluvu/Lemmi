import { expect, test } from 'bun:test';
import { ok, type Result } from '@lemmi/contracts';
import {
  createScheduledSpeechAdapters,
  speechConcurrencyConfig,
} from '../packages/server/src/speech-scheduler';
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
const say = (text: string) => ({ text, language: 'en' as const });

test('independent engine slots permit STT and TTS together and preserve timing observer', async () => {
  const stt = deferred<Result<Transcript>>(),
    tts = deferred<Result<SpeechAudio>>();
  const calls: string[] = [];
  const observer = () => {};
  const adapters = createScheduledSpeechAdapters({
    onTiming: observer,
    stt: {
      transcribe: async () => {
        calls.push('stt');
        return stt.promise;
      },
    },
    tts: {
      synthesize: async () => {
        calls.push('tts');
        return tts.promise;
      },
    },
  });
  const signal = new AbortController().signal;
  const a = adapters.stt.transcribe(pcm(), signal),
    b = adapters.tts.synthesize(say('hello'), signal);
  await tick();
  expect(calls).toEqual(['stt', 'tts']);
  expect(adapters.onTiming).toBe(observer);
  stt.resolve(ok({ text: 'fixture', language: 'en' }));
  tts.resolve(ok(audio()));
  expect((await a).ok).toBe(true);
  expect((await b).ok).toBe(true);
});

test('multiple participant jobs overlap up to their lane limit, then wait in FIFO order', async () => {
  const jobs = Array.from({ length: 4 }, () => deferred<Result<SpeechAudio>>());
  const calls: string[] = [];
  const adapters = createScheduledSpeechAdapters(
    {
      stt: { transcribe: async () => ok({ text: 'fixture', language: 'en' }) },
      tts: {
        synthesize: async (input) => {
          calls.push(input.text);
          return jobs[Number(input.text)]!.promise;
        },
      },
    },
    8,
    { stt: 2, tts: 2 },
  );
  const signal = new AbortController().signal;
  const results = jobs.map((_, i) => adapters.tts.synthesize(say(String(i)), signal));
  await tick();
  expect(calls).toEqual(['0', '1']);
  jobs[1]!.resolve(ok(audio()));
  await results[1];
  await tick();
  expect(calls).toEqual(['0', '1', '2']);
  jobs[0]!.resolve(ok(audio()));
  await results[0];
  await tick();
  expect(calls).toEqual(['0', '1', '2', '3']);
  jobs[2]!.resolve(ok(audio()));
  jobs[3]!.resolve(ok(audio()));
  expect((await Promise.all(results)).every((r) => r.ok)).toBe(true);
});

test('queued cancellation removes its job and frees capacity without canceling other work', async () => {
  const first = deferred<Result<SpeechAudio>>();
  const calls: string[] = [];
  const adapters = createScheduledSpeechAdapters(
    {
      stt: { transcribe: async () => ok({ text: 'fixture', language: 'en' }) },
      tts: {
        synthesize: async (input) => {
          calls.push(input.text);
          return input.text === 'active' ? first.promise : ok(audio());
        },
      },
    },
    1,
  );
  const active = new AbortController(),
    queued = new AbortController();
  const a = adapters.tts.synthesize(say('active'), active.signal);
  const b = adapters.tts.synthesize(say('canceled'), queued.signal);
  await tick();
  queued.abort();
  expect((await b).ok).toBe(false);
  const c = adapters.tts.synthesize(say('replacement'), active.signal);
  first.resolve(ok(audio()));
  await a;
  expect((await c).ok).toBe(true);
  expect(calls).toEqual(['active', 'replacement']);
  expect(active.signal.aborted).toBe(false);
});

test('full shared waiting capacity rejects excess jobs but a free engine lane can proceed', async () => {
  const first = deferred<Result<SpeechAudio>>();
  const calls: string[] = [];
  const adapters = createScheduledSpeechAdapters(
    {
      stt: {
        transcribe: async () => {
          calls.push('stt');
          return ok({ text: 'fixture', language: 'en' });
        },
      },
      tts: {
        synthesize: async (input) => {
          calls.push(input.text);
          return input.text === 'active' ? first.promise : ok(audio());
        },
      },
    },
    1,
  );
  const signal = new AbortController().signal;
  const a = adapters.tts.synthesize(say('active'), signal),
    b = adapters.tts.synthesize(say('queued'), signal);
  expect((await adapters.tts.synthesize(say('excess'), signal)).ok).toBe(false);
  expect((await adapters.stt.transcribe(pcm(), signal)).ok).toBe(true);
  first.resolve(ok(audio()));
  await Promise.all([a, b]);
  expect(calls).toEqual(['active', 'stt', 'queued']);
});

test('aborted uncooperative work keeps only its own slot and late PCM is wiped', async () => {
  const first = deferred<Result<SpeechAudio>>();
  const bytes = new Uint8Array([12, 34]),
    calls: string[] = [];
  const adapters = createScheduledSpeechAdapters(
    {
      stt: { transcribe: async () => ok({ text: 'fixture', language: 'en' }) },
      tts: {
        synthesize: async (input) => {
          calls.push(input.text);
          return input.text === 'active' ? first.promise : ok(audio());
        },
      },
    },
    8,
    { stt: 1, tts: 2 },
  );
  const canceled = new AbortController(),
    current = new AbortController();
  const a = adapters.tts.synthesize(say('active'), canceled.signal);
  const b = adapters.tts.synthesize(say('other-participant'), current.signal);
  await tick();
  canceled.abort();
  expect((await a).ok).toBe(false);
  expect((await b).ok).toBe(true);
  first.resolve(ok(audio(bytes)));
  await tick();
  expect(bytes).toEqual(new Uint8Array(2));
  expect(current.signal.aborted).toBe(false);
  expect((await adapters.tts.synthesize(say('new-turn'), current.signal)).ok).toBe(true);
  expect(calls).toEqual(['active', 'other-participant', 'new-turn']);
});

test('adapter failure releases its slot and pre-canceled work never executes', async () => {
  const calls: string[] = [];
  const adapters = createScheduledSpeechAdapters({
    stt: { transcribe: async () => ok({ text: 'fixture', language: 'en' }) },
    tts: {
      synthesize: async (input) => {
        calls.push(input.text);
        if (input.text === 'throw') throw new Error('fixture');
        return ok(audio());
      },
    },
  });
  const canceled = new AbortController();
  canceled.abort();
  expect((await adapters.tts.synthesize(say('never'), canceled.signal)).ok).toBe(false);
  const signal = new AbortController().signal;
  const a = adapters.tts.synthesize(say('throw'), signal),
    b = adapters.tts.synthesize(say('next'), signal);
  expect((await a).ok).toBe(false);
  expect((await b).ok).toBe(true);
  expect(calls).toEqual(['throw', 'next']);
});

test('worker admission settings are bounded and independent of client/model content', () => {
  expect(speechConcurrencyConfig({})).toEqual({ stt: 1, tts: 1 });
  expect(
    speechConcurrencyConfig({ LEMMI_SPEECH_STT_WORKERS: '2', LEMMI_SPEECH_TTS_WORKERS: '4' }),
  ).toEqual({ stt: 2, tts: 4 });
  for (const value of ['0', '5', '-1', '1.5', 'NaN', 'Infinity', '', '2e0'])
    expect(() => speechConcurrencyConfig({ LEMMI_SPEECH_STT_WORKERS: value })).toThrow();
});
