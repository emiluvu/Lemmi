<script lang="ts">
  import '../styles.css';
  let { children } = $props();
  import { page } from '$app/state';
</script>

<svelte:head
  ><title>Lemmi — shared starter</title><meta
    name="description"
    content="Lemmi local mock development starter"
  /></svelte:head
>
<div class="banner">
  {page.url.pathname.includes('photo-story')
    ? 'LOCAL PHOTO STORY REHEARSAL · Explicit microphone capture · No saved speech or real notifications'
    : 'LOCAL MOCK STARTER · No microphone, camera, real notifications or saved data'}
</div>
<header>
  <a href="/" class="brand">Lemmi</a>
  <nav aria-label="Main">
    <a href="/participant">Participant</a><a href="/caregiver">Caregiver demo</a>
  </nav>
</header>
<main>{@render children()}</main>
