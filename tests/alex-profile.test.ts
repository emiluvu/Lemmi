import { test, expect } from 'bun:test';
import {
  ParticipantProfileSchema,
  ProfileDetailSchema,
  type AssetMetadata,
} from '@lemmi/contracts';
import { participantProfile, caregiverProfile } from '@lemmi/contracts/fixtures';
import {
  alexProfileDetail,
  alexPhotoDrafts,
  alexFavoriteSong,
  prepareAlexProfileUpdate,
  buildAlexPhotoPack,
  buildAlexMusicPack,
} from '@lemmi/activities';

test('fictional Alex uses guided support, approved biography and privacy off', () => {
  expect(alexProfileDetail.interests).toEqual([
    'topic:gardening',
    'topic:beaches',
    'topic:banking',
  ]);
  expect(alexProfileDetail.communicationSupport.preset).toBe('guided');
  expect(alexProfileDetail.rememberingEnabled).toBe(false);
  expect(alexProfileDetail.excerptSavingEnabled).toBe(false);
  const facts = alexProfileDetail.approvedFacts.map((fact) => fact.value).join(' ');
  expect(facts).toContain('Bob and Jill');
  expect(facts).toContain('1930');
  expect(facts).toContain('30 years');
  expect(facts).not.toContain('Joe');
  expect(ParticipantProfileSchema.safeParse(alexProfileDetail).success).toBe(false);
  expect(ParticipantProfileSchema.parse(participantProfile)).not.toHaveProperty('approvedFacts');
  expect(caregiverProfile).not.toHaveProperty('approvedFacts');
});

test('update preserves unrelated facts, guidance, interests and current revision without mutation', () => {
  const current = structuredClone(alexProfileDetail);
  current.revision = 7;
  current.interests.push('topic:birds');
  current.sensitiveTopicGuidance = 'Avoid discussing travel.';
  current.approvedFacts.push({
    id: 'a1e00000-0000-4000-8000-999999999999',
    field: 'interest_context',
    value: 'Alex enjoys birds.',
    source: 'caregiver_provided',
  });
  const before = structuredClone(current);
  const update = prepareAlexProfileUpdate(current, 'update-alex');
  expect(update.expectedRevision).toBe(7);
  expect(update.patch.interests).toContain('topic:birds');
  expect(update.patch.approvedFacts).toHaveLength(9);
  expect(update.patch.sensitiveTopicGuidance).toContain('Avoid discussing travel.');
  expect(update.patch.sensitiveTopicGuidance).toContain('cooking');
  expect(current).toEqual(before);
  const applied = ProfileDetailSchema.parse({ ...current, ...update.patch, revision: 8 });
  expect(prepareAlexProfileUpdate(applied, 'update-again').patch).toEqual(update.patch);
});

test('update rejects other profiles, enabled retention and overflowing fact merges', () => {
  expect(() =>
    prepareAlexProfileUpdate({ ...alexProfileDetail, id: 'preview-sam' }, 'x'),
  ).toThrow();
  expect(() =>
    prepareAlexProfileUpdate({ ...alexProfileDetail, excerptSavingEnabled: true }, 'x'),
  ).toThrow();
  const facts = [1, 2, 3].map((id) => ({
    id: `b1e00000-0000-4000-8000-${String(id).padStart(12, '0')}`,
    field: 'personal_context' as const,
    value: 'Unrelated existing fact.',
    source: 'caregiver_provided' as const,
  }));
  expect(() =>
    prepareAlexProfileUpdate({ ...alexProfileDetail, approvedFacts: facts }, 'x'),
  ).toThrow();
});

const photo: AssetMetadata = {
  id: 'c1e00000-0000-4000-8000-000000000001',
  profileId: 'profile-alex',
  version: 1,
  kind: 'image',
  mediaType: 'image/png',
  byteLength: 100,
  approved: true,
  caption: alexPhotoDrafts[0].caption,
  entityIds: ['topic:gardening'],
};
test('missing media stays unavailable, never invents approval or asset IDs', () => {
  expect(buildAlexPhotoPack({})).toBeNull();
  expect(buildAlexMusicPack()).toBeNull();
  expect(alexFavoriteSong.permissionStatus).toBe('user_attested');
});
test('approved returned photo metadata binds reviewed content and excludes cooking/family drafts', () => {
  const pack = buildAlexPhotoPack({
    gardening: photo,
    cooking: photo,
    christmas: photo,
    tea: photo,
  });
  expect(pack?.activityId).toBe('photo_album');
  if (pack?.activityId !== 'photo_album') throw new Error('Expected photos');
  expect(pack.entries.map((entry) => entry.id)).toEqual(['gardening']);
  expect(pack.entries[0]?.assetId).toBe(photo.id);
  expect(pack.entries[0]?.discussionContext).toContain('no personal participation');
  expect(() =>
    buildAlexPhotoPack({ gardening: { ...photo, caption: 'Unsupported identity.' } }),
  ).toThrow();
  expect(() =>
    buildAlexPhotoPack({ gardening: { ...photo, entityIds: ['topic:cooking'] } }),
  ).toThrow();
  expect(() =>
    buildAlexPhotoPack({ gardening: { ...photo, approved: false } as unknown as AssetMetadata }),
  ).toThrow();
});
test('music selection requires a real approved WAV binding; selection is not playback', () => {
  const music: AssetMetadata = {
    ...photo,
    kind: 'music',
    mediaType: 'audio/wav',
    caption: 'My Way — Frank Sinatra (caregiver-provided selection).',
    entityIds: ['topic:music'],
  };
  const pack = buildAlexMusicPack(music);
  if (pack?.activityId !== 'music_playlist') throw new Error('Expected playlist');
  expect(pack.tracks[0]?.assetId).toBe(music.id);
  expect(pack.tracks[0]?.title).toContain('My Way');
  expect(() => buildAlexMusicPack(photo)).toThrow();
});
