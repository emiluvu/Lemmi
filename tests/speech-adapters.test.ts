import { expect, test } from 'bun:test';
import {
  openRouterConfig,
  createOpenRouterAdapter,
} from '../packages/server/src/adapters/openrouter';
import {
  localSpeechConfig,
  createLocalSpeechAdapters,
} from '../packages/server/src/adapters/local-speech';
import { companionInput } from '../packages/server/src/adapters/companion-prompt';
import { PCM_MAX_BYTES, type ChatInput } from '../packages/server/src/adapters/types';

const live = new AbortController().signal;
const chat: ChatInput = {
  system: 'Approved fictional context only.',
  history: [],
  text: 'Hello',
  language: 'en',
};
const config = {
  apiKey: 'fixture-key-not-real',
  model: 'fixture/model',
  timeoutMs: 1000,
  maxTokens: 100,
};
const completion = (content = 'Hello. We can take our time.') =>
  Response.json({ choices: [{ finish_reason: 'stop', message: { role: 'assistant', content } }] });
function unwrap<T>(result: { ok: true; data: T } | { ok: false; error: unknown }): T {
  if (!result.ok) throw new Error('Expected fixture success');
  return result.data;
}

test('LLM config requires an explicit model/private key and bounds service work', () => {
  expect(openRouterConfig({}).ok).toBe(false);
  expect(
    openRouterConfig({
      OPENROUTER_API_KEY: 'fixture-not-real',
      OPENROUTER_MODEL: 'openrouter/auto',
    }).ok,
  ).toBe(false);
  expect(
    openRouterConfig({
      OPENROUTER_API_KEY: 'fixture-not-real',
      OPENROUTER_MODEL: 'fixture/model',
      LEMMI_LLM_TIMEOUT_MS: '60000',
    }).ok,
  ).toBe(false);
  expect(
    openRouterConfig({ OPENROUTER_API_KEY: 'fixture-not-real', OPENROUTER_MODEL: 'fixture/model' })
      .ok,
  ).toBe(true);
});

test('OpenRouter sends minimum text, exact model and restrictive routing without exposing credentials', async () => {
  let count = 0;
  const adapter = createOpenRouterAdapter(config, async (url, init) => {
    count++;
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(init?.redirect).toBe('error');
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer ' + config.apiKey);
    const body = JSON.parse(String(init?.body));
    expect(body.model).toBe(config.model);
    expect(body.stream).toBe(false);
    expect(body.tools).toBeUndefined();
    expect(body.provider).toEqual({ data_collection: 'deny', zdr: true, allow_fallbacks: false });
    expect(JSON.stringify(body)).not.toContain(config.apiKey);
    return completion();
  });
  const response = await adapter.complete(chat, live);
  expect(response.ok).toBe(true);
  expect(JSON.stringify(response)).not.toContain(config.apiKey);
  expect(count).toBe(1);
});

test('provider errors, tools, oversized/partial responses do not turn into chat success or retries', async () => {
  for (const response of [
    new Response('private prompt/key echoed by upstream', { status: 429 }),
    Response.json({
      choices: [{ finish_reason: 'length', message: { role: 'assistant', content: 'partial' } }],
    }),
    Response.json({
      choices: [
        {
          finish_reason: 'stop',
          message: { role: 'assistant', content: 'hello', tool_calls: [{}] },
        },
      ],
    }),
    completion('x'.repeat(601)),
    completion('Visit https://not-approved.invalid'),
    new Response('not JSON'),
    new Response('x'.repeat(65537)),
  ]) {
    let count = 0;
    const result = await createOpenRouterAdapter(config, async () => {
      count++;
      return response;
    }).complete(chat, live);
    expect(result.ok).toBe(false);
    expect(count).toBe(1);
    expect(JSON.stringify(result)).not.toContain('private prompt/key');
  }
});

test('cancellation rejects late LLM results even if upstream ignores abort', async () => {
  const controller = new AbortController();
  const adapter = createOpenRouterAdapter(config, async () => {
    controller.abort();
    return completion('This must not be played.');
  });
  expect((await adapter.complete(chat, controller.signal)).ok).toBe(false);
  let requests = 0;
  const canceled = createOpenRouterAdapter(config, async () => {
    requests++;
    return completion();
  });
  expect((await canceled.complete(chat, controller.signal)).ok).toBe(false);
  expect(requests).toBe(0);
});

test('reasoning effort is explicit, hidden reasoning is excluded and exhausted budgets fail without retry', async () => {
  expect(
    openRouterConfig({
      OPENROUTER_API_KEY: 'fixture-key',
      OPENROUTER_MODEL: 'fixture/model',
      LEMMI_LLM_REASONING_EFFORT: 'unsupported',
    }).ok,
  ).toBe(false);
  const selected = unwrap(
    openRouterConfig({
      OPENROUTER_API_KEY: 'fixture-key',
      OPENROUTER_MODEL: 'fixture/model',
      LEMMI_LLM_REASONING_EFFORT: 'low',
      LEMMI_LLM_MAX_TOKENS: '512',
    }),
  );
  let calls = 0;
  const result = await createOpenRouterAdapter(selected, async (_url, init) => {
    calls++;
    const body = JSON.parse(String(init?.body));
    expect(body.reasoning).toEqual({ effort: 'low', exclude: true });
    expect(body.max_tokens).toBe(512);
    return Response.json({
      choices: [
        {
          finish_reason: 'length',
          message: {
            role: 'assistant',
            content: '',
            reasoning: 'private-reasoning-fixture-marker',
          },
        },
      ],
    });
  }).complete(chat, live);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error.message).toContain('token budget');
  expect(calls).toBe(1);
  expect(JSON.stringify(result)).not.toContain('private-reasoning-fixture-marker');
});

