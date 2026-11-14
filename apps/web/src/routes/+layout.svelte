<script lang="ts">
  import '../styles.css';
  import { page } from '$app/state';
  let { children } = $props();
</script>

<svelte:head
  ><title>Lemmi — shared starter</title><meta
    name="description"
    content="Lemmi local mock development starter"
  /></svelte:head
>
<div class="banner">
  {#if page.url.pathname === '/participant/photo-story'}
    FICTIONAL PHOTO STORY DEMO · Explicit local speech · Camera off · Responses not saved
  {:else}LOCAL MOCK STARTER · No microphone, camera, real notifications or saved data{/if}
</div>
<header>
  <a href="/" class="brand">Lemmi</a>
  <nav aria-label="Main">
    <a href="/participant">Participant</a><a href="/participant/photo-story">Photo Story</a><a
      href="/caregiver">Caregiver demo</a
    >
  </nav>
</header>
<main>{@render children()}</main>
