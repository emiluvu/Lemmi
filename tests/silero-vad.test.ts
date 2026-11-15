import { expect, test } from 'bun:test';
import { sileroDetector } from '../apps/web/src/lib/features/silero-vad';

function fixture() {
  const calls: any[] = [];
  const tensors: any[] = [];
  let releases = 0;
  class Tensor {
    constructor(
      readonly type: string,
      readonly data: any,
      readonly dims: number[],
    ) {
      tensors.push(this);
    }
    disposed = false;
    dispose() {
      this.disposed = true;
    }
  }
  const session = {
    run(input: any) {
      return new Promise<any>((resolve, reject) => calls.push({ input, resolve, reject }));
    },
    async release() {
      releases++;
    },
  };
  const detector = sileroDetector(session as any, { Tensor } as any);
  const result = (call: number, probability: number) =>
    calls[call].resolve({
      output: new Tensor('float32', Float32Array.of(probability), [1, 1]),
      stateN: new Tensor('float32', new Float32Array(256).fill(0.2), [2, 1, 128]),
    });
  return { detector, calls, tensors, result, releases: () => releases };
}
const tick = () => Bun.sleep(0);

test('neural inference is serialized, PCM is owned, and Stop clears late state without accepting it', async () => {
  const f = fixture();
  const pcm = new Uint8Array(640).fill(1);
  f.detector.process(pcm);
  f.detector.process(pcm);
  expect(f.calls).toHaveLength(1);
  const first = f.calls[0].input.input.data;
  expect(first.some((n: number) => n !== 0)).toBe(true);
  pcm.fill(0);
  expect(first.some((n: number) => n !== 0)).toBe(true);
  for (let i = 0; i < 3; i++) f.detector.process(pcm);
  expect(f.calls).toHaveLength(1);
  f.detector.destroy();
  expect(first.every((n: number) => n === 0)).toBe(true);
  f.detector.destroy();
  expect(() => f.detector.process(pcm)).toThrow();
  f.result(0, 0.9);
  await tick();
  expect(f.calls).toHaveLength(1);
  expect(first.every((n: number) => n === 0)).toBe(true);
  expect(f.releases()).toBe(1);
  expect(f.tensors.every((t) => t.disposed)).toBe(true);
});

test('probability hysteresis retains softer speech then rejects background without mutating caller PCM', async () => {
  const f = fixture();
  const pcm = new Uint8Array(640);
  f.detector.process(pcm);
  f.detector.process(pcm);
  f.result(0, 0.6);
  await tick();
  expect(f.detector.process(pcm)).toBe(true);
  f.detector.process(pcm);
  f.result(1, 0.4);
  await tick();
  expect(f.detector.process(pcm)).toBe(true);
  f.result(2, 0.1);
  await tick();
  expect(f.detector.process(pcm)).toBe(false);
  expect(pcm.every((n) => n === 0)).toBe(true);
  f.detector.destroy();
  expect(f.releases()).toBe(1);
});

test('detector overload and failed inference become explicit failures, never an unbounded audio backlog', async () => {
  const f = fixture();
  const pcm = new Uint8Array(640);
  expect(() => {
    for (let i = 0; i < 30; i++) f.detector.process(pcm);
  }).toThrow();
  expect(f.calls).toHaveLength(1);
  f.detector.destroy();
  f.result(0, 0.1);
  await tick();
  expect(f.releases()).toBe(1);
  const failed = fixture();
  failed.detector.process(pcm);
  failed.detector.process(pcm);
  failed.calls[0].reject(new Error('Fixture inference failure'));
  await tick();
  expect(() => failed.detector.process(pcm)).toThrow();
  failed.detector.destroy();
  expect(failed.releases()).toBe(1);
});

test('queued unclassified audio is unknown rather than detected speech', async () => {
  const f = fixture();
  const pcm = new Uint8Array(640);
  let unknown = false;
  for (let i = 0; i < 8; i++) unknown ||= f.detector.process(pcm) === null;
  expect(unknown).toBe(true);
  f.detector.destroy();
  f.result(0, 0);
  await tick();
  expect(f.releases()).toBe(1);
});
