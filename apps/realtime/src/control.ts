import {
  DeviceEventSchema,
  ServerEventSchema,
  PairDeviceAuthorityInputSchema,
  ClaimDeviceInputSchema,
  RevokeDeviceAuthorityInputSchema,
  fail,
  type ServerEvent,
  type ErrorCode,
} from '@lemmi/contracts';
import {
  SessionCoordinator,
  DeviceAccess,
  bearer,
  controlResponse,
  isLoopbackHost,
  localMockRequestAllowed,
  secretMatches,
  type DeviceIdentity,
} from '@lemmi/server';

type SocketData = {
  identity: DeviceIdentity;
  hello: boolean;
  sequence: number;
  outputSequence: number;
  lastHeartbeat: number;
  window: number;
  messages: number;
};
type Options = { publicOrigin: string; internalToken: string; port: number; now?: () => number };

// The same gateway owns pairing and the single existing session authority. A trusted local
// reverse proxy terminates HTTPS/WSS; it must overwrite Host and X-Forwarded-Proto.
export function startControlGateway(options: Options) {
  const now = options.now ?? Date.now;
  const coordinator = new SessionCoordinator('live');
  const sockets = new Set<Bun.ServerWebSocket<SocketData>>();
  let connectionClaimed = false;
  let connectionClaimedAt = 0;
  const origin = new URL(options.publicOrigin);
  if (
    origin.protocol !== 'https:' ||
    origin.origin !== options.publicOrigin ||
    options.internalToken.length < 32
  )
    throw new Error('An HTTPS public origin and independent internal credential are required');
  const access = new DeviceAccess(now, () => {
    coordinator.revokeDeviceAccess();
    for (const socket of sockets) socket.close(1008, 'Device access ended');
  });
  function emit(ws: Bun.ServerWebSocket<SocketData>, type: ServerEvent['type'], payload: unknown) {
    const session = coordinator.snapshot();
    const sent = ws.send(
      JSON.stringify(
        ServerEventSchema.parse({
          protocol_version: 1,
          event_id: crypto.randomUUID(),
          session_id: session?.id ?? null,
          turn_id: null,
          generation: session?.generation ?? 0,
          sequence: ws.data.outputSequence++,
          type,
          payload,
        }),
      ),
    );
    if (sent < 0) {
      coordinator.disconnect();
      ws.close(1013, 'Control backpressure');
    }
  }
  function error(
    ws: Bun.ServerWebSocket<SocketData>,
    code: ErrorCode,
    message: string,
    commandId?: string,
  ) {
    emit(ws, 'error', { code, message, ...(commandId ? { commandId } : {}) });
  }
  function broadcast() {
    for (const socket of sockets)
      if (socket.data.hello && access.current(socket.data.identity))
        emit(socket, 'state.changed', { mode: 'live', session: coordinator.snapshot() });
  }
  function endSession() {
    coordinator.revokeDeviceAccess();
  }
  const server = Bun.serve<SocketData>({
    hostname: '127.0.0.1',
    port: options.port,
    maxRequestBodySize: 4096,
    async fetch(request, server) {
      const url = new URL(request.url);
      const peer = server.requestIP(request)?.address ?? null;
      if (!peer || !isLoopbackHost(peer) || url.search)
        return controlResponse(
          fail('FORBIDDEN', 'Trusted local proxy required; query credentials are forbidden'),
        );
      if (url.pathname.startsWith('/internal/control/')) {
        if (!localMockRequestAllowed(request, peer))
          return controlResponse(fail('FORBIDDEN', 'Internal control access only'));
        const token = bearer(request);
        if (!token || !secretMatches(token, options.internalToken))
          return controlResponse(fail('UNAUTHORIZED', 'Internal credential required'));
        if (request.method !== 'POST')
          return new Response(null, { status: 405, headers: { 'Cache-Control': 'no-store' } });
        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return controlResponse(fail('VALIDATION_ERROR', 'Invalid JSON'));
        }
        switch (url.pathname) {
          case '/internal/control/pair': {
            const parsed = PairDeviceAuthorityInputSchema.safeParse(raw);
            return controlResponse(
              parsed.success
                ? access.pair(parsed.data.actor, parsed.data.input)
                : fail('VALIDATION_ERROR', 'Invalid pairing request'),
            );
          }
          case '/internal/control/claim': {
            const parsed = ClaimDeviceInputSchema.safeParse(raw);
            return controlResponse(
              parsed.success
                ? access.claim(parsed.data)
                : fail('VALIDATION_ERROR', 'Invalid local confirmation'),
            );
          }
          case '/internal/control/revoke': {
            const parsed = RevokeDeviceAuthorityInputSchema.safeParse(raw);
            if (!parsed.success)
              return controlResponse(fail('VALIDATION_ERROR', 'Invalid revocation request'));
            const result = access.revoke(parsed.data.actor, parsed.data.input);
            if (result.ok)
              for (const socket of sockets)
                if (!access.current(socket.data.identity)) {
                  endSession();
                  socket.close(1008, 'Device access revoked');
                }
            return controlResponse(result);
          }
          default:
            return controlResponse(fail('NOT_FOUND', 'Unknown control operation'));
        }
      }
      if (
        url.host !== origin.host ||
        request.headers.get('x-forwarded-proto') !== 'https' ||
        (request.headers.has('origin') && request.headers.get('origin') !== origin.origin)
      )
        return controlResponse(fail('FORBIDDEN', 'HTTPS/WSS at the configured origin required'));
      if (url.pathname !== '/v1/device-stream')
        return controlResponse(fail('NOT_FOUND', 'Unknown device route'));
      const token = bearer(request);
      const identity = token ? access.authenticate(token) : null;
      if (!identity)
        return controlResponse(fail('UNAUTHORIZED', 'Current paired device credential required'));
      if (request.method !== 'GET' || request.headers.get('upgrade')?.toLowerCase() !== 'websocket')
        return new Response(null, { status: 426 });
      if (connectionClaimed)
        return controlResponse(fail('REVISION_CONFLICT', 'Device already connected'));
      // Reserve before upgrade/open: two concurrent handshakes must not both see an empty set.
      connectionClaimed = true;
      connectionClaimedAt = now();
      const upgraded = server.upgrade(request, {
        data: {
          identity,
          hello: false,
          sequence: -1,
          outputSequence: 0,
          lastHeartbeat: now(),
          window: now(),
          messages: 0,
        },
      });
      if (!upgraded) connectionClaimed = false;
      return upgraded ? undefined : new Response(null, { status: 400 });
    },
    websocket: {
      maxPayloadLength: 4096,
      idleTimeout: 10,
      backpressureLimit: 16384,
      closeOnBackpressureLimit: true,
      open(ws) {
        sockets.add(ws);
        if (!access.current(ws.data.identity)) ws.close(1008, 'Device access ended');
      },
      message(ws, message) {
        if (!access.current(ws.data.identity)) {
          endSession();
          ws.close(1008, 'Device access expired or revoked');
          return;
        }
        if (now() - ws.data.window >= 1000) {
          ws.data.window = now();
          ws.data.messages = 0;
        }
        if (++ws.data.messages > 30) {
          coordinator.disconnect();
          ws.close(1008, 'Control rate limit');
          return;
        }
        let raw: unknown;
        try {
          raw = JSON.parse(String(message));
        } catch {
          error(ws, 'VALIDATION_ERROR', 'Invalid JSON');
          return;
        }
        const parsed = DeviceEventSchema.safeParse(raw);
        if (!parsed.success) {
          error(ws, 'VALIDATION_ERROR', 'Invalid device event');
          return;
        }
        const event = parsed.data;
        if (event.turn_id !== null) {
          error(ws, 'VALIDATION_ERROR', 'Media turns are unavailable', event.event_id);
          return;
        }
        if (event.sequence <= ws.data.sequence) {
          error(ws, 'REVISION_CONFLICT', 'Stale event sequence', event.event_id);
          return;
        }
        if (!ws.data.hello && event.type !== 'device.hello') {
          ws.close(1008, 'Hello required');
          return;
        }
        if (event.type === 'device.hello') {
          if (ws.data.hello) {
            error(ws, 'REVISION_CONFLICT', 'Hello already received', event.event_id);
            return;
          }
          ws.data.hello = true;
          ws.data.sequence = event.sequence;
          emit(ws, 'device.ready', {
            mode: 'live',
            deviceId: ws.data.identity.deviceId,
            profileId: ws.data.identity.profileId,
            credentialExpiresAt: new Date(ws.data.identity.expiresAt).toISOString(),
            audio: false,
            camera: false,
            controls: ['start', 'stop', 'pause', 'resume', 'mute', 'help'],
          });
          emit(ws, 'command.ack', { mode: 'live', commandId: event.event_id, applied: true });
          broadcast();
          return;
        }
        // Consume validated wire sequence even when session preconditions fail; a rejected
        // packet must not become actionable when a later state happens to match it.
        ws.data.sequence = event.sequence;
        const current = coordinator.snapshot();
        if (
          event.type !== 'heartbeat' &&
          event.type !== 'input.help' &&
          event.type !== 'input.start' &&
          (!current || event.session_id !== current.id || event.generation !== current.generation)
        ) {
          error(ws, 'REVISION_CONFLICT', 'Use the current session snapshot', event.event_id);
          broadcast();
          return;
        }
        if (event.type === 'heartbeat') {
          ws.data.lastHeartbeat = now();
          emit(ws, 'heartbeat', { mode: 'live' });
          return;
        }
        let result;
        if (event.type === 'input.start') {
          if (event.session_id !== null || event.generation !== 0) {
            error(
              ws,
              'VALIDATION_ERROR',
              'Start uses null session and generation zero',
              event.event_id,
            );
            return;
          }
          result = coordinator.handle('session.start', {
            profileId: ws.data.identity.profileId,
            endpoint: 'robot',
            commandId: event.event_id,
          });
        } else if (event.type === 'input.help') {
          result = coordinator.handle('help.create', {
            profileId: ws.data.identity.profileId,
            commandId: event.event_id,
            mode: 'real',
          });
        } else if (
          current &&
          ['input.stop', 'input.pause', 'input.resume', 'input.mute'].includes(event.type)
        ) {
          const action =
            event.type === 'input.mute' && 'muted' in event.payload
              ? { type: 'mute', muted: event.payload.muted }
              : { type: event.type.slice(6) };
          result = coordinator.handle('session.command', {
            sessionId: current.id,
            expectedGeneration: event.generation,
            commandId: event.event_id,
            action,
          });
        } else
          result = fail(
            'UNAVAILABLE',
            'Audio, camera, activities and teaching are unavailable on this control path',
          );
        emit(ws, 'command.ack', { mode: 'live', commandId: event.event_id, applied: result.ok });
        if (!result.ok) error(ws, result.error.code, result.error.message, event.event_id);
        broadcast();
      },
      close(ws) {
        sockets.delete(ws);
        if (!sockets.size) connectionClaimed = false;
        coordinator.disconnect();
        broadcast();
      },
    },
  });
  const watchdog = setInterval(() => {
    access.sweep();
    if (connectionClaimed && !sockets.size && now() - connectionClaimedAt > 6000)
      connectionClaimed = false;
    for (const socket of sockets) {
      if (!access.current(socket.data.identity)) {
        endSession();
        socket.close(1008, 'Device access expired or revoked');
      } else if (now() - socket.data.lastHeartbeat > 6000) {
        coordinator.disconnect();
        socket.close(1001, 'Heartbeat timeout');
      }
    }
  }, 500);
  return {
    server,
    stop() {
      clearInterval(watchdog);
      coordinator.disconnect();
      server.stop(true);
    },
  };
}
