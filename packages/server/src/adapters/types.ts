import type { Result, Fetcher } from '@lemmi/contracts';

export type SpeechLanguage = 'en' | 'de';
export const PCM_SAMPLE_RATE = 16000;
export const PCM_MAX_BYTES = PCM_SAMPLE_RATE * 2 * 20;
export const TTS_MAX_BYTES = 48000 * 2 * 30;
export interface Transcript {
  text: string;
  language: SpeechLanguage;
}
export interface SpeechAudio {
  pcm: Uint8Array;
  sampleRate: number;
  encoding: 'pcm_s16le';
  channels: 1;
  language: SpeechLanguage;
}
export interface SttAdapter {
  transcribe(
    input: { pcm: Uint8Array; language: SpeechLanguage | 'auto' },
    signal: AbortSignal,
  ): Promise<Result<Transcript>>;
}
export interface TtsAdapter {
  synthesize(
    input: { text: string; language: SpeechLanguage },
    signal: AbortSignal,
  ): Promise<Result<SpeechAudio>>;
}
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}
export interface ChatInput {
  system: string;
  history: ChatMessage[];
  text: string;
  language: SpeechLanguage;
}
export interface ChatAdapter {
  complete(
    input: ChatInput,
    signal: AbortSignal,
  ): Promise<Result<{ text: string; language: SpeechLanguage }>>;
}
export type AdapterFetch = Fetcher;

export async function readBounded(response: Response, maxBytes: number): Promise<Uint8Array> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Missing service body');
  const parts: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > maxBytes) {
        await reader.cancel();
        throw new Error('Service response too large');
      }
      parts.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  return bytes;
}
export function integerSetting(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const n = value === undefined || value === '' ? fallback : Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw new Error('Invalid adapter configuration');
  return n;
}
export const isLanguage = (value: unknown): value is SpeechLanguage =>
  value === 'en' || value === 'de';
