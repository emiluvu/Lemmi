import {
  DeviceEventSchema,
  ServerEventSchema,
  PairDeviceAuthorityInputSchema,
  ClaimDeviceInputSchema,
  RevokeDeviceAuthorityInputSchema,
  fail,
  ok,
  type ServerEvent,
  type ErrorCode,
  type SpeechOutputStart,
} from '@lemmi/contracts';
import {
  SessionCoordinator,
  DeviceAccess,
  bearer,
  controlResponse,
  isLoopbackHost,
  localMockRequestAllowed,
  secretMatches,
  hasPrivateAccess,
  type DeviceIdentity,
  type ChatAdapter,
  PersistentData,
  dataFailure,
  boundedJson,
  type DataRepository,
  type SpeechAdapters,
} from '@lemmi/server';

type SocketData = {
  identity: DeviceIdentity;
  hello: boolean;
  sequence: number;
  outputSequence: number;
  lastHeartbeat: number;
  window: number;
  messages: number;
  deliveredText: Set<string>;
  playbackRates: number[];
  mediaMessages: number;
  speechOutput?: SpeechOutputStart;
};
type Options = {
  publicOrigin: string;
  internalToken: string;
  port: number;
  now?: () => number;
  chatAdapter?: ChatAdapter;
  repository?: DataRepository;
  caregiverSubject?: string;
  accessKey?: string | null;
  speech?: SpeechAdapters;
};

