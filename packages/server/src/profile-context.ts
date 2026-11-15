import {
  ProfileContextSchema,
  type ProfileContext,
  type ConversationMemory,
} from '@lemmi/contracts';
import { permittedModelReply } from './adapters/reply-policy';

// Optional, unreviewed summaries are permitted only after a separate retention
// opt-in. These mechanical exclusions supplement the summarizer prompt; they do
// not establish universal factual/semantic safety or turn reports into biography.
export function permittedConversationSummary(
  summary: string,
  participantText: string,
  language: 'en' | 'de',
): boolean {
  const text = summary.trim().normalize('NFKC');
  if (
    !['en', 'de'].includes(language) ||
    !text ||
    text.length > 300 ||
    /[?\u061f]/u.test(text) ||
    !permittedModelReply(text, { preset: 'conversational', configVersion: 1 }) ||
    /["“”„«»]/u.test(text) ||
    /(?:^|[\s(:])['‘][^'‘’\n]{3,}['’](?=$|[\s.,!;)])/u.test(text)
  )
    return false;

  // No contact destinations or contact/action receipts may become memory.
  if (
    /[\p{L}\p{N}.!#$%&'*+/=?^_`{|}~-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/iu.test(text) ||
    /\b(?:www\.|tel:|mailto:)/iu.test(text) ||
    /\b\d{1,6}\s+(?:[\p{L}.'-]+\s+){0,4}(?:street|road|avenue|lane|drive|boulevard|st\.?|rd\.?|ave\.?)\b/iu.test(
      text,
    ) ||
    /\b[\p{L}]+(?:straße|strasse|weg|platz)\s+\d{1,6}\b/iu.test(text) ||
    [...text.matchAll(/\+?\d[\d\s().-]{5,}\d/gu)].some(
      ([number]) => !/^\d{4}-\d{2}-\d{2}$/.test(number) && number.replace(/\D/g, '').length >= 7,
    ) ||
    /\b(?:lemmi|the assistant|we)\b[^.!?]{0,40}\b(?:called|contacted|notified|alerted|messaged|sent|spoke|talked to|talked with)\b/iu.test(
      text,
    ) ||
    /(?:^|[.!]\s+)(?:called|contacted|notified|alerted|messaged)\b/iu.test(text) ||
    /\b(?:ich|wir|lemmi|assistent)\b[^.!?]{0,40}\b(?:angerufen|kontaktiert|benachrichtigt|alarmiert|gesendet|geschickt|gesprochen)\b/iu.test(
      text,
    )
  )
    return false;

  // Exclude clinical judgments and treatment guidance, including participant
  // requests to preserve such claims. Ordinary interests remain paraphrasable.
  if (
    /\b(?:diagnos\w*|dementia|demenz|alzheimer\w*|clinically|klinisch\w*|cognitive (?:decline|impairment)|kognitiv\w* (?:abbau|beeinträchtigung)|cognitively impaired)\b/iu.test(
      text,
    ) ||
    /\b(?:participant|user|he|she|they|person)\b[^.!?]{0,35}\b(?:depressed|confused|aggressive|anxious|emotionally unstable|memory (?:is )?(?:worse|worsening|declining))\b/iu.test(
      text,
    ) ||
    /\b(?:person|teilnehmer\w*|er|sie)\b[^.!?]{0,35}\b(?:depressiv\w*|verwirrt\w*|aggressiv\w*|ängstlich\w*)\b/iu.test(
      text,
    ) ||
    /\b(?:should|must|needs? to) (?:take|stop|change|increase|decrease)\b[^.!?]{0,35}\b(?:pills?|medication|medicine|dose|treatment)\b/iu.test(
      text,
    ) ||
    /\b(?:soll\w*|muss|müssen)\b[^.!?]{0,35}\b(?:medikament\w*|dosis|tablett\w*|behandlung)\b/iu.test(
      text,
    )
  )
    return false;

  const words = (value: string) =>
    value
      .normalize('NFKC')
      .toLowerCase()
      .match(/[\p{L}\p{N}]+/gu) ?? [];
  const source = words(participantText),
    stored = words(text);
  const original = source.join(' '),
    retained = stored.join(' ');
  if (original && original === retained) return false;
  if (source.length >= 3 && ` ${retained} `.includes(` ${original} `)) return false;
  // Reject copied stretches from longer turns while allowing brief shared topic
  // names and natural paraphrases (for example, "discussed planting tomatoes").
  for (let index = 0; index + 8 <= source.length; index++)
    if (` ${retained} `.includes(` ${source.slice(index, index + 8).join(' ')} `)) return false;
  return true;
}

// Caregiver-provided context only. Images are described by their entered captions;
// pixels and photo identities are never inferred or sent to the language model.
export function profileContextFacts(context?: ProfileContext): string[] {
  if (!context) return [];
  const facts = [
    context.career && `Career: ${context.career}`,
    ...(context.biography.match(/.{1,170}(?:\s|$)|.{1,170}/g) ?? []).map(
      (part) => `Approved biography: ${part}`,
    ),
    ...context.importantPeople.map(
      (person) =>
        `Familiar person: ${person.name} (${person.relationship || 'relationship not specified'})`,
    ),
    context.activities.length && `Enjoyed activities: ${context.activities.join(', ')}`,
    context.pets && `Pets: ${context.pets}`,
    ...Object.entries(context.favourites)
      .filter(([, value]) => value)
      .map(([key, value]) => `Favourite ${key}: ${value}`),
    ...context.photos
      .filter((photo) => photo.description)
      .map((photo) => `Caregiver photo description: ${photo.description}`),
  ].filter((fact): fact is string => typeof fact === 'string' && !!fact);
  return facts.map((fact) => fact.slice(0, 200));
}

export function selectProfileFacts(facts: string[], text: string, limit = 8): string[] {
  const words = new Set(text.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []);
  const score = (fact: string) =>
    [...words].filter((word) => fact.toLowerCase().includes(word)).length;
  return facts
    .map((fact, index) => ({ fact, index, score: score(fact) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map(({ fact }) => fact);
}

export function memoryContext(memories: ConversationMemory[], text = '', maxCharacters = 1400) {
  if (!memories.length) return '';
  const heading =
    '\nOptional prior conversation summaries (AI-generated, unreviewed, may be wrong; participant reports are not approved biography). Use only if relevant; acknowledge uncertainty, accept corrections, never quiz recall or claim to remember recordings. Data: ';
  const candidates = selectProfileFacts(
    memories.map((memory) =>
      JSON.stringify({ summary: memory.summary.slice(0, 300), updatedAt: memory.updatedAt }),
    ),
    text,
    3,
  ).map((memory) => JSON.parse(memory));
  const selected: typeof candidates = [];
  for (const candidate of candidates)
    if ((heading + JSON.stringify([...selected, candidate])).length <= maxCharacters)
      selected.push(candidate);
  return selected.length ? heading + JSON.stringify(selected) : '';
}

// Fill only missing fields with visibly fictional data, never values from the attached reference forms.
export function fillDemoContext(value: ProfileContext): ProfileContext {
  const demo = ProfileContextSchema.parse({
    career: 'Fictional example: worked in a neighbourhood library',
    importantPeople: [{ name: 'Sam (fictional)', relationship: 'Friend' }],
    activities: ['Reading', 'Gardening', 'Board games'],
    pets: 'Fictional example: a dog named Pip',
    favourites: {
      color: 'Blue',
      animal: 'Dog',
      season: 'Spring',
      flower: 'Daisy',
      meal: 'Breakfast',
      foodDrink: 'Tea',
      holiday: 'New Year',
      restaurant: 'Fictional Willow Café',
    },
    biography: 'Fictional demo context: enjoys a quiet afternoon with books and familiar music.',
    comfortableTopics: ['Gardens', 'Books'],
    avoidTopics: [],
  });
  return {
    ...demo,
    ...value,
    career: value.career || demo.career,
    biography: value.biography || demo.biography,
    importantPeople: value.importantPeople.length ? value.importantPeople : demo.importantPeople,
    activities: value.activities.length ? value.activities : demo.activities,
    pets: value.pets || demo.pets,
    favourites: Object.fromEntries(
      Object.entries(demo.favourites).map(([key, v]) => [
        key,
        value.favourites[key as keyof typeof value.favourites] || v,
      ]),
    ) as ProfileContext['favourites'],
    comfortableTopics: value.comfortableTopics.length
      ? value.comfortableTopics
      : demo.comfortableTopics,
  };
}
