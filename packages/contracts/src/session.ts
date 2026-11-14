import { z } from 'zod';
import { IdSchema, RevisionSchema, CommunicationSupportSchema } from './common';
export const SessionPhaseSchema = z.enum([
  'ready',
  'listening',
  'processing',
  'speaking',
  'waiting',
  'paused',
  'unavailable',
  'ended',
]);
export const EndpointSchema = z.enum(['browser', 'robot']);
export const CaptureGrantSchema = z.strictObject({
  turnId: IdSchema,
  generation: RevisionSchema,
  leaseId: IdSchema,
  streamId: IdSchema,
  language: z.enum(['en', 'de']),
  expiresAt: z.string().datetime(),
});
export const TeachingSnapshotSchema = z.strictObject({
  mode: z.literal('teach_lemmi'),
  entityId: IdSchema.nullable(),
  assetId: IdSchema.nullable(),
  topicLabel: z.string().max(80).nullable(),
  prompt: z.string().max(300).nullable(),
  presentationId: IdSchema,
  revision: RevisionSchema,
  policyRevision: RevisionSchema,
  phase: z.enum(['ready', 'listening', 'processing', 'paused', 'unavailable']),
});
export const SessionSnapshotSchema = z
  .strictObject({
    id: IdSchema,
    profileId: IdSchema,
    generation: RevisionSchema,
    profileRevision: RevisionSchema,
    privacyRevision: RevisionSchema,
    policyRevision: RevisionSchema,
    phase: SessionPhaseSchema,
    endpoint: EndpointSchema,
    activeEndpointId: IdSchema.optional(),
    leaseId: IdSchema,
    micMuted: z.boolean(),
    captureGrant: CaptureGrantSchema.nullable(),
    communicationSupport: CommunicationSupportSchema,
    conversationMode: z.enum(['open', 'teach_lemmi']),
    teaching: TeachingSnapshotSchema.nullable(),
    mode: z.enum(['mock', 'live']),
  })
  .refine(
    (s) =>
      s.captureGrant === null ||
      (s.phase === 'listening' &&
        !s.micMuted &&
        s.captureGrant.generation === s.generation &&
        s.captureGrant.leaseId === s.leaseId),
    'Capture grant requires current listening permission',
  );
export type SessionSnapshot = z.infer<typeof SessionSnapshotSchema>;
export const SessionActionSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.enum([
      'pause',
      'resume',
      'stop',
      'speak',
      'turn_end',
      'teaching.start',
      'teaching.next',
      'teaching.not_sure',
      'teaching.finish',
      'teaching.prefer',
      'teaching.avoid',
    ]),
  }),
  z.strictObject({ type: z.literal('mute'), muted: z.boolean() }),
  z.strictObject({ type: z.literal('handoff'), endpoint: EndpointSchema }),
]);
export const SessionCommandSchema = z.strictObject({
  commandId: IdSchema,
  sessionId: IdSchema,
  expectedGeneration: RevisionSchema,
  action: SessionActionSchema,
});
export type SessionCommand = z.infer<typeof SessionCommandSchema>;
