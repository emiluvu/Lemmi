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
  {#if page.url.pathname === '/participant/voice'}
    LOCAL VOICE CLIENT · Live backend when connected · Camera off · No conversation recording
  {:else}LOCAL MOCK STARTER · No microphone, camera, real notifications or saved data{/if}
</div>
<header>
  <a href="/" class="brand">Lemmi</a>
  <nav aria-label="Main">
    <a href="/participant">Participant</a><a href="/caregiver">Caregiver demo</a>
  </nav>
</header>
<main>{@render children()}</main>
