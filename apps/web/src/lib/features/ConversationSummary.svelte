<script lang="ts">
  import { onMount } from 'svelte';
  import { clients } from '#lib/clients.ts';
  import type { Journal } from '@lemmi/contracts';

  let {
    profileId,
    excerptSavingEnabled,
    changeExcerptSetting,
    privacyDisabled = false,
  }: {
    profileId: string;
    excerptSavingEnabled: boolean;
    changeExcerptSetting: (enabled: boolean) => Promise<string | null>;
    privacyDisabled?: boolean;
  } = $props();
  let journal = $state<Journal | null>(null);
  let loading = $state(true);
  let error = $state('');
  let privacySaving = $state(false);
  let privacyMessage = $state('');
  async function toggleExcerpts() {
    if (privacySaving || privacyDisabled) return;
    const target = !excerptSavingEnabled;
    privacySaving = true;
    privacyMessage = '';
    try {
      const failure = await changeExcerptSetting(target);
      privacyMessage = failure ?? (target ? 'Excerpt saving enabled.' : 'Excerpt saving disabled.');
    } catch {
      privacyMessage = 'Setting could not be saved. Please try again.';
    } finally {
      privacySaving = false;
    }
  }
  async function load() {
    loading = true;
    error = '';
    journal = null;
    try {
      const result = await clients.journal.load({ profileId });
      if (result.ok) journal = result.data;
      else error = `${result.error.code}: ${result.error.message}`;
    } catch {
      error = 'Summary unavailable. Try again.';
    } finally {
      loading = false;
    }
  }
  onMount(() => {
    void load();
  });
</script>

<section
  class="conversation-summary"
  aria-labelledby="conversation-summary-title"
  aria-busy={loading}
>
  <div class="summary-heading">
    <h2 id="conversation-summary-title">Conversation Summary</h2>
    <button type="button" class="quiet" onclick={load} disabled={loading}>Refresh summary</button>
  </div>
  {#if loading}<p role="status">Loading summary…</p>
  {:else if error}<p role="alert">{error}</p>{/if}
  <div class="summary-columns">
    <section class="summary-section">
      <h3>Reported Concerns</h3>
      <p>{error ? 'Unable to check concern reports.' : 'Concern reports are not available yet.'}</p>
    </section>
    <section class="summary-section">
      <h3>Conversation Highlights</h3>
      <p>
        {error
          ? 'Unable to check conversation highlights.'
          : 'Conversation highlights are not available yet.'}
      </p>
    </section>
  </div>
  <div class="excerpt-setting">
    <div>
      <h3 id="excerpt-label">Save conversation excerpts</h3>
      <p id="excerpt-description">
        Keep permitted statement excerpts for summary review. Separate from remembering interests.
      </p>
    </div>
    <button
      type="button"
      class="excerpt-switch"
      role="switch"
      aria-labelledby="excerpt-label"
      aria-describedby="excerpt-description"
      aria-checked={excerptSavingEnabled}
      disabled={privacySaving || privacyDisabled}
      onclick={toggleExcerpts}><span aria-hidden="true"></span></button
    >
  </div>
  <p class="excerpt-feedback" role="status">{privacySaving ? 'Saving setting…' : privacyMessage}</p>
  <section class="interest-trends" aria-labelledby="interest-trends-title">
    <h3 id="interest-trends-title">Interest &amp; Hobby Trends</h3>
    <p>Topics mentioned over time</p>
    <div class="trends-empty">
      <svg viewBox="0 0 480 120" aria-hidden="true" focusable="false"
        ><path
          d="M18 8v96h444M18 24h444M18 50h444M18 76h444"
          fill="none"
          stroke="currentColor"
          stroke-width="1"
        /></svg
      >
      <div>
        <strong
          >{error ? 'Trend data could not be checked' : 'No permitted trend data available'}</strong
        >
        <p>
          A graph will appear when dated, approved topic data is supplied. Mention frequency
          describes topics, not enjoyment or wellbeing.
        </p>
      </div>
    </div>
  </section>
  {#if journal}
    <details class="summary-sources today-activities">
      <summary>Today’s activities</summary>
      <p>
        Today’s activity list is unavailable. The current journal does not include dates or
        activity-specific observations.
      </p>
    </details>
  {/if}
</section>
