<script lang="ts">
  import type { AvatarId } from '@lemmi/contracts';
  import { avatarArtwork } from '#lib/avatars.ts';
  let { avatarId, decorative = false }: { avatarId: AvatarId; decorative?: boolean } = $props();
  let failed = $state(false);
  const art = $derived(avatarArtwork[avatarId]);
  $effect(() => {
    void avatarId;
    failed = false;
  });
</script>

{#if failed}
  <span class="avatar-unavailable" role="status">{art.label} artwork unavailable</span>
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
