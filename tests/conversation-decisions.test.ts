import { expect, test } from 'bun:test';
import {
  createOpenRouterDecisionAdapter,
  conversationDecisionConfig,
  DECISION_MODELS,
  SessionCoordinator,
  SessionRegistry,
  createOpenRouterAdapter,
  type ConversationDecisionAdapter,
  type ConversationDecisionInput,
  type ConversationDecision,
  type ChatInput,
} from '@lemmi/server';
import { fail, ok, type Result } from '@lemmi/contracts';
import { caregiverProfile } from '@lemmi/contracts/fixtures';

const config = {
  apiKey: 'fixture-private-decision-key',
  model: DECISION_MODELS[0],
  timeoutMs: 100,
  threshold: 0.85,
};
const input: ConversationDecisionInput = {
  text: 'I need to get to the office before my shift',
  language: 'en',
  history: [],
  topics: [{ id: 'topic_0', label: 'previous employment', offered: false }],
};
const idle: ConversationDecision = {
  recap: false,
  declinesRedirect: false,
  redirectTopicIds: [],
  activity: 'none',
};
function answer(overrides: Record<string, unknown> = {}) {
  return {
    answers: {
      recap: { type: 'noul', noul: 0.01 },
      declines_redirect: { type: 'noul', noul: 0.01 },
      topic_0: { type: 'noul', noul: 0.98 },
      activity: {
        type: 'choice',
        choice: 'none',
        confidence: 0.99,
        probabilities: {
          none: 0.99,
          music_playlist: 0.01,
          twenty_questions: 0,
          photo_album: 0,
          object_matching: 0,
          teach_lemmi: 0,
        },
      },
      ...overrides,
    },
  };
}
function setup(
  detector: ConversationDecisionAdapter,
  reply = 'Would you like to talk about flowers?',
) {
  const chats: ChatInput[] = [];
  const c = new SessionCoordinator(
    'live',
    {
      async complete(value) {
        chats.push(structuredClone(value));
        return ok({ text: reply, language: value.language });
      },
    },
    undefined,
    Date.now,
    undefined,
    undefined,
    detector,
  );
  c.acceptPersistentProfile({
    ...caregiverProfile,
    privacyRevision: 0,
    policyRevision: 0,
    approvedFacts: [],
    conversationRedirects: { awayFrom: ['previous employment'], toward: ['flowers'] },
  });
  const start = () =>
    c.handle('session.start', {
      profileId: caregiverProfile.id,
      endpoint: 'browser',
      commandId: crypto.randomUUID(),
    });
  start();
  const say = (text: string, commandId = crypto.randomUUID()) =>
    c.submitText({
      sessionId: c.snapshot()!.id,
      expectedGeneration: c.snapshot()!.generation,
      commandId,
      text,
      language: 'en',
    });
  const control = (action: Record<string, unknown>) =>
    c.handle('session.command', {
      sessionId: c.snapshot()!.id,
      expectedGeneration: c.snapshot()!.generation,
      commandId: crypto.randomUUID(),
      action,
    });
  return { c, chats, say, control, start };
}

test('decision calls use a fixed endpoint, minimal state, explicit model and strict provider privacy flags', async () => {
  for (const model of DECISION_MODELS) {
    let request: any;
    const adapter = createOpenRouterDecisionAdapter({ ...config, model }, async (url, init) => {
      expect(url).toBe('https://openrouter.ai/api/alpha/decisions');
      expect(init?.redirect).toBe('error');
      request = JSON.parse(init?.body as string);
      expect(new Headers(init?.headers).get('authorization')).toBe(`Bearer ${config.apiKey}`);
      return Response.json(answer());
    });
    expect(await adapter.classify(input, new AbortController().signal)).toEqual(
      ok({ ...idle, redirectTopicIds: ['topic_0'] }),
    );
    expect(request.provider).toEqual({
      data_collection: 'deny',
      zdr: true,
      allow_fallbacks: false,
    });
    expect(request.model).toBe(model);
    expect(request.state).toEqual(input);
    expect(request).not.toHaveProperty('session_id');
    expect(request).not.toHaveProperty('trace');
  }
});

