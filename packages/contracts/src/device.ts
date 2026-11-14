import { z } from 'zod';
import { IdSchema, RevisionSchema, ErrorCodeSchema } from './common';
import { SessionSnapshotSchema } from './session';
import { ConversationReplySchema } from './conversation';
import {
  PlaybackCapabilitySchema,
  PlaybackReceiptPayloadSchema,
  SpeechOutputStartSchema,
  SpeechOutputChunkSchema,
} from './speech';
export const CheckInStateSchema = z.enum([
  'off',
  'requested',
  'starting',
  'active',
  'ended',
  'unavailable',
]);
export const CheckInSnapshotSchema = z.strictObject({
  checkInId: IdSchema,
  profileId: IdSchema,
  deviceId: IdSchema,
  revision: RevisionSchema,
  privacyRevision: RevisionSchema,
  state: CheckInStateSchema,
  viewerDisplayName: z.string().max(80),
  requestedAt: z.string().nullable(),
  allowedAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
  reason: z
    .enum([
      'disabled',
      'awaiting_allow',
      'declined',
      'timeout',
      'stopped',
      'disconnected',
      'revoked',
      'unsupported',
    ])
    .nullable(),
  latestFrameSequence: RevisionSchema.nullable(),
  fresh: z.boolean(),
  mode: z.enum(['mock', 'live']),
});
export type CheckInSnapshot = z.infer<typeof CheckInSnapshotSchema>;
export const DeviceHealthSchema = z.strictObject({
  firmwareVersion: z.string().max(80),
  linkState: z.enum(['connected', 'disconnected']),
  sampledAt: z.string(),
  batteryVoltage: z.number().min(0).max(30).optional(),
  batteryCurrent: z.number().min(-20).max(20).optional(),
});
export const CameraFrameHeaderSchema = z.strictObject({
  checkInId: IdSchema,
  generation: RevisionSchema,
  sequence: RevisionSchema,
  encoding: z.literal('jpeg'),
  width: z.number().int().positive().max(320),
  height: z.number().int().positive().max(240),
  captureMonotonicMs: z.number().nonnegative(),
  byteLength: z.number().int().positive().max(65536),
});
const base = {
  protocol_version: z.literal(1),
  event_id: IdSchema,
  session_id: IdSchema.nullable(),
  turn_id: IdSchema.nullable(),
  generation: RevisionSchema,
  sequence: RevisionSchema,
};
export const DeviceEventSchema = z.discriminatedUnion('type', [
  z.strictObject({
    ...base,
    type: z.literal('device.hello'),
    payload: z.strictObject({
      firmwareVersion: z.string().max(80),
      endpoint: z.enum(['browser', 'robot']).optional(),
      cameraSupported: z.boolean(),
      pettingSupported: z.boolean(),
      playback: PlaybackCapabilitySchema.optional(),
      audio: z.union([
        z.strictObject({ supported: z.literal(false) }),
        z.strictObject({
          encoding: z.literal('pcm_s16le'),
          sampleRate: z.literal(16000),
          channels: z.literal(1),
          frameMs: z.literal(20),
        }),
      ]),
    }),
  }),
  z.strictObject({
    ...base,
    type: z.enum([
      'heartbeat',
      'input.start',
      'input.handoff',
      'input.stop',
      'input.pause',
      'input.resume',
      'input.help',
    ]),
    payload: z.strictObject({}),
  }),
  z.strictObject({
    ...base,
    type: z.literal('input.text'),
    payload: z.strictObject({
      text: z.string().trim().min(1).max(1000),
      language: z.enum(['en', 'de']),
    }),
  }),
  z.strictObject({
    ...base,
    type: z.literal('input.speak'),
    payload: z.strictObject({ language: z.enum(['en', 'de']) }),
  }),
  z.strictObject({
    ...base,
    type: z.literal('audio.end'),
    payload: z.strictObject({
      leaseId: IdSchema,
      streamId: IdSchema,
      chunkCount: z.number().int().positive().max(1000),
    }),
  }),
  z.strictObject({
    ...base,
    type: z.literal('audio.receipt'),
    payload: PlaybackReceiptPayloadSchema,
  }),
  z.strictObject({
    ...base,
    type: z.literal('input.mute'),
    payload: z.strictObject({ muted: z.boolean() }),
  }),
  z.strictObject({
    ...base,
    type: z.enum(['camera.allow', 'camera.decline', 'camera.started', 'camera.ended']),
    payload: z.strictObject({ checkInId: IdSchema, consentNonce: IdSchema }),
  }),
  z.strictObject({
    ...base,
    type: z.literal('audio.chunk'),
    payload: z.strictObject({
      leaseId: IdSchema,
      streamId: IdSchema,
      chunkIndex: RevisionSchema.optional(),
      encoding: z.literal('pcm_s16le'),
      data: z
        .string()
        .length(856)
        .regex(/^[A-Za-z0-9+/]+={0,2}$/)
        .refine((value) => {
          try {
            return atob(value).length === 640;
          } catch {
            return false;
          }
        }, 'Expected one 640-byte PCM frame'),
    }),
  }),
  z.strictObject({ ...base, type: z.literal('device.health'), payload: DeviceHealthSchema }),
]);
export type DeviceEvent = z.infer<typeof DeviceEventSchema>;
// Frame sizes are negotiation targets only. Starter transports reject media/camera events.

