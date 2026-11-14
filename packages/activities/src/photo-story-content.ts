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

export const publicPhotoStoryPack = ApprovedPackSchema.parse({
  ...photoStoryDemoPack,
  id: 'reviewed-photo-scenes',
  entries:
    photoStoryDemoPack.activityId === 'photo_album'
      ? photoStoryDemoPack.entries.map((entry) => ({
          ...entry,
          entityIds: ['scene:generic-nature'],
          discussionContext:
            'Reviewed fictional illustration. No personal event, location, visit, relationship or ownership is established. Use the caption only; do not infer biography.',
        }))
      : [],
});
