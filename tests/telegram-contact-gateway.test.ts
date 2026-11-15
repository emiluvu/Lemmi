import { afterAll, beforeAll, expect, test } from 'bun:test';
import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { ServerEventSchema, fail, type ServerEvent, type HelpSnapshot } from '@lemmi/contracts';
import { controlHelloFixture } from '@lemmi/contracts/fixtures';
import {
  database,
  migrate,
  DataRepository,
  PrivateMedia,
  handleHelpHttp,
  type TelegramConfig,
} from '@lemmi/server';
import { startControlGateway } from '../apps/realtime/src/control';

const url = process.env.LEMMI_GATEWAY_CONTACT_TEST_DATABASE_URL;
const dbtest = url ? test : test.skip;
const publicOrigin = 'https://lemmi.invalid';
const internalToken = randomUUID();
const auth = {
  endpoint: 'https://identity.invalid/introspect',
  issuer: 'https://identity.invalid',
  audience: 'lemmi',
  clientId: 'test-server',
  clientSecret: 'fixture-only',
  subject: 'fixture-caregiver',
};
const contactConfig: TelegramConfig = {
  token: '123456:fixture_telegram_token_not_live',
  chatId: '12345',
  profileIds: ['profile-alex'],
  subject: auth.subject,
  autoAlerts: true,
};
let sql: ReturnType<typeof database>;
let gateway: ReturnType<typeof startControlGateway>;
let base: string;
let outcome: 'accepted' | 'failed' = 'accepted';
const sends: string[] = [];
let issuedCredential: string | undefined;
beforeAll(async () => {
  if (!url) return;
  if (!new URL(url).pathname.endsWith('_contact_test'))
    throw new Error('Contact gateway tests require a dedicated _contact_test database');
  sql = database(url);
  await migrate(sql);
  await sql`TRUNCATE lemmi.profiles CASCADE`;
  const repository = new DataRepository(
    sql,
    await PrivateMedia.create(await mkdtemp(join(tmpdir(), 'lemmi-contact-gateway-'))),
  );
  gateway = startControlGateway({
    publicOrigin,
    internalToken,
    port: 0,
    repository,
    caregiverSubject: auth.subject,
    chatAdapter: {
      async complete() {
        return { ok: true, data: { text: 'A fictional garden.', language: 'en' } };
      },
    },
    speech: {
      stt: {
        async transcribe() {
          return { ok: true, data: { text: 'I need assistance', language: 'en' } };
        },
      },
      tts: {
        async synthesize() {
          return {
            ok: true,
            data: {
              pcm: new Uint8Array(1280),
              sampleRate: 16000,
              channels: 1,
              encoding: 'pcm_s16le',
              language: 'en',
            },
          };
        },
      },
    },
    contact: {
      config: contactConfig,
      sender: {
        async send(_chatId, message) {
          sends.push(message);
          return outcome === 'accepted'
            ? { status: 'accepted', messageId: sends.length }
            : { status: 'failed' };
        },
      },
    },
  });
  await gateway.ready;
  base = `http://127.0.0.1:${gateway.server.port}`;
});
afterAll(async () => {
  if (!gateway) return;
  await gateway.contact?.stop();
  gateway.stop();
  await gateway.flush();
  await gateway.data?.close();
  await sql.close();
});
async function providerFetch(target: string | URL | Request, init?: RequestInit) {
  if (String(target) === auth.endpoint) {
    const token = new URLSearchParams(String(init?.body)).get('token');
    return Response.json({
      active: token !== 'invalid',
      sub: token === 'foreign' ? 'foreign-caregiver' : auth.subject,
      iss: auth.issuer,
      aud: auth.audience,
      token_type: 'Bearer',
      exp: Math.floor(Date.now() / 1000) + 300,
    });
  }
  return fetch(target, init);
}
async function helpHttp(
  route: { profileId: string; requestId?: string; action?: 'acknowledge' | 'cancel' | 'resolve' },
  method: 'GET' | 'POST',
  token = 'authorized',
  input?: unknown,
) {
  return handleHelpHttp(
    new Request(
      `${publicOrigin}/v1/profiles/${route.profileId}/help-requests${route.requestId ? `/${route.requestId}` : ''}${route.action ? `/${route.action}` : ''}`,
      {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          origin: publicOrigin,
          'content-type': 'application/json',
        },
        ...(input === undefined ? {} : { body: JSON.stringify(input) }),
      },
    ),
    route,
    { publicOrigin, internalToken, accessKey: null, gatewayPort: gateway.server.port!, auth },
    providerFetch,
  );
}
async function issue() {
  if (issuedCredential) return issuedCredential;
  const pair = await gateway.data!.devices.pair(auth.subject, {
    deviceId: 'stackchan-alex',
    profileId: 'profile-alex',
    commandId: randomUUID(),
  });
  if (!pair.ok) throw new Error(pair.error.message);
  const claim = await gateway.data!.devices.claim({
    pairingId: pair.data.pairingId,
    code: pair.data.code,
    localConfirmed: true,
  });
  if (!claim.ok) throw new Error(claim.error.message);
  issuedCredential = claim.data.credential;
  return issuedCredential;
}
function client(credential: string) {
  const socket = new WebSocket(`${base.replace('http:', 'ws:')}/v1/device-stream`, {
    headers: {
      authorization: `Bearer ${credential}`,
      host: 'lemmi.invalid',
      'x-forwarded-proto': 'https',
    },
  });
  const messages: ServerEvent[] = [];
  let sequence = 0;
  const opened = new Promise<void>((resolve, reject) => {
    socket.onopen = () => resolve();
    socket.onerror = () => reject(new Error('Fixture control socket unavailable'));
  });
  socket.onmessage = (event) =>
    messages.push(ServerEventSchema.parse(JSON.parse(String(event.data))));
  async function wait(predicate: (event: ServerEvent) => boolean) {
    const deadline = Date.now() + 4000;
    while (Date.now() < deadline) {
      const found = messages.find(predicate);
      if (found) return found;
      await Bun.sleep(5);
    }
    throw new Error('Expected contact event did not arrive');
  }
  function send(
    type: string,
    payload: unknown = {},
    commandId = randomUUID(),
    scope?: { id: string; generation: number; turnId?: string },
  ) {
    socket.send(
      JSON.stringify({
        protocol_version: 1,
        event_id: commandId,
        session_id: scope?.id ?? null,
        turn_id: scope?.turnId ?? null,
        generation: scope?.generation ?? 0,
        sequence: sequence++,
        type,
        payload,
      }),
    );
    return commandId;
  }
  return { socket, messages, opened, send, wait };
}

