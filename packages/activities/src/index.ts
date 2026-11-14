import {
  ActivityStateSchema,
  ActivityContextSchema,
  ApprovedPackSchema,
  ActivityViewSchema,
  ActivityActionSchema,
  ActivitySystemInputSchema,
  ActivityTransitionSchema,
  ActivityEventSchema,
  StartActivityInputSchema,
  type StartActivityInput,
  type ApprovedPack,
  type ActivityState,
  type ActivityContext,
  type ActivityAction,
  type ActivityTransition,
  type ActivitySystemInput,
  type ActivityView,
} from '@lemmi/contracts';
import { createReviewed, reduceReviewed, projectReviewed, systemReviewed } from './reviewed';
// Pure activity transitions; content execution and session authority belong to the host.
function tracks(pack: ApprovedPack, ctx: ActivityContext) {
  if (pack.activityId !== 'music_playlist' || !ctx.eligibility.available) return [];
  return pack.tracks.filter((t) =>
    t.entityIds.every(
      (id) =>
        ctx.eligibility.permittedEntityIds.includes(id) &&
        !ctx.eligibility.sessionHiddenIds.includes(id),
    ),
  );
}
function checked(state: ActivityState, pack: ApprovedPack, ctx: ActivityContext) {
  ActivityStateSchema.parse(state);
  ApprovedPackSchema.parse(pack);
  ActivityContextSchema.parse(ctx);
  if (state.activityId !== pack.activityId) throw new Error('Pack mismatch');
}
export function createActivity(
  input: StartActivityInput,
  pack: ApprovedPack,
  ctx: ActivityContext,
): ActivityState {
  StartActivityInputSchema.parse(input);
  ApprovedPackSchema.parse(pack);
  ActivityContextSchema.parse(ctx);
  if (pack.activityId === 'photo_album' || pack.activityId === 'twenty_questions')
    return createReviewed(input.instanceId, pack, ctx);
  // Shape-only unavailable stubs. Lukas supplies these activities' actual rules.
  const base = { instanceId: input.instanceId, revision: 0, phase: 'unavailable' as const };
  switch (pack.activityId) {
    case 'object_matching':
      return ActivityStateSchema.parse({
        ...base,
        activityId: pack.activityId,
        sampleCardId: null,
        choiceIds: [],
        selectedChoiceId: null,
        pairShown: false,
        presentation: null,
      });
  }
  const track = tracks(pack, ctx)[0];
  return {
    activityId: 'music_playlist',
    instanceId: input.instanceId,
    revision: 0,
    phase: track ? 'ready' : 'unavailable',
    currentTrackId: track?.id ?? null,
    playback: 'stopped',
  };
}
export function reduceActivity(
  state: ActivityState,
  action: ActivityAction,
  pack: ApprovedPack,
  ctx: ActivityContext,
): ActivityTransition {
  checked(state, pack, ctx);
  ActivityActionSchema.parse(action);
  if (
    (state.activityId === 'photo_album' || state.activityId === 'twenty_questions') &&
    (pack.activityId === 'photo_album' || pack.activityId === 'twenty_questions')
  )
    return reduceReviewed(state, action, pack, ctx);
  if (
    state.activityId !== 'music_playlist' ||
    state.phase === 'ended' ||
    state.phase === 'paused' ||
    state.phase === 'unavailable'
  )
    throw new Error('Activity cannot advance');
  const next = { ...state, revision: state.revision + 1 };
  const effects: ActivityTransition['effects'] = [];
  const events: ActivityTransition['events'] = [];
  const eligible = tracks(pack, ctx);
  const current = eligible.find((t) => t.id === state.currentTrackId);
  if (!current) throw new Error('Current content is no longer eligible');
  switch (action.type) {
    case 'track.play':
      next.playback = 'requested';
      next.phase = 'active';
      effects.push({ type: 'play_approved_track', assetId: current.assetId });
      events.push({ type: 'track_play_requested', itemId: current.id });
      break;
    case 'track.pause':
      next.playback = 'paused';
      next.phase = 'ready';
      effects.push({ type: 'stop_media' });
      events.push({ type: 'track_pause_requested', itemId: current.id });
      break;
    case 'track.select':
    case 'track.next': {
      const track =
        action.type === 'track.select'
          ? eligible.find((t) => t.id === action.trackId)
          : eligible[(eligible.findIndex((t) => t.id === current.id) + 1) % eligible.length];
      if (!track) throw new Error('Unknown or excluded track');
      next.currentTrackId = track.id;
      next.playback = 'stopped';
      next.phase = 'ready';
      effects.push({ type: 'stop_media' });
      events.push({ type: 'track_selected', itemId: track.id });
      break;
    }
    case 'activity.leave':
      next.phase = 'ended';
      next.playback = 'stopped';
      effects.push({ type: 'stop_media' });
      events.push({ type: 'activity_ended' });
      break;
    default:
      throw new Error('Unsupported action for activity');
  }
  return ActivityTransitionSchema.parse({ nextState: next, events, effects });
}
export function applyActivitySystemInput(
  state: ActivityState,
  input: ActivitySystemInput,
  pack: ApprovedPack,
  ctx: ActivityContext,
): ActivityTransition {
  checked(state, pack, ctx);
  ActivitySystemInputSchema.parse(input);
  if (
    (state.activityId === 'photo_album' || state.activityId === 'twenty_questions') &&
    (pack.activityId === 'photo_album' || pack.activityId === 'twenty_questions')
  )
    return systemReviewed(state, input, pack, ctx);
  if (state.activityId !== 'music_playlist' || state.phase === 'ended')
    return ActivityTransitionSchema.parse({ nextState: state, events: [], effects: [] });
  const next = { ...state, revision: state.revision + 1 };
  const effects: ActivityTransition['effects'] = [];
  const events: ActivityTransition['events'] = [];
  switch (input.type) {
    case 'system.pause':
      next.phase = 'paused';
      next.playback = 'stopped';
      events.push({ type: 'activity_paused', reason: input.reason });
      effects.push({ type: 'stop_media' });
      break;
    case 'system.resume':
      if (state.phase !== 'paused') throw new Error('Not paused');
      {
        const eligible = tracks(pack, ctx);
        const retained = eligible.find((track) => track.id === state.currentTrackId) ?? eligible[0];
        next.currentTrackId = retained?.id ?? null;
        next.playback = 'stopped';
        next.phase = retained ? 'ready' : 'unavailable';
      }
      events.push({ type: 'activity_resumed' });
      break;
    case 'system.end':
      next.phase = 'ended';
      next.playback = 'stopped';
      events.push({ type: 'activity_ended' });
      effects.push({ type: 'stop_media' });
      break;
    case 'system.eligibility_changed':
      events.push({ type: 'eligibility_changed', policyRevision: ctx.eligibility.policyRevision });
      {
        const eligible = tracks(pack, ctx);
        const firstEligibleTrack = eligible[0];
        const currentIsEligible = eligible.some((t) => t.id === state.currentTrackId);
        if (currentIsEligible) break;
        next.currentTrackId = null;
        next.playback = 'stopped';
        // A pause must retain its safe empty position. Resume later chooses a
        // current eligible track explicitly; it never replays an old effect.
        if (state.phase === 'paused') next.phase = 'paused';
        else if (firstEligibleTrack) {
          next.currentTrackId = firstEligibleTrack.id;
          next.phase = 'ready';
        } else next.phase = 'unavailable';
        effects.push({ type: 'stop_media' });
      }
      break;
    case 'system.playback_receipt':
      if (
        state.phase !== 'active' ||
        input.receipt.instanceId !== state.instanceId ||
        !tracks(pack, ctx).some((track) => track.id === state.currentTrackId)
      )
        return ActivityTransitionSchema.parse({ nextState: state, events: [], effects: [] });
      next.playback = input.receipt.status === 'ended' ? 'stopped' : input.receipt.status;
      if (input.receipt.status !== 'playing') next.phase = 'ready';
      events.push(
        ActivityEventSchema.parse({
          type: {
            playing: 'track_played',
            paused: 'track_paused',
            ended: 'track_ended',
            failed: 'media_failed',
          }[input.receipt.status],
          itemId: state.currentTrackId,
          receipt: input.receipt,
        }),
      );
      break;
  }
  return ActivityTransitionSchema.parse({ nextState: next, events, effects });
}
export function projectActivity(
  state: ActivityState,
  pack: ApprovedPack,
  ctx: ActivityContext,
): ActivityView {
  checked(state, pack, ctx);
  if (
    (state.activityId === 'photo_album' || state.activityId === 'twenty_questions') &&
    (pack.activityId === 'photo_album' || pack.activityId === 'twenty_questions')
  )
    return projectReviewed(state, pack, ctx);
  if (state.activityId !== 'music_playlist')
    throw new Error('Activity projection pending Lukas implementation');
  const eligible = tracks(pack, ctx);
  const current = eligible.find((t) => t.id === state.currentTrackId);
  const safe = current && ctx.eligibility.available;
  const phase =
    state.phase === 'ended'
      ? 'ended'
      : state.phase === 'paused'
        ? 'paused'
        : safe
          ? state.phase
          : 'unavailable';
  return ActivityViewSchema.parse({
    activityId: 'music_playlist',
    instanceId: state.instanceId,
    revision: state.revision,
    phase,
    title: 'Listen to music',
    prompt: safe ? current.title : 'No eligible music available',
    assetIds: safe ? [current.assetId] : [],
    currentTrackId: safe ? current.id : null,
    playback: safe ? state.playback : 'stopped',
    choices:
      phase === 'ready' || phase === 'active'
        ? [
            {
              id: 'play',
              label: 'Request playback (no audio in starter)',
              action: { type: 'track.play' },
            },
            { id: 'pause', label: 'Pause music', action: { type: 'track.pause' } },
            { id: 'next', label: 'Next track', action: { type: 'track.next' } },
          ]
        : [],
    capabilities: { audioRequired: true, largeScreenPreferred: false },
  });
}
