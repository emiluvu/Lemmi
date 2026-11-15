import { expect, test } from 'bun:test';
import { ok } from '@lemmi/contracts';
import { caregiverProfile } from '@lemmi/contracts/fixtures';
import { PersistentData } from '../packages/server/src/data/service';
import { SessionRegistry } from '@lemmi/server';

const input = {
  profileId: 'profile-alex',
  expectedRevision: 0,
  commandId: 'edit-demo',
  patch: { preferredName: 'Alexandra', avatarId: 'cat' },
};
function fixture() {
  const sessions = new SessionRegistry();
  let revision = 0,
    writes = 0;
  const repo = {
    sql: async () => [{ one: 1 }],
    listProfiles: async () => [{ ...caregiverProfile, revision }],
    update: async (principal: any, request: any, before: () => void) => {
      expect(principal).toMatchObject({
        kind: 'caregiver',
        subject: 'fixture-caregiver',
        profileId: 'profile-alex',
      });
      if (request.expectedRevision !== revision)
        throw Object.assign(new Error('Profile changed'), { code: 'REVISION_CONFLICT' });
      before();
      writes++;
      return {
        ...caregiverProfile,
        ...request.patch,
        revision: ++revision,
        privacyRevision: 0,
        policyRevision: 0,
        approvedFacts: [],
        sensitiveTopicGuidance: 'private guidance',
      };
    },
  };
  const data = new PersistentData(repo as any, 'fixture-caregiver', sessions, Date.now, () => {});
  return { data, sessions, writes: () => writes };
}
test('demo edits reject example/foreign profiles and private field injection before any write', async () => {
  const f = fixture();
  for (const profileId of ['preview-morgan', 'profile-foreign'])
    await expect(
      f.data.demoHandle({ operation: 'profile.update', input: { ...input, profileId } }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  await expect(
    f.data.demoHandle({
      operation: 'profile.update',
      input: { ...input, patch: { ...input.patch, approvedFacts: [] } },
    }),
  ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  expect(f.writes()).toBe(0);
});
test('demo edit reuses revision cancellation, returns only public fields and rejects a stale overwrite', async () => {
  const f = fixture();
  f.sessions.forProfile('profile-alex').handle('session.start', {
    profileId: 'profile-alex',
    endpoint: 'browser',
    commandId: 'start',
  });
  const result = await f.data.demoHandle({ operation: 'profile.update', input });
  expect(result).toMatchObject(
    ok({
      id: 'profile-alex',
      preferredName: 'Alexandra',
      avatarId: 'cat',
      revision: 1,
      communicationSupport: caregiverProfile.communicationSupport,
    }),
  );
  expect(JSON.stringify(result)).not.toContain('private guidance');
  expect(JSON.stringify(result)).not.toContain('approvedFacts');
  expect(f.sessions.forProfile('profile-alex').snapshot()?.phase).toBe('paused');
  await expect(
    f.data.demoHandle({ operation: 'profile.update', input: { ...input, commandId: 'stale' } }),
  ).rejects.toMatchObject({ code: 'REVISION_CONFLICT' });
  expect(f.writes()).toBe(1);
});