test('disabled by default; enabled configuration rejects auto routing, missing key, bad thresholds/deadlines', () => {
  expect(conversationDecisionConfig({})).toEqual(ok(null));
  const env = { LEMMI_DECISIONS_ENABLED: '1', OPENROUTER_API_KEY: config.apiKey };
  expect(conversationDecisionConfig(env).ok).toBe(true);
  for (const change of [
    { LEMMI_DECISIONS_MODEL: 'openrouter/auto' },
    { OPENROUTER_API_KEY: '' },
    { LEMMI_DECISIONS_THRESHOLD: 'NaN' },
    { LEMMI_DECISIONS_THRESHOLD: '0.2' },
    { LEMMI_DECISIONS_TIMEOUT_MS: '30000' },
    { LEMMI_DECISIONS_SCOPE: 'unrestricted' },
  ])
    expect(conversationDecisionConfig({ ...env, ...change }).ok).toBe(false);
});

test('activity-only scope asks one typed question without caregiver topic labels or conversation classifications', async () => {
  let request: any;
  const adapter = createOpenRouterDecisionAdapter(
    { ...config, scope: 'activities' },
    async (_url, init) => {
      request = JSON.parse(init!.body as string);
      return Response.json({ answers: { activity: answer().answers.activity } });
    },
  );
  expect(adapter.scope).toBe('activities');
  expect(await adapter.classify(input, new AbortController().signal)).toEqual(ok(idle));
  expect(Object.keys(request.questions)).toEqual(['activity']);
  expect(request.state.topics).toEqual([]);
  expect(JSON.stringify(request)).not.toContain('previous employment');
  expect(request.provider).toEqual({ data_collection: 'deny', zdr: true, allow_fallbacks: false });
});

test('an unoffered redirect cannot be declined or veto a clear current-topic decision', async () => {
  const adapter = createOpenRouterDecisionAdapter(config, async () =>
    Response.json(
      answer({
        declines_redirect: { type: 'noul', noul: 0.99 },
      }),
    ),
  );
  expect(await adapter.classify(input, new AbortController().signal)).toEqual(
    ok({ ...idle, redirectTopicIds: ['topic_0'] }),
  );
});

test('activity-only scope retains legacy redirect and reminder behavior', async () => {
  let classifications = 0;
  const f = setup({
    scope: 'activities',
    async classify() {
      classifications++;
      return ok(idle);
    },
  });
  await f.say('My previous employment');
  expect(f.chats[0]?.system).toContain('gentle subject transition');
  await f.say('I am knitting a blue scarf');
  const recap = await f.say('What were we talking about?');
  expect(recap.ok && recap.data.kind === 'reply' && recap.data.reply.text).toContain(
    'knitting a blue scarf',
  );
  expect(classifications).toBe(2);
});

test('an activity confirmation takes precedence over a phrase redirect and is actually spoken', async () => {
  const f = setup({
    scope: 'activities',
    async classify() {
      return ok({ ...idle, activity: 'teach_lemmi' });
    },
  });
  const question = await f.say('My previous employment');
  expect(question.ok && question.data.kind === 'reply' && question.data.reply.text).toBe(
    'Would you like to start Teach Lemmi?',
  );
  expect(f.chats).toHaveLength(0);
  const confirmed = await f.say('Yes, please!');
  expect(confirmed.ok).toBe(true);
  expect(f.c.snapshot()?.conversationMode).toBe('teach_lemmi');
});

test('diagnostics expose only typed scores or fixed failure categories, never provider text', async () => {
  const diagnostics: unknown[] = [];
  for (const response of [
    new Response('private-provider-message', { status: 503 }),
    Response.json({ error: 'private-provider-message' }),
    Response.json(answer()),
  ]) {
    const adapter = createOpenRouterDecisionAdapter(
      config,
      async () => response,
      (value) => diagnostics.push(value),
    );
    await adapter.classify(input, new AbortController().signal);
  }
  expect(diagnostics).toMatchObject([
    { outcome: 'http_error', status: 503 },
    { outcome: 'invalid_response' },
    { outcome: 'answered' },
  ]);
  expect(JSON.stringify(diagnostics)).not.toContain('private-provider-message');
  expect(JSON.stringify(diagnostics)).not.toContain(input.text);
  expect(JSON.stringify(diagnostics)).not.toContain(input.topics[0]!.label);
});

