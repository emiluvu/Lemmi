<script lang="ts">
  import { onMount } from 'svelte';
  import { clients } from '#lib/clients.ts';
  import {
    type ParticipantProfile,
    type SessionSnapshot,
    type ActivityView,
    type SessionCommand,
    type ActivityAction,
    type Result,
  } from '@lemmi/contracts';
  let profile = $state<ParticipantProfile | null>(null);
  let session = $state<SessionSnapshot | null>(null);
  let activity = $state<ActivityView | null>(null);
  let busy = $state(false);
  let message = $state('');
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
    const id = session?.id;
    if (!id) return;
    return clients.session.subscribe({ sessionId: id }, (result) => {
      if (result.ok && (!session || result.data.generation >= session.generation))
        session = result.data;
    });
  });
  $effect(() => {
    const sessionId = session?.id;
    const instanceId = activity?.instanceId;
    if (!sessionId || !instanceId) return;
    return clients.activities.subscribe({ sessionId, instanceId }, (result) => {
      if (result.ok && (!activity || result.data.revision >= activity.revision))
        activity = result.data;
    });
  });
  async function refresh() {
    if (!session) return;
    session = show(await clients.session.get({ sessionId: session.id }));
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
</script>

<h1>Ready when you are{profile ? `, ${profile.preferredName}` : ''}</h1>
<p>Microphone off. Camera off. Commands below exercise mock state only.</p>
<section id="conversation" class="card">
  <h2>Talk with Lemmi</h2>
  <p>
    Voice conversation is not connected in this starter. Start a mock session below to try the
    shared controls; no microphone audio is captured.
  </p>
  {#if session && session.phase !== 'ended'}<button
      onclick={() => command({ type: 'speak' })}
      disabled={busy || session.phase === 'paused'}>Start conversation</button
    >{/if}
</section>
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
  <section class="card">
    <h2>Music transport example</h2>
    <p>
      No audio asset or playback executor is installed. A request will never be labeled as heard or
      played.
    </p>
    {#if !activity || activity.phase === 'ended'}<button
        onclick={music}
        disabled={busy || session.phase === 'paused'}>Open music example</button
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
    <button
      onclick={() => command({ type: session?.phase === 'paused' ? 'resume' : 'pause' })}
      disabled={busy}>{session.phase === 'paused' ? 'Resume to ready' : 'Pause'}</button
    >
    <button onclick={() => command({ type: 'stop' })} disabled={busy}>Stop</button>
    <button onclick={() => command({ type: 'mute', muted: !session?.micMuted })} disabled={busy}
      >{session.micMuted ? 'Unmute (capture stays off)' : 'Mute microphone'}</button
    >
    <button onclick={help} disabled={busy}>Demo help — no real message</button>
  </div>
{:else}<button onclick={help} disabled={busy}>Demo help — no real message</button>{/if}
<p role="status" aria-live="polite">{busy ? 'Working…' : message}</p>
<p>
  Photo talk, guessing, matching and Teach Lemmi have typed seams/fixtures; their implementations
  are pending.
</p>
