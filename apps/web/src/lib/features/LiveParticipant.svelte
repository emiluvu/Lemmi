<script lang="ts">
  import { onMount } from 'svelte';
  import { goto, beforeNavigate } from '$app/navigation';
  import { clients } from '#lib/clients.ts';
  import { BrowserAudio } from './browser-audio.ts';
  import {
    PUBLIC_LEMMI_AUTO_TURN_END,
    PUBLIC_LEMMI_END_SILENCE_MS,
    PUBLIC_LEMMI_SPEECH_DIAGNOSTICS,
  } from '$app/env/public';
  import {
    appendConversationTurn,
    type ConversationTranscriptEntry,
  } from '#lib/conversation-transcript.ts';
  import AvatarArt from './AvatarArt.svelte';
  import SpeechBubble from './SpeechBubble.svelte';
  import ActivityVoicePhrases from './ActivityVoicePhrases.svelte';
  import ConversationExit from './ConversationExit.svelte';
  import { participantProfile, controlSessionFixture } from '@lemmi/contracts/fixtures';
  import { mayPresentReply } from '#lib/participant-presentation.ts';
  import {
    createParticipantSetup,
    ParticipantConnection,
    type ParticipantEndpoint,
  } from '@lemmi/contracts';
  import type {
    ParticipantProfile,
    SessionSnapshot,
    ServerEvent,
    Result,
    ActivityView,
    ActivityAction,
  } from '@lemmi/contracts';
  let {
    demoEnrollment = false,
    requestedProfileId = null,
    preview = false,
  }: { demoEnrollment?: boolean; requestedProfileId?: string | null; preview?: boolean } = $props();
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
  let transcript = $state<ConversationTranscriptEntry[]>([]);
  let textAvailable = $state(false);
  let speechAvailable = $state(false);
  let teachingAvailable = $state(false);
  let photoAvailable = $state(false);
  let photo = $state<Extract<ActivityView, { activityId: 'photo_album' }> | null>(null);
  let photoLoadError = $state(false);
  const photoBlocksConversation = $derived(!!photo && photo.phase !== 'ended' && photoLoadError);
  let outputBlocked = true;
  let replyBlocked = true;
  let outputAfterGeneration: number | null = null;
  let listening = $state(false);
  let speaking = $state(false);
  let audio: BrowserAudio | null = null;
  let connectionEpoch = 0;
  let connection: ParticipantConnection | null = null;
  let currentProfile = $derived(
    assignment
      ? (profiles.find((p) => p.id === assignment?.profileId) ?? assignment.profile)
      : profiles.find((p) => p.id === requestedProfileId),
  );
  let ownsEndpoint = $derived(!!assignment && session?.activeEndpointId === assignment.deviceId);
  function clearConversation() {
    reply = '';
    transcript = [];
  }
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
      photoAvailable = event.payload.photoStory ?? false;
    }
    if (
      event.type === 'activity.changed' &&
      event.session_id === session?.id &&
      event.generation === session?.generation
    ) {
      const next = event.payload.activity;
      if (next?.activityId === 'photo_album') {
        if (next.currentAssetId !== photo?.currentAssetId) photoLoadError = false;
        photo = next;
      } else photo = null;
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
        clearConversation();
      session = next;
      if (!next || next.phase === 'ended') photo = null;
    }
    if (
      event.type === 'response.text' &&
      !replyBlocked &&
      mayPresentReply(event, session, assignment?.deviceId)
    ) {
      reply = event.payload.text;
      transcript = appendConversationTurn(transcript, { speaker: 'lemmi', text: reply });
    }
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
    const preserveCaption = type === 'input.mute' && speaking;
    if (!preserveCaption) clearConversation();
    const requestsOutput =
      type.startsWith('input.teaching.') ||
      type === 'input.start' ||
      type === 'input.photo.repeat' ||
      (type === 'input.photo.action' &&
        !!payload &&
        typeof payload === 'object' &&
        'action' in payload &&
        (payload.action as ActivityAction).type === 'photo.talk');
    if (!preserveCaption) replyBlocked = !requestsOutput;
    // Microphone mute preserves unrelated approved playback. Other controls cancel it locally.
    if (type !== 'input.mute') {
      outputBlocked = !requestsOutput;
      outputAfterGeneration = type.startsWith('input.teaching.')
        ? (session?.generation ?? null)
        : null;
    }
    if (!connection?.send(type, payload, independent))
      message = 'Connection unavailable. Reconnect when ready.';
  }
  function photoAction(action: ActivityAction) {
    if (!photo) return;
    control('input.photo.action', {
      instanceId: photo.instanceId,
      expectedRevision: photo.revision,
      action,
    });
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
    photoAvailable = false;
    photo = null;
    session = null;
    clearConversation();
    connection = new ParticipantConnection({
      origin: window.location.origin,
      onEvent: (event) => {
        if (epoch === connectionEpoch) received(event);
      },
      onClose: () => {
        if (epoch === connectionEpoch) {
          connected = false;
          clearConversation();
          text = '';
          outputBlocked = true;
          replyBlocked = true;
          audio?.cancel();
        }
      },
      onError: (value) => {
        if (epoch === connectionEpoch) {
          message = value;
          clearConversation();
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
                outputWindowChunks: 12,
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
      (value) => {
        speaking = value;
      },
      {
        automatic: PUBLIC_LEMMI_AUTO_TURN_END,
        silenceMs: PUBLIC_LEMMI_END_SILENCE_MS,
        onTiming: PUBLIC_LEMMI_SPEECH_DIAGNOSTICS
          ? (timing) => console.info('Lemmi browser speech timing', JSON.stringify(timing))
          : undefined,
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
      clearConversation();
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
  let exitGate = $state<{ requestExit: () => void }>(null!);
  let controlsDialog = $state<HTMLDialogElement>(null!);
  let typingDialog = $state<HTMLDialogElement>(null!);
  let replyDialog = $state<HTMLDialogElement>(null!);
  let navigationAllowed = false;
  function prepareExit() {
    audio?.cancel();
    if (!preview && ownsEndpoint && session && !['paused', 'ended'].includes(session.phase))
      control('input.pause');
  }
  async function pauseBeforeExit() {
    if (preview || !ownsEndpoint || !session || ['paused', 'ended'].includes(session.phase))
      return true;
    prepareExit();
    const deadline = Date.now() + 3000;
    while (session && !['paused', 'ended'].includes(session.phase) && Date.now() < deadline)
      await new Promise((resolve) => setTimeout(resolve, 40));
    return !session || ['paused', 'ended'].includes(session.phase);
  }
  function leaveConversation() {
    navigationAllowed = true;
    audio?.cancel();
    connectionEpoch++;
    audio?.close();
    connection?.close();
    void goto(preview ? '/preview/application' : '/caregiver');
  }
  beforeNavigate(({ to, from, cancel }) => {
    if (
      navigationAllowed ||
      !to ||
      (to.url.pathname === from?.url.pathname && to.url.search === from?.url.search)
    )
      return;
    cancel();
    exitGate?.requestExit();
  });
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
      transcript = appendConversationTurn(transcript, { speaker: 'participant', text });
      text = '';
      message = '';
      typingDialog?.close();
    }
  }
  onMount(() => {
    if (preview) {
      let disposed = false;
      void clients.profile.load({ profileId: 'profile-alex' }).then((result) => {
        if (!disposed && result.ok) {
          profiles = [result.data];
          if (assignment) assignment = { ...assignment, profile: result.data };
        } else if (!disposed && !result.ok) message = result.error.message;
      });
      assignment = {
        deviceId: 'preview-browser',
        profileId: participantProfile.id,
        endpoint: 'browser',
        expiresAt: null,
        profile: participantProfile,
      };
      session = {
        ...controlSessionFixture,
        mode: 'mock',
        endpoint: 'browser',
        activeEndpointId: 'preview-browser',
        phase: 'ready',
      };
      teachingAvailable = true;
      photoAvailable = true;
      speechAvailable = true;
      message = 'Local preview · microphone off.';
      return () => {
        disposed = true;
      };
    }
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
        audio?.cancel();
        if (connected && ownsEndpoint && session && session.phase !== 'ended')
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

{#snippet safetyControls()}
  <div class="safety-controls" aria-label="Session safety controls">
    <button
      onclick={() => control(session?.phase === 'paused' ? 'input.resume' : 'input.pause')}
      disabled={!session ||
        session.phase === 'ended' ||
        (session.phase === 'paused' && !ownsEndpoint)}
      >{session?.phase === 'paused' ? 'Resume' : 'Pause'}</button
    >
    <button onclick={() => control('input.stop')} disabled={!session || session.phase === 'ended'}
      >Stop</button
    >
    <button
      onclick={() => control('input.help')}
      disabled={!connected || !session || session.phase === 'ended'}>Get help</button
    >
  </div>
{/snippet}

<section
  class="conversation-screen"
  class:captioning={speaking && !!(reply || session?.teaching?.prompt)}
  aria-labelledby="conversation-title"
>
  <h1 id="conversation-title" class="sr-only">Talk with Lemmi</h1>
  <ConversationExit
    bind:this={exitGate}
    prepare={prepareExit}
    beforeExit={pauseBeforeExit}
    exited={leaveConversation}
    controls={safetyControls}
  />
  {@render safetyControls()}
  <div class="companion-scene">
    <div class="scene-portrait">
      <div class="scene-art">
        {#if photo && photo.phase !== 'ended' && photo.currentAssetId}
          {#key photo.currentAssetId}<img
              class="scene-photo"
              src={`/v1/demo/photo-assets/${encodeURIComponent(photo.currentAssetId)}`}
              alt={photo.caption ?? 'Reviewed picture'}
              onerror={() => {
                photoLoadError = true;
                audio?.cancel();
                if (ownsEndpoint) control('input.pause');
              }}
            />{/key}
        {:else if currentProfile}
          <AvatarArt
            avatarId={currentProfile.avatarId}
            animated
            talking={speaking}
            thinking={session?.phase === 'processing'}
          />
        {:else}<p>Loading your companion…</p>{/if}
      </div>
      {#if speaking && (reply || session?.teaching?.prompt)}
        <div class="caption-anchor">
          <SpeechBubble
            text={reply || session?.teaching?.prompt || ''}
            side
            readFull={() => replyDialog.showModal()}
          />
        </div>
      {/if}
    </div>
    <h2 class:sr-only={speaking}>
      {session?.phase === 'paused'
        ? 'Take your time'
        : session?.phase === 'ended'
          ? 'Here when you need me'
          : 'Ready when you are'}
    </h2>
    <button
      class="capture-state"
      aria-live="polite"
      aria-label={listening ? 'Stop conversation immediately' : 'Open voice controls'}
      onclick={() => {
        if (listening) {
          audio?.cancel();
          control('input.stop');
        } else controlsDialog.showModal();
      }}
    >
      {listening
        ? 'Microphone listening'
        : session?.micMuted
          ? 'Microphone muted'
          : 'Microphone off'} · Camera off
    </button>
  </div>
  <div class="conversation-panel" class:has-reply={!!(reply || session?.teaching?.prompt)}>
    {#if assignment}
      {#if !connected && !preview}<p role="status">Connection unavailable.</p>
        <button onclick={connect} disabled={busy}>Reconnect</button>{/if}
      {#if !session || session.phase === 'ended'}
        <p>Start when you are ready.</p>
        <button onclick={() => control('input.start', {}, true)} disabled={!connected}
          >Start conversation</button
        >
      {:else if !ownsEndpoint}<p>
          The {session.endpoint === 'robot' ? 'robot' : 'other browser'} is active.
        </p>
        <button onclick={() => control('input.handoff')} disabled={!connected}
          >Use this browser</button
        >
      {:else}
        <ActivityVoicePhrases
          teaching={teachingAvailable}
          photos={photoAvailable}
          voice={!preview && speechAvailable}
          compact
        />
        {#if session.teaching}<p class="active-mode">
            Teach Lemmi · {session.teaching.topicLabel ?? 'No eligible topics'}
          </p>{/if}
        {#if photo && photo.phase !== 'ended'}<p class="active-mode">
            Photo Story · Say “Next photo” or “Back to conversation”.
          </p>{/if}
        {@const visibleReply = reply || session.teaching?.prompt || ''}
        {#if visibleReply && !speaking}<p class="reply" aria-live="polite">
            {visibleReply.length > 120 ? visibleReply.slice(0, 120) + '…' : visibleReply}
          </p>
          {#if visibleReply.length > 70}<button
              class="text-button"
              onclick={() => replyDialog.showModal()}>Read full reply</button
            >{/if}
        {/if}
      {/if}
    {:else if demoEnrollment}
      <label for="choose-participant">Choose a participant</label>
      <select
        id="choose-participant"
        onchange={(event) => {
          if (event.currentTarget.value) void select(event.currentTarget.value);
        }}
        disabled={busy}
      >
        <option value="">Choose a profile</option>
        {#each profiles as profile}<option value={profile.id}>{profile.preferredName}</option
          >{/each}
      </select>
      <p>Use the caregiver exit to set up a new profile.</p>
    {/if}
    {#if photoLoadError}<p role="alert">
        The picture is unavailable. Pause or choose another activity.
      </p>{/if}
    {#if message}<p class="connection-message" role="status">{message}</p>{/if}
  </div>
</section>

<dialog bind:this={controlsDialog} class="conversation-dialog" aria-labelledby="controls-title">
  <div class="dialog-heading">
    <h2 id="controls-title">Voice controls</h2>
    <button
      class="secondary"
      aria-label="Close voice controls"
      onclick={() => controlsDialog.close()}>✕</button
    >
  </div>
  <div class="conversation-controls" aria-label="Conversation and safety controls">
    <button
      onclick={() => control(session?.phase === 'paused' ? 'input.resume' : 'input.pause')}
      disabled={!connected ||
        !session ||
        session.phase === 'ended' ||
        (session.phase === 'paused' && !ownsEndpoint)}
      >{session?.phase === 'paused' ? 'Resume' : 'Pause'}</button
    >
    <button
      onclick={() => control('input.stop')}
      disabled={!connected || !session || session.phase === 'ended'}>Stop</button
    >
    <button
      onclick={() => control('input.mute', { muted: !session?.micMuted })}
      disabled={!connected || !ownsEndpoint || !session || session.phase === 'ended'}
      >{session?.micMuted ? 'Unmute' : 'Mute mic'}</button
    >
    <button onclick={() => control('input.help')} disabled={!connected}>Get help</button>
    {#if listening}<button onclick={() => audio?.finish()}>Finish speaking</button>
    {:else}<button
        class="speak"
        onclick={() => {
          outputBlocked = false;
          replyBlocked = false;
          outputAfterGeneration = null;
          reply = '';
          controlsDialog.close();
          void audio?.speak();
        }}
        disabled={!connected ||
          !ownsEndpoint ||
          !speechAvailable ||
          !session ||
          session.micMuted ||
          photoBlocksConversation ||
          !['ready', 'waiting'].includes(session.phase)}>Speak now</button
      >{/if}
    <button
      onclick={() => {
        audio?.cancel();
        controlsDialog.close();
        typingDialog.showModal();
      }}
      disabled={!assignment}>Type instead</button
    >
  </div>
</dialog>

<dialog bind:this={typingDialog} class="conversation-dialog" aria-labelledby="typing-title">
  <div class="dialog-heading">
    <h2 id="typing-title">Type to Lemmi</h2>
    <button class="secondary" aria-label="Close typing" onclick={() => typingDialog.close()}
      >✕</button
    >
  </div>
  {@render safetyControls()}
  <form onsubmit={sendText}>
    <label for="participant-text">Your message or activity phrase</label>
    <textarea
      id="participant-text"
      bind:value={text}
      maxlength="1000"
      rows="3"
      disabled={!connected ||
        !ownsEndpoint ||
        !session ||
        !['ready', 'waiting'].includes(session.phase) ||
        !textAvailable}
    ></textarea>
    <button
      disabled={!connected ||
        !ownsEndpoint ||
        !session ||
        !textAvailable ||
        !text.trim() ||
        !['ready', 'waiting'].includes(session.phase)}>Send</button
    >
    {#if preview}<p>
        Local visual preview. Voice and conversation services are not connected.
      </p>{/if}
  </form>
</dialog>
<dialog bind:this={replyDialog} class="conversation-dialog" aria-labelledby="reply-title">
  <div class="dialog-heading">
    <h2 id="reply-title">Lemmi’s reply</h2>
    <button class="secondary" aria-label="Close reply" onclick={() => replyDialog.close()}>✕</button
    >
  </div>
  {@render safetyControls()}
  <p>{reply || session?.teaching?.prompt}</p>
  {#if transcript.length}
    <section aria-label="This conversation">
      <h3>This conversation</h3>
      {#each transcript as turn}
        <p><strong>{turn.speaker === 'participant' ? 'You' : 'Lemmi'}</strong>: {turn.text}</p>
      {/each}
    </section>
  {/if}
</dialog>

<style>
  .safety-controls {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .safety-controls button {
    min-height: 48px;
    margin: 0;
    padding: 8px 12px;
    font-size: 18px;
  }
  .conversation-screen > .safety-controls {
    position: absolute;
    top: 12px;
    left: 12px;
    right: 70px;
    z-index: 2;
  }
  dialog .safety-controls {
    margin-bottom: 16px;
  }
  .conversation-screen {
    position: fixed;
    inset: 0;
    z-index: 10;
    height: 100dvh;
    box-sizing: border-box;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 52px 20px 16px;
    background:
      linear-gradient(#fffaf066, #fffaf066),
      #fbf3df url('/images/surfaces/conversation-meadow-v1.png') center/cover no-repeat;
    color: #22331f;
  }
  .companion-scene {
    min-height: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    width: 100%;
  }
  .scene-portrait {
    position: relative;
  }
  .caption-anchor {
    position: absolute;
    left: calc(100% - 24px);
    top: 8%;
    width: min(320px, 30vw);
    z-index: 1;
  }
  .scene-art {
    width: min(360px, 68vw, 40dvh);
    height: min(360px, 68vw, 40dvh);
    flex: none;
  }
  .scene-photo {
    width: 100%;
    height: 100%;
    object-fit: contain;
    border-radius: 20px;
  }
  .companion-scene h2 {
    margin: 0;
    font-size: clamp(22px, 3vw, 28px);
    text-align: center;
  }
  .capture-state {
    margin: 0;
    padding: 6px 12px;
    min-height: 44px;
    border: 0;
    background: transparent;
    color: #34492d;
    font-size: 15px;
    text-align: center;
  }
  .conversation-panel {
    width: min(620px, 100%);
    min-height: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    text-align: center;
  }
  .conversation-panel p {
    margin: 0;
  }
  .conversation-panel :global(.activity-phrases) {
    margin: 0;
    max-width: 100%;
  }
  .conversation-panel :global(.activity-phrases h2),
  .conversation-panel :global(.activity-phrases .helper) {
    text-align: center;
  }
  .active-mode {
    font-size: 16px;
    font-weight: 700;
  }
  .reply {
    font-size: 19px;
    line-height: 1.35;
    display: -webkit-box;
    line-clamp: 2;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .connection-message {
    font-size: 12px;
    line-height: 1.3;
  }
  .text-button {
    min-height: 44px;
    padding: 8px;
    background: #fffdf7;
  }
  .conversation-controls {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin: 20px 0 0;
  }
  .conversation-controls button {
    min-height: 48px;
    margin: 0;
    padding: 10px;
    font-size: 18px;
  }
  .speak {
    background: #dce8c9;
    color: #22331f;
  }
  .conversation-dialog {
    width: min(560px, calc(100% - 24px));
    max-height: calc(100dvh - 24px);
    padding: 24px;
    border: 1px solid #bdc8aa;
    border-radius: 24px;
    background: #fffdf7;
    color: #22331f;
    overflow: auto;
  }
  .conversation-dialog::backdrop {
    background: #25362088;
  }
  .dialog-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .dialog-heading h2 {
    margin: 0;
  }
  textarea,
  select {
    width: 100%;
    padding: 10px;
    margin: 12px 0;
    font: inherit;
  }
  .has-reply :global(.activity-phrases h2),
  .has-reply :global(.activity-phrases .helper) {
    display: none;
  }
  @media (max-width: 800px) {
    .scene-portrait {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
    }
    .caption-anchor {
      position: relative;
      left: auto;
      top: auto;
      width: min(440px, calc(100vw - 40px));
    }
    .captioning .scene-art {
      width: min(220px, 52vw, 24dvh);
      height: min(220px, 52vw, 24dvh);
    }
    .captioning .conversation-panel :global(.activity-phrases h2),
    .captioning .conversation-panel :global(.activity-phrases .helper) {
      display: none;
    }
  }
  @media (max-height: 700px) {
    .conversation-screen {
      gap: 6px;
      padding-top: 48px;
      padding-bottom: 12px;
    }
    .scene-art {
      width: min(240px, 60vw, 29dvh);
      height: min(240px, 60vw, 29dvh);
    }
    .companion-scene h2 {
      font-size: 21px;
    }
    .conversation-panel :global(.activity-phrases li) {
      font-size: 18px;
      margin: 4px 0;
    }
    .conversation-panel :global(.activity-phrases h2) {
      font-size: 20px;
    }
    .reply {
      font-size: 17px;
    }
  }
  @media (max-height: 500px) {
    .conversation-screen {
      gap: 4px;
      padding-top: 40px;
    }
    .companion-scene h2 {
      display: none;
    }
    .scene-art {
      width: 24dvh;
      height: 24dvh;
    }
    .conversation-panel :global(.activity-phrases ul) {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px 24px;
      margin: 4px 0;
    }
    .conversation-panel :global(.activity-phrases .helper) {
      display: none;
    }
    .capture-state {
      min-height: 36px;
      padding: 4px;
    }
  }
</style>
