import {
  ParticipantProfileSchema,
  CaregiverProfileSchema,
  PreviewProfileSchema,
  PreferencesSnapshotSchema,
  type ActivityContext,
  type ApprovedPack,
  CheckInSnapshotSchema,
  ActivityViewSchema,
  DeviceEventSchema,
  ServerEventSchema,
  SessionSnapshotSchema,
} from './index';
export * from './activity-fixtures';
export const DEMO_PROFILE_ID = 'profile-alex';
export const participantProfile = ParticipantProfileSchema.parse({
  id: DEMO_PROFILE_ID,
  preferredName: 'Alex',
  avatarId: 'lemming',
  revision: 0,
  communicationSupport: { preset: 'guided', configVersion: 1 },
});
// Fictional protocol examples only. No pairing codes, bearer tokens or media payloads.
export const controlHelloFixture = DeviceEventSchema.parse({
  protocol_version: 1,
  event_id: 'fixture-hello',
  session_id: null,
  turn_id: null,
  generation: 0,
  sequence: 0,
  type: 'device.hello',
  payload: {
    firmwareVersion: 'control-fixture/0.1',
    cameraSupported: false,
    pettingSupported: false,
    audio: { supported: false },
  },
});
export const controlSessionFixture = SessionSnapshotSchema.parse({
  id: 'fixture-control-session',
  profileId: DEMO_PROFILE_ID,
  generation: 1,
  profileRevision: 0,
  privacyRevision: 0,
  policyRevision: 0,
  phase: 'paused',
  endpoint: 'robot',
  leaseId: 'fixture-control-lease',
  micMuted: true,
  captureGrant: null,
  communicationSupport: participantProfile.communicationSupport,
  conversationMode: 'open',
  teaching: null,
  mode: 'live',
});
export const controlEventFixtures = [
  'heartbeat',
  'input.start',
  'input.pause',
  'input.resume',
  'input.stop',
  'input.mute',
  'input.help',
].map((type, index) =>
  DeviceEventSchema.parse({
    protocol_version: 1,
    event_id: `fixture-${type}`,
    session_id: ['heartbeat', 'input.start', 'input.help'].includes(type)
      ? null
      : controlSessionFixture.id,
    turn_id: null,
    generation: ['heartbeat', 'input.start', 'input.help'].includes(type)
      ? 0
      : controlSessionFixture.generation,
    sequence: index + 1,
    type,
    payload: type === 'input.mute' ? { muted: true } : {},
  }),
);
const controlServerEnvelope = {
  protocol_version: 1,
  session_id: controlSessionFixture.id,
  turn_id: null,
  generation: controlSessionFixture.generation,
};
export const controlServerEventFixtures = [
  {
    type: 'device.ready',
    payload: {
      mode: 'live',
      deviceId: 'stackchan-alex',
      profileId: DEMO_PROFILE_ID,
      credentialExpiresAt: '2026-11-13T20:00:00.000Z',
      audio: false,
      camera: false,
      controls: ['start', 'stop', 'pause', 'resume', 'mute', 'help'],
    },
  },
  { type: 'command.ack', payload: { mode: 'live', commandId: 'fixture-pause', applied: true } },
  { type: 'state.changed', payload: { mode: 'live', session: controlSessionFixture } },
  { type: 'heartbeat', payload: { mode: 'live' } },
  {
    type: 'error',
    payload: {
      code: 'UNAVAILABLE',
      commandId: 'fixture-input.help',
      message: 'Caregiver contact is not configured; no request was created or sent',
    },
  },
].map((event, index) =>
  ServerEventSchema.parse({
    ...controlServerEnvelope,
    event_id: `fixture-server-${index}`,
    sequence: index,
    ...event,
  }),
);
export const caregiverProfile = CaregiverProfileSchema.parse({
  ...participantProfile,
  source: 'caregiver_provided',
  interests: ['topic:gardening', 'topic:beaches', 'topic:banking'],
  sensitiveTopicGuidance:
    'Do not invent personal facts. Avoid proactively introducing cooking, including cooking photos and activities. Banking conversation must not solicit account details or give financial advice. Never quiz family identities or recall. Unknown family status and personal details remain unknown.',
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
  matchingPresentation: null,
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
    offeredGuess: null,
    roundPhase: 'ready',
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
    presentation: null,
    pairShown: false,
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
