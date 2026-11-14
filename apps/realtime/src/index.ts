import {
  MockCoordinator,
  assertMockMode,
  localMockRequestAllowed,
  MOCK_TOKEN,
} from '@lemmi/server';
import { DeviceEventSchema, ServerEventSchema, fail, type ServerEvent } from '@lemmi/contracts';
assertMockMode();
const coordinator = new MockCoordinator();
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
      return Response.json(fail('UNAUTHORIZED', 'Mock transport token required'), { status: 401 });
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
    const result = coordinator.handle(operation, body);
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
        ['input.stop', 'input.pause', 'input.resume', 'input.mute'].includes(event.type) &&
        current
      ) {
        const action =
          event.type === 'input.mute' && 'muted' in event.payload
            ? { type: 'mute', muted: event.payload.muted }
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
