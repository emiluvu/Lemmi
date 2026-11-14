<script lang="ts">
  import type { SessionSnapshot } from '@lemmi/contracts';
  let {
    session,
    disabled = false,
    available = false,
    speechAvailable = false,
    listening = false,
    reply = '',
    automaticReplies = false,
    command,
  }: {
    session: SessionSnapshot;
    disabled?: boolean;
    available?: boolean;
    speechAvailable?: boolean;
    listening?: boolean;
    reply?: string;
    automaticReplies?: boolean;
    command: (type: string) => void;
  } = $props();
  let status = $derived(
    disabled
      ? 'Connection or active endpoint unavailable'
      : session.phase === 'paused'
        ? 'Paused'
        : session.phase === 'unavailable' || session.teaching?.phase === 'unavailable'
          ? 'Teaching unavailable'
          : session.micMuted
            ? 'Microphone muted'
            : listening
              ? 'Listening to you'
              : session.phase === 'processing'
                ? 'Lemmi is thinking'
                : session.phase === 'speaking'
                  ? 'Lemmi is speaking'
                  : 'Microphone off',
  );
  let showTopic = $derived(
    !disabled &&
      !['paused', 'unavailable'].includes(session.phase) &&
      session.teaching?.phase !== 'unavailable' &&
      !!session.teaching?.entityId,
  );
</script>

<section class="card teaching-panel" aria-labelledby="teaching-title">
  <p class="eyebrow">A conversation together</p>
  <h2 id="teaching-title">Teach Lemmi</h2>
  {#if session.teaching}
    <p class="teaching-status" role="status">{status}</p>
    {#if showTopic}
      <h3>{session.teaching.topicLabel}</h3>
      <p class="teaching-prompt">{reply || session.teaching.prompt}</p>
      <p>Share whatever you would like. Take your time.</p>
      {#if speechAvailable}
        <aside class="voice-guidance" aria-label="Voice guidance">
          <p>
            {listening
              ? 'Speak when you are ready.'
              : automaticReplies
                ? 'After Lemmi finishes a question, it will listen for your reply.'
                : 'Use Speak now when you are ready to talk.'}
          </p>
          <p>You can say “Different topic” or “Not sure”.</p>
        </aside>
      {:else}
        <p>Voice is unavailable on this connection. You can use the shared Stop control.</p>
      {/if}
    {:else if session.phase === 'paused'}
      <p>Take your time. Resume when you are ready; the microphone will stay off.</p>
    {:else if disabled}
      <p>Teaching will wait until this browser is connected and active.</p>
    {:else if session.phase === 'unavailable' || session.teaching.phase === 'unavailable'}
      <p>Teaching is unavailable. You can use the shared Stop control and try again later.</p>
    {:else}
      <p>There are no more topics to share right now. You can use the shared Stop control.</p>
    {/if}
    <p class="helper">You can pause or stop whenever you like.</p>
  {:else}
    <p>Lemmi offers a topic. You can tell Lemmi about it, in your own words.</p>
    <button
      onclick={() => command('input.teaching.start')}
      disabled={disabled ||
        !available ||
        !speechAvailable ||
        !['ready', 'waiting'].includes(session.phase)}>Start Teach Lemmi</button
    >
    {#if !available}<p class="helper">Teaching is not available on this server.</p>
    {:else if !speechAvailable}<p class="helper">Voice is not available on this connection.</p>{/if}
  {/if}
</section>

<style>
  .teaching-panel {
    text-align: center;
    padding: clamp(24px, 5vw, 48px);
  }
  h2 {
    margin-top: 0;
  }
  h3 {
    font-size: clamp(28px, 4vw, 40px);
    margin-bottom: 16px;
  }
  .teaching-prompt {
    font-size: clamp(24px, 3vw, 32px);
    line-height: 1.5;
    max-width: 32ch;
    margin: 0 auto 24px;
  }
  .teaching-status {
    font-weight: 600;
  }
  .voice-guidance {
    border-radius: 20px;
    background: #edf1e8;
    padding: 16px 24px;
    margin-top: 28px;
  }
  .voice-guidance p {
    margin: 8px auto;
  }
  .helper {
    margin: 24px auto 0;
  }
</style>
