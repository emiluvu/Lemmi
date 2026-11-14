import {
  ActivityTransitionSchema,
  ActivityViewSchema,
  type ApprovedPack,
  type ActivityState,
  type ActivityContext,
  type ActivityAction,
  type ActivitySystemInput,
  type ActivityTransition,
} from '@lemmi/contracts';
type Pack = Extract<ApprovedPack, { activityId: 'photo_album' }>;
type State = Extract<ActivityState, { activityId: 'photo_album' }>;
const eligible = (pack: Pack, ctx: ActivityContext) =>
  pack.entries.filter(
    (e) =>
      ctx.eligibility.available &&
      e.entityIds.every(
        (id) =>
          ctx.eligibility.permittedEntityIds.includes(id) &&
          !ctx.eligibility.sessionHiddenIds.includes(id),
      ),
  );
export function createPhoto(instanceId: string, pack: Pack, ctx: ActivityContext): State {
  const entry = eligible(pack, ctx)[0];
  return {
    instanceId,
    activityId: 'photo_album',
    revision: 0,
    phase: entry ? 'ready' : 'unavailable',
    currentPhotoId: entry?.id ?? null,
    position: entry ? pack.entries.indexOf(entry) : null,
    viewingMode: 'just_look',
  };
}
export function reducePhoto(
  state: State,
  action: ActivityAction,
  pack: Pack,
  ctx: ActivityContext,
) {
  if (state.phase === 'ended') throw new Error('Activity has ended');
  const next = { ...state, revision: state.revision + 1 };
  const events: ActivityTransition['events'] = [],
    effects: ActivityTransition['effects'] = [{ type: 'stop_media' }];
  if (action.type === 'activity.leave') {
    next.phase = 'ended';
    next.viewingMode = 'just_look';
    next.currentPhotoId = null;
    next.position = null;
    events.push({ type: 'activity_ended' });
  } else {
    const entries = eligible(pack, ctx),
      index = entries.findIndex((e) => e.id === state.currentPhotoId);
    const current = entries[index];
    if (!current || ['paused', 'unavailable'].includes(state.phase))
      throw new Error('Photo unavailable');
    if (action.type === 'photo.talk') {
      if (!current.caption?.trim() && !current.discussionContext?.trim())
        throw new Error('No approved description');
      next.viewingMode = 'talk';
      next.phase = 'active';
      effects.push({
        type: 'offer_photo_conversation',
        photoId: current.id,
        assetId: current.assetId,
      });
      events.push({ type: 'photo_talk_requested', itemId: current.id });
    } else if (action.type === 'photo.just_look') {
      next.viewingMode = 'just_look';
      next.phase = 'ready';
      events.push({ type: 'photo_just_look', itemId: current.id });
    } else if (
      ['photo.next', 'photo.previous', 'photo.skip', 'photo.select'].includes(action.type)
    ) {
      const entry =
        action.type === 'photo.select'
          ? entries.find((e) => e.id === action.photoId)
          : entries[
              (index + (action.type === 'photo.previous' ? entries.length - 1 : 1)) % entries.length
            ];
      if (!entry) throw new Error('Unknown or excluded photo');
      if (action.type === 'photo.skip') events.push({ type: 'photo_skipped', itemId: current.id });
      next.currentPhotoId = entry.id;
      next.position = pack.entries.indexOf(entry);
      next.phase = 'ready';
      next.viewingMode = 'just_look';
      events.push({ type: 'photo_selected', itemId: entry.id });
    } else throw new Error('Unsupported photo action');
  }
  return ActivityTransitionSchema.parse({ nextState: next, events, effects });
}
export function systemPhoto(
  state: State,
  input: ActivitySystemInput,
  pack: Pack,
  ctx: ActivityContext,
) {
  if (state.phase === 'ended' || input.type === 'system.playback_receipt')
    return ActivityTransitionSchema.parse({ nextState: state, events: [], effects: [] });
  let next: State = { ...state, revision: state.revision + 1 };
  const events: ActivityTransition['events'] = [];
  if (input.type === 'system.end') {
    next.phase = 'ended';
    next.viewingMode = 'just_look';
    next.currentPhotoId = null;
    next.position = null;
    events.push({ type: 'activity_ended' });
  }
  if (input.type === 'system.pause') {
    next.phase = 'paused';
    events.push({ type: 'activity_paused', reason: input.reason });
  }
  if (input.type === 'system.resume') {
    if (state.phase !== 'paused') throw new Error('Not paused');
    next.phase = 'ready';
    next.viewingMode = 'just_look';
    events.push({ type: 'activity_resumed' });
  }
  if (!eligible(pack, ctx).some((e) => e.id === next.currentPhotoId))
    next = {
      ...next,
      phase: next.phase === 'paused' || next.phase === 'ended' ? next.phase : 'unavailable',
      currentPhotoId: null,
      position: null,
      viewingMode: 'just_look',
    };
  if (input.type === 'system.eligibility_changed')
    events.push({ type: 'eligibility_changed', policyRevision: ctx.eligibility.policyRevision });
  return ActivityTransitionSchema.parse({
    nextState: next,
    events,
    effects: [{ type: 'stop_media' }],
  });
}
export function projectPhoto(state: State, pack: Pack, ctx: ActivityContext) {
  const entry = eligible(pack, ctx).find((e) => e.id === state.currentPhotoId);
  return ActivityViewSchema.parse({
    // Explicit safe projection below; private discussion context never leaves this seam.
    activityId: 'photo_album',
    instanceId: state.instanceId,
    revision: state.revision,
    phase: !entry && !['paused', 'ended'].includes(state.phase) ? 'unavailable' : state.phase,
    title: 'Photo Story',
    prompt: entry ? 'We can talk, or simply look.' : 'No approved photo is available.',
    currentAssetId: entry?.assetId ?? null,
    caption: entry?.caption ?? null,
    viewingMode: state.viewingMode,
    assetIds: entry ? [entry.assetId] : [],
    capabilities: { audioRequired: false, largeScreenPreferred: true },
    choices:
      entry && !['paused', 'ended'].includes(state.phase)
        ? [
            { id: 'talk', label: 'Talk about this photo', action: { type: 'photo.talk' } },
            { id: 'look', label: 'Just look', action: { type: 'photo.just_look' } },
            { id: 'skip', label: 'Skip this photo', action: { type: 'photo.skip' } },
          ]
        : [],
  });
}
