import { ApprovedPackSchema, ProfileDetailSchema, type ProfileDetail } from '@lemmi/contracts';

// Host-only projection of saved caregiver context. Asset bytes/ownership/policy
// are still checked by the existing private repository at each scoped read.
export function alexProfilePhotoPack(raw: ProfileDetail) {
  const profile = ProfileDetailSchema.parse(raw);
  if (profile.id !== 'profile-alex') throw new Error('Alex photo pack requires Alex');
  return ApprovedPackSchema.parse({
    id: 'profile-alex-photos',
    version: 1,
    activityId: 'photo_album',
    approved: true,
    collectionKind: 'album',
    entries: (profile.context?.photos ?? [])
      .filter((photo) => !photo.portrait)
      .map((photo) => ({
        id: photo.assetId,
        assetId: photo.assetId,
        caption: photo.description || 'An approved photo from Alex’s album.',
        discussionContext: `Caregiver-provided fictional photo description: ${photo.description || 'No description supplied.'} The image itself was not analyzed. Use approved profile context; do not infer unnamed people, dates, places or memories.`,
        entityIds: ['profile:approved-photo'],
      })),
  });
}
