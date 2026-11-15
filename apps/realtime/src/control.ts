import {
  TransportDiagnostics,
  type TransportDiagnostic,
  type TransportCloseReason,
} from './transport-diagnostics';
import { handlePhotoScene } from '../../../packages/server/src/photo-scene';
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
  type ProfileDetail,
} from '@lemmi/contracts';
import {
  SessionCoordinator,
  SessionRegistry,
  createScheduledSpeechAdapters,
  DeviceAccess,
  bearer,
  controlResponse,
  isLoopbackHost,
  localMockRequestAllowed,
  secretMatches,
  hasPrivateAccess,
  type DeviceIdentity,
  type ChatAdapter,
  type ConversationDecisionAdapter,
  PersistentData,
  DataError,
  dataFailure,
  boundedJson,
  type DataRepository,
  type SpeechAdapters,
  type SpeechConcurrency,
} from '@lemmi/server';

type SocketData = {
  identity: DeviceIdentity;
  connectionId: string;
  hello: boolean;
  sequence: number;
  outputSequence: number;
  lastHeartbeat: number;
  window: number;
  messages: number;
  deliveredText: Set<string>;
  playbackRates: number[];
  outputWindow: 4 | 12;
  mediaMessages: number;
  speechOutput?: SpeechOutputStart;
  transport?: TransportDiagnostics;
};
type Options = {
  transportDiagnostics?: { deviceId: string; emit: (observation: TransportDiagnostic) => void };
  publicOrigin: string;
  internalToken: string;
  port: number;
  now?: () => number;
  chatAdapter?: ChatAdapter;
  decisionAdapter?: ConversationDecisionAdapter;
  repository?: DataRepository;
  caregiverSubject?: string;
  accessKey?: string | null;
  speech?: SpeechAdapters;
  speechConcurrency?: SpeechConcurrency;
  demoEnrollment?: boolean;
  profiles?: ProfileDetail[];
  // Trusted server configuration only; never accepted in HTTP/WSS payloads.
  languageForProfile?: (profileId: string) => 'en' | 'de';
  devices?: Array<{ profileId: string; deviceId: string; endpoint?: 'browser' | 'robot' }>;
};

