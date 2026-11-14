import {
  ParticipantProfileSchema,
  CaregiverProfileSchema,
  PreviewProfileSchema,
  PreferencesSnapshotSchema,
  type ActivityContext,
  type ApprovedPack,
  CheckInSnapshotSchema,
  ActivityViewSchema,
} from './index';
export const DEMO_PROFILE_ID = 'profile-alex';
export const participantProfile = ParticipantProfileSchema.parse({
  id: DEMO_PROFILE_ID,
  preferredName: 'Alex',
  avatarId: 'lemming',
  revision: 0,
  communicationSupport: { preset: 'guided', configVersion: 1 },
});
export const caregiverProfile = CaregiverProfileSchema.parse({
  ...participantProfile,
  source: 'caregiver_provided',
  interests: ['topic:gardening'],
  sensitiveTopicGuidance: 'Do not invent personal facts.',
  rememberingEnabled: false,
  excerptSavingEnabled: false,
});
export const previewProfiles = ['Morgan', 'Sam'].map((name) =>
  PreviewProfileSchema.parse({
    kind: 'preview',
    id: `preview-${name.toLowerCase()}`,
    preferredName: name,
    label: 'Example profile — preview only',
  }),
);
export const preferences = PreferencesSnapshotSchema.parse({
  profileId: DEMO_PROFILE_ID,
  policyRevision: 0,
  rememberingEnabled: false,
  preferences: [],
  items: [],
});
export const disabledCheckIn = CheckInSnapshotSchema.parse({
  checkInId: 'checkin-disabled',
  profileId: DEMO_PROFILE_ID,
  deviceId: 'fake-stackchan',
  revision: 0,
  privacyRevision: 0,
  state: 'off',
  viewerDisplayName: 'Demo caregiver',
  requestedAt: null,
  allowedAt: null,
  expiresAt: null,
  reason: 'disabled',
  latestFrameSequence: null,
  fresh: false,
  mode: 'mock',
});
export const musicPack: ApprovedPack = {
  id: 'music-demo',
  version: 1,
  activityId: 'music_playlist',
  approved: true,
  tracks: [
    {
      id: 'garden-track',
      title: 'Garden sample (transport only; no audio asset)',
      assetId: 'asset-music-placeholder',
      entityIds: ['topic:gardening'],
    },
  ],
};
export const contextFor = (sessionId: string): ActivityContext => ({
  eligibility: {
    profileId: DEMO_PROFILE_ID,
    sessionId,
    policyRevision: 0,
    permittedEntityIds: ['topic:gardening'],
    sessionHiddenIds: [],
    available: true,
  },
  presentationPolicy: { preset: 'guided', configVersion: 1 },
});
export const activityViewFixtures = [
  {
    activityId: 'music_playlist',
    currentTrackId: 'garden-track',
    playback: 'stopped',
    capabilities: { audioRequired: true, largeScreenPreferred: false },
  },
  {
    activityId: 'twenty_questions',
    question: null,
    capabilities: { audioRequired: false, largeScreenPreferred: true },
  },
  {
    activityId: 'photo_album',
    currentAssetId: null,
    caption: null,
    viewingMode: 'just_look',
    capabilities: { audioRequired: false, largeScreenPreferred: true },
  },
  {
    activityId: 'object_matching',
    sampleAssetId: null,
    candidateAssetIds: [],
    presentationId: 'presentation-placeholder',
    presentationRevision: 0,
    capabilities: { audioRequired: false, largeScreenPreferred: true },
  },
].map((fields) =>
  ActivityViewSchema.parse({
    instanceId: `fixture-${fields.activityId}`,
    revision: 0,
    phase: 'unavailable',
    title: fields.activityId,
    prompt: 'UI fixture only — activity implementation pending',
    assetIds: [],
    choices: [],
    ...fields,
  }),
);
export const mockErrors = [
  'UNAUTHORIZED',
  'FORBIDDEN',
  'REVISION_CONFLICT',
  'UNAVAILABLE',
  'NOT_FOUND',
  'VALIDATION_ERROR',
  'SAVE_FAILED',
] as const;

// UI-only scenario snapshots. None can send messages, enable capture, or imply hardware proof.
export const helpStateFixtures = [
  'sending',
  'accepted',
  'delivery_unknown',
  'delivered',
  'acknowledged',
  'failed',
  'no_response',
].map((status) => ({
  id: 'fixture-help',
  profileId: DEMO_PROFILE_ID,
  status,
  mode: 'simulation' as const,
  reason: 'manual' as const,
  message: 'Demo help — no real message will be sent',
}));
export const checkInStateFixtures = [
  'off',
  'requested',
  'starting',
  'active',
  'ended',
  'unavailable',
].map((state) =>
  CheckInSnapshotSchema.parse({
    ...disabledCheckIn,
    state,
    fresh: false,
    reason:
      state === 'requested'
        ? 'awaiting_allow'
        : state === 'unavailable'
          ? 'unsupported'
          : 'disabled',
  }),
);
export const speechPolicyFixtures = ['conversational', 'guided', 'quiet'].map((preset) => ({
  preset,
  configVersion: 1 as const,
}));
