<script lang="ts">
  import '../styles.css';
  let { children, data } = $props();
</script>

<svelte:head
  ><title>{data.live ? 'Lemmi — participant' : 'Lemmi — shared starter'}</title><meta
    name="description"
    content={data.live ? 'Lemmi private participant demo' : 'Lemmi local mock development starter'}
  /></svelte:head
>
<div class="banner">
  {data.live
    ? 'LEMMI · Private participant demo · Camera and real notifications unavailable'
    : 'LOCAL MOCK STARTER · No microphone, camera, real notifications or saved data'}
</div>
<header>
  <a href={data.live ? '/participant' : '/'} class="brand">Lemmi</a>
  <nav aria-label="Main">
    <a href="/participant">Participant</a>{#if data.live}<a href="/access">Access settings</a
      >{:else}<a href="/caregiver">Caregiver demo</a>{/if}
  </nav>
</header>
<main>{@render children()}</main>
