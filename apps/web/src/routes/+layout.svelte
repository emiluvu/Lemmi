<script lang="ts">
  import '../styles.css';
  import { caregiverAppearanceKey, type CaregiverAppearance } from '#lib/caregiver-appearance.ts';
  import { setContext, onDestroy } from 'svelte';
  import {
    photoStoryPreviewKey,
    type PreviewPhoto,
    type PhotoStoryPreviewContext,
  } from '#lib/photo-story-preview.ts';
  let previewPhotos = $state<PreviewPhoto[]>([]);
  let caregiverPhoto = $state<string | null>(null);
  setContext<CaregiverAppearance>(caregiverAppearanceKey, {
    get photo() {
      return caregiverPhoto;
    },
    setPhoto(file) {
      if (caregiverPhoto) URL.revokeObjectURL(caregiverPhoto);
      caregiverPhoto = file ? URL.createObjectURL(file) : null;
    },
  });
  setContext<PhotoStoryPreviewContext>(photoStoryPreviewKey, {
    get photos() {
      return previewPhotos;
    },
    add(profileId, file, caption) {
      if (previewPhotos.filter((photo) => photo.profileId === profileId).length >= 5)
        return 'Remove a picture before adding another. Five pictures maximum.';
      if (
        !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
        file.size > 5 * 1024 * 1024
      )
        return 'Choose a PNG, JPG, or WebP image up to 5 MB.';
      previewPhotos.push({
        id: crypto.randomUUID(),
        profileId,
        url: URL.createObjectURL(file),
        caption: caption.trim().slice(0, 300),
      });
      return null;
    },
    remove(profileId, id) {
      const target = previewPhotos.find(
        (photo) => photo.profileId === profileId && photo.id === id,
      );
      if (!target) return;
      previewPhotos = previewPhotos.filter((photo) => photo.id !== target.id);
      URL.revokeObjectURL(target.url);
    },
  });
  onDestroy(() => {
    if (caregiverPhoto) URL.revokeObjectURL(caregiverPhoto);
    for (const photo of previewPhotos) URL.revokeObjectURL(photo.url);
  });
  let { children } = $props();
  let drawerOpen = $state(false);
  let menuButton: HTMLButtonElement;
  function closeDrawer() {
    drawerOpen = false;
    menuButton?.focus();
  }
</script>

<svelte:window
  onkeydown={(event) => {
    if (event.key === 'Escape' && drawerOpen) closeDrawer();
  }}
/>

<svelte:head
  ><title>Lemmi — local mock</title><meta
    name="description"
    content="Lemmi local mock development starter"
  /></svelte:head
>
<button
  bind:this={menuButton}
  class="drawer-toggle"
  class:drawer-toggle-open={drawerOpen}
  aria-expanded={drawerOpen}
  aria-controls="account-drawer"
  aria-label={drawerOpen ? 'Close account menu' : 'Open account menu'}
  onclick={() => (drawerOpen = !drawerOpen)}
>
  <span aria-hidden="true">{drawerOpen ? '✕' : '☰'}</span><span class="sr-only">Account menu</span>
</button>
<header id="account-drawer" class="app-rail" class:drawer-open={drawerOpen} inert={!drawerOpen}>
  <a href="/" class="brand"
    ><img
      src="/images/avatars/lemming.png"
      class="brand-mark"
      alt=""
      width="64"
      height="64"
    />Lemmi</a
  >
  <div class="rail-account">
    <strong class="account-title">Your account</strong>
    <div class="photo-circle">
      {#if caregiverPhoto}<img src={caregiverPhoto} alt="Caregiver" />{:else}<span
          aria-hidden="true">CG</span
        >{/if}
    </div>
    <a href="/caregiver/sign-in">Log in</a>
  </div>
  <nav aria-label="Main">
    <a href="/caregiver">Dashboard</a>
    <a href="/caregiver/settings">Caregiver Setting</a>
    <a href="/caregiver/check-in">Camera settings</a>
  </nav>
</header>
<main class:drawer-open={drawerOpen}>{@render children()}</main>
