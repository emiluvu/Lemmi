import { z } from 'zod';
import { AvatarIdSchema, CommunicationSupportSchema, IdSchema, RevisionSchema } from './common';

const short = z.string().trim().max(200);
export const ProfileContextSchema = z.strictObject({
  career: short.default(''),
  importantPeople: z
    .array(z.strictObject({ name: short, relationship: short }))
    .max(8)
    .default([]),
  activities: z.array(short).max(8).default([]),
  pets: short.default(''),
  favourites: z
    .strictObject({
      color: short.default(''),
      animal: short.default(''),
      season: short.default(''),
      flower: short.default(''),
      meal: short.default(''),
      foodDrink: short.default(''),
      holiday: short.default(''),
      restaurant: short.default(''),
    })
    .default({
      color: '',
      animal: '',
      season: '',
      flower: '',
      meal: '',
      foodDrink: '',
      holiday: '',
      restaurant: '',
    }),
  biography: z.string().trim().max(1000).default(''),
  comfortableTopics: z.array(z.string().trim().min(2).max(80)).max(12).default([]),
  avoidTopics: z.array(z.string().trim().min(2).max(80)).max(12).default([]),
  photos: z
    .array(
      z.strictObject({
        assetId: z.uuid(),
        description: z.string().trim().max(300),
        portrait: z.boolean(),
      }),
    )
    .max(5)
    .default([])
    .refine(
      (photos) =>
        photos.filter((photo) => photo.portrait).length <= 1 &&
        new Set(photos.map((photo) => photo.assetId)).size === photos.length,
      'Use unique pictures and only one profile picture',
    ),
});
export type ProfileContext = z.infer<typeof ProfileContextSchema>;
export const ConversationMemorySchema = z.strictObject({
  sessionId: IdSchema,
  summary: z.string().max(300),
  source: z.literal('ai_summary'),
  updatedAt: z.string().datetime(),
});
export type ConversationMemory = z.infer<typeof ConversationMemorySchema>;
export const ProfileContextViewSchema = z.strictObject({
  profileId: IdSchema,
  revision: RevisionSchema,
  preferredName: z.string(),
  avatarId: AvatarIdSchema,
  communicationSupport: CommunicationSupportSchema,
  context: ProfileContextSchema,
  summaryMemoryEnabled: z.boolean(),
  memories: z.array(ConversationMemorySchema).max(10),
});
export type ProfileContextView = z.infer<typeof ProfileContextViewSchema>;
export const ProfileContextReadSchema = z.strictObject({ profileId: IdSchema });
export const ProfileContextCommandSchema = z.strictObject({
  profileId: IdSchema,
  expectedRevision: RevisionSchema,
  commandId: IdSchema,
});
export const ProfileContextUpdateSchema = z.strictObject({
  profileId: IdSchema,
  expectedRevision: RevisionSchema,
  commandId: IdSchema,
  preferredName: z.string().trim().min(1).max(80),
  avatarId: AvatarIdSchema,
  communicationSupport: CommunicationSupportSchema,
  context: ProfileContextSchema,
  summaryMemoryEnabled: z.boolean(),
});
export const ProfileImageUploadSchema = z.strictObject({
  profileId: IdSchema,
  expectedRevision: RevisionSchema,
  commandId: IdSchema,
  dataBase64: z.string().max(1400000),
  description: z.string().trim().max(300),
});
export const ProfileImageReadSchema = z.strictObject({ profileId: IdSchema, assetId: z.uuid() });
export const ProfileImageDataSchema = z.strictObject({
  dataBase64: z.string().max(1400000),
  mediaType: z.literal('image/png'),
});
