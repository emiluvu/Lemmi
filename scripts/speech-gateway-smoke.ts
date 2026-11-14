// Local isolated authority + verified TLS/WSS. No production pairing/DB/session or hardware.
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createOpenRouterAdapter,
  openRouterConfig,
  localSpeechConfig,
  createLocalSpeechAdapters,
  type ChatAdapter,
  type SpeechAdapters,
} from '@lemmi/server';
import {
  ServerEventSchema,
  DeviceEventSchema,
  ok,
  type SessionSnapshot,
  type SpeechOutputStart,
} from '@lemmi/contracts';
import { startControlGateway } from '../apps/realtime/src/control';
import { captureFixture } from './speech-fixture';
import { readBounded } from '../packages/server/src/adapters/types';

const liveLlm = process.argv.includes('--live-llm');
const liveSpeech = process.argv.includes('--live-speech');
const turnsAt = process.argv.indexOf('--turns');
const turns = turnsAt < 0 ? 1 : Number(process.argv[turnsAt + 1]);
if (!Number.isInteger(turns) || turns < 1 || turns > 20)
  throw new Error('Choose 1–20 explicit turns');
const timings: { turn: number; sttMs: number; llmMs: number; ttsMs: number; totalMs: number }[] =
  [];
const directory = await mkdtemp(join(tmpdir(), 'lemmi-voice-smoke-'));
const counters = {
  sttMs: 0,
  llmMs: 0,
  ttsMs: 0,
  llmCalls: 0,
  sttCalls: 0,
  ttsCalls: 0,
  playedChunks: 0,
  outputBytes: 0,
  textReplies: 0,
};
const began = performance.now();
let gateway: ReturnType<typeof startControlGateway> | undefined;
let proxy: ReturnType<typeof Bun.serve<{ upstream: WebSocket }>> | undefined;
let ws: WebSocket | undefined, heartbeat: ReturnType<typeof setInterval> | undefined;
let playbackTimer: ReturnType<typeof setTimeout> | undefined;
let fixture: Uint8Array | undefined;
let failed: Error | undefined;
function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
let model = 'fixture';
const modelResponses: {
  status: number;
  finishReason?: string;
  textChars?: number;
  completionTokens?: number;
  reasoningTokens?: number;
}[] = [];
try {
  let chat: ChatAdapter = {
    async complete(input) {
      return ok({ text: 'Hello. We can enjoy the garden.', language: input.language });
    },
  };
  let speech: SpeechAdapters = {
    stt: {
      async transcribe() {
        return ok({ text: 'Hello. The garden is quiet today.', language: 'en' });
      },
    },
    tts: {
      async synthesize() {
        return ok({
          pcm: new Uint8Array(882 * (process.argv.includes('--long-output') ? 300 : 12)),
          sampleRate: 22050,
          encoding: 'pcm_s16le',
          channels: 1,
          language: 'en',
        });
      },
    },
  };
  if (liveLlm) {
    const selected = openRouterConfig();
    if (!selected.ok) throw new Error(selected.error.message);
    model = selected.data.model;
    chat = createOpenRouterAdapter(selected.data, async (url, init) => {
      const response = await fetch(url, init);
      const metadata: (typeof modelResponses)[number] = { status: response.status };
      if (response.ok) {
        const copy = response.clone();
        try {
          const value = JSON.parse(
            new TextDecoder().decode(await readBounded(new Response(copy.body), 65536)),
          );
          const reason = value.choices?.[0]?.finish_reason;
          metadata.finishReason = ['stop', 'length', 'tool_calls', 'content_filter'].includes(
            reason,
          )
            ? reason
            : 'other';
          metadata.textChars =
            typeof value.choices?.[0]?.message?.content === 'string'
              ? value.choices[0].message.content.length
              : 0;
          const tokens = (v: unknown) =>
            typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 1_000_000
              ? v
              : undefined;
          metadata.completionTokens = tokens(value.usage?.completion_tokens);
          metadata.reasoningTokens = tokens(
            value.usage?.completion_tokens_details?.reasoning_tokens,
          );
        } catch {
          /* No provider content/error is logged. */
        }
      }
      modelResponses.push(metadata);
      return response;
    });
  }
  if (liveSpeech) {
    const selected = localSpeechConfig();
    if (
      !selected.ok ||
      selected.data.sttBackend !== 'local-http' ||
      selected.data.ttsBackend !== 'local-http'
    )
      throw new Error('Configure both private local speech adapters');
    speech = createLocalSpeechAdapters(selected.data);
    const spoken = await speech.tts.synthesize(
      {
        text: 'Hello. The garden is quiet today.',
        language: 'en',
      },
      AbortSignal.timeout(20000),
    );
    check(spoken.ok, 'Synthetic input preparation failed');
    try {
      fixture = captureFixture(spoken.data, 250);
    } finally {
      spoken.data.pcm.fill(0);
    }
  } else fixture = new Uint8Array(640 * 2).fill(1);
  const originalChat = chat,
    originalSpeech = speech;
  chat = {
    async complete(input, signal) {
      counters.llmCalls++;
      const start = performance.now();
      try {
        return await originalChat.complete(input, signal);
      } finally {
        counters.llmMs += Math.round(performance.now() - start);
      }
    },
  };
  speech = {
    stt: {
      async transcribe(input, signal) {
        counters.sttCalls++;
        const start = performance.now();
        try {
          return await originalSpeech.stt.transcribe(input, signal);
        } finally {
          counters.sttMs += Math.round(performance.now() - start);
        }
      },
    },
    tts: {
      async synthesize(input, signal) {
        counters.ttsCalls++;
        const start = performance.now();
        try {
          return await originalSpeech.tts.synthesize(input, signal);
        } finally {
          counters.ttsMs += Math.round(performance.now() - start);
        }
      },
    },
  };
  const key = join(directory, 'key.pem'),
    cert = join(directory, 'cert.pem');
  const certificate = Bun.spawnSync(
    [
      'openssl',
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-keyout',
      key,
      '-out',
      cert,
      '-days',
      '1',
      '-subj',
      '/CN=localhost',
      '-addext',
      'subjectAltName=DNS:localhost,IP:127.0.0.1',
    ],
    { stdout: 'ignore', stderr: 'ignore' },
  );
  check(certificate.exitCode === 0, 'TLS fixture setup failed');
  const accessKey = crypto.randomUUID(),
    internalToken = crypto.randomUUID();
  proxy = Bun.serve<{ upstream: WebSocket }>({
    hostname: '127.0.0.1',
    port: 0,
    tls: { key: Bun.file(key), cert: Bun.file(cert) },
    async fetch(request, server) {
      if (new URL(request.url).pathname !== '/v1/device-stream')
        return new Response(null, { status: 404 });
      const headers = new Headers(request.headers);
      headers.set('host', new URL(origin).host);
      headers.set('x-forwarded-proto', 'https');
      const upstream = new WebSocket(`ws://127.0.0.1:${gateway!.server.port}/v1/device-stream`, {
        headers: Object.fromEntries(headers),
      });
      try {
        await new Promise<void>((resolve, reject) => {
          upstream.onopen = () => resolve();
          upstream.onerror = () => reject(new Error('Gateway connection failed'));
        });
        const upgraded = server.upgrade(request, { data: { upstream } });
        if (!upgraded) upstream.close();
        return upgraded ? undefined : new Response(null, { status: 400 });
      } catch {
        upstream.close();
        return new Response(null, { status: 502 });
      }
    },
    websocket: {
      open(socket) {
        socket.data.upstream.onmessage = (event) => socket.send(String(event.data));
        socket.data.upstream.onclose = (event) => socket.close(event.code, event.reason);
      },
      message(socket, message) {
        socket.data.upstream.send(message);
      },
      close(socket) {
        socket.data.upstream.close();
      },
    },
  });
  const origin = `https://127.0.0.1:${proxy.port}`;
  gateway = startControlGateway({
    publicOrigin: origin,
    internalToken,
    accessKey,
    port: 0,
    chatAdapter: chat,
    speech,
  });
  async function provision(action: string, input: unknown) {
    const response = await fetch(
      `http://127.0.0.1:${gateway!.server.port}/internal/control/${action}`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${internalToken}`, 'content-type': 'application/json' },
        body: JSON.stringify(input),
      },
    );
    const result = (await response.json()) as any;
    check(result.ok, 'Private fixture provisioning failed');
    return result.data;
  }
  const pair = await provision('pair', {
    actor: 'fictional-test-caregiver',
    input: {
      profileId: 'profile-alex',
      deviceId: 'stackchan-alex',
      commandId: crypto.randomUUID(),
    },
  });
  const claim = await provision('claim', {
    pairingId: pair.pairingId,
    code: pair.code,
    localConfirmed: true,
  });
  ws = new WebSocket(origin.replace('https:', 'wss:') + '/v1/device-stream', {
    headers: { authorization: `Bearer ${claim.credential}`, 'X-Lemmi-Access-Key': accessKey },
    tls: { ca: await Bun.file(cert).text() },
  });
  let sequence = 0,
    session: SessionSnapshot | null = null,
    ready = false,
    audioEnded = false;
  let output: SpeechOutputStart | null = null,
    receivedChunks = 0,
    queue = 0,
    playedThisTurn = 0;
  const send = (type: string, payload: unknown = {}, turnId: string | null = null) =>
    ws!.send(
      JSON.stringify(
        DeviceEventSchema.parse({
          protocol_version: 1,
          event_id: crypto.randomUUID(),
          session_id: session?.id ?? null,
          generation: session?.generation ?? 0,
          turn_id: turnId,
          sequence: sequence++,
          type,
          payload,
        }),
      ),
    );
  const receipt = (status: string) =>
    send(
      'audio.receipt',
      {
        leaseId: output!.leaseId,
        streamId: output!.streamId,
        status,
        playedChunks: playedThisTurn,
      },
      output!.turnId,
    );
  // Receipt behavior is explicitly simulated: no physical speaker is opened.
  function consume() {
    if (!queue || playbackTimer || failed) return;
    playbackTimer = setTimeout(() => {
      playbackTimer = undefined;
      queue--;
      counters.playedChunks++;
      playedThisTurn++;
      if (audioEnded && playedThisTurn === output!.chunkCount) receipt('completed');
      else if (playedThisTurn % 4 === 0) receipt('progress');
      consume();
    }, 20);
  }
  ws.onmessage = (event) => {
    try {
      const value = ServerEventSchema.parse(JSON.parse(String(event.data)));
      if (value.type === 'error')
        throw new Error(
          'Gateway rejected the speech rehearsal: ' +
            value.payload.code +
            ': ' +
            value.payload.message,
        );
      if (value.type === 'device.ready') {
        check(value.payload.audio !== false, 'Speech negotiation unavailable');
        ready = true;
      }
      if (value.type === 'state.changed') session = value.payload.session;
      if (value.type === 'response.text') counters.textReplies++;
      if (value.type === 'response.start') output = value.payload;
      if (value.type === 'audio.chunk') {
        check(
          output &&
            value.payload.streamId === output.streamId &&
            value.turn_id === output.turnId &&
            value.payload.chunkIndex === receivedChunks,
          'Invalid output stream order',
        );
        const bytes = Buffer.from(value.payload.data, 'base64');
        counters.outputBytes += bytes.length;
        bytes.fill(0);
        receivedChunks++;
        queue++;
        check(queue <= 4, 'Output exceeded negotiated playback window');
        if (receivedChunks === 1) receipt('started');
        consume();
      }
      if (value.type === 'audio.end') {
        check(
          output &&
            value.payload.chunkCount === receivedChunks &&
            value.payload.streamId === output.streamId,
          'Output ended incompletely',
        );
        audioEnded = true;
        if (playedThisTurn === output!.chunkCount) receipt('completed');
      }
      if (value.type === 'response.cancel') throw new Error('Speech rehearsal was interrupted');
    } catch (error) {
      failed = error instanceof Error ? error : new Error('Invalid speech event');
    }
  };
  const until = async (predicate: () => boolean, timeout = 25000) => {
    const deadline = Date.now() + timeout;
    while (!predicate()) {
      if (failed) throw failed;
      if (Date.now() >= deadline)
        throw new Error(
          'Gateway speech rehearsal timed out: ' +
            JSON.stringify({
              phase: session?.phase,
              playedThisTurn,
              receivedChunks,
              queue,
              audioEnded,
              expectedChunks: (output as SpeechOutputStart | null)?.chunkCount,
              connectionState: ws?.readyState,
            }),
        );
      await Bun.sleep(10);
    }
  };
  ws.onclose = (event) => {
    if (session?.phase !== 'ended')
      failed = new Error(
        'Rehearsal socket closed with code ' +
          event.code +
          ': ' +
          ([
            'Control rate limit',
            'Capture rate limit',
            'Control backpressure',
            'Heartbeat timeout',
            'Device access expired or revoked',
          ].includes(event.reason)
            ? event.reason
            : 'closed'),
      );
  };
  ws.onerror = () => {
    failed = new Error('Rehearsal socket connection error');
  };
  await until(() => ws!.readyState === WebSocket.OPEN);
  heartbeat = setInterval(() => {
    if (ws?.readyState === WebSocket.OPEN) send('heartbeat');
  }, 2000);
  send('device.hello', {
    firmwareVersion: 'synthetic-speech-rehearsal/0.1',
    cameraSupported: false,
    pettingSupported: false,
    audio: { encoding: 'pcm_s16le', sampleRate: 16000, channels: 1, frameMs: 20 },
    playback: { encoding: 'pcm_s16le', channels: 1, sampleRates: [22050] },
  });
  await until(() => ready);
  send('input.start');
  await until(() => session?.phase === 'ready');
  send('input.text', { text: 'Hello. Please greet me briefly.', language: 'en' });
  await until(() => counters.textReplies === 1 && session?.phase === 'waiting');
  send('input.mute', { muted: false });
  await until(() => session?.micMuted === false);
  for (let turn = 0; turn < turns; turn++) {
    const start = performance.now(),
      before = { ...counters };
    output = null;
    receivedChunks = 0;
    queue = 0;
    playedThisTurn = 0;
    audioEnded = false;
    send('input.speak', { language: 'en' });
    await until(() => session?.phase === 'listening');
    const grant = (session as SessionSnapshot | null)!.captureGrant!;
    for (let chunkIndex = 0; chunkIndex < fixture.length / 640; chunkIndex++) {
      send(
        'audio.chunk',
        {
          leaseId: grant.leaseId,
          streamId: grant.streamId,
          chunkIndex,
          encoding: 'pcm_s16le',
          data: Buffer.from(fixture.subarray(chunkIndex * 640, (chunkIndex + 1) * 640)).toString(
            'base64',
          ),
        },
        grant.turnId,
      );
      await Bun.sleep(20);
    }
    send(
      'audio.end',
      { leaseId: grant.leaseId, streamId: grant.streamId, chunkCount: fixture.length / 640 },
      grant.turnId,
    );
    await until(
      () =>
        audioEnded &&
        playedThisTurn === (output as SpeechOutputStart | null)?.chunkCount &&
        session?.phase === 'waiting',
      55000,
    );
    check(
      counters.textReplies === turn + 2 &&
        counters.sttCalls === turn + 1 &&
        counters.ttsCalls === turn + 1 &&
        counters.llmCalls === turn + 2,
      'Speech stages were skipped or replayed',
    );
    check(
      (session as SessionSnapshot | null)?.captureGrant === null,
      'Playback granted unintended capture',
    );

    timings.push({
      turn: turn + 1,
      sttMs: counters.sttMs - before.sttMs,
      llmMs: counters.llmMs - before.llmMs,
      ttsMs: counters.ttsMs - before.ttsMs,
      totalMs: Math.round(performance.now() - start),
    });
    if ((turn + 1) % 5 === 0 && turn + 1 < turns) {
      send('input.pause');
      await until(() => session?.phase === 'paused');
      send('input.resume');
      await until(() => session?.phase === 'ready');
      check((session as SessionSnapshot | null)?.captureGrant === null, 'Resume opened capture');
    }
  }
  send('input.stop');
  await until(() => session?.phase === 'ended');
  console.info(
    JSON.stringify({
      result: 'PASS',
      tlsVerified: true,
      liveLlm,
      liveSpeech,
      model,
      ...counters,
      modelResponses,
      turns,
      timings,
      totalMs: Math.round(performance.now() - began),
      playbackReceipts: 'simulated consumed chunks',
      hardwareOrSpeakerTested: false,
      rawAudioSaved: false,
      transcriptLogged: false,
      productionSessionModified: false,
    }),
  );
} catch (error) {
  const message = error instanceof Error ? error.message : 'Speech rehearsal failed';
  const safe = message.includes(process.env.OPENROUTER_API_KEY || '\u0000')
    ? 'Speech rehearsal failed'
    : message.slice(0, 300);
  console.error(
    JSON.stringify({
      result: 'FAIL',
      liveLlm,
      liveSpeech,
      model,
      ...counters,
      modelResponses,
      completedTurns: timings.length,
      error: safe,
      rawAudioSaved: false,
      transcriptLogged: false,
    }),
  );
  process.exitCode = 1;
} finally {
  if (heartbeat) clearInterval(heartbeat);
  if (playbackTimer) clearTimeout(playbackTimer);
  fixture?.fill(0);
  ws?.close();
  gateway?.stop();
  proxy?.stop(true);
  await rm(directory, { recursive: true, force: true });
}
