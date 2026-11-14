<script lang="ts">
  import LiveParticipant from '#lib/features/LiveParticipant.svelte';
  import MockParticipant from '#lib/features/MockParticipant.svelte';
  let { data } = $props();
</script>

{#if data.live}
  <LiveParticipant demoEnrollment={data.demoEnrollment} />
{:else}
  <section class="participant-shell">
    <p><a href="/participant/conversation">Open the companion screen →</a></p>
    <MockParticipant />
  </section>
{/if}
