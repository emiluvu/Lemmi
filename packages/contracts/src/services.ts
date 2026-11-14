import { z } from 'zod';
import {
  PhotoStoryCommandSchema,
  PhotoStoryResultSchema,
  PhotoStoryStatusSchema,
} from './photo-story';
import {
  ProfileDetailSchema,
  ProfileUpdateSchema,
  AssetCreateSchema,
  AssetMetadataSchema,
  AssetIdSchema,
} from './profile-assets';
import {
  IdSchema,
  RevisionSchema,
  ParticipantProfileSchema,
  CaregiverProfileSchema,
  PreviewProfileSchema,
  PreferencesSnapshotSchema,
  PreferenceSignalSchema,
  AssetManifestSchema,
  type Result,
} from './common';
import { SessionSnapshotSchema, SessionCommandSchema, EndpointSchema } from './session';
import {
  ActivityIdSchema,
  ActivityViewSchema,
  ActivityCommandSchema,
  ActivityEventSchema,
} from './activity';
import { CheckInSnapshotSchema } from './device';
import {
  PairDeviceInputSchema,
  PairDeviceResultSchema,
  ClaimDeviceInputSchema,
  ClaimDeviceResultSchema,
  RevokeDeviceInputSchema,
  RevokeDeviceResultSchema,
} from './device-access';
export const HelpSnapshotSchema = z.strictObject({
  id: IdSchema,
  profileId: IdSchema,
  status: z.enum([
    'created',
    'sending',
    'accepted',
    'delivery_unknown',
    'delivered',
    'acknowledged',
    'failed',
    'no_response',
    'canceled',
    'expired',
    'resolved',
  ]),
  mode: z.enum(['simulation', 'real']),
  reason: z.enum(['manual', 'urgent_concern']),
  message: z.string().max(200),
});
export const JournalEventSchema = z.union([
  ...ActivityEventSchema.options.map((event) =>
    event.extend({ source: z.literal('measured_event') }),
  ),
  z.strictObject({ type: z.literal('session_stopped'), source: z.literal('measured_event') }),
]);
export const JournalSchema = z.strictObject({
  profileId: IdSchema,
  mode: z.enum(['mock', 'live']),
  sessions: z
    .array(
      z.strictObject({
        sessionId: IdSchema,
        events: z.array(JournalEventSchema).max(100),
        summary: z.null(),
      }),
    )
    .max(100),
});
const profile = z.strictObject({ profileId: IdSchema });
const session = z.strictObject({ sessionId: IdSchema });
const none = z.strictObject({});
const done = z.strictObject({ applied: z.boolean() });
const operation = <I extends z.ZodType, O extends z.ZodType>(input: I, output: O) => ({
  input,
  output,
});
export const operations = {
  'photoStory.turn': operation(PhotoStoryCommandSchema, PhotoStoryResultSchema),
  'photoStory.status': operation(none, PhotoStoryStatusSchema),
  'device.pair': operation(PairDeviceInputSchema, PairDeviceResultSchema),
  'device.claim': operation(ClaimDeviceInputSchema, ClaimDeviceResultSchema),
  'device.revoke': operation(RevokeDeviceInputSchema, RevokeDeviceResultSchema),
  'profile.load': operation(profile, ParticipantProfileSchema),
  'profile.detail': operation(profile, ProfileDetailSchema),
  'profile.update': operation(ProfileUpdateSchema, ProfileDetailSchema),
  'assets.create': operation(AssetCreateSchema, AssetMetadataSchema),
  'assets.metadata': operation(z.strictObject({ assetId: AssetIdSchema }), AssetMetadataSchema),
  'profile.loadCaregiver': operation(profile, CaregiverProfileSchema),
  'profile.save': operation(
    z.strictObject({ profile: CaregiverProfileSchema, expectedRevision: RevisionSchema }),
    CaregiverProfileSchema,
  ),
  'profile.previews': operation(none, z.array(PreviewProfileSchema)),
  'session.start': operation(
    z.strictObject({ profileId: IdSchema, commandId: IdSchema, endpoint: EndpointSchema }),
    SessionSnapshotSchema,
  ),
  'session.get': operation(session, SessionSnapshotSchema),
  'session.command': operation(SessionCommandSchema, SessionSnapshotSchema),
  'activities.list': operation(
    profile,
    z.array(
      z.strictObject({
        activityId: ActivityIdSchema,
        packId: IdSchema,
        packVersion: z.literal(1),
        implemented: z.boolean(),
      }),
    ),
  ),
  'activities.start': operation(
    z.strictObject({
      sessionId: IdSchema,
      commandId: IdSchema,
      activityId: ActivityIdSchema,
      packId: IdSchema,
      packVersion: z.literal(1),
    }),
    ActivityViewSchema,
  ),
  'activities.view': operation(
    z.strictObject({ sessionId: IdSchema, instanceId: IdSchema }),
    ActivityViewSchema,
  ),
  'activities.submit': operation(ActivityCommandSchema, ActivityViewSchema),
  'help.create': operation(
    z.strictObject({
      profileId: IdSchema,
      commandId: IdSchema,
      mode: z.enum(['simulation', 'real']),
    }),
    HelpSnapshotSchema,
  ),
  'help.status': operation(z.strictObject({ requestId: IdSchema }), HelpSnapshotSchema),
  'help.acknowledge': operation(z.strictObject({ requestId: IdSchema }), HelpSnapshotSchema),
  'help.cancel': operation(z.strictObject({ requestId: IdSchema }), HelpSnapshotSchema),
  'preferences.load': operation(profile, PreferencesSnapshotSchema),
  'preferences.update': operation(
    z.strictObject({
      profileId: IdSchema,
      expectedRevision: RevisionSchema,
      rememberingEnabled: z.boolean(),
    }),
    PreferencesSnapshotSchema,
  ),
  'preferences.forget': operation(profile, done),
  'preferences.signal': operation(PreferenceSignalSchema, done),
  'journal.load': operation(profile, JournalSchema),
  'journal.observe': operation(
    z.strictObject({ sessionId: IdSchema, text: z.string().max(1000) }),
    done,
  ),
  'journal.editSummary': operation(
    z.strictObject({
      summaryId: IdSchema,
      expectedRevision: RevisionSchema,
      text: z.string().max(2000),
    }),
    done,
  ),
  'journal.removeSummary': operation(
    z.strictObject({ summaryId: IdSchema, expectedRevision: RevisionSchema }),
    done,
  ),
  'journal.reviewSummary': operation(
    z.strictObject({ summaryId: IdSchema, expectedRevision: RevisionSchema }),
    done,
  ),
  'assets.resolve': operation(
    z.strictObject({ profileId: IdSchema, assetId: IdSchema }),
    AssetManifestSchema,
  ),
  'checkIn.status': operation(profile, CheckInSnapshotSchema),
  'checkIn.request': operation(
    z.strictObject({ profileId: IdSchema, deviceId: IdSchema, commandId: IdSchema }),
    CheckInSnapshotSchema,
  ),
  'checkIn.end': operation(
    z.strictObject({ checkInId: IdSchema, commandId: IdSchema }),
    CheckInSnapshotSchema,
  ),
  'overview.load': operation(
    profile,
    z.strictObject({
      profile: ParticipantProfileSchema,
      previews: z.array(PreviewProfileSchema),
      mode: z.literal('mock'),
      readiness: z.literal('not_configured'),
    }),
  ),
} as const;
export type Operation = keyof typeof operations;
export type OperationInput<K extends Operation> = z.infer<(typeof operations)[K]['input']>;
export type OperationOutput<K extends Operation> = z.infer<(typeof operations)[K]['output']>;
export interface ServiceTransport {
  call<K extends Operation>(
    operation: K,
    input: OperationInput<K>,
  ): Promise<Result<OperationOutput<K>>>;
}
export function createClients(transport: ServiceTransport) {
  const call = transport.call.bind(transport) as ServiceTransport['call'];
  const subscribe = <K extends Operation>(
    op: K,
    input: OperationInput<K>,
    listener: (value: Result<OperationOutput<K>>) => void,
  ) => subscribeOperation(transport, op, input, listener);
  return {
    photoStory: {
      turn: (input: OperationInput<'photoStory.turn'>) => call('photoStory.turn', input),
      status: () => call('photoStory.status', {}),
    },
    device: {
      pair: (input: OperationInput<'device.pair'>) => call('device.pair', input),
      claim: (input: OperationInput<'device.claim'>) => call('device.claim', input),
      revoke: (input: OperationInput<'device.revoke'>) => call('device.revoke', input),
    },
    profile: {
      detail: (input: OperationInput<'profile.detail'>) => call('profile.detail', input),
      update: (input: OperationInput<'profile.update'>) => call('profile.update', input),
      load: (input: OperationInput<'profile.load'>) => call('profile.load', input),
      loadCaregiver: (input: OperationInput<'profile.loadCaregiver'>) =>
        call('profile.loadCaregiver', input),
      save: (input: OperationInput<'profile.save'>) => call('profile.save', input),
      previews: () => call('profile.previews', {}),
    },
    session: {
      subscribe: (
        input: OperationInput<'session.get'>,
        listener: (value: Result<OperationOutput<'session.get'>>) => void,
      ) => subscribe('session.get', input, listener),
      start: (input: OperationInput<'session.start'>) => call('session.start', input),
      get: (input: OperationInput<'session.get'>) => call('session.get', input),
      command: (input: OperationInput<'session.command'>) => call('session.command', input),
    },
    activities: {
      subscribe: (
        input: OperationInput<'activities.view'>,
        listener: (value: Result<OperationOutput<'activities.view'>>) => void,
      ) => subscribe('activities.view', input, listener),
      list: (input: OperationInput<'activities.list'>) => call('activities.list', input),
      start: (input: OperationInput<'activities.start'>) => call('activities.start', input),
      view: (input: OperationInput<'activities.view'>) => call('activities.view', input),
      submit: (input: OperationInput<'activities.submit'>) => call('activities.submit', input),
    },
    help: {
      create: (input: OperationInput<'help.create'>) => call('help.create', input),
      status: (input: OperationInput<'help.status'>) => call('help.status', input),
      acknowledge: (input: OperationInput<'help.acknowledge'>) => call('help.acknowledge', input),
      cancel: (input: OperationInput<'help.cancel'>) => call('help.cancel', input),
    },
    preferences: {
      load: (input: OperationInput<'preferences.load'>) => call('preferences.load', input),
      update: (input: OperationInput<'preferences.update'>) => call('preferences.update', input),
      forget: (input: OperationInput<'preferences.forget'>) => call('preferences.forget', input),
      signal: (input: OperationInput<'preferences.signal'>) => call('preferences.signal', input),
    },
    journal: {
      load: (input: OperationInput<'journal.load'>) => call('journal.load', input),
      observe: (input: OperationInput<'journal.observe'>) => call('journal.observe', input),
      editSummary: (input: OperationInput<'journal.editSummary'>) =>
        call('journal.editSummary', input),
      removeSummary: (input: OperationInput<'journal.removeSummary'>) =>
        call('journal.removeSummary', input),
      reviewSummary: (input: OperationInput<'journal.reviewSummary'>) =>
        call('journal.reviewSummary', input),
    },
    assets: {
      create: (input: OperationInput<'assets.create'>) => call('assets.create', input),
      metadata: (input: OperationInput<'assets.metadata'>) => call('assets.metadata', input),
      resolve: (input: OperationInput<'assets.resolve'>) => call('assets.resolve', input),
    },
    checkIn: {
      subscribe: (
        input: OperationInput<'checkIn.status'>,
        listener: (value: Result<OperationOutput<'checkIn.status'>>) => void,
      ) => subscribe('checkIn.status', input, listener),
      status: (input: OperationInput<'checkIn.status'>) => call('checkIn.status', input),
      request: (input: OperationInput<'checkIn.request'>) => call('checkIn.request', input),
      end: (input: OperationInput<'checkIn.end'>) => call('checkIn.end', input),
    },
    overview: { load: (input: OperationInput<'overview.load'>) => call('overview.load', input) },
  };
}
export type ServiceClients = ReturnType<typeof createClients>;
export type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
export function createHttpTransport(
  mode: 'mock' | 'live',
  fetcher: Fetcher = fetch,
): ServiceTransport {
  return {
    async call<K extends Operation>(
      op: K,
      input: OperationInput<K>,
    ): Promise<Result<OperationOutput<K>>> {
      if (!operations[op].input.safeParse(input).success)
        return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid command' } };
      try {
        let path = `/v1/${mode}/${op}`;
        let method = 'POST';
        let body: unknown = input;
        if (mode === 'live') {
          if (op === 'profile.load' && 'profileId' in input) {
            path = `/v1/participant/profiles/${encodeURIComponent(input.profileId as string)}`;
            method = 'GET';
            body = undefined;
          }
          if ((op === 'profile.detail' || op === 'profile.update') && 'profileId' in input) {
            path = `/v1/profiles/${encodeURIComponent(input.profileId as string)}`;
            method = op === 'profile.update' ? 'PATCH' : 'GET';
            body = method === 'GET' ? undefined : input;
          }
          if (op === 'assets.create' && 'profileId' in input)
            path = `/v1/profiles/${encodeURIComponent(input.profileId as string)}/assets`;
          if (op === 'assets.metadata' && 'assetId' in input) {
            path = `/v1/assets/${encodeURIComponent(input.assetId as string)}/metadata`;
            method = 'GET';
            body = undefined;
          }
          if (op === 'device.claim') path = '/v1/device-pairings/claim';
          if ((op === 'device.pair' || op === 'device.revoke') && 'deviceId' in input)
            path = `/v1/devices/${encodeURIComponent(input.deviceId as string)}/${op === 'device.pair' ? 'pairings' : 'revoke'}`;
        }
        const response = await fetcher(path, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: AbortSignal.timeout(op === 'photoStory.turn' ? 65000 : 5000),
        });
        const result: unknown = await response.json();
        const parsed = z
          .discriminatedUnion('ok', [
            z.strictObject({ ok: z.literal(true), data: operations[op].output }),
            z.strictObject({
              ok: z.literal(false),
              error: z.strictObject({
                code: z.enum([
                  'UNAUTHORIZED',
                  'FORBIDDEN',
                  'REVISION_CONFLICT',
                  'UNAVAILABLE',
                  'NOT_FOUND',
                  'VALIDATION_ERROR',
                  'SAVE_FAILED',
                ]),
                message: z.string().max(300),
              }),
            }),
          ])
          .safeParse(result);
        return parsed.success
          ? (parsed.data as Result<OperationOutput<K>>)
          : { ok: false, error: { code: 'UNAVAILABLE', message: 'Invalid service response' } };
      } catch {
        return {
          ok: false,
          error: { code: 'UNAVAILABLE', message: 'Service unavailable; no mock fallback was used' },
        };
      }
    },
  };
}

