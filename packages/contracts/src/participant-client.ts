import { z } from 'zod';
import { DeviceEventSchema, ServerEventSchema, type ServerEvent } from './device';
import {
  ParticipantProfileSchema,
  ResultSchema,
  type ParticipantProfile,
  type Result,
} from './common';
import { type DemoProfileUpdate, ProfileCreateSchema } from './profile-assets';
import type { SessionSnapshot } from './session';
import type { Fetcher } from './services';

export const ParticipantEndpointSchema = z.strictObject({
  deviceId: z.string().min(1).max(100),
  profileId: z.string().min(1).max(100),
  endpoint: z.enum(['browser', 'robot']),
  expiresAt: z.string().datetime().nullable(),
  profile: ParticipantProfileSchema.optional(),
});
export const ParticipantEnrollmentSchema = ParticipantEndpointSchema.omit({ profile: true }).extend(
  { credential: z.string().min(40).max(100) },
);
export const ParticipantProfilesSchema = z.array(ParticipantProfileSchema).max(100);
export const ParticipantEnrollRequestSchema = z.strictObject({
  profileId: z.string().min(1).max(100),
  endpoint: z.enum(['browser', 'robot']),
});
export const ParticipantReleaseSchema = z.strictObject({ released: z.literal(true) });
export const ParticipantEmptySchema = z.strictObject({});
export const ParticipantCreateSchema = ProfileCreateSchema;
export type ParticipantEndpoint = z.infer<typeof ParticipantEndpointSchema>;
export function createParticipantSetup(fetcher: Fetcher = fetch) {
  async function call<T extends z.ZodType>(
    operation: string,
    schema: T,
    body?: unknown,
  ): Promise<Result<z.infer<T>>> {
    try {
      const response = await fetcher(`/v1/demo/${operation}`, {
        method: body === undefined ? 'GET' : 'POST',
        credentials: 'same-origin',
        headers: body === undefined ? {} : { 'content-type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(8000),
      });
      const bytes = await response.text();
      if (bytes.length > 32768) throw new Error('Setup response too large');
      const result = ResultSchema(z.unknown()).safeParse(JSON.parse(bytes));
      if (result.success) {
        if (!result.data.ok) return { ok: false, error: result.data.error };
        return { ok: true, data: schema.parse(result.data.data) };
      }
    } catch {
      /* one explicit failure, never fixture fallback */
    }
    return {
      ok: false,
      error: { code: 'UNAVAILABLE', message: 'Participant setup unavailable. Try again.' },
    };
  }
  return {
    profiles: () => call('profiles', ParticipantProfilesSchema),
    create: (preferredName: string, avatarId: ParticipantProfile['avatarId'] = 'lemming') =>
      call('profiles', ParticipantProfileSchema, { preferredName, avatarId }),
    update: (input: DemoProfileUpdate) => call('profile-update', ParticipantProfileSchema, input),
    current: () => call('current', ParticipantEndpointSchema),
    enroll: (profileId: string) =>
      call('enroll', ParticipantEndpointSchema, { profileId, endpoint: 'browser' }),
    release: () => call('release', ParticipantReleaseSchema, {}),
  };
}

// Browser cookies authenticate the upgrade; there are no URL tokens or embedded device secrets.
export class ParticipantConnection {
  private socket: WebSocket | null = null;
  private sequence = 0;
  private receivedSequence = -1;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastHeartbeat = 0;
  session: SessionSnapshot | null = null;
  constructor(
    private readonly options: {
      origin: string;
      onEvent: (event: ServerEvent) => void;
      onClose: () => void;
      onError: (message: string) => void;
      hello?: Record<string, unknown>;
    },
  ) {}
  connect() {
    const origin = new URL(this.options.origin);
    if (origin.protocol !== 'https:') throw new Error('Participant connection requires HTTPS');
    this.close();
    this.sequence = 0;
    this.receivedSequence = -1;
    this.session = null;
    const socket = new WebSocket(`wss://${origin.host}/v1/device-stream`);
    this.socket = socket;
    this.lastHeartbeat = performance.now();
    socket.onopen = () => {
      if (this.socket !== socket) return;
      this.send(
        'device.hello',
        this.options.hello ?? {
          firmwareVersion: 'browser-participant/0.1',
          endpoint: 'browser',
          cameraSupported: false,
          pettingSupported: false,
          audio: { supported: false },
        },
        true,
      );
      this.timer = setInterval(() => {
        if (performance.now() - this.lastHeartbeat > 6000) {
          this.options.onError('Connection lost. Reconnect when ready.');
          this.close();
        } else this.send('heartbeat');
      }, 2000);
    };
    socket.onmessage = (message) => {
      if (this.socket !== socket) return;
      const parsed = ServerEventSchema.safeParse(parseJson(message.data));
      if (!parsed.success || parsed.data.sequence <= this.receivedSequence) {
        this.options.onError('Invalid participant state. Reconnect when ready.');
        this.close();
        return;
      }
      const event = parsed.data;
      this.receivedSequence = event.sequence;
      if (event.type === 'heartbeat') this.lastHeartbeat = performance.now();
      if (event.type === 'state.changed') this.session = event.payload.session;
      this.options.onEvent(event);
    };
    socket.onerror = () => {
      if (this.socket === socket)
        this.options.onError('Connection unavailable. Check private access and reconnect.');
    };
    socket.onclose = () => {
      if (this.socket !== socket) return;
      this.cleanup();
      this.socket = null;
      this.options.onClose();
    };
  }
  send(type: string, payload: unknown = {}, independent = false, turnId: string | null = null) {
    if (this.socket?.readyState !== WebSocket.OPEN) return false;
    if (this.socket.bufferedAmount > 64 * 1024) {
      this.options.onError('Connection fell behind. Reconnect when ready.');
      this.close();
      this.options.onClose();
      return false;
    }
    const data = DeviceEventSchema.parse({
      protocol_version: 1,
      event_id: crypto.randomUUID(),
      session_id: independent ? null : (this.session?.id ?? null),
      turn_id: turnId,
      generation: independent ? 0 : (this.session?.generation ?? 0),
      sequence: this.sequence++,
      type,
      payload,
    });
    this.socket.send(JSON.stringify(data));
    return true;
  }
  private cleanup() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
  close() {
    this.cleanup();
    const socket = this.socket;
    this.socket = null;
    socket?.close();
  }
}
function parseJson(value: unknown): unknown {
  try {
    return typeof value === 'string' && value.length <= 32768 ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}
export type { ParticipantProfile };
