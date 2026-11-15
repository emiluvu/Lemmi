<script lang="ts">
  import ProfileContextForm from '#lib/features/ProfileContextForm.svelte';
  let open = $state(true);
</script>

<h1>Profile form preview</h1>
<p>Fictional layout preview. No profile, picture or conversation is saved.</p>
<button onclick={() => (open = true)}>Open profile form</button>
{#if open}<ProfileContextForm preview close={() => (open = false)} saved={() => {}} />{/if}
