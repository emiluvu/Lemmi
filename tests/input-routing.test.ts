import { expect, test } from 'bun:test';
import { routeParticipantText } from '../packages/server/src/adapters/input-routing';

test('reviewed English/German control phrases route before generation without matching quoted fragments', () => {
  const cases = [
    ['Stop.', 'stop'],
    ['Please stop.', 'stop'],
    ['STOP PLEASE!', 'stop'],
    ['I don’t want to talk.', 'stop'],
    ['Pause.', 'pause'],
    ['Please pause.', 'pause'],
    ['I need help.', 'help'],
    ['Please get help!', 'help'],
    ['I need…', 'incomplete_need'],
    ['I do not feel well.', 'unwell'],
    ["Don't ask about that.", 'topic_refusal'],
    ['I cannot breathe!', 'urgent'],
    ['Stopp!', 'stop'],
    ['Bitte stopp.', 'stop'],
    ['Pause bitte.', 'pause'],
    ['Ich brauche Hilfe.', 'help'],
    ['Darüber möchte ich nicht sprechen.', 'topic_refusal'],
    ['Ich bekomme keine Luft.', 'urgent'],
    ['The sign says “stop”.', 'ordinary'],
    ['Can you explain the word help?', 'ordinary'],
    ['Should I change my medicine?', 'ordinary'],
    ['Where is my sister?', 'ordinary'],
  ] as const;
  for (const [text, route] of cases) expect(routeParticipantText(text)).toBe(route);
});
