/** Browser capture stays in memory; normalize the actual device rate to local STT's PCM contract. */
export function speechPcm(chunks: Float32Array[], sampleRate: number): Uint8Array {
  if (!Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 192000)
    throw new Error('Unsupported microphone format');
  const count = chunks.reduce((n, chunk) => n + chunk.length, 0);
  if (count > sampleRate * 20) throw new Error('Capture exceeds bounded turn');
  const input = new Float32Array(count);
  let offset = 0;
  for (const chunk of chunks) {
    input.set(chunk, offset);
    offset += chunk.length;
  }
  const size = Math.floor((count * 16000) / sampleRate);
  const result = new Uint8Array(size * 2);
  const view = new DataView(result.buffer);
  for (let i = 0; i < size; i++) {
    const index = (i * sampleRate) / 16000;
    const low = Math.floor(index);
    const value = Math.max(
      -1,
      Math.min(1, (input[low] ?? 0) * (1 - index + low) + (input[low + 1] ?? 0) * (index - low)),
    );
    view.setInt16(i * 2, value < 0 ? value * 32768 : value * 32767, true);
  }
  input.fill(0);
  return result;
}
export function pcmBase64(bytes: Uint8Array): string {
  let text = '';
  for (let i = 0; i < bytes.length; i += 8192)
    text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(text);
}
