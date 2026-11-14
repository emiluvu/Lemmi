import { z } from 'zod';
import { CommunicationSupportSchema, RevisionSchema, type CommunicationSupport } from './common';

// Prototype presentation choices, not clinical thresholds. One server-resolved
// preset feeds conversation and activity presentation; it changes no permissions.
export function resolveCommunicationSupport(value: CommunicationSupport) {
  const support = CommunicationSupportSchema.parse(value);
  const choices = {
    conversational: {
      maxReplyCharacters: 600,
      maxQuestions: 1,
      instruction:
        'Use one or two short sentences. An open invitation is optional; ask at most one question.',
    },
    guided: {
      maxReplyCharacters: 360,
      maxQuestions: 1,
      instruction:
        'Express one short idea. Prefer a yes/no question or two concrete choices, with at most one question.',
    },
    quiet: {
      maxReplyCharacters: 240,
      maxQuestions: 0,
      instruction:
        'Give a brief acknowledgment or approved caption. Use declarative sentences only: no questions or question marks, including when the participant asks to change topic. Do not ask an unsolicited follow-up question; then wait.',
    },
  } as const;
  return { ...support, ...choices[support.preset] };
}

// Same fictional topic at every setting. Samples never invoke a model, capture,
// playback or profile save. Kylie can render these through the existing selector.
export const communicationSupportPreviews = [
  {
    preset: 'conversational',
    configVersion: 1,
    sample: true,
    topic: 'Fictional gardening example',
    text: 'Flowers can bring colour to a garden. What do you enjoy about them?',
  },
  {
    preset: 'guided',
    configVersion: 1,
    sample: true,
    topic: 'Fictional gardening example',
    text: 'Would you like to look at some flowers?',
  },
  {
    preset: 'quiet',
    configVersion: 1,
    sample: true,
    topic: 'Fictional gardening example',
    text: 'Here are some flowers.',
  },
] as const;

// Configuration provenance for backend checkpointing, deliberately absent from
// participant profiles, device snapshots and model context.
export const SupportSelectionSchema = z
  .strictObject({
    id: z.uuid(),
    generation: RevisionSchema,
    profileRevision: RevisionSchema,
    support: CommunicationSupportSchema,
    source: z.enum(['profile_default', 'caregiver_apply']),
    actorSubject: z.string().min(1).max(200).nullable(),
    selectedAt: z.string().datetime(),
  })
  .refine((s) => (s.source === 'caregiver_apply') === (s.actorSubject !== null));
export type SupportSelection = z.infer<typeof SupportSelectionSchema>;
