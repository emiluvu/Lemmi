import { z } from 'zod';
export const IdSchema = z.string().min(1).max(100);
export const RevisionSchema = z.number().int().nonnegative();
export const ErrorCodeSchema = z.enum([
  'UNAUTHORIZED',
  'FORBIDDEN',
  'REVISION_CONFLICT',
  'UNAVAILABLE',
  'NOT_FOUND',
  'VALIDATION_ERROR',
  'SAVE_FAILED',
]);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;
export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ErrorCode; message: string } };
export const ok = <T>(data: T): Result<T> => ({ ok: true, data });
export const fail = (code: ErrorCode, message: string): Result<never> => ({
  ok: false,
  error: { code, message },
});
export const AvatarIdSchema = z.enum(['dog', 'cat', 'bunny', 'bird', 'lemming']);
export type AvatarId = z.infer<typeof AvatarIdSchema>;
export const ExpressionIdSchema = z.enum([
  'idle',
  'listening',
  'processing',
  'speaking',
  'paused',
  'unavailable',
]);
export const CommunicationPresetSchema = z.enum(['conversational', 'guided', 'quiet']);
export const CommunicationSupportSchema = z.strictObject({
  preset: CommunicationPresetSchema,
  configVersion: z.literal(1),
});
export const ParticipantProfileSchema = z.strictObject({
  id: IdSchema,
  preferredName: z.string().min(1).max(80),
  avatarId: AvatarIdSchema,
  revision: RevisionSchema,
  communicationSupport: CommunicationSupportSchema,
});
export type ParticipantProfile = z.infer<typeof ParticipantProfileSchema>;
export const CaregiverProfileSchema = ParticipantProfileSchema.extend({
  source: z.literal('caregiver_provided'),
  interests: z.array(IdSchema).max(20),
  sensitiveTopicGuidance: z.string().max(1000),
  rememberingEnabled: z.boolean(),
  excerptSavingEnabled: z.boolean(),
});
export type CaregiverProfile = z.infer<typeof CaregiverProfileSchema>;
export const PreviewProfileSchema = z.strictObject({
  kind: z.literal('preview'),
  id: IdSchema,
  preferredName: z.string(),
  label: z.literal('Example profile — preview only'),
});
export const EligibilitySnapshotSchema = z.strictObject({
  profileId: IdSchema,
  sessionId: IdSchema,
  policyRevision: RevisionSchema,
  permittedEntityIds: z.array(IdSchema).max(100),
  sessionHiddenIds: z.array(IdSchema).max(100),
  available: z.boolean(),
});
export type EligibilitySnapshot = z.infer<typeof EligibilitySnapshotSchema>;
export const ProfilePreferenceSchema = z.strictObject({
  entityId: IdSchema,
  value: z.enum(['prefer', 'avoid']),
  source: z.enum(['participant_choice', 'caregiver_choice', 'tentative_pattern']),
  revision: RevisionSchema,
});
export const ItemPolicySchema = z.strictObject({
  entityId: IdSchema,
  status: z.enum(['eligible', 'retired']),
  uncertaintySeen: z.boolean(),
  revision: RevisionSchema,
});
export const PreferencesSnapshotSchema = z.strictObject({
  profileId: IdSchema,
  policyRevision: RevisionSchema,
  rememberingEnabled: z.boolean(),
  preferences: z.array(ProfilePreferenceSchema).max(100),
  items: z.array(ItemPolicySchema).max(100),
});
export const PreferenceSignalSchema = z.strictObject({
  commandId: IdSchema,
  sessionId: IdSchema,
  presentationId: IdSchema,
  presentationRevision: RevisionSchema,
  policyRevision: RevisionSchema,
  entityId: IdSchema,
  signal: z.enum(['prefer', 'avoid', 'uncertain']),
});
export const AssetManifestSchema = z.strictObject({
  id: IdSchema,
  version: z.literal(1),
  kind: z.enum(['image', 'music', 'avatar']),
  entityIds: z.array(IdSchema).max(20),
  approved: z.boolean(),
  source: z.string().max(200),
  permission: z.string().max(200),
  caption: z.string().max(300),
  mediaType: z.string().max(80),
  byteLength: z.number().int().nonnegative(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

export type ExpressionId = z.infer<typeof ExpressionIdSchema>;
export type CommunicationPreset = z.infer<typeof CommunicationPresetSchema>;
export type CommunicationSupport = z.infer<typeof CommunicationSupportSchema>;
export type PreviewProfile = z.infer<typeof PreviewProfileSchema>;
export type ProfilePreference = z.infer<typeof ProfilePreferenceSchema>;
export type ItemPolicy = z.infer<typeof ItemPolicySchema>;
export type PreferencesSnapshot = z.infer<typeof PreferencesSnapshotSchema>;
export type PreferenceSignal = z.infer<typeof PreferenceSignalSchema>;
export type AssetManifest = z.infer<typeof AssetManifestSchema>;
