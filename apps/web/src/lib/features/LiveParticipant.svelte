<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { BrowserAudio } from './browser-audio.ts';
  import AvatarArt from './AvatarArt.svelte';
  import TeachingChoices from './TeachingChoices.svelte';
  import { mayPresentReply } from '#lib/participant-presentation.ts';
  import {
    createParticipantSetup,
    ParticipantConnection,
    type ParticipantEndpoint,
  } from '@lemmi/contracts';
  import type { ParticipantProfile, SessionSnapshot, ServerEvent, Result } from '@lemmi/contracts';
  let {
    demoEnrollment = false,
    requestedProfileId = null,
  }: { demoEnrollment?: boolean; requestedProfileId?: string | null } = $props();
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
  let teachingAvailable = $state(false);
  let outputBlocked = true;
  let replyBlocked = true;
  let outputAfterGeneration: number | null = null;
  let listening = $state(false);
  let audio: BrowserAudio | null = null;
  let connectionEpoch = 0;
  let connection: ParticipantConnection | null = null;
  let currentProfile = $derived(
    assignment
      ? (profiles.find((p) => p.id === assignment?.profileId) ?? assignment.profile)
      : profiles.find((p) => p.id === requestedProfileId),
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
      teachingAvailable = event.payload.teaching ?? false;
    }
    if (event.type === 'state.changed') {
      const next = event.payload.session;
      if (
        !next ||
        next.id !== session?.id ||
        next.generation !== session?.generation ||
        next.activeEndpointId !== session?.activeEndpointId ||
        next.phase === 'ended' ||
        (next.phase === 'paused' && session?.phase !== 'paused')
      )
        reply = '';
      session = next;
    }
    if (
      event.type === 'response.text' &&
      !replyBlocked &&
      mayPresentReply(event, session, assignment?.deviceId)
    )
      reply = event.payload.text;
    if (event.type === 'error') {
      message = event.payload.message;
      audio?.cancelInput();
    }
    const staleOutput =
      outputBlocked ||
      (outputAfterGeneration !== null && event.generation <= outputAfterGeneration);
    if (
      assignment &&
      !(staleOutput && ['response.start', 'audio.chunk', 'audio.end'].includes(event.type))
    )
      audio?.receive(event, assignment.deviceId);
  }
  function control(type: string, payload: unknown = {}, independent = false) {
    if (type === 'input.mute') audio?.cancelInput();
    else audio?.cancel();
    reply = '';
    replyBlocked = !type.startsWith('input.teaching.') && type !== 'input.start';
    // Microphone mute preserves unrelated approved playback. Other controls cancel it locally.
    if (type !== 'input.mute') {
      outputBlocked = !type.startsWith('input.teaching.') && type !== 'input.start';
      outputAfterGeneration = type.startsWith('input.teaching.')
        ? (session?.generation ?? null)
        : null;
    }
    if (!connection?.send(type, payload, independent))
      message = 'Connection unavailable. Reconnect when ready.';
  }
  function connect() {
    const epoch = ++connectionEpoch;
    audio?.close();
    audio = null;
    connection?.close();
    connected = false;
    outputBlocked = true;
    replyBlocked = true;
    outputAfterGeneration = null;
    textAvailable = false;
    speechAvailable = false;
    teachingAvailable = false;
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
          reply = '';
          text = '';
          outputBlocked = true;
          replyBlocked = true;
          audio?.cancel();
        }
      },
      onError: (value) => {
        if (epoch === connectionEpoch) {
          message = value;
          reply = '';
          outputBlocked = true;
          replyBlocked = true;
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
  function leaveConversation() {
    audio?.cancel();
    if (ownsEndpoint && session && session.phase !== 'ended') control('input.pause');
    connectionEpoch++;
    audio?.close();
    connection?.close();
    void goto('/caregiver');
  }
  function sendText(event: SubmitEvent) {
    event.preventDefault();
    if (
      !text.trim() ||
      !connected ||
      !ownsEndpoint ||
      !session ||
      !['ready', 'waiting'].includes(session.phase)
    )
      return;
    audio?.cancel();
    outputBlocked = false;
    replyBlocked = false;
    outputAfterGeneration = null;
    reply = '';
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
      if (current.ok && (!requestedProfileId || requestedProfileId === current.data.profileId)) {
        assignment = current.data;
        connect();
      } else if (!current.ok && current.error.code !== 'UNAUTHORIZED')
        message = current.error.message;
    });
    const background = () => {
      if (document.visibilityState === 'hidden') {
        control('input.pause');
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

<section class="conversation-screen live-companion" aria-labelledby="conversation-title">
  <div class="conversation-wordmark">Lemmi</div>
  <button
    class="conversation-exit"
    onclick={leaveConversation}
    aria-label="Return to caregiver workspace"
    title="Pause and return to caregiver workspace">✕</button
  >
  <header class="conversation-center live-companion-heading">
    <p class="eyebrow">Your companion</p>
    <h1 id="conversation-title">Talk with Lemmi</h1>
    {#if currentProfile}<div class="conversation-avatar live-avatar">
        <AvatarArt avatarId={currentProfile.avatarId} />
      </div>{/if}
    <h2>Ready when you are{currentProfile ? `, ${currentProfile.preferredName}` : ''}</h2>
    <p class="conversation-capture" aria-live="polite">
      {listening ? 'Microphone listening — tap Finish speaking when ready.' : 'Microphone off'} · Camera
      off
    </p>
  </header>
  <div class="conversation-workspace">
    {#if assignment}
      <section class="card">
        <p>Participant: <strong>{currentProfile?.preferredName ?? assignment.profileId}</strong></p>
        <p>
          {connected ? 'Connected' : 'Disconnected'} · Session: {session?.phase ?? 'not started'}
        </p>
        {#if session && session.phase !== 'ended'}
          <p>
            {ownsEndpoint
              ? 'This browser is the active endpoint.'
              : session.endpoint === 'robot'
                ? 'The robot is currently active.'
                : 'Another browser is currently active.'}
          </p>
          {#if !ownsEndpoint}<button onclick={() => control('input.handoff')} disabled={!connected}
              >Use this browser</button
            >{/if}
        {:else}<button onclick={() => control('input.start', {}, true)} disabled={!connected}
            >Start conversation</button
          >{/if}
        {#if !connected}<button onclick={connect} disabled={busy}>Reconnect</button>{/if}
        <button onclick={changeParticipant} disabled={busy}>Change participant</button>
      </section>
      {#if session && session.phase !== 'ended'}
        <div class="controls sticky" aria-label="Session controls">
          <button
            onclick={() => {
              control(session?.phase === 'paused' ? 'input.resume' : 'input.pause');
            }}
            disabled={!connected || (session.phase === 'paused' && !ownsEndpoint)}
            >{session.phase === 'paused' ? 'Resume to ready' : 'Pause'}</button
          >
          <button
            onclick={() => {
              control('input.stop');
            }}
            disabled={!connected}>Stop</button
          >
          <button
            onclick={() => {
              control('input.mute', { muted: !session?.micMuted });
            }}
            disabled={!connected || !ownsEndpoint}
            >{session.micMuted ? 'Unmute (capture stays off)' : 'Mute microphone'}</button
          >
          <button
            onclick={() => {
              control('input.help');
            }}
            disabled={!connected}>Ask for help</button
          >
        </div>
        <TeachingChoices
          {session}
          available={teachingAvailable}
          disabled={!connected || !ownsEndpoint}
          command={control}
        />
        {#if speechAvailable && ownsEndpoint}
          {#if listening}<button onclick={() => audio?.finish()}>Finish speaking</button>
          {:else}<button
              onclick={() => {
                outputBlocked = false;
                replyBlocked = false;
                outputAfterGeneration = null;
                reply = '';
                void audio?.speak();
              }}
              disabled={!connected ||
                session.micMuted ||
                !['ready', 'waiting'].includes(session.phase)}>Speak now</button
            >{/if}
        {/if}
        <details class="type-instead" open={!speechAvailable}>
          <summary>Type instead</summary>
          <form onsubmit={sendText} class="card">
            <label for="participant-text">Message to Lemmi</label>
            <textarea
              id="participant-text"
              bind:value={text}
              maxlength="1000"
              rows="3"
              disabled={!connected ||
                !ownsEndpoint ||
                !['ready', 'waiting'].includes(session.phase) ||
                !textAvailable ||
                (!!session.teaching && !session.teaching.entityId)}
            ></textarea>
            <button
              type="submit"
              disabled={!connected ||
                !ownsEndpoint ||
                !['ready', 'waiting'].includes(session.phase) ||
                (!!session.teaching && !session.teaching.entityId) ||
                !textAvailable ||
                !text.trim()}>Send</button
            >
            {#if !textAvailable}<p>Conversation service is not configured.</p>{/if}
          </form>
        </details>
        {#if reply}<section class="card" aria-live="polite">
            <h2>Lemmi</h2>
            <p>{reply}</p>
          </section>{/if}
      {/if}
    {:else if demoEnrollment}
      <section class="card" aria-label="Participant profiles">
        <h2>Choose a participant</h2>
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
        <input
          id="participant-name"
          bind:value={newName}
          maxlength="80"
          required
          autocomplete="off"
        />
        <button disabled={busy || !newName.trim()}>Create fictional profile</button>
      </form>
    {/if}
    <p role="status" aria-live="polite">{busy ? 'Working…' : message}</p>
    <p class="helper">
      Fictional demo. Listening uses local speech processing and an external language model. Audio
      is not saved.
    </p>
  </div>
</section>

<style>
  .conversation-screen {
    position: fixed;
    inset: 0;
    z-index: 10;
    overflow-y: auto;
    padding: 96px 24px 32px;
    background:
      linear-gradient(#fffaf066, #fffaf066),
      #fbf3df url('/images/surfaces/conversation-meadow-v1.png') center / cover no-repeat;
    display: grid;
    place-items: center;
    text-align: center;
  }
  .conversation-exit {
    position: absolute;
    right: max(24px, env(safe-area-inset-right));
    top: 20px;
    width: 56px;
    min-height: 56px;
    padding: 8px;
    border: 1px solid #bdc8aa;
    background: #fffdf7;
    color: #22331f;
    font-size: 24px;
    border-radius: 50%;
    box-shadow:
      inset 0 2px 0 #ffffff,
      0 3px 0 #684b3226,
      0 5px 12px #684b3212;
  }
  .conversation-center {
    display: grid;
    justify-items: center;
    width: min(100%, 720px);
  }
  .conversation-wordmark {
    position: absolute;
    top: 24px;
    left: 32px;
    color: #35482d;
    font-size: 28px;
    font-weight: 750;
    letter-spacing: -1px;
  }
  h1 {
    margin: 4px 0 12px;
    font-size: clamp(32px, 4vw, 44px);
    color: #22331f;
  }
  h2 {
    margin: 16px 0 0;
    font-size: 28px;
  }
  .conversation-center > p {
    margin: 8px 0;
    font-size: 20px;
  }
  .conversation-center > .eyebrow {
    font-size: 14px;
  }
  .conversation-avatar {
    display: block;
    width: min(440px, 100%);
    height: clamp(200px, 34dvh, 340px);
    flex-shrink: 0;
  }
  .conversation-capture {
    color: #2b3c24;
    font-weight: 700;
  }
  @media (max-height: 700px) {
    .conversation-screen {
      place-items: start center;
    }
    .conversation-avatar {
      height: 180px;
    }
  }
  /* Keep the same layout while calming the scenery behind narrow-screen text. */
  @media (max-width: 600px) {
    .conversation-wordmark {
      left: 24px;
    }
    .conversation-screen {
      background-image:
        linear-gradient(#fff8e34d, #fff8e34d), url('/images/surfaces/conversation-meadow-v1.png');
    }
  }

  .live-companion {
    padding: 32px 24px 48px;
    min-height: calc(100dvh - 40px);
  }
  .live-companion-heading {
    text-align: center;
  }
  .live-avatar {
    width: min(300px, 80%);
    height: 220px;
    margin: 0 auto;
  }
  .live-companion-heading {
    padding-top: 36px;
  }
  .conversation-workspace {
    width: min(760px, 100%);
    margin: 20px auto 0;
  }
  .conversation-workspace > :global(.card) {
    text-align: center;
  }
  .type-instead {
    margin: 24px 0;
  }
  summary {
    min-height: 56px;
    padding: 12px;
    cursor: pointer;
    font-weight: 800;
  }
  textarea,
  input {
    display: block;
    width: 100%;
    font: inherit;
    padding: 12px;
    margin: 12px 0;
  }
  .controls {
    flex-wrap: wrap;
  }
</style>
