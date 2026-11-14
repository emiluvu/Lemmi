import { fail, ok, type Result } from '@lemmi/contracts';
import {
  integerSetting,
  isLanguage,
  readBounded,
  type AdapterFetch,
  type ChatAdapter,
  type ChatInput,
} from './types';

export interface OpenRouterConfig {
  apiKey: string;
  model: string;
  timeoutMs: number;
  maxTokens: number;
}
export function openRouterConfig(
  env: Record<string, string | undefined> = process.env,
): Result<OpenRouterConfig> {
  const apiKey = env.OPENROUTER_API_KEY ?? '';
  const model = env.OPENROUTER_MODEL ?? '';
  if (!apiKey || !model)
    return fail('UNAVAILABLE', 'Configure OPENROUTER_API_KEY and OPENROUTER_MODEL on the server');
  if (
    !/^[\x21-\x7e]{8,512}$/.test(apiKey) ||
    !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.:-]{1,180}$/.test(model) ||
    model === 'openrouter/auto'
  )
    return fail(
      'VALIDATION_ERROR',
      'Use a valid private API key and an explicit OpenRouter model ID',
    );
  try {
    return ok({
      apiKey,
      model,
      timeoutMs: integerSetting(env.LEMMI_LLM_TIMEOUT_MS, 20000, 1000, 20000),
      maxTokens: integerSetting(env.LEMMI_LLM_MAX_TOKENS, 160, 32, 512),
    });
  } catch {
    return fail('VALIDATION_ERROR', 'Invalid LLM timeout/token limit');
  }
}

// Text-only, one attempt, fixed endpoint. No key/model/browser URLs or tools in model context.
export function createOpenRouterAdapter(
  config: OpenRouterConfig,
  fetcher: AdapterFetch = fetch,
): ChatAdapter {
  return {
    async complete(input: ChatInput, canceled: AbortSignal) {
      if (
        !isLanguage(input.language) ||
        typeof input.text !== 'string' ||
        !input.text.trim() ||
        input.text.length > 2000 ||
        typeof input.system !== 'string' ||
        input.system.length > 5000 ||
        !Array.isArray(input.history) ||
        input.history.length > 12 ||
        input.history.some(
          (m) =>
            !['user', 'assistant'].includes(m.role) ||
            typeof m.content !== 'string' ||
            m.content.length > 2000,
        ) ||
        input.history.reduce((n, m) => n + m.content.length, 0) > 8000
      )
        return fail('VALIDATION_ERROR', 'Chat input exceeds the permitted text/language bounds');
      const signal = AbortSignal.any([canceled, AbortSignal.timeout(config.timeoutMs)]);
      if (signal.aborted) return fail('UNAVAILABLE', 'Chat turn canceled');
      try {
        const response = await fetcher('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          redirect: 'error',
          signal,
          headers: { authorization: `Bearer ${config.apiKey}`, 'content-type': 'application/json' },
          body: JSON.stringify({
            model: config.model,
            messages: [
              { role: 'system', content: input.system },
              ...input.history,
              { role: 'user', content: input.text },
            ],
            stream: false,
            max_tokens: config.maxTokens,
            provider: { data_collection: 'deny', zdr: true, allow_fallbacks: false },
          }),
        });
        // Error bodies may echo prompts/keys; never expose or log them.
        if (!response.ok) {
          await response.body?.cancel();
          return fail('UNAVAILABLE', 'OpenRouter request failed; no fallback or retry was used');
        }
        const data = JSON.parse(new TextDecoder().decode(await readBounded(response, 65536)));
        if (signal.aborted) return fail('UNAVAILABLE', 'Chat turn canceled');
        const choice = data?.choices?.[0];
        const text: unknown = choice?.message?.content;
        if (
          data.error ||
          choice?.finish_reason !== 'stop' ||
          choice?.message?.role !== 'assistant' ||
          choice.message.tool_calls?.length ||
          typeof text !== 'string' ||
          !text.trim() ||
          text.length > 600 ||
          /```|<[^>]+>|https?:\/\//i.test(text)
        )
          return fail('UNAVAILABLE', 'OpenRouter returned an incomplete or unsupported response');
        return ok({ text: text.trim(), language: input.language });
      } catch {
        return fail(
          'UNAVAILABLE',
          signal.aborted
            ? 'Chat turn canceled or timed out'
            : 'OpenRouter unavailable; no fallback or retry was used',
        );
      }
    },
  };
}
