<script lang="ts">
  import '../styles.css';
  import UIIcon from '#lib/features/UIIcon.svelte';
  import { page } from '$app/state';
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
      if (profileId !== 'profile-alex')
        return 'Only Alex’s fictional demo profile supports picture previews.';
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
  let { children, data } = $props();
  const conversationScreen = $derived(
    page.url.pathname.startsWith('/participant') ||
      (page.url.pathname === '/preview/application' &&
        page.url.searchParams.get('screen') === 'conversation'),
  );
  let drawerOpen = $state(false);
  let menuButton = $state<HTMLButtonElement>();
  const workspaceLinks = [
    {
      href: '/caregiver#profiles',
      title: 'Profiles',
      detail: 'Your people & their companions',
      icon: 'profiles',
    },
    {
      href: '/caregiver#games',
      title: 'Activities',
      detail: 'Music, pictures & familiar things',
      icon: 'music',
    },
    {
      href: '/caregiver#ecosystem',
      title: 'Ecosystem',
      detail: 'Robot & connected setup',
      icon: 'robot',
    },
  ] as const;
  const settingsLinks = [
    {
      href: '/caregiver/settings',
      title: 'Caregiver Setting',
      detail: 'Appearance & account options',
      icon: 'settings',
    },
    {
      href: '/caregiver/check-in',
      title: 'Camera check-ins',
      detail: 'Permission & viewing controls',
      icon: 'camera',
    },
  ] as const;
  function isActive(href: string) {
    const [path, hash] = href.split('#');
    return page.url.pathname === path && (!hash || (page.url.hash || '#profiles') === `#${hash}`);
  }
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
  ><title
    >{page.url.pathname.startsWith('/participant')
      ? 'Lemmi — your companion'
      : 'Lemmi — caregiver workspace'}</title
  ><link
    rel="preload"
    href="/fonts/nunito-latin-variable.ttf"
    as="font"
    type="font/ttf"
    crossorigin="anonymous"
  /><meta name="description" content="Lemmi local mock development starter" /></svelte:head
>
{#if data.photoStoryRehearsal && !conversationScreen}<p class="notice">
    LOCAL PHOTO STORY REHEARSAL · Explicit microphone capture · No saved speech or real
    notifications
  </p>{/if}
{#if !conversationScreen}<a class="skip-link" href="#main-content">Skip to content</a>{/if}
{#if !conversationScreen && (!data.live || page.url.pathname.startsWith('/caregiver'))}
  <header class="app-topbar">
    <button
      bind:this={menuButton}
      class="drawer-toggle"
      class:drawer-toggle-open={drawerOpen}
      aria-expanded={drawerOpen}
      aria-controls="account-drawer"
      aria-label={drawerOpen ? 'Close account menu' : 'Open account menu'}
      onclick={() => (drawerOpen = !drawerOpen)}
    >
      <UIIcon name={drawerOpen ? 'close' : 'menu'} /><span class="menu-label">Menu</span>
    </button>
    <div class="app-wordmark" aria-label="Lemmi">
      <svg aria-hidden="true" width="30" height="32" viewBox="0 0 30 32" fill="none">
        <path
          d="M15 25C4 24 2 16 3 10c10 0 16 6 12 15Z"
          fill="#d3dcba"
          stroke="#697e4d"
          stroke-width="1.5"
        />
        <path
          d="M16 21C12 10 18 3 27 2c2 10-2 17-11 19Z"
          fill="#b9cb93"
          stroke="#697e4d"
          stroke-width="1.5"
        />
        <path
          d="m8 16 12 14m-4-10 7-12"
          stroke="#697e4d"
          stroke-width="1.5"
          stroke-linecap="round"
        />
      </svg>
      <span>Lemmi</span>
    </div>
    <span class="workspace-label">A little company.<br /><strong>A familiar rhythm.</strong></span>
    <span class="demo-pill"><span aria-hidden="true">✧</span> Caregiver demo</span>
  </header>
  <aside
    id="account-drawer"
    class="app-rail"
    class:drawer-open={drawerOpen}
    inert={!drawerOpen}
    aria-label="Caregiver navigation"
  >
    <div class="drawer-heading">
      <p class="eyebrow">Your Lemmi space</p>
      <h2>A familiar place.</h2>
      <p>Make room for the people and things that matter.</p>
    </div>
    <nav aria-label="Workspace">
      <p class="nav-section-label">Workspace</p>
      {#each workspaceLinks as link}<a
          href={link.href}
          class:nav-active={isActive(link.href)}
          aria-current={isActive(link.href) ? 'page' : undefined}
          onclick={() => (drawerOpen = false)}
          ><span class="nav-icon"><UIIcon name={link.icon} /></span><span
            ><strong>{link.title}</strong><small>{link.detail}</small></span
          ><span class="nav-arrow"><UIIcon name="arrow" size={16} /></span></a
        >{/each}
    </nav>
    <nav aria-label="Settings">
      <p class="nav-section-label">Settings & privacy</p>
      {#each settingsLinks as link}<a
          href={link.href}
          class:nav-active={isActive(link.href)}
          aria-current={isActive(link.href) ? 'page' : undefined}
          onclick={() => (drawerOpen = false)}
          ><span class="nav-icon"><UIIcon name={link.icon} /></span><span
            ><strong>{link.title}</strong><small>{link.detail}</small></span
          ></a
        >{/each}
    </nav>
    <div class="rail-account">
      <div class="photo-circle">
        {#if caregiverPhoto}<img src={caregiverPhoto} alt="Caregiver" />{:else}<span
            aria-hidden="true">CG</span
          >{/if}
      </div>
      <div>
        <p class="nav-section-label">Caregiver account</p>
        <strong>Your own little corner</strong><a
          href="/caregiver/sign-in"
          onclick={() => (drawerOpen = false)}>Sign-in options <UIIcon name="arrow" size={16} /></a
        >
      </div>
    </div>
    <p class="drawer-footnote">
      <UIIcon name="leaf" size={18} /> Fictional demo workspace. Private caregiver settings require separate
      sign-in, which is not connected here yet.
    </p>
  </aside>
{/if}
<main
  id="main-content"
  tabindex="-1"
  class:drawer-open={drawerOpen}
  class:conversation-layout={conversationScreen}
>
  {@render children()}
</main>

<style>
  main.conversation-layout {
    margin: 0;
    padding: 0;
    max-width: none;
    width: 100%;
    min-height: 0;
  }
  :global(body:has(.conversation-screen)) {
    overflow: hidden;
  }
</style>
