// Reviewed fictional content. No I/O, profile writes, permission grants or playback here.
import {
  ProfileDetailSchema,
  ProfileUpdateSchema,
  ApprovedPackSchema,
  AssetMetadataSchema,
  type ProfileDetail,
  type ProfileUpdate,
  type AssetMetadata,
} from '@lemmi/contracts';
import { caregiverProfile } from '@lemmi/contracts/fixtures';

export const alexProfileDetail = ProfileDetailSchema.parse({
  ...caregiverProfile,
  privacyRevision: 0,
  policyRevision: 0,
  approvedFacts: [
    ['personal_context', 'Alex was born in 1930.'],
    ['personal_context', 'Alex worked as a banker for 30 years.'],
    ['personal_context', 'Alex has two children: Bob and Jill.'],
    ['familiar_person', "Barbara is identified as Alex's wife; current status is unknown."],
    ['familiar_person', "Bob is Alex's son."],
    ['familiar_person', "Jill is Alex's daughter."],
    ['interest_context', 'Alex enjoys gardening, beaches and discussing banking.'],
    ['interest_context', "Alex's favorite song is My Way by Frank Sinatra."],
  ].map(([field, value], index) => ({
    id: `a1e00000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    field,
    value,
    source: 'caregiver_provided',
  })),
});

// Consume profile.detail first. The API replaces the entire fact array, so preserve
// unrelated facts and let the existing limit reject an overfull merge, never truncate.
export function prepareAlexProfileUpdate(current: ProfileDetail, commandId: string): ProfileUpdate {
  ProfileDetailSchema.parse(current);
  if (current.id !== 'profile-alex') throw new Error('Only fictional Alex may be updated');
  if (current.rememberingEnabled || current.excerptSavingEnabled)
    throw new Error('Disable remembering and excerpts through the existing privacy flow first');
  const replacementIds = new Set(alexProfileDetail.approvedFacts.map((fact) => fact.id));
  const sensitiveTopicGuidance = current.sensitiveTopicGuidance.includes(
    caregiverProfile.sensitiveTopicGuidance,
  )
    ? current.sensitiveTopicGuidance
    : [current.sensitiveTopicGuidance, caregiverProfile.sensitiveTopicGuidance]
        .filter(Boolean)
        .join(' ');
  return ProfileUpdateSchema.parse({
    profileId: current.id,
    commandId,
    expectedRevision: current.revision,
    patch: {
      preferredName: 'Alex',
      avatarId: 'lemming',
      communicationSupport: { preset: 'guided', configVersion: 1 },
      interests: [...new Set([...current.interests, ...alexProfileDetail.interests])],
      sensitiveTopicGuidance,
      approvedFacts: [
        ...current.approvedFacts.filter((fact) => !replacementIds.has(fact.id)),
        ...alexProfileDetail.approvedFacts,
      ],
    },
  });
}

// These are caption drafts, not approved media. Filename identities are not facts.
// New topic IDs require Anay's catalog/eligibility review before proactive hosting.
export const alexPhotoDrafts = [
  {
    id: 'gardening',
    file: 'Alex Gardening.jpg',
    topic: 'topic:gardening',
    caption: 'A black-and-white photograph of a person working in a garden.',
    discussionContext:
      'Generic gardening scene. Alex enjoys gardening; no personal participation or ownership is established.',
    opening: 'What do you enjoy about gardening?',
    proactive: true,
  },
  {
    id: 'seaside',
    file: 'Alex at the Beach.jpg',
    topic: 'topic:beaches',
    caption: 'A person sitting beside the sea.',
    discussionContext:
      'Generic seaside scene. No identity, location or visit by Alex is established. Visible stock watermark remains.',
    opening: 'What do you enjoy about being by the sea?',
    proactive: true,
  },
  {
    id: 'beach',
    file: 'Picture Of Alex Favorite Beach.jpg',
    topic: 'topic:beaches',
    caption: 'A beach with palm trees, rocks and blue water.',
    discussionContext:
      'Generic beach scene. Beaches are an approved interest; no exact place, visit or ownership is established.',
    opening: 'What do you like about this beach scene?',
    proactive: true,
  },
  {
    id: 'christmas',
    file: 'Alex Christmas Photo with Wife(Barbara) and Kids(Jill and Joe).jpg',
    topic: null,
    caption: 'Two adults and two children sitting together near a Christmas tree.',
    discussionContext:
      'Generic scene. The filename says Jill and Joe, but the approved profile says Bob and Jill. Do not infer identities or a personal event. Await caregiver clarification.',
    opening: null,
    proactive: false,
  },
  {
    id: 'tea',
    file: 'Alex in Black suit with wife(Barbara) and brother and his wife.jpg',
    topic: null,
    caption: 'Four adults seated together around a table.',
    discussionContext:
      'Generic gathering. No identities or relationships established. Getty Images watermark and George Marks credit are visible.',
    opening: null,
    proactive: false,
  },
  {
    id: 'cooking',
    file: 'Picture of Cooking.jpg',
    topic: 'topic:cooking',
    caption: 'A chef chopping vegetables in a kitchen.',
    discussionContext:
      'Cooking is an avoided topic. Do not proactively show this image or ask cooking questions. Visible stock watermark remains.',
    opening: null,
    proactive: false,
  },
] as const;

export const alexFavoriteSong = {
  title: 'My Way',
  artist: 'Frank Sinatra',
  file: 'My Way (2008 Remastered).mp3',
  source: 'caregiver_provided',
  // Performer/version are not independently established by the file metadata.
  metadataTitle: 'My Way (2008 Remastered)',
  durationSeconds: 276.257959,
  permissionStatus: 'missing',
} as const;

// Only use metadata returned after the existing authenticated approved upload.
// No placeholder asset IDs, file paths, auto-approval or pretend playback success.
function checkedAsset(asset: AssetMetadata, kind: 'image' | 'music') {
  AssetMetadataSchema.parse(asset);
  if (
    asset.profileId !== 'profile-alex' ||
    asset.kind !== kind ||
    asset.mediaType !== (kind === 'image' ? 'image/png' : 'audio/wav')
  )
    throw new Error('Asset does not match the reviewed content');
}
export function buildAlexPhotoPack(assets: Partial<Record<string, AssetMetadata>>) {
  const entries = alexPhotoDrafts.flatMap((draft) => {
    const asset = assets[draft.id];
    if (!draft.proactive || !draft.topic || !asset) return [];
    checkedAsset(asset, 'image');
    if (
      asset.caption !== draft.caption ||
      asset.entityIds.length !== 1 ||
      asset.entityIds[0] !== draft.topic
    )
      throw new Error('Uploaded photo context differs from reviewed content');
    return [
      {
        id: draft.id,
        assetId: asset.id,
        caption: draft.caption,
        discussionContext: draft.discussionContext,
        entityIds: asset.entityIds,
      },
    ];
  });
  if (!entries.length) return null;
  return ApprovedPackSchema.parse({
    id: 'alex-reviewed-photos',
    version: 1,
    activityId: 'photo_album',
    approved: true,
    collectionKind: 'place_scenes',
    entries,
  });
}
export function buildAlexMusicPack(asset?: AssetMetadata) {
  if (!asset) return null;
  checkedAsset(asset, 'music');
  if (
    asset.caption !== 'My Way — Frank Sinatra (caregiver-provided selection).' ||
    asset.entityIds.length !== 1 ||
    asset.entityIds[0] !== 'topic:music'
  )
    throw new Error('Uploaded music context differs from reviewed content');
  return ApprovedPackSchema.parse({
    id: 'alex-reviewed-music',
    version: 1,
    activityId: 'music_playlist',
    approved: true,
    tracks: [
      {
        id: 'my-way',
        title: 'My Way — Frank Sinatra',
        assetId: asset.id,
        entityIds: asset.entityIds,
      },
    ],
  });
}
