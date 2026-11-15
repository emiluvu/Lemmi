import { afterAll, beforeAll, expect, test } from 'bun:test';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { ok, fail } from '@lemmi/contracts';
import { caregiverProfile } from '@lemmi/contracts/fixtures';
import {
  telegramConfig,
  createTelegramSender,
  createOpenRouterConcernAdapter,
  TelegramContactService,
  SessionCoordinator,
  database,
  migrate,
  PrivateMedia,
  DataRepository,
  type TelegramConfig,
  type TelegramSender,
  type CaregiverContact,
  type ConcernAdapter,
  type ContactCategory,
  type ConcernCategory,
} from '@lemmi/server';

const config: TelegramConfig = {
  token: '123456:fixture_token_for_telegram_tests',
  chatId: '12345',
  profileIds: ['profile-alex'],
  subject: 'fixture-caregiver',
  autoAlerts: true,
};
const decisionConfig = {
  apiKey: 'fixture-decision-key',
  model: 'typesafe/jev-1.14' as const,
  timeoutMs: 100,
  threshold: 0.85,
};
function scores(category: ConcernCategory = 'none') {
  return {
    answers: Object.fromEntries(
      ['help_request', 'urgent', 'concern', 'safeguarding', 'departure', 'contact_request'].map(
        (key) => [key, { type: 'noul', noul: key === category ? 0.99 : 0.01 }],
      ),
    ),
  };
}

test('Telegram configuration stays disabled unless explicitly enabled; private credential precedence matches tg-notify', async () => {
  expect(await telegramConfig({})).toBeNull();
  const home = await mkdtemp(join(tmpdir(), 'lemmi-contact-config-'));
  await mkdir(join(home, '.config/telegram-notify'), { recursive: true });
  await writeFile(
    join(home, '.config/telegram-notify/env'),
    `TELEGRAM_BOT_TOKEN='${config.token}'\nTELEGRAM_CHAT_ID=12345\n`,
  );
  const env = {
    LEMMI_TELEGRAM_ENABLED: '1',
    LEMMI_MODE: 'live',
    LEMMI_DATABASE_URL: 'postgres://fixture',
    LEMMI_CAREGIVER_SUBJECT: config.subject,
    LEMMI_TELEGRAM_RECIPIENTS_VERIFIED: '1',
  };
  expect((await telegramConfig(env, home))?.chatId).toBe('12345');
  expect((await telegramConfig({ ...env, TELEGRAM_CHAT_ID: '98765' }, home))?.chatId).toBe('98765');
  for (const change of [
    { LEMMI_MODE: 'mock' },
    { LEMMI_TELEGRAM_RECIPIENTS_VERIFIED: '0' },
    { LEMMI_TELEGRAM_PROFILE_IDS: 'preview-profile' },
    { LEMMI_TELEGRAM_SAFE_CHAT_ID: '12345' },
  ])
    await expect(telegramConfig({ ...env, ...change }, home)).rejects.toThrow();
});

test('Telegram sends only the bounded template over verified HTTPS; acceptance is not delivery', async () => {
  const sender = createTelegramSender(config.token, async (url, init) => {
    expect(String(url)).toBe(`https://api.telegram.org/bot${config.token}/sendMessage`);
    expect(init?.redirect).toBe('error');
    const body = new URLSearchParams(init?.body as string);
    expect(body.get('chat_id')).toBe(config.chatId);
    expect(body.get('text')).toBe('Fictional test');
    return Response.json({ ok: true, result: { message_id: 42, chat: { id: 12345 } } });
  });
  expect(await sender.send(config.chatId, 'Fictional test', new AbortController().signal)).toEqual({
    status: 'accepted',
    messageId: 42,
  });
  for (const response of [
    new Response('secret', { status: 503 }),
    Response.json({ ok: true, result: { message_id: 1, chat: { id: 9 } } }),
    Response.json({ ok: true }),
  ]) {
    const unsafe = createTelegramSender(config.token, async () => response);
    expect(
      await unsafe.send(config.chatId, 'Fictional test', new AbortController().signal),
    ).toEqual({ status: 'unknown' });
  }
  const retry = createTelegramSender(config.token, async () =>
    Response.json({ ok: false, parameters: { retry_after: 1 } }, { status: 429 }),
  );
  expect(await retry.send(config.chatId, 'Fictional test', new AbortController().signal)).toEqual({
    status: 'retry',
    delayMs: 1000,
  });
  const failed = createTelegramSender(config.token, async () =>
    Response.json({ ok: false }, { status: 403 }),
  );
  expect(await failed.send(config.chatId, 'Fictional test', new AbortController().signal)).toEqual({
    status: 'failed',
  });
  const abort = new AbortController();
  const uncooperative = createTelegramSender(
    config.token,
    async () => new Promise<Response>(() => {}),
  );
  const pending = uncooperative.send(config.chatId, 'Fictional test', abort.signal);
  abort.abort();
  expect(await pending).toEqual({ status: 'unknown' });
});

