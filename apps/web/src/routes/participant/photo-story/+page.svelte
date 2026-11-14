<script lang="ts">
  import { onMount } from 'svelte';
  import { clients } from '#lib/clients.ts';
  import { speechPcm, pcmBase64 } from '#lib/speech-pcm.ts';
  import {
    type ActivityView,
    type ActivityAction,
    type SessionSnapshot,
    type SessionCommand,
    type PhotoStoryCommand,
    type PhotoStoryResult,
    type OperationOutput,
    type Result,
  } from '@lemmi/contracts';
  let status = $state<OperationOutput<'photoStory.status'> | null>(null);
  let session = $state<SessionSnapshot | null>(null);
  let activity = $state<ActivityView | null>(null);
  let reply = $state('');
  let message = $state('');
  let typed = $state('');
  let busy = $state(false);
  let listening = $state(false);
  let playing = $state(false);
  let imageFailed = $state(false);
  let epoch = 0;
  let stream: MediaStream | null = null;
  let audioContext: AudioContext | null = null;
  let output: AudioBufferSourceNode | null = null;
  let captureContext: AudioContext | null = null;
  let worklet: AudioWorkletNode | null = null;
  let chunks: Float32Array[] = [];
  let timer: ReturnType<typeof setInterval> | undefined;
  let started = 0;
  let lastVoice = 0;
  let sampleCount = 0;
  const images: Record<string, string> = {
    'photo-story-garden': '/photo-story-garden.svg',
    'photo-story-park': '/photo-story-park.svg',
  };
  function value<T>(result: Result<T>): T {
    if (!result.ok) throw new Error(result.error.message);
    return result.data;
  }
  function stopCapture() {
    listening = false;
    clearInterval(timer);
    timer = undefined;
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    worklet?.disconnect();
    worklet = null;
    void captureContext?.close();
    captureContext = null;
  }
  function stopLocal() {
    epoch++;
    stopCapture();
    chunks.forEach((chunk) => chunk.fill(0));
    chunks = [];
    if (output) {
      output.onended = null;
      output.buffer?.getChannelData(0).fill(0);
      try {
        output.stop();
      } catch {}
      output = null;
    }
    playing = false;
    busy = false;
  }
  async function run(work: () => Promise<void>) {
    busy = true;
    message = '';
    try {
      await work();
    } catch (error) {
      message = error instanceof Error ? error.message : 'Service unavailable';
    } finally {
      busy = false;
    }
  }
  onMount(() => {
    void run(async () => {
      status = value(await clients.photoStory.status());
      session = status.session;
      activity = status.activity;
      if (session && ['listening', 'processing', 'speaking'].includes(session.phase))
        await control({ type: 'pause' });
    });
    const hidden = () => {
      if (document.hidden && session && session.phase !== 'ended') void control({ type: 'pause' });
    };
    document.addEventListener('visibilitychange', hidden);
    const off = () => {
      stopLocal();
      if (session)
        void clients.session.command({
          sessionId: session.id,
          expectedGeneration: session.generation,
          commandId: crypto.randomUUID(),
          action: { type: 'pause' },
        });
    };
    window.addEventListener('pagehide', off);
    return () => {
      stopLocal();
      void audioContext?.close();
      reply = '';
      typed = '';
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('pagehide', off);
    };
  });
  $effect(() => {
    const id = session?.id;
    if (!id) return;
    return clients.session.subscribe({ sessionId: id }, (result) => {
      if (!result.ok && result.error.code === 'NOT_FOUND') {
        stopLocal();
        session = null;
        activity = null;
        reply = '';
        typed = '';
        message = 'The demo server restarted. Start a fresh session.';
        return;
      }
      if (result.ok && (!session || result.data.generation >= session.generation)) {
        if (['paused', 'ended'].includes(result.data.phase)) {
          stopLocal();
          reply = '';
          typed = '';
        }
        if (listening && (!result.data.captureGrant || result.data.micMuted)) stopCapture();
        session = result.data;
      }
    });
  });
  async function turn(input: PhotoStoryCommand['input']): Promise<PhotoStoryResult | null> {
    if (!session || !activity) throw new Error('Start Photo Story first');
    const token = epoch;
    const result = await clients.photoStory.turn({
      commandId: crypto.randomUUID(),
      sessionId: session.id,
      instanceId: activity.instanceId,
      expectedGeneration: session.generation,
      expectedRevision: activity.revision,
      input,
    });
    if (token !== epoch) return null;
    const next = value(result);
    session = next.session;
    if (next.reply) reply = next.reply.text;
    if (next.notice) message = next.notice;
    return next;
  }
  async function prepareAudio() {
    audioContext ??= new AudioContext();
    await audioContext.resume();
  }
  async function speak(turnId: string, repeat = false) {
    if (!status?.tts) {
      message = 'Local TTS is not configured. The response is available as text.';
      return;
    }
    const token = epoch;
    const result = await turn(repeat ? { type: 'repeat' } : { type: 'synthesize', turnId });
    if (!result?.audio || token !== epoch) return;
    await prepareAudio();
    const bytes = Uint8Array.from(atob(result.audio.pcmBase64), (char) => char.charCodeAt(0));
    const view = new DataView(bytes.buffer);
    const buffer = audioContext!.createBuffer(1, bytes.length / 2, result.audio.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < channel.length; i++) channel[i] = view.getInt16(i * 2, true) / 32768;
    bytes.fill(0);
    const source = audioContext!.createBufferSource();
    output = source;
    source.buffer = buffer;
    source.connect(audioContext!.destination);
    source.onended = () => {
      channel.fill(0);
      if (epoch !== token) return;
      output = null;
      playing = false;
      void turn({ type: 'playback_end', turnId: result.audio!.turnId }).catch((error) => {
        message = error.message;
      });
    };
    playing = true;
    source.start();
  }
  async function converse(input: PhotoStoryCommand['input']) {
    const result = await turn(input);
    if (result?.reply && result.session.phase !== 'paused' && result.session.phase !== 'ended')
      await speak(result.reply.turnId);
  }
  async function start() {
    await run(async () => {
      stopLocal();
      await prepareAudio();
      session = value(
        await clients.session.start({
          profileId: 'profile-alex',
          commandId: crypto.randomUUID(),
          endpoint: 'browser',
        }),
      );
      activity = value(
        await clients.activities.start({
          sessionId: session.id,
          commandId: crypto.randomUUID(),
          activityId: 'photo_album',
          packId: 'alex-photo-story-demo',
          packVersion: 1,
        }),
      );
      await photoAction({ type: 'photo.talk' }, false);
    });
  }
  async function photoAction(action: ActivityAction, wrap = true) {
    const work = async () => {
      if (['photo.next', 'photo.previous', 'photo.select'].includes(action.type))
        imageFailed = false;
      stopLocal();
      reply = '';
      typed = '';
      if (!session || !activity) return;
      activity = value(
        await clients.activities.submit({
          sessionId: session.id,
          instanceId: activity.instanceId,
          expectedRevision: activity.revision,
          commandId: crypto.randomUUID(),
          action,
        }),
      );
      session = value(await clients.session.get({ sessionId: session.id }));
      if (action.type === 'photo.talk') await converse({ type: 'opening' });
    };
    if (wrap) await run(work);
    else await work();
  }
  async function control(action: SessionCommand['action']) {
    if (action.type === 'mute') {
      if (action.muted) {
        stopCapture();
        chunks.forEach((chunk) => chunk.fill(0));
        chunks = [];
        epoch++;
      }
    } else stopLocal();
    await run(async () => {
      if (!session) return;
      session = value(
        await clients.session.command({
          sessionId: session.id,
          expectedGeneration: session.generation,
          commandId: crypto.randomUUID(),
          action,
        }),
      );
      if (activity)
        activity = value(
          await clients.activities.view({ sessionId: session.id, instanceId: activity.instanceId }),
        );
      if (['paused', 'ended'].includes(session.phase)) {
        reply = '';
        typed = '';
      }
    });
  }
  async function finishCapture(send = true) {
    if (!listening || !session) return;
    const rate = captureContext!.sampleRate;
    const grant = session.captureGrant;
    const captured = chunks;
    chunks = [];
    stopCapture();
    if (!send || !grant || !captured.length) {
      captured.forEach((chunk) => chunk.fill(0));
      await control({ type: 'turn_end' });
      message = 'Take your time. We can just look.';
      return;
    }
    await run(async () => {
      const pcm = speechPcm(captured, rate);
      captured.forEach((chunk) => chunk.fill(0));
      const encoded = pcmBase64(pcm);
      pcm.fill(0);
      await converse({ type: 'audio', captureTurnId: grant.turnId, pcmBase64: encoded });
    });
  }
  async function listen() {
    await run(async () => {
      if (!session || session.micMuted)
        throw new Error('Unmute, then choose Speak now. Unmute alone does not listen.');
      await prepareAudio();
      session = value(
        await clients.session.command({
          sessionId: session.id,
          expectedGeneration: session.generation,
          commandId: crypto.randomUUID(),
          action: { type: 'speak' },
        }),
      );
      const token = epoch;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
          video: false,
        });
        if (token !== epoch) {
          stopCapture();
          return;
        }
        captureContext = new AudioContext();
        await captureContext.resume();
        await captureContext.audioWorklet.addModule('/photo-story-capture.js');
        if (token !== epoch || session?.phase !== 'listening' || session.micMuted) {
          stopCapture();
          return;
        }
        const source = captureContext.createMediaStreamSource(stream);
        worklet = new AudioWorkletNode(captureContext, 'lemmi-capture');
        const mute = captureContext.createGain();
        mute.gain.value = 0;
        source.connect(worklet);
        worklet.connect(mute);
        mute.connect(captureContext.destination);
        chunks = [];
        sampleCount = 0;
        started = Date.now();
        lastVoice = 0;
        listening = true;
        worklet.port.onmessage = (event) => {
          if (!listening || token !== epoch || !captureContext) return;
          const block = event.data as Float32Array;
          if (sampleCount + block.length > captureContext.sampleRate * 20) {
            void finishCapture(lastVoice > 0);
            return;
          }
          sampleCount += block.length;
          chunks.push(block);
          if (
            Math.sqrt(block.reduce((sum, value) => sum + value * value, 0) / block.length) > 0.015
          )
            lastVoice = Date.now();
        };
        timer = setInterval(() => {
          if (!lastVoice && Date.now() - started > 15000) void finishCapture(false);
          else if (lastVoice && Date.now() - lastVoice > 4000) void finishCapture();
        }, 100);
      } catch (error) {
        stopCapture();
        await control({ type: 'turn_end' });
        throw error;
      }
    });
  }