test('low probability abstains, uncertain/clear refusal suppresses redirects, offered topics cannot repeat', async () => {
  for (const probability of [0.01, 0.5, 0.84]) {
    const adapter = createOpenRouterDecisionAdapter(config, async () =>
      Response.json(answer({ topic_0: { type: 'noul', noul: probability } })),
    );
    expect(await adapter.classify(input, new AbortController().signal)).toEqual(ok(idle));
  }
  for (const probability of [0.3, 0.99]) {
    const adapter = createOpenRouterDecisionAdapter(config, async () =>
      Response.json(
        answer({
          declines_redirect: { type: 'noul', noul: probability },
          topic_1: { type: 'noul', noul: 0.99 },
        }),
      ),
    );
    const result = await adapter.classify(
      { ...input, topics: [...input.topics, { id: 'topic_1', label: 'old job', offered: true }] },
      new AbortController().signal,
    );
    expect(result.ok && result.data.redirectTopicIds).toEqual([]);
  }
  const adapter = createOpenRouterDecisionAdapter(config, async () => Response.json(answer()));
  expect(
    await adapter.classify(
      { ...input, topics: [{ ...input.topics[0]!, offered: true }] },
      new AbortController().signal,
    ),
  ).toEqual(ok(idle));
});

test('malformed, invented, missing, out-of-range and contradictory answers never become decisions', async () => {
  const invalid = [
    answer({ recap: { type: 'noul', noul: 1.1 } }),
    answer({ invented: { type: 'noul', noul: 1 } }),
    answer({
      activity: { type: 'choice', choice: 'send_message', confidence: 1, probabilities: {} },
    }),
    answer({
      activity: {
        type: 'choice',
        choice: 'none',
        confidence: 1,
        probabilities: {
          none: 0,
          music_playlist: 1,
          twenty_questions: 0,
          photo_album: 0,
          object_matching: 0,
          teach_lemmi: 0,
        },
      },
    }),
    { answers: {} },
    { error: { message: 'private-provider-content' }, ...answer() },
  ];
  for (const data of invalid) {
    const adapter = createOpenRouterDecisionAdapter(config, async () => Response.json(data));
    expect((await adapter.classify(input, new AbortController().signal)).ok).toBe(false);
  }
});

test('timeouts, HTTP errors and canceled permission never retry or expose provider bodies', async () => {
  let calls = 0;
  const adapter = createOpenRouterDecisionAdapter({ ...config, timeoutMs: 15 }, async () => {
    calls++;
    return new Promise<Response>(() => {});
  });
  expect((await adapter.classify(input, new AbortController().signal)).ok).toBe(false);
  expect(calls).toBe(1);
  const canceled = new AbortController();
  canceled.abort();
  expect((await adapter.classify(input, canceled.signal)).ok).toBe(false);
  expect(calls).toBe(1);
  const denied = createOpenRouterDecisionAdapter(
    config,
    async () => new Response('private-provider-content', { status: 503 }),
  );
  expect(JSON.stringify(await denied.classify(input, new AbortController().signal))).not.toContain(
    'private-provider-content',
  );
});

test('semantic redirect works without a keyword match and receives no full profile or approved facts', async () => {
  let seen!: ConversationDecisionInput;
  const { c, chats, say } = setup({
    async classify(value) {
      seen = value;
      return ok({ ...idle, redirectTopicIds: ['topic_0'] });
    },
  });
  expect((await say(input.text)).ok).toBe(true);
  expect(chats[0]?.system).toContain('gentle subject transition');
  expect(chats[0]?.system).toContain('flowers');
  expect(Object.keys(seen).sort()).toEqual(['history', 'language', 'text', 'topics']);
  expect(JSON.stringify(seen)).not.toContain('sensitiveTopicGuidance');
  expect(JSON.stringify(c.persistenceSnapshot())).not.toContain(input.text);
});

test('semantic reminder handles a paraphrase without generating a made-up memory or replaying redirected text', async () => {
  const { say, chats } = setup({
    async classify(value) {
      return ok({ ...idle, recap: value.text === 'Could you help me pick up that thread again' });
    },
  });
  await say('I am knitting a blue scarf');
  const recap = await say('Could you help me pick up that thread again');
  expect(recap.ok && recap.data.kind === 'reply' && recap.data.reply.text).toContain(
    'knitting a blue scarf',
  );
  expect(chats).toHaveLength(1);
  const repeatedRecap = await say('Could you help me pick up that thread again');
  expect(
    repeatedRecap.ok && repeatedRecap.data.kind === 'reply' && repeatedRecap.data.reply.text,
  ).toContain('knitting a blue scarf');
  expect(chats).toHaveLength(1);
  const redirected = setup({
    async classify(value) {
      return ok({
        ...idle,
        recap: value.text === 'Could you help me pick up that thread again',
        redirectTopicIds: value.text === input.text ? ['topic_0'] : [],
      });
    },
  });
  await redirected.say(input.text);
  const safeRecap = await redirected.say('Could you help me pick up that thread again');
  expect(JSON.stringify(safeRecap)).not.toContain('office');
  expect(JSON.stringify(safeRecap)).toContain('something new');
});

