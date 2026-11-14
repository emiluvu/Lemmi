<script lang="ts">
  import '../styles.css';
  import PhotoPicker from '#lib/features/PhotoPicker.svelte';
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
  <a href="/" class="brand"><span aria-hidden="true" class="brand-mark">+</span>Lemmi</a>
  <div class="rail-account">
    <strong class="account-title">Your account</strong>
    <PhotoPicker label="Caregiver photo" initials="CG" />
    <a href="/caregiver/sign-in">Log in</a>
  </div>
  <nav aria-label="Main">
    <a href="/caregiver">Dashboard</a>
    <a href="/caregiver/settings">Profile settings</a>
    <a href="/caregiver/check-in">Camera settings</a>
  </nav>
</header>
<main class:drawer-open={drawerOpen}>{@render children()}</main>
