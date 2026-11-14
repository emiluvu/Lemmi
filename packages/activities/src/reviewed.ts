import {
  ActivityStateSchema,
  ActivityTransitionSchema,
  ActivityViewSchema,
  type ActivityAction,
  type ActivityContext,
  type ActivityState,
  type ActivitySystemInput,
  type ActivityTransition,
  type ApprovedPack,
} from '@lemmi/contracts';

type PhotoPack = Extract<ApprovedPack, { activityId: 'photo_album' }>;
type GuessPack = Extract<ApprovedPack, { activityId: 'twenty_questions' }>;
type PhotoState = Extract<ActivityState, { activityId: 'photo_album' }>;
type GuessState = Extract<ActivityState, { activityId: 'twenty_questions' }>;
type ReviewedState = PhotoState | GuessState;
type ReviewedPack = PhotoPack | GuessPack;

function permitted(tags: string[], ctx: ActivityContext) {
  return (
    ctx.eligibility.available &&
    tags.every(
      (id) =>
        ctx.eligibility.permittedEntityIds.includes(id) &&
        !ctx.eligibility.sessionHiddenIds.includes(id),
    )
  );
}
function photos(pack: PhotoPack, ctx: ActivityContext) {
  return pack.entries.filter((entry) => permitted(entry.entityIds, ctx));
}
function rounds(pack: GuessPack, ctx: ActivityContext) {
  return pack.rounds.filter((round) => {
    if (
      !round.candidateIds.every((id) => {
        const candidate = pack.candidates.find((candidate) => candidate.id === id);
        return candidate && permitted(candidate.entityIds, ctx);
      })
    )
      return false;
    const visited = new Set<string>();
    const safe = (id: string): boolean => {
      if (visited.has(id)) return true;
      visited.add(id);
      const question = pack.questions.find((question) => question.id === id);
      return (
        !!question &&
        permitted(question.entityIds, ctx) &&
        Object.values(question.branches).every(
          (branch) => branch.kind !== 'question' || safe(branch.questionId),
        )
      );
    };
    return safe(round.entryQuestionId);
  });
}
function clear(state: ReviewedState): ReviewedState {
  return state.activityId === 'photo_album'
    ? { ...state, currentPhotoId: null, position: null, viewingMode: 'just_look' }
    : { ...state, questionId: null, guessCandidateId: null, roundPhase: 'complete' };
}
function safeCurrent(state: ReviewedState, pack: ReviewedPack, ctx: ActivityContext) {
  if (state.activityId === 'photo_album' && pack.activityId === 'photo_album')
    return photos(pack, ctx).some((entry) => entry.id === state.currentPhotoId);
  if (state.activityId === 'twenty_questions' && pack.activityId === 'twenty_questions') {
    const round = rounds(pack, ctx).find((round) => round.id === state.roundId);
    if (!round) return false;
    // State is coordinator-owned, but reject inconsistent pack references too.
    if (state.questionId && !pack.questions.some((question) => question.id === state.questionId))
      return false;
    if (state.guessCandidateId && !round.candidateIds.includes(state.guessCandidateId))
      return false;
    return true;
  }
  return false;
}

export function createReviewed(
  instanceId: string,
  pack: ReviewedPack,
  ctx: ActivityContext,
): ReviewedState {
  const base = { instanceId, revision: 0 };
  if (pack.activityId === 'photo_album') {
    const entry = photos(pack, ctx)[0];
    return ActivityStateSchema.parse({
      ...base,
      activityId: pack.activityId,
      phase: entry ? 'ready' : 'unavailable',
      currentPhotoId: entry?.id ?? null,
      position: entry ? pack.entries.indexOf(entry) : null,
      viewingMode: 'just_look',
    }) as PhotoState;
  }
  const round = rounds(pack, ctx)[0];
  return ActivityStateSchema.parse({
    ...base,
    activityId: pack.activityId,
    phase: round ? 'ready' : 'unavailable',
    roundId: round?.id ?? null,
    questionId: round?.entryQuestionId ?? null,
    guessCandidateId: null,
    questionsAsked: round ? 1 : 0,
    roundPhase: round ? 'asking' : 'complete',
  }) as GuessState;
}

