import type { VoiceDetector } from './webrtc-vad';
import type { InferenceSession, Tensor, TensorConstructor } from 'onnxruntime-web';

type Runtime = { Tensor: TensorConstructor };
// Silero v5: 512 new samples plus 64 samples of context, 16 kHz mono.
// Only model assets are cached. Each granted turn owns its recurrent state/PCM.
export function sileroDetector(session: InferenceSession, ort: Runtime): VoiceDetector {
  let closed = false;
  let fault = false;
  let running = false;
  let voiced = false;
  let state: Tensor = new ort.Tensor('float32', new Float32Array(256), [2, 1, 128]);
  const rate = new ort.Tensor('int64', BigInt64Array.from([16000n]), []);
  const context = new Float32Array(64);
  const pending: Float32Array[] = [];
  let frame = new Float32Array(512);
  let used = 0;
  let inFlight: Float32Array | null = null;
  const wipe = () => {
    frame.fill(0);
    context.fill(0);
    inFlight?.fill(0);
    for (const item of pending) item.fill(0);
    pending.length = 0;
  };
  const release = () => {
    (state.data as Float32Array).fill(0);
    state.dispose();
    rate.dispose();
    void session.release().catch(() => {});
  };
  async function drain() {
    if (running || closed) return;
    running = true;
    try {
      while (pending.length && !closed) {
        const audio = pending.shift()!;
        const input = new Float32Array(576);
        inFlight = input;
        input.set(context);
        input.set(audio, 64);
        context.set(audio.subarray(448));
        audio.fill(0);
        const tensor = new ort.Tensor('float32', input, [1, 576]);
        let result: InferenceSession.ReturnType | undefined;
        try {
          result = await session.run({ input: tensor, state, sr: rate });
          const next = result.stateN;
          const probability = Number(result.output?.data[0]);
          if (
            !next ||
            next.type !== 'float32' ||
            next.data.length !== 256 ||
            !Number.isFinite(probability) ||
            probability < 0 ||
            probability > 1
          )
            throw new Error('Invalid voice result');
          if (!closed) {
            // Hysteresis retains softer syllables once speech has started.
            voiced = probability >= (voiced ? 0.35 : 0.5);
            (state.data as Float32Array).fill(0);
            state.dispose();
            state = next;
          }
        } finally {
          input.fill(0);
          inFlight = null;
          tensor.dispose();
          if (result)
            for (const value of Object.values(result)) {
              if (value !== state) {
                if (value.data instanceof Float32Array) value.data.fill(0);
                value.dispose();
              }
            }
        }
      }
    } catch {
      fault = true;
      wipe();
    } finally {
      running = false;
      if (closed) release();
    }
  }
  return {
    process(pcm) {
      if (closed || fault || pcm.length !== 640) throw new Error('Voice detector unavailable');
      const view = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength);
      for (let i = 0; i < 320; i++) {
        frame[used++] = view.getInt16(i * 2, true) / 32768;
        if (used === 512) {
          // At most 256 ms of waiting audio; never grow an inference backlog.
          if (pending.length >= 8) {
            fault = true;
            wipe();
            throw new Error('Voice detector overloaded');
          }
          pending.push(frame);
          frame = new Float32Array(512);
          used = 0;
          void drain();
        }
      }
      // An unfinished classification cannot establish end-of-speech.
      return pending.length > 1 ? null : voiced;
    },
    destroy() {
      if (closed) return;
      closed = true;
      wipe();
      (state.data as Float32Array).fill(0);
      if (!running) release();
    },
  };
}

let assets: Promise<{ ort: typeof import('onnxruntime-web/wasm'); model: Uint8Array }> | undefined;
export async function loadNoiseAwareDetector(): Promise<VoiceDetector> {
  assets ??= (async () => {
    const [ort, { default: wasm }, { default: mjs }, { default: modelUrl }] = await Promise.all([
      import('onnxruntime-web/wasm'),
      import('onnxruntime-web/ort-wasm-simd-threaded.wasm?url'),
      import('onnxruntime-web/ort-wasm-simd-threaded.mjs?url'),
      import('@ricky0123/vad-web/dist/silero_vad_v5.onnx?url'),
    ]);
    ort.env.logLevel = 'error';
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.proxy = false;
    const pageUrl = (globalThis as { location?: { href: string } }).location?.href;
    if (!pageUrl) throw new Error('Browser voice detector unavailable');
    ort.env.wasm.wasmPaths = {
      wasm: new URL(wasm, pageUrl).href,
      mjs: new URL(mjs, pageUrl).href,
    };
    const response = await fetch(modelUrl);
    if (!response.ok) throw new Error('Voice model unavailable');
    return { ort, model: new Uint8Array(await response.arrayBuffer()) };
  })().catch((error) => {
    assets = undefined;
    throw error;
  });
  const { ort, model } = await assets;
  const session = await ort.InferenceSession.create(model, {
    executionProviders: ['wasm'],
    graphOptimizationLevel: 'all',
  });
  return sileroDetector(session, ort);
}
