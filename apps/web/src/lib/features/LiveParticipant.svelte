<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { goto, beforeNavigate } from '$app/navigation';
  import { clients } from '#lib/clients.ts';
  import { BrowserAudio } from './browser-audio.ts';
  import { BrowserConversation } from './browser-conversation.ts';
  import {
    PUBLIC_LEMMI_AUTO_TURN_END,
    PUBLIC_LEMMI_END_SILENCE_MS,
    PUBLIC_LEMMI_SPEECH_DIAGNOSTICS,
  } from '$app/env/public';
  import {
    appendConversationTurn,
    type ConversationTranscriptEntry,
  } from '#lib/conversation-transcript.ts';
  import ScopedPhoto from './ScopedPhoto.svelte';
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
  let setupState = $state<'loading' | 'ready' | 'unavailable'>('loading');
  let setupMounted = $state(false);
  let setupDisposed = false;
  let setupEpoch = 0;
  let message = $state('');
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
  const visibleReply = $derived(reply || session?.teaching?.prompt || '');
  const activityActive = $derived(!!session?.teaching || (!!photo && photo.phase !== 'ended'));
  let conversationEnabled = $state(false);
  let audio = $state<BrowserAudio | null>(null);
  const avatarTalking = $derived(speaking || (session?.phase === 'speaking' && !!audio?.hasOutput));
  let conversation: BrowserConversation | null = null;
  let connectionEpoch = 0;
  let connection: ParticipantConnection | null = null;
  let currentProfile = $derived(
    assignment
      ? (profiles.find((p) => p.id === assignment?.profileId) ?? assignment.profile)
      : profiles.find((p) => p.id === requestedProfileId),
  );
  let connectionLanguage = $state<'en' | 'de' | null>(null);
  const language = $derived(connectionLanguage ?? currentProfile?.language ?? 'en');
  const german = $derived(language === 'de');
  const wording = (en: string, de: string) => (german ? de : en);
  let ownsEndpoint = $derived(!!assignment && session?.activeEndpointId === assignment.deviceId);
  function clearConversation() {
    reply = '';
    transcript = [];
  }
  function show<T>(result: Result<T>): T | null {
    if (result.ok) return result.data;
    message = german
      ? 'Die Anfrage ist nicht verfügbar. Bitte versuche es erneut.'
      : result.error.message;
    return null;
  }
  async function loadAssignedProfile() {
    if (preview || setupDisposed) return;
    const epoch = ++setupEpoch;
    const requested = requestedProfileId;
    const current = () =>
      !setupDisposed && epoch === setupEpoch && requested === requestedProfileId;
    // Setup recovery never enrolls an endpoint or restores listening intent.
    connectionEpoch++;
    conversation?.stop();
    audio?.close();
    connection?.close();
    conversation = null;
    audio = null;
    connection = null;
    assignment = null;
    profiles = [];
    session = null;
    photo = null;
    connected = false;
    connectionLanguage = null;
    clearConversation();
    setupState = 'loading';
    busy = true;
    message = '';
    try {
      if (!demoEnrollment) throw new Error('Setup disabled');
      const result = await setup.current();
      if (!current()) return;
      if (!result.ok) {
        message =
          result.error.code === 'UNAUTHORIZED' || result.error.code === 'FORBIDDEN'
            ? wording(
                'Use the caregiver exit to choose this browser’s profile, then try again.',
                'Wähle über den Pflegebereich das Profil dieses Browsers aus und versuche es erneut.',
              )
            : wording(
                'Profile connection unavailable. Try again.',
                'Profilverbindung nicht verfügbar. Bitte versuche es erneut.',
              );
        setupState = 'unavailable';
        return;
      }
      const endpoint = result.data;
      if (endpoint.endpoint !== 'browser' || (requested && requested !== endpoint.profileId))
        throw new Error('Assigned profile mismatch');
      let profile = endpoint.profile;
      if (!profile) {
        const available = await setup.profiles();
        if (!current()) return;
        if (!available.ok) throw new Error('Profile unavailable');
        profile = available.data.find((item) => item.id === endpoint.profileId);
      }
      if (!profile || profile.id !== endpoint.profileId) throw new Error('Profile unavailable');
      assignment = { ...endpoint, profile };
      profiles = [profile];
      setupState = 'ready';
      connect();
    } catch {
      if (!current()) return;
      setupState = 'unavailable';
      message = wording(
        'Profile connection unavailable. Check the selected profile in the caregiver workspace, then try again.',
        'Profilverbindung nicht verfügbar. Prüfe das ausgewählte Profil im Pflegebereich und versuche es erneut.',
      );
    } finally {
      if (current()) busy = false;
    }
  }
  $effect(() => {
    requestedProfileId;
    if (setupMounted && !preview) untrack(() => void loadAssignedProfile());
  });

  function received(event: ServerEvent) {
    if (event.type === 'device.ready') {
      connectionLanguage = event.payload.language ?? 'en';
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
      message = german
        ? 'Das ist gerade nicht verfügbar. Das Mikrofon ist aus. Bitte versuche es erneut.'
        : event.payload.message;
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
    conversation?.receive(event);
  }
  function control(type: string, payload: unknown = {}, independent = false) {
    conversation?.stop();
    if (type === 'input.mute') audio?.cancelInput();
    else audio?.cancel();
    const preserveCaption = type === 'input.mute' && (speaking || !!audio?.hasOutput);
    if (!preserveCaption) clearConversation();
    const requestsOutput =
      [
        'input.teaching.start',
        'input.teaching.select',
        'input.teaching.next',
        'input.teaching.not_sure',
        'input.teaching.avoid',
      ].includes(type) ||
      type === 'input.start' ||
      type === 'input.resume' ||
      type === 'input.photo.start' ||
      type === 'input.photo.repeat' ||
      (type === 'input.photo.action' &&
        !!payload &&
        typeof payload === 'object' &&
        'action' in payload &&
        (payload.action as ActivityAction).type === 'photo.talk');
    if (requestsOutput) void audio?.prepare();
    if (!preserveCaption) replyBlocked = !requestsOutput;
    // Microphone mute preserves unrelated approved playback. Other controls cancel it locally.
    if (type !== 'input.mute') {
      outputBlocked = !requestsOutput;
      outputAfterGeneration = type.startsWith('input.teaching.')
        ? (session?.generation ?? null)
        : null;
    }
    if (!connection?.send(type, payload, independent))
      message = wording(
        'Connection unavailable. Reconnect when ready.',
        'Die Verbindung ist nicht verfügbar. Verbinde dich erneut, wenn du bereit bist.',
      );
  }
  function photoAction(action: ActivityAction) {
    if (!photo) return;
    control('input.photo.action', {
      instanceId: photo.instanceId,
      expectedRevision: photo.revision,
      action,
    });
  }
  function finishActivity() {
    if (session?.teaching) control('input.teaching.finish');
    else photoAction({ type: 'activity.leave' });
  }
  function connect() {
    const epoch = ++connectionEpoch;
    conversation?.stop();
    conversation = null;
    connectionLanguage = null;
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
          conversation?.stop();
          clearConversation();
          text = '';
          outputBlocked = true;
          replyBlocked = true;
          audio?.cancel();
        }
      },
      onError: (value) => {
        if (epoch === connectionEpoch) {
          conversation?.stop();
          message = german
            ? 'Die Verbindung ist nicht verfügbar. Das Mikrofon ist aus. Bitte verbinde dich erneut.'
            : value;
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
        if (
          value &&
          (message === 'Allow microphone access when your browser asks.' ||
            message === 'Erlaube den Mikrofonzugriff, wenn dein Browser danach fragt.')
        )
          message = '';
      },
      (value) => {
        conversation?.suspend();
        message = german
          ? 'Die Verbindung ist nicht verfügbar. Das Mikrofon ist aus. Bitte verbinde dich erneut.'
          : value;
      },
      (value) => {
        speaking = value;
      },
      {
        automatic: PUBLIC_LEMMI_AUTO_TURN_END,
        silenceMs: PUBLIC_LEMMI_END_SILENCE_MS,
        onSubmitted: (token) => conversation?.submitted(token),
        onPlaybackCompleted: (token) => conversation?.playbackCompleted(token),
        onTiming: PUBLIC_LEMMI_SPEECH_DIAGNOSTICS
          ? (timing) => console.info('Lemmi browser speech timing', JSON.stringify(timing))
          : undefined,
      },
    );
    if (assignment)
      conversation = new BrowserConversation(
        connection,
        audio,
        assignment.deviceId,
        (enabled) => {
          conversationEnabled = enabled;
        },
        (value) => {
          message = value;
        },
      );
    connection.connect();
  }
  function startListening() {
    if (preview || !connected) return;
    if (!speechAvailable) {
      if (!session || session.phase === 'ended') control('input.start', {}, true);
      else if (session.phase === 'paused') control('input.resume');
      message = wording(
        'Microphone unavailable. Choose Type instead.',
        'Das Mikrofon ist nicht verfügbar. Wähle Stattdessen schreiben.',
      );
      return;
    }
    outputBlocked = false;
    replyBlocked = false;
    outputAfterGeneration = null;
    message = wording(
      'Allow microphone access when your browser asks.',
      'Erlaube den Mikrofonzugriff, wenn dein Browser danach fragt.',
    );
    controlsDialog?.close();
    void conversation?.start();
  }
  function microphoneAction() {
    if (session?.micMuted || (!conversationEnabled && !listening)) startListening();
    else control('input.mute', { muted: true });
  }
  function resumeConversation() {
    // Typing is an explicit capture-off choice, including its Resume control.
    if (typingDialog?.open || replyDialog?.open || exitGate?.isOpen()) control('input.resume');
    else startListening();
  }
  async function useTyping() {
    conversation?.stop();
    audio?.cancel();
    controlsDialog?.close();
    typingDialog.showModal();
    const epoch = connectionEpoch;
    const id = session?.id;
    if (!ownsEndpoint || !session || session.phase === 'ended') return;
    const current = () => epoch === connectionEpoch && session?.id === id && ownsEndpoint;
    const currentPhase = () => session?.phase;
    const until = async (phase: string[]) => {
      const deadline = Date.now() + 3000;
      while (current() && session && !phase.includes(session.phase) && Date.now() < deadline)
        await new Promise((resolve) => setTimeout(resolve, 25));
      return current() && !!session && phase.includes(session.phase);
    };
    if (!['ready', 'waiting', 'paused'].includes(session.phase)) {
      control('input.pause');
      if (!(await until(['paused', 'ended'])) || currentPhase() === 'ended') return;
    }
    if (session?.phase === 'paused' && current()) control('input.resume');
  }
  let exitGate = $state<{ requestExit: () => void; isOpen: () => boolean }>(null!);
  let controlsDialog = $state<HTMLDialogElement>(null!);
  let typingDialog = $state<HTMLDialogElement>(null!);
  let replyDialog = $state<HTMLDialogElement>(null!);
  let navigationAllowed = false;
  function prepareExit() {
    conversation?.stop();
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
    conversation?.stop();
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
    conversation?.stop();
    audio?.cancel();
    outputBlocked = false;
    replyBlocked = false;
    outputAfterGeneration = null;
    reply = '';
    if (connection?.send('input.text', { text: text.trim(), language })) {
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
        } else if (!disposed && !result.ok)
          message = german
            ? 'Die Anfrage ist nicht verfügbar. Bitte versuche es erneut.'
            : result.error.message;
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
    setupDisposed = false;
    setupMounted = true;
    const background = () => {
      if (document.visibilityState === 'hidden') {
        conversation?.stop();
        audio?.cancel();
        if (connected && ownsEndpoint && session && session.phase !== 'ended')
          control('input.pause');
      }
    };
    const leaving = () => {
      conversation?.stop();
      audio?.cancel();
      connection?.close();
    };
    document.addEventListener('visibilitychange', background);
    window.addEventListener('pagehide', leaving);
    return () => {
      setupDisposed = true;
      setupMounted = false;
      setupEpoch++;
      conversation?.stop();
      document.removeEventListener('visibilitychange', background);
      window.removeEventListener('pagehide', leaving);
      connectionEpoch++;
      audio?.close();
      connection?.close();
    };
  });