export function reduceReviewed(
  state: ReviewedState,
  action: ActivityAction,
  pack: ReviewedPack,
  ctx: ActivityContext,
): ActivityTransition {
  const effects: ActivityTransition['effects'] = [];
  const events: ActivityTransition['events'] = [];
  let next: ReviewedState = { ...state, revision: state.revision + 1 };
  if (state.phase === 'ended') throw new Error('Activity has ended');
  if (action.type === 'activity.leave') {
    next = { ...clear(next), phase: 'ended' };
    return ActivityTransitionSchema.parse({
      nextState: next,
      events: [{ type: 'activity_ended' }],
      effects: [{ type: 'stop_media' }],
    });
  }
  if (state.phase === 'paused' || state.phase === 'unavailable' || !safeCurrent(state, pack, ctx))
    throw new Error('Activity cannot advance');
  if (next.activityId === 'photo_album' && pack.activityId === 'photo_album') {
    const eligible = photos(pack, ctx);
    const currentIndex = eligible.findIndex((entry) => entry.id === next.currentPhotoId);
    const current = eligible[currentIndex]!;
    if (action.type === 'photo.talk') {
      if (!current.discussionContext?.trim() && !current.caption?.trim())
        throw new Error('Approved photo description unavailable');
      next.viewingMode = 'talk';
      next.phase = 'active';
      events.push({ type: 'photo_talk_requested', itemId: current.id });
      effects.push({
        type: 'offer_photo_conversation',
        photoId: current.id,
        assetId: current.assetId,
      });
    } else if (action.type === 'photo.just_look') {
      next.viewingMode = 'just_look';
      next.phase = 'ready';
      events.push({ type: 'photo_just_look', itemId: current.id });
      effects.push({ type: 'stop_media' });
    } else if (
      action.type === 'photo.select' ||
      action.type === 'photo.next' ||
      action.type === 'photo.previous'
    ) {
      const entry =
        action.type === 'photo.select'
          ? eligible.find((entry) => entry.id === action.photoId)
          : eligible[
              Math.max(
                0,
                Math.min(
                  eligible.length - 1,
                  currentIndex + (action.type === 'photo.next' ? 1 : -1),
                ),
              )
            ];
      if (!entry) throw new Error('Unknown or excluded photo');
      next.currentPhotoId = entry.id;
      next.position = pack.entries.indexOf(entry);
      next.viewingMode = 'just_look';
      next.phase = 'ready';
      events.push({ type: 'photo_selected', itemId: entry.id });
      effects.push({ type: 'stop_media' });
    } else throw new Error('Unsupported photo action');
  } else if (next.activityId === 'twenty_questions' && pack.activityId === 'twenty_questions') {
    const round = rounds(pack, ctx).find((round) => round.id === next.roundId)!;
    const follow = (branch: GuessPack['questions'][number]['branches']['yes']) => {
      if (next.activityId !== 'twenty_questions') throw new Error('State mismatch');
      next.phase = 'ready';
      next.questionId = null;
      next.guessCandidateId = null;
      next.roundPhase = 'complete';
      if (branch.kind === 'question' && next.questionsAsked < 20) {
        next.questionId = branch.questionId;
        next.questionsAsked += 1;
        next.roundPhase = 'asking';
      } else if (branch.kind === 'guess') {
        next.guessCandidateId = branch.candidateId;
        next.roundPhase = 'guess_offered';
        events.push({ type: 'guess_offered', itemId: branch.candidateId });
      } else events.push({ type: 'guess_round_ended', itemId: round.id });
    };
    if (action.type === 'guess.new_round') {
      if (next.roundPhase === 'asking') throw new Error('Finish or reveal the current round first');
      const later = pack.rounds.slice(pack.rounds.findIndex((value) => value.id === round.id) + 1);
      const available = new Set(rounds(pack, ctx).map((value) => value.id));
      const following = later.find((value) => available.has(value.id));
      next.roundId = following?.id ?? round.id;
      next.questionId = following?.entryQuestionId ?? null;
      next.guessCandidateId = null;
      next.questionsAsked = following ? 1 : next.questionsAsked;
      next.roundPhase = following ? 'asking' : 'complete';
      next.phase = 'ready';
    } else if (action.type === 'guess.reveal') {
      if (next.roundPhase !== 'asking') throw new Error('No question to reveal');
      follow(round.reveal);
    } else if (action.type === 'guess.answer' || action.type === 'guess.skip') {
      if (next.roundPhase !== 'asking') throw new Error('No current question');
      const question = pack.questions.find((question) => question.id === next.questionId)!;
      if (action.type === 'guess.answer') {
        events.push({ type: 'question_answered', itemId: question.id, answer: action.answer });
        follow(question.branches[action.answer]);
      } else {
        events.push({ type: 'question_skipped', itemId: question.id });
        follow(question.branches.skip);
      }
    } else throw new Error('Unsupported guessing action');
  } else throw new Error('Pack mismatch');
  return ActivityTransitionSchema.parse({ nextState: next, events, effects });
}

export function systemReviewed(
  state: ReviewedState,
  input: ActivitySystemInput,
  pack: ReviewedPack,
  ctx: ActivityContext,
): ActivityTransition {
  if (state.phase === 'ended' || input.type === 'system.playback_receipt')
    return ActivityTransitionSchema.parse({ nextState: state, events: [], effects: [] });
  let next: ReviewedState = { ...state, revision: state.revision + 1 };
  const events: ActivityTransition['events'] = [];
  const effects: ActivityTransition['effects'] = [];
  const safe = safeCurrent(state, pack, ctx);
  switch (input.type) {
    case 'system.pause':
      next.phase = 'paused';
      events.push({ type: 'activity_paused', reason: input.reason });
      effects.push({ type: 'stop_media' });
      break;
    case 'system.end':
      next = { ...clear(next), phase: 'ended' };
      events.push({ type: 'activity_ended' });
      effects.push({ type: 'stop_media' });
      break;
    case 'system.resume':
      if (state.phase !== 'paused') throw new Error('Not paused');
      next.phase = safe ? 'ready' : 'unavailable';
      if (next.activityId === 'photo_album') next.viewingMode = 'just_look';
      events.push({ type: 'activity_resumed' });
      break;
    case 'system.eligibility_changed':
      events.push({ type: 'eligibility_changed', policyRevision: ctx.eligibility.policyRevision });
      break;
  }
  if (!safe && input.type !== 'system.end') {
    next = { ...clear(next), phase: next.phase === 'paused' ? 'paused' : 'unavailable' };
    if (input.type === 'system.eligibility_changed') effects.push({ type: 'stop_media' });
  }
  return ActivityTransitionSchema.parse({ nextState: next, events, effects });
}

