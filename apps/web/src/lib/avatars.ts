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

// Dot bounds in the 724px thinking frame; keep in sync with the supplied strips.
export const avatarThinkingDots: Record<
  AvatarId,
  readonly (readonly [number, number, number, number])[]
> = {
  dog: [
    [542, 144, 37, 34],
    [602, 142, 37, 36],
    [661, 142, 38, 36],
  ],
  cat: [
    [529, 177, 37, 36],
    [593, 176, 37, 35],
    [661, 176, 39, 32],
  ],
  bunny: [
    [504, 195, 32, 34],
    [561, 194, 34, 32],
    [613, 195, 36, 32],
  ],
  bird: [
    [512, 68, 35, 35],
    [587, 67, 35, 35],
    [656, 66, 32, 33],
  ],
  lemming: [
    [511, 51, 40, 37],
    [586, 48, 39, 38],
    [659, 46, 41, 37],
  ],
};
