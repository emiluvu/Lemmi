import { fail, ok, type Result } from '@lemmi/contracts';
import {
  PCM_MAX_BYTES,
  TTS_MAX_BYTES,
  integerSetting,
  isLanguage,
  readBounded,
  type AdapterFetch,
  type SttAdapter,
  type TtsAdapter,
} from './types';

export interface LocalSpeechConfig {
  sttBackend: 'local-http' | 'disabled';
  ttsBackend: 'local-http' | 'disabled';
  sttUrl: string;
  ttsUrl: string;
  token: string;
  timeoutMs: number;
}
export function localSpeechConfig(
  env: Record<string, string | undefined> = process.env,
): Result<LocalSpeechConfig> {
  try {
    const sttBackend = env.LEMMI_STT_BACKEND ?? 'disabled';
    const ttsBackend = env.LEMMI_TTS_BACKEND ?? 'disabled';
    if (![sttBackend, ttsBackend].every((v) => v === 'disabled' || v === 'local-http'))
      throw new Error();
    const sttUrl = env.LEMMI_STT_URL || 'http://127.0.0.1:8765';
    const ttsUrl = env.LEMMI_TTS_URL || 'http://127.0.0.1:8765';
    for (const value of [sttUrl, ttsUrl]) {
      const url = new URL(value);
      if (
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        url.pathname !== '/' ||
        (url.protocol !== 'https:' &&
          !(url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)))
      )
        throw new Error();
    }
    const token = env.LEMMI_SPEECH_TOKEN ?? '';
    if (
      (sttBackend !== 'disabled' || ttsBackend !== 'disabled') &&
      !/^[\x21-\x7e]{32,512}$/.test(token)
    )
      throw new Error();
    return ok({
      sttBackend: sttBackend as LocalSpeechConfig['sttBackend'],
      ttsBackend: ttsBackend as LocalSpeechConfig['ttsBackend'],
      sttUrl,
      ttsUrl,
      token,
      timeoutMs: integerSetting(env.LEMMI_SPEECH_TIMEOUT_MS, 20000, 1000, 20000),
    });
  } catch {
    return fail(
      'VALIDATION_ERROR',
      'Invalid speech backend, protected endpoint, token or timeout configuration',
    );
  }
}

export function createLocalSpeechAdapters(
  config: LocalSpeechConfig,
  fetcher: AdapterFetch = fetch,
): { stt: SttAdapter; tts: TtsAdapter } {
  async function request(
    base: string,
    path: string,
    body: RequestInit['body'],
    headers: Record<string, string>,
    signal: AbortSignal,
  ) {
    const requestId = crypto.randomUUID();
    const cancel = () => {
      // Best effort worker cancellation; callers still discard every late result locally.
      void fetcher(new URL('/v1/cancel', base), {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(1000),
        headers: { authorization: `Bearer ${config.token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ requestId }),
      })
        .then((r) => r.body?.cancel())
        .catch(() => {});
    };
    signal.throwIfAborted();
    signal.addEventListener('abort', cancel, { once: true });
    try {
      const response = await fetcher(new URL(path, base), {
        method: 'POST',
        redirect: 'error',
        signal,
        headers: {
          authorization: `Bearer ${config.token}`,
          'x-lemmi-request-id': requestId,
          ...headers,
        },
        body,
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error('Speech service unavailable');
      }
      const bytes = await readBounded(response, path === '/v1/stt' ? 16384 : TTS_MAX_BYTES);
      signal.throwIfAborted();
      return { bytes, headers: response.headers };
    } finally {
      signal.removeEventListener('abort', cancel);
    }
  }
  return {
    stt: {
      async transcribe(input, canceled) {
        if (config.sttBackend === 'disabled') return fail('UNAVAILABLE', 'STT is disabled');
        if (
          !(input.pcm instanceof Uint8Array) ||
          !input.pcm.length ||
          input.pcm.length > PCM_MAX_BYTES ||
          input.pcm.length % 2 ||
          (!isLanguage(input.language) && input.language !== 'auto')
        )
          return fail(
            'VALIDATION_ERROR',
            'Expected bounded 16 kHz mono signed little-endian PCM and a supported language',
          );
        const signal = AbortSignal.any([canceled, AbortSignal.timeout(config.timeoutMs)]);
        try {
          const { bytes } = await request(
            config.sttUrl,
            '/v1/stt',
            new Uint8Array(input.pcm).buffer,
            { 'content-type': 'application/octet-stream', 'x-lemmi-language': input.language },
            signal,
          );
          const result = JSON.parse(new TextDecoder().decode(bytes));
          if (
            result?.ok !== true ||
            typeof result.data?.text !== 'string' ||
            result.data.text.length > 2000 ||
            !isLanguage(result.data.language) ||
            (input.language !== 'auto' && result.data.language !== input.language)
          )
            return fail('UNAVAILABLE', 'Invalid or unsupported STT response');
          return ok({ text: result.data.text, language: result.data.language });
        } catch {
          return fail(
            'UNAVAILABLE',
            signal.aborted
              ? 'STT canceled or timed out'
              : 'Local STT unavailable; no fallback was used',
          );
        }
      },
    },
    tts: {
      async synthesize(input, canceled) {
        if (config.ttsBackend === 'disabled') return fail('UNAVAILABLE', 'TTS is disabled');
        if (
          typeof input.text !== 'string' ||
          !input.text.trim() ||
          input.text.length > 600 ||
          !isLanguage(input.language)
        )
          return fail('VALIDATION_ERROR', 'Expected bounded text and a supported speech language');
        const signal = AbortSignal.any([canceled, AbortSignal.timeout(config.timeoutMs)]);
        try {
          const { bytes, headers } = await request(
            config.ttsUrl,
            '/v1/tts',
            JSON.stringify(input),
            { 'content-type': 'application/json' },
            signal,
          );
          const sampleRate = Number(headers.get('x-lemmi-sample-rate'));
          if (
            headers.get('x-lemmi-encoding') !== 'pcm_s16le' ||
            headers.get('x-lemmi-language') !== input.language ||
            !Number.isInteger(sampleRate) ||
            sampleRate < 8000 ||
            sampleRate > 48000 ||
            !bytes.length ||
            bytes.length % 2 ||
            bytes.length > sampleRate * 2 * 30
          )
            return fail('UNAVAILABLE', 'Invalid or unsupported TTS response');
          return ok({
            pcm: bytes,
            sampleRate,
            channels: 1,
            encoding: 'pcm_s16le',
            language: input.language,
          });
        } catch {
          return fail(
            'UNAVAILABLE',
            signal.aborted
              ? 'TTS canceled or timed out'
              : 'Local TTS unavailable; no fallback was used',
          );
        }
      },
    },
  };
}
