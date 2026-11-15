<script lang="ts">
  import { page } from '$app/state';
  import CaregiverPage from '../../caregiver/+page.svelte';
  import LiveParticipant from '#lib/features/LiveParticipant.svelte';
  let { data } = $props();
  const conversation = $derived(page.url.searchParams.get('screen') === 'conversation');
</script>

<svelte:head><title>Lemmi · main UI preview</title></svelte:head>
{#if !conversation}<nav class="preview-navigation" aria-label="Main UI preview screens">
    <span>Main UI · mock backend · local profile saving</span>
    <a href="/preview/application">Caregiver</a>
    <a href="/preview/application?screen=conversation">Conversation</a>
    <a href="/preview/avatars">Avatar faces</a>
  </nav>{/if}
{#if conversation}
  <LiveParticipant preview />
{:else}
  <CaregiverPage data={{ ...data, live: true, demoEnrollment: true }} preview />
{/if}

<style>
  .preview-navigation {
    position: relative;
    z-index: 30;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 16px;
    padding: 12px 16px;
    margin-bottom: 24px;
    background: #fffdf7;
    border: 1px solid #c7ad89;
    border-radius: 12px;
  }
  .preview-navigation span {
    font-weight: 700;
  }
  .preview-navigation a {
    min-height: 44px;
    display: inline-flex;
    align-items: center;
  }
</style>
