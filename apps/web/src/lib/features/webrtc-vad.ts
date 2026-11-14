export interface VoiceDetector {
  process(pcm: Uint8Array): boolean;
  destroy(): void;
}

interface FvadModule {
  HEAP16: Int16Array;
  _malloc(size: number): number;
  _free(pointer: number): void;
  _fvad_new(): number;
  _fvad_free(pointer: number): void;
  _fvad_set_mode(pointer: number, mode: number): number;
  _fvad_set_sample_rate(pointer: number, rate: number): number;
  _fvad_process(pointer: number, samples: number, length: number): number;
}

// Exported separately so tests can exercise the real WASM with in-memory PCM.
export function voiceDetector(module: FvadModule): VoiceDetector {
  const handle = module._fvad_new();
  const buffer = module._malloc(640);
  let closed = false;
  const destroy = () => {
    if (closed) return;
    closed = true;
    if (buffer) {
      module.HEAP16.fill(0, buffer / 2, buffer / 2 + 320);
      module._free(buffer);
    }
    if (handle) module._fvad_free(handle);
  };
  // Normal mode favors retaining quiet speech over aggressively rejecting noise.
  if (
    !handle ||
    !buffer ||
    module._fvad_set_mode(handle, 0) ||
    module._fvad_set_sample_rate(handle, 16000)
  ) {
    destroy();
    throw new Error('Voice detector unavailable');
  }
  return {
    destroy,
    process(pcm) {
      if (closed || pcm.length !== 640) throw new Error('Invalid voice frame');
      const view = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength);
      for (let i = 0; i < 320; i++) module.HEAP16[buffer / 2 + i] = view.getInt16(i * 2, true);
      try {
        const result = module._fvad_process(handle, buffer, 320);
        if (result < 0) throw new Error('Voice detection failed');
        return result === 1;
      } finally {
        module.HEAP16.fill(0, buffer / 2, buffer / 2 + 320);
      }
    },
  };
}

export async function loadVoiceDetector(): Promise<VoiceDetector> {
  // Vite emits the pinned WASM as a same-origin asset. No CDN/model/audio upload.
  const [{ default: create }, { default: wasmUrl }] = await Promise.all([
    import('@echogarden/fvad-wasm'),
    import('@echogarden/fvad-wasm/fvad.wasm?url'),
  ]);
  const module = await create({ locateFile: () => wasmUrl, print() {}, printErr() {} });
  return voiceDetector(module);
}
