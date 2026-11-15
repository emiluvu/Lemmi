<script lang="ts">
  import { onMount } from 'svelte';
  import type { ParticipantProfile } from '@lemmi/contracts';
  let {
    live = false,
    profile,
    deviceId,
  }: { live?: boolean; profile?: ParticipantProfile; deviceId?: string } = $props();
  import { VoiceClient, type VoiceState } from '#lib/voice-client.ts';
  import ActivityVoicePhrases from './ActivityVoicePhrases.svelte';
  import TeachingChoices from './VoiceTeachingChoices.svelte';
  import AvatarArt from './AvatarArt.svelte';
  import SpeechBubble from './SpeechBubble.svelte';
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
    language: 'en',
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
  const language = $derived(voice.ready ? voice.language : (profile?.language ?? 'en'));
  const german = $derived(language === 'de');
  const wording = (en: string, de: string) => (german ? de : en);
  const active = $derived(!!voice.session && voice.session.phase !== 'ended');
  const paused = $derived(voice.session?.phase === 'paused');
  const canSpeak = $derived(
    active &&
      !!voice.session &&
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
      if (!voice.audio) {
        startup = null;
        return;
      }
      if (live || !active) {
        startup = 'session';
        client.command('start');
      } else {
        startup = null;
      }
    } else if (startup === 'session' && active && voice.session?.phase === 'ready') {
      startup = null;
    }
  });
  async function start() {
    if (!voice.connected) {
      startup = 'connecting';
      await client.connect();
    } else if (!active) {
      startup = 'session';
      client.command('start');
    }
  }
  function control(type: string) {
    startup = null;
    client.command(type.replace(/^input\./, ''));
  }
</script>

<section
  class="voice-teaching"
  lang={language}
  aria-label={wording('Talk with Lemmi', 'Mit Lemmi sprechen')}
>
  <div class="avatar">
    <AvatarArt
      avatarId={profile?.avatarId ?? 'lemming'}
      animated
      talking={voice.playing}
      thinking={voice.session?.phase === 'processing'}
    />
  </div>
  {#if voice.playing && voice.reply}<SpeechBubble text={voice.reply} />{/if}
  <p class="disclosure">
    {wording('Fictional', 'Fiktives Profil')}
    {profile?.preferredName ?? 'Alex'} · {wording('English voice demo', 'Deutsches Gespräch')} · {wording(
      'Camera off',
      'Kamera aus',
    )}
  </p>
  {#if !voice.session?.teaching}
    <h1>{wording('Talk with Lemmi', 'Mit Lemmi sprechen')}</h1>
    {#if german}<p>
        Wir können auf Deutsch miteinander sprechen. Aktivitäten auf Deutsch sind noch nicht
        verfügbar.
      </p>{:else}<p>Lemmi offers a topic. Tell Lemmi about it in your own words.</p>{/if}
    {#if !german}<p>
        Use Speak now to choose an activity or reply. A short pause sends your words. Unmute alone
        keeps listening off. Pause, Stop and mute remain available.
      </p>{:else}<p>
        Wähle „Sprechen“. Eine kurze Pause sendet deine Worte. Mikrofon freigeben startet das
        Zuhören nicht. Pause, Stopp und Mikrofon stummschalten bleiben verfügbar.
      </p>{/if}
    {#if !german}<p class="disclosure">
        Audio goes to the team backend for speech recognition. Text goes to the external AI
        provider. This demo saves no conversation recording or journal excerpt.
      </p>{:else}<p class="disclosure">
        Sprache wird auf dem Teamserver erkannt. Text geht an den externen KI-Anbieter. Diese Demo
        speichert keine Gesprächsaufnahme und keine Gesprächsauszüge.
      </p>{/if}
    {#if !german}<ActivityVoicePhrases
        teaching={voice.teaching || !voice.connected}
        photos={false}
        voice={voice.connected && voice.audio}
      />{/if}
    {#if !active}<button onclick={start} disabled={!configured || !!startup || paused}>
        {startup
          ? wording('Connecting…', 'Verbindung wird hergestellt…')
          : wording('Connect conversation', 'Gespräch verbinden')}
      </button>{:else}
      <div class="controls" aria-label={wording('Microphone controls', 'Mikrofonsteuerung')}>
        {#if voice.listening}<button onclick={() => client.done()}
            >{wording('Finish speaking', 'Fertig gesprochen')}</button
          >
        {:else}<button disabled={!canSpeak} onclick={() => client.speak()}
            >{wording('Speak now', 'Sprechen')}</button
          >{/if}
      </div>
    {/if}
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
    <div class="controls" aria-label={wording('Microphone controls', 'Mikrofonsteuerung')}>
      {#if voice.listening}<button onclick={() => client.done()}
          >{wording('Finish speaking', 'Fertig gesprochen')}</button
        >
      {:else}<button disabled={!canSpeak} onclick={() => client.speak()}
          >{wording('Speak now', 'Sprechen')}</button
        >{/if}
      {#if !voice.automaticReplies && !paused && voice.session.communicationSupport.preset !== 'quiet'}
        <button disabled={!canSpeak} onclick={() => client.startConversation()}
          >{wording('Continue conversation', 'Gespräch fortsetzen')}</button
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
    <div class="controls sticky" aria-label={wording('Session controls', 'Gesprächssteuerung')}>
      <button onclick={() => control(paused ? 'resume' : 'pause')}
        >{paused ? wording('Resume to ready', 'Weiter') : 'Pause'}</button
      >
      <button onclick={() => control('stop')}>{wording('Stop', 'Stopp')}</button>
      <button onclick={() => control(voice.session?.micMuted ? 'unmute' : 'mute')}
        >{voice.session?.micMuted
          ? wording('Unmute (microphone stays off)', 'Mikrofon freigeben (bleibt aus)')
          : wording('Mute microphone', 'Mikrofon stummschalten')}</button
      >
      <button onclick={() => control('help')}>{wording('Ask for help', 'Hilfe holen')}</button>
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
