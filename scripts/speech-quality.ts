// Fixed fictional English fixtures; report counts/timings only, never audio or transcripts.
import { localSpeechConfig, createLocalSpeechAdapters } from '@lemmi/server';
import { captureFixture } from './speech-fixture';

const selected = localSpeechConfig();
if (
  !selected.ok ||
  selected.data.sttBackend !== 'local-http' ||
  selected.data.ttsBackend !== 'local-http'
)
  throw new Error('Configure the private local speech adapters');
const { stt, tts } = createLocalSpeechAdapters(selected.data);
const backends = [{ id: 'configured', stt }];
if (process.env.LEMMI_COMPARISON_STT_URL) {
  const comparison = localSpeechConfig({
    ...process.env,
    LEMMI_STT_URL: process.env.LEMMI_COMPARISON_STT_URL,
  });
  if (!comparison.ok) throw new Error('Invalid comparison endpoint');
  backends.push({ id: 'comparison', stt: createLocalSpeechAdapters(comparison.data).stt });
}
const fixtures = [
  { id: 'garden', text: 'Hello. The garden is quiet today.', expected: /\bgarden\b/i },
  { id: 'music', text: 'I would like to listen to some music.', expected: /\bmusic\b/i },
  {
    id: 'flowers',
    text: 'Please tell me about the flowers in the garden.',
    expected: /\b(flowers|garden)\b/i,
  },
  {
    id: 'patient',
    text: 'We can take our time and enjoy the sunshine.',
    expected: /\b(time|sunshine)\b/i,
  },
  { id: 'stop', text: 'Please stop.', expected: /\bstop\b/i },
];
const results = [];
const repeatFlag = process.argv.indexOf('--repeat'),
  fixtureFlag = process.argv.indexOf('--fixture');
const repeats = repeatFlag >= 0 ? Number(process.argv[repeatFlag + 1]) : 1;
const chosen =
  fixtureFlag >= 0 ? fixtures.filter((f) => f.id === process.argv[fixtureFlag + 1]) : fixtures;
if (!Number.isInteger(repeats) || repeats < 1 || repeats > 5 || !chosen.length)
  throw new Error('Choose 1–5 repeats and an existing fixture ID');
for (let iteration = 0; iteration < repeats; iteration++)
  for (const fixture of chosen) {
    const began = performance.now();
    const spoken = await tts.synthesize(
      { text: fixture.text, language: 'en' },
      AbortSignal.timeout(20000),
    );
    if (!spoken.ok) throw new Error('Synthetic voice preparation failed');
    const ttsMs = Math.round(performance.now() - began);
    try {
      for (const paddingMs of [0, 250]) {
        const pcm = captureFixture(spoken.data, paddingMs);
        try {
          for (const backend of backends) {
            const beganStt = performance.now();
            const result = await backend.stt.transcribe(
              { pcm, language: 'en' },
              AbortSignal.timeout(20000),
            );
            results.push({
              iteration,
              backend: backend.id,
              fixture: fixture.id,
              paddingMs,
              ttsMs,
              sttMs: Math.round(performance.now() - beganStt),
              passed:
                result.ok &&
                result.data.language === 'en' &&
                fixture.expected.test(result.data.text),
            });
          }
        } finally {
          pcm.fill(0);
        }
      }
    } finally {
      spoken.data.pcm.fill(0);
    }
  }
console.info(
  JSON.stringify({
    test: 'synthetic English keyword checks, same-audio padding comparison',
    results,
    passed: results.filter((r) => r.passed).length,
    total: results.length,
    humanQualityOrHardwareTested: false,
    transcriptLogged: false,
    rawAudioSaved: false,
  }),
);
if (results.some((r) => !r.passed)) process.exitCode = 1;
