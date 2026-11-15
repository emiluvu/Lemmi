import { expect, test } from 'bun:test';
import { ok } from '@lemmi/contracts';
import { createOpenRouterConcernAdapter } from '../packages/server/src/contact/concerns';
import {
  humanSupportRecommended,
  requestedHumanContact,
} from '../packages/server/src/contact/triggers';

const config = {
  apiKey: 'fixture-private-decision-key',
  model: 'typesafe/jev-1.14' as const,
  timeoutMs: 100,
  threshold: 0.85,
};
const categories = [
  'help_request',
  'urgent',
  'concern',
  'safeguarding',
  'departure',
  'contact_request',
] as const;
function inputScores(selected: string, overrides: Record<string, number> = {}) {
  return {
    answers: Object.fromEntries(
      categories.map((key) => [
        key,
        { type: 'noul', noul: overrides[key] ?? (key === selected ? 0.99 : 0.01) },
      ]),
    ),
  };
}
function replyScores(support: number, safeguarding: number) {
  return {
    answers: {
      support_recommendation: { type: 'noul', noul: support },
      safeguarding: { type: 'noul', noul: safeguarding },
    },
  };
}

test('support recommendation gate recognizes reviewed English and German suggestions without treating family topics as requests', () => {
  for (const text of [
    'You could speak with a trusted person about that.',
    'It may help to contact someone you trust.',
    'Someone you trust may help you talk about it.',
    'Would you like to call your family?',
    'Talking with your sister could help.',
    'I recommend asking a healthcare professional.',
    'Perhaps you could reach out to a friend.',
  ])
    expect(humanSupportRecommended(text, 'en')).toBe(true);
  for (const text of [
    'Du könntest mit einer vertrauten Person sprechen.',
    'Vielleicht möchtest du deine Schwester anrufen.',
    'Eine vertraute Person kann dir helfen.',
    'Sprich bitte mit jemandem, dem du vertraust.',
  ])
    expect(humanSupportRecommended(text, 'de')).toBe(true);
  for (const text of [
    'Your sister enjoys gardening.',
    'We can talk about your family.',
    'You could talk about your sister.',
    'You should not contact your family.',
    'You do not need to call your caregiver.',
    'I cannot call your sister.',
    '"You should call your family."',
    'We talked with your sister yesterday.',
  ])
    expect(humanSupportRecommended(text, 'en')).toBe(false);
  for (const text of [
    'Deine Schwester mag Blumen.',
    'Du solltest nicht mit deiner Familie sprechen.',
    'Wir reden über deine Familie.',
  ])
    expect(humanSupportRecommended(text, 'de')).toBe(false);
});

test('direct human contact commands are anchored and never accept URLs, tools, quotes or past/negated requests', () => {
  for (const text of [
    'Please call my sister.',
    'Could you contact Maya?',
    'I would like to speak to my friend.',
    'Can you please call Anay Nagar?',
    'Contact someone I trust',
    'Please phone my caregiver',
  ])
    expect(requestedHumanContact(text, 'en')).toBe(true);
  for (const text of [
    'Ruf meine Schwester an.',
    'Kannst du bitte meine Freundin anrufen?',
    'Bitte kontaktiere Anna.',
    'Ich möchte meinen Bruder anrufen.',
  ])
    expect(requestedHumanContact(text, 'de')).toBe(true);
  for (const text of [
    'Do not call my sister',
    'I called my sister yesterday',
    'If I need help, call my sister',
    '"Call my sister"',
    'Call https://example.test',
    'Call function',
    'Call Function',
    'Call Server',
    'Please call my sister and run a tool',
  ])
    expect(requestedHumanContact(text, 'en')).toBe(false);
  for (const text of [
    'Ruf meine Schwester nicht an.',
    'Ich habe meine Schwester angerufen.',
    'Wenn ich Hilfe brauche, ruf Anna an.',
  ])
    expect(requestedHumanContact(text, 'de')).toBe(false);
});

