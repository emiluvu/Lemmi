<script lang="ts">
  import { onDestroy } from 'svelte';
  let disposed = false;
  onDestroy(() => {
    disposed = true;
  });
  let {
    assetId,
    loaded,
    failed,
  }: {
    assetId: string;
    loaded: () => void;
    failed: () => void;
  } = $props();
  let loadState = $state<'loading' | 'ready' | 'error'>('loading');
  let source = $state('');
  let attempt = $state(0);
  // Activity snapshots are fresh objects even when the selected image is the
  // same. Depend on the scalar ID so playback/heartbeat updates keep the blob.
  let selectedAssetId = $derived(assetId);
  $effect(() => {
    const id = selectedAssetId;
    attempt;
    const controller = new AbortController();
    let active = true;
    let objectUrl = '';
    loadState = 'loading';
    source = '';
    const timeout = setTimeout(() => controller.abort(), 8000);
    void (async () => {
      try {
        let response: Response | undefined;
        // A speech generation may change during the protected read. Retry that
        // conflict once with fresh server authorization; never weaken its scope.
        for (let i = 0; i < 2; i++) {
          response = await fetch(`/v1/demo/photo-assets/${encodeURIComponent(id)}`, {
            signal: controller.signal,
            cache: 'no-store',
          });
          if (response.status !== 409) break;
        }
        if (!response?.ok) throw new Error('Photo unavailable');
        const blob = await response.blob();
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        source = objectUrl;
      } catch {
        if (active) {
          loadState = 'error';
          failed();
        }
      } finally {
        clearTimeout(timeout);
      }
    })();
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  });
</script>

<div class="picture" aria-busy={loadState === 'loading'}>
  {#if source && loadState !== 'error'}
    <img
      src={source}
      alt="Photo for us to talk about"
      onload={(event) => {
        if (disposed || event.currentTarget.getAttribute('src') !== source) return;
        loadState = 'ready';
        loaded();
      }}
      onerror={(event) => {
        if (disposed || event.currentTarget.getAttribute('src') !== source) return;
        loadState = 'error';
        failed();
      }}
    />
  {/if}
  {#if loadState === 'loading'}<p role="status">Loading picture…</p>{/if}
  {#if loadState === 'error'}
    <div role="alert">
      <p>Picture unavailable. We can take a break.</p>
      <button
        onclick={() => {
          attempt++;
        }}>Try picture again</button
      >
    </div>
  {/if}
</div>

<style>
  .picture {
    position: relative;
    width: 100%;
    height: min(320px, 28dvh);
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr);
    place-items: center;
    background: #fffdf7;
    border-radius: 20px;
    overflow: hidden;
    text-align: center;
  }
  img {
    min-width: 0;
    min-height: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
    grid-area: 1 / 1;
  }
  p {
    padding: 8px;
    margin: 0;
  }
  [role='status'] {
    grid-area: 1 / 1;
  }
  button {
    min-height: 44px;
    padding: 8px 16px;
  }
</style>
