<script lang="ts">
  import { onMount } from 'svelte';
  import {
    createHttpTransport,
    type Operation,
    type OperationInput,
    type OperationOutput,
    type SessionSnapshot,
    type ActivityView,
    type ActivityAction,
    type SpeechOutputStart,
  } from '@lemmi/contracts';
  import { speechPcm, pcmBase64 } from '#lib/speech-pcm.ts';
  const transport = createHttpTransport('mock');
  async function call<K extends Operation>(
    op: K,
    input: OperationInput<K>,
  ): Promise<OperationOutput<K>> {
    const result = await transport.call(op, input);
    if (!result.ok) throw new Error(result.error.message);
    return result.data;
  }
  let session = $state<SessionSnapshot | null>(null),
    activity = $state<ActivityView | null>(null);
  let reply = $state(''),
    notice = $state(''),
    typed = $state(''),
    busy = $state(false),
    listening = $state(false),
    playing = $state(false);
  let chatMode = $state('loading'),
    speechEnabled = $state(false);
  let epoch = 0,
    stream: MediaStream | null = null,
    capture: AudioContext | null = null,
    worklet: AudioWorkletNode | null = null,
    output: AudioContext | null = null;
  let source: AudioBufferSourceNode | null = null,
    chunks: Float32Array[] = [],
    timer: ReturnType<typeof setTimeout> | undefined;
  let uploadTimer: ReturnType<typeof setInterval> | undefined,
    uploadChain = Promise.resolve(),
    tail = new Uint8Array(0),
    sent = 0,
    heardSpeech = false;
  let captureScope: OperationInput<'speech.end'> | null = null,
    resolvePlayback: (() => void) | null = null;
  const images: Record<string, string> = {
    'photo-story-garden': '/photo-story-garden.svg',
    'photo-story-park': '/photo-story-park.svg',
  };
  const id = () => crypto.randomUUID();
  const scope = () => {
    if (!session) throw new Error('Start Photo Story first');
    return { sessionId: session.id, expectedGeneration: session.generation };
  };
  function stopLocal() {
    epoch++;
    clearTimeout(timer);
    clearInterval(uploadTimer);
    tail.fill(0);
    tail = new Uint8Array(0);
    resolvePlayback?.();
    resolvePlayback = null;
    listening = false;
    playing = false;
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    worklet?.disconnect();
    worklet = null;
    void capture?.close();
    capture = null;
    chunks.forEach((c) => c.fill(0));
    chunks = [];
    if (source) {
      source.buffer?.getChannelData(0).fill(0);
      source.onended = null;
      try {
        source.stop();
      } catch {}
      source = null;
    }
    void output?.close();
    output = null;
  }
  async function refresh() {
    if (!session) return;
    session = await call('session.get', { sessionId: session.id });
    if (activity)
      activity = await call('activities.view', {
        sessionId: session.id,
        instanceId: activity.instanceId,
      });
  }
  async function safe(work: () => Promise<void>) {
    try {
      await work();
    } catch (error) {
      stopLocal();
      notice =
        error instanceof Error
          ? error.message
          : 'Service unavailable. You can type, skip, or stop.';
      try {
        await refresh();
      } catch {
        /* retain explicit connection failure */
      }
    } finally {
      busy = false;
    }
  }
  async function start() {
    stopLocal();
    reply = '';
    notice = '';
    busy = true;
    await safe(async () => {
      session = await call('session.start', {
        profileId: 'profile-alex',
        endpoint: 'browser',
        commandId: id(),
      });
      activity = await call('activities.start', {
        sessionId: session.id,
        commandId: id(),
        activityId: 'photo_album',
        packId: 'alex-photo-story-demo',
        packVersion: 1,
      });
      await action({ type: 'photo.talk' }, false);
      await ask('photo_opening');
    });
  }
  async function action(value: ActivityAction, opening = true) {
    stopLocal();
    reply = '';
    if (!activity || !session) return;
    activity = await call('activities.submit', {
      sessionId: session.id,
      instanceId: activity.instanceId,
      commandId: id(),
      expectedRevision: activity.revision,
      action: value,
    });
    await refresh();
    if (opening && value.type === 'photo.skip') {
      await action({ type: 'photo.talk' }, false);
      await ask('photo_opening');
    }
  }
  async function control(type: 'stop' | 'pause' | 'resume') {
    stopLocal();
    busy = false;
    await safe(async () => {
      session = await call('session.command', { ...scope(), commandId: id(), action: { type } });
      await refresh();
      if (type === 'stop') {
        reply = '';
        notice = 'Photo Story has ended. Choose an activity when you are ready.';
      }
    });
  }
  async function receipt(
    meta: SpeechOutputStart,
    status: 'started' | 'progress' | 'completed' | 'failed',
    playedChunks: number,
  ) {
    session = await call('speech.receipt', {
      ...scope(),
      turnId: meta.turnId,
      leaseId: meta.leaseId,
      streamId: meta.streamId,
      status,
      playedChunks,
    });
  }
  async function play() {
    const token = epoch;
    const first = await call('speech.output', { sessionId: scope().sessionId });
    if (token !== epoch) return;
    const meta = first.metadata;
    if (!meta) {
      notice = 'Audio is unavailable; the response is shown as text.';
      return;
    }
    playing = true;
    output ??= new AudioContext();
    await output.resume();
    await receipt(meta, 'started', 0);
    let current = first,
      played = 0;
    while (token === epoch && played < meta.chunkCount) {
      if (!current.chunks.length)
        throw new Error('Speech output expired. Read the text or choose Repeat.');
      {
        if (token !== epoch) return;
        const parts = current.chunks.map((chunk) =>
          Uint8Array.from(atob(chunk.data), (c) => c.charCodeAt(0)),
        );
        const bytes = new Uint8Array(parts.reduce((size, p) => size + p.length, 0));
        let at = 0;
        for (const part of parts) {
          bytes.set(part, at);
          at += part.length;
          part.fill(0);
        }
        const view = new DataView(bytes.buffer);
        const buffer = output.createBuffer(1, bytes.length / 2, meta.sampleRate);
        for (let i = 0; i < buffer.length; i++)
          buffer.getChannelData(0)[i] = view.getInt16(i * 2, true) / 32768;
        await new Promise<void>((resolve) => {
          resolvePlayback = resolve;
          source = output!.createBufferSource();
          source.buffer = buffer;
          source.connect(output!.destination);
          source.onended = () => {
            buffer.getChannelData(0).fill(0);
            resolvePlayback = null;
            resolve();
          };
          source.start();
        });
        bytes.fill(0);
        if (token !== epoch) return;
        played += current.chunks.length;
        await receipt(meta, played === meta.chunkCount ? 'completed' : 'progress', played);
      }
      if (played < meta.chunkCount)
        current = await call('speech.output', { sessionId: scope().sessionId });
    }
    playing = false;
    source = null;
    await refresh();
  }
  async function ask(purpose?: 'photo_opening' | 'photo_repeat') {
    const token = epoch,
      text = typed.trim();
    typed = '';
    busy = true;
    const result = await call('speech.speak', {
      ...scope(),
      commandId: id(),
      text: purpose ? 'Photo Story' : text,
      language: 'en',
      ...(purpose ? { purpose } : {}),
    });
    if (token !== epoch) return;
    session = result.session;
    reply = result.kind === 'reply' ? result.reply.text : '';
    await refresh();
    if (session.phase === 'ended') {
      notice = 'Photo Story has ended. Choose an activity when ready.';
      return;
    }
    await play();
    busy = false;
  }
  async function beginCapture() {
    stopLocal();
    await safe(async () => {
      if (!session || session.phase === 'ended') return;
      if (session.micMuted)
        session = await call('session.command', {
          ...scope(),
          commandId: id(),
          action: { type: 'mute', muted: false },
        });
      session = await call('speech.start', { ...scope(), commandId: id(), language: 'en' });
      const token = epoch;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { channelCount: 1, echoCancellation: true },
        });
        if (token !== epoch) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        capture = new AudioContext();
        await capture.audioWorklet.addModule('/photo-story-capture.js');
        worklet = new AudioWorkletNode(capture, 'lemmi-capture');
        capture.createMediaStreamSource(stream).connect(worklet);
        const gain = capture.createGain();
        gain.gain.value = 0;
        worklet.connect(gain).connect(capture.destination);
        listening = true;
        chunks = [];
        sent = 0;
        heardSpeech = false;
        tail = new Uint8Array(0);
        uploadChain = Promise.resolve();
        const grant = session!.captureGrant!;
        captureScope = {
          ...scope(),
          turnId: grant.turnId,
          leaseId: grant.leaseId,
          streamId: grant.streamId,
          chunkCount: 1,
        };
        worklet.port.onmessage = (e) => {
          if (listening) {
            chunks.push(e.data);
            if ((e.data as Float32Array).some((v) => Math.abs(v) > 0.012)) heardSpeech = true;
          }
        };
        const rate = capture.sampleRate;
        uploadTimer = setInterval(() => {
          uploadChain = uploadChain
            .then(() => flushCapture(rate, token))
            .catch(() => {
              stopLocal();
              notice = 'Speech connection unavailable. You can type, skip, or stop.';
              void call('session.command', {
                ...scope(),
                commandId: id(),
                action: { type: 'mute', muted: true },
              });
            });
        }, 100);
        timer = setTimeout(() => void done(), 17000);
      } catch (error) {
        stopLocal();
        session = await call('session.command', {
          ...scope(),
          commandId: id(),
          action: { type: 'mute', muted: true },
        });
        throw error;
      }
    });
  }
  async function flushCapture(rate: number, token: number, final = false) {
    if (token !== epoch || !captureScope) return;
    const parts = chunks;
    chunks = [];
    const pcm = speechPcm(parts, rate);
    parts.forEach((p) => p.fill(0));
    const merged = new Uint8Array(tail.length + pcm.length);
    merged.set(tail);
    merged.set(pcm, tail.length);
    tail.fill(0);
    pcm.fill(0);
    const full = Math.floor(merged.length / 640) * 640;
    tail = merged.slice(full);
    const sendBytes = final ? Math.ceil(merged.length / 640) * 640 : full;
    for (let offset = 0; offset < sendBytes; offset += 640) {
      if (token !== epoch) {
        merged.fill(0);
        return;
      }
      const frame = new Uint8Array(640);
      frame.set(merged.subarray(offset, offset + 640));
      const { chunkCount, ...stream } = captureScope;
      await call('speech.chunk', {
        ...stream,
        chunkIndex: sent++,
        encoding: 'pcm_s16le',
        data: pcmBase64(frame),
      });
      frame.fill(0);
    }
    merged.fill(0);
    if (final) {
      tail.fill(0);
      tail = new Uint8Array(0);
    }
  }
  async function done() {
    if (!listening || !capture || !session?.captureGrant) return;
    const rate = capture.sampleRate,
      grant = session.captureGrant;
    clearTimeout(timer);
    clearInterval(uploadTimer);
    listening = false;
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    worklet?.disconnect();
    void capture.close();
    capture = null;
    busy = true;
    const token = epoch;
    await safe(async () => {
      await uploadChain;
      if (token !== epoch) return;
      if (!heardSpeech) {
        chunks.forEach((c) => c.fill(0));
        chunks = [];
        tail.fill(0);
        await call('session.command', {
          ...scope(),
          commandId: id(),
          action: { type: 'mute', muted: true },
        });
        notice = 'Take your time. We can repeat, skip, or simply look.';
        await refresh();
        return;
      }
      await flushCapture(rate, token, true);
      const result = await call('speech.end', {
        ...scope(),
        turnId: grant.turnId,
        leaseId: grant.leaseId,
        streamId: grant.streamId,
        chunkCount: sent,
      });
      if (token !== epoch) return;
      session = result.session;
      reply = result.kind === 'reply' ? result.reply.text : '';
      await refresh();
      await play();
    });
  }
  onMount(() => {
    void safe(async () => {
      const status = await call('photoStory.status', {});
      session = status.session;
      activity = status.activity;
      chatMode = status.chat;
      speechEnabled = status.speech;
    });
    return () => {
      stopLocal();
      if (session && session.phase !== 'ended')
        void call('session.command', { ...scope(), commandId: id(), action: { type: 'pause' } });
    };
  });
