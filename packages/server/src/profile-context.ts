import {
  ProfileContextSchema,
  type ProfileContext,
  type ConversationMemory,
} from '@lemmi/contracts';

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

export function memoryContext(memories: ConversationMemory[], text = '') {
  if (!memories.length) return '';
  return (
    '\nOptional prior conversation summaries (AI-generated, unreviewed, may be wrong; participant reports are not approved biography). Use only if relevant; acknowledge uncertainty, accept corrections, never quiz recall or claim to remember recordings. Data: ' +
    JSON.stringify(
      selectProfileFacts(
        memories.map((memory) =>
          JSON.stringify({ summary: memory.summary.slice(0, 300), updatedAt: memory.updatedAt }),
        ),
        text,
        3,
      ).map((memory) => JSON.parse(memory)),
    )
  );
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
