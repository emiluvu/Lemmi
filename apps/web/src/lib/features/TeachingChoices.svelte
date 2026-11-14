<script lang="ts">
  import type { SessionSnapshot } from '@lemmi/contracts';
  let {
    session,
    disabled = false,
    available = false,
    command,
  }: {
    session: SessionSnapshot;
    disabled?: boolean;
    available?: boolean;
    command: (type: string) => void;
  } = $props();
</script>

<section class="card teaching-panel" aria-labelledby="teaching-title">
  <h2 id="teaching-title">Teach Lemmi</h2>
  {#if session.teaching}
    {#if session.phase === 'paused'}
      <p>Paused. Resume when you are ready.</p>
    {:else if session.teaching.entityId}
      <h3>{session.teaching.topicLabel}</h3>
      <p class="teaching-prompt">{session.teaching.prompt}</p>
    {:else}
      <p>No eligible topics remain. You can finish and choose something else.</p>
    {/if}
    <div class="controls" aria-label="Teaching choices">
      <button
        onclick={() => command('input.teaching.next')}
        disabled={disabled || session.phase === 'paused'}>Different topic</button
      >
      <button
        onclick={() => command('input.teaching.not_sure')}
        disabled={disabled || session.phase === 'paused' || !session.teaching.entityId}
        >Not sure</button
      >
      <button
        onclick={() => command('input.teaching.prefer')}
        disabled={disabled || session.phase === 'paused' || !session.teaching.entityId}
        >Like this topic</button
      >
      <button
        onclick={() => command('input.teaching.avoid')}
        disabled={disabled || session.phase === 'paused' || !session.teaching.entityId}
        >Don't ask about this</button
      >
      <button onclick={() => command('input.teaching.finish')} {disabled}>Finish teaching</button>
    </div>
    <p class="helper">
      Topic choices apply to this session. This demo does not save teaching statements or learned
      preferences for future visits.
    </p>
  {:else}
    <p>
      Share something you know or enjoy. Take your time, change topics, or finish whenever you like.
    </p>
    <button
      onclick={() => command('input.teaching.start')}
      disabled={disabled || !available || session.phase === 'paused'}>Start Teach Lemmi</button
    >
    {#if !available}<p class="helper">Teaching is not available on this server.</p>{/if}
  {/if}
</section>

<style>
  .teaching-panel {
    text-align: left;
  }
  .teaching-prompt {
    font-size: 1.25rem;
  }
</style>
