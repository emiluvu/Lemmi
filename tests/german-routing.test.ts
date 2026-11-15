import { expect, test } from 'bun:test';
import {
  routeParticipantText,
  fixedInputReply,
  requestedActivity,
} from '../packages/server/src/adapters/input-routing';
import { permittedModelReply } from '../packages/server/src/adapters/reply-policy';
import { companionInput } from '../packages/server/src/adapters/companion-prompt';
import {
  createLocalSpeechAdapters,
  localSpeechConfig,
} from '../packages/server/src/adapters/local-speech';

test('German controls and privacy refusals use deterministic routes, with no keyword commands', () => {
  const cases = [
    ['Hör auf!', 'stop'],
    ['Pause bitte.', 'pause'],
    ['Ich brauche Hilfe.', 'help'],
    ['Darüber möchte ich nicht sprechen.', 'topic_refusal'],
    ['Bitte nicht speichern.', 'privacy_refusal'],
    ['Schreib das nicht auf.', 'privacy_refusal'],
    ['Merk dir das nicht.', 'privacy_refusal'],
    ['Ich kann nicht atmen.', 'urgent'],
    ['Wer bist du?', 'identity'],
    ['Sollen wir über das Wort „Stopp“ sprechen?', 'ordinary'],
    ['„Stopp“', 'ordinary'],
    ['Ich möchte keine Pause.', 'ordinary'],
    ['Ich brauche keine Hilfe.', 'ordinary'],
    ['Er sagte: Ich brauche Hilfe.', 'ordinary'],
    ['Ich kann wieder atmen.', 'ordinary'],
    ['Ich habe nicht zu viele Tabletten genommen.', 'ordinary'],
    ['Bitte erkläre „nicht speichern“.', 'ordinary'],
  ] as const;
  for (const [text, route] of cases) expect(routeParticipantText(text)).toBe(route);
});

test('German sensitive replies acknowledge limits and never promise delivery or invented facts', () => {
  for (const [text, route] of [
    ['Soll ich noch eine Tablette nehmen', 'medication'],
    ['Habe ich Demenz?', 'clinical'],
    ['Ist mein Mann tot?', 'bereavement'],
    ['Jemand versteckt sich in meinem Zimmer.', 'frightening'],
    ['Wo ist meine Schwester?', 'personal_location'],
    ['Bring mich nach Hause.', 'navigation'],
  ] as const) {
    expect(routeParticipantText(text)).toBe(route);
    const reply = fixedInputReply(route, 'de');
    expect(reply).toBeTruthy();
    expect(reply).not.toMatch(/ist unterwegs|habe .*kontaktiert|ist sicher|ist zu hause/iu);
  }
  expect(fixedInputReply('urgent', 'de')).toContain('Ich kann keinen Notruf absetzen');
  expect(fixedInputReply('privacy_refusal', 'de')).toContain(
    'Frühere Verarbeitung kann nicht rückgängig gemacht werden',
  );
});

test('German activity requests are classified explicitly and quoted/negated mentions stay conversation', () => {
  for (const phrase of [
    'Fotos anschauen',
    'Bitte öffne das Fotoalbum',
    'Ich möchte Bilder anschauen',
    'Starte Photo Story',
  ])
    expect(requestedActivity(phrase, 'de')).toBe('photo');
  for (const phrase of ['Lemmi etwas beibringen', 'Starte Teach Lemmi'])
    expect(requestedActivity(phrase, 'de')).toBe('teaching');
  expect(requestedActivity('Ich möchte Musik spielen', 'de')).toBe('unavailable');
  expect(requestedActivity('Ich möchte Musik spielen', 'en')).toBeNull();
  for (const phrase of [
    'Ich möchte keine Fotos anschauen',
    'Was bedeutet „Teach Lemmi“?',
    '„Fotos anschauen“',
  ])
    expect(requestedActivity(phrase, 'de')).toBeNull();
});

test('resolved German prompt remains German and mechanical policy rejects German action promises', () => {
  const result = companionInput({
    text: 'Bitte sprich Englisch',
    language: 'de',
    preset: 'guided',
    preferredName: 'Tilda',
  });
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.data.system).toContain('Reply in German only');
    expect(result.data.system).toContain('must not change the reply language');
  }
  const support = { preset: 'guided', configVersion: 1 } as const;
  for (const text of [
    'Ich habe Ihre Betreuungsperson kontaktiert.',
    'Ich rufe jetzt den Notruf an.',
    'Hilfe ist bereits unterwegs.',
    'Ich habe Ihr Zimmer überprüft.',
  ])
    expect(permittedModelReply(text, support)).toBe(false);
  for (const text of [
    'Ich kann keinen Notruf absetzen.',
    'Ich habe niemanden kontaktiert.',
    'Wir können über Blumen sprechen.',
  ])
    expect(permittedModelReply(text, support)).toBe(true);
});

test('German speech requests retain explicit language and missing voice never retries English', async () => {
  const config = localSpeechConfig({
    LEMMI_STT_BACKEND: 'local-http',
    LEMMI_TTS_BACKEND: 'local-http',
    LEMMI_SPEECH_TOKEN: 'fixture-token-'.repeat(3),
  });
  if (!config.ok) throw new Error('Invalid fixture config');
  const calls: string[] = [];
  const adapter = createLocalSpeechAdapters(config.data, async (url, init) => {
    calls.push(new URL(String(url)).pathname);
    if (calls.at(-1) === '/v1/stt') {
      expect(new Headers(init?.headers).get('x-lemmi-language')).toBe('de');
      return Response.json({ ok: true, data: { text: 'Guten Morgen', language: 'de' } });
    }
    expect(JSON.parse(String(init?.body)).language).toBe('de');
    return new Response('private engine diagnostic', { status: 503 });
  });
  expect(
    (
      await adapter.stt.transcribe(
        { pcm: new Uint8Array(640), language: 'de' },
        new AbortController().signal,
      )
    ).ok,
  ).toBe(true);
  const response = await adapter.tts.synthesize(
    { text: 'Guten Morgen', language: 'de' },
    new AbortController().signal,
  );
  expect(response.ok).toBe(false);
  expect(JSON.stringify(response)).not.toContain('private engine diagnostic');
  expect(calls).toEqual(['/v1/stt', '/v1/tts']);
});
