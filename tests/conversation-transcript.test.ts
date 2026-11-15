import { expect, test } from 'bun:test';
import { appendConversationTurn } from '../apps/web/src/lib/conversation-transcript';

test('conversation display keeps only a bounded current-session transcript', () => {
  let transcript = [] as ReturnType<typeof appendConversationTurn>;
  for (let index = 0; index < 10; index++)
    transcript = appendConversationTurn(transcript, {
      speaker: index % 2 ? 'lemmi' : 'participant',
      text: ` turn ${index} `,
    });

  expect(transcript).toHaveLength(8);
  expect(transcript[0]).toEqual({ speaker: 'participant', text: 'turn 2' });
  expect(transcript.at(-1)?.text).toBe('turn 9');
  expect(appendConversationTurn(transcript, { speaker: 'lemmi', text: '   ' })).toBe(transcript);
});
