<script lang="ts">
  import { onMount } from 'svelte';
  import type { ParticipantProfile } from '@lemmi/contracts';
  let {
    live = false,
    profile,
    deviceId,
  }: { live?: boolean; profile?: ParticipantProfile; deviceId?: string } = $props();
  import { VoiceClient, type VoiceState } from '#lib/voice-client.ts';
  import TeachingChoices from './VoiceTeachingChoices.svelte';
  import AvatarArt from './AvatarArt.svelte';
  let client: VoiceClient;
  let confirmStop: (() => void) | null = null;
  export async function stopForExit(): Promise<boolean> {
    startup = null;
    if (!active) {
      client.close();
      return true;
    }
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        confirmStop = null;
        resolve(false);
      }, 4000);
      confirmStop = () => {
        clearTimeout(timeout);
        confirmStop = null;
        resolve(true);
      };
      client.command('stop');
    });
  }
  let configured = $state(false);
  let checked = $state(false);
  let startup = $state<'connecting' | 'session' | null>(null);
  let voice = $state<VoiceState>({
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
  const active = $derived(!!voice.session && voice.session.phase !== 'ended');
  const paused = $derived(voice.session?.phase === 'paused');
  const canSpeak = $derived(
    active &&
      !!voice.session?.teaching?.entityId &&
      !voice.session.micMuted &&
      ['ready', 'waiting'].includes(voice.session.phase) &&
      !voice.pending &&
      !voice.playing &&
      !voice.listening,
  );
  onMount(() => {
    client = new VoiceClient(
      (value) => {
        voice = value;
        if (value.session?.phase === 'ended') confirmStop?.();
        if (!value.connected && !value.ready && value.message.includes('stopped')) startup = null;
      },
      live ? deviceId : undefined,
    );
    if (live) {
      configured = !!deviceId;
      checked = true;
    } else
      void fetch('/voice-config')
        .then((r) => r.json())
        .then((value) => {
          configured = value.configured === true;
        })
        .catch(() => {})
        .finally(() => {
          checked = true;
        });
    const background = () => {
      if (document.visibilityState === 'hidden') {
        startup = null;
        client.background();
      }
    };
    const leaving = () => client.close();
    document.addEventListener('visibilitychange', background);
    window.addEventListener('pagehide', leaving);
    return () => {
      client.close();
      document.removeEventListener('visibilitychange', background);
      window.removeEventListener('pagehide', leaving);
    };
  });
  $effect(() => {
    if (startup === 'connecting' && voice.ready) {
      if (!voice.audio || !voice.teaching) {
        startup = null;
        return;
      }
      if (live || !active) {
        startup = 'session';
        client.command('start');
      } else {
        startup = null;
        client.startTeachingConversation();
      }
    } else if (startup === 'session' && active && voice.session?.phase === 'ready') {
      startup = null;
      client.startTeachingConversation();
    }
  });
  async function start() {
    if (!voice.connected) {
      startup = 'connecting';
      await client.connect();
    } else if (!active) {
      startup = 'session';
      client.command('start');
    } else client.startTeachingConversation();
  }
  function control(type: string) {
    startup = null;
    client.command(type.replace(/^input\./, ''));
  }
</script>

<section class="voice-teaching" aria-label="Teach Lemmi conversation">
  <div class="avatar">
    <AvatarArt avatarId={profile?.avatarId ?? 'lemming'} animated talking={voice.playing} />
  </div>
  <p class="disclosure">
    Fictional {profile?.preferredName ?? 'Alex'} · English voice demo · Camera off
  </p>
  {#if !voice.session?.teaching}
    <h1>Teach Lemmi</h1>
    <p>Lemmi offers a topic. Tell Lemmi about it in your own words.</p>
    <p>
      After Lemmi asks a question, the microphone opens for your reply. A short pause sends it.
      Pause, Stop or mute ends automatic listening. Unmute alone keeps listening off.
    </p>
    <p class="disclosure">
      Audio goes to the team backend for speech recognition. Text goes to the external AI provider.
      This demo saves no conversation recording or journal excerpt.
    </p>
    <button
      onclick={start}
      disabled={!configured ||
        !!startup ||
        (voice.connected && (!voice.ready || !voice.audio || !voice.teaching)) ||
        paused}
    >
      {startup ? 'Starting Teach Lemmi…' : 'Start Teach Lemmi'}
    </button>
  {:else}
    <TeachingChoices
      session={voice.session}
      available={voice.teaching}
      speechAvailable={voice.audio}
      disabled={!voice.connected}
      listening={voice.listening}
      reply={voice.reply}
      automaticReplies={voice.automaticReplies}
      command={control}
    />
    <div class="controls" aria-label="Microphone controls">
      {#if voice.listening}<button onclick={() => client.done()}>Finish speaking</button>
      {:else}<button disabled={!canSpeak} onclick={() => client.speak()}>Speak now</button>{/if}
      {#if !voice.automaticReplies && !paused && voice.session.communicationSupport.preset !== 'quiet'}
        <button disabled={!canSpeak} onclick={() => client.startConversation()}
          >Continue conversation</button
        >
      {/if}
    </div>
  {/if}
  {#if checked && !configured}<p role="status">
      The private voice connection is not configured on this local server. See the voice demo setup
      guide.
    </p>{/if}
  <p role="status" aria-live="polite">{voice.message}</p>
  {#if active}
    <div class="controls sticky" aria-label="Session controls">
      <button onclick={() => control(paused ? 'resume' : 'pause')}
        >{paused ? 'Resume to ready' : 'Pause'}</button
      >
      <button onclick={() => control('stop')}>Stop</button>
      <button onclick={() => control(voice.session?.micMuted ? 'unmute' : 'mute')}
        >{voice.session?.micMuted ? 'Unmute (microphone stays off)' : 'Mute microphone'}</button
      >
      <button onclick={() => control('help')}>Ask for help</button>
    </div>
  {/if}
</section>

<style>
  .voice-teaching {
    max-width: 760px;
    margin: auto;
    text-align: center;
  }
  .avatar {
    width: min(420px, 85vw);
    aspect-ratio: 1;
    margin: auto;
  }
  .disclosure {
    font-size: 16px;
  }
  .controls {
    justify-content: center;
    flex-wrap: wrap;
  }
  .sticky {
    background: #fffaf0;
    padding: 12px;
    border-radius: 20px;
  }
</style>
