import {
  MockCoordinator,
  assertMockMode,
  localMockRequestAllowed,
  MOCK_TOKEN,
  SessionCoordinator,
} from '@lemmi/server';
import {
  DeviceEventSchema,
  ServerEventSchema,
  fail,
  operations,
  type ServerEvent,
  type Result,
} from '@lemmi/contracts';
import {
  controlConfig,
  openRouterConfig,
  createOpenRouterAdapter,
  conversationDecisionConfig,
  createOpenRouterDecisionAdapter,
} from '@lemmi/server';
import { startControlGateway } from './control';
import { dataConfig, openData } from '@lemmi/server';
import { photoStoryDemoPack, alexProfileDetail } from '@lemmi/activities';
import { reviewedPhotoDemo } from '../../../packages/server/src/adapters/photo-story-demo';
import {
  localSpeechConfig,
  createLocalSpeechAdapters,
  speechConcurrencyConfig,
} from '@lemmi/server';
function startMockGateway() {
  assertMockMode();
  const photoDemo = process.env.LEMMI_PHOTO_STORY_DEMO === '1';
  const llm =
    photoDemo && process.env.LEMMI_PHOTO_STORY_CHAT === 'openrouter' ? openRouterConfig() : null;
  if (llm && !llm.ok) throw new Error('OpenRouter mode requires private model/key configuration');
  const selected = photoDemo ? localSpeechConfig() : null;
  const speech =
    selected?.ok &&
    selected.data.sttBackend !== 'disabled' &&
    selected.data.ttsBackend !== 'disabled'
      ? createLocalSpeechAdapters(selected.data)
      : undefined;
  const coordinator = photoDemo
    ? new SessionCoordinator(
        'live',
        llm?.ok ? createOpenRouterAdapter(llm.data) : reviewedPhotoDemo(),
        speech,
        Date.now,
        undefined,
        {
          localOnly: true,
          profileId: 'profile-alex',
          pack: photoStoryDemoPack,
          availableAssetIds: ['photo-story-garden', 'photo-story-park'],
        },
      )
    : new MockCoordinator();
  if (photoDemo) coordinator.acceptPersistentProfile(alexProfileDetail);
  const sweep = setInterval(() => coordinator.sweepSpeech(), 250);
  sweep.unref();
  type SocketData = { lastSequence: number; outSequence: number; lastSeen: number; hello: boolean };
  const sockets = new Set<Bun.ServerWebSocket<SocketData>>();
  function emit(ws: Bun.ServerWebSocket<SocketData>, type: ServerEvent['type'], payload: unknown) {
    const session = coordinator.snapshot();
    ws.send(
      JSON.stringify(
        ServerEventSchema.parse({
          protocol_version: 1,
          event_id: crypto.randomUUID(),
          session_id: session?.id ?? null,
          turn_id: null,
          generation: session?.generation ?? 0,
          sequence: ws.data.outSequence++,
          type,
          payload,
        }),
      ),
    );
  }
  function error(ws: Bun.ServerWebSocket<SocketData>, code: string, message: string) {
    emit(ws, 'error', { code, message });
  }
  const broadcast = () => {
    for (const socket of sockets)
      if (socket.data.hello)
        emit(socket, 'state.changed', { mode: 'mock', session: coordinator.snapshot() });
  };
  const port = Number(process.env.GATEWAY_PORT ?? 3001);
  const server = Bun.serve<SocketData>({
    hostname: '127.0.0.1',
    port,
    maxRequestBodySize: 32768,
    async fetch(request, server) {
      const url = new URL(request.url);
      const peer = server.requestIP(request)?.address ?? null;
      if (!localMockRequestAllowed(request, peer))
        return Response.json(fail('FORBIDDEN', 'Local mock access only'), { status: 403 });
      if (request.headers.get('authorization') !== `Bearer ${MOCK_TOKEN()}`)
        return Response.json(fail('UNAUTHORIZED', 'Mock transport token required'), {
          status: 401,
        });
      if (url.pathname === '/v1/device-stream') {
        if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket')
          return new Response('WebSocket required', { status: 426 });
        if (sockets.size >= 1) return new Response('One fake device only', { status: 409 });
        return server.upgrade(request, {
          data: { lastSequence: -1, outSequence: 0, lastSeen: Date.now(), hello: false },
        })
          ? undefined
          : new Response('Upgrade failed', { status: 400 });
      }
      if (url.pathname === '/health')
        return Response.json({ mode: 'mock', speech: false, camera: false, notifications: false });
      if (request.method !== 'POST' || !url.pathname.startsWith('/internal/mock/'))
        return new Response('Not found', { status: 404 });
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return Response.json(fail('VALIDATION_ERROR', 'Invalid JSON'), { status: 400 });
      }
      const operation = url.pathname.slice('/internal/mock/'.length);
      if (
        !Object.hasOwn(operations, operation) ||
        !operations[operation as keyof typeof operations].input.safeParse(body).success
      )
        return Response.json(fail('VALIDATION_ERROR', 'Invalid local operation input'), {
          status: 400,
        });
      let result: Result<unknown>;
      if (operation === 'conversation.submit') result = await coordinator.submitText(body);
      else if (photoDemo && (operation === 'conversation.text' || operation === 'speech.speak'))
        result = await (operation === 'speech.speak'
          ? coordinator.speakText(body)
          : coordinator.submitText(body));
      else if (photoDemo && operation === 'speech.start')
        result = coordinator.requestCapture(body, [16000, 22050, 24000, 44100, 48000]);
      else if (photoDemo && operation === 'speech.chunk')
        result = coordinator.acceptCaptureChunk(body);
      else if (photoDemo && operation === 'speech.end')
        result = await coordinator.finishCapture(body);
      else if (photoDemo && operation === 'speech.receipt')
        result = coordinator.playbackReceipt(body);
      else if (photoDemo && operation === 'speech.output') {
        const scope = body as { sessionId?: string };
        if (scope?.sessionId !== coordinator.snapshot()?.id)
          result = fail('NOT_FOUND', 'Session not found');
        else {
          const metadata = coordinator.speechOutputInfo();
          const drained = coordinator.drainSpeechOutput();
          result = {
            ok: true as const,
            data: { metadata, chunks: drained?.chunks ?? [], ended: drained?.end ?? false },
          };
        }
      } else {
        result = coordinator.handle(operation, body);
        if (photoDemo && operation === 'photoStory.status' && result.ok)
          result = {
            ok: true,
            data: { ...(result.data as object), chat: llm?.ok ? 'openrouter' : 'reviewed_demo' },
          };
      }
      broadcast();
      return Response.json(result, {
        headers: { 'Cache-Control': 'no-store' },
        status: result.ok
          ? 200
          : result.error.code === 'UNAVAILABLE'
            ? 503
            : result.error.code === 'FORBIDDEN'
              ? 403
              : result.error.code === 'REVISION_CONFLICT'
                ? 409
                : 400,
      });
    },
    websocket: {
      maxPayloadLength: 4096,
      idleTimeout: 10,
      open(ws) {
        sockets.add(ws);
      },
      message(ws, message) {
        let raw: unknown;
        try {
          raw = JSON.parse(String(message));
        } catch {
          error(ws, 'VALIDATION_ERROR', 'Invalid event');
          return;
        }
        const parsed = DeviceEventSchema.safeParse(raw);
        if (!parsed.success) {
          error(ws, 'VALIDATION_ERROR', 'Invalid event shape');
          return;
        }
        const event = parsed.data;
        if (event.sequence <= ws.data.lastSequence) {
          error(ws, 'REVISION_CONFLICT', 'Stale event sequence');
          return;
        }
        if (!ws.data.hello && event.type !== 'device.hello') {
          ws.close(1008, 'Hello required');
          return;
        }
        const current = coordinator.snapshot();
        if (
          event.type !== 'device.hello' &&
          event.type !== 'heartbeat' &&
          event.type !== 'input.help' &&
          (!current || event.session_id !== current.id || event.generation !== current.generation)
        ) {
          error(ws, 'REVISION_CONFLICT', 'Reload current session');
          return;
        }
        ws.data.lastSequence = event.sequence;
        ws.data.lastSeen = Date.now();
        if (event.type === 'device.hello') {
          ws.data.hello = true;
          emit(ws, 'command.ack', { mode: 'mock', commandId: event.event_id, applied: true });
          broadcast();
          return;
        }
        if (event.type === 'heartbeat') {
          emit(ws, 'heartbeat', { mode: 'mock' });
          return;
        }
        if (event.type === 'input.help')
          coordinator.handle('help.create', {
            profileId: 'profile-alex',
            commandId: event.event_id,
            mode: 'simulation',
          });
        else if (
          (['input.stop', 'input.pause', 'input.resume', 'input.mute'].includes(event.type) ||
            event.type.startsWith('input.teaching.')) &&
          current
        ) {
          const action =
            event.type === 'input.mute' && 'muted' in event.payload
              ? { type: 'mute', muted: event.payload.muted }
              : event.type === 'input.teaching.select'
                ? { type: 'teaching.select', ...event.payload }
                : event.type === 'input.teaching.start'
                  ? { type: 'teaching.start', offerChoices: true }
                  : { type: event.type.slice(6) };
          const result = coordinator.handle('session.command', {
            commandId: event.event_id,
            sessionId: current.id,
            expectedGeneration: current.generation,
            action,
          });
          if (result.ok)
            emit(ws, 'command.ack', { mode: 'mock', commandId: event.event_id, applied: true });
          else error(ws, result.error.code, result.error.message);
        } else error(ws, 'UNAVAILABLE', 'Media/camera/health ingestion not implemented in starter');
        broadcast();
      },
      close(ws) {
        sockets.delete(ws);
        coordinator.disconnect();
        broadcast();
      },
    },
  });
  // A separate deadline prevents endless non-heartbeating fake clients. No hardware watchdog is claimed.
  const check = setInterval(() => {
    if (coordinator.sweepTeaching()) broadcast();
    for (const socket of sockets) {
      const ws = socket;
      if (Date.now() - ws.data.lastSeen > 6000) {
        coordinator.disconnect();
        ws.close(1001, 'Heartbeat timeout');
      }
    }
  }, 1000);
  function shutdown() {
    clearInterval(check);
    coordinator.disconnect();
    server.stop(true);
    process.exit(0);
  }
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  console.info(`Lemmi MOCK gateway: http://127.0.0.1:${server.port} (no live services)`);
}
if (process.env.LEMMI_MODE === 'live') {
  const llm = openRouterConfig();
  const decisions = conversationDecisionConfig();
  if (!decisions.ok) throw new Error(decisions.error.message);
  if (decisions.data && !llm.ok)
    throw new Error('Configure conversation before enabling decisions');
  let speech;
  if (process.env.LEMMI_SPEECH_ENABLED === '1') {
    const selected = localSpeechConfig();
    if (
      !selected.ok ||
      selected.data.sttBackend === 'disabled' ||
      selected.data.ttsBackend === 'disabled'
    )
      throw new Error('Enable valid independent STT/TTS configuration before speech startup');
    if (!llm.ok) throw new Error('Configure OpenRouter before enabling the speech pipeline');
    speech = {
      ...createLocalSpeechAdapters(selected.data),
      ...(process.env.LEMMI_SPEECH_DIAGNOSTICS === '1'
        ? {
            onTiming: (timing: import('@lemmi/server').SpeechTiming) =>
              console.info('Lemmi speech timing', JSON.stringify(timing)),
          }
        : {}),
    };
  }
  const config = dataConfig();
  const repository = config ? await openData(config) : undefined;
  const gateway = startControlGateway({
    repository,
    demoEnrollment: process.env.LEMMI_DEMO_ENROLLMENT === '1',
    speech,
    speechConcurrency: speech ? speechConcurrencyConfig() : undefined,
    caregiverSubject: config?.subject,
    ...controlConfig(),
    port: Number(process.env.GATEWAY_PORT ?? 3001),
    ...(llm.ok ? { chatAdapter: createOpenRouterAdapter(llm.data) } : {}),
    ...(decisions.data ? { decisionAdapter: createOpenRouterDecisionAdapter(decisions.data) } : {}),
  });
  try {
    await gateway.ready;
  } catch {
    gateway.stop();
    await repository?.sql.close();
    console.error('Persistent data startup failed; check private setup/migrations.');
    process.exit(1);
  }
  const shutdown = async () => {
    gateway.stop();
    if (gateway.data) {
      await gateway.flush().catch(() => {});
      await gateway.data.close().catch(() => {});
      await repository?.sql.close();
    }
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  console.info(
    `Lemmi authenticated CONTROL gateway on loopback port ${gateway.server.port}; HTTPS/WSS proxy required; media/contact unavailable`,
  );
} else startMockGateway();
