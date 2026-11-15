<script lang="ts">
  import { page } from '$app/state';
  import LiveParticipant from '#lib/features/LiveParticipant.svelte';
  let { data } = $props();
</script>

<svelte:head><title>Talk with Lemmi</title></svelte:head>
<LiveParticipant
  demoEnrollment={data.demoEnrollment}
  requestedProfileId={page.url.searchParams.get('profile')}
  preview={!data.live}
/>
