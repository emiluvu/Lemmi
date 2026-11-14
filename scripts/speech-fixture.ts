import type { SpeechAudio } from '@lemmi/server';

// Synthetic fixtures only. Real endpoints must supply negotiated 16 kHz PCM directly.
// No files, microphone, speaker or production resampling path.
export function captureFixture(input: SpeechAudio, paddingMs = 0): Uint8Array {
  const source = new DataView(input.pcm.buffer, input.pcm.byteOffset, input.pcm.byteLength);
  const samples = Math.floor(((input.pcm.byteLength / 2) * 16000) / input.sampleRate);
  const padding = Math.floor(paddingMs * 16);
  const frames = Math.ceil((samples + 2 * padding) / 320);
  if (!samples || frames > 1000) throw new Error('Synthetic fixture exceeds capture limits');
  const pcm = new Uint8Array(frames * 640),
    target = new DataView(pcm.buffer);
  for (let i = 0; i < samples; i++) {
    const at = (i * input.sampleRate) / 16000;
    const lo = Math.min(Math.floor(at), input.pcm.length / 2 - 1);
    const hi = Math.min(lo + 1, input.pcm.length / 2 - 1);
    target.setInt16(
      (i + padding) * 2,
      Math.round(
        source.getInt16(lo * 2, true) * (1 - (at - lo)) + source.getInt16(hi * 2, true) * (at - lo),
      ),
      true,
    );
  }
  return pcm;
}