dbtest(
  'authenticated WebSocket help works without a conversation and duplicate commands create one real request with honest status',
  async () => {
    const c = client(await issue());
    try {
      await c.opened;
      c.send('device.hello', controlHelloFixture.payload);
      await c.wait((event) => event.type === 'device.ready');
      const initial = await c.wait((event) => event.type === 'state.changed');
      expect(initial.type === 'state.changed' && initial.payload.session).toBeNull();
      const commandId = c.send('input.help');
      const ack = await c.wait(
        (event) => event.type === 'command.ack' && event.payload.commandId === commandId,
      );
      expect(ack.type === 'command.ack' && ack.payload.applied).toBe(true);
      const event = await c.wait(
        (event) => event.type === 'help.changed' && event.payload.help.status === 'created',
      );
      expect(event.type).toBe('help.changed');
      if (event.type !== 'help.changed') throw new Error('Missing help state');
      const requestId = event.payload.help.id;
      c.send('input.help', {}, commandId);
      const accepted = await c.wait(
        (event) =>
          event.type === 'help.changed' &&
          event.payload.help.id === requestId &&
          event.payload.help.status === 'accepted',
      );
      expect(accepted.type === 'help.changed' && accepted.payload.help.message).toContain(
        'sent a notification to your trusted contact',
      );
      expect(sends).toHaveLength(1);
      expect((await sql`SELECT * FROM lemmi.help_requests`).length).toBe(1);
      expect(JSON.stringify(c.messages)).not.toContain(contactConfig.token);
      expect(JSON.stringify(c.messages)).not.toContain(contactConfig.chatId);
      const status = await helpHttp({ profileId: 'profile-alex', requestId }, 'GET');
      expect(status.status).toBe(200);
      expect(status.headers.get('cache-control')).toBe('no-store');
      expect(((await status.json()) as { data: HelpSnapshot }).data.status).toBe('accepted');
      const ackRoute = { profileId: 'profile-alex', requestId, action: 'acknowledge' as const };
      expect((await helpHttp(ackRoute, 'GET')).status).toBe(405);
      expect((await gateway.contact!.read('profile-alex', requestId)).status).toBe('accepted');
      expect((await helpHttp(ackRoute, 'POST', 'invalid')).status).toBe(401);
      expect((await helpHttp(ackRoute, 'POST', 'foreign')).status).toBe(403);
      expect(
        (await helpHttp({ ...ackRoute, profileId: 'profile-unassigned' }, 'POST')).status,
      ).toBe(403);
      const response = await helpHttp(ackRoute, 'POST');
      expect(response.status).toBe(200);
      expect(((await response.json()) as { data: HelpSnapshot }).data.status).toBe('acknowledged');
      await c.wait(
        (event) => event.type === 'help.changed' && event.payload.help.status === 'acknowledged',
      );
      expect((await helpHttp({ ...ackRoute, action: 'resolve' }, 'POST')).status).toBe(200);
    } finally {
      c.socket.close();
      await Bun.sleep(10);
    }
  },
);

