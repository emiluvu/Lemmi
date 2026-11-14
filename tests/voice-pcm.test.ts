import { expect, test } from 'bun:test';
import { PcmFramer, decodePcm, pcmBase64 } from '../apps/web/src/lib/voice-pcm';

test('microphone resampling keeps 20ms frames and fractional positions across arbitrary blocks', () => {
  for (const rate of [16000, 22050, 44100, 48000]) {
    const framer = new PcmFramer(rate),
      frames: Uint8Array[] = [];
    const samples = new Float32Array(rate).fill(0.5);
    for (let at = 0; at < samples.length; at += 128)
      frames.push(...framer.push(samples.subarray(at, at + 128)));
    expect(frames).toHaveLength(50);
    expect(frames.every((f) => f.length === 640)).toBe(true);
    expect(new DataView(frames[0]!.buffer).getInt16(0, true)).toBe(16384);
  }
});
test('bounded microphone frames clamp samples, clear partial capture and never exceed 20 seconds', () => {
  const framer = new PcmFramer(16000);
  framer.push(new Float32Array(100).fill(1));
  framer.clear();
  const frames = framer.push(new Float32Array(320).fill(-2));
  expect(frames).toHaveLength(1);
  expect(new DataView(frames[0]!.buffer).getInt16(0, true)).toBe(-32767);
  expect(new PcmFramer(16000).push(new Float32Array(16000 * 21))).toHaveLength(1000);
  expect(() => new PcmFramer(8000)).toThrow();
});
test('speaker PCM decoding is little endian, canonical and exact length', () => {
  const bytes = new Uint8Array([0, 128, 0, 0, 255, 127]);
  expect([...decodePcm(pcmBase64(bytes), 6)]).toEqual([-1, 0, 32767 / 32768]);
  expect(() => decodePcm(pcmBase64(bytes), 4)).toThrow();
  expect(() => decodePcm('AA==', 1)).toThrow();
});