// The same gateway owns pairing and the single existing session authority. A trusted local
// reverse proxy terminates HTTPS/WSS; it must overwrite Host and X-Forwarded-Proto.
export function startControlGateway(options: Options) {
  const now = options.now ?? Date.now;
  const elapsedNow = options.now ?? (() => performance.now());
  const coordinator = new SessionCoordinator('live', options.chatAdapter, options.speech, now);
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
  const invalidated = () => {
    coordinator.revokeDeviceAccess();
    for (const socket of sockets) socket.close(1008, 'Device access ended');
  };
  const data = options.repository
    ? new PersistentData(
        options.repository,
        options.caregiverSubject ?? '',
        coordinator,
        now,
        invalidated,
        () => broadcast(),
      )
    : null;
  const access = data?.devices ?? new DeviceAccess(now, invalidated);
  const ready = data ? data.start() : Promise.resolve();
  void ready.catch(() => {});
  type Checkpoint = NonNullable<ReturnType<SessionCoordinator['persistenceSnapshot']>>;
  const checkpoints: Checkpoint[] = [];
  let persisting: Promise<void> | null = null;
  function persist() {
    if (!data) return Promise.resolve();
    const snapshot = coordinator.persistenceSnapshot();
    if (snapshot) {
      const last = checkpoints.at(-1);
      if (last?.session.id === snapshot.session.id) checkpoints[checkpoints.length - 1] = snapshot;
      else checkpoints.push(snapshot);
    }
    if (checkpoints.length > 8) {
      coordinator.disconnect();
      for (const socket of sockets) socket.close(1011, 'Persistent checkpoint capacity');
      return Promise.reject(new Error('Persistent checkpoint capacity'));
    }
    if (persisting) return persisting;
    if (!checkpoints.length) return Promise.resolve();
    persisting = (async () => {
      try {
        while (checkpoints.length) await data.checkpoint(checkpoints.shift()!);
      } catch {
        checkpoints.length = 0;
        coordinator.disconnect();
        for (const socket of sockets) socket.close(1011, 'Persistent data unavailable');
      } finally {
        persisting = null;
      }
    })();
    return persisting;
  }
  function emit(ws: Bun.ServerWebSocket<SocketData>, type: ServerEvent['type'], payload: unknown) {
    const session = coordinator.snapshot();
    const sent = ws.send(
      JSON.stringify(
        ServerEventSchema.parse({
          protocol_version: 1,
          event_id: crypto.randomUUID(),
          session_id: session?.id ?? null,
          turn_id:
            (type === 'response.text' || type === 'response.start') &&
            payload &&
            typeof payload === 'object' &&
            'turnId' in payload
              ? payload.turnId
              : ['audio.chunk', 'audio.end', 'response.cancel'].includes(type)
                ? (ws.data.speechOutput?.turnId ?? null)
                : null,
          generation: session?.generation ?? 0,
          sequence: ws.data.outputSequence++,
          type,
          payload,
        }),
      ),
    );
    if (sent <= 0) {
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
    void persist().catch(() => {});
    for (const socket of sockets)
      if (socket.data.hello && access.current(socket.data.identity)) {
        emit(socket, 'state.changed', { mode: 'live', session: coordinator.snapshot() });
        const output = coordinator.speechOutputInfo();
        if (socket.data.speechOutput && socket.data.speechOutput.streamId !== output?.streamId) {
          emit(socket, 'response.cancel', {
            leaseId: socket.data.speechOutput.leaseId,
            streamId: socket.data.speechOutput.streamId,
            reason: 'interrupted',
          });
          socket.data.speechOutput = undefined;
        }
        if (output && socket.data.playbackRates.includes(output.sampleRate)) {
          const batch = coordinator.drainSpeechOutput();
          if (batch) {
            socket.data.speechOutput = batch.metadata;
            if (batch.start) emit(socket, 'response.start', batch.metadata);
            for (const chunk of batch.chunks) {
              if (!coordinator.speechOutputInfo()) break;
              emit(socket, 'audio.chunk', chunk);
            }
            if (batch.end && coordinator.speechOutputInfo())
              emit(socket, 'audio.end', {
                leaseId: batch.metadata.leaseId,
                streamId: batch.metadata.streamId,
                chunkCount: batch.metadata.chunkCount,
              });
          }
        }
      }
  }
  function endSession() {
    coordinator.revokeDeviceAccess();
  }
  const server = Bun.serve<SocketData>({
    hostname: '127.0.0.1',
    port: options.port,
    maxRequestBodySize: 29 * 1024 * 1024,
    async fetch(request, server) {
      const url = new URL(request.url);
      const peer = server.requestIP(request)?.address ?? null;
      if (!peer || !isLoopbackHost(peer) || url.search)
        return controlResponse(
          fail('FORBIDDEN', 'Trusted local proxy required; query credentials are forbidden'),
        );
      if (url.pathname === '/internal/data' || url.pathname.startsWith('/internal/control/')) {
        if (!localMockRequestAllowed(request, peer))
          return controlResponse(fail('FORBIDDEN', 'Internal control access only'));
        const token = bearer(request);
        if (!token || !secretMatches(token, options.internalToken))
          return controlResponse(fail('UNAUTHORIZED', 'Internal credential required'));
        if (request.method !== 'POST')
          return new Response(null, { status: 405, headers: { 'Cache-Control': 'no-store' } });
        let raw: unknown;
        try {
          raw = await boundedJson(
            request,
            url.pathname === '/internal/data' ? 29 * 1024 * 1024 : 4096,
          );
        } catch {
          return controlResponse(fail('VALIDATION_ERROR', 'Invalid JSON'));
        }
        try {
          await ready;
        } catch {
          return controlResponse(fail('UNAVAILABLE', 'Persistent data startup failed'));
        }
        if (url.pathname === '/internal/data') {
          if (!data || !raw || typeof raw !== 'object')
            return controlResponse(fail('UNAVAILABLE', 'PostgreSQL data mode is not configured'));
          const { actor, credential, ...operation } = raw as Record<string, unknown>;
          try {
            const result = await data.handle(operation, actor, credential);
            broadcast();
            if (
              operation.operation === 'asset.read' &&
              operation.bytes === true &&
              result.ok &&
              'bytes' in result.data
            ) {
              const value = result.data as {
                metadata: { mediaType: string; byteLength: number };
                bytes: Buffer;
              };
              return new Response(new Uint8Array(value.bytes), {
                headers: {
                  'content-type': value.metadata.mediaType,
                  'content-length': String(value.metadata.byteLength),
                  'cache-control': 'no-store, private',
                  'x-content-type-options': 'nosniff',
                },
              });
            }
            if (operation.operation === 'asset.read' && result.ok && 'metadata' in result.data)
              return controlResponse(ok(result.data.metadata));
            return controlResponse(result);
          } catch (error) {
            broadcast();
            return controlResponse(dataFailure(error));
          }
        }
        try {
          switch (url.pathname) {
            case '/internal/control/pair': {
              const parsed = PairDeviceAuthorityInputSchema.safeParse(raw);
              return controlResponse(
                parsed.success
                  ? await access.pair(parsed.data.actor, parsed.data.input)
                  : fail('VALIDATION_ERROR', 'Invalid pairing request'),
              );
            }
            case '/internal/control/claim': {
              const parsed = ClaimDeviceInputSchema.safeParse(raw);
              return controlResponse(
                parsed.success
                  ? await access.claim(parsed.data)
                  : fail('VALIDATION_ERROR', 'Invalid local confirmation'),
              );
            }
            case '/internal/control/revoke': {
              const parsed = RevokeDeviceAuthorityInputSchema.safeParse(raw);
              if (!parsed.success)
                return controlResponse(fail('VALIDATION_ERROR', 'Invalid revocation request'));
              const result = await access.revoke(parsed.data.actor, parsed.data.input);
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
        } catch (error) {
          return controlResponse(dataFailure(error));
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
      try {
        await ready;
      } catch {
        return controlResponse(fail('UNAVAILABLE', 'Persistent data startup failed'));
      }
      if (!hasPrivateAccess(request, options.accessKey ?? null, now()))
        return controlResponse(fail('UNAUTHORIZED', 'Private access key required'));
      const token = bearer(request);
      let identity;
      try {
        identity = token ? await access.authenticate(token) : null;
      } catch {
        return controlResponse(fail('UNAVAILABLE', 'Device authorization database unavailable'));
      }
      if (!identity)
        return controlResponse(fail('UNAUTHORIZED', 'Current paired device credential required'));
      if (request.method !== 'GET' || request.headers.get('upgrade')?.toLowerCase() !== 'websocket')
        return new Response(null, { status: 426 });
      if (connectionClaimed)
        return controlResponse(fail('REVISION_CONFLICT', 'Device already connected'));
      // Reserve before upgrade/open: two concurrent handshakes must not both see an empty set.
      connectionClaimed = true;
      connectionClaimedAt = elapsedNow();
      const upgraded = server.upgrade(request, {
        data: {
          identity,
          hello: false,
          sequence: -1,
          outputSequence: 0,
          lastHeartbeat: elapsedNow(),
          window: elapsedNow(),
          messages: 0,
          deliveredText: new Set<string>(),
          playbackRates: [],
          mediaMessages: 0,
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
        if (elapsedNow() - ws.data.window >= 1000) {
          ws.data.window = elapsedNow();
          ws.data.messages = 0;
          ws.data.mediaMessages = 0;
        }
        if (++ws.data.messages > 90) {
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
          if (coordinator.snapshot()?.phase === 'listening')
            ws.close(1008, 'Invalid capture frame');
          return;
        }
        const event = parsed.data;
        const media = ['audio.chunk', 'audio.end', 'audio.receipt'].includes(event.type);
        if (
          (media && ws.data.playbackRates.length > 0 && event.turn_id === null) ||
          (!media && event.turn_id !== null)
        ) {
          error(
            ws,
            'VALIDATION_ERROR',
            'Use the current media turn ID only for media events',
            event.event_id,
          );
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
          ws.data.playbackRates =
            coordinator.speechConfigured() &&
            !('supported' in event.payload.audio) &&
            event.payload.playback
              ? [...event.payload.playback.sampleRates]
              : [];
          emit(ws, 'device.ready', {
            mode: 'live',
            deviceId: ws.data.identity.deviceId,
            profileId: ws.data.identity.profileId,
            credentialExpiresAt: new Date(ws.data.identity.expiresAt).toISOString(),
            audio: ws.data.playbackRates.length
              ? {
                  encoding: 'pcm_s16le',
                  sampleRate: 16000,
                  channels: 1,
                  frameMs: 20,
                  maxCaptureMs: 20000,
                  playback: event.payload.playback!,
                  outputWindowChunks: 4,
                }
              : false,
            camera: false,
            textChat: !!options.chatAdapter,
            controls: [
              'start',
              'stop',
              'pause',
              'resume',
              'mute',
              'help',
              ...(options.chatAdapter ? ['text'] : []),
              ...(ws.data.playbackRates.length ? ['speak'] : []),
            ],
          });
          emit(ws, 'command.ack', { mode: 'live', commandId: event.event_id, applied: true });
          broadcast();
          return;
        }
        // Consume validated wire sequence even when session preconditions fail; a rejected
        // packet must not become actionable when a later state happens to match it.
        ws.data.sequence = event.sequence;
        if (event.type === 'audio.chunk' && ++ws.data.mediaMessages > 60) {
          coordinator.disconnect();
          ws.close(1008, 'Capture rate limit');
          return;
        }
        if (event.type !== 'audio.chunk' && ws.data.messages - ws.data.mediaMessages > 30) {
          coordinator.disconnect();
          ws.close(1008, 'Control rate limit');
          return;
        }
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
          ws.data.lastHeartbeat = elapsedNow();
          emit(ws, 'heartbeat', { mode: 'live' });
          return;
        }
        if (event.type === 'input.speak' || media) {
          if (!ws.data.playbackRates.length || current?.endpoint !== 'robot') {
            error(ws, 'UNAVAILABLE', 'Audio was not negotiated for this endpoint', event.event_id);
            return;
          }
          const scope = {
            sessionId: event.session_id,
            expectedGeneration: event.generation,
            turnId: event.turn_id,
          };
          if (event.type === 'input.speak') {
            const result = coordinator.requestCapture(
              {
                sessionId: event.session_id,
                expectedGeneration: event.generation,
                commandId: event.event_id,
                language: event.payload.language,
              },
              ws.data.playbackRates,
            );
            emit(ws, 'command.ack', {
              mode: 'live',
              commandId: event.event_id,
              applied: result.ok,
            });
            if (!result.ok) error(ws, result.error.code, result.error.message, event.event_id);
            broadcast();
            return;
          }
          if (event.type === 'audio.chunk') {
            const result = coordinator.acceptCaptureChunk({ ...scope, ...event.payload });
            if (!result.ok) {
              error(ws, result.error.code, result.error.message, event.event_id);
              broadcast();
            }
            return;
          }
          if (event.type === 'audio.receipt') {
            const result = coordinator.playbackReceipt({ ...scope, ...event.payload });
            if (result.ok && ['completed', 'failed'].includes(event.payload.status))
              ws.data.speechOutput = undefined;
            emit(ws, 'command.ack', {
              mode: 'live',
              commandId: event.event_id,
              applied: result.ok,
            });
            if (!result.ok) error(ws, result.error.code, result.error.message, event.event_id);
            broadcast();
            return;
          }
        }
        if (event.type === 'input.text' || event.type === 'audio.end') {
          // Do not await provider work in the control handler. Stop/mute/help/heartbeat
          // remain responsive; the coordinator drops all obsolete turn results.
          const work =
            event.type === 'audio.end'
              ? coordinator.finishCapture({
                  sessionId: event.session_id,
                  expectedGeneration: event.generation,
                  turnId: event.turn_id,
                  ...event.payload,
                })
              : coordinator.submitText({
                  commandId: event.event_id,
                  sessionId: event.session_id,
                  expectedGeneration: event.generation,
                  ...event.payload,
                });
          broadcast();
          void work
            .then((result) => {
              if (!sockets.has(ws) || !access.current(ws.data.identity)) return;
              const latest = coordinator.snapshot();
              if (
                result.ok &&
                result.data.kind === 'reply' &&
                (!coordinator.isCurrentTextReply(result.data.reply.turnId) ||
                  !latest ||
                  latest.phase === 'ended' ||
                  (latest.phase === 'paused' && result.data.reply.source !== 'fixed') ||
                  latest.id !== result.data.session.id ||
                  latest.generation !== result.data.session.generation ||
                  latest.leaseId !== result.data.session.leaseId ||
                  latest.profileRevision !== result.data.session.profileRevision ||
                  latest.privacyRevision !== result.data.session.privacyRevision ||
                  latest.policyRevision !== result.data.session.policyRevision)
              ) {
                error(
                  ws,
                  'REVISION_CONFLICT',
                  'Discarded obsolete conversation output',
                  event.event_id,
                );
                return;
              }
              emit(ws, 'command.ack', {
                mode: 'live',
                commandId: event.event_id,
                applied: result.ok,
              });
              if (
                result.ok &&
                result.data.kind === 'reply' &&
                !ws.data.deliveredText.has(result.data.reply.turnId)
              ) {
                if (ws.data.deliveredText.size >= 256) ws.data.deliveredText.clear();
                ws.data.deliveredText.add(result.data.reply.turnId);
                emit(ws, 'response.text', result.data.reply);
              } else if (!result.ok)
                error(ws, result.error.code, result.error.message, event.event_id);
              broadcast();
            })
            .catch(() => {
              if (sockets.has(ws))
                error(ws, 'UNAVAILABLE', 'Conversation service unavailable', event.event_id);
            });
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
          if (result.ok && current?.id !== coordinator.snapshot()?.id)
            ws.data.deliveredText.clear();
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
  let checkingDatabase = false;
  const watchdog = setInterval(() => {
    if (coordinator.sweepSpeech()) {
      for (const socket of sockets)
        if (socket.data.playbackRates.length)
          error(socket, 'UNAVAILABLE', 'Speech deadline expired; retry explicitly');
      broadcast();
    }
    if (data && !checkingDatabase && sockets.size) {
      checkingDatabase = true;
      void data.devices
        .verifyCurrent()
        .then((valid) => {
          if (!valid) invalidated();
        })
        .catch(() => invalidated())
        .finally(() => {
          checkingDatabase = false;
        });
    }
    access.sweep();
    if (connectionClaimed && !sockets.size && elapsedNow() - connectionClaimedAt > 6000)
      connectionClaimed = false;
    for (const socket of sockets) {
      if (!access.current(socket.data.identity)) {
        endSession();
        socket.close(1008, 'Device access expired or revoked');
      } else if (elapsedNow() - socket.data.lastHeartbeat > 6000) {
        coordinator.disconnect();
        socket.close(1001, 'Heartbeat timeout');
      }
    }
  }, 500);
  return {
    server,
    ready,
    data,
    flush: () => persist(),
    stop() {
      clearInterval(watchdog);
      coordinator.disconnect();
      server.stop(true);
      if (data)
        void persist()
          .catch(() => {})
          .finally(() => data.close())
          .catch(() => {});
    },
  };
}
