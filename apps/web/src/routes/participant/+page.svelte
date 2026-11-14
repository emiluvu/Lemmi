<script lang="ts">
  import LiveParticipant from '#lib/features/LiveParticipant.svelte';
  import MockParticipant from '#lib/features/MockParticipant.svelte';
  let { data } = $props();
</script>

{#if data.live}<LiveParticipant demoEnrollment={data.demoEnrollment} />{:else}<MockParticipant
  />{/if}
