<script lang="ts">
  import { onMount } from 'svelte';
  import { VoiceClient, type VoiceState } from '#lib/voice-client.ts';
  let client: VoiceClient;
  let configured = $state(false),
    checked = $state(false),
    answer = $state('');
  let silenceWait = $state(2000);
  let voiceState = $state<VoiceState>({
    connected: false,
    ready: false,
    audio: false,
    teaching: false,
    listening: false,
    playing: false,
    pending: false,
    automaticReplies: false,
    session: null,
    reply: '',
    message: '',
  });
  const active = $derived(!!voiceState.session && voiceState.session.phase !== 'ended');
  const paused = $derived(voiceState.session?.phase === 'paused');
  const canSpeak = $derived(
    active &&
      !!voiceState.session?.teaching?.entityId &&
      !voiceState.session.micMuted &&
      !paused &&
      !voiceState.pending &&
      !voiceState.playing &&
      !voiceState.listening &&
      ['ready', 'waiting'].includes(voiceState.session.phase),
  );
  onMount(() => {
    client = new VoiceClient((value) => (voiceState = value));
    void fetch('/voice-config')
      .then((r) => r.json())
      .then((v) => {
        configured = v.configured === true;
        checked = true;
      })
      .catch(() => (checked = true));
    const hide = () => client.close();
    const background = () => {
      if (document.visibilityState === 'hidden') client.background();
    };
    window.addEventListener('pagehide', hide);
    document.addEventListener('visibilitychange', background);
    return () => {
      window.removeEventListener('pagehide', hide);
      document.removeEventListener('visibilitychange', background);
      client.close();
    };
  });
  function submit(e: SubmitEvent) {
    e.preventDefault();
    const text = answer;
    answer = '';
    client.text(text);
  }
</script>

<svelte:head><title>Teach Lemmi — live voice demo</title></svelte:head>
<h1>Teach Lemmi with your voice</h1>
<p class="tag">LIVE BACKEND DEMO · Fictional Alex · English</p>
<p>
  Your microphone audio goes to the team backend for speech recognition. Text is sent to the
  external AI provider; the backend creates Lemmi's spoken reply. No conversation recording or
  journal excerpt is saved by this demo.
</p>
<p>
  Start Teach Lemmi begins a conversation: after Lemmi finishes a question, the microphone opens for
  your reply with fresh backend permission. A short pause sends your reply. Pause, Stop or
  microphone mute ends automatic listening; unmute alone does not restart it.
