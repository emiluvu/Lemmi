import { expect, test } from 'bun:test';
import { SessionCoordinator, createOpenRouterAdapter, type ChatAdapter } from '@lemmi/server';
import { ok, fail, type CommunicationPreset } from '@lemmi/contracts';
import { caregiverProfile } from '@lemmi/contracts/fixtures';
import { routeParticipantText } from '../packages/server/src/adapters/input-routing';

function setup(adapter: ChatAdapter, preset: CommunicationPreset = 'guided') {
  const c = new SessionCoordinator('live', adapter);
  c.acceptPersistentProfile({
    ...caregiverProfile,
    communicationSupport: { preset, configVersion: 1 },
    approvedFacts: [],
    privacyRevision: 0,
    policyRevision: 0,
  });
  c.handle('session.start', {
    profileId: 'profile-alex',
    endpoint: 'robot',
    commandId: crypto.randomUUID(),
  });
  return c;
}
function submit(c: SessionCoordinator, text: string, commandId = crypto.randomUUID()) {
  const s = c.snapshot()!;
  return c.submitText({
    sessionId: s.id,
    expectedGeneration: s.generation,
    commandId,
    text,
    language: 'en',
  });
}

test('reviewed sensitive and unclear English inputs work at every preset without model calls or retained excerpts', async () => {
  const cases = [
    ['Who are you?', 'identity', false],
    ['Where does Maya live?', 'personal_location', false],
    ['Where is my husband?', 'personal_location', false],
    ['Where does Farah live?', 'personal_location', false],
    ['Where does Mary Jane live?', 'personal_location', false],
    ['Should I take another pill?', 'medication', false],
    ['Should I change my medicine?', 'medication', false],
    ['Is my dementia getting worse?', 'clinical', false],
    ['When is my husband coming home?', 'bereavement', false],
    ['Is my wife dead?', 'bereavement', false],
    ['Someone is hiding in my room.', 'frightening', true],
    ["I'm going home.", 'navigation', true],
    ["Don't write that down.", 'privacy_refusal', true],
    ['I feel suddenly confused.', 'urgent', true],
    ['I intend to hurt someone.', 'urgent', true],
    ['Please help, I cannot breathe!', 'urgent', true],
    ['...', 'unclear', false],
    ['[inaudible]', 'unclear', false],
    ['Could you repeat that?', 'unclear', false],
  ] as const;
  let calls = 0;
  for (const preset of ['conversational', 'guided', 'quiet'] as const) {
    for (const [input, route, pauses] of cases) {
      const c = setup(
        {
          async complete() {
            calls++;
            throw new Error('Unavailable fixture');
          },
        },
        preset,
      );
      expect(routeParticipantText(input)).toBe(route);
      const result = await submit(c, input);
      expect(result.ok).toBe(true);
      if (result.ok && result.data.kind === 'reply') {
        expect(result.data.reply.source).toBe('fixed');
        expect(result.data.reply.text).not.toMatch(
          /on (?:his|her) way|have contacted|already told you|extra dose is safe/i,
        );
      } else throw new Error('Expected reviewed fixed response');
      expect(c.snapshot()?.phase).toBe(pauses ? 'paused' : 'waiting');
      expect(c.snapshot()?.captureGrant).toBeNull();
      expect(c.snapshot()?.communicationSupport.preset).toBe(preset);
      expect(JSON.stringify(c.persistenceSnapshot())).not.toContain(input);
    }
  }
  expect(calls).toBe(0);
});

test('quotations, negation, general knowledge and example phrases do not become fixed emergency reports', async () => {
  let calls = 0;
  const cases = [
    'I can breathe.',
    'I did not take too many pills.',
    'My friend said "I cannot breathe" yesterday.',
    'What does "I want to hurt myself" mean in a book?',
    'The sign says stop.',
    'I do not need help.',
    'Should I take a walk?',
    'Where does a penguin live?',
  ];
  for (const input of cases) {
    const c = setup({
      async complete() {
        calls++;
        return ok({ text: 'We can take our time.', language: 'en' });
      },
    });
    expect(routeParticipantText(input)).toBe('ordinary');
    const result = await submit(c, input);
    expect(result.ok).toBe(true);
    expect(c.snapshot()?.phase).toBe('waiting');
  }
  expect(calls).toBe(cases.length);
});

test('repeated identity and unclear turns stay patient without reprompt loops, profile changes or privacy writes', async () => {
  const c = setup(
    {
      async complete() {
        throw new Error('Must not generate');
      },
    },
    'quiet',
  );
  const initial = c.snapshot()!;
  for (let i = 0; i < 3; i++) {
    const identity = await submit(c, 'Who are you?');
    expect(identity.ok && identity.data.kind === 'reply' && identity.data.reply.text).toBe(
      "I'm Lemmi, an AI companion.",
    );
    const unclear = await submit(c, '[inaudible]');
    expect(unclear.ok && unclear.data.kind === 'reply' && unclear.data.reply.text).not.toContain(
      '?',
    );
  }
  expect(c.snapshot()).toMatchObject({
    profileRevision: initial.profileRevision,
    privacyRevision: initial.privacyRevision,
    policyRevision: initial.policyRevision,
    captureGrant: null,
  });
  const stopped = await submit(c, "I don't want to talk anymore.");
  expect(stopped.ok).toBe(true);
  expect(c.snapshot()?.phase).toBe('ended');
});

