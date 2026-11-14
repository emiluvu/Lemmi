import { z } from 'zod';
import {
  IdSchema,
  RevisionSchema,
  EligibilitySnapshotSchema,
  CommunicationSupportSchema,
} from './common';
export const ActivityIdSchema = z.enum([
  'music_playlist',
  'twenty_questions',
  'photo_album',
  'object_matching',
]);
export type ActivityId = z.infer<typeof ActivityIdSchema>;
export const ActivityActionSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('track.select'), trackId: IdSchema }),
  z.strictObject({
    type: z.enum([
      'track.play',
      'track.pause',
      'track.next',
      'guess.skip',
      'guess.reveal',
      'guess.new_round',
      'photo.next',
      'photo.previous',
      'photo.just_look',
      'photo.talk',
      'match.show',
      'match.not_sure',
      'match.next',
      'match.finish',
      'activity.leave',
    ]),
  }),
  z.strictObject({ type: z.literal('guess.answer'), answer: z.enum(['yes', 'no', 'not_sure']) }),
  z.strictObject({ type: z.literal('photo.select'), photoId: IdSchema }),
  z.strictObject({ type: z.literal('match.select'), choiceId: IdSchema }),
]);
export type ActivityAction = z.infer<typeof ActivityActionSchema>;
export const ActivityCommandSchema = z.strictObject({
  commandId: IdSchema,
  sessionId: IdSchema,
  instanceId: IdSchema,
  expectedRevision: RevisionSchema,
  action: ActivityActionSchema,
});
export type ActivityCommand = z.infer<typeof ActivityCommandSchema>;
export const ActivityContextSchema = z.strictObject({
  eligibility: EligibilitySnapshotSchema,
  presentationPolicy: CommunicationSupportSchema,
});
export type ActivityContext = z.infer<typeof ActivityContextSchema>;
const TrackSchema = z.strictObject({
  id: IdSchema,
  title: z.string().max(100),
  assetId: IdSchema,
  entityIds: z.array(IdSchema).max(20),
});
export const ApprovedPackSchema = z.discriminatedUnion('activityId', [
  z.strictObject({
    id: IdSchema,
    version: z.literal(1),
    activityId: z.literal('music_playlist'),
    approved: z.literal(true),
    tracks: z.array(TrackSchema).min(1).max(20),
  }),
  z.strictObject({
    id: IdSchema,
    version: z.literal(1),
    activityId: z.literal('twenty_questions'),
    approved: z.literal(true),
    candidateIds: z.array(IdSchema).max(20),
  }),
  z.strictObject({
    id: IdSchema,
    version: z.literal(1),
    activityId: z.literal('photo_album'),
    approved: z.literal(true),
    collectionKind: z.enum(['album', 'place_scenes']),
    entries: z
      .array(
        z.strictObject({
          assetId: IdSchema,
          caption: z.string().max(300),
          entityIds: z.array(IdSchema).max(20),
        }),
      )
      .max(20),
  }),
  z.strictObject({
    id: IdSchema,
    version: z.literal(1),
    activityId: z.literal('object_matching'),
    approved: z.literal(true),
    cards: z.array(z.strictObject({ entityId: IdSchema, assetId: IdSchema })).max(20),
  }),
]);
export type ApprovedPack = z.infer<typeof ApprovedPackSchema>;
const base = {
  instanceId: IdSchema,
  revision: RevisionSchema,
  phase: z.enum(['ready', 'active', 'paused', 'ended', 'unavailable']),
  title: z.string(),
  prompt: z.string().nullable(),
  assetIds: z.array(IdSchema).max(20),
  choices: z
    .array(z.strictObject({ id: IdSchema, label: z.string(), action: ActivityActionSchema }))
    .max(20),
  capabilities: z.strictObject({ audioRequired: z.boolean(), largeScreenPreferred: z.boolean() }),
};
export const ActivityViewSchema = z.discriminatedUnion('activityId', [
  z.strictObject({
    ...base,
    activityId: z.literal('music_playlist'),
    currentTrackId: IdSchema.nullable(),
    playback: z.enum(['stopped', 'requested', 'playing', 'paused', 'failed']),
  }),
  z.strictObject({
    ...base,
    activityId: z.literal('twenty_questions'),
    question: z.string().nullable(),
  }),
  z.strictObject({
    ...base,
    activityId: z.literal('photo_album'),
    currentAssetId: IdSchema.nullable(),
    caption: z.string().nullable(),
    viewingMode: z.enum(['just_look', 'talk']),
  }),
  z.strictObject({
    ...base,
    activityId: z.literal('object_matching'),
    sampleAssetId: IdSchema.nullable(),
    candidateAssetIds: z.array(IdSchema).max(2),
    presentationId: IdSchema,
    presentationRevision: RevisionSchema,
  }),
]);
export type ActivityView = z.infer<typeof ActivityViewSchema>;
export const PlaybackReceiptSchema = z.strictObject({
  instanceId: IdSchema,
  effectId: IdSchema,
  generation: RevisionSchema,
  leaseId: IdSchema,
  sequence: RevisionSchema,
  status: z.enum(['playing', 'paused', 'ended', 'failed']),
});
export type ValidatedPlaybackReceipt = z.infer<typeof PlaybackReceiptSchema>;
export const ActivitySystemInputSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('system.pause'),
    reason: z.enum(['participant', 'camera', 'help', 'disconnect', 'handoff', 'config_change']),
  }),
  z.strictObject({ type: z.enum(['system.resume', 'system.eligibility_changed']) }),
  z.strictObject({
    type: z.literal('system.end'),
    reason: z.enum(['stop', 'session_end', 'revoked']),
  }),
  z.strictObject({ type: z.literal('system.playback_receipt'), receipt: PlaybackReceiptSchema }),
]);
export type ActivitySystemInput = z.infer<typeof ActivitySystemInputSchema>;
export const ActivityEffectSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('play_approved_track'), assetId: IdSchema }),
  z.strictObject({ type: z.enum(['stop_media', 'request_listening']) }),
  z.strictObject({ type: z.literal('speak_approved_text'), textId: IdSchema }),
  z.strictObject({ type: z.literal('offer_photo_conversation'), assetId: IdSchema }),
  z.strictObject({
    type: z.enum(['preference.signal', 'item.uncertain']),
    entityId: IdSchema,
    presentationId: IdSchema,
    presentationRevision: RevisionSchema,
  }),
]);
export type ActivityEffect = z.infer<typeof ActivityEffectSchema>;
export const ActivityStateSchema = z.discriminatedUnion('activityId', [
  z.strictObject({
    activityId: z.literal('music_playlist'),
    instanceId: IdSchema,
    revision: RevisionSchema,
    phase: z.enum(['ready', 'active', 'paused', 'ended', 'unavailable']),
    currentTrackId: IdSchema.nullable(),
    playback: z.enum(['stopped', 'requested', 'playing', 'paused', 'failed']),
  }),
  z.strictObject({
    activityId: z.enum(['twenty_questions', 'photo_album', 'object_matching']),
    instanceId: IdSchema,
    revision: RevisionSchema,
    phase: z.literal('unavailable'),
  }),
]);
export type ActivityState = z.infer<typeof ActivityStateSchema>;
export type ActivityTransition = {
  nextState: ActivityState;
  events: { type: 'track_selected' | 'track_play_requested' | 'activity_ended'; itemId?: string }[];
  effects: ActivityEffect[];
};
export type StartActivityInput = { instanceId: string };
