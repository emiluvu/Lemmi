// Streaming box-filter resampler keeps fractional sample position across browser blocks.
// Output is the existing 16 kHz mono PCM contract, not a recording/file format.
export class PcmFramer {
  private total = 0;
  private weight = 0;
  private samples: number[] = [];
  private frames = 0;
  constructor(private readonly inputRate: number) {
    if (!Number.isFinite(inputRate) || inputRate < 16000 || inputRate > 192000)
      throw new Error('Unsupported microphone sample rate');
  }
  push(input: Float32Array): Uint8Array[] {
    const result: Uint8Array[] = [],
      ratio = this.inputRate / 16000;
    for (const sample of input) {
      let remaining = 1;
      while (remaining > 1e-8) {
        const take = Math.min(remaining, ratio - this.weight);
        this.total += Math.max(-1, Math.min(1, sample)) * take;
        this.weight += take;
        remaining -= take;
        if (this.weight >= ratio - 1e-8) {
          this.samples.push(Math.round(Math.max(-1, Math.min(1, this.total / ratio)) * 32767));
          this.weight = 0;
          this.total = 0;
          if (this.samples.length === 320) {
            if (++this.frames > 1000) {
              this.clear();
              return result;
            }
            const bytes = new Uint8Array(640),
              view = new DataView(bytes.buffer);
            this.samples.forEach((value, i) => view.setInt16(i * 2, value, true));
            this.samples.fill(0);
            this.samples = [];
            result.push(bytes);
          }
        }
      }
    }
    return result;
  }
  clear() {
    this.total = 0;
    this.weight = 0;
    this.samples.fill(0);
    this.samples = [];
  }
}
export function pcmBase64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes));
}
export function decodePcm(data: string, expectedBytes: number): Float32Array<ArrayBuffer> {
  const raw = atob(data);
  if (raw.length !== expectedBytes || expectedBytes % 2) throw new Error('Invalid PCM frame size');
  const bytes = Uint8Array.from(raw, (char) => char.charCodeAt(0));
  if (pcmBase64(bytes) !== data) throw new Error('Noncanonical PCM');
  const view = new DataView(bytes.buffer),
    samples = new Float32Array(expectedBytes / 2);
  for (let i = 0; i < samples.length; i++) samples[i] = view.getInt16(i * 2, true) / 32768;
  bytes.fill(0);
  return samples;
}