test('English/German prompts use approved minimal context and effective support instructions', () => {
  const english = unwrap(
    companionInput({
      text: 'Hello',
      language: 'en',
      preset: 'guided',
      preferredName: 'Alex',
      approvedFacts: ['Enjoys gardening'],
    }),
  );
  const german = unwrap(
    companionInput({ text: 'Hallo', language: 'de', preset: 'quiet', preferredName: 'Alex' }),
  );
  expect(english.system).toContain('Reply in English');
  expect(english.system).toContain('at most one question');
  expect(german.system).toContain('Reply in German');
  expect(german.system).toContain('Do not ask an unsolicited follow-up');
  expect(english.system).toContain('Never diagnose');
  expect(english.system).toContain('Never claim any of these happened');
});

const speechConfig = unwrap(
  localSpeechConfig({
    LEMMI_STT_BACKEND: 'local-http',
    LEMMI_TTS_BACKEND: 'local-http',
    LEMMI_SPEECH_TOKEN: 'fixture-token-'.repeat(3),
  }),
);

test('speech selection is independent and rejects plaintext remote endpoints/unsupported backends', () => {
  expect(localSpeechConfig({}).ok).toBe(true);
  expect(localSpeechConfig({ LEMMI_STT_BACKEND: 'invented' }).ok).toBe(false);
  expect(localSpeechConfig({ LEMMI_STT_BACKEND: 'local-http' }).ok).toBe(false);
  expect(localSpeechConfig({ LEMMI_STT_URL: 'http://192.168.1.2:8765' }).ok).toBe(false);
  expect(localSpeechConfig({ LEMMI_TTS_URL: 'https://secret@host.invalid' }).ok).toBe(false);
  const independent = unwrap(
    localSpeechConfig({
      LEMMI_STT_BACKEND: 'disabled',
      LEMMI_TTS_BACKEND: 'local-http',
      LEMMI_SPEECH_TOKEN: speechConfig.token,
    }),
  );
  expect(independent.sttBackend).toBe('disabled');
  expect(independent.ttsBackend).toBe('local-http');
});

test('bounded PCM STT preserves recognized language and never falls back', async () => {
  let calls = 0;
  const { stt } = createLocalSpeechAdapters(speechConfig, async (url, init) => {
    calls++;
    expect(String(url)).toBe('http://127.0.0.1:8765/v1/stt');
    expect(new Headers(init?.headers).get('x-lemmi-language')).toBe('en');
    expect(new Headers(init?.headers).get('x-lemmi-request-id')).toBeTruthy();
    expect(init?.body).toBeInstanceOf(ArrayBuffer);
    return Response.json({ ok: true, data: { text: 'Hello', language: 'en' } });
  });
  expect(
    unwrap(await stt.transcribe({ pcm: new Uint8Array(640), language: 'en' }, live)).text,
  ).toBe('Hello');
  expect(
    (await stt.transcribe({ pcm: new Uint8Array(PCM_MAX_BYTES + 2), language: 'en' }, live)).ok,
  ).toBe(false);
  expect((await stt.transcribe({ pcm: new Uint8Array(3), language: 'en' }, live)).ok).toBe(false);
  expect(calls).toBe(1);
});

test('TTS validates audio metadata, selected language and duration before exposing output', async () => {
  const audio = (language = 'en', rate = '22050') =>
    new Response(new Uint8Array(100), {
      headers: {
        'x-lemmi-sample-rate': rate,
        'x-lemmi-language': language,
        'x-lemmi-encoding': 'pcm_s16le',
      },
    });
  const good = createLocalSpeechAdapters(speechConfig, async () => audio());
  expect(
    unwrap(await good.tts.synthesize({ text: 'Hello', language: 'en' }, live)).sampleRate,
  ).toBe(22050);
  for (const response of [
    audio('de'),
    audio('en', 'NaN'),
    new Response(new Uint8Array(3)),
    new Response('private engine diagnostics', { status: 503 }),
  ]) {
    const adapter = createLocalSpeechAdapters(speechConfig, async () => response);
    const result = await adapter.tts.synthesize({ text: 'Hello', language: 'en' }, live);
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain('private engine');
  }
});

test('aborting speech sends a bounded cancel by request ID and drops late output', async () => {
  const controller = new AbortController();
  const paths: string[] = [];
  let requestId = '';
  const adapter = createLocalSpeechAdapters(speechConfig, async (url, init) => {
    paths.push(new URL(String(url)).pathname);
    if (paths.at(-1) === '/v1/cancel') {
      expect(JSON.parse(String(init?.body)).requestId).toBe(requestId);
      return Response.json({ ok: true });
    }
    requestId = new Headers(init?.headers).get('x-lemmi-request-id')!;
    controller.abort();
    return Response.json({ ok: true, data: { text: 'late', language: 'en' } });
  });
  expect(
    (await adapter.stt.transcribe({ pcm: new Uint8Array(640), language: 'en' }, controller.signal))
      .ok,
  ).toBe(false);
  expect(paths).toEqual(['/v1/stt', '/v1/cancel']);
});
