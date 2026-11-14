import { expect, test } from 'bun:test';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { TurnEnd } from '../apps/web/src/lib/features/turn-end.ts';
import { voiceDetector } from '../apps/web/src/lib/features/webrtc-vad.ts';

test('a short answer starts endpointing; shorter pauses survive and each new turn starts clean', () => {
  const turn = new TurnEnd(2000);
  for (let i = 0; i < 5; i++) expect(turn.push(true)).toBe('continue');
  expect(turn.heardSpeech).toBe(true);
  for (let i = 0; i < 99; i++) expect(turn.push(false)).toBe('continue');
  expect(turn.push(true)).toBe('continue');
  for (let i = 0; i < 99; i++) expect(turn.push(false)).toBe('continue');
  expect(turn.push(false)).toBe('finished');
  expect(new TurnEnd().heardSpeech).toBe(false);
  for (const ms of [0, 1499, 8001, NaN, Infinity, 2000.5]) expect(() => new TurnEnd(ms)).toThrow();
});

test('the pinned WebRTC WASM classifies silence and releases its scratch buffer', async () => {
  const require = createRequire(new URL('../apps/web/package.json', import.meta.url));
  const source = pathToFileURL(require.resolve('@echogarden/fvad-wasm'));
  const { default: create } = await import(source.href);
  const module = await create({
    wasmBinary: new Uint8Array(await Bun.file(new URL('fvad.wasm', source)).arrayBuffer()),
    print() {},
    printErr() {},
  });
  const detector = voiceDetector(module);
  const silence = new Uint8Array(640);
  for (let i = 0; i < 100; i++) expect(detector.process(silence)).toBe(false);
  expect(() => detector.process(new Uint8Array(1))).toThrow();
  expect(silence.every((byte) => byte === 0)).toBe(true);
  detector.destroy();
  detector.destroy();
  expect(() => detector.process(silence)).toThrow();
});
