import { afterAll, beforeAll, expect, test } from 'bun:test';
import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { ServerEventSchema, type ServerEvent, type HelpSnapshot } from '@lemmi/contracts';
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
  return claim.data.credential;
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
  function send(type: string, payload: unknown = {}, commandId = randomUUID()) {
    socket.send(
      JSON.stringify({
        protocol_version: 1,
        event_id: commandId,
        session_id: null,
        turn_id: null,
        generation: 0,
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
        'response is not confirmed',
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
