import { z } from 'zod';
import { IdSchema, RevisionSchema } from './common';
import { SessionSnapshotSchema } from './session';
import { ActivityViewSchema } from './activity';
import { ConversationReplySchema } from './conversation';

export const PhotoStoryCommandSchema = z.strictObject({
  commandId: IdSchema,
  sessionId: IdSchema,
  instanceId: IdSchema,
  expectedGeneration: RevisionSchema,
  expectedRevision: RevisionSchema,
  input: z.discriminatedUnion('type', [
    z.strictObject({ type: z.literal('opening') }),
    z.strictObject({ type: z.literal('text'), text: z.string().trim().min(1).max(1000) }),
    z.strictObject({
      type: z.literal('audio'),
      captureTurnId: IdSchema,
      pcmBase64: z
        .string()
        .min(4)
        .max(853336)
        .regex(/^[A-Za-z0-9+/]*={0,2}$/),
    }),
    z.strictObject({ type: z.literal('synthesize'), turnId: IdSchema }),
    z.strictObject({ type: z.literal('repeat') }),
    z.strictObject({ type: z.literal('playback_end'), turnId: IdSchema }),
  ]),
});
export type PhotoStoryCommand = z.infer<typeof PhotoStoryCommandSchema>;
export const PhotoStoryResultSchema = z.strictObject({
  session: SessionSnapshotSchema,
  reply: ConversationReplySchema.nullable(),
  audio: z
    .strictObject({
      pcmBase64: z.string().max(3840000),
      sampleRate: z.number().int().min(8000).max(48000),
      encoding: z.literal('pcm_s16le'),
      channels: z.literal(1),
      turnId: IdSchema,
    })
    .nullable(),
  notice: z.string().max(300).nullable(),
});
export type PhotoStoryResult = z.infer<typeof PhotoStoryResultSchema>;
export const PhotoStoryStatusSchema = z.strictObject({
  session: SessionSnapshotSchema.nullable(),
  activity: ActivityViewSchema.nullable(),
  enabled: z.boolean(),
  chat: z.enum(['reviewed_demo', 'openrouter', 'unavailable']),
  stt: z.boolean(),
  tts: z.boolean(),
  analysis: z.literal('caption_only'),
});
