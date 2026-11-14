import { describe, expect, test } from 'bun:test';
import {
  ActivityActionSchema,
  ActivityCommandSchema,
  ActivityContextSchema,
  ActivityEventSchema,
  ActivityStateSchema,
  ActivityTransitionSchema,
  ActivityViewSchema,
  ApprovedPackSchema,
  JournalEventSchema,
  validateActivityCommandContext,
  validateMatchingSignalContext,
  createClients,
  createHttpTransport,
} from '@lemmi/contracts';
import {
  activityContextFixture,
  activityStateFixtures,
  activityScreenFixtures,
  activityTransitionFixtures,
  guessingPackFixture,
  photoPackFixture,
  matchingPackFixture,
  matchingPresentationFixture,
  matchingSignalFixtures,
  contextFor,
  musicPack,
} from '@lemmi/contracts/fixtures';
import { createActivity, reduceActivity, applyActivitySystemInput } from '@lemmi/activities';

const matchingState = ActivityStateSchema.parse(
  activityStateFixtures.find((state) => state.activityId === 'object_matching'),
);
const command = {
  commandId: 'fixture-command',
  sessionId: 'fixture-session',
  instanceId: matchingState.instanceId,
  expectedRevision: matchingState.revision,
  action: { type: 'match.select', choiceId: 'pair-kettle' },
  presentation: matchingPresentationFixture,
};
function errorCode(result: ReturnType<typeof validateActivityCommandContext>) {
  expect(result.ok).toBe(false);
  return result.ok ? null : result.error.code;
}

