<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { clients } from '#lib/clients.ts';
  import {
    type ParticipantProfile,
    type SessionSnapshot,
    type ActivityView,
    type SessionCommand,
    type ActivityAction,
    type Result,
    type ConversationReply,
  } from '@lemmi/contracts';
  let profile = $state<ParticipantProfile | null>(null);
  let session = $state<SessionSnapshot | null>(null);
  let activity = $state<ActivityView | null>(null);
  // A fresh snapshot object must not restart a subscription to the same resource.
  const subscribedSessionId = $derived(session?.id ?? null);
  const subscribedActivityId = $derived(activity?.instanceId ?? null);
  let busy = $state(false);
  let message = $state('');
  let answer = $state('');
  let reply = $state<ConversationReply | null>(null);
  let replyGeneration = $state(-1);
  let submitting = $state(false);
  let interactionEpoch = 0;
  let disposed = false;
  let connectionLost = $state(false);
  $effect(() => {
    if (session?.generation !== replyGeneration || session?.phase === 'ended') reply = null;
    if (!session?.teaching || session.phase === 'paused') answer = '';
  });
  function show<T>(r: Result<T>): T | null {
    if (r.ok) return r.data;
    message = `${r.error.code}: ${r.error.message}`;
    return null;
  }
  async function run(work: () => Promise<void>) {
    busy = true;
    message = '';
    try {
      await work();
    } catch {
      message = 'Request failed';
    } finally {
      busy = false;
    }
  }
  onMount(() => {
    void run(async () => {
      profile = show(await clients.profile.load({ profileId: 'profile-alex' }));
    });
  });
  $effect(() => {
    const id = subscribedSessionId;
    if (!id) return;
    return clients.session.subscribe({ sessionId: id }, (result) => {
      if (result.ok && (!session || result.data.generation >= session.generation))
        session = result.data;
      if (!result.ok) {
        interactionEpoch++;
        connectionLost = true;
        reply = null;
        message = 'Connection unavailable. Your text has not been resent. Retry when connected.';
      }
    });
  });
  $effect(() => {
    const sessionId = subscribedSessionId;
    const instanceId = subscribedActivityId;
    if (!sessionId || !instanceId) return;
    return clients.activities.subscribe({ sessionId, instanceId }, (result) => {
      if (result.ok && (!activity || result.data.revision >= activity.revision))
        activity = result.data;
    });
  });
  async function refresh() {
    if (!session) return;
    session = show(await clients.session.get({ sessionId: session.id }));
    if (session) connectionLost = false;
    if (session && activity)
      activity = show(
        await clients.activities.view({ sessionId: session.id, instanceId: activity.instanceId }),
      );
  }
  async function start() {
    await run(async () => {
      session = show(
        await clients.session.start({
          profileId: 'profile-alex',
          commandId: crypto.randomUUID(),
          endpoint: 'browser',
        }),
      );
      activity = null;
    });
  }
  async function command(action: SessionCommand['action']) {
    interactionEpoch++;
    reply = null;
    await run(async () => {
      if (!session) return;
      const next = show(
        await clients.session.command({
          sessionId: session.id,
          commandId: crypto.randomUUID(),
          expectedGeneration: session.generation,
          action,
        }),
      );
      if (next) session = next;
      await refresh();
    });
  }
  async function sendAnswer(event: SubmitEvent) {
    event.preventDefault();
    if (
      !session ||
      !answer.trim() ||
      submitting ||
      connectionLost ||
      !['ready', 'waiting'].includes(session.phase)
    )
      return;
    const epoch = interactionEpoch;
    const current = session;
    const text = answer;
    answer = '';
    reply = null;
    submitting = true;
    message = '';
    try {
      const result = await clients.conversation.submit({
        commandId: crypto.randomUUID(),
        sessionId: current.id,
        expectedGeneration: current.generation,
        text,
        language: 'en',
      });
      if (!result.ok) {
        message = result.error.message;
        return;
      }
      // Polling or a local safety control may already have superseded this response.
      if (
        disposed ||
        epoch !== interactionEpoch ||
        !session ||
        session.id !== result.data.session.id ||
        session.generation > result.data.session.generation
      )
        return;
      session = result.data.session;
      if (result.data.kind === 'reply') {
        replyGeneration = session.generation;
        reply = result.data.reply;
      }
    } catch {
      message = 'The reply is unavailable. Your text has not been resent.';
    } finally {
      submitting = false;
    }
  }
  async function music() {
    await run(async () => {
      if (session)
        activity = show(
          await clients.activities.start({
            sessionId: session.id,
            commandId: crypto.randomUUID(),
            activityId: 'music_playlist',
            packId: 'music-demo',
            packVersion: 1,
          }),
        );
    });
  }
  async function act(action: ActivityAction) {
    await run(async () => {
      if (session && activity) {
        const next = show(
          await clients.activities.submit({
            commandId: crypto.randomUUID(),
            sessionId: session.id,
            instanceId: activity.instanceId,
            expectedRevision: activity.revision,
            action,
          }),
        );
        if (next) activity = next;
        await refresh();
      }
    });
  }
  async function help() {
    interactionEpoch++;
    reply = null;
    await run(async () => {
      const result = show(
        await clients.help.create({
          profileId: 'profile-alex',
          commandId: crypto.randomUUID(),
          mode: 'simulation',
        }),
      );
      if (result) message = result.message;
      await refresh();
    });
  }
  export async function stopForExit() {
    interactionEpoch++;
    reply = null;
    answer = '';
    if (!session || session.phase === 'ended') return true;
    const result = await clients.session.command({
      sessionId: session.id,
      expectedGeneration: session.generation,
      commandId: crypto.randomUUID(),
      action: { type: 'stop' },
    });
    if (result.ok) session = result.data;
    else message = 'Stop could not be confirmed. Refresh shared state, then try Stop again.';
    return result.ok;
  }
  onDestroy(() => {
    disposed = true;
    void stopForExit();
  });
