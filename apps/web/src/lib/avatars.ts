import type { AvatarId } from '@lemmi/contracts';

// UI asset metadata only. The saved profile remains the authority for avatarId.
export const avatarArtwork = {
  dog: { label: 'Dog', src: '/images/avatars/dog.png', width: 1448, height: 1086 },
  cat: { label: 'Cat', src: '/images/avatars/cat.png', width: 1312, height: 1199 },
  bunny: { label: 'Bunny', src: '/images/avatars/bunny.png', width: 1278, height: 1230 },
  bird: { label: 'Bird', src: '/images/avatars/bird.png', width: 1312, height: 1199 },
  lemming: { label: 'Lemming', src: '/images/avatars/lemming.png', width: 1312, height: 1199 },
} satisfies Record<AvatarId, { label: string; src: string; width: number; height: number }>;

export const avatarChoices: AvatarId[] = ['dog', 'cat', 'bunny', 'bird', 'lemming'];
