// One-shot fictional rehearsal: uses the same pure activity functions, no service calls.
import {
  createActivity,
  reduceActivity,
  projectActivity,
  preparePhotoStoryTurn,
  applyActivitySystemInput,
  type PhotoStoryInput,
} from '@lemmi/activities';
import { SessionSnapshotSchema } from '@lemmi/contracts';
import {
  contextFor,
  participantProfile,
  controlSessionFixture,
  photoPackFixture,
} from '@lemmi/contracts/fixtures';

const context = contextFor('photo-story-rehearsal');
const session = SessionSnapshotSchema.parse({
  ...controlSessionFixture,
  id: context.eligibility.sessionId,
  phase: 'ready',
  profileRevision: participantProfile.revision,
});
const initial = createActivity({ instanceId: 'photo-story-example' }, photoPackFixture, context);
console.log(
  'Photo Story: fictional preparation rehearsal only. No photo bytes, AI or speech services.',
);
console.log('Participant:', participantProfile.preferredName);
console.log('Initial view:', projectActivity(initial, photoPackFixture, context));
const talk = reduceActivity(initial, { type: 'photo.talk' }, photoPackFixture, context);
const input: PhotoStoryInput = {
  profile: participantProfile,
  session,
  state: talk.nextState,
  pack: photoPackFixture,
  context,
  photoAvailable: true, // Explicit simulated read success; no actual image bytes exist here.
  approvedFacts: [
    {
      profileId: participantProfile.id,
      source: 'caregiver_provided',
      entityIds: ['topic:gardening'],
      value: 'Gardening is a caregiver-provided interest.',
    },
  ],
  turn: { kind: 'opening' },
};
console.log('Requested effect (not executed):', talk.effects);
console.log('Opening context (not a generated question):', preparePhotoStoryTurn(input));
console.log(
  'Fictional Roses answer preparation:',
  preparePhotoStoryTurn({ ...input, turn: { kind: 'answer', text: 'Roses' } }),
);
console.log('Silence recovery:', preparePhotoStoryTurn({ ...input, turn: { kind: 'silence' } }));
const pause = applyActivitySystemInput(
  talk.nextState,
  { type: 'system.pause', reason: 'camera' },
  photoPackFixture,
  context,
);
console.log(
  'Preparation while paused must fail:',
  preparePhotoStoryTurn({ ...input, state: pause.nextState }),
);
console.log(
  'End-to-end Photo Story requires host media resolution and conversation/speech effect execution.',
);
