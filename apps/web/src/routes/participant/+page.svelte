<script lang="ts">
  import LiveParticipant from '#lib/features/LiveParticipant.svelte';
  let { data } = $props();
</script>

<LiveParticipant demoEnrollment={data.demoEnrollment} preview={!data.live} />
