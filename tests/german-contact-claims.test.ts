import { expect, test } from 'bun:test';
import { permittedModelReply } from '../packages/server/src/adapters/reply-policy';

test('German generated contact claims about relatives and third parties are rejected at every preset', () => {
  const claims = [
    'Ich habe gerade mit Ihrem Mann gesprochen.',
    'Ich habe eben mit deiner Frau geredet.',
    'Ich habe mit Ihrer Familie telefoniert.',
    'Ich hab schon mit ihm gesprochen.',
    "Ich hab' mit ihr telefoniert.",
    'Ich hab’ gerade eben mit deinem Ehemann gesprochen.',
    'Ich habe Ihren Mann bereits angerufen.',
    'Ich hab ihn gerade erreicht.',
    'Ich habe deine Mutter benachrichtigt.',
    'Ich sprach vorhin mit Ihrer Schwester.',
    'Ich rede gerade mit Ihrem Mann.',
    'Ich telefoniere mit ihm.',
    'Ich werde mit deinem Vater sprechen.',
    'Ich werde gleich Ihren Mann anrufen.',
    'Ich rufe jetzt deine Frau an.',
    'Ich kontaktiere Ihre Familie.',
    'Ich habe gerade\nmit Ihrem Mann gesprochen.',
  ];
  for (const preset of ['conversational', 'guided', 'quiet'] as const)
    for (const text of claims)
      expect(permittedModelReply(text, { preset, configVersion: 1 })).toBe(false);
});

test('German denials, participant conversation and practical support do not become contact claims', () => {
  const replies = [
    'Ich habe nicht mit Ihrem Mann gesprochen.',
    'Ich habe mit ihm nicht gesprochen.',
    'Ich habe ihn nicht angerufen.',
    'Ich habe niemanden kontaktiert.',
    'Ich kann nicht mit Ihrer Familie telefonieren.',
    'Ich rufe Ihren Mann nicht an.',
    'Ich spreche mit ihm nicht.',
    'Ich kann keine Anrufe tätigen.',
    'Ich habe mit Ihnen über Blumen gesprochen.',
    'Ich habe mit dir gesprochen.',
    'Wir haben gerade über Ihren Mann gesprochen.',
    'Eine vertraute Person kann Ihnen vielleicht helfen.',
    'Sie können Ihren Mann anrufen.',
    'Wir können uns Zeit lassen.',
  ];
  for (const preset of ['conversational', 'guided', 'quiet'] as const)
    for (const text of replies)
      expect(permittedModelReply(text, { preset, configVersion: 1 })).toBe(true);
});

test('adding German checks preserves English fabricated-contact rejection', () => {
  for (const text of [
    'I just talked with him.',
    "I've just spoken to your husband.",
    'I have contacted your caregiver.',
    "I'll call your family.",
  ])
    expect(permittedModelReply(text, { preset: 'guided', configVersion: 1 })).toBe(false);
  expect(
    permittedModelReply('We talked about the garden.', { preset: 'guided', configVersion: 1 }),
  ).toBe(true);
});
