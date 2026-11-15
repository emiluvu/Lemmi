declare module '@echogarden/fvad-wasm' {
  const create: (options: {
    locateFile?: () => string;
    wasmBinary?: Uint8Array;
    print?: () => void;
    printErr?: () => void;
  }) => Promise<Parameters<typeof import('./lib/features/webrtc-vad').voiceDetector>[0]>;
  export default create;
}
declare module '*?url' {
  const url: string;
  export default url;
}