describe('activity state/pack handoff', () => {
  test('four discriminated states and screen fixtures support pause/end without losing position', () => {
    expect(activityStateFixtures).toHaveLength(12);
    for (const state of activityStateFixtures)
      expect(ActivityStateSchema.safeParse(state).success).toBe(true);
    for (const view of activityScreenFixtures) {
      expect(ActivityViewSchema.safeParse(view).success).toBe(true);
      if (view.phase === 'paused' || view.phase === 'ended') expect(view.choices).toEqual([]);
    }
    for (const state of activityStateFixtures.filter((value) => value.phase === 'paused')) {
      const initial = activityStateFixtures.find((value) => value.activityId === state.activityId)!;
      expect({ ...state, phase: initial.phase, revision: initial.revision }).toEqual(initial);
    }
    for (const activityId of ['twenty_questions', 'photo_album', 'object_matching'])
      expect(
        ActivityStateSchema.safeParse({
          activityId,
          instanceId: 'a',
          revision: 0,
          phase: 'unavailable',
        }).success,
      ).toBe(false);
  });
  test('states reject contradictory or unbounded positions/presentations and private answer fields in views', () => {
    const guess = activityStateFixtures.find((state) => state.activityId === 'twenty_questions')!;
    for (const patch of [
      { questionsAsked: 21 },
      { questionsAsked: -1 },
      { questionId: null },
      { guessCandidateId: 'kettle' },
    ])
      expect(ActivityStateSchema.safeParse({ ...guess, ...patch }).success).toBe(false);
    const photo = activityStateFixtures.find((state) => state.activityId === 'photo_album')!;
    for (const patch of [{ position: 20 }, { position: null }, { currentPhotoId: null }])
      expect(ActivityStateSchema.safeParse({ ...photo, ...patch }).success).toBe(false);
    for (const patch of [
      { choiceIds: ['pair-kettle', 'pair-kettle'] },
      { choiceIds: ['pair-kettle'] },
      { selectedChoiceId: 'invented' },
      { presentation: null },
      { presentation: { ...matchingPresentationFixture, instanceId: 'other' } },
    ])
      expect(ActivityStateSchema.safeParse({ ...matchingState, ...patch }).success).toBe(false);
    const view = activityScreenFixtures.find((value) => value.activityId === 'object_matching')!;
    expect(ActivityViewSchema.safeParse({ ...view, correctChoiceId: 'pair-kettle' }).success).toBe(
      false,
    );
    const guessView = activityScreenFixtures.find(
      (value) => value.activityId === 'twenty_questions',
    )!;
    expect(ActivityViewSchema.safeParse({ ...guessView, questionsAsked: 1 }).success).toBe(false);
    const photoView = activityScreenFixtures.find((value) => value.activityId === 'photo_album')!;
    expect(
      ActivityViewSchema.safeParse({ ...photoView, discussionContext: 'private context' }).success,
    ).toBe(false);
  });
  test('new pack shapes validate and unfinished reducers stay explicitly unavailable', () => {
    for (const pack of [guessingPackFixture, photoPackFixture, matchingPackFixture]) {
      expect(ApprovedPackSchema.safeParse(pack).success).toBe(true);
      const state = createActivity({ instanceId: 'not-implemented' }, pack, contextFor('s'));
      expect(ActivityStateSchema.safeParse(state).success).toBe(true);
      expect(state.phase).toBe(pack.activityId === 'photo_album' ? 'ready' : 'unavailable');
      if (pack.activityId === 'photo_album')
        expect(
          reduceActivity(state, { type: 'activity.leave' }, pack, contextFor('s')).nextState.phase,
        ).toBe('ended');
      else
        expect(() =>
          reduceActivity(state, { type: 'activity.leave' }, pack, contextFor('s')),
        ).toThrow();
    }
  });
  test('reviewed guessing trees require all branches, valid candidates and entry/reveal references', () => {
    if (guessingPackFixture.activityId !== 'twenty_questions') throw new Error('fixture');
    const source = guessingPackFixture;
    const question = source.questions[0]!;
    const invalid: unknown[] = [
      {
        ...source,
        questions: [
          {
            ...question,
            branches: {
              yes: question.branches.yes,
              no: question.branches.no,
              skip: question.branches.skip,
            },
          },
        ],
      },
      {
        ...source,
        questions: [
          {
            ...question,
            branches: { ...question.branches, yes: { kind: 'question', questionId: 'unknown' } },
          },
        ],
      },
      {
        ...source,
        questions: [
          {
            ...question,
            branches: { ...question.branches, no: { kind: 'guess', candidateId: 'unknown' } },
          },
        ],
      },
      { ...source, rounds: [{ ...source.rounds[0], entryQuestionId: 'unknown' }] },
      { ...source, rounds: [{ ...source.rounds[0], candidateIds: ['kettle'] }] },
      {
        ...source,
        rounds: [{ ...source.rounds[0], reveal: { kind: 'guess', candidateId: 'unknown' } }],
      },
      { ...source, questions: [{ ...question, entityIds: [] }] },
      { ...source, candidates: [{ ...source.candidates[0], entityIds: [] }, source.candidates[1]] },
      { ...source, questions: [question, question] },
      { ...source, candidates: [...source.candidates, source.candidates[0]] },
      { ...source, rounds: [source.rounds[0], source.rounds[0]] },
      { ...source, questions: [question, { ...question, id: 'unreachable' }] },
    ];
    for (const value of invalid) expect(ApprovedPackSchema.safeParse(value).success).toBe(false);
  });
  test('guessing tree rejects cycles and paths beyond twenty questions; a bounded shared tree is legal', () => {
    if (guessingPackFixture.activityId !== 'twenty_questions') throw new Error('fixture');
    const pack = guessingPackFixture;
    const root = pack.questions[0]!;
    expect(
      ApprovedPackSchema.safeParse({
        ...pack,
        questions: [
          {
            ...root,
            branches: { ...root.branches, skip: { kind: 'question', questionId: root.id } },
          },
        ],
      }).success,
    ).toBe(false);
    const chain = (length: number) => ({
      ...pack,
      rounds: [{ ...pack.rounds[0], entryQuestionId: 'q0' }],
      questions: Array.from({ length }, (_, index) => ({
        ...root,
        id: `q${index}`,
        branches: {
          ...root.branches,
          yes:
            index + 1 < length
              ? { kind: 'question', questionId: `q${index + 1}` }
              : { kind: 'round_end' },
        },
      })),
    });
    expect(ApprovedPackSchema.safeParse(chain(20)).success).toBe(true);
    expect(ApprovedPackSchema.safeParse(chain(21)).success).toBe(false);
    const cyclic = chain(2);
    expect(
      ApprovedPackSchema.safeParse({
        ...cyclic,
        questions: [
          cyclic.questions[0],
          {
            ...cyclic.questions[1],
            branches: {
              ...cyclic.questions[1]!.branches,
              no: { kind: 'question', questionId: 'q0' },
            },
          },
        ],
      }).success,
    ).toBe(false);
  });
  test('photo/matching content has stable IDs, bounded fields and canonical object tags', () => {
    if (
      photoPackFixture.activityId !== 'photo_album' ||
      matchingPackFixture.activityId !== 'object_matching'
    )
      throw new Error('fixture');
    expect(photoPackFixture.entries[1]!.caption).toBeNull();
    expect(
      ApprovedPackSchema.safeParse({
        ...photoPackFixture,
        entries: [photoPackFixture.entries[0], photoPackFixture.entries[0]],
      }).success,
    ).toBe(false);
    expect(
      ApprovedPackSchema.safeParse({
        ...matchingPackFixture,
        cards: [{ ...matchingPackFixture.cards[0], entityIds: ['object:ball'] }],
      }).success,
    ).toBe(false);
    expect(
      ApprovedPackSchema.safeParse({
        ...matchingPackFixture,
        cards: [{ ...matchingPackFixture.cards[0], url: 'https://example.invalid' }],
      }).success,
    ).toBe(false);
  });
});

