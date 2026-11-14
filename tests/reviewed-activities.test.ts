import { test, expect } from 'bun:test';
import {
  createActivity,
  reduceActivity,
  projectActivity,
  applyActivitySystemInput,
} from '@lemmi/activities';
import { type ActivityContext, type ApprovedPack } from '@lemmi/contracts';
import {
  activityContextFixture,
  guessingPackFixture,
  photoPackFixture,
  musicPack,
  contextFor,
} from '@lemmi/contracts/fixtures';

const ctx: ActivityContext = { ...activityContextFixture, matchingPresentation: null };
test('a reviewed twenty-node chain never repeats or exceeds its question bound', () => {
  if (guessingPackFixture.activityId !== 'twenty_questions') throw new Error('fixture');
  const root = guessingPackFixture.questions[0]!;
  const pack: ApprovedPack = {
    ...guessingPackFixture,
    rounds: [{ ...guessingPackFixture.rounds[0]!, entryQuestionId: 'q0' }],
    questions: Array.from({ length: 20 }, (_, index) => ({
      ...root,
      id: `q${index}`,
      branches: {
        ...root.branches,
        yes:
          index < 19
            ? { kind: 'question' as const, questionId: `q${index + 1}` }
            : { kind: 'guess' as const, candidateId: 'kettle' },
      },
    })),
  };
  let state = createActivity({ instanceId: 'chain' }, pack, ctx);
  const seen = new Set<string>();
  for (let index = 0; index < 20; index++) {
    if (state.activityId !== 'twenty_questions') throw new Error('state');
    expect(seen.has(state.questionId!)).toBe(false);
    seen.add(state.questionId!);
    state = reduceActivity(state, { type: 'guess.answer', answer: 'yes' }, pack, ctx).nextState;
  }
  expect(state).toMatchObject({ questionsAsked: 20, roundPhase: 'guess_offered' });
  expect(() => reduceActivity(state, { type: 'guess.answer', answer: 'yes' }, pack, ctx)).toThrow();
});

test('new rounds move forward through eligible content and never loop the pack', () => {
  if (guessingPackFixture.activityId !== 'twenty_questions') throw new Error('fixture');
  const round = guessingPackFixture.rounds[0]!;
  const pack: ApprovedPack = {
    ...guessingPackFixture,
    rounds: [round, { ...round, id: 'second' }],
  };
  let state = createActivity({ instanceId: 'rounds' }, pack, ctx);
  state = reduceActivity(state, { type: 'guess.skip' }, pack, ctx).nextState;
  state = reduceActivity(state, { type: 'guess.new_round' }, pack, ctx).nextState;
  expect(state).toMatchObject({ roundId: 'second', questionsAsked: 1 });
  state = reduceActivity(state, { type: 'guess.skip' }, pack, ctx).nextState;
  state = reduceActivity(state, { type: 'guess.new_round' }, pack, ctx).nextState;
  expect(state).toMatchObject({ roundId: 'second', roundPhase: 'complete', questionId: null });
  expect(projectActivity(state, pack, ctx).choices.map((choice) => choice.id)).toEqual(['finish']);
});
test('photo navigation cancels talk and keeps private context out of projection', () => {
  let state = createActivity({ instanceId: 'photo' }, photoPackFixture, ctx);
  const talk = reduceActivity(state, { type: 'photo.talk' }, photoPackFixture, ctx);
  expect(talk.effects).toEqual([
    { type: 'offer_photo_conversation', photoId: 'garden', assetId: 'fixture-garden' },
  ]);
  expect(JSON.stringify(projectActivity(talk.nextState, photoPackFixture, ctx))).not.toContain(
    'Fictional generic',
  );
  const next = reduceActivity(talk.nextState, { type: 'photo.next' }, photoPackFixture, ctx);
  expect(next.effects).toEqual([{ type: 'stop_media' }]);
  expect(next.nextState).toMatchObject({
    currentPhotoId: 'garden-no-caption',
    position: 1,
    viewingMode: 'just_look',
  });
  expect(projectActivity(next.nextState, photoPackFixture, ctx)).toMatchObject({ caption: null });
  expect(() =>
    reduceActivity(next.nextState, { type: 'photo.talk' }, photoPackFixture, ctx),
  ).toThrow();
  state = reduceActivity(
    next.nextState,
    { type: 'photo.previous' },
    photoPackFixture,
    ctx,
  ).nextState;
  expect(state).toMatchObject({ currentPhotoId: 'garden', position: 0 });
});

