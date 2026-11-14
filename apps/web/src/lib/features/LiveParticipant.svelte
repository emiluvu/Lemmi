<script lang="ts">
  import { onMount } from 'svelte';
  import { BrowserAudio } from './browser-audio.ts';
  import {
    createParticipantSetup,
    ParticipantConnection,
    type ParticipantEndpoint,
  } from '@lemmi/contracts';
  import type { ParticipantProfile, SessionSnapshot, ServerEvent, Result } from '@lemmi/contracts';
  let { demoEnrollment = false }: { demoEnrollment?: boolean } = $props();
  const setup = createParticipantSetup();
  let profiles = $state<ParticipantProfile[]>([]);
  let assignment = $state<ParticipantEndpoint | null>(null);
  let session = $state<SessionSnapshot | null>(null);
  let connected = $state(false);
  let busy = $state(false);
  let message = $state('');
  let newName = $state('');
  let text = $state('');
  let reply = $state('');
  let textAvailable = $state(false);
  let speechAvailable = $state(false);
  let listening = $state(false);
  let audio: BrowserAudio | null = null;
  let connectionEpoch = 0;
  let connection: ParticipantConnection | null = null;
  let currentProfile = $derived(
    profiles.find((p) => p.id === assignment?.profileId) ?? assignment?.profile,
  );
  let ownsEndpoint = $derived(!!assignment && session?.activeEndpointId === assignment.deviceId);
  function show<T>(result: Result<T>): T | null {
    if (result.ok) return result.data;
    message = result.error.message;
    return null;
  }
  async function run(work: () => Promise<void>) {
    busy = true;
    message = '';
    try {
      await work();
    } catch {
      message = 'Request unavailable. Try again.';
    } finally {
      busy = false;
    }
  }
  async function refreshProfiles() {
    profiles = show(await setup.profiles()) ?? [];
  }
  function received(event: ServerEvent) {
    if (event.type === 'device.ready') {
      connected = true;
      textAvailable = event.payload.textChat ?? false;
      speechAvailable = event.payload.audio !== false;
    }
    if (event.type === 'state.changed') session = event.payload.session;
    if (event.type === 'response.text') reply = event.payload.text;
    if (event.type === 'error') {
      message = event.payload.message;
      audio?.cancelInput();
    }
    if (assignment) audio?.receive(event, assignment.deviceId);
  }
  function connect() {
    const epoch = ++connectionEpoch;
    audio?.close();
    audio = null;
    connection?.close();
    connected = false;
    session = null;
    reply = '';
    connection = new ParticipantConnection({
      origin: window.location.origin,
      onEvent: (event) => {
        if (epoch === connectionEpoch) received(event);
      },
      onClose: () => {
        if (epoch === connectionEpoch) {
          connected = false;
          audio?.cancel();
        }
      },
      onError: (value) => {
        if (epoch === connectionEpoch) {
          message = value;
          audio?.cancel();
        }
      },
      hello: {
        firmwareVersion: 'browser-participant/0.1',
        endpoint: 'browser',
        cameraSupported: false,
        pettingSupported: false,
        ...(typeof AudioContext === 'function' &&
        typeof navigator.mediaDevices?.getUserMedia === 'function'
          ? {
              audio: { encoding: 'pcm_s16le', sampleRate: 16000, channels: 1, frameMs: 20 },
              playback: {
                encoding: 'pcm_s16le',
                channels: 1,
                sampleRates: [16000, 22050, 24000, 44100, 48000],
              },
            }
          : { audio: { supported: false } }),
      },
    });
    audio = new BrowserAudio(
      connection,
      (value) => {
        listening = value;
      },
      (value) => {
        message = value;
      },
    );
    connection.connect();
  }
  async function select(profileId: string) {
    await run(async () => {
      connectionEpoch++;
      audio?.close();
      audio = null;
      connection?.close();
      connection = null;
      session = null;
      reply = '';
      text = '';
      connected = false;
      assignment = show(await setup.enroll(profileId));
      if (assignment) connect();
    });
  }
  async function createProfile() {
    await run(async () => {
      const profile = show(await setup.create(newName));
      if (profile) {
        profiles = [...profiles, profile];
        newName = '';
      }
    });
  }
  async function changeParticipant() {
    await run(async () => {
      audio?.cancel();
      if (ownsEndpoint && session?.phase !== 'ended') connection?.send('input.stop');
      connectionEpoch++;
      audio?.close();
      audio = null;
      connection?.close();
      connection = null;
      session = null;
      reply = '';
      text = '';
      connected = false;
      const released = show(await setup.release());
      assignment = null;
      if (released) await refreshProfiles();
    });
  }
  function sendText(event: SubmitEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    if (connection?.send('input.text', { text: text.trim(), language: 'en' })) {
      text = '';
      message = '';
    }
  }
  onMount(() => {
    let disposed = false;
    void run(async () => {
      if (!demoEnrollment) {
        message = 'Participant setup is not enabled on this server.';
        return;
      }
      await refreshProfiles();
      if (disposed) return;
      const current = await setup.current();
      if (disposed) return;
      if (current.ok) {
        assignment = current.data;
        connect();
      } else if (current.error.code !== 'UNAUTHORIZED') message = current.error.message;
    });
    const background = () => {
      if (document.visibilityState === 'hidden') {
        audio?.cancel();
        connection?.send('input.pause');
      }
    };
    const leaving = () => {
      audio?.cancel();
      connection?.close();
    };
    document.addEventListener('visibilitychange', background);
    window.addEventListener('pagehide', leaving);
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', background);
      window.removeEventListener('pagehide', leaving);
      connectionEpoch++;
      audio?.close();
      connection?.close();
    };
  });