</script>

<svelte:head><title>Photo Story · Lemmi</title></svelte:head>
<h1>Photo Story with Alex</h1>
<p>
  Fictional sample profile and illustrations. Camera off. Responses use captions; images are not
  analyzed.
</p>
<p>
  Conversation: {status?.chat === 'reviewed_demo'
    ? 'Reviewed offline demo responses — no LLM'
    : status?.chat === 'openrouter'
      ? 'Configured OpenRouter model'
      : 'Unavailable'}. Local STT: {status?.stt ? 'configured' : 'unavailable'}. Local TTS: {status?.tts
    ? 'configured'
    : 'unavailable'}.
</p>
<p>
  Audio is processed by local Whisper/Piper only while requested. Responses are not saved. In
  OpenRouter mode, permitted text goes to the external model.
</p>
{#if !status?.enabled}<p>Start this local demo with <code>bun run photo-story</code>.</p>{/if}
<p role="status" aria-live="polite">{message || (busy ? 'Working…' : 'Take your time.')}</p>
{#if !session || session.phase === 'ended'}<button
    disabled={!status?.enabled || busy}
    onclick={start}>Start Photo Story</button
  >{/if}
{#if activity?.activityId === 'photo_album'}
  {#if activity.currentAssetId && images[activity.currentAssetId]}
    <img
      class="story-photo"
      src={images[activity.currentAssetId]}
      alt={activity.caption ?? 'Approved fictional scene'}
      onerror={() => {
        stopLocal();
        message = 'Picture unavailable. Choose another picture or finish.';
        imageFailed = true;
        void photoAction({ type: 'photo.just_look' }).finally(() => {
          message = 'Picture unavailable. Choose another picture or finish.';
        });
      }}
    />
  {/if}
  <p>{activity.caption ?? 'No approved caption available.'}</p>
  <p aria-live="polite">
    {listening
      ? 'Microphone listening — choose Done or Pause to stop.'
      : playing
        ? 'Lemmi is speaking. Microphone off.'
        : 'Microphone off.'}
  </p>
  {#if reply}<div class="card" aria-live="polite">{reply}</div>{/if}
  <div class="controls">
    {#each activity.choices as choice}<button
        disabled={choice.action.type === 'photo.talk' &&
          (busy || listening || playing || imageFailed)}
        onclick={() => photoAction(choice.action)}>{choice.label}</button
      >{/each}
    <button
      disabled={busy ||
        !reply ||
        playing ||
        listening ||
        !status?.tts ||
        session?.phase === 'paused'}
      onclick={() =>
        run(async () => {
          await prepareAudio();
          await speak('', true);
        })}>Repeat response</button
    >
  </div>
  {#if session && session.phase !== 'ended'}
    <div class="controls">
      <button
        disabled={busy ||
          listening ||
          playing ||
          !status?.stt ||
          session.micMuted ||
          activity.viewingMode !== 'talk' ||
          session.phase === 'paused'}
        onclick={listen}>Speak now</button
      >
      {#if listening}<button onclick={() => finishCapture()}>Done speaking</button><button
          onclick={() => finishCapture(false)}>Skip answer</button
        >{/if}
      <button onclick={() => control({ type: 'mute', muted: !session!.micMuted })}
        >{session.micMuted ? 'Unmute microphone' : 'Mute microphone'}</button
      >
      <button onclick={() => control({ type: session?.phase === 'paused' ? 'resume' : 'pause' })}
        >{session.phase === 'paused' ? 'Resume to ready' : 'Pause'}</button
      >
      <button onclick={() => control({ type: 'stop' })}>Stop session</button>
      <button
        onclick={() => {
          stopLocal();
          reply = '';
          typed = '';
          void run(async () => {
            if (!session) return;
            const result = await clients.help.create({
              profileId: 'profile-alex',
              commandId: crypto.randomUUID(),
              mode: 'real',
            });
            session = value(await clients.session.get({ sessionId: session.id }));
            message = result.ok ? result.data.message : result.error.message;
          });
        }}>Get help</button
      >
    </div>
    <form
      onsubmit={(event) => {
        event.preventDefault();
        const text = typed;
        typed = '';
        void run(async () => {
          await prepareAudio();
          await converse({ type: 'text', text });
        });
      }}
    >
      <label for="answer">Type instead</label><input
        id="answer"
        bind:value={typed}
        maxlength="1000"
        autocomplete="off"
        disabled={busy ||
          listening ||
          playing ||
          activity.viewingMode !== 'talk' ||
          session.phase === 'paused'}
      />
      <button
        disabled={busy ||
          listening ||
          playing ||
          !typed.trim() ||
          activity.viewingMode !== 'talk' ||
          session.phase === 'paused'}>Send answer</button
      >
    </form>
  {/if}
{/if}

<style>
  .story-photo {
    display: block;
    width: 100%;
    max-width: 850px;
    border-radius: 1rem;
  }
  .controls {
    margin: 1rem 0;
  }
  input {
    width: min(100%, 35rem);
    padding: 0.8rem;
    font: inherit;
  }
  button {
    min-height: 48px;
  }
  form {
    margin-top: 1.5rem;
  }
</style>
