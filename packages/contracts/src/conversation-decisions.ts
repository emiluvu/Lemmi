import { z } from 'zod';

// Internal server adapter contracts only; not a device command or participant projection.
export const DecisionActivitySchema = z.enum([
  'none',
  'music_playlist',
  'twenty_questions',
  'photo_album',
  'object_matching',
  'teach_lemmi',
]);
export const ConversationDecisionInputSchema = z.strictObject({
  text: z.string().min(1).max(1000),
  language: z.enum(['en', 'de']),
  history: z
    .array(z.strictObject({ role: z.enum(['user', 'assistant']), content: z.string().max(1000) }))
    .max(6),
  topics: z
    .array(
      z.strictObject({
        id: z.string().regex(/^topic_\d{1,2}$/),
        label: z.string().min(2).max(80),
        offered: z.boolean(),
      }),
    )
    .max(12),
});
export const ConversationDecisionSchema = z.strictObject({
  recap: z.boolean(),
  declinesRedirect: z.boolean(),
  redirectTopicIds: z.array(z.string().regex(/^topic_\d{1,2}$/)).max(12),
  activity: DecisionActivitySchema,
});
const probability = z.number().finite().min(0).max(1);
export const DecisionAnswersSchema = z.record(
  z.string(),
  z.discriminatedUnion('type', [
    z.strictObject({ type: z.literal('noul'), noul: probability }),
    z.strictObject({
      type: z.literal('choice'),
      choice: DecisionActivitySchema,
      confidence: probability,
      probabilities: z.record(DecisionActivitySchema, probability),
    }),
  ]),
);
export type ConversationDecisionInput = z.infer<typeof ConversationDecisionInputSchema>;
export type ConversationDecision = z.infer<typeof ConversationDecisionSchema>;
