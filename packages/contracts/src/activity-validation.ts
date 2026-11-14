import {
  ActivityCommandSchema,
  ActivityContextSchema,
  ActivityEffectSchema,
  ActivityStateSchema,
  ApprovedPackSchema,
  type ActivityCommand,
  type ActivityContext,
  type ActivityEffect,
  type ActivityState,
  type ApprovedPack,
  type MatchingPresentation,
} from './activity';
import { fail, ok, type Result } from './common';

function samePresentation(
  a: MatchingPresentation | null | undefined,
  b: MatchingPresentation | null | undefined,
) {
  return (
    !!a &&
    !!b &&
    a.instanceId === b.instanceId &&
    a.presentationId === b.presentationId &&
    a.presentationRevision === b.presentationRevision &&
    a.policyRevision === b.policyRevision
  );
}
function currentMatching(state: ActivityState, ctx: ActivityContext) {
  return (
    state.activityId === 'object_matching' &&
    state.sampleCardId !== null &&
    ctx.eligibility.available &&
    samePresentation(state.presentation, ctx.matchingPresentation)
  );
}

// Pure freshness checks, not authorization, idempotency or a reducer. The coordinator must
// authenticate/scope the caller first and serialize validation + reduction + commit.
export function validateActivityCommandContext(
  raw: unknown,
  state: ActivityState,
  ctx: ActivityContext,
): Result<ActivityCommand> {
  const parsed = ActivityCommandSchema.safeParse(raw);
  if (!parsed.success) return fail('VALIDATION_ERROR', 'Invalid activity command');
  if (
    !ActivityStateSchema.safeParse(state).success ||
    !ActivityContextSchema.safeParse(ctx).success
  )
    return fail('UNAVAILABLE', 'Current activity context is unavailable');
  const command = parsed.data;
  if (
    command.sessionId !== ctx.eligibility.sessionId ||
    command.instanceId !== state.instanceId ||
    command.expectedRevision !== state.revision
  )
    return fail('REVISION_CONFLICT', 'Reload current activity');
  if (state.phase === 'ended') return fail('REVISION_CONFLICT', 'Activity has ended');
  if (command.action.type === 'activity.leave') return ok(command);
  if (state.phase === 'paused') return fail('REVISION_CONFLICT', 'Activity is paused');
  if (state.phase === 'unavailable' || !ctx.eligibility.available)
    return fail('UNAVAILABLE', 'Activity content is unavailable');
  const prefix = {
    music_playlist: 'track.',
    twenty_questions: 'guess.',
    photo_album: 'photo.',
    object_matching: 'match.',
  }[state.activityId];
  if (!command.action.type.startsWith(prefix))
    return fail('VALIDATION_ERROR', 'Action does not belong to this activity');
  if (state.activityId === 'object_matching') {
    if (
      !currentMatching(state, ctx) ||
      !samePresentation(command.presentation, ctx.matchingPresentation)
    )
      return fail('REVISION_CONFLICT', 'Reload current matching presentation');
    if (
      command.action.type === 'match.select' &&
      !state.choiceIds.includes(command.action.choiceId)
    )
      return fail('VALIDATION_ERROR', 'Choice is not in the current presentation');
  }
  return ok(command);
}

type MatchingSignal = Extract<ActivityEffect, { type: 'preference.signal' | 'item.uncertain' }>;
// Call against the INPUT state/context, before applying the signal's policy update or moving
// to the next presentation. The host must also verify the actual explicit action/evidence,
// deduplicate it, check profile/privacy/generation and apply remembering permission (A24).
export function validateMatchingSignalContext(
  raw: unknown,
  state: ActivityState,
  pack: ApprovedPack,
  ctx: ActivityContext,
): Result<MatchingSignal> {
  const parsed = ActivityEffectSchema.safeParse(raw);
  if (
    !parsed.success ||
    (parsed.data.type !== 'preference.signal' && parsed.data.type !== 'item.uncertain')
  )
    return fail('VALIDATION_ERROR', 'Invalid matching signal proposal');
  if (
    !ActivityStateSchema.safeParse(state).success ||
    !ActivityContextSchema.safeParse(ctx).success ||
    !ApprovedPackSchema.safeParse(pack).success
  )
    return fail('UNAVAILABLE', 'Current matching context is unavailable');
  if (state.activityId !== 'object_matching' || pack.activityId !== 'object_matching')
    return fail('VALIDATION_ERROR', 'Signal requires matching content');
  if (
    (state.phase !== 'ready' && state.phase !== 'active') ||
    !currentMatching(state, ctx) ||
    !samePresentation(parsed.data.presentation, ctx.matchingPresentation)
  )
    return fail('REVISION_CONFLICT', 'Matching signal presentation is stale');
  const sample = pack.cards.find((card) => card.id === state.sampleCardId);
  const displayed = [state.sampleCardId, ...state.choiceIds].map((id) =>
    pack.cards.find((card) => card.id === id),
  );
  if (
    !sample ||
    sample.entityId !== parsed.data.entityId ||
    displayed.some(
      (card) =>
        !card ||
        card.entityIds.some(
          (id) =>
            !ctx.eligibility.permittedEntityIds.includes(id) ||
            ctx.eligibility.sessionHiddenIds.includes(id),
        ),
    )
  )
    return fail('VALIDATION_ERROR', 'Signal is not about an eligible presented object');
  return ok(parsed.data);
}