describe('current matching evidence', () => {
  test('the existing typed client round-trips matching evidence and the safe view', async () => {
    const view = activityScreenFixtures.find((value) => value.activityId === 'object_matching')!;
    let sent: unknown;
    const clients = createClients(
      createHttpTransport('mock', async (_url, init) => {
        sent = JSON.parse(String(init?.body));
        return Response.json({ ok: true, data: view });
      }),
    );
    const parsed = ActivityCommandSchema.parse(command);
    const result = await clients.activities.submit(parsed);
    expect(sent).toEqual(command);
    expect(result).toEqual({ ok: true, data: view });
  });
  test('commands must echo current coordinator presentation, session, instance, revision and displayed choice', () => {
    expect(validateActivityCommandContext(command, matchingState, activityContextFixture).ok).toBe(
      true,
    );
    expect(ActivityCommandSchema.safeParse({ ...command, presentation: undefined }).success).toBe(
      false,
    );
    expect(
      ActivityCommandSchema.safeParse({
        ...command,
        presentation: { ...command.presentation, instanceId: 'other' },
      }).success,
    ).toBe(false);
    for (const patch of [
      { sessionId: 'other' },
      { instanceId: 'other', presentation: { ...command.presentation, instanceId: 'other' } },
      { expectedRevision: 99 },
    ])
      expect(
        errorCode(
          validateActivityCommandContext(
            { ...command, ...patch },
            matchingState,
            activityContextFixture,
          ),
        ),
      ).toBe('REVISION_CONFLICT');
    for (const patch of [
      { presentationId: 'old' },
      { presentationRevision: 1 },
      { policyRevision: 99 },
    ])
      expect(
        errorCode(
          validateActivityCommandContext(
            { ...command, presentation: { ...command.presentation, ...patch } },
            matchingState,
            activityContextFixture,
          ),
        ),
      ).toBe('REVISION_CONFLICT');
    expect(
      errorCode(
        validateActivityCommandContext(
          { ...command, action: { type: 'match.select', choiceId: 'hidden' } },
          matchingState,
          activityContextFixture,
        ),
      ),
    ).toBe('VALIDATION_ERROR');
    expect(
      errorCode(
        validateActivityCommandContext(
          { ...command, presentation: undefined, action: { type: 'track.play' } },
          matchingState,
          activityContextFixture,
        ),
      ),
    ).toBe('VALIDATION_ERROR');
  });
  test('missing/stale policy or paused/ended presentations cannot accept matching actions', () => {
    expect(
      ActivityContextSchema.safeParse({
        eligibility: activityContextFixture.eligibility,
        presentationPolicy: activityContextFixture.presentationPolicy,
      }).success,
    ).toBe(false);
    expect(
      ActivityContextSchema.safeParse({
        ...activityContextFixture,
        matchingPresentation: { ...command.presentation, policyRevision: 1 },
      }).success,
    ).toBe(false);
    for (const phase of ['paused', 'ended'] as const)
      expect(
        errorCode(
          validateActivityCommandContext(
            command,
            { ...matchingState, phase },
            activityContextFixture,
          ),
        ),
      ).toBe('REVISION_CONFLICT');
    for (const matchingPresentation of [null, { ...command.presentation, presentationRevision: 3 }])
      expect(
        errorCode(
          validateActivityCommandContext(command, matchingState, {
            ...activityContextFixture,
            matchingPresentation,
          }),
        ),
      ).toBe('REVISION_CONFLICT');
    expect(
      errorCode(
        validateActivityCommandContext(command, matchingState, {
          ...activityContextFixture,
          eligibility: { ...activityContextFixture.eligibility, available: false },
        }),
      ),
    ).toBe('UNAVAILABLE');
  });
  test('signals bind to the current sample, eligible distractors and input presentation without storing speech', () => {
    for (const signal of matchingSignalFixtures)
      expect(
        validateMatchingSignalContext(
          signal,
          matchingState,
          matchingPackFixture,
          activityContextFixture,
        ).ok,
      ).toBe(true);
    const signal = matchingSignalFixtures[2];
    for (const patch of [
      { entityId: 'object:ball' },
      { utterance: 'unretained speech' },
      { presentation: { ...matchingPresentationFixture, presentationRevision: 1 } },
      { presentation: { ...matchingPresentationFixture, policyRevision: 99 } },
    ])
      expect(
        validateMatchingSignalContext(
          { ...signal, ...patch },
          matchingState,
          matchingPackFixture,
          activityContextFixture,
        ).ok,
      ).toBe(false);
    for (const hidden of ['object:kettle', 'object:ball']) {
      const ctx = {
        ...activityContextFixture,
        eligibility: { ...activityContextFixture.eligibility, sessionHiddenIds: [hidden] },
      };
      expect(
        validateMatchingSignalContext(signal, matchingState, matchingPackFixture, ctx).ok,
      ).toBe(false);
    }
    for (const phase of ['paused', 'ended', 'unavailable'] as const)
      expect(
        validateMatchingSignalContext(
          signal,
          { ...matchingState, phase },
          matchingPackFixture,
          activityContextFixture,
        ).ok,
      ).toBe(false);
  });
});