export function createFixtureTransport(
  fixtures: Partial<Record<Operation, Result<unknown>>>,
): ServiceTransport {
  return {
    async call<K extends Operation>(
      op: K,
      input: OperationInput<K>,
    ): Promise<Result<OperationOutput<K>>> {
      if (!operations[op].input.safeParse(input).success)
        return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid fixture input' } };
      const result = fixtures[op];
      if (!result)
        return {
          ok: false,
          error: { code: 'UNAVAILABLE', message: 'No explicit fixture configured' },
        };
      if (result.ok && !operations[op].output.safeParse(result.data).success)
        return {
          ok: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid fixture response' },
        };
      return structuredClone(result) as Result<OperationOutput<K>>;
    },
  };
}

export type Journal = z.infer<typeof JournalSchema>;
export type HelpSnapshot = z.infer<typeof HelpSnapshotSchema>;

export function subscribeOperation<K extends Operation>(
  transport: ServiceTransport,
  op: K,
  input: OperationInput<K>,
  listener: (value: Result<OperationOutput<K>>) => void,
  intervalMs = 1000,
): () => void {
  let active = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  async function poll() {
    let result: Result<OperationOutput<K>>;
    try {
      result = await transport.call(op, input);
    } catch {
      result = {
        ok: false,
        error: { code: 'UNAVAILABLE', message: 'Subscription transport unavailable' },
      };
    }
    if (!active) return;
    listener(result);
    if (active)
      timer = setTimeout(
        () => {
          void poll();
        },
        Math.max(250, intervalMs),
      );
  }
  void poll();
  return () => {
    active = false;
    if (timer) clearTimeout(timer);
  };
}
