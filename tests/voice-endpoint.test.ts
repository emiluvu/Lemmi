import { expect, test } from 'bun:test';
import { SpeechEndpoint } from '../apps/web/src/lib/voice-endpoint';
function feed(detector: SpeechEndpoint, milliseconds: number, level: number, rate = 48000) {
  let ended = false;
  for (let elapsed = 0; elapsed < milliseconds; elapsed += 20)
    ended = detector.push(new Float32Array(rate / 50).fill(level));
  return ended;
}
test('initial silence, room noise and isolated clicks do not submit an ambiguous answer', () => {
  const detector = new SpeechEndpoint(48000);
  expect(feed(detector, 6000, 0)).toBe(false);
  expect(feed(detector, 20, 0.2)).toBe(false);
  expect(feed(detector, 3000, 0.004)).toBe(false);
});
test('balanced endpoint submits after two seconds of quiet following sustained speech', () => {
  for (const rate of [16000, 44100, 48000]) {
    const detector = new SpeechEndpoint(rate);
    expect(feed(detector, 400, 0.1, rate)).toBe(false);
    expect(feed(detector, 1980, 0, rate)).toBe(false);
    expect(feed(detector, 20, 0, rate)).toBe(true);
  }
});
test('a short pause within an explanation does not end the turn; fresh speech resets the quiet interval', () => {
  const detector = new SpeechEndpoint(48000);
  feed(detector, 400, 0.1);
  expect(feed(detector, 1200, 0)).toBe(false);
  expect(feed(detector, 300, 0.1)).toBe(false);
  expect(feed(detector, 1980, 0)).toBe(false);
  expect(feed(detector, 20, 0)).toBe(true);
});
test('patient and quick settings are explicit, bounded and independent between turns', () => {
  const patient = new SpeechEndpoint(48000, 4000);
  feed(patient, 200, 0.1);
  expect(feed(patient, 2500, 0)).toBe(false);
  expect(feed(patient, 1500, 0)).toBe(true);
  const quick = new SpeechEndpoint(48000, 1200);
  feed(quick, 200, 0.1);
  expect(feed(quick, 1200, 0)).toBe(true);
  expect(feed(new SpeechEndpoint(48000), 4000, 0)).toBe(false);
  expect(() => new SpeechEndpoint(48000, 0)).toThrow();
});