</p>
{#if checked && !configured}
  <section class="card">
    <h2>Private connection settings needed</h2>
    <p>
      Configure a current Alex device credential and backend origin in the local server's private
      environment, then restart the web server. See the voice demo instructions. No credentials
      belong in this page.
    </p>
  </section>
{/if}
{#if !voiceState.connected}
  <button disabled={!configured} onclick={() => client.connect()}
    >Connect microphone and speaker demo</button
  >
{:else}
  <section class="card">
    <h2>
      {voiceState.listening
        ? 'Listening — microphone active'
        : voiceState.playing
          ? 'Lemmi is speaking'
          : 'Microphone off'}
    </h2>
    <p>
      Backend speech: {voiceState.audio ? 'available' : 'unavailable'} · Teaching: {voiceState.teaching
        ? 'available'
        : 'not deployed'}
    </p>
    {#if !active}<button
        disabled={!voiceState.ready || !voiceState.audio || !voiceState.teaching}
        onclick={() => client.command('start')}>Start Alex session</button
      >
    {:else}
      <p>Session: {voiceState.session?.phase}</p>
      {#if !voiceState.session?.teaching}
        <button
          disabled={paused || !voiceState.audio || !voiceState.teaching}
          onclick={() => client.startTeachingConversation()}>Start Teach Lemmi</button
        >
      {:else}
        <p class="tag">
          Selected topic: {voiceState.session.teaching.topicLabel ?? 'No eligible topic'}
        </p>
        <h3>Lemmi</h3>
        <p class="current-question" aria-live="polite" aria-atomic="true">
          {voiceState.reply ||
            voiceState.session.teaching.prompt ||
            'You can finish, listen to music or just look.'}
        </p>
        {#if voiceState.session.communicationSupport.preset !== 'quiet'}
          {#if voiceState.automaticReplies}
            <p class="tag">Conversation on — listening follows each completed question</p>
            <button onclick={() => client.useSingleTurns()}>Switch to Speak now only</button>
          {:else}
            <button disabled={paused} onclick={() => client.startConversation()}
              >Start conversation — listen after questions</button
            >
          {/if}
        {:else}<p>Quiet companionship uses one explicit Speak now turn at a time.</p>{/if}
        <label for="listening-pause">Pause before sending</label>
        <select
          id="listening-pause"
          bind:value={silenceWait}
          disabled={voiceState.listening || voiceState.pending}
          onchange={(event) => client.setSilenceWait(Number(event.currentTarget.value))}
        >
          <option value={1200}>Quick — short pauses</option>
          <option value={2000}>Balanced</option>
          <option value={4000}>Extra time — longer pauses</option>
        </select>
        <div class="controls">
          {#if voiceState.listening}<button onclick={() => client.done()}>Done speaking</button>
          {:else}<button disabled={!canSpeak} onclick={() => client.speak()}>Speak now</button>{/if}
          <button disabled={paused} onclick={() => client.command('teaching.next')}
            >Different topic</button
          >
          <button
            disabled={paused || !voiceState.session.teaching.entityId}
            onclick={() => client.command('teaching.not_sure')}>Not sure</button
          >
          <button
            disabled={paused || !voiceState.session.teaching.entityId}
            onclick={() => client.command('teaching.prefer')}>Like this topic</button
          >
          <button
            disabled={paused || !voiceState.session.teaching.entityId}
            onclick={() => client.command('teaching.avoid')}>Don't ask about this</button
          >
          <button onclick={() => client.command('teaching.finish')}>Finish teaching</button>
        </div>
        <p>
          Topic feedback is session-only. Conversation content is not saved for caregiver review.
        </p>
      {/if}
    {/if}
    {#if voiceState.reply && !voiceState.session?.teaching}<p>
        <strong>Lemmi:</strong>
        {voiceState.reply}
      </p>{/if}
  </section>
{/if}
<p role="status" aria-live="polite">{voiceState.message}</p>
{#if active}
  <div class="controls sticky" aria-label="Voice safety controls">
    <button onclick={() => client.command(paused ? 'resume' : 'pause')}
      >{paused ? 'Resume to ready' : 'Pause'}</button
    >
    <button onclick={() => client.command('stop')}>Stop</button>
    <button onclick={() => client.command(voiceState.session?.micMuted ? 'unmute' : 'mute')}
      >{voiceState.session?.micMuted ? 'Unmute microphone (stays off)' : 'Mute microphone'}</button
    >
  </div>
  <details>
    <summary>Text fallback through the same live session</summary>
    <p>
      Typed replies use the live AI connection; this fallback does not speak the reply. For a
      provider-free rehearsal, use the <a href="/participant">scripted text demo</a>.
    </p>
    <form onsubmit={submit}>
      <label for="voice-text">Your reply (fictional test text only)</label>
      <textarea
        id="voice-text"
        bind:value={answer}
        maxlength="1000"
        disabled={paused || voiceState.pending || voiceState.listening || voiceState.playing}
        rows="3"
      ></textarea>
      <button
        disabled={paused ||
          voiceState.pending ||
          voiceState.listening ||
          voiceState.playing ||
          !answer.trim()}>Send text reply</button
      >
    </form>
  </details>
{/if}
<p><a href="/participant">Return to scripted text demo</a></p>

<style>
  label {
    display: block;
    font-weight: 650;
  }
  textarea {
    display: block;
    width: 100%;
    max-width: 42rem;
    padding: 12px;
    font: inherit;
    color: inherit;
    border: 2px solid #315c4d;
    border-radius: 12px;
  }
  textarea:focus-visible {
    outline: 4px solid #a05218;
    outline-offset: 4px;
  }
  select {
    font: inherit;
    color: inherit;
    padding: 10px;
    border: 2px solid #315c4d;
    border-radius: 12px;
    max-width: 100%;
    margin: 8px 0 16px;
  }
  select:focus-visible {
    outline: 4px solid #a05218;
    outline-offset: 4px;
  }
  .current-question {
    font-size: 1.2rem;
  }
</style>
