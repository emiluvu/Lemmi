// Fictional contract examples, not a reviewed live catalog or working activity executors.
// Asset IDs resolve to no bytes. Lukas reviews/replaces content before live use.
import {
  ActivityContextSchema,
  ActivityStateSchema,
  ActivityViewSchema,
  ApprovedPackSchema,
  ActivityTransitionSchema,
  type ActivityState,
  type ActivityView,
} from './activity';

export const guessingPackFixture = ApprovedPackSchema.parse({
  id: 'fixture-guessing',
  version: 1,
  approved: true,
  activityId: 'twenty_questions',
  candidates: [
    { id: 'kettle', label: 'A kettle', assetId: 'fixture-kettle', entityIds: ['object:kettle'] },
    { id: 'ball', label: 'A ball', assetId: 'fixture-ball', entityIds: ['object:ball'] },
  ],
  questions: [
    {
      id: 'used-for-tea',
      prompt: 'Is it used for making tea?',
      entityIds: ['object:kettle'],
      branches: {
        yes: { kind: 'guess', candidateId: 'kettle' },
        no: { kind: 'guess', candidateId: 'ball' },
        not_sure: { kind: 'round_end' },
        skip: { kind: 'round_end' },
      },
    },
  ],
  rounds: [
    {
      id: 'everyday-objects',
      candidateIds: ['kettle', 'ball'],
      entryQuestionId: 'used-for-tea',
      reveal: { kind: 'guess', candidateId: 'kettle' },
    },
  ],
});
export const photoPackFixture = ApprovedPackSchema.parse({
  id: 'fixture-photos',
  version: 1,
  approved: true,
  activityId: 'photo_album',
  collectionKind: 'place_scenes',
  entries: [
    {
      id: 'garden',
      assetId: 'fixture-garden',
      caption: 'A garden in spring.',
      discussionContext: 'Fictional generic garden scene; no personal history.',
      entityIds: ['topic:gardening'],
    },
    {
      id: 'garden-no-caption',
      assetId: 'fixture-garden-no-caption',
      caption: null,
      discussionContext: null,
      entityIds: ['topic:gardening'],
    },
  ],
});
export const matchingPackFixture = ApprovedPackSchema.parse({
  id: 'fixture-matching',
  version: 1,
  approved: true,
  activityId: 'object_matching',
  cards: [
    {
      id: 'sample-kettle',
      entityId: 'object:kettle',
      assetId: 'fixture-kettle',
      entityIds: ['object:kettle'],
    },
    {
      id: 'pair-kettle',
      entityId: 'object:kettle',
      assetId: 'fixture-kettle',
      entityIds: ['object:kettle'],
    },
    {
      id: 'choice-ball',
      entityId: 'object:ball',
      assetId: 'fixture-ball',
      entityIds: ['object:ball'],
    },
  ],
});
export const matchingPresentationFixture = {
  instanceId: 'fixture-object_matching',
  presentationId: 'fixture-presentation',
  presentationRevision: 2,
  policyRevision: 0,
};
export const activityContextFixture = ActivityContextSchema.parse({
  eligibility: {
    profileId: 'profile-alex',
    sessionId: 'fixture-session',
    policyRevision: 0,
    permittedEntityIds: ['topic:gardening', 'object:kettle', 'object:ball'],
    sessionHiddenIds: [],
    available: true,
  },
  presentationPolicy: { preset: 'guided', configVersion: 1 },
  matchingPresentation: matchingPresentationFixture,
});

const initialStates: ActivityState[] = [
  {
    activityId: 'music_playlist',
    instanceId: 'fixture-music_playlist',
    revision: 0,
    phase: 'ready',
    currentTrackId: 'garden-track',
    playback: 'stopped',
  },
  {
    activityId: 'twenty_questions',
    instanceId: 'fixture-twenty_questions',
    revision: 0,
    phase: 'active',
    roundId: 'everyday-objects',
    questionId: 'used-for-tea',
    guessCandidateId: null,
    roundPhase: 'asking',
    questionsAsked: 1,
  },
  {
    activityId: 'photo_album',
    instanceId: 'fixture-photo_album',
    revision: 0,
    phase: 'ready',
    currentPhotoId: 'garden',
    position: 0,
    viewingMode: 'just_look',
  },
  {
    activityId: 'object_matching',
    instanceId: 'fixture-object_matching',
    revision: 0,
    phase: 'ready',
    sampleCardId: 'sample-kettle',
    choiceIds: ['pair-kettle', 'choice-ball'],
    selectedChoiceId: null,
    pairShown: false,
    presentation: matchingPresentationFixture,
  },
];
export const activityStateFixtures = initialStates.flatMap((state) => [
  ActivityStateSchema.parse(state),
  ActivityStateSchema.parse({ ...state, phase: 'paused', revision: 1 }),
  ActivityStateSchema.parse({ ...state, phase: 'ended', revision: 2 }),
]);