test('Jev concern questions are bounded, multilingual and cannot choose recipients or notification text', async () => {
  for (const category of ['help_request', 'urgent', 'concern', 'safeguarding', 'none'] as const) {
    const adapter = createOpenRouterConcernAdapter(decisionConfig, async (_url, init) => {
      const body = JSON.parse(init?.body as string);
      expect(body.state).toEqual({ text: 'A fictional report', language: 'de' });
      expect(Object.keys(body.questions).sort()).toEqual([
        'concern',
        'contact_request',
        'departure',
        'help_request',
        'safeguarding',
        'urgent',
      ]);
      expect(JSON.stringify(body)).not.toContain(config.chatId);
      expect(body.questions.concern.instructions).toContain('quoted');
      expect(body.provider).toEqual({ data_collection: 'deny', zdr: true, allow_fallbacks: false });
      return Response.json(scores(category));
    });
    expect(
      await adapter.classify('A fictional report', 'de', new AbortController().signal),
    ).toEqual(ok(category));
  }
  const ambiguous = scores('urgent');
  ambiguous.answers.safeguarding!.noul = 0.3;
  expect(
    await createOpenRouterConcernAdapter(decisionConfig, async () =>
      Response.json(ambiguous),
    ).classify('Fictional report', 'en', new AbortController().signal),
  ).toEqual(ok('safeguarding'));
  for (const invalid of [
    { answers: {} },
    { ...scores(), error: 'private' },
    { answers: { ...scores().answers, invented: { type: 'noul', noul: 1 } } },
  ])
    expect(
      (
        await createOpenRouterConcernAdapter(decisionConfig, async () =>
          Response.json(invalid),
        ).classify('Fictional report', 'en', new AbortController().signal)
      ).ok,
    ).toBe(false);
});

function coordinator(contact: CaregiverContact, concerns?: ConcernAdapter) {
  let chats = 0;
  const c = new SessionCoordinator(
    'live',
    {
      async complete(input) {
        chats++;
        return ok({ text: 'We can take our time.', language: input.language });
      },
    },
    undefined,
    Date.now,
    undefined,
    undefined,
    undefined,
    contact,
    concerns,
  );
  c.acceptPersistentProfile({
    ...caregiverProfile,
    revision: 0,
    privacyRevision: 0,
    policyRevision: 0,
    approvedFacts: [],
  });
  c.handle('session.start', {
    profileId: 'profile-alex',
    endpoint: 'browser',
    commandId: randomUUID(),
  });
  return {
    c,
    chats: () => chats,
    say: (text: string) =>
      c.submitText({
        sessionId: c.snapshot()!.id,
        expectedGeneration: c.snapshot()!.generation,
        commandId: randomUUID(),
        text,
        language: 'en',
      }),
  };
}
test('manual help and reviewed assistance/urgent phrases bypass all models, pause immediately and keep raw text out of contact input', async () => {
  for (const text of [
    'Help me',
    'I need assistance',
    'Could you assist me',
    "I can't breathe",
    'I feel unwell',
    'My caregiver is hurting me',
  ]) {
    const calls: unknown[] = [];
    const f = coordinator(
      {
        async create(input) {
          calls.push(input);
          expect(f.c.snapshot()?.phase).toBe('paused');
          return ok({
            id: randomUUID(),
            profileId: input.profileId,
            reason: 'manual',
            status: 'created',
            mode: 'real',
            message: 'Trying contact',
          });
        },
      },
      {
        async classify() {
          throw new Error('Must bypass Jev');
        },
      },
    );
    const result = await f.say(text);
    expect(result.ok).toBe(true);
    expect(f.chats()).toBe(0);
    expect(calls).toHaveLength(1);
    expect(JSON.stringify(calls)).not.toContain(text);
    expect(JSON.stringify(f.c.persistenceSnapshot())).not.toContain(text);
    if (text.startsWith('My caregiver'))
      expect(calls[0]).toMatchObject({ category: 'safeguarding' });
    f.c.disconnect();
  }
});