describe('factual events and validated transitions', () => {
  test('selection/request cannot masquerade as playback; receipts are status- and instance-bound', () => {
    const receipt = {
      instanceId: 'a',
      effectId: 'e',
      generation: 0,
      leaseId: 'l',
      sequence: 0,
      status: 'playing',
    };
    expect(ActivityEventSchema.safeParse({ type: 'track_played', itemId: 't' }).success).toBe(
      false,
    );
    expect(
      ActivityEventSchema.safeParse({ type: 'track_played', itemId: 't', receipt }).success,
    ).toBe(true);
    for (const type of ['track_paused', 'track_ended', 'media_failed'])
      expect(ActivityEventSchema.safeParse({ type, itemId: 't', receipt }).success).toBe(false);
    const state = createActivity({ instanceId: 'a' }, musicPack, contextFor('s'));
    expect(
      ActivityTransitionSchema.safeParse({
        nextState: state,
        events: [
          { type: 'track_played', itemId: 't', receipt: { ...receipt, instanceId: 'other' } },
        ],
        effects: [],
      }).success,
    ).toBe(false);
    expect(
      ActivityEventSchema.safeParse({ type: 'track_play_requested', itemId: 't', receipt }).success,
    ).toBe(false);
  });
  test('all activities share interruption transitions; factual event and journal payloads reject private/free text', () => {
    for (const transition of activityTransitionFixtures)
      expect(ActivityTransitionSchema.safeParse(transition).success).toBe(true);
    const events = [
      { type: 'question_answered', itemId: 'q', answer: 'not_sure' },
      { type: 'question_skipped', itemId: 'q' },
      { type: 'guess_offered', itemId: 'kettle' },
      { type: 'photo_talk_requested', itemId: 'garden' },
      { type: 'match_selected', itemId: 'choice-ball' },
      { type: 'activity_paused', reason: 'camera' },
      { type: 'activity_resumed' },
      { type: 'eligibility_changed', policyRevision: 2 },
    ];
    for (const event of events) {
      expect(ActivityEventSchema.safeParse(event).success).toBe(true);
      expect(JournalEventSchema.safeParse({ ...event, source: 'measured_event' }).success).toBe(
        true,
      );
      for (const injected of [
        { text: 'utterance' },
        { privateGuidance: 'secret' },
        { correct: false },
        { score: 0 },
      ]) {
        expect(ActivityEventSchema.safeParse({ ...event, ...injected }).success).toBe(false);
        expect(
          JournalEventSchema.safeParse({ ...event, ...injected, source: 'measured_event' }).success,
        ).toBe(false);
      }
    }
    expect(
      ActivityTransitionSchema.safeParse({
        ...activityTransitionFixtures[0],
        effects: [{ type: 'fetch', url: 'https://example.invalid' }],
      }).success,
    ).toBe(false);
    expect(
      ActivityActionSchema.safeParse({ type: 'system.playback_receipt', receipt: {} }).success,
    ).toBe(false);
  });
  test('existing music returns schema-validated requests, interruptions and actual receipt events separately', () => {
    const ctx = contextFor('s');
    const ready = createActivity({ instanceId: 'a' }, musicPack, ctx);
    const requested = reduceActivity(ready, { type: 'track.play' }, musicPack, ctx);
    expect(requested.events).toEqual([{ type: 'track_play_requested', itemId: 'garden-track' }]);
    for (const [status, type] of [
      ['playing', 'track_played'],
      ['paused', 'track_paused'],
      ['ended', 'track_ended'],
      ['failed', 'media_failed'],
    ] as const) {
      const receipt = {
        instanceId: 'a',
        effectId: 'validated-by-host',
        generation: 0,
        leaseId: 'l',
        sequence: 0,
        status,
      };
      const result = applyActivitySystemInput(
        requested.nextState,
        { type: 'system.playback_receipt', receipt },
        musicPack,
        ctx,
      );
      expect(result.events).toEqual([
        ActivityEventSchema.parse({ type, itemId: 'garden-track', receipt }),
      ]);
      expect(result.effects).toEqual([]);
    }
    const paused = applyActivitySystemInput(
      requested.nextState,
      { type: 'system.pause', reason: 'camera' },
      musicPack,
      ctx,
    );
    expect(paused.events).toEqual([{ type: 'activity_paused', reason: 'camera' }]);
    expect(
      applyActivitySystemInput(paused.nextState, { type: 'system.resume' }, musicPack, ctx).effects,
    ).toEqual([]);
    expect(() =>
      applyActivitySystemInput(
        ready,
        { type: 'system.pause', reason: 'camera', injected: true } as never,
        musicPack,
        ctx,
      ),
    ).toThrow();
  });
});