</script>

<h1>Ready when you are{profile ? `, ${profile.preferredName}` : ''}</h1>
<p>Microphone off. Camera off. Commands below exercise mock state only.</p>
{#if !session || session.phase === 'ended'}<button onclick={start} disabled={busy || !profile}
    >Start mock session</button
  >{/if}
{#if session}<section class="card">
    <h2>Session: {session.phase}</h2>
    <p>
      Endpoint: {session.endpoint} · Generation {session.generation} · Microphone {session.micMuted
        ? 'muted'
        : 'off'}
    </p>
    <button onclick={() => run(refresh)} disabled={busy}>Refresh shared state</button>
  </section>{/if}
{#if session && session.phase !== 'ended'}
  <section class="card" aria-labelledby="teaching-title">
    <h2 id="teaching-title">Teach Lemmi</h2>
    <p class="tag">LOCAL TEXT DEMO · Scripted replies · Microphone and speaker off</p>
    <p>Share something you know or enjoy. You can take your time, change topics or finish.</p>
    <p>Conversation text and preferences are not saved for caregiver review or future visits.</p>
    {#if !session.teaching}
      <button
        onclick={() => command({ type: 'teaching.start' })}
        disabled={busy || session.phase === 'paused' || (!!activity && activity.phase !== 'ended')}
        >Start Teach Lemmi</button
      >
    {:else}
      {#if session.teaching.entityId}
        <h3>{session.teaching.topicLabel}</h3>
        {#if session.phase === 'paused'}
          <p>Paused. Resume when you are ready; speaking does not start automatically.</p>
        {:else}
          <p class="invitation">{session.teaching.prompt}</p>
        {/if}
      {:else}
        <p>No eligible topics remain. You can finish, then choose music or just look.</p>
      {/if}
      <div role="status" aria-live="polite">
        {#if submitting}<p>Preparing a scripted reply… You can still pause or stop.</p>{/if}
        {#if reply}<p><strong>Lemmi:</strong> {reply.text}</p>
          <p class="tag">
            {reply.source === 'scripted' ? 'Scripted demo reply' : 'Application control reply'}
          </p>{/if}
      </div>
      <form onsubmit={sendAnswer}>
        <label for="teaching-answer">Your reply (fictional test text only)</label>
        <textarea
          id="teaching-answer"
          bind:value={answer}
          maxlength="1000"
          rows="3"
          disabled={submitting ||
            connectionLost ||
            session.phase === 'paused' ||
            !session.teaching.entityId}
        ></textarea>
        <button
          type="submit"
          disabled={busy ||
            submitting ||
            connectionLost ||
            !answer.trim() ||
            session.phase === 'paused' ||
            !session.teaching.entityId}>Send reply</button
        >
      </form>
      <div class="controls" aria-label="Teaching choices">
        <button
          onclick={() => command({ type: 'teaching.next' })}
          disabled={busy || session.phase === 'paused'}>Different topic</button
        >
        <button
          onclick={() => command({ type: 'teaching.not_sure' })}
          disabled={busy || session.phase === 'paused' || !session.teaching.entityId}
          >Not sure</button
        >
        <button
          onclick={() => command({ type: 'teaching.prefer' })}
          disabled={busy || session.phase === 'paused' || !session.teaching.entityId}
          >Like this topic</button
        >
        <button
          onclick={() => command({ type: 'teaching.avoid' })}
          disabled={busy || session.phase === 'paused' || !session.teaching.entityId}
          >Don't ask about this</button
        >
        <button onclick={() => command({ type: 'teaching.finish' })}>Finish teaching</button>
      </div>
    {/if}
  </section>
  <section class="card">
    <h2>Music transport example</h2>
    <p>
      No audio asset or playback executor is installed. A request will never be labeled as heard or
      played.
    </p>
    {#if !activity || activity.phase === 'ended'}<button
        onclick={music}
        disabled={busy || session.phase === 'paused' || !!session.teaching}
        >Open music example</button
      >{/if}
    {#if activity}<p>{activity.prompt}</p>
      <p>
        Activity {activity.phase} · Playback {activity.activityId === 'music_playlist'
          ? activity.playback
          : 'unavailable'}
      </p>
      <div class="controls">
        {#each activity.choices as choice}<button onclick={() => act(choice.action)} disabled={busy}
            >{choice.label}</button
          >{/each}
      </div>{/if}
  </section>
  <div class="controls sticky" aria-label="Session controls">
    <button onclick={() => command({ type: session?.phase === 'paused' ? 'resume' : 'pause' })}
      >{session.phase === 'paused' ? 'Resume to ready' : 'Pause'}</button
    >
    <button onclick={() => command({ type: 'stop' })}>Stop</button>
    <button onclick={() => command({ type: 'mute', muted: !session?.micMuted })} disabled={busy}
      >{session.micMuted ? 'Unmute (capture stays off)' : 'Mute microphone'}</button
    >
    <button onclick={help}>Demo help — no real message</button>
  </div>
{:else}<button onclick={help} disabled={busy}>Demo help — no real message</button>{/if}
<p role="status" aria-live="polite">{busy ? 'Working…' : message}</p>
<p>
  Photo talk, guessing and matching implementations remain pending. Teach Lemmi here uses reviewed,
  scripted text only; live AI, voice and robot acceptance are separate integration checks.
</p>

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
  .invitation {
    font-size: 1.2rem;
  }
</style>