test('guess branches, uncertainty, skip and reveal produce factual events without scores', () => {
  for (const answer of ['yes', 'no', 'not_sure'] as const) {
    const state = createActivity({ instanceId: 'guess' }, guessingPackFixture, ctx);
    const result = reduceActivity(
      state,
      { type: 'guess.answer', answer },
      guessingPackFixture,
      ctx,
    );
    expect(result.events[0]).toEqual({ type: 'question_answered', itemId: 'used-for-tea', answer });
    expect(result.nextState).toMatchObject({
      roundPhase: answer === 'not_sure' ? 'complete' : 'guess_offered',
    });
    expect(() =>
      reduceActivity(result.nextState, { type: 'guess.answer', answer }, guessingPackFixture, ctx),
    ).toThrow();
    expect(projectActivity(result.nextState, guessingPackFixture, ctx)).not.toHaveProperty(
      'questionsAsked',
    );
  }
  const state = createActivity({ instanceId: 'guess' }, guessingPackFixture, ctx);
  expect(
    reduceActivity(state, { type: 'guess.skip' }, guessingPackFixture, ctx).nextState,
  ).toMatchObject({ roundPhase: 'complete' });
  expect(
    reduceActivity(state, { type: 'guess.reveal' }, guessingPackFixture, ctx).nextState,
  ).toMatchObject({ guessCandidateId: 'kettle' });
});

for (const pack of [guessingPackFixture, photoPackFixture]) {
  test(`${pack.activityId}: camera pauses without advancement, explicit resume never replays, end is terminal`, () => {
    const initial = createActivity({ instanceId: 'activity' }, pack, ctx);
    const paused = applyActivitySystemInput(
      initial,
      { type: 'system.pause', reason: 'camera' },
      pack,
      ctx,
    );
    expect({ ...paused.nextState, phase: initial.phase, revision: initial.revision }).toEqual(
      initial,
    );
    const action =
      pack.activityId === 'photo_album'
        ? { type: 'photo.next' as const }
        : { type: 'guess.skip' as const };
    expect(() => reduceActivity(paused.nextState, action, pack, ctx)).toThrow();
    const resumed = applyActivitySystemInput(
      paused.nextState,
      { type: 'system.resume' },
      pack,
      ctx,
    );
    expect(resumed.effects).toEqual([]);
    expect(resumed.nextState.phase).toBe('ready');
    const ended = applyActivitySystemInput(
      resumed.nextState,
      { type: 'system.end', reason: 'stop' },
      pack,
      ctx,
    ).nextState;
    expect(applyActivitySystemInput(ended, { type: 'system.resume' }, pack, ctx).nextState).toEqual(
      ended,
    );
    expect(() => reduceActivity(ended, action, pack, ctx)).toThrow();
  });
  test(`${pack.activityId}: policy filtering covers view-only paths and clears paused references`, () => {
    const initial = createActivity({ instanceId: 'activity' }, pack, ctx);
    const blocked = {
      ...ctx,
      eligibility: { ...ctx.eligibility, permittedEntityIds: [], policyRevision: 1 },
    };
    expect(projectActivity(initial, pack, blocked).assetIds).toEqual([]);
    expect(() => reduceActivity(initial, { type: 'guess.skip' }, pack, blocked)).toThrow();
    const paused = applyActivitySystemInput(
      initial,
      { type: 'system.pause', reason: 'camera' },
      pack,
      ctx,
    ).nextState;
    const changed = applyActivitySystemInput(
      paused,
      { type: 'system.eligibility_changed' },
      pack,
      blocked,
    );
    expect(changed.nextState.phase).toBe('paused');
    expect(projectActivity(changed.nextState, pack, blocked).assetIds).toEqual([]);
    expect(
      applyActivitySystemInput(changed.nextState, { type: 'system.resume' }, pack, blocked).effects,
    ).toEqual([]);
    expect(
      reduceActivity(changed.nextState, { type: 'activity.leave' }, pack, blocked).nextState.phase,
    ).toBe('ended');
  });
}

test('music resume retains the selected second eligible track', () => {
  if (musicPack.activityId !== 'music_playlist') throw new Error('fixture');
  const pack: ApprovedPack = {
    ...musicPack,
    tracks: [...musicPack.tracks, { ...musicPack.tracks[0]!, id: 'second' }],
  };
  const context = contextFor('s');
  let state = createActivity({ instanceId: 'music' }, pack, context);
  state = reduceActivity(
    state,
    { type: 'track.select', trackId: 'second' },
    pack,
    context,
  ).nextState;
  state = applyActivitySystemInput(
    state,
    { type: 'system.pause', reason: 'camera' },
    pack,
    context,
  ).nextState;
  const resumed = applyActivitySystemInput(state, { type: 'system.resume' }, pack, context);
  expect(resumed.nextState).toMatchObject({ currentTrackId: 'second', playback: 'stopped' });
  expect(resumed.effects).toEqual([]);
});