export function projectReviewed(state: ReviewedState, pack: ReviewedPack, ctx: ActivityContext) {
  const safe = safeCurrent(state, pack, ctx) && state.phase !== 'ended';
  const phase =
    state.phase === 'paused' || state.phase === 'ended'
      ? state.phase
      : safe
        ? state.phase
        : 'unavailable';
  const enabled = phase === 'ready' || phase === 'active';
  const choices: { id: string; label: string; action: ActivityAction }[] = [];
  const base = {
    activityId: state.activityId,
    instanceId: state.instanceId,
    revision: state.revision,
    phase,
    choices,
    capabilities: { audioRequired: false, largeScreenPreferred: true },
  };
  if (state.activityId === 'photo_album' && pack.activityId === 'photo_album') {
    const entry = safe
      ? photos(pack, ctx).find((entry) => entry.id === state.currentPhotoId)
      : undefined;
    if (enabled) {
      const eligible = photos(pack, ctx);
      const index = eligible.findIndex((value) => value.id === entry?.id);
      if (index > 0)
        choices.push({
          id: 'previous',
          label: 'Previous photo',
          action: { type: 'photo.previous' },
        });
      if (index < eligible.length - 1)
        choices.push({ id: 'next', label: 'Next photo', action: { type: 'photo.next' } });
      choices.push({ id: 'look', label: 'Just look', action: { type: 'photo.just_look' } });
      if (entry?.discussionContext?.trim() || entry?.caption?.trim())
        choices.push({
          id: 'talk',
          label: 'Talk about this photo',
          action: { type: 'photo.talk' },
        });
    }
    if (phase !== 'ended')
      choices.push({ id: 'finish', label: 'Finish', action: { type: 'activity.leave' } });
    return ActivityViewSchema.parse({
      ...base,
      title: pack.collectionKind === 'place_scenes' ? 'Explore pictures' : 'Photo Story',
      prompt: entry
        ? ctx.presentationPolicy.preset === 'quiet'
          ? 'We can just look.'
          : 'We can look or talk about this picture.'
        : 'No eligible pictures available.',
      assetIds: entry ? [entry.assetId] : [],
      currentAssetId: entry?.assetId ?? null,
      caption: entry?.caption ?? null,
      viewingMode: safe ? state.viewingMode : 'just_look',
    });
  }
  if (state.activityId !== 'twenty_questions' || pack.activityId !== 'twenty_questions')
    throw new Error('Pack mismatch');
  const question = safe
    ? pack.questions.find((question) => question.id === state.questionId)
    : undefined;
  const guess = safe
    ? pack.candidates.find((candidate) => candidate.id === state.guessCandidateId)
    : undefined;
  if (enabled && state.roundPhase === 'asking') {
    for (const answer of ['yes', 'no', 'not_sure'] as const)
      choices.push({
        id: answer,
        label: { yes: 'Yes', no: 'No', not_sure: 'Not sure' }[answer],
        action: { type: 'guess.answer', answer },
      });
    choices.push(
      { id: 'skip', label: 'Skip', action: { type: 'guess.skip' } },
      { id: 'reveal', label: 'Show me', action: { type: 'guess.reveal' } },
    );
  } else if (
    enabled &&
    pack.rounds
      .slice(pack.rounds.findIndex((round) => round.id === state.roundId) + 1)
      .some((round) => rounds(pack, ctx).some((eligible) => eligible.id === round.id))
  )
    choices.push({ id: 'another', label: 'Another round', action: { type: 'guess.new_round' } });
  if (phase !== 'ended')
    choices.push({ id: 'finish', label: 'Finish', action: { type: 'activity.leave' } });
  const round = safe ? pack.rounds.find((round) => round.id === state.roundId) : undefined;
  const assets = round
    ? pack.candidates
        .filter((candidate) => round.candidateIds.includes(candidate.id))
        .flatMap((candidate) => (candidate.assetId ? [candidate.assetId] : []))
    : [];
  return ActivityViewSchema.parse({
    ...base,
    title: 'Gentle guessing',
    prompt: safe ? 'We can choose, skip, or finish.' : 'No eligible round available.',
    assetIds: [...new Set(assets)],
    question: question?.prompt ?? null,
    offeredGuess: guess ? { label: guess.label, assetId: guess.assetId } : null,
    roundPhase: safe ? state.roundPhase : 'complete',
  });
}
