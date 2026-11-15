import { test, expect } from 'bun:test';
import { SessionRegistry } from '../packages/server/src/session-registry';
import { alexProfilePhotoPack } from '../packages/server/src/profile-photo-pack';
import { ProfileDetailSchema, ok, type SessionSnapshot } from '@lemmi/contracts';
import { caregiverProfile } from '@lemmi/contracts/fixtures';

const a = 'f1000000-0000-4000-8000-000000000001';
const b = 'f1000000-0000-4000-8000-000000000002';
function profile(
  photos = [{ assetId: a, description: 'Alex tending a garden.', portrait: false }],
) {
  return ProfileDetailSchema.parse({
    ...caregiverProfile,
    privacyRevision: 0,
    policyRevision: 0,
    approvedFacts: [],
    context: { photos },
  });
}
function value<T>(result: any): T {
  if (!result.ok) throw new Error(result.error.message);
  return result.data;
}
function registry(chat?: any) {
  return new SessionRegistry(chat, undefined, Date.now, () => {}, true);
}

test('Alex uses saved non-portrait photos; an empty album never becomes the garden fixture', () => {
  const r = registry();
  r.acceptPersistentProfile(profile());
  r.authorizePhotoDemoProfile('profile-alex', true);
  const c = r.forProfile('profile-alex');
  value(
    c.handle('session.start', {
      profileId: 'profile-alex',
      endpoint: 'browser',
      commandId: 'start',
    }),
  );
  const view = value<any>(c.startPhoto('photo'));
  expect(view.currentAssetId).toBe(a);
  expect(view.caption).toBe('Alex tending a garden.');
  expect(c.photoAssetAllowed(a)).toBe(true);
  expect(c.photoAssetAllowed('photo-story-garden')).toBe(false);
  r.acceptPersistentProfile({ ...profile([]), revision: 1 });
  expect(c.snapshot()?.phase).toBe('paused');
  expect(c.photoAssetAllowed(a)).toBe(false);
  expect(c.publicPhotoEnabled()).toBe(false);
  expect(c.startPhoto('empty')).toMatchObject({ ok: false, error: { code: 'UNAVAILABLE' } });
  expect(
    alexProfilePhotoPack(profile([{ assetId: a, description: 'Portrait only', portrait: true }])),
  ).toMatchObject({ entries: [] });
});
test('other fictional profiles retain neutral pictures and cannot access Alex assets', () => {
  const r = registry();
  r.acceptPersistentProfile({ ...profile([]), id: 'profile-casey', preferredName: 'Casey' });
  r.authorizePhotoDemoProfile('profile-casey', true);
  const c = r.forProfile('profile-casey');
  value(
    c.handle('session.start', {
      profileId: 'profile-casey',
      endpoint: 'browser',
      commandId: 'start',
    }),
  );
  const view = value<any>(c.startPhoto('photo'));
  expect(view.currentAssetId).toBe('photo-story-garden');
  expect(c.photoAssetAllowed(a)).toBe(false);
  expect(() => alexProfilePhotoPack({ ...profile(), id: 'preview-sam' })).toThrow();
});
test('a saved album replacement fences an in-flight model result and removes the old picture', async () => {
  const entered = Promise.withResolvers<void>(),
    release = Promise.withResolvers<any>();
  const r = registry({
    complete: async () => {
      entered.resolve();
      return release.promise;
    },
  });
  r.acceptPersistentProfile(profile());
  r.authorizePhotoDemoProfile('profile-alex', true);
  const c = r.forProfile('profile-alex');
  const s = value<SessionSnapshot>(
    c.handle('session.start', {
      profileId: 'profile-alex',
      endpoint: 'browser',
      commandId: 'start',
    }),
  );
  const v = value<any>(c.startPhoto('photo'));
  value(
    c.handle('activities.submit', {
      sessionId: s.id,
      instanceId: v.instanceId,
      expectedRevision: v.revision,
      commandId: 'talk',
      action: { type: 'photo.talk' },
    }),
  );
  const pending = c.submitText({
    sessionId: s.id,
    expectedGeneration: c.snapshot()!.generation,
    commandId: 'answer',
    language: 'en',
    text: 'A fictional answer.',
  });
  await entered.promise;
  r.acceptPersistentProfile({
    ...profile([{ assetId: b, description: 'Alex by the sea.', portrait: false }]),
    revision: 1,
  });
  release.resolve(ok({ text: 'A stale response.', language: 'en' }));
  expect((await pending).ok).toBe(false);
  expect(c.snapshot()?.phase).toBe('paused');
  expect(c.photoAssetAllowed(a)).toBe(false);
  expect(c.persistenceSnapshot()).not.toHaveProperty('memory');
});