// UI samples of each activity at its initial/paused/ended phase. Safe projections are
// handcrafted fixtures; they are not implementations of Lukas's projectActivity.
export const activityScreenFixtures: ActivityView[] = activityStateFixtures.map((state) => {
  const enabled = state.phase === 'ready' || state.phase === 'active';
  const base = {
    instanceId: state.instanceId,
    revision: state.revision,
    phase: state.phase,
    title: 'Contract fixture only',
    prompt: null,
    assetIds: [],
    choices: [],
    capabilities: { audioRequired: false, largeScreenPreferred: true },
  };
  switch (state.activityId) {
    case 'music_playlist':
      return ActivityViewSchema.parse({
        ...base,
        activityId: state.activityId,
        currentTrackId: state.currentTrackId,
        playback: state.playback,
      });
    case 'twenty_questions':
      return ActivityViewSchema.parse({
        ...base,
        activityId: state.activityId,
        question: 'Is it used for making tea?',
        offeredGuess: null,
        roundPhase: state.roundPhase,
        choices: enabled
          ? [
              { id: 'yes', label: 'Yes', action: { type: 'guess.answer', answer: 'yes' } },
              { id: 'no', label: 'No', action: { type: 'guess.answer', answer: 'no' } },
              {
                id: 'not-sure',
                label: 'Not sure',
                action: { type: 'guess.answer', answer: 'not_sure' },
              },
              { id: 'skip', label: 'Skip', action: { type: 'guess.skip' } },
              { id: 'reveal', label: 'Show me', action: { type: 'guess.reveal' } },
              { id: 'finish', label: 'Finish', action: { type: 'activity.leave' } },
            ]
          : [],
      });
    case 'photo_album':
      return ActivityViewSchema.parse({
        ...base,
        activityId: state.activityId,
        assetIds: ['fixture-garden'],
        currentAssetId: 'fixture-garden',
        caption: 'A garden in spring.',
        viewingMode: state.viewingMode,
        choices: enabled
          ? [
              { id: 'next', label: 'Next photo', action: { type: 'photo.next' } },
              { id: 'previous', label: 'Previous photo', action: { type: 'photo.previous' } },
              { id: 'look', label: 'Just look', action: { type: 'photo.just_look' } },
              { id: 'talk', label: 'Talk about this photo', action: { type: 'photo.talk' } },
              { id: 'finish', label: 'Finish', action: { type: 'activity.leave' } },
            ]
          : [],
      });
    case 'object_matching':
      return ActivityViewSchema.parse({
        ...base,
        activityId: state.activityId,
        prompt: 'We can find the same picture, or just look.',
        assetIds: ['fixture-kettle', 'fixture-ball'],
        sampleAssetId: 'fixture-kettle',
        candidateAssetIds: ['fixture-kettle', 'fixture-ball'],
        presentation: state.presentation,
        pairShown: state.pairShown,
        choices: enabled
          ? [
              {
                id: 'pair-kettle',
                label: 'First picture',
                action: { type: 'match.select', choiceId: 'pair-kettle' },
              },
              {
                id: 'choice-ball',
                label: 'Second picture',
                action: { type: 'match.select', choiceId: 'choice-ball' },
              },
              { id: 'show', label: 'Show me', action: { type: 'match.show' } },
              { id: 'not-sure', label: 'Not sure', action: { type: 'match.not_sure' } },
              { id: 'next', label: 'Another picture', action: { type: 'match.next' } },
              { id: 'finish', label: 'Finish', action: { type: 'match.finish' } },
            ]
          : [],
      });
  }
});
export const activityTransitionFixtures = initialStates.map((state) =>
  ActivityTransitionSchema.parse({
    nextState: { ...state, revision: 1, phase: 'paused' },
    events: [{ type: 'activity_paused', reason: 'camera' }],
    effects: [{ type: 'stop_media' }],
  }),
);
export const matchingSignalFixtures = [
  {
    type: 'preference.signal',
    entityId: 'object:kettle',
    signal: 'prefer',
    presentation: matchingPresentationFixture,
  },
  {
    type: 'preference.signal',
    entityId: 'object:kettle',
    signal: 'avoid',
    presentation: matchingPresentationFixture,
  },
  { type: 'item.uncertain', entityId: 'object:kettle', presentation: matchingPresentationFixture },
] as const;