</script>

<svelte:head><title>Photo Story — Lemmi</title></svelte:head>
<main>
  <a href="/participant">Activity menu</a>
  <h1>Photo Story with Alex</h1>
  <p class="demo">
    Local fictional rehearsal. Captions only; image pixels are not analyzed. Default chat is a
    reviewed demo; OpenRouter is an explicit server setting. Current chat: {chatMode}. Voice: {speechEnabled
      ? 'real local STT/TTS'
      : 'unavailable; text fallback'}.
  </p>
  {#if !session || session.phase === 'ended'}<button onclick={() => void start()}
      >Start Photo Story</button
    >{/if}
  {#if activity?.activityId === 'photo_album' && activity.currentAssetId}<img
      src={images[activity.currentAssetId]}
      alt={activity.caption ?? 'Approved scene'}
      onerror={() => {
        stopLocal();
        void safe(() => action({ type: 'photo.just_look' }, false));
        notice = 'Photo unavailable. You can skip it.';
      }}
    />
    <p>{activity.caption}</p>{/if}
  <p aria-live="polite">{reply}</p>
  <p role="status">
    {listening
      ? 'Listening — choose Done when ready.'
      : playing
        ? 'Lemmi is speaking.'
        : notice || 'You may take your time or simply look.'}
  </p>
  {#if session && session.phase !== 'ended'}<p>
      Communication support: {session.communicationSupport.preset}.
    </p>
    <div class="controls">
      <button
        disabled={busy || playing || listening || session.phase === 'paused'}
        onclick={() =>
          void safe(async () => {
            await action({ type: 'photo.talk' }, false);
            await ask('photo_opening');
          })}>Talk / continue</button
      >
      <button
        onclick={() => {
          stopLocal();
          void safe(async () => {
            await call('help.create', { profileId: 'profile-alex', commandId: id(), mode: 'real' });
          });
        }}>Get help</button
      >
      <button
        disabled={busy || playing || session.phase === 'paused'}
        onclick={() => void beginCapture()}>Speak now</button
      ><button disabled={!listening} onclick={() => void done()}>Done speaking</button>
      <button
        disabled={busy || listening || session.phase === 'paused'}
        onclick={() => void safe(() => ask('photo_repeat'))}>Repeat</button
      >
      <button onclick={() => void safe(() => action({ type: 'photo.skip' }))}
        >Skip / next photo</button
      ><button onclick={() => void safe(() => action({ type: 'photo.just_look' }, false))}
        >Just look</button
      >
      <button onclick={() => void control(session?.phase === 'paused' ? 'resume' : 'pause')}
        >{session.phase === 'paused' ? 'Resume' : 'Pause'}</button
      >
      <button
        onclick={() => {
          stopLocal();
          void safe(async () => {
            session = await call('session.command', {
              ...scope(),
              commandId: id(),
              action: { type: 'mute', muted: true },
            });
          });
        }}>Mute microphone</button
      >
      <button class="stop" onclick={() => void control('stop')}>Stop Photo Story</button>
    </div>
    <form
      onsubmit={(e) => {
        e.preventDefault();
        void safe(async () => {
          if (activity?.activityId === 'photo_album' && activity.viewingMode !== 'talk')
            await action({ type: 'photo.talk' }, false);
          await ask();
        });
      }}
    >
      <label for="answer">Or type your answer</label><input
        id="answer"
        bind:value={typed}
        maxlength="1000"
        autocomplete="off"
      /><button
        disabled={!typed.trim() || busy || playing || listening || session.phase === 'paused'}
        >Send answer</button
      >
    </form>
  {/if}
  <p>
    Spoken answers are not saved. Photo selections and skips are in the <a href="/caregiver"
      >local caregiver rehearsal view</a
    >. This demo is not production caregiver authorization.
  </p>
</main>

<style>
  main {
    max-width: 850px;
    margin: 2rem auto;
    padding: 1rem;
    font: 1.2rem/1.6 system-ui;
  }
  img {
    width: 100%;
    max-height: 360px;
    object-fit: contain;
    border-radius: 18px;
    background: #f4f7f0;
  }
  button,
  input {
    font: inherit;
    padding: 0.65rem 1rem;
    margin: 0.3rem;
    border: 2px solid #315b49;
    border-radius: 12px;
  }
  button {
    background: #eef6ed;
    color: #183c2b;
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.5;
  }
  .controls {
    display: flex;
    flex-wrap: wrap;
  }
  .stop {
    background: #ffe1dc;
    color: #712b24;
  }
  label {
    display: block;
  }
  .demo {
    font-size: 1rem;
    background: #fff1cb;
    padding: 0.8rem;
  }
  input {
    max-width: 95%;
  }
</style>