</script>

<h1>
  {currentProfile ? `Ready when you are, ${currentProfile.preferredName}` : 'Choose a participant'}
</h1>
<p>
  Fictional participant demo. {listening
    ? 'Microphone listening — tap Finish speaking when ready.'
    : 'Microphone off.'} Camera off.
</p>
{#if assignment}
  <section class="card">
    <p>Participant: <strong>{currentProfile?.preferredName ?? assignment.profileId}</strong></p>
    <p>{connected ? 'Connected' : 'Disconnected'} · Session: {session?.phase ?? 'not started'}</p>
    {#if session && session.phase !== 'ended'}
      <p>
        {ownsEndpoint
          ? 'This browser is the active endpoint.'
          : `Active endpoint: ${session.endpoint}.`}
      </p>
      {#if !ownsEndpoint}<button
          onclick={() => connection?.send('input.handoff')}
          disabled={!connected}>Use this browser</button
        >{/if}
    {:else}<button onclick={() => connection?.send('input.start', {}, true)} disabled={!connected}
        >Start conversation</button
      >{/if}
    {#if !connected}<button onclick={connect} disabled={busy}>Reconnect</button>{/if}
    <button onclick={changeParticipant} disabled={busy}>Change participant</button>
  </section>
  {#if session && session.phase !== 'ended'}
    <div class="controls sticky" aria-label="Session controls">
      <button
        onclick={() => {
          audio?.cancel();
          connection?.send(session?.phase === 'paused' ? 'input.resume' : 'input.pause');
        }}
        disabled={!connected || (session.phase === 'paused' && !ownsEndpoint)}
        >{session.phase === 'paused' ? 'Resume to ready' : 'Pause'}</button
      >
      <button
        onclick={() => {
          audio?.cancel();
          connection?.send('input.stop');
          reply = '';
        }}
        disabled={!connected}>Stop</button
      >
      <button
        onclick={() => {
          audio?.cancelInput();
          connection?.send('input.mute', { muted: !session?.micMuted });
        }}
        disabled={!connected || !ownsEndpoint}
        >{session.micMuted ? 'Unmute (capture stays off)' : 'Mute microphone'}</button
      >
      <button
        onclick={() => {
          audio?.cancel();
          connection?.send('input.help');
        }}
        disabled={!connected}>Ask for help</button
      >
    </div>
    {#if speechAvailable && ownsEndpoint}
      {#if listening}<button onclick={() => audio?.finish()}>Finish speaking</button>
      {:else}<button
          onclick={() => audio?.speak()}
          disabled={!connected || session.micMuted || !['ready', 'waiting'].includes(session.phase)}
          >Speak now</button
        >{/if}
    {/if}
    <form onsubmit={sendText} class="card">
      <label for="participant-text">Message to Lemmi</label>
      <textarea
        id="participant-text"
        bind:value={text}
        maxlength="1000"
        rows="3"
        disabled={!connected || !ownsEndpoint || session.phase === 'paused' || !textAvailable}
      ></textarea>
      <button
        type="submit"
        disabled={!connected ||
          !ownsEndpoint ||
          session.phase === 'paused' ||
          !textAvailable ||
          !text.trim()}>Send</button
      >
      {#if !textAvailable}<p>Conversation service is not configured.</p>{/if}
    </form>
    {#if reply}<section class="card" aria-live="polite">
        <h2>Lemmi</h2>
        <p>{reply}</p>
      </section>{/if}
  {/if}
{:else if demoEnrollment}
  <section class="card" aria-label="Participant profiles">
    {#each profiles as profile}<button onclick={() => select(profile.id)} disabled={busy}
        >{profile.preferredName}</button
      >{/each}
    {#if !profiles.length}<p>No profiles available.</p>{/if}
  </section>
  <form
    class="card"
    onsubmit={(event) => {
      event.preventDefault();
      void createProfile();
    }}
  >
    <label for="participant-name">New fictional participant name</label>
    <input id="participant-name" bind:value={newName} maxlength="80" required autocomplete="off" />
    <button disabled={busy || !newName.trim()}>Create fictional profile</button>
  </form>
{/if}
<p role="status" aria-live="polite">{busy ? 'Working…' : message}</p>
