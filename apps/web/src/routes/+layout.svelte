<script lang="ts">
  import '../styles.css';
  let { children } = $props();
</script>

<svelte:head
  ><title>Lemmi — shared starter</title><meta
    name="description"
    content="Lemmi local mock development starter"
  /></svelte:head
>
<div class="banner">
  LOCAL MOCK STARTER · No microphone, camera, real notifications or saved data
</div>
<header>
  <a href="/" class="brand">Lemmi</a>
  <nav aria-label="Main">
    <a href="/participant">Participant</a><a href="/caregiver">Caregiver demo</a>
  </nav>
</header>
<main>{@render children()}</main>
