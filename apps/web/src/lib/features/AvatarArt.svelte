<script lang="ts">
  import type { AvatarId } from '@lemmi/contracts';
  import { avatarArtwork } from '#lib/avatars.ts';
  let {
    avatarId,
    decorative = false,
    talking = false,
    animated = false,
  }: {
    avatarId: AvatarId;
    decorative?: boolean;
    talking?: boolean;
    animated?: boolean;
  } = $props();
  let failed = $state(false);
  const art = $derived(avatarArtwork[avatarId]);
  $effect(() => {
    void avatarId;
    failed = false;
  });
</script>

{#if failed}
  <span class="avatar-unavailable" role="status">{art.label} artwork unavailable</span>
{:else if animated}
  <span
    class="sprite"
    class:talking
    role={decorative ? undefined : 'img'}
    aria-label={decorative ? undefined : `Lemmi’s ${art.label.toLowerCase()} avatar`}
    aria-hidden={decorative ? true : undefined}
    style:--sprite={`url('/images/avatars/${avatarId}-strip.png')`}
  ></span>
{:else}
  <img
    src={art.src}
    alt={decorative ? '' : `Lemmi’s ${art.label.toLowerCase()} avatar`}
    width={art.width}
    height={art.height}
    onerror={() => (failed = true)}
    draggable="false"
  />
{/if}

<style>
  .sprite {
    display: block;
    width: 100%;
    height: 100%;
    background-image: var(--sprite);
    background-size: 300% 100%;
    background-position: left center;
    background-repeat: no-repeat;
    aspect-ratio: 1;
  }
  .talking {
    animation: mouth 360ms steps(1, end) infinite;
  }
  @keyframes mouth {
    0%,
    100% {
      background-position: left center;
    }
    50% {
      background-position: center center;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .talking {
      animation: none;
      background-position: center center;
    }
  }
  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
    min-width: 0;
    min-height: 0;
  }
  .avatar-unavailable {
    display: grid;
    place-items: center;
    height: 100%;
    font-size: 18px;
    text-align: center;
  }
</style>
