import { ApprovedPackSchema } from '@lemmi/contracts';

// Fictional generic illustrations, authored for this demo. No family photographs/history.
export const photoStoryDemoPack = ApprovedPackSchema.parse({
  id: 'alex-photo-story-demo',
  version: 1,
  activityId: 'photo_album',
  approved: true,
  collectionKind: 'album',
  entries: [
    {
      id: 'garden-demo',
      assetId: 'photo-story-garden',
      caption: 'Roses and other flowers in a garden.',
      discussionContext:
        'A fictional illustrated garden. Alex has a caregiver-provided gardening interest. No person is pictured; do not assume Alex planted these flowers.',
      entityIds: ['topic:gardening'],
    },
    {
      id: 'park-demo',
      assetId: 'photo-story-park',
      caption: 'A path and a bench in a leafy park.',
      discussionContext:
        'A fictional illustrated park. No personal event, location or visit is established.',
      entityIds: ['topic:gardening'],
    },
  ],
});