export const ServerEventSchema = z.discriminatedUnion('type', [
  z.strictObject({
    ...base,
    type: z.literal('device.ready'),
    payload: z.strictObject({
      mode: z.literal('live'),
      deviceId: IdSchema,
      profileId: IdSchema,
      credentialExpiresAt: z.string().datetime().nullable(),
      audio: z.union([
        z.literal(false),
        z.strictObject({
          encoding: z.literal('pcm_s16le'),
          sampleRate: z.literal(16000),
          channels: z.literal(1),
          frameMs: z.literal(20),
          maxCaptureMs: z.literal(20000),
          playback: PlaybackCapabilitySchema,
          outputWindowChunks: z.literal(4),
        }),
      ]),
      camera: z.literal(false),
      textChat: z.boolean().optional(),
      controls: z
        .array(
          z.enum(['start', 'stop', 'pause', 'resume', 'mute', 'help', 'text', 'speak', 'handoff']),
        )
        .max(9),
    }),
  }),
  z.strictObject({
    ...base,
    type: z.literal('response.start'),
    payload: SpeechOutputStartSchema,
  }),
  z.strictObject({
    ...base,
    type: z.literal('audio.chunk'),
    payload: SpeechOutputChunkSchema,
  }),
  z.strictObject({
    ...base,
    type: z.literal('audio.end'),
    payload: z.strictObject({
      leaseId: IdSchema,
      streamId: IdSchema,
      chunkCount: z.number().int().positive().max(1501),
    }),
  }),
  z.strictObject({
    ...base,
    type: z.literal('response.cancel'),
    payload: z.strictObject({
      leaseId: IdSchema,
      streamId: IdSchema,
      reason: z.literal('interrupted'),
    }),
  }),
  z.strictObject({
    ...base,
    type: z.literal('response.text'),
    payload: ConversationReplySchema,
  }),
  z.strictObject({
    ...base,
    type: z.literal('state.changed'),
    payload: z.strictObject({
      mode: z.enum(['mock', 'live']),
      session: SessionSnapshotSchema.nullable(),
    }),
  }),
  z.strictObject({
    ...base,
    type: z.literal('command.ack'),
    payload: z.strictObject({
      mode: z.enum(['mock', 'live']),
      commandId: IdSchema,
      applied: z.boolean(),
    }),
  }),
  z.strictObject({
    ...base,
    type: z.literal('heartbeat'),
    payload: z.strictObject({ mode: z.enum(['mock', 'live']) }),
  }),
  z.strictObject({
    ...base,
    type: z.literal('error'),
    payload: z.strictObject({
      code: ErrorCodeSchema,
      message: z.string().max(300),
      commandId: IdSchema.optional(),
    }),
  }),
]);
export type ServerEvent = z.infer<typeof ServerEventSchema>;

export type DeviceHealth = z.infer<typeof DeviceHealthSchema>;
export type CameraFrameHeader = z.infer<typeof CameraFrameHeaderSchema>;