dbtest(
  'caregiver HTTP creation deduplicates and exposes terminal provider failure without claiming delivery',
  async () => {
    outcome = 'failed';
    const commandId = randomUUID();
    const route = { profileId: 'profile-alex' };
    const created = await helpHttp(route, 'POST', 'authorized', { commandId });
    expect(created.status).toBe(200);
    const help = ((await created.json()) as { data: HelpSnapshot }).data;
    const duplicate = await helpHttp(route, 'POST', 'authorized', { commandId });
    expect(((await duplicate.json()) as { data: HelpSnapshot }).data.id).toBe(help.id);
    const deadline = Date.now() + 4000;
    while (
      Date.now() < deadline &&
      (await gateway.contact!.read('profile-alex', help.id)).status !== 'failed'
    )
      await Bun.sleep(10);
    const status = await helpHttp({ ...route, requestId: help.id }, 'GET');
    const failed = ((await status.json()) as { data: HelpSnapshot }).data;
    expect(failed.status).toBe('failed');
    expect(failed.message).toContain("couldn't confirm contact");
    expect(sends).toHaveLength(2);
    expect(
      (await helpHttp(route, 'POST', 'authorized', { commandId: randomUUID(), chatId: 'forged' }))
        .status,
    ).toBe(400);
  },
);

dbtest(
  'an obsolete contact-save failure cannot retire a fresh listening turn after Stop and Start',
  async () => {
    const originalCreate = gateway.contact!.create;
    let release!: () => void;
    let trigger: Parameters<typeof originalCreate>[0] | undefined;
    gateway.contact!.create = async (input) => {
      trigger = input;
      return new Promise((resolve) => {
        release = () => resolve(fail('REVISION_CONFLICT', 'Canceled fixture contact trigger'));
      });
    };
    const c = client(await issue());
    const latest = () =>
      [...c.messages].reverse().find((event) => event.type === 'state.changed') as
        | Extract<ServerEvent, { type: 'state.changed' }>
        | undefined;
    const session = () => latest()?.payload.session;
    async function until(predicate: () => boolean) {
      const deadline = Date.now() + 4000;
      while (!predicate()) {
        if (Date.now() >= deadline) throw new Error('Contact cancellation fixture deadline');
        await Bun.sleep(5);
      }
    }
    const scoped = (type: string, payload: unknown = {}, turnId?: string) => {
      const current = session();
      if (!current) throw new Error('Current fixture session required');
      return c.send(type, payload, randomUUID(), {
        id: current.id,
        generation: current.generation,
        turnId,
      });
    };
    try {
      await c.opened;
      c.send('device.hello', {
        firmwareVersion: 'contact-cancel-fixture',
        endpoint: 'robot',
        cameraSupported: false,
        pettingSupported: false,
        audio: { encoding: 'pcm_s16le', sampleRate: 16000, channels: 1, frameMs: 20 },
        playback: { encoding: 'pcm_s16le', channels: 1, sampleRates: [16000] },
      });
      await c.wait((event) => event.type === 'device.ready');
      c.send('input.start');
      await until(() => !!session());
      const firstSession = session()!.id;
      scoped('input.text', { text: 'I need assistance', language: 'en' });
      await until(() => !!trigger);
      expect(trigger?.current?.()).toBe(true);
      scoped('input.stop');
      await until(() => session()?.phase === 'ended');
      c.send('input.start');
      await until(() => !!session() && session()!.id !== firstSession);
      const newSession = session()!.id;
      const opening = await c.wait(
        (event) => event.type === 'response.start' && event.session_id === newSession,
      );
      if (opening.type !== 'response.start') throw new Error('Missing fixture greeting');
      const meta = opening.payload;
      await until(
        () =>
          c.messages.filter(
            (event) => event.type === 'audio.chunk' && event.payload.streamId === meta.streamId,
          ).length === meta.chunkCount,
      );
      scoped(
        'audio.receipt',
        { leaseId: meta.leaseId, streamId: meta.streamId, status: 'started', playedChunks: 0 },
        meta.turnId,
      );
      scoped(
        'audio.receipt',
        {
          leaseId: meta.leaseId,
          streamId: meta.streamId,
          status: 'completed',
          playedChunks: meta.chunkCount,
        },
        meta.turnId,
      );
      await until(() => session()?.phase === 'waiting');
      scoped('input.mute', { muted: false });
      await until(() => session()?.micMuted === false);
      scoped('input.speak', { language: 'en' });
      await until(() => session()?.phase === 'listening' && !!session()?.captureGrant);
      const turnId = session()!.captureGrant!.turnId;
      expect(trigger?.current?.()).toBe(false);
      const before = c.messages.length;
      release();
      await Bun.sleep(30);
      expect(c.messages.slice(before).filter((event) => event.type === 'error')).toEqual([]);
      expect(session()?.phase).toBe('listening');
      expect(session()?.captureGrant?.turnId).toBe(turnId);
    } finally {
      release?.();
      gateway.contact!.create = originalCreate;
      c.socket.close();
      await Bun.sleep(10);
    }
  },
);