// The same gateway owns pairing and the single existing session authority. A trusted local
// reverse proxy terminates HTTPS/WSS; it must overwrite Host and X-Forwarded-Proto.
export function startControlGateway(options: Options) {
  const now = options.now ?? Date.now;
  const elapsedNow = options.now ?? (() => performance.now());
  const sessions = new SessionRegistry(
    options.chatAdapter,
    options.speech
      ? createScheduledSpeechAdapters(options.speech, 8, options.speechConcurrency)
      : undefined,
    now,
    () => broadcast(),
    options.demoEnrollment === true,
    options.decisionAdapter,
    options.languageForProfile,
  );
  for (const profile of options.profiles ?? []) sessions.acceptPersistentProfile(profile);
  // In-memory fixtures explicitly enroll fictional profiles; PostgreSQL supplies its own is_demo check.
  if (!options.repository && options.demoEnrollment) {
    sessions.authorizePhotoDemoProfile('profile-alex', true);
    for (const profile of options.profiles ?? [])
      sessions.authorizePhotoDemoProfile(profile.id, true);
  }
  const sockets = new Set<Bun.ServerWebSocket<SocketData>>();
  const reservations = new Map<string, { id: string; at: number }>();
  const ownsEndpoint = (identity: DeviceIdentity) =>
    sessions.forProfile(identity.profileId).snapshot()?.activeEndpointId === identity.deviceId;
  function disconnect(identity: DeviceIdentity) {
    if (ownsEndpoint(identity)) sessions.forProfile(identity.profileId).disconnect();
  }
  function closeSocket(
    ws: Bun.ServerWebSocket<SocketData>,
    code: number,
    reason: TransportCloseReason,
  ) {
    if (ws.data.transport) ws.data.transport.localCloseReason ??= reason;
    ws.close(code, reason);
  }
  function observeMessage(
    handler: (ws: Bun.ServerWebSocket<SocketData>, message: string | Buffer) => void,
  ) {
    return (ws: Bun.ServerWebSocket<SocketData>, message: string | Buffer) => {
      const transport = ws.data.transport;
      if (!transport) return handler(ws, message);
      const began = elapsedNow();
      transport.received(
        typeof message === 'string' ? Buffer.byteLength(message) : message.byteLength,
      );
      try {
        handler(ws, message);
      } finally {
        transport.handled(began);
      }
    };
  }
  const origin = new URL(options.publicOrigin);
  if (
    origin.protocol !== 'https:' ||
    origin.origin !== options.publicOrigin ||
    options.internalToken.length < 32
  )
    throw new Error('An HTTPS public origin and independent internal credential are required');
  const invalidated = (deviceId?: string) => {
    for (const coordinator of sessions.all())
      if (!deviceId || coordinator.snapshot()?.activeEndpointId === deviceId)
        coordinator.revokeDeviceAccess();
    for (const socket of sockets)
      if (!deviceId || socket.data.identity.deviceId === deviceId)
        closeSocket(socket, 1008, 'Device access ended');
  };
  const data = options.repository
    ? new PersistentData(
        options.repository,
        options.caregiverSubject ?? '',
        sessions,
        now,
        invalidated,
        () => broadcast(),
      )
    : null;
  const access = data?.devices ?? new DeviceAccess(now, invalidated);
  for (const device of options.devices ?? [])
    if (access instanceof DeviceAccess)
      access.assign(device.profileId, device.deviceId, device.endpoint);
  const ready = data ? data.start() : Promise.resolve();
  void ready.catch(() => {});
  type Checkpoint = NonNullable<ReturnType<SessionCoordinator['persistenceSnapshot']>>;
  const checkpoints: Checkpoint[] = [];
  let persisting: Promise<void> | null = null;
  function persist() {
    if (!data) return Promise.resolve();
    for (const coordinator of sessions.all()) {
      const snapshot = coordinator.persistenceSnapshot();
      if (!snapshot) continue;
      const index = checkpoints.findIndex((entry) => entry.session.id === snapshot.session.id);
      if (index >= 0) checkpoints[index] = snapshot;
      else checkpoints.push(snapshot);
    }
    if (checkpoints.length > 800) {
      sessions.disconnect();
      for (const socket of sockets) closeSocket(socket, 1011, 'Persistent checkpoint capacity');
      return Promise.reject(new Error('Persistent checkpoint capacity'));
    }
    if (persisting) return persisting;
    if (!checkpoints.length) return Promise.resolve();
    persisting = (async () => {
      try {
        while (checkpoints.length) {
          const snapshot = checkpoints.shift()!;
          try {
            await data.checkpoint(snapshot);
          } catch (error) {
            if (!(error instanceof DataError) || error.code !== 'NOT_FOUND') throw error;
            // Host-admin deletion has already removed dependent rows. Forget only
            // that profile's authority; never recreate it or interrupt other profiles.
            for (let i = checkpoints.length - 1; i >= 0; i--)
              if (checkpoints[i]!.session.profileId === snapshot.session.profileId)
                checkpoints.splice(i, 1);
            sessions.removeProfile(snapshot.session.profileId);
            for (const socket of sockets)
              if (socket.data.identity.profileId === snapshot.session.profileId)
                closeSocket(socket, 1008, 'Device access ended');
          }
        }
      } catch {
        checkpoints.length = 0;
        sessions.disconnect();
        for (const socket of sockets) closeSocket(socket, 1011, 'Persistent data unavailable');
      } finally {
        persisting = null;
      }
    })();
    return persisting;
  }
  function emit(ws: Bun.ServerWebSocket<SocketData>, type: ServerEvent['type'], payload: unknown) {
    const coordinator = sessions.forProfile(ws.data.identity.profileId);
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
      disconnect(ws.data.identity);
      closeSocket(ws, 1013, 'Control backpressure');
    }
  }
  function error(
    ws: Bun.ServerWebSocket<SocketData>,
    code: ErrorCode,
    message: string,
    commandId?: string,
  ) {
    ws.data.transport?.rejected(code);
    emit(ws, 'error', { code, message, ...(commandId ? { commandId } : {}) });
  }
  function broadcast() {
    void persist().catch(() => {});
    for (const socket of sockets)
      if (socket.data.hello && access.current(socket.data.identity)) {
        const coordinator = sessions.forProfile(socket.data.identity.profileId);
        emit(socket, 'state.changed', { mode: 'live', session: coordinator.snapshot() });
        if (socket.data.identity.endpoint === 'browser' && coordinator.publicPhotoEnabled())
          emit(socket, 'activity.changed', { activity: coordinator.photoView() });
        const output = coordinator.speechOutputInfo();
        if (socket.data.speechOutput && socket.data.speechOutput.streamId !== output?.streamId) {
          emit(socket, 'response.cancel', {
            leaseId: socket.data.speechOutput.leaseId,
            streamId: socket.data.speechOutput.streamId,
            reason: 'interrupted',
          });
          socket.data.speechOutput = undefined;
        }
        if (
          output &&
          ownsEndpoint(socket.data.identity) &&
          socket.data.playbackRates.includes(output.sampleRate)
        ) {
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
  function endSession(identity: DeviceIdentity) {
    if (ownsEndpoint(identity)) sessions.forProfile(identity.profileId).revokeDeviceAccess();
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
      if (
        url.pathname === '/internal/demo' ||
        url.pathname === '/internal/data' ||
        url.pathname.startsWith('/internal/control/')
      ) {
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
            url.pathname === '/internal/data'
              ? 29 * 1024 * 1024
              : url.pathname === '/internal/demo'
                ? 1500000
                : 4096,
          );
        } catch {
          return controlResponse(fail('VALIDATION_ERROR', 'Invalid JSON'));
        }
        try {
          await ready;
        } catch {
          return controlResponse(fail('UNAVAILABLE', 'Persistent data startup failed'));
        }
        if (url.pathname === '/internal/demo') {
          if (!options.demoEnrollment || !data)
            return controlResponse(
              fail(
                'UNAVAILABLE',
                'Fictional demo enrollment is disabled or PostgreSQL is not configured',
              ),
            );
          try {
            const result = await data.demoHandle(raw);
            broadcast();
            return controlResponse(result);
          } catch (error) {
            return controlResponse(dataFailure(error));
          }
        }
        if (url.pathname === '/internal/data') {
          if (!data || !raw || typeof raw !== 'object')
            return controlResponse(fail('UNAVAILABLE', 'PostgreSQL data mode is not configured'));
          if ('operation' in raw && raw.operation === 'photo.scene.read') {
            if (!options.demoEnrollment)
              return controlResponse(fail('UNAVAILABLE', 'Fictional Photo Story is disabled'));
            return handlePhotoScene(raw, data, sessions);
          }
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
                    endSession(socket.data.identity);
                    closeSocket(socket, 1008, 'Device access revoked');
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
      const cookieTokens = (request.headers.get('cookie') ?? '')
        .split(';')
        .map((part) => part.trim())
        .filter((part) => part.startsWith('__Host-lemmi_endpoint='));
      const cookieToken =
        cookieTokens.length === 1 ? cookieTokens[0]!.slice('__Host-lemmi_endpoint='.length) : null;
      if (cookieToken && !bearer(request) && request.headers.get('origin') !== origin.origin)
        return controlResponse(
          fail('FORBIDDEN', 'Browser WebSocket requires the configured Origin'),
        );
      const token = bearer(request) ?? cookieToken;
      let identity;
      try {
        identity = token ? await access.authenticate(token) : null;
      } catch {
        return controlResponse(fail('UNAVAILABLE', 'Device authorization database unavailable'));
      }
      if (!identity || (!bearer(request) && identity.endpoint !== 'browser'))
        return controlResponse(fail('UNAUTHORIZED', 'Current paired device credential required'));
      if (request.method !== 'GET' || request.headers.get('upgrade')?.toLowerCase() !== 'websocket')
        return new Response(null, { status: 426 });
      if (reservations.has(identity.deviceId))
        return controlResponse(fail('REVISION_CONFLICT', 'Device already connected'));
      if (reservations.size >= 200)
        return controlResponse(fail('UNAVAILABLE', 'Endpoint connection capacity reached'));
      const connectionId = crypto.randomUUID();
      reservations.set(identity.deviceId, { id: connectionId, at: elapsedNow() });
      const upgraded = server.upgrade(request, {
        data: {
          identity,
          connectionId,
          hello: false,
          sequence: -1,
          outputSequence: 0,
          lastHeartbeat: elapsedNow(),
          window: elapsedNow(),
          messages: 0,
          deliveredText: new Set<string>(),
          playbackRates: [],
          outputWindow: 4,
          mediaMessages: 0,
          ...(options.transportDiagnostics?.deviceId === identity.deviceId
            ? {
                transport: new TransportDiagnostics(
                  connectionId,
                  options.transportDiagnostics.emit,
                  elapsedNow,
                ),
              }
            : {}),
        },
      });
      if (!upgraded && reservations.get(identity.deviceId)?.id === connectionId)
        reservations.delete(identity.deviceId);
      return upgraded ? undefined : new Response(null, { status: 400 });
    },
    websocket: {
      maxPayloadLength: 4096,
      idleTimeout: 10,
      backpressureLimit: 65536,
      closeOnBackpressureLimit: true,
      open(ws) {
        sockets.add(ws);
        ws.data.transport?.report('open');
        if (
          reservations.get(ws.data.identity.deviceId)?.id !== ws.data.connectionId ||
          !access.current(ws.data.identity)
        )
          closeSocket(ws, 1008, 'Device access ended');
      },
      message: observeMessage((ws, message) => {
        const transport = ws.data.transport;
        const coordinator = sessions.forProfile(ws.data.identity.profileId);
        if (!access.current(ws.data.identity)) {
          endSession(ws.data.identity);
          closeSocket(ws, 1008, 'Device access expired or revoked');
          return;
        }
        if (elapsedNow() - ws.data.window >= 1000) {
          ws.data.window = elapsedNow();
          ws.data.messages = 0;
          ws.data.mediaMessages = 0;
        }
        if (++ws.data.messages > 90) {
          disconnect(ws.data.identity);
          closeSocket(ws, 1008, 'Control rate limit');
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
            closeSocket(ws, 1008, 'Invalid capture frame');
          return;
        }
        const event = parsed.data;
        transport?.validated(event.type);
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
          closeSocket(ws, 1008, 'Hello required');
          return;
        }
        if (event.type === 'device.hello') {
          if (ws.data.hello) {
            error(ws, 'REVISION_CONFLICT', 'Hello already received', event.event_id);
            return;
          }
          if (
            event.payload.endpoint &&
            event.payload.endpoint !== (ws.data.identity.endpoint ?? 'robot')
          ) {
            closeSocket(ws, 1008, 'Endpoint assignment mismatch');
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
          ws.data.outputWindow = event.payload.playback?.outputWindowChunks === 12 ? 12 : 4;
          emit(ws, 'device.ready', {
            mode: 'live',
            deviceId: ws.data.identity.deviceId,
            profileId: ws.data.identity.profileId,
            language: coordinator.language(),
            credentialExpiresAt:
              ws.data.identity.expiresAt === null
                ? null
                : new Date(ws.data.identity.expiresAt).toISOString(),
            audio: ws.data.playbackRates.length
              ? {
                  encoding: 'pcm_s16le',
                  sampleRate: 16000,
                  channels: 1,
                  frameMs: 20,
                  maxCaptureMs: 20000,
                  playback: event.payload.playback!,
                  outputWindowChunks: ws.data.outputWindow,
                }
              : false,
            camera: false,
            textChat: !!options.chatAdapter,
            teaching: coordinator.language() === 'en',
            photoStory: ws.data.identity.endpoint === 'browser' && coordinator.publicPhotoEnabled(),
            controls: [
              'start',
              'stop',
              'pause',
              'resume',
              'mute',
              'help',
              'handoff',
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
          disconnect(ws.data.identity);
          closeSocket(ws, 1008, 'Capture rate limit');
          return;
        }
        if (event.type !== 'audio.chunk' && ws.data.messages - ws.data.mediaMessages > 30) {
          disconnect(ws.data.identity);
          closeSocket(ws, 1008, 'Control rate limit');
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
        if (
          !['input.start', 'input.handoff', 'input.stop', 'input.pause', 'input.help'].includes(
            event.type,
          ) &&
          !ownsEndpoint(ws.data.identity)
        ) {
          error(ws, 'FORBIDDEN', 'Use an explicit handoff to control this session', event.event_id);
          return;
        }
        if (
          event.type === 'input.photo.start' ||
          event.type === 'input.photo.action' ||
          event.type === 'input.photo.repeat'
        ) {
          if (ws.data.identity.endpoint !== 'browser' || !coordinator.publicPhotoEnabled()) {
            error(
              ws,
              'UNAVAILABLE',
              'Photo Story is available only on an enabled browser endpoint',
              event.event_id,
            );
            return;
          }
          // The generic owner/current-generation guards above bind all photo actions
          // to this endpoint's profile and current audio lease; clients choose no pack.
          let actionAccepted = false;
          if (event.type !== 'input.photo.repeat') {
            const result =
              event.type === 'input.photo.start'
                ? coordinator.startPhoto(event.event_id)
                : coordinator.handle('activities.submit', {
                    sessionId: current!.id,
                    commandId: event.event_id,
                    ...event.payload,
                  });
            emit(ws, 'command.ack', {
              mode: 'live',
              commandId: event.event_id,
              applied: result.ok,
            });
            if (!result.ok) error(ws, result.error.code, result.error.message, event.event_id);
            broadcast();
            if (!result.ok) return;
            if (event.type === 'input.photo.start') {
              const view = coordinator.photoView();
              if (!view || view.phase === 'unavailable') return;
              const talk = coordinator.handle('activities.submit', {
                sessionId: current!.id,
                commandId: `photo-talk-${crypto.randomUUID()}`,
                instanceId: view.instanceId,
                expectedRevision: view.revision,
                action: { type: 'photo.talk' },
              });
              broadcast();
              if (!talk.ok) {
                error(ws, talk.error.code, talk.error.message, event.event_id);
                return;
              }
            } else if (event.payload.action.type !== 'photo.talk') return;
            actionAccepted = true;
          }
          // Provider work is never awaited by the socket handler. Stop/Pause/mute,
          // profile changes and handoff can immediately invalidate the result.
          const selected = coordinator.snapshot()!;
          const purpose = event.type === 'input.photo.repeat' ? 'photo_repeat' : 'photo_opening';
          const speak =
            event.type === 'input.photo.start'
              ? coordinator.speakPhotoOpening.bind(coordinator)
              : coordinator.speakText.bind(coordinator);
          const work = speak(
            {
              sessionId: selected.id,
              expectedGeneration: selected.generation,
              commandId: event.event_id,
              text: 'Photo Story',
              language: coordinator.language(),
              purpose,
            },
            ws.data.playbackRates,
            ws.data.outputWindow,
          );
          broadcast();
          void work
            .then((result) => {
              if (!sockets.has(ws) || !access.current(ws.data.identity)) return;
              const latest = coordinator.snapshot();
              if (
                result.ok &&
                result.data.kind === 'reply' &&
                (!ownsEndpoint(ws.data.identity) ||
                  !coordinator.isCurrentTextReply(result.data.reply.turnId) ||
                  !latest ||
                  latest.phase === 'ended' ||
                  latest.phase === 'paused' ||
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
                  'Discarded obsolete Photo Story output',
                  event.event_id,
                );
                return;
              }
              if (!actionAccepted)
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
                error(ws, 'UNAVAILABLE', 'Photo Story conversation unavailable', event.event_id);
            });
          return;
        }
        if (event.type === 'input.speak' || media) {
          if (
            !ws.data.playbackRates.length ||
            current?.endpoint !== (ws.data.identity.endpoint ?? 'robot')
          ) {
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
              ws.data.outputWindow,
            );
            emit(ws, 'command.ack', {
              mode: 'live',
              commandId: event.event_id,
              applied: result.ok,
            });
            if (!result.ok) error(ws, result.error.code, result.error.message, event.event_id);
            if (result.ok && result.data.captureGrant)
              transport?.granted(result.data.captureGrant.streamId);
            broadcast();
            return;
          }
          if (event.type === 'audio.chunk') {
            const result = coordinator.acceptCaptureChunk({ ...scope, ...event.payload });
            if (result.ok) transport?.acceptedFrame();
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
        if (event.type === 'audio.end') transport?.report('capture_end');
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
            endpoint: ws.data.identity.endpoint ?? 'robot',
            commandId: event.event_id,
          });
          if (result.ok && current?.id !== coordinator.snapshot()?.id) {
            coordinator.bindEndpoint(ws.data.identity.deviceId);
            ws.data.deliveredText.clear();
          }
        } else if (event.type === 'input.handoff' && current) {
          result = coordinator.handle('session.command', {
            sessionId: current.id,
            expectedGeneration: event.generation,
            commandId: event.event_id,
            action: { type: 'handoff', endpoint: ws.data.identity.endpoint ?? 'robot' },
          });
          if (result.ok) coordinator.bindEndpoint(ws.data.identity.deviceId);
        } else if (event.type === 'input.help') {
          result = coordinator.handle('help.create', {
            profileId: ws.data.identity.profileId,
            commandId: event.event_id,
            mode: 'real',
          });
        } else if (
          current &&
          (['input.stop', 'input.pause', 'input.resume', 'input.mute'].includes(event.type) ||
            event.type.startsWith('input.teaching.'))
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
        if (
          result.ok &&
          ((event.type === 'input.start' && current?.id !== coordinator.snapshot()?.id) ||
            event.type === 'input.resume')
        ) {
          const selected = coordinator.snapshot()!;
          void coordinator
            .speakSessionPrompt(
              {
                sessionId: selected.id,
                expectedGeneration: selected.generation,
                commandId: event.event_id,
                language: coordinator.language(),
              },
              ws.data.playbackRates,
              event.type === 'input.resume',
              ws.data.outputWindow,
            )
            .then((spoken) => {
              if (!sockets.has(ws) || !access.current(ws.data.identity)) return;
              if (
                spoken.ok &&
                spoken.data.kind === 'reply' &&
                ownsEndpoint(ws.data.identity) &&
                coordinator.isCurrentTextReply(spoken.data.reply.turnId)
              )
                emit(ws, 'response.text', spoken.data.reply);
              else if (!spoken.ok)
                error(ws, spoken.error.code, spoken.error.message, event.event_id);
              broadcast();
            })
            .catch(() => {
              if (sockets.has(ws))
                error(ws, 'UNAVAILABLE', 'Prompt playback unavailable', event.event_id);
              broadcast();
            });
        }
        emit(ws, 'command.ack', { mode: 'live', commandId: event.event_id, applied: result.ok });
        if (!result.ok) error(ws, result.error.code, result.error.message, event.event_id);
        if (
          result.ok &&
          ws.data.playbackRates.length &&
          [
            'input.teaching.start',
            'input.teaching.next',
            'input.teaching.not_sure',
            'input.teaching.avoid',
          ].includes(event.type)
        ) {
          const selected = coordinator.snapshot()!;
          if (selected.teaching?.prompt)
            void coordinator
              .speakTeachingPrompt(
                {
                  sessionId: selected.id,
                  expectedGeneration: selected.generation,
                  commandId: event.event_id,
                  language: coordinator.language(),
                },
                ws.data.playbackRates,
                ws.data.outputWindow,
              )
              .then((spoken) => {
                if (!spoken.ok && sockets.has(ws))
                  error(ws, spoken.error.code, spoken.error.message, event.event_id);
                broadcast();
              })
              .catch(() => {
                if (sockets.has(ws))
                  error(ws, 'UNAVAILABLE', 'Teaching prompt playback unavailable', event.event_id);
                broadcast();
              });
        }
        broadcast();
      }),
      close(ws, code) {
        ws.data.transport?.report('close', code);
        sockets.delete(ws);
        if (reservations.get(ws.data.identity.deviceId)?.id === ws.data.connectionId) {
          reservations.delete(ws.data.identity.deviceId);
          disconnect(ws.data.identity);
        }
        broadcast();
      },
    },
  });
  let checkingDatabase = false;
  const watchdog = setInterval(() => {
    for (const coordinator of sessions.all()) {
      if (coordinator.sweepTeaching()) broadcast();
      if (coordinator.sweepSpeech()) {
        for (const socket of sockets)
          if (
            socket.data.identity.profileId === coordinator.snapshot()?.profileId &&
            ownsEndpoint(socket.data.identity)
          )
            error(socket, 'UNAVAILABLE', 'Speech deadline expired; retry explicitly');
        broadcast();
      }
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
    for (const [deviceId, reservation] of reservations)
      if (
        elapsedNow() - reservation.at > 6000 &&
        ![...sockets].some((socket) => socket.data.connectionId === reservation.id)
      )
        reservations.delete(deviceId);
    for (const socket of sockets) {
      socket.data.transport?.report('sample');
      if (!access.current(socket.data.identity)) {
        endSession(socket.data.identity);
        closeSocket(socket, 1008, 'Device access expired or revoked');
      } else if (elapsedNow() - socket.data.lastHeartbeat > 6000) {
        disconnect(socket.data.identity);
        closeSocket(socket, 1001, 'Heartbeat timeout');
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
      sessions.disconnect();
      server.stop(true);
      if (data)
        void persist()
          .catch(() => {})
          .finally(() => data.close())
          .catch(() => {});
    },
  };
}