test('family-location replies offer warmth and practical support; worried follow-ups carry grounded guidance and no durable text', async () => {
  let followupSystem = '',
    followupHistory = '';
  const c = setup({
    async complete(input) {
      followupSystem = input.system;
      followupHistory = JSON.stringify(input.history);
      return ok({ text: 'That sounds worrying. We can take our time together.', language: 'en' });
    },
  });
  const first = await submit(c, 'Where is my husband?');
  expect(first.ok && first.data.kind === 'reply' && first.data.reply.source).toBe('fixed');
  const reply = first.ok && first.data.kind === 'reply' ? first.data.reply.text : '';
  expect(reply).toContain('understandable');
  expect(reply).toContain('Someone you trust');
  expect(reply).not.toMatch(/he(?:'s| is) safe|busy|at work|coming later|talked with|nieces/i);
  expect((await submit(c, 'I want to see him now. I am so worried!')).ok).toBe(true);
  expect(followupSystem).toContain('acknowledge the expressed feeling warmly');
  expect(followupSystem).toContain('Never invent reassurance');
  expect(followupHistory).toContain('Where is my husband?');
  expect(JSON.stringify(c.persistenceSnapshot())).not.toContain('husband');
});

test('malformed, overlong, multiple-question and unsupported action claims are never accepted or replayed as successful chat', async () => {
  const cases: [CommunicationPreset, string][] = [
    ['guided', 'One? Two?'],
    ['guided', 'One？ Two？'],
    ['quiet', 'Would you like flowers?'],
    ['guided', 'a'.repeat(361)],
    ['quiet', 'a'.repeat(241)],
    ['conversational', '\u0000Hidden'],
    ['guided', 'I have contacted your caregiver.'],
    ['guided', 'I just talked with him. He is coming later.'],
    ['guided', 'I have just spoken to your husband.'],
    ['guided', "I've just talked to him."],
    ['guided', 'I spoke with your wife.'],
    ['guided', "I'll call your family."],
    ['guided', '<think>private reasoning marker</think>Hello.'],
    ['guided', 'See https://example.invalid'],
  ];
  for (const [preset, output] of cases) {
    let calls = 0;
    const c = setup(
      {
        async complete() {
          calls++;
          return ok({ text: output, language: 'en' });
        },
      },
      preset,
    );
    const id = crypto.randomUUID();
    const result = await submit(c, 'A fictional gardening greeting', id);
    expect(result.ok).toBe(false);
    expect(await submit(c, 'A fictional gardening greeting', id)).toEqual(result);
    expect(calls).toBe(1);
    expect(JSON.stringify(result)).not.toContain(output);
    expect(c.snapshot()?.phase).toBe('waiting');
    expect(c.snapshot()?.captureGrant).toBeNull();
    expect(c.isCurrentTextReply(id)).toBe(false);
  }
});

test('provider failures are sanitized, deduplicated and recover only on an explicit new turn', async () => {
  let calls = 0;
  const c = setup({
    async complete() {
      calls++;
      if (calls === 1) return fail('UNAVAILABLE', 'private-provider-error-marker');
      if (calls === 2) throw new Error('private-provider-exception-marker');
      return ok({ text: 'We can enjoy the garden.', language: 'en' });
    },
  });
  const id = crypto.randomUUID();
  const first = await submit(c, 'Hello there', id);
  expect(first.ok).toBe(false);
  expect(await submit(c, 'Hello there', id)).toEqual(first);
  expect(calls).toBe(1);
  expect((await submit(c, 'Try again')).ok).toBe(false);
  expect((await submit(c, 'A fresh turn')).ok).toBe(true);
  expect(JSON.stringify(c)).not.toContain('private-provider-');
  expect(calls).toBe(3);
});

test('actual adapter deadline cancels a stalled provider once without automatic retries', async () => {
  let calls = 0,
    aborted = false;
  const adapter = createOpenRouterAdapter(
    { apiKey: 'fixture-key-only', model: 'fixture/model', maxTokens: 160, timeoutMs: 1000 },
    async (_url, init) => {
      calls++;
      return new Promise<Response>((_resolve, reject) => {
        const abort = () => {
          aborted = true;
          reject(new Error('private-timeout-marker'));
        };
        if (init?.signal?.aborted) abort();
        else init?.signal?.addEventListener('abort', abort, { once: true });
      });
    },
  );
  const c = setup(adapter),
    id = crypto.randomUUID();
  const result = await submit(c, 'A fictional greeting', id);
  expect(result.ok).toBe(false);
  expect(aborted).toBe(true);
  expect(calls).toBe(1);
  expect(await submit(c, 'A fictional greeting', id)).toEqual(result);
  expect(JSON.stringify(result)).not.toContain('private-timeout-marker');
  expect(c.snapshot()?.phase).toBe('waiting');
}, 5000);
