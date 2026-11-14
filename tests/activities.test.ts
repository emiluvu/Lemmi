import { test, expect } from 'bun:test';
import {
  createActivity,
  reduceActivity,
  projectActivity,
  applyActivitySystemInput,
} from '@lemmi/activities';
import { musicPack, contextFor } from '@lemmi/contracts/fixtures';
test('eligibility filters targets and projections; policy change stops stale content', () => {
  const ctx = contextFor('s');
  let state = createActivity({ instanceId: 'a' }, musicPack, ctx);
  const blocked = {
    ...ctx,
    eligibility: { ...ctx.eligibility, policyRevision: 1, sessionHiddenIds: ['topic:gardening'] },
  };
  expect(projectActivity(state, musicPack, blocked).assetIds).toEqual([]);
  expect(() => reduceActivity(state, { type: 'track.play' }, musicPack, blocked)).toThrow();
  state = applyActivitySystemInput(
    state,
    { type: 'system.pause', reason: 'camera' },
    musicPack,
    ctx,
  ).nextState;
  const changed = applyActivitySystemInput(
    state,
    { type: 'system.eligibility_changed' },
    musicPack,
    blocked,
  );
  expect(changed.nextState.phase).toBe('paused');
  expect(changed.effects).toEqual([{ type: 'stop_media' }]);
  expect(projectActivity(changed.nextState, musicPack, blocked).choices).toEqual([]);
});
test('resume produces no output; delayed receipts cannot reactivate paused/ended activity', () => {
  const ctx = contextFor('s');
  let state = createActivity({ instanceId: 'a' }, musicPack, ctx);
  state = applyActivitySystemInput(
    state,
    { type: 'system.pause', reason: 'camera' },
    musicPack,
    ctx,
  ).nextState;
  const receipt = {
    type: 'system.playback_receipt' as const,
    receipt: {
      instanceId: 'a',
      effectId: 'e',
      generation: 0,
      leaseId: 'l',
      sequence: 0,
      status: 'playing' as const,
    },
  };
  expect(applyActivitySystemInput(state, receipt, musicPack, ctx).nextState.phase).toBe('paused');
  const resumed = applyActivitySystemInput(state, { type: 'system.resume' }, musicPack, ctx);
  expect(resumed.effects).toEqual([]);
  expect(resumed.nextState.phase).toBe('ready');
  state = applyActivitySystemInput(
    resumed.nextState,
    { type: 'system.end', reason: 'stop' },
    musicPack,
    ctx,
  ).nextState;
  expect(applyActivitySystemInput(state, receipt, musicPack, ctx).nextState.phase).toBe('ended');
});
