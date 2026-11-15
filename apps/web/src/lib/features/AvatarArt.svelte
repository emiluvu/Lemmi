<script lang="ts">
  import type { AvatarId } from '@lemmi/contracts';
  import { avatarArtwork, avatarThinkingDots } from '#lib/avatars.ts';
  let {
    avatarId,
    decorative = false,
    talking = false,
    thinking = false,
    animated = false,
  }: {
    avatarId: AvatarId;
    decorative?: boolean;
    talking?: boolean;
    thinking?: boolean;
    animated?: boolean;
  } = $props();
  const dotsMaskId = $props.id();
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
  <svg
    class="sprite"
    viewBox="0 0 724 724"
    preserveAspectRatio="xMidYMid meet"
    role={decorative ? undefined : 'img'}
    aria-label={decorative ? undefined : `Lemmi’s ${art.label.toLowerCase()} avatar`}
    aria-hidden={decorative ? true : undefined}
  >
    <defs>
      {#if thinking && !talking}
        <mask
          id={dotsMaskId}
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width="724"
          height="724"
          style="mask-type: luminance"
        >
          <rect width="724" height="724" fill="white" />
          {#each avatarThinkingDots[avatarId] as [x, y, width, height], index}
            <rect {x} {y} {width} {height} class={`thinking-dot dot-${index}`} />
          {/each}
        </mask>
      {/if}
    </defs>
    <svg width="724" height="724" overflow="hidden">
      <g mask={thinking && !talking ? `url(#${dotsMaskId})` : undefined}>
        <image
          href={`/images/avatars/${avatarId}-strip.png`}
          width="2172"
          height="724"
          class="face"
          class:talking
          class:thinking={thinking && !talking}
          onerror={() => (failed = true)}
        />
      </g>
    </svg>
  </svg>
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
    overflow: hidden;
  }
  .face {
    transform: translateX(0);
  }

  .talking {
    transform: translateX(-724px);
  }
  .thinking {
    transform: translateX(-1448px);
  }
  .thinking-dot {
    fill: black;
  }
  .dot-0 {
    animation: first-dot 2.4s steps(1, end) infinite;
  }
  .dot-1 {
    animation: second-dot 2.4s steps(1, end) infinite;
  }
  .dot-2 {
    animation: third-dot 2.4s steps(1, end) infinite;
  }
  @keyframes first-dot {
    0% {
      opacity: 1;
    }
    15%,
    100% {
      opacity: 0;
    }
  }
  @keyframes second-dot {
    0% {
      opacity: 1;
    }
    35%,
    100% {
      opacity: 0;
    }
  }
  @keyframes third-dot {
    0% {
      opacity: 1;
    }
    55%,
    100% {
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .thinking-dot {
      animation: none;
      opacity: 0;
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
