import { z } from 'zod';
import { IdSchema, RevisionSchema } from './common';
import { SessionSnapshotSchema } from './session';

export const ConversationTextCommandSchema = z.strictObject({
  commandId: IdSchema,
  sessionId: IdSchema,
  expectedGeneration: RevisionSchema,
  text: z.string().trim().min(1).max(1000),
  language: z.enum(['en', 'de']),
});
export type ConversationTextCommand = z.infer<typeof ConversationTextCommandSchema>;
export const ConversationReplySchema = z.strictObject({
  turnId: IdSchema,
  text: z.string().min(1).max(600),
  language: z.enum(['en', 'de']),
  source: z.enum(['model', 'fixed', 'scripted']),
});
export type ConversationReply = z.infer<typeof ConversationReplySchema>;
export const ConversationTextResultSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('reply'),
    reply: ConversationReplySchema,
    session: SessionSnapshotSchema,
  }),
  z.strictObject({
    kind: z.literal('control'),
    action: z.enum(['stop', 'pause']),
    session: SessionSnapshotSchema,
  }),
]);
export type ConversationTextResult = z.infer<typeof ConversationTextResultSchema>;