test('semantic concerns outrank normal generation; late classifications after Stop/mute/disconnect/profile changes never create alerts', async () => {
  let calls = 0;
  const contact: CaregiverContact = {
    async create(input) {
      calls++;
      return ok({
        id: randomUUID(),
        profileId: input.profileId,
        reason: 'concern',
        status: 'created',
        mode: 'real',
        message: 'Trying contact',
      });
    },
  };
  const f = coordinator(contact, {
    async classify() {
      return ok('concern');
    },
  });
  expect((await f.say('A fictional indirect wellbeing report')).ok).toBe(true);
  expect(calls).toBe(1);
  expect(f.chats()).toBe(0);
  expect(f.c.snapshot()?.phase).toBe('paused');
  for (const interruption of ['stop', 'mute', 'disconnect', 'profile']) {
    let finish!: (value: ReturnType<typeof ok<ConcernCategory>>) => void;
    const g = coordinator(contact, {
      classify() {
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
    });
    const pending = g.say('A fictional indirect report');
    await Bun.sleep(0);
    if (interruption === 'disconnect') g.c.disconnect();
    else if (interruption === 'profile') g.c.pauseForProfileUpdate({ preferredName: 'Fixture' });
    else
      g.c.handle('session.command', {
        sessionId: g.c.snapshot()!.id,
        expectedGeneration: g.c.snapshot()!.generation,
        commandId: randomUUID(),
        action: interruption === 'mute' ? { type: 'mute', muted: true } : { type: 'stop' },
      });
    finish(ok('urgent'));
    expect((await pending).ok).toBe(false);
    expect(calls).toBe(1);
  }
});

const url = process.env.LEMMI_CONTACT_TEST_DATABASE_URL;
const dbtest = url ? test : test.skip;
let sql: ReturnType<typeof database>, repo: DataRepository;
beforeAll(async () => {
  if (!url) return;
  if (!new URL(url).pathname.endsWith('_contact_test'))
    throw new Error('Requires dedicated _contact_test database');
  sql = database(url);
  await migrate(sql);
  repo = new DataRepository(
    sql,
    await PrivateMedia.create(await mkdtemp(join(tmpdir(), 'lemmi-contact-media-'))),
  );
});
afterAll(async () => {
  if (sql) await sql.close();
});
async function setup(sender: TelegramSender, options: Partial<TelegramConfig> = {}) {
  await sql`TRUNCATE lemmi.profiles CASCADE`;
  await repo.bootstrap(config.subject);
  const service = new TelegramContactService(sql, { ...config, ...options }, sender);
  await service.initialize();
  return service;
}
const request = (category: ContactCategory = 'help_request', commandId = randomUUID()) => ({
  profileId: 'profile-alex',
  category,
  commandId,
  source: 'manual' as const,
});
function accepted(result: Awaited<ReturnType<CaregiverContact['create']>>) {
  if (!result.ok) throw new Error(result.error.message);
  return result.data;
}

dbtest(
  'durable creation/restart and concurrent duplicates send once; Stop is separate and no content enters durable payloads',
  async () => {
    const messages: string[] = [];
    const sender: TelegramSender = {
      async send(_destination, message) {
        messages.push(message);
        return { status: 'accepted', messageId: 4 };
      },
    };
    const service = await setup(sender),
      cmd = request();
    const results = await Promise.all([
      service.create(cmd),
      service.create(cmd),
      service.create(request()),
    ]);
    const id = accepted(results[0]!).id;
    expect(results.map((r) => accepted(r).id)).toEqual([id, id, id]);
    expect((await service.create({ ...cmd, category: 'urgent' })).ok).toBe(false);
    const restarted = new TelegramContactService(sql, config, sender);
    await restarted.initialize();
    await Promise.all([service.tick(), restarted.tick()]);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('Help requested');
    expect(messages[0]).toContain('fictional demo');
    expect(messages[0]).toContain('Human assistance requested');
    expect(messages[0]).toContain('Please check the caregiver portal.');
    expect((await restarted.read('profile-alex', id)).status).toBe('accepted');
    const rows = await sql`SELECT * FROM lemmi.help_attempts`;
    expect(rows[0].tries).toBe(1);
    expect(rows[0]).not.toHaveProperty('destination');
    expect(rows[0]).not.toHaveProperty('text');
    await service.stop();
    await restarted.stop();
  },
);

dbtest(
  'failed persistence, foreign/example profiles, stale revisions, revoked recipients and safe routing never send',
  async () => {
    let sends = 0;
    const service = await setup({
      async send() {
        sends++;
        return { status: 'accepted', messageId: 1 };
      },
    });
    expect((await service.create({ ...request(), profileId: 'preview-fixture' })).ok).toBe(false);
    expect((await service.create({ ...request(), profileRevision: 999 })).ok).toBe(false);
    expect((await service.create({ ...request(), current: () => false })).ok).toBe(false);
    expect((await service.create(request('safeguarding'))).ok).toBe(false);
    await sql`ALTER TABLE lemmi.help_receipts ADD CONSTRAINT block_receipt CHECK (false) NOT VALID`;
    expect((await service.create(request())).ok).toBe(false);
    await sql`ALTER TABLE lemmi.help_receipts DROP CONSTRAINT block_receipt`;
    expect((await sql`SELECT * FROM lemmi.help_requests`).length).toBe(0);
    const id = accepted(await service.create(request())).id;
    await sql`UPDATE lemmi.contacts SET opted_in=false`;
    await service.tick();
    expect(sends).toBe(0);
    expect((await service.read('profile-alex', id)).status).toBe('canceled');
    await service.stop();
  },
);

dbtest(
  'acknowledgment is authorized, cancels backup, survives late outcomes and never implies arrival; cancellation differs from resolution',
  async () => {
    let finish!: (result: { status: 'accepted'; messageId: number }) => void;
    const service = await setup(
      {
        send() {
          return new Promise((resolve) => {
            finish = resolve;
          });
        },
      },
      { backupChatId: '99999' },
    );
    const id = accepted(await service.create(request())).id;
    const pending = service.tick();
    while (!finish) await Bun.sleep(1);
    await expect(service.update('profile-alex', id, 'acknowledge', 'foreign')).rejects.toThrow();
    const ack = await service.update('profile-alex', id, 'acknowledge', config.subject);
    expect(ack.status).toBe('acknowledged');
    expect(ack.message).toContain('acknowledged');
    expect(ack.message).not.toMatch(/has arrived|on the way/i);
    finish({ status: 'accepted', messageId: 2 });
    await pending;
    expect((await service.read('profile-alex', id)).status).toBe('acknowledged');
    expect((await sql`SELECT state FROM lemmi.help_attempts WHERE slot='backup'`)[0].state).toBe(
      'canceled',
    );
    expect((await service.update('profile-alex', id, 'resolve', config.subject)).status).toBe(
      'resolved',
    );
    const next = accepted(await service.create(request())).id;
    expect((await service.update('profile-alex', next, 'cancel', config.subject)).status).toBe(
      'canceled',
    );
    await expect(service.update('profile-alex', next, 'resolve', config.subject)).rejects.toThrow();
    await service.stop();
  },
);

dbtest(
  'only explicit 429 rejection retries once; uncertain sends and expired crash leases never blindly resend',
  async () => {
    let calls = 0;
    const service = await setup({
      async send() {
        calls++;
        return { status: 'retry', delayMs: 1 };
      },
    });
    const id = accepted(await service.create(request())).id;
    await service.tick();
    await Bun.sleep(3);
    await service.tick();
    await service.tick();
    expect(calls).toBe(2);
    expect((await service.read('profile-alex', id)).status).toBe('failed');
    await service.stop();
    const uncertain = await setup({
      async send() {
        calls++;
        return { status: 'unknown' };
      },
    });
    const unknownId = accepted(await uncertain.create(request())).id;
    await uncertain.tick();
    await uncertain.tick();
    expect(calls).toBe(3);
    expect((await uncertain.read('profile-alex', unknownId)).status).toBe('delivery_unknown');
    expect((await uncertain.read('profile-alex', unknownId)).message).not.toContain('accepted');
    const otherId = accepted(await uncertain.create(request('urgent'))).id;
    await sql`UPDATE lemmi.help_attempts SET state='sending',tries=1,lease_id=${randomUUID()}::uuid,lease_expires_at=now()-interval '1 second' WHERE request_id=${otherId}::uuid`;
    await uncertain.tick();
    expect(calls).toBe(3);
    expect((await uncertain.read('profile-alex', otherId)).status).toBe('delivery_unknown');
    await uncertain.stop();
  },
);

dbtest(
  'terminal failure accelerates backup, no-response expiry stops all future sends, and safeguarding uses only a safe alternate',
  async () => {
    const destinations: string[] = [];
    const service = await setup(
      {
        async send(destination) {
          destinations.push(destination);
          return destination === config.chatId
            ? { status: 'failed' }
            : { status: 'accepted', messageId: 1 };
        },
      },
      { backupChatId: '99999', safeChatId: '88888' },
    );
    const id = accepted(await service.create(request())).id;
    await service.tick();
    await service.tick();
    expect(destinations).toEqual(['12345', '99999']);
    await sql`UPDATE lemmi.help_requests SET expires_at=now()-interval '1 second' WHERE id=${id}::uuid`;
    await service.tick();
    expect((await service.read('profile-alex', id)).status).toBe('no_response');
    const safe = accepted(await service.create(request('safeguarding'))).id;
    await service.tick();
    expect(destinations).toEqual(['12345', '99999', '88888']);
    expect(
      (await sql`SELECT slot FROM lemmi.help_attempts WHERE request_id=${safe}::uuid`).map(
        (r: any) => r.slot,
      ),
    ).toEqual(['safe']);
    await service.stop();
  },
);

dbtest(
  'profile/privacy changes and deletion prevent pending or late work from sending or recreating records',
  async () => {
    let sends = 0;
    const service = await setup({
      async send() {
        sends++;
        return { status: 'accepted', messageId: 1 };
      },
    });
    await service.create(request());
    await sql`UPDATE lemmi.profiles SET privacy_revision=privacy_revision+1`;
    await service.tick();
    expect(sends).toBe(0);
    await service.stop();
    let finish!: (value: { status: 'accepted'; messageId: number }) => void;
    const late = await setup({
      send() {
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
    });
    await late.create(request());
    const pending = late.tick();
    while (!finish) await Bun.sleep(1);
    await sql`DELETE FROM lemmi.profiles WHERE id='profile-alex'`;
    finish({ status: 'accepted', messageId: 1 });
    await pending;
    expect((await sql`SELECT * FROM lemmi.help_requests`).length).toBe(0);
    expect((await sql`SELECT * FROM lemmi.help_attempts`).length).toBe(0);
    await late.stop();
  },
);

dbtest(
  'a trigger canceled after request insertion rolls back the request, receipts and pending attempts',
  async () => {
    let sends = 0,
      checks = 0;
    const service = await setup({
      async send() {
        sends++;
        return { status: 'accepted', messageId: 1 };
      },
    });
    const result = await service.create({ ...request('urgent'), current: () => ++checks < 3 });
    expect(result).toMatchObject({ ok: false, error: { code: 'REVISION_CONFLICT' } });
    expect(checks).toBe(3);
    for (const rows of [
      await sql`SELECT * FROM lemmi.help_requests`,
      await sql`SELECT * FROM lemmi.help_receipts`,
      await sql`SELECT * FROM lemmi.help_attempts`,
    ])
      expect(rows).toHaveLength(0);
    await service.tick();
    expect(sends).toBe(0);
    await service.stop();
  },
);

dbtest(
  'reinitialization preserves contact opt-out, removed verification and disabled routes for unchanged configuration',
  async () => {
    let sends = 0;
    const service = await setup({
      async send() {
        sends++;
        return { status: 'accepted', messageId: 1 };
      },
    });
    await sql`UPDATE lemmi.contacts SET opted_in=false, verified_at=NULL, tested_at=NULL`;
    await sql`UPDATE lemmi.telegram_routes SET enabled=false WHERE profile_id='profile-alex'`;
    await service.initialize();
    const contacts = await sql`SELECT opted_in,verified_at,tested_at FROM lemmi.contacts`;
    expect(contacts[0]).toMatchObject({ opted_in: false, verified_at: null, tested_at: null });
    expect(
      (await sql`SELECT enabled FROM lemmi.telegram_routes WHERE profile_id='profile-alex'`)[0]
        .enabled,
    ).toBe(false);
    expect((await service.create(request())).ok).toBe(false);
    await service.tick();
    expect(sends).toBe(0);
    await service.stop();
  },
);

dbtest(
  'fresh help after a profile revision creates a fresh request instead of reusing an invalid pending request',
  async () => {
    let sends = 0;
    const service = await setup({
      async send() {
        sends++;
        return { status: 'accepted', messageId: 1 };
      },
    });
    const original = accepted(await service.create({ ...request(), profileRevision: 0 }));
    await sql`UPDATE lemmi.profiles SET revision=revision+1 WHERE id='profile-alex'`;
    const fresh = accepted(await service.create({ ...request(), profileRevision: 1 }));
    expect(fresh.id).not.toBe(original.id);
    await service.tick();
    await service.tick();
    expect(sends).toBe(1);
    expect((await service.read('profile-alex', original.id)).status).toBe('canceled');
    expect((await service.read('profile-alex', fresh.id)).status).toBe('accepted');
    await service.stop();
  },
);

dbtest(
  'followup categories honor automatic-alert permission and deliver fixed templates without retaining requested names or utterances',
  async () => {
    const requestedName = 'MayaFixtureUnique';
    const utterance =
      'Please call my sister MayaFixtureUnique about this fictional private conversation';
    const messages: string[] = [];
    const destinations: string[] = [];
    const sender: TelegramSender = {
      async send(destination, message) {
        destinations.push(destination);
        messages.push(message);
        return { status: 'accepted', messageId: messages.length };
      },
    };
    const manualOnly = await setup(sender, { autoAlerts: false });
    try {
      const trigger = {
        ...request('contact_request'),
        source: 'participant_phrase' as const,
        requestedName,
        utterance,
      };
      const contactRequest = accepted(await manualOnly.create(trigger));
      expect(contactRequest.reason).toBe('manual');
      expect(
        (await manualOnly.create({ ...request('departure'), source: 'participant_phrase' })).ok,
      ).toBe(false);
      expect(
        (await manualOnly.create({ ...request('human_support'), source: 'model_reply' })).ok,
      ).toBe(false);
      await manualOnly.tick();
      expect(destinations).toEqual([config.chatId]);
      expect(messages[0]).toContain('Call/contact requested');
      expect((await manualOnly.read('profile-alex', contactRequest.id)).status).toBe('accepted');
      expect((await sql`SELECT * FROM lemmi.help_requests`).length).toBe(1);
    } finally {
      await manualOnly.stop();
    }

    messages.length = 0;
    destinations.length = 0;
    const automatic = await setup(sender, { autoAlerts: true });
    try {
      const categories = [
        {
          category: 'contact_request' as const,
          source: 'participant_phrase' as const,
          label: 'Call/contact requested',
        },
        {
          category: 'departure' as const,
          source: 'participant_phrase' as const,
          label: 'Departure/travel plan reported',
        },
        {
          category: 'human_support' as const,
          source: 'model_reply' as const,
          label: 'Lemmi recommended trusted human support',
        },
      ];
      for (const { category, source } of categories) {
        const trigger = { ...request(category), source, requestedName, utterance };
        accepted(await automatic.create(trigger));
      }
      await automatic.tick();
      await automatic.tick();
      await automatic.tick();
      expect(destinations).toEqual([config.chatId, config.chatId, config.chatId]);
      expect(messages).toHaveLength(3);
      for (const { label } of categories)
        expect(messages.some((message) => message.includes(label))).toBe(true);
      const modelRecommendation = messages.find((message) =>
        message.includes('Lemmi recommended trusted human support'),
      )!;
      expect(modelRecommendation).toContain('Lemmi suggested support from a trusted person');
      expect(modelRecommendation).not.toContain('Participant request/report');
      const rows =
        await sql`SELECT category,source,status FROM lemmi.help_requests ORDER BY category`;
      expect(rows.map((row: any) => row.category)).toEqual([
        'contact_request',
        'departure',
        'human_support',
      ]);
      expect(rows.every((row: any) => row.status === 'accepted')).toBe(true);
      expect(rows.find((row: any) => row.category === 'human_support')?.source).toBe('model_reply');
      const durable = JSON.stringify({
        requests: await sql`SELECT * FROM lemmi.help_requests`,
        receipts: await sql`SELECT * FROM lemmi.help_receipts`,
        attempts: await sql`SELECT * FROM lemmi.help_attempts`,
      });
      for (const value of [durable, ...messages]) {
        expect(value).not.toContain(requestedName);
        expect(value).not.toContain(utterance);
      }
    } finally {
      await automatic.stop();
    }
  },
);
