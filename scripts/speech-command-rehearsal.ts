// Fixed fictional commands only. No recordings or recognized text are logged.
import { localSpeechConfig, createLocalSpeechAdapters } from '@lemmi/server';
import { captureFixture } from './speech-fixture';
import {
  requestedActivity,
  normalizeVoiceCommand,
} from '../packages/server/src/adapters/input-routing';
if (!process.argv.includes('--live')) throw new Error('Explicit --live is required');
const config = localSpeechConfig();
if (!config.ok) throw new Error('Private speech configuration unavailable');
const adapters = createLocalSpeechAdapters(config.data);
const cases = [
  { id: 'displayed_teaching', text: "Let's play Teach Lemmi." },
  { id: 'start_teaching', text: 'Start Teach Lemmi.' },
  { id: 'polite_teaching', text: 'Can we play the Teach Lemmi game?' },
  { id: 'photo', text: 'Explore pictures.' },
];
for (const row of cases) {
  const signal = AbortSignal.timeout(20000);
  const spoken = await adapters.tts.synthesize({ text: row.text, language: 'en' }, signal);
  if (!spoken.ok) throw new Error('Fixed synthesis unavailable');
  let pcm: Uint8Array | undefined;
  try {
    pcm = captureFixture(spoken.data, 300);
    const started = performance.now();
    const recognized = await adapters.stt.transcribe({ pcm, language: 'en' }, signal);
    if (!recognized.ok) {
      console.log(JSON.stringify({ case: row.id, result: 'UNAVAILABLE' }));
      continue;
    }
    const value = normalizeVoiceCommand(recognized.data.text);
    const variant = /\bteach lemmy\b/.test(value)
      ? 'lemmy'
      : /\bteach lemme\b/.test(value)
        ? 'lemme'
        : /\bteach lemmi\b/.test(value)
          ? 'lemmi'
          : /\bteach lemi\b/.test(value)
            ? 'lemi'
            : 'other';
    console.log(
      JSON.stringify({
        case: row.id,
        routed: requestedActivity(recognized.data.text),
        reviewedNameVariant: variant,
        sttMs: Math.round(performance.now() - started),
        audioSaved: false,
        transcriptLogged: false,
      }),
    );
  } finally {
    spoken.data.pcm.fill(0);
    pcm?.fill(0);
  }
}
