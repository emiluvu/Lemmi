import { test, expect } from 'bun:test';
import {
  createActivity,
  reduceActivity,
  projectActivity,
  applyActivitySystemInput,
  preparePhotoStoryTurn,
  type PhotoStoryInput,
} from '@lemmi/activities';
import { SessionSnapshotSchema, type ApprovedPack } from '@lemmi/contracts';
import {
  participantProfile,
  contextFor,
  controlSessionFixture,
  photoPackFixture,
} from '@lemmi/contracts/fixtures';

function example(): PhotoStoryInput {
  const context = contextFor('photo-session');
  const session = SessionSnapshotSchema.parse({
    ...controlSessionFixture,
    id: 'photo-session',
    phase: 'ready',
    profileRevision: 0,
    generation: 3,
  });
  const state = createActivity({ instanceId: 'photo-story' }, photoPackFixture, context);
  return {
    profile: participantProfile,
    session,
    context,
    pack: photoPackFixture,
    state: reduceActivity(state, { type: 'photo.talk' }, photoPackFixture, context).nextState,
    photoAvailable: true,
    approvedFacts: [
      {
        profileId: participantProfile.id,
        source: 'caregiver_provided',
        entityIds: ['topic:gardening'],
        value: 'Gardening is an approved interest.',
      },
    ],
    turn: { kind: 'opening' },
  };
}
test('opening uses approved caption/context and scoped facts without claiming image analysis or personal history', () => {
  const input = example();
  const result = preparePhotoStoryTurn(input);
  expect(result.ok).toBe(true);
  if (!result.ok || result.data.kind !== 'conversation_context') throw new Error('context');
  expect(result.data.analysis).toBe('caption_only');
  expect(result.data.context.caption).toBe('A garden in spring.');
  expect(result.data.context.caregiverFacts).toEqual(['Gardening is an approved interest.']);
  expect(result.data.instructions).toContain('does not establish that the participant is pictured');
  expect(result.data.binding).toMatchObject({
    generation: 3,
    photoId: 'garden',
    instanceId: 'photo-story',
  });
  expect(JSON.stringify(result)).not.toContain('sensitiveTopicGuidance');
});
test('participant answer remains transient context, never an event, effect, or biography change', () => {
  const input = example();
  const before = JSON.stringify(input);
  input.turn = { kind: 'answer', text: 'Roses' };
  const result = preparePhotoStoryTurn(input);
  expect(result.ok).toBe(true);
  if (!result.ok || result.data.kind !== 'conversation_context') throw new Error('context');
  expect(result.data.turn).toEqual({ kind: 'answer', text: 'Roses' });
  expect(result.data.context.caregiverFacts).not.toContain('Roses');
  expect(result.data).not.toHaveProperty('events');
  expect(result.data).not.toHaveProperty('effects');
  expect(JSON.stringify({ ...input, turn: { kind: 'opening' } })).toBe(before);
  const changed = reduceActivity(input.state, { type: 'photo.next' }, input.pack, input.context);
  expect(changed.effects).toEqual([{ type: 'stop_media' }]);
  expect(JSON.stringify(changed)).not.toContain('Roses');
});
test('silence and unclear recognition return capture-off waiting content without another model question', () => {
  for (const kind of ['silence', 'unclear'] as const) {
    const result = preparePhotoStoryTurn({ ...example(), turn: { kind } });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('waiting');
    expect(result.data.kind).toBe('waiting');
    expect(result.data).not.toHaveProperty('turn');
    expect(result.data).not.toHaveProperty('instructions');
  }
});
test('Quiet uses the effective session preset, and stale presentation policy is rejected', () => {
  const input = example();
  input.session.communicationSupport = { preset: 'quiet', configVersion: 1 };
  expect(preparePhotoStoryTurn(input).ok).toBe(false);
  input.context.presentationPolicy = input.session.communicationSupport;
  const result = preparePhotoStoryTurn(input);
  expect(result.ok).toBe(true);
  if (!result.ok || result.data.kind !== 'conversation_context') throw new Error('context');
  expect(result.data.context.preset).toBe('quiet');
  expect(result.data.instructions).toContain('without an unsolicited question');
});
test('cross-profile/session and stale profile/policy inputs cannot prepare a turn', () => {
  for (const patch of [
    { profileId: 'preview-sam' },
    { id: 'old-session' },
    { profileRevision: 4 },
    { policyRevision: 9 },
  ]) {
    const input = example();
    expect(preparePhotoStoryTurn({ ...input, session: { ...input.session, ...patch } }).ok).toBe(
      false,
    );
  }
});
test('pause, stop, just-look, excluded photo and unavailable assets prevent generation preparation', () => {
  for (const action of [
    { type: 'system.pause', reason: 'camera' },
    { type: 'system.end', reason: 'stop' },
  ] as const) {
    const input = example();
    const state = applyActivitySystemInput(
      input.state,
      action,
      input.pack,
      input.context,
    ).nextState;
    expect(preparePhotoStoryTurn({ ...input, state }).ok).toBe(false);
  }
  const input = example();
  const look = reduceActivity(input.state, { type: 'photo.just_look' }, input.pack, input.context);
  expect(preparePhotoStoryTurn({ ...input, state: look.nextState }).ok).toBe(false);
  expect(preparePhotoStoryTurn({ ...input, photoAvailable: false }).ok).toBe(false);
  for (const eligibility of [
    { ...input.context.eligibility, available: false },
    { ...input.context.eligibility, sessionHiddenIds: ['topic:gardening'] },
  ])
    expect(preparePhotoStoryTurn({ ...input, context: { ...input.context, eligibility } }).ok).toBe(
      false,
    );
});
test('caption alone enables talk; no description leaves just-look and finish available', () => {
  const input = example();
  if (input.pack.activityId !== 'photo_album') throw new Error('fixture');
  const pack: ApprovedPack = {
    ...input.pack,
    entries: input.pack.entries.map((entry) => ({ ...entry, discussionContext: null })),
  };
  expect(preparePhotoStoryTurn({ ...input, pack }).ok).toBe(true);
  let state = createActivity({ instanceId: 'caption' }, pack, input.context);
  expect(
    projectActivity(state, pack, input.context).choices.some((choice) => choice.id === 'talk'),
  ).toBe(true);
  state = reduceActivity(state, { type: 'photo.talk' }, pack, input.context).nextState;
  state = reduceActivity(state, { type: 'photo.next' }, pack, input.context).nextState;
  expect(
    projectActivity(state, pack, input.context).choices.some((choice) => choice.id === 'talk'),
  ).toBe(false);
  expect(() => reduceActivity(state, { type: 'photo.talk' }, pack, input.context)).toThrow();
  expect(preparePhotoStoryTurn({ ...input, state, pack }).ok).toBe(false);
});
test('irrelevant or blocked approved facts are omitted; unscoped and oversized facts are rejected', () => {
  const input = example();
  input.approvedFacts.push({
    profileId: participantProfile.id,
    source: 'caregiver_provided',
    entityIds: ['topic:music'],
    value: 'Unrelated approved fact',
  });
  const result = preparePhotoStoryTurn(input);
  expect(JSON.stringify(result)).not.toContain('Unrelated approved fact');
  input.approvedFacts[0]!.profileId = 'preview-sam';
  expect(preparePhotoStoryTurn(input).ok).toBe(false);
  const oversized = example();
  oversized.approvedFacts[0]!.value = 'a'.repeat(201);
  expect(preparePhotoStoryTurn(oversized).ok).toBe(false);
});
test('empty, uncertain or oversized transcript text cannot become a usable answer silently', () => {
  for (const text of ['', ' ', 'a'.repeat(1001)])
    expect(preparePhotoStoryTurn({ ...example(), turn: { kind: 'answer', text } }).ok).toBe(false);
});
