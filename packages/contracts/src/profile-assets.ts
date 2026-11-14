import { z } from 'zod';
import { SessionSnapshotSchema } from './session';
import {
  AvatarIdSchema,
  CaregiverProfileSchema,
  CommunicationSupportSchema,
  IdSchema,
  RevisionSchema,
} from './common';

export const ApprovedFactSchema = z.strictObject({
  id: z.uuid(),
  field: z.enum(['familiar_person', 'interest_context', 'personal_context']),
  value: z.string().trim().min(1).max(200),
  source: z.literal('caregiver_provided'),
});
export const ProfileDetailSchema = CaregiverProfileSchema.extend({
  privacyRevision: RevisionSchema,
  policyRevision: RevisionSchema,
  approvedFacts: z.array(ApprovedFactSchema).max(10),
});
const ProfilePatchSchema = z
  .strictObject({
    preferredName: z.string().trim().min(1).max(80).optional(),
    avatarId: AvatarIdSchema.optional(),
    communicationSupport: CommunicationSupportSchema.optional(),
    interests: z.array(IdSchema).max(20).optional(),
    sensitiveTopicGuidance: z.string().max(1000).optional(),
    approvedFacts: z.array(ApprovedFactSchema).max(10).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Provide an explicit profile change')
  .refine(
    (value) =>
      !value.approvedFacts ||
      new Set(value.approvedFacts.map((fact) => fact.id)).size === value.approvedFacts.length,
    'Fact IDs must be distinct',
  );
export const ProfileUpdateSchema = z.strictObject({
  profileId: IdSchema,
  expectedRevision: RevisionSchema,
  commandId: IdSchema,
  patch: ProfilePatchSchema,
});
// Applies the already-saved profile preset. Saving alone remains future-session only.
export const ApplyCommunicationSupportSchema = z.strictObject({
  profileId: IdSchema,
  expectedProfileRevision: RevisionSchema,
  sessionId: IdSchema,
  expectedGeneration: RevisionSchema,
  commandId: IdSchema,
});
export type ApplyCommunicationSupport = z.infer<typeof ApplyCommunicationSupportSchema>;
export const CommunicationSupportStateSchema = z.strictObject({
  profileId: IdSchema,
  profileRevision: RevisionSchema,
  saved: CommunicationSupportSchema,
  session: SessionSnapshotSchema.nullable(),
});
export type CommunicationSupportState = z.infer<typeof CommunicationSupportStateSchema>;
export const AssetIdSchema = z.uuid();
export const AssetMetadataSchema = z.strictObject({
  id: AssetIdSchema,
  profileId: IdSchema,
  version: z.literal(1),
  kind: z.enum(['image', 'music']),
  mediaType: z.enum(['image/png', 'audio/wav']),
  byteLength: z
    .number()
    .int()
    .min(1)
    .max(20 * 1024 * 1024),
  width: z.number().int().positive().max(4096).optional(),
  height: z.number().int().positive().max(4096).optional(),
  caption: z.string().max(300),
  entityIds: z.array(IdSchema).min(1).max(20),
  approved: z.literal(true),
});
export const AssetCreateSchema = z.strictObject({
  profileId: IdSchema,
  commandId: IdSchema,
  expectedRevision: RevisionSchema,
  kind: z.enum(['image', 'music']),
  mediaType: z.enum(['image/png', 'audio/wav']),
  source: z.string().trim().min(1).max(200),
  permission: z.string().trim().min(1).max(200),
  caption: z.string().max(300),
  discussionContext: z.string().max(1000).nullable(),
  entityIds: z.array(IdSchema).min(1).max(20),
  approved: z.literal(true),
  dataBase64: z.string().min(4).max(27962028),
});
export type ProfileDetail = z.infer<typeof ProfileDetailSchema>;
export type ProfileUpdate = z.infer<typeof ProfileUpdateSchema>;
export type AssetMetadata = z.infer<typeof AssetMetadataSchema>;
export type AssetCreate = z.infer<typeof AssetCreateSchema>;

export const DataRequestSchema = z.discriminatedUnion('operation', [
  z.strictObject({
    operation: z.literal('profile.read'),
    profileId: IdSchema,
    caregiver: z.boolean(),
  }),
  z.strictObject({ operation: z.literal('profile.update'), input: ProfileUpdateSchema }),
  z.strictObject({ operation: z.literal('support.apply'), input: ApplyCommunicationSupportSchema }),
  z.strictObject({ operation: z.literal('support.read'), profileId: IdSchema }),
  z.strictObject({ operation: z.literal('asset.create'), input: AssetCreateSchema }),
  z.strictObject({
    operation: z.literal('asset.read'),
    assetId: AssetIdSchema,
    bytes: z.boolean(),
  }),
]);

export const ProfileCreateSchema = z.strictObject({
  preferredName: z.string().trim().min(1).max(80),
  avatarId: AvatarIdSchema.default('lemming'),
});
export const DemoSetupRequestSchema = z.discriminatedUnion('operation', [
  z.strictObject({ operation: z.literal('profile.list') }),
  z.strictObject({
    operation: z.literal('endpoint.current'),
    endpoint: z.enum(['browser', 'robot']).optional(),
    credential: z.string().min(40).max(100),
  }),
  z.strictObject({
    operation: z.literal('endpoint.release'),
    endpoint: z.enum(['browser', 'robot']).optional(),
    credential: z.string().min(40).max(100),
  }),
  z.strictObject({ operation: z.literal('profile.create'), input: ProfileCreateSchema }),
  z.strictObject({
    operation: z.literal('endpoint.enroll'),
    profileId: IdSchema,
    endpoint: z.enum(['browser', 'robot']),
    deviceId: IdSchema.optional(),
    previousCredential: z.string().min(40).max(100).optional(),
    previousEndpoint: z.enum(['browser', 'robot']).optional(),
  }),
]);
