import { expect, test } from 'bun:test';
import { ServerEventSchema, type SessionSnapshot } from '@lemmi/contracts';
import { controlSessionFixture } from '@lemmi/contracts/fixtures';
import { mayPresentReply } from '../apps/web/src/lib/participant-presentation';

const session: SessionSnapshot = {
  ...controlSessionFixture,
  phase: 'waiting',
  activeEndpointId: 'fixture-browser',
};
const event = ServerEventSchema.parse({
  protocol_version: 1,
  event_id: 'fixture-reply',
  session_id: session.id,
  generation: session.generation,
  turn_id: 'fixture-turn',
  sequence: 1,
  type: 'response.text',
  payload: { turnId: 'fixture-turn', text: 'A fictional reply.', language: 'en', source: 'model' },
});
if (event.type !== 'response.text') throw new Error('Wrong fixture');

test('participant presentation drops old profile/session, generation, turn and endpoint replies', () => {
  expect(mayPresentReply(event, session, 'fixture-browser')).toBe(true);
  for (const current of [
    null,
    { ...session, id: 'another-session' },
    { ...session, generation: session.generation + 1 },
    { ...session, activeEndpointId: 'fixture-robot' },
    { ...session, phase: 'ended' as const },
  ])
    expect(mayPresentReply(event, current, 'fixture-browser')).toBe(false);
  expect(mayPresentReply({ ...event, turn_id: 'another-turn' }, session, 'fixture-browser')).toBe(
    false,
  );
  expect(mayPresentReply(event, session, undefined)).toBe(false);
});

test('paused presentation admits only the current application-owned fixed reply', () => {
  const paused = { ...session, phase: 'paused' as const };
  expect(mayPresentReply(event, paused, 'fixture-browser')).toBe(false);
  const fixed = { ...event, payload: { ...event.payload, source: 'fixed' as const } };
  expect(mayPresentReply(fixed, paused, 'fixture-browser')).toBe(true);
  expect(
    mayPresentReply(fixed, { ...paused, generation: paused.generation + 1 }, 'fixture-browser'),
  ).toBe(false);
});