test('immediate controls and fixed concern routes bypass the decision model', async () => {
  let calls = 0;
  const detector: ConversationDecisionAdapter = {
    async classify() {
      calls++;
      return fail('UNAVAILABLE', 'fixture');
    },
  };
  for (const phrase of [
    'Stop',
    'Please pause',
    'Help me',
    "I can't breathe",
    "I don't want to talk about that",
  ]) {
    const { say } = setup(detector);
    await say(phrase);
  }
  expect(calls).toBe(0);
});

test('pending decisions deduplicate; Stop, pause, mute, disconnect and config updates discard late decisions before generation', async () => {
  for (const interruption of ['stop', 'pause', 'mute', 'disconnect', 'config']) {
    let finish!: (value: Result<ConversationDecision>) => void;
    let calls = 0;
    let seenSignal!: AbortSignal;
    const { c, chats, say, control } = setup({
      classify(_value, signal) {
        calls++;
        seenSignal = signal;
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
    });
    const id = crypto.randomUUID();
    const pending = say(input.text, id),
      duplicate = say(input.text, id);
    await Bun.sleep(0);
    expect(calls).toBe(1);
    if (interruption === 'disconnect') c.disconnect();
    else if (interruption === 'config') c.pauseForProfileUpdate({ conversationRedirects: {} });
    else control(interruption === 'mute' ? { type: 'mute', muted: true } : { type: interruption });
    expect(seenSignal.aborted).toBe(true);
    expect((await pending).ok).toBe(false);
    expect(await duplicate).toEqual(await pending);
    finish(ok({ ...idle, redirectTopicIds: ['topic_0'] }));
    await Bun.sleep(0);
    expect(chats).toHaveLength(0);
    expect(JSON.stringify(c.persistenceSnapshot())).not.toContain(input.text);
  }
});

test('semantic mode does not fall back to phrases; unavailable games get an honest fixed response', async () => {
  const { say, chats, c } = setup({
    async classify() {
      return ok({ ...idle, activity: 'music_playlist' });
    },
  });
  const result = await say('Could we put on some songs now?');
  expect(result.ok && result.data.kind === 'reply' && result.data.reply.text).toContain(
    'not available here yet',
  );
  expect(chats).toHaveLength(0);
  expect(c.snapshot()?.conversationMode).toBe('open');
  const unavailable = setup({
    async classify() {
      return fail('UNAVAILABLE', 'fixture error');
    },
  });
  expect((await unavailable.say('My previous employment')).ok).toBe(false);
  expect(unavailable.chats).toHaveLength(0);
  const invented = setup({
    async classify() {
      return ok({ ...idle, redirectTopicIds: ['topic_11'] });
    },
  });
  expect((await invented.say(input.text)).ok).toBe(false);
  expect(invented.chats).toHaveLength(0);
});

test('registry passes one stateless adapter to isolated profile coordinators', async () => {
  const seen: ConversationDecisionInput[] = [];
  const registry = new SessionRegistry(
    {
      async complete(input) {
        return ok({ text: 'We can take our time.', language: input.language });
      },
    },
    undefined,
    Date.now,
    undefined,
    false,
    {
      async classify(input) {
        seen.push(input);
        return ok(idle);
      },
    },
  );
  for (const [id, label] of [
    ['profile-alex', 'previous employment'],
    ['profile-fixture', 'gardening'],
  ] as const) {
    registry.acceptPersistentProfile({
      ...caregiverProfile,
      id,
      privacyRevision: 0,
      policyRevision: 0,
      approvedFacts: [],
      conversationRedirects: { awayFrom: [label], toward: [] },
    });
    const c = registry.forProfile(id);
    c.handle('session.start', {
      profileId: id,
      endpoint: 'browser',
      commandId: crypto.randomUUID(),
    });
    await c.submitText({
      sessionId: c.snapshot()!.id,
      expectedGeneration: c.snapshot()!.generation,
      commandId: crypto.randomUUID(),
      text: 'A fictional message',
      language: 'en',
    });
  }
  expect(seen[0]?.topics[0]?.label).toBe('previous employment');
  expect(seen[1]?.topics[0]?.label).toBe('gardening');
  expect(seen[1]?.history).toEqual([]);
});

test('recognized speech uses semantic reminder detection and the existing TTS without a second model reply', async () => {
  let chatCalls = 0,
    spoken = '';
  const c = new SessionCoordinator(
    'live',
    {
      async complete(input) {
        chatCalls++;
        return ok({ text: 'That sounds lovely.', language: input.language });
      },
    },
    {
      stt: {
        async transcribe() {
          return ok({ text: 'Could you help me pick up that thread again', language: 'en' });
        },
      },
      tts: {
        async synthesize(input) {
          spoken = input.text;
          return ok({
            pcm: new Uint8Array(1280),
            sampleRate: 16000,
            channels: 1,
            encoding: 'pcm_s16le',
            language: 'en',
          });
        },
      },
    },
    Date.now,
    undefined,
    undefined,
    {
      async classify(input) {
        return ok({ ...idle, recap: input.text.startsWith('Could you help') });
      },
    },
  );
  c.handle('session.start', {
    profileId: caregiverProfile.id,
    endpoint: 'browser',
    commandId: crypto.randomUUID(),
  });
  await c.submitText({
    sessionId: c.snapshot()!.id,
    expectedGeneration: c.snapshot()!.generation,
    commandId: crypto.randomUUID(),
    text: 'I was knitting a blue scarf',
    language: 'en',
  });
  c.handle('session.command', {
    sessionId: c.snapshot()!.id,
    expectedGeneration: c.snapshot()!.generation,
    commandId: crypto.randomUUID(),
    action: { type: 'mute', muted: false },
  });
  expect(
    c.requestCapture(
      {
        sessionId: c.snapshot()!.id,
        expectedGeneration: c.snapshot()!.generation,
        commandId: crypto.randomUUID(),
        language: 'en',
      },
      [16000],
    ).ok,
  ).toBe(true);
  const grant = c.snapshot()!.captureGrant!;
  const scope = {
    sessionId: c.snapshot()!.id,
    expectedGeneration: c.snapshot()!.generation,
    turnId: grant.turnId,
    streamId: grant.streamId,
    leaseId: grant.leaseId,
  };
  expect(
    c.acceptCaptureChunk({
      ...scope,
      chunkIndex: 0,
      encoding: 'pcm_s16le',
      data: Buffer.alloc(640, 1).toString('base64'),
    }).ok,
  ).toBe(true);
  const result = await c.finishCapture({ ...scope, chunkCount: 1 });
  expect(result.ok && result.data.kind === 'reply' && result.data.reply.source).toBe('fixed');
  expect(spoken).toContain('knitting a blue scarf');
  expect(chatCalls).toBe(1);
  expect(c.snapshot()?.captureGrant).toBeNull();
  c.disconnect();
});

test('maximum approved profile context plus a semantic redirect fits the bounded chat adapter', async () => {
  let generated = false;
  const chat = createOpenRouterAdapter(
    { apiKey: config.apiKey, model: 'fixture/chat', timeoutMs: 100, maxTokens: 160 },
    async (_url, init) => {
      generated = true;
      const body = JSON.parse(init?.body as string);
      expect(body.messages[0].content.length).toBeLessThanOrEqual(5000);
      return Response.json({
        choices: [
          {
            finish_reason: 'stop',
            message: { role: 'assistant', content: 'We can take our time.' },
          },
        ],
      });
    },
  );
  const c = new SessionCoordinator('live', chat, undefined, Date.now, undefined, undefined, {
    async classify() {
      return ok({ ...idle, redirectTopicIds: ['topic_0'] });
    },
  });
  c.acceptPersistentProfile({
    ...caregiverProfile,
    privacyRevision: 0,
    policyRevision: 0,
    approvedFacts: Array.from({ length: 10 }, () => ({
      id: crypto.randomUUID(),
      field: 'personal_context' as const,
      value: 'x'.repeat(200),
      source: 'caregiver_provided' as const,
    })),
    conversationRedirects: {
      awayFrom: ['previous employment'],
      toward: Array(12).fill('a'.repeat(80)),
    },
  });
  c.handle('session.start', {
    profileId: caregiverProfile.id,
    endpoint: 'browser',
    commandId: crypto.randomUUID(),
  });
  const result = await c.submitText({
    sessionId: c.snapshot()!.id,
    expectedGeneration: c.snapshot()!.generation,
    commandId: crypto.randomUUID(),
    text: input.text,
    language: 'en',
  });
  expect(result.ok).toBe(true);
  expect(generated).toBe(true);
});