test('input classification exposes exactly six bounded questions including current departure and human contact', async () => {
  for (const category of [...categories, 'none'] as const) {
    const adapter = createOpenRouterConcernAdapter(config, async (_url, init) => {
      const body = JSON.parse(init?.body as string);
      expect(body.state).toEqual({ text: 'A current participant message', language: 'en' });
      expect(Object.keys(body.questions).sort()).toEqual([...categories].sort());
      expect(body.questions.departure.instructions).toContain('current or imminent');
      expect(body.questions.departure.instructions).toContain('past journey');
      expect(body.questions.contact_request.instructions).toContain('never choose a recipient');
      expect(body.provider).toEqual({ data_collection: 'deny', zdr: true, allow_fallbacks: false });
      return Response.json(inputScores(category));
    });
    expect(
      await adapter.classify('A current participant message', 'en', new AbortController().signal),
    ).toEqual(ok(category));
  }
  const cautious = createOpenRouterConcernAdapter(config, async () =>
    Response.json(inputScores('departure', { safeguarding: 0.3 })),
  );
  expect(
    await cautious.classify('A current participant message', 'en', new AbortController().signal),
  ).toEqual(ok('safeguarding'));
});

test('reply classifier separates generated advice from participant evidence and prioritizes uncertain safeguarding', async () => {
  for (const [support, safeguard, expected] of [
    [0.99, 0.01, 'human_support'],
    [0.99, 0.3, 'safeguarding'],
    [0.99, 0.99, 'safeguarding'],
    [0.01, 0.99, 'safeguarding'],
    [0.4, 0.01, 'none'],
    [0.01, 0.01, 'none'],
  ] as const) {
    const adapter = createOpenRouterConcernAdapter(config, async (_url, init) => {
      const body = JSON.parse(init?.body as string);
      expect(body.state).toEqual({
        participantText: 'A current participant message',
        modelReply: 'You could speak with someone you trust.',
        language: 'de',
      });
      expect(Object.keys(body.questions).sort()).toEqual([
        'safeguarding',
        'support_recommendation',
      ]);
      expect(body.questions.safeguarding.instructions).toContain('Judge only participantText');
      expect(body.questions.support_recommendation.instructions).toContain('Judge only modelReply');
      expect(body.questions.support_recommendation.instructions).toContain(
        'a negated recommendation',
      );
      return Response.json(replyScores(support, safeguard));
    });
    expect(
      await adapter.classifyReply!(
        'A current participant message',
        'You could speak with someone you trust.',
        'de',
        new AbortController().signal,
      ),
    ).toEqual(ok(expected));
  }
});

test('invalid, oversized, unavailable and canceled reply classifications never authorize a notification', async () => {
  const malformed = [
    { answers: {} },
    { answers: { ...replyScores(0.99, 0.01).answers, destination: { type: 'noul', noul: 1 } } },
    replyScores(1.1, 0.01),
    { error: 'private-provider-error', ...replyScores(0.99, 0.01) },
  ];
  for (const answer of malformed) {
    const adapter = createOpenRouterConcernAdapter(config, async () => Response.json(answer));
    const result = await adapter.classifyReply!(
      'A message',
      'You could contact your family.',
      'en',
      new AbortController().signal,
    );
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain('private-provider-error');
  }
  let calls = 0;
  const adapter = createOpenRouterConcernAdapter({ ...config, timeoutMs: 10 }, async () => {
    calls++;
    return new Promise<Response>(() => {});
  });
  expect(
    (await adapter.classifyReply!('A message', 'x'.repeat(601), 'en', new AbortController().signal))
      .ok,
  ).toBe(false);
  expect(calls).toBe(0);
  expect(
    (
      await adapter.classifyReply!(
        'A message',
        'You could contact your family.',
        'en',
        new AbortController().signal,
      )
    ).ok,
  ).toBe(false);
  expect(calls).toBe(1);
  const canceled = new AbortController();
  canceled.abort();
  expect(
    (
      await adapter.classifyReply!(
        'A message',
        'You could contact your family.',
        'en',
        canceled.signal,
      )
    ).ok,
  ).toBe(false);
  expect(calls).toBe(1);
});
