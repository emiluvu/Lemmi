import { expect, test } from 'bun:test';
import { SessionCoordinator } from '@lemmi/server';
import {
  ConversationRedirectsSchema,
  ParticipantProfileSchema,
  ok,
  type ConversationRedirects,
} from '@lemmi/contracts';
import { caregiverProfile } from '@lemmi/contracts/fixtures';
import type { ChatInput } from '../packages/server/src/adapters/types';
import {
  mentionsTopic,
  redirectInstructions,
} from '../packages/server/src/adapters/conversation-redirects';

function setup(
  settings: ConversationRedirects = { awayFrom: [], toward: [] },
  answer = 'Would you like to talk about colours?',
) {
  const calls: ChatInput[] = [];
  const c = new SessionCoordinator('live', {
    async complete(input) {
      calls.push(structuredClone(input));
      return ok({ text: answer, language: input.language });
    },
  });
  c.acceptPersistentProfile({
    ...caregiverProfile,
    conversationRedirects: settings,
    privacyRevision: 0,
    policyRevision: 0,
    approvedFacts: [],
  });
  c.handle('session.start', {
    profileId: caregiverProfile.id,
    endpoint: 'browser',
    commandId: crypto.randomUUID(),
  });
  const say = (text: string) =>
    c.submitText({
      sessionId: c.snapshot()!.id,
      expectedGeneration: c.snapshot()!.generation,
      commandId: crypto.randomUUID(),
      text,
      language: 'en',
    });
  return { c, calls, say };
}

test('redirect configuration is bounded, phrase matching avoids substring collisions and neutral fallback excludes conflicts', () => {
  expect(
    ConversationRedirectsSchema.safeParse({ awayFrom: Array(13).fill('work'), toward: [] }).success,
  ).toBe(false);
  expect(mentionsTopic('My artwork', ['work'])).toBe(false);
  expect(mentionsTopic('OLD—JOB!', ['old job'])).toBe(true);
  expect(
    redirectInstructions('old job', { awayFrom: ['old job'], toward: ['my old job'] }),
  ).toContain('No suitable alternative');
});

test('redirects are private and only apply once before allowing participant-led continuation', async () => {
  const { c, calls, say } = setup({ awayFrom: ['old job'], toward: ['flowers'] });
  await say('I was thinking about my old job');
  expect(calls[0]?.system).toContain('gentle subject transition');
  expect(calls[0]?.system).toContain('flowers');
  await say('No, I want to talk about my old job');
  expect(calls[1]?.system).toContain('do not push another redirect');
  const profile = c.handle('profile.load', { profileId: caregiverProfile.id });
  // Participant projections never contain the configuration, regardless of live RPC availability.
  expect(
    ParticipantProfileSchema.safeParse({
      ...caregiverProfile,
      conversationRedirects: { awayFrom: [], toward: [] },
    }).success,
  ).toBe(false);
  expect(JSON.stringify(c.snapshot())).not.toContain('old job');
  expect(JSON.stringify(profile)).not.toContain('old job');
});

test('redirect output that repeats the avoided subject gets a neutral fixed reply; urgent routing wins', async () => {
  const { say, calls } = setup(
    { awayFrom: ['old job', 'breathe'], toward: [] },
    'Your old job sounds interesting.',
  );
  const reply = await say('My old job');
  expect(reply.ok && reply.data.kind === 'reply' && reply.data.reply.source).toBe('fixed');
  expect(JSON.stringify(reply)).not.toContain('old job');
  const urgent = await say("I can't breathe");
  expect(calls).toHaveLength(1);
  expect(urgent.ok && urgent.data.session.phase).toBe('paused');
});

test('thread reminders use only recent participant text, ignore recap requests and do not call the model', async () => {
  const { c, say, calls } = setup();
  await say('I am knitting a blue scarf');
  for (const phrase of ['What was I talking about?', 'I lost my train of thought']) {
    const result = await say(phrase);
    expect(result.ok && result.data.kind === 'reply' && result.data.reply.text).toContain(
      'knitting a blue scarf',
    );
  }
  expect(calls).toHaveLength(1);
  c.handle('session.command', {
    sessionId: c.snapshot()!.id,
    expectedGeneration: c.snapshot()!.generation,
    commandId: crypto.randomUUID(),
    action: { type: 'stop' },
  });
  expect(JSON.stringify(c)).not.toContain('blue scarf');
});

test('missing or redirect-marked context gives a fresh start instead of resurfacing the subject', async () => {
  const { say, calls } = setup({ awayFrom: ['old job'], toward: [] });
  expect(JSON.stringify(await say('Where was I?'))).toContain('something new');
  await say('My old job');
  const result = await say('What was I talking about?');
  expect(JSON.stringify(result)).not.toContain('old job');
  expect(JSON.stringify(result)).toContain('something new');
  expect(calls).toHaveLength(1);
});

test('changing redirect configuration cancels pending output before it can use obsolete guidance', async () => {
  let finish!: (value: any) => void;
  const c = new SessionCoordinator('live', {
    complete: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  const profile = {
    ...caregiverProfile,
    conversationRedirects: { awayFrom: ['old job'], toward: ['flowers'] },
    privacyRevision: 0,
    policyRevision: 0,
    approvedFacts: [],
  };
  c.acceptPersistentProfile(profile);
  c.handle('session.start', {
    profileId: profile.id,
    endpoint: 'browser',
    commandId: crypto.randomUUID(),
  });
  const work = c.submitText({
    sessionId: c.snapshot()!.id,
    expectedGeneration: c.snapshot()!.generation,
    commandId: crypto.randomUUID(),
    text: 'My old job',
    language: 'en',
  });
  await Promise.resolve();
  c.pauseForProfileUpdate({ conversationRedirects: { awayFrom: [], toward: [] } });
  c.acceptPersistentProfile({
    ...profile,
    revision: 1,
    conversationRedirects: { awayFrom: [], toward: [] },
  });
  finish(ok({ text: 'late obsolete redirect', language: 'en' }));
  expect((await work).ok).toBe(false);
  expect(c.snapshot()?.phase).toBe('paused');
  expect(JSON.stringify(c)).not.toContain('late obsolete redirect');
});