</script>

{#snippet safetyControls()}
  <div
    class="safety-controls"
    aria-label={wording('Session safety controls', 'Sicherheitssteuerung')}
  >
    <button
      aria-label={session?.phase === 'paused'
        ? wording('Resume conversation', 'Gespräch fortsetzen')
        : 'Pause'}
      onclick={() => (session?.phase === 'paused' ? resumeConversation() : control('input.pause'))}
      disabled={!session ||
        session.phase === 'ended' ||
        (session.phase === 'paused' && !ownsEndpoint)}
      >{session?.phase === 'paused' ? wording('Resume', 'Weiter') : 'Pause'}</button
    >
    <button onclick={() => control('input.stop')} disabled={!session || session.phase === 'ended'}
      >{wording('Stop', 'Stopp')}</button
    >
    <button
      onclick={() => control('input.help')}
      disabled={!connected || !session || session.phase === 'ended'}
      >{wording('Get help', 'Hilfe holen')}</button
    >
  </div>
{/snippet}

<section
  lang={language}
  class="conversation-screen"
  class:photo-story={!!photo && photo.phase !== 'ended'}
  class:has-activity={activityActive}
  aria-labelledby="conversation-title"
>
  <h1 id="conversation-title" class="sr-only">
    {wording('Talk with Lemmi', 'Mit Lemmi sprechen')}
  </h1>
  <ConversationExit
    bind:this={exitGate}
    {language}
    prepare={prepareExit}
    beforeExit={pauseBeforeExit}
    exited={leaveConversation}
    controls={safetyControls}
  />
  {@render safetyControls()}
  <div class="companion-scene">
    <div class="scene-portrait">
      {#if photo && photo.phase !== 'ended' && photo.currentAssetId}
        {#key [assignment?.deviceId, session?.id, session?.leaseId, session?.profileRevision, session?.privacyRevision, session?.policyRevision, photo.instanceId, photo.currentAssetId].join(':')}
          <ScopedPhoto
            assetId={photo.currentAssetId}
            loaded={() => {
              photoLoadError = false;
            }}
            failed={() => {
              photoLoadError = true;
              audio?.cancel();
              if (ownsEndpoint && session?.phase !== 'paused') control('input.pause');
            }}
          />
        {/key}
      {/if}
      <div class="scene-art">
        {#if currentProfile}
          <AvatarArt
            avatarId={currentProfile.avatarId}
            animated
            talking={avatarTalking}
            thinking={session?.phase === 'processing'}
          />
        {:else}<p role="status">
            {setupState === 'loading'
              ? wording('Loading your companion…', 'Lemmi wird geladen…')
              : wording(
                  'Your companion is unavailable. Try the profile connection again.',
                  'Lemmi ist nicht verfügbar. Versuche die Profilverbindung erneut.',
                )}
          </p>{/if}
      </div>
      <div class="caption-anchor" class:empty={!visibleReply}>
        <SpeechBubble text={visibleReply} side readFull={() => replyDialog.showModal()} />
      </div>
    </div>
    <h2>
      {german && listening
        ? 'Ich höre zu'
        : german && session?.phase === 'processing'
          ? 'Lemmi überlegt…'
          : session?.phase === 'paused'
            ? wording('Take your time', 'Lass dir Zeit')
            : session?.phase === 'ended'
              ? wording('Here when you need me', 'Ich bin da, wenn du mich brauchst')
              : wording('Ready when you are', 'Bereit, wenn du es bist')}
    </h2>
    <button
      class="capture-state"
      aria-live="polite"
      aria-label={listening
        ? wording('Finish speaking', 'Sprechen beenden')
        : wording('Open voice controls', 'Sprachsteuerung öffnen')}
      onclick={() => {
        if (listening) {
          audio?.finish();
        } else controlsDialog.showModal();
      }}
    >
      {listening
        ? wording(
            'Listening — tap to finish speaking',
            'Ich höre zu — tippen, um das Sprechen zu beenden',
          )
        : speaking || session?.phase === 'speaking'
          ? wording('Microphone off — Lemmi is speaking', 'Mikrofon aus — Lemmi spricht')
          : session?.phase === 'processing'
            ? wording('Microphone off — Lemmi is thinking', 'Mikrofon aus — Lemmi überlegt')
            : conversationEnabled
              ? wording(
                  'Microphone off — preparing the next turn',
                  'Mikrofon aus — nächster Beitrag wird vorbereitet',
                )
              : session?.micMuted
                ? wording('Microphone muted', 'Mikrofon stummgeschaltet')
                : wording('Microphone off', 'Mikrofon aus')} · {wording('Camera off', 'Kamera aus')}
    </button>
    {#if assignment && session && session.phase !== 'ended' && ownsEndpoint}
      <div
        class="voice-actions"
        aria-label={wording('Microphone and typing', 'Mikrofon und Schreiben')}
      >
        <button
          onclick={microphoneAction}
          disabled={!connected ||
            !speechAvailable ||
            photoBlocksConversation ||
            (!conversationEnabled && !listening && !['ready', 'waiting'].includes(session.phase))}
          >{session.micMuted || (!conversationEnabled && !listening)
            ? wording('Start listening', 'Zuhören starten')
            : wording('Mute microphone', 'Mikrofon stummschalten')}</button
        >
        <button onclick={() => void useTyping()} disabled={!connected}
          >{wording('Type instead', 'Stattdessen schreiben')}</button
        >
      </div>
    {/if}
  </div>
  <div class="conversation-panel">
    {#if assignment}
      {#if !connected && !preview}<p role="status">
          {wording('Connection unavailable.', 'Die Verbindung ist nicht verfügbar.')}
        </p>
        <button onclick={connect} disabled={busy}>{wording('Reconnect', 'Erneut verbinden')}</button
        >{/if}
      {#if !session || session.phase === 'ended'}
        <p>{wording('Start when you are ready.', 'Starte, wenn du bereit bist.')}</p>
        <button onclick={startListening} disabled={!connected}
          >{wording('Start conversation', 'Gespräch starten')}</button
        >
      {:else if !ownsEndpoint}<p>
          {german
            ? 'Ein anderes Gerät ist aktiv.'
            : `The ${session.endpoint === 'robot' ? 'robot' : 'other browser'} is active.`}
        </p>
        <button onclick={() => control('input.handoff')} disabled={!connected}
          >{wording('Use this browser', 'Diesen Browser verwenden')}</button
        >
      {:else}
        {#if german}<p>
            Wir können auf Deutsch miteinander sprechen. Aktivitäten auf Deutsch sind noch nicht
            verfügbar.
          </p>
        {:else if !activityActive}<ActivityVoicePhrases
            teaching={teachingAvailable}
            photos={photoAvailable}
            voice={!preview && speechAvailable}
            compact
          />{/if}
        {#if session.teaching}<p class="active-mode">
            Teach Lemmi · {session.teaching.choosingTopic
              ? 'Choose a topic'
              : (session.teaching.topicLabel ?? 'No eligible topics')}
          </p>
          <div class="topic-choices" aria-label="Teaching topics">
            {#each session.teaching.choices ?? [] as choice (choice.entityId)}
              <button
                onclick={() => control('input.teaching.select', { entityId: choice.entityId })}
                disabled={!connected ||
                  session.phase === 'paused' ||
                  session.teaching.phase === 'unavailable'}
                aria-pressed={session.teaching.entityId === choice.entityId}>{choice.label}</button
              >
            {/each}
          </div>
        {/if}
        {#if photo && photo.phase !== 'ended'}<p class="active-mode">
            Photo Story · Say “Next photo” or “Back to conversation”.
          </p>{/if}
        {#if activityActive}<button
            class="finish-activity"
            onclick={finishActivity}
            disabled={!connected}
          >
            {wording('Finish activity', 'Aktivität beenden')}
          </button>{/if}
      {/if}
    {:else if demoEnrollment}
      {#if setupState === 'loading'}
        <p role="status">{wording('Opening your conversation…', 'Dein Gespräch wird geöffnet…')}</p>
      {:else}
        <button onclick={() => void loadAssignedProfile()} disabled={busy}>
          {wording('Retry profile connection', 'Profilverbindung erneut versuchen')}
        </button>
      {/if}
    {/if}
    {#if photoLoadError}<p role="alert">
        The picture is unavailable. Pause or choose another activity.
      </p>{/if}
    {#if german && connected && !speechAvailable}<p role="status">
        Die deutsche Sprachausgabe ist gerade nicht verfügbar. Das Mikrofon bleibt aus. Du kannst
        stattdessen schreiben.
      </p>{/if}
    {#if message}<p class="connection-message" role="status">{message}</p>{/if}
  </div>
</section>

<dialog
  lang={language}
  bind:this={controlsDialog}
  class="conversation-dialog"
  aria-labelledby="controls-title"
>
  <div class="dialog-heading">
    <h2 id="controls-title">{wording('Voice controls', 'Sprachsteuerung')}</h2>
    <button
      class="secondary"
      aria-label={wording('Close voice controls', 'Sprachsteuerung schließen')}
      onclick={() => controlsDialog.close()}>✕</button
    >
  </div>
  <div
    class="conversation-controls"
    aria-label={wording('Conversation and safety controls', 'Gesprächs- und Sicherheitssteuerung')}
  >
    <button
      onclick={() => (session?.phase === 'paused' ? resumeConversation() : control('input.pause'))}
      disabled={!connected ||
        !session ||
        session.phase === 'ended' ||
        (session.phase === 'paused' && !ownsEndpoint)}
      >{session?.phase === 'paused'
        ? wording('Resume conversation', 'Gespräch fortsetzen')
        : 'Pause'}</button
    >
    <button
      onclick={() => control('input.stop')}
      disabled={!connected || !session || session.phase === 'ended'}
      >{wording('Stop', 'Stopp')}</button
    >
    <button
      onclick={() => control('input.mute', { muted: !session?.micMuted })}
      disabled={!connected || !ownsEndpoint || !session || session.phase === 'ended'}
      >{session?.micMuted
        ? wording('Unmute', 'Mikrofon freigeben')
        : wording('Mute mic', 'Mikrofon stummschalten')}</button
    >
    <button onclick={() => control('input.help')} disabled={!connected}
      >{wording('Get help', 'Hilfe holen')}</button
    >
    {#if listening}<button onclick={() => audio?.finish()}
        >{wording('Finish speaking', 'Fertig gesprochen')}</button
      >
    {:else}<button
        class="speak"
        onclick={() => {
          startListening();
        }}
        disabled={!connected ||
          !ownsEndpoint ||
          !speechAvailable ||
          !session ||
          photoBlocksConversation ||
          !['ready', 'waiting'].includes(session.phase)}>{wording('Speak now', 'Sprechen')}</button
      >{/if}
    <button
      onclick={() => {
        void useTyping();
      }}
      disabled={!assignment}>{wording('Type instead', 'Stattdessen schreiben')}</button
    >
  </div>
</dialog>

<dialog
  lang={language}
  bind:this={typingDialog}
  class="conversation-dialog"
  aria-labelledby="typing-title"
>
  <div class="dialog-heading">
    <h2 id="typing-title">{wording('Type to Lemmi', 'An Lemmi schreiben')}</h2>
    <button
      class="secondary"
      aria-label={wording('Close typing', 'Texteingabe schließen')}
      onclick={() => typingDialog.close()}>✕</button
    >
  </div>
  {@render safetyControls()}
  <form onsubmit={sendText}>
    <label for="participant-text"
      >{wording('Your message or activity phrase', 'Deine Nachricht')}</label
    >
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
        !['ready', 'waiting'].includes(session.phase)}>{wording('Send', 'Senden')}</button
    >
    {#if preview}<p>
        Local visual preview. Voice and conversation services are not connected.
      </p>{/if}
  </form>
</dialog>
<dialog
  lang={language}
  bind:this={replyDialog}
  class="conversation-dialog"
  aria-labelledby="reply-title"
>
  <div class="dialog-heading">
    <h2 id="reply-title">{wording('Lemmi’s reply', 'Lemmis Antwort')}</h2>
    <button
      class="secondary"
      aria-label={wording('Close reply', 'Antwort schließen')}
      onclick={() => replyDialog.close()}>✕</button
    >
  </div>
  {@render safetyControls()}
  <p>{reply || session?.teaching?.prompt}</p>
  {#if transcript.length}
    <section aria-label={wording('This conversation', 'Dieses Gespräch')}>
      <h3>{wording('This conversation', 'Dieses Gespräch')}</h3>
      {#each transcript as turn}
        <p>
          <strong>{turn.speaker === 'participant' ? wording('You', 'Du') : 'Lemmi'}</strong>: {turn.text}
        </p>
      {/each}
    </section>
  {/if}
</dialog>

<style>
  .voice-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
  }
  .voice-actions button {
    min-height: 48px;
    margin: 0;
    padding: 8px 12px;
    font-size: 18px;
  }
  @media (max-width: 700px) {
    .companion-scene .scene-art {
      width: min(300px, 60vw, 28dvh);
      height: min(300px, 60vw, 28dvh);
    }
  }
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
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: safe center;
    gap: 12px;
    padding: 52px 20px 16px;
    background:
      linear-gradient(#fffaf066, #fffaf066),
      #fbf3df url('/images/surfaces/conversation-meadow-v1.png') center/cover no-repeat;
    color: #22331f;
  }
  .companion-scene {
    flex: none;
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
  .caption-anchor.empty {
    visibility: hidden;
  }
  .topic-choices {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
  }
  .topic-choices button,
  .finish-activity {
    min-height: 48px;
    margin: 0;
    padding: 10px 18px;
    font-size: 20px;
  }
  .finish-activity {
    position: fixed;
    bottom: max(12px, env(safe-area-inset-bottom));
    left: 50%;
    transform: translateX(-50%);
    z-index: 3;
    width: max-content;
    max-width: calc(100vw - 40px);
    border: 2px solid #526b43;
    background: #fffdf7;
    color: #22331f;
    box-shadow: 0 4px 16px #263b2126;
  }
  .conversation-screen.has-activity {
    padding-bottom: 84px;
  }
  .scene-art {
    width: min(360px, 68vw, 40dvh);
    height: min(360px, 68vw, 40dvh);
    flex: none;
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
    flex: none;
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
  .connection-message {
    font-size: 12px;
    line-height: 1.3;
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
  textarea {
    width: 100%;
    padding: 10px;
    margin: 12px 0;
    font: inherit;
  }
  .photo-story {
    justify-content: flex-start;
    padding-top: 80px;
    overflow-y: auto;
  }
  .photo-story .companion-scene h2 {
    display: none;
  }
  .photo-story .scene-portrait {
    display: grid;
    grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
    align-items: center;
    gap: 12px;
    width: min(760px, 100%);
  }
  .photo-story .scene-art {
    width: 100%;
    height: min(280px, 25dvh);
  }
  .photo-story .caption-anchor {
    position: static;
    grid-column: 1 / -1;
    width: 100%;
    height: 130px;
    overflow: auto;
  }
  @media (max-width: 800px) {
    .capture-state {
      min-height: 72px;
      line-height: 20px;
    }
    .topic-choices button {
      font-size: 18px;
      padding: 8px 12px;
    }
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
      height: 130px;
      overflow: auto;
      min-height: 112px;
    }
    .scene-portrait .scene-art {
      width: min(220px, 52vw, 24dvh);
      height: min(220px, 52vw, 24dvh);
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
      min-height: 72px;
      padding: 4px;
    }
  }
</style>
