import { expect, test } from 'bun:test';
import { permittedConversationSummary } from '../packages/server/src/profile-context';

test('optional summary validation permits bounded topic paraphrases in English and German', () => {
  expect(
    permittedConversationSummary(
      'Participant discussed growing tomatoes.',
      'I planted tomatoes by the garden path this morning.',
      'en',
    ),
  ).toBe(true);
  expect(
    permittedConversationSummary(
      'Die Person erzählte vom Pflanzen von Tomaten.',
      'Heute habe ich Tomaten im Garten gepflanzt.',
      'de',
    ),
  ).toBe(true);
  expect(
    permittedConversationSummary(
      "Participant doesn't enjoy gardening and isn't interested in roses.",
      'I would rather discuss music than flowers.',
      'en',
    ),
  ).toBe(true);
  expect(permittedConversationSummary('Participant discussed gardening.', 'Gardening', 'en')).toBe(
    true,
  );
  expect(
    permittedConversationSummary(
      'Discussed a fictional visit on 2026-11-14.',
      'We were talking about visiting a garden.',
      'en',
    ),
  ).toBe(true);
  const limit = 'Discussed '.padEnd(300, 'x');
  expect(permittedConversationSummary(limit, 'Tell me about gardens', 'en')).toBe(true);
  expect(permittedConversationSummary(limit + 'x', 'Tell me about gardens', 'en')).toBe(false);
});

test('optional memory cannot retain a whole participant turn or a copied transcript stretch', () => {
  const source = 'I planted tomatoes by the garden path this morning';
  for (const stored of [
    source,
    source.toUpperCase() + '.',
    'Participant said: ' + source + '.',
    'Participant reported planting: I planted tomatoes by the garden path this morning, and watering them.',
  ])
    expect(permittedConversationSummary(stored, source, 'en')).toBe(false);
  expect(permittedConversationSummary('I like daisies', 'I like daisies', 'en')).toBe(false);
  expect(
    permittedConversationSummary('Participant said I like daisies.', 'I like daisies', 'en'),
  ).toBe(false);
  expect(
    permittedConversationSummary(
      'Participant mentioned the garden path this morning and then discussed having tea outside after lunch.',
      'We saw the garden path this morning and then discussed having tea outside after lunch while the flowers grew.',
      'en',
    ),
  ).toBe(false);
});

test('optional memory rejects quoted speech, contact payloads and unsupported action receipts', () => {
  const rejected = [
    'Participant said "flowers are lovely".',
    'Participant said “flowers are lovely”.',
    "Participant said 'flowers are lovely'.",
    'Contact the fictional recipient at demo@example.invalid.',
    'Call the fictional phone +1 (202) 555-0149.',
    'Write to 123 Fictional Street.',
    'Die Adresse ist Beispielstraße 123.',
    'I have contacted your caregiver.',
    'Lemmi contacted the caregiver.',
    'Contacted the caregiver today.',
    'We sent a message to the caregiver.',
    'Ich habe die Betreuungsperson angerufen.',
    'Would you like another conversation?',
    '<b>Discussed flowers.</b>',
    'Visit https://example.invalid.',
  ];
  for (const summary of rejected)
    expect(permittedConversationSummary(summary, 'A fictional gardening discussion', 'en')).toBe(
      false,
    );
});

test('optional memory excludes clinical judgments and treatment instructions', () => {
  for (const summary of [
    'Participant has dementia.',
    'Participant showed cognitive decline.',
    'Participant was confused and aggressive.',
    'Participant should take another pill.',
    'The person needs to change the medication dose.',
    'Die Person hat Demenz.',
    'Die Person war verwirrt.',
    'Die Person muss ihre Medikamente nehmen.',
  ])
    expect(permittedConversationSummary(summary, 'A fictional discussion', 'en')).toBe(false);
});
