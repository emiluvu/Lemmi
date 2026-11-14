<script lang="ts">
  import AvatarArt from '#lib/features/AvatarArt.svelte';
  import type { ActivityAction, ActivityView, AvatarId } from '@lemmi/contracts';
  let {
    view,
    avatarId,
    submit,
    control,
    photoSrc = null,
    preview = false,
    approvedPreview = false,
    busy = false,
    message = '',
  }: {
    view: Extract<ActivityView, { activityId: 'photo_album' }>;
    avatarId: AvatarId;
    submit: (action: ActivityAction) => void;
    control: (action: 'pause' | 'stop' | 'help') => void;
    photoSrc?: string | null;
    preview?: boolean;
    approvedPreview?: boolean;
    busy?: boolean;
    message?: string;
  } = $props();
  let failedAsset = $state<string | null>(null);
  const available = $derived(view.phase === 'ready' || view.phase === 'active');
</script>

<section class="photo-story" aria-labelledby="photo-story-title">
  <header class="story-header">
    <div>
      <p class="eyebrow">
        {preview ? 'Design preview · no live activity' : 'Look at a picture together'}
      </p>
      <h1 id="photo-story-title">Photo story</h1>
    </div>
    <div class="story-mascot"><AvatarArt {avatarId} /></div>
  </header>
  {#if view.phase === 'paused'}<p class="story-notice" role="status">
      Paused. Take your time.
    </p>{:else if view.phase === 'ended'}<p class="story-notice" role="status">
      Photo story has finished.
    </p>{:else if view.phase === 'unavailable'}<p class="story-notice" role="status">
      Photo story is unavailable right now.
    </p>{/if}
  <figure class="story-picture">
    {#if photoSrc && view.currentAssetId && failedAsset !== view.currentAssetId}<img
        src={photoSrc}
        alt={view.caption ?? 'Approved picture for photo story'}
        onerror={() => (failedAsset = view.currentAssetId)}
      />{:else}<div class="story-image-unavailable">
        <span aria-hidden="true">▧</span>
        <p>The picture is unavailable.</p>
      </div>{/if}
    <figcaption>
      {view.caption ?? 'No caption provided.'}{#if preview}<small
          >{approvedPreview
            ? 'Approved picture · browser-only preview.'
            : 'Illustrative preview artwork, not a personal photograph.'}</small
        >{/if}
    </figcaption>
  </figure>
  <p class="story-prompt">{view.prompt ?? 'We can just look, or talk about this picture.'}</p>
  <div class="story-actions" aria-label="Photo story actions">
    {#each view.choices as choice}<button
        type="button"
        class:secondary={choice.action.type !== 'photo.talk'}
        disabled={busy || !available}
        onclick={() => submit(choice.action)}>{choice.label}</button
      >{/each}
  </div>
  <p role="status" class="story-message">{message}</p>
  <div class="story-controls" aria-label="Session controls">
    <button type="button" class="secondary" onclick={() => control('pause')}>Pause</button><button
      type="button"
      onclick={() => control('stop')}>Stop</button
    ><button type="button" class="secondary" onclick={() => control('help')}
      >{preview ? 'Demo help — no real message' : 'Get help'}</button
    >
  </div>
</section>

<style>
  .photo-story {
    width: min(100%, 1040px);
    margin: auto;
    padding: 24px;
    border: 1.5px solid var(--outline-brown);
    border-radius: 26px;
    background: #fffdf7;
    color: var(--ink);
    box-shadow: 0 12px 32px #684b3214;
  }
  .story-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .story-header h1 {
    margin: 4px 0 20px;
    font-size: clamp(30px, 4vw, 44px);
    color: #30442b;
  }
  .story-header .eyebrow {
    margin: 0;
  }
  .story-mascot {
    flex: 0 0 100px;
    height: 90px;
  }
  .story-picture {
    margin: 0;
    overflow: hidden;
    border: 1px solid #c8cdbb;
    border-radius: 18px;
    background: #edf0e3;
  }
  .story-picture > img {
    display: block;
    width: 100%;
    height: clamp(200px, 36vh, 390px);
    object-fit: contain;
    background: #e8eddd;
  }
  figcaption {
    padding: 14px 20px;
    background: #f3eadf;
    font-size: 23px;
    font-weight: 650;
  }
  figcaption small {
    display: block;
    margin-top: 4px;
    font-size: 20px;
    font-weight: 400;
  }
  .story-prompt {
    margin: 20px 0;
    font-size: 24px;
  }
  .story-actions,
  .story-controls {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }
  .story-actions button {
    flex: 1 1 170px;
  }
  .story-actions button,
  .story-controls button {
    min-height: 56px;
    font-size: 20px;
  }
  .story-controls {
    position: sticky;
    bottom: 0;
    margin: 18px -24px -24px;
    padding: 16px 24px;
    border-top: 1px solid #d7c9b5;
    border-radius: 0 0 22px 22px;
    background: #f7f0e3;
  }
  .story-controls button {
    flex: 1;
  }
  .story-image-unavailable {
    min-height: 220px;
    display: grid;
    place-content: center;
    text-align: center;
  }
  .story-image-unavailable span {
    font-size: 48px;
  }
  .story-notice {
    padding: 12px;
    background: #edf0e3;
    border-radius: 10px;
  }
  .story-message {
    font-size: 20px;
  }
  @media (max-width: 600px) {
    .photo-story {
      padding: 16px;
    }
    .story-mascot {
      flex-basis: 70px;
    }
    .story-controls {
      margin: 16px -16px -16px;
      padding: 12px 16px;
      bottom: 0;
    }
    .story-controls button {
      flex: 1 1 140px;
    }
  }
</style>
