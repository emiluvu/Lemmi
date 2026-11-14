import { z } from 'zod';
import { IdSchema, RevisionSchema } from './common';

export const SPEECH_CAPTURE_MS = 20_000;
export const SPEECH_FRAME_BYTES = 640;
export const SPEECH_OUTPUT_WINDOW = 4;
export const SpeechSampleRateSchema = z.union([
  z.literal(16000),
  z.literal(22050),
  z.literal(24000),
  z.literal(44100),
  z.literal(48000),
]);
export const PlaybackCapabilitySchema = z.strictObject({
  encoding: z.literal('pcm_s16le'),
  channels: z.literal(1),
  sampleRates: z.array(SpeechSampleRateSchema).min(1).max(5),
});
const current = {
  sessionId: IdSchema,
  expectedGeneration: RevisionSchema,
};
const stream = {
  ...current,
  turnId: IdSchema,
  leaseId: IdSchema,
  streamId: IdSchema,
};
export const SpeechStartCommandSchema = z.strictObject({
  ...current,
  commandId: IdSchema,
  language: z.enum(['en', 'de']),
});
export const SpeechInputChunkSchema = z.strictObject({
  ...stream,
  chunkIndex: RevisionSchema,
  encoding: z.literal('pcm_s16le'),
  data: z
    .string()
    .length(856)
    .regex(/^[A-Za-z0-9+/]+={0,2}$/),
});
export const SpeechInputEndSchema = z.strictObject({
  ...stream,
  chunkCount: z.number().int().positive().max(1000),
});
export const PlaybackReceiptPayloadSchema = z.strictObject({
  leaseId: IdSchema,
  streamId: IdSchema,
  status: z.enum(['started', 'progress', 'completed', 'failed']),
  playedChunks: z.number().int().nonnegative().max(1501),
});
export const SpeechReceiptSchema = PlaybackReceiptPayloadSchema.extend({
  ...current,
  turnId: IdSchema,
});
export const SpeechOutputStartSchema = z
  .strictObject({
    turnId: IdSchema,
    leaseId: IdSchema,
    streamId: IdSchema,
    encoding: z.literal('pcm_s16le'),
    channels: z.literal(1),
    sampleRate: SpeechSampleRateSchema,
    chunkBytes: z.number().int().positive().max(1920),
    chunkCount: z.number().int().positive().max(1501),
    byteLength: z.number().int().positive().max(2_880_000),
  })
  .refine(
    (s) =>
      s.chunkBytes === Math.floor(s.sampleRate / 50) * 2 &&
      s.byteLength % 2 === 0 &&
      s.byteLength <= s.sampleRate * 2 * 30 &&
      s.chunkCount === Math.ceil(s.byteLength / s.chunkBytes),
    'Output size, duration and PCM frame metadata must agree',
  );
export const SpeechOutputChunkSchema = z.strictObject({
  leaseId: IdSchema,
  streamId: IdSchema,
  chunkIndex: RevisionSchema,
  encoding: z.literal('pcm_s16le'),
  data: z
    .string()
    .min(4)
    .max(2560)
    .regex(/^[A-Za-z0-9+/]+={0,2}$/)
    .refine((value) => {
      try {
        const n = atob(value).length;
        return n > 0 && n <= 1920 && n % 2 === 0;
      } catch {
        return false;
      }
    }),
});
export type SpeechOutputStart = z.infer<typeof SpeechOutputStartSchema>;
export type SpeechOutputChunk = z.infer<typeof SpeechOutputChunkSchema>;
