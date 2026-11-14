import { expect, test } from 'bun:test';
import {
  ConversationTextResultSchema,
  SessionSnapshotSchema,
  ok,
  fail,
  type SessionCommand,
} from '@lemmi/contracts';
import {
  eligibleTeachingTopics,
  nextTeachingTopic,
  teachingTextIntent,
  TEACHING_ACTIVE_LIMIT_MS,
} from '@lemmi/activities';
import { MockCoordinator, SessionCoordinator, type ChatAdapter } from '@lemmi/server';
import { caregiverProfile } from '@lemmi/contracts/fixtures';

function setup(adapter?: ChatAdapter) {
  let now = 1000;
  const received: { system: string; text: string; history: unknown[] }[] = [];
  const c = new SessionCoordinator(
    'live',
    adapter ?? {
      async complete(input) {
        received.push(input);
        return ok({ text: 'How do you care for roses?', language: input.language });
      },
    },
    undefined,
    () => now,
  );
  start(c);
  return {
    c,
    received,
    advance: (ms: number) => {
      now += ms;
    },
  };
}
function start(c: SessionCoordinator) {
  const r = c.handle('session.start', {
    profileId: 'profile-alex',
    endpoint: 'browser',
    commandId: crypto.randomUUID(),
  });
  expect(r.ok).toBe(true);
}
function control(
  c: SessionCoordinator,
  type: SessionCommand['action']['type'],
  id = crypto.randomUUID(),
) {
  const s = c.snapshot()!;
  return c.handle('session.command', {
    sessionId: s.id,
    expectedGeneration: s.generation,
    commandId: id,
    action: { type },
  });
}
function say(c: SessionCoordinator, text: string, commandId = crypto.randomUUID()) {
  const s = c.snapshot()!;
  return c.submitText({
    sessionId: s.id,
    expectedGeneration: s.generation,
    commandId,
    text,
    language: 'en',
  });
}
const eligibility = {
  profileId: 'profile-alex',
  sessionId: 'session-test',
  policyRevision: 0,
  permittedEntityIds: ['topic:gardening', 'topic:beaches', 'topic:banking'],
  sessionHiddenIds: [],
  available: true,
};

test('reviewed topic selection is deterministic, bounded and respects hidden/unavailable policy', () => {
  expect(nextTeachingTopic(eligibility, [])?.entityId).toBe('topic:gardening');
  expect(nextTeachingTopic(eligibility, [], ['topic:beaches'])?.entityId).toBe('topic:beaches');
  expect(nextTeachingTopic(eligibility, ['topic:gardening'])?.entityId).toBe('topic:beaches');
  expect(nextTeachingTopic(eligibility, eligibility.permittedEntityIds)).toBeNull();
  expect(eligibleTeachingTopics({ ...eligibility, available: false })).toEqual([]);
  expect(
    eligibleTeachingTopics({ ...eligibility, sessionHiddenIds: eligibility.permittedEntityIds }),
  ).toEqual([]);
  expect(eligibleTeachingTopics({ ...eligibility, permittedEntityIds: ['topic:cooking'] })).toEqual(
    [],
  );
});

test('teaching reuses conversation mode and minimal context; follow-up is validated and transient', async () => {
  const { c, received } = setup();
  expect(control(c, 'teaching.start').ok).toBe(true);
  const s = SessionSnapshotSchema.parse(c.snapshot());
  expect(s.conversationMode).toBe('teach_lemmi');
  expect(s.teaching?.topicLabel).toBe('Gardening');
  expect(s.teaching?.prompt).toBe('Would you like to tell me about growing flowers?');
  expect(s.captureGrant).toBeNull();
  const r = await say(c, 'I like growing roses');
  expect(r.ok).toBe(true);
  if (r.ok) expect(ConversationTextResultSchema.safeParse(r.data).success).toBe(true);
  expect(received[0]?.system).toContain('Teach Lemmi conversation mode');
  expect(received[0]?.system).not.toContain('Barbara');
  expect(received[0]?.system).not.toContain('sensitiveTopicGuidance');
  expect(received[0]!.system.length).toBeLessThanOrEqual(5000);
  control(c, 'teaching.next');
  expect(JSON.stringify(c)).not.toContain('I like growing roses');
  expect(c.snapshot()?.teaching?.entityId).toBe('topic:beaches');
});

test('silence, short replies and uncertain recognition never become negative preferences or journal paraphrases', async () => {
  const c = new MockCoordinator();
  start(c);
  control(c, 'teaching.start');
  expect((await say(c, '')).ok).toBe(false);
  const r = await say(c, 'yes');
  expect(r.ok).toBe(true);
  if (r.ok && r.data.kind === 'reply') {
    expect(r.data.reply.source).toBe('scripted');
    expect(r.data.reply.text).not.toContain('?');
  }
  expect(c.snapshot()?.teaching?.entityId).toBe('topic:gardening');
  const journal = c.handle('journal.load', { profileId: 'profile-alex' });
  expect(journal.ok).toBe(true);
  expect(JSON.stringify(journal)).not.toContain('yes');
  expect(JSON.stringify(journal)).not.toContain('disinterest');
  expect(
    c.handle('preferences.signal', {
      commandId: 'signal',
      sessionId: c.snapshot()!.id,
      presentationId: 'invalid',
      presentationRevision: 0,
      policyRevision: 0,
      entityId: 'topic:gardening',
      signal: 'prefer',
    }).ok,
  ).toBe(false);
});

test('explicit preference is current-topic-bound; explanations, skips and quoted controls are not signals', () => {
  for (const text of [
    '',
    'yes',
    'I grow roses',
    'The sign says stop',
    'I like talking about banking',
  ])
    expect(teachingTextIntent(text, 'topic:gardening')).toBe('explanation');
  expect(teachingTextIntent('I like this topic')).toBe('prefer');
  expect(teachingTextIntent('I like talking about gardening', 'topic:gardening')).toBe('prefer');
  expect(teachingTextIntent("I don't want to talk about gardening", 'topic:gardening')).toBe(
    'avoid',
  );
});

test('Not sure and refusal hide the topic immediately across teaching restarts in the same session', async () => {
  for (const action of ['teaching.not_sure', 'teaching.avoid'] as const) {
    const { c } = setup();
    control(c, 'teaching.start');
    control(c, action);
    expect(c.snapshot()?.teaching?.entityId).toBe('topic:beaches');
    control(c, 'teaching.finish');
    control(c, 'teaching.start');
    expect(c.snapshot()?.teaching?.entityId).toBe('topic:beaches');
  }
  const { c } = setup();
  control(c, 'teaching.start');
  await say(c, "Don't ask about that.");
  expect(c.snapshot()?.phase).toBe('paused');
  expect(c.snapshot()?.teaching?.entityId).toBeNull();
  control(c, 'resume');
  control(c, 'teaching.next');
  expect(c.snapshot()?.teaching?.entityId).toBe('topic:beaches');
});

test('explicit Like is session-only; finish/new session does not silently enable remembering', async () => {
  const c = new MockCoordinator();
  start(c);
  control(c, 'teaching.start');
  await say(c, 'I like this topic');
  expect(c.snapshot()?.teaching?.entityId).toBe('topic:gardening');
  control(c, 'stop');
  expect(JSON.stringify(c.handle('preferences.load', { profileId: 'profile-alex' }))).toContain(
    '"rememberingEnabled":false',
  );
  start(c);
  control(c, 'teaching.start');
  expect(c.snapshot()?.teaching?.entityId).toBe('topic:gardening');
});

test('15 minutes counts active waiting/turn time, excludes pauses and requires fresh explicit start', () => {
  const { c, advance } = setup();
  control(c, 'teaching.start');
  advance(5 * 60_000);
  control(c, 'pause');
  advance(60 * 60_000);
  expect(c.sweepTeaching()).toBe(false);
  expect(c.snapshot()?.phase).toBe('paused');
  control(c, 'resume');
  expect(c.snapshot()?.captureGrant).toBeNull();
  advance(10 * 60_000 - 1);
  expect(c.sweepTeaching()).toBe(false);
  advance(1);
  expect(c.sweepTeaching()).toBe(true);
  expect(c.snapshot()?.conversationMode).toBe('open');
  expect(c.snapshot()?.phase).toBe('ready');
  expect(c.snapshot()?.teaching).toBeNull();
  expect(c.snapshot()?.captureGrant).toBeNull();
});

test('finishing teaching preserves pauses until an explicit resume, including configuration saves', async () => {
  for (const reason of ['participant', 'disconnect', 'support', 'configuration'] as const) {
    const { c, received } = setup();
    control(c, 'teaching.start');
    let release = () => {};
    if (reason === 'participant') control(c, 'pause');
    else if (reason === 'disconnect') c.disconnect();
    else if (reason === 'configuration') release = c.beginProfileUpdate({ interests: [] });
    else {
      const s = c.snapshot()!;
      expect(
        c.applyCommunicationSupport(
          {
            profileId: s.profileId,
            sessionId: s.id,
            expectedGeneration: s.generation,
            expectedProfileRevision: 0,
            commandId: crypto.randomUUID(),
          },
          caregiverProfile,
          'fixture-caregiver',
        ).ok,
      ).toBe(true);
    }
    expect(c.snapshot()?.phase).toBe('paused');
    expect(control(c, 'teaching.finish').ok).toBe(true);
    expect(c.snapshot()?.conversationMode).toBe('open');
    expect(c.snapshot()?.teaching).toBeNull();
    expect(c.snapshot()?.phase).toBe('paused');
    expect(c.snapshot()?.captureGrant).toBeNull();
    expect(control(c, 'teaching.start').ok).toBe(false);
    expect((await say(c, 'Do not send this while paused')).ok).toBe(false);
    expect(received).toEqual([]);
    if (reason === 'configuration') expect(control(c, 'resume').ok).toBe(false);
    release();
    expect(control(c, 'resume').ok).toBe(true);
    expect(c.snapshot()?.phase).toBe('ready');
    expect(c.snapshot()?.captureGrant).toBeNull();
  }
});

test('topic changes do not reset the active limit; unavailable content does not accrue time', () => {
  const { c, advance } = setup();
  control(c, 'teaching.start');
  advance(TEACHING_ACTIVE_LIMIT_MS - 1);
  control(c, 'teaching.next');
  advance(1);
  expect(c.sweepTeaching()).toBe(true);
  control(c, 'teaching.start');
  control(c, 'teaching.next');
  control(c, 'teaching.next');
  control(c, 'teaching.next');
  expect(c.snapshot()?.teaching?.phase).toBe('unavailable');
  advance(TEACHING_ACTIVE_LIMIT_MS * 2);
  expect(c.sweepTeaching()).toBe(false);
  control(c, 'teaching.finish');
  expect(c.snapshot()?.phase).toBe('ready');
});

test('all interruption paths abort pending generation and suppress a late teaching response', async () => {
  for (const action of [
    'stop',
    'pause',
    'teaching.next',
    'teaching.not_sure',
    'teaching.finish',
    'timeout',
    'policy',
    'disconnect',
  ] as const) {
    let finish!: (value: any) => void, signal!: AbortSignal;
    const { c, advance } = setup({
      complete(_input, s) {
        signal = s;
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
    });
    control(c, 'teaching.start');
    const pending = say(c, 'fictional-private-teaching-marker');
    await Promise.resolve();
    if (action === 'timeout') {
      advance(TEACHING_ACTIVE_LIMIT_MS);
      c.sweepTeaching();
    } else if (action === 'policy')
      c.applyTeachingEligibility({
        ...eligibility,
        sessionId: c.snapshot()!.id,
        policyRevision: 1,
        permittedEntityIds: [],
      });
    else if (action === 'disconnect') c.disconnect();
    else control(c, action);
    expect(signal.aborted).toBe(true);
    finish(ok({ text: 'obsolete reply', language: 'en' }));
    expect((await pending).ok).toBe(false);
    expect(JSON.stringify(c)).not.toContain('fictional-private-teaching-marker');
    expect(JSON.stringify(c)).not.toContain('obsolete reply');
  }
});

test('Stop variants bypass generation, and duplicate/stale topic commands do not advance twice', async () => {
  for (const phrase of [
    'Stop',
    "I don't want to play anymore",
    'I do not want to play any more',
    "I don't want to play this anymore",
    'I dont want to play the game anymore',
    'Can we stop?',
    "Let's stop",
    'Stop the game',
    'I want to stop',
  ]) {
    const { c, received } = setup();
    control(c, 'teaching.start');
    await say(c, phrase);
    expect(c.snapshot()?.phase).toBe('ended');
    expect(received).toEqual([]);
  }
  const { c } = setup();
  control(c, 'teaching.start');
  const s = c.snapshot()!,
    command = {
      sessionId: s.id,
      expectedGeneration: s.generation,
      commandId: 'next-once',
      action: { type: 'teaching.next' },
    };
  expect(c.handle('session.command', command)).toEqual(c.handle('session.command', command));
  expect(c.snapshot()?.teaching?.entityId).toBe('topic:beaches');
  expect(c.handle('session.command', { ...command, commandId: 'stale' }).ok).toBe(false);
});

test('service failure stays explicit; quiet responses cannot ask questions; sparse profiles have no invented topics', async () => {
  const { c } = setup({
    async complete() {
      return fail('UNAVAILABLE', 'Service unavailable');
    },
  });
  control(c, 'teaching.start');
  expect((await say(c, 'I grow roses')).ok).toBe(false);
  expect(c.snapshot()?.phase).toBe('waiting');
  const mock = new MockCoordinator();
  mock.handle('profile.save', {
    profile: { ...caregiverProfile, communicationSupport: { preset: 'quiet', configVersion: 1 } },
    expectedRevision: 0,
  });
  start(mock);
  control(mock, 'teaching.start');
  expect(mock.snapshot()?.teaching?.prompt).not.toContain('?');
  const quiet = await say(mock, 'I like growing roses');
  if (!quiet.ok || quiet.data.kind !== 'reply') throw new Error('Expected scripted reply');
  expect(quiet.data.reply.text).not.toContain('?');
  const sparse = new MockCoordinator();
  sparse.handle('profile.save', {
    profile: { ...caregiverProfile, interests: [] },
    expectedRevision: 0,
  });
  start(sparse);
  control(sparse, 'teaching.start');
  expect(sparse.snapshot()?.teaching?.entityId).toBeNull();
  expect((await say(sparse, 'Hello')).ok).toBe(false);
  expect(
    sparse.handle('session.start', {
      profileId: 'preview-morgan',
      endpoint: 'browser',
      commandId: 'preview',
    }).ok,
  ).toBe(false);
});

test('server-only eligibility rejects foreign/stale policy and clears a removed prompt before resume', () => {
  const { c } = setup();
  control(c, 'teaching.start');
  expect(c.applyTeachingEligibility({ ...eligibility, policyRevision: 1 }).ok).toBe(false);
  expect(c.applyTeachingEligibility({ ...eligibility, sessionId: c.snapshot()!.id }).ok).toBe(
    false,
  );
  expect(
    c.applyTeachingEligibility({
      ...eligibility,
      sessionId: c.snapshot()!.id,
      policyRevision: 1,
      permittedEntityIds: ['topic:beaches'],
    }).ok,
  ).toBe(true);
  expect(c.snapshot()?.phase).toBe('paused');
  expect(c.snapshot()?.teaching?.entityId).toBeNull();
  control(c, 'resume');
  control(c, 'teaching.next');
  expect(c.snapshot()?.teaching?.entityId).toBe('topic:beaches');
  expect(c.snapshot()?.teaching?.policyRevision).toBe(1);
});

test('an initial policy can be loaded and profile edits clear stale prompts before resume', () => {
  const { c } = setup();
  expect(c.applyTeachingEligibility({ ...eligibility, sessionId: c.snapshot()!.id }).ok).toBe(true);
  control(c, 'resume');
  control(c, 'teaching.start');
  expect(c.snapshot()?.teaching?.entityId).toBe('topic:gardening');
  const mock = new MockCoordinator();
  start(mock);
  control(mock, 'teaching.start');
  expect(
    mock.handle('profile.save', {
      profile: { ...caregiverProfile, interests: ['topic:beaches'] },
      expectedRevision: 0,
    }).ok,
  ).toBe(true);
  expect(mock.snapshot()?.phase).toBe('paused');
  expect(mock.snapshot()?.teaching?.entityId).toBeNull();
  expect(mock.snapshot()?.teaching?.prompt).toBeNull();
});

test('a generated topic switch is discarded rather than reintroducing blocked catalog content', async () => {
  const { c } = setup({
    async complete() {
      return ok({ text: 'What do you enjoy cooking?', language: 'en' });
    },
  });
  control(c, 'teaching.start');
  const response = await say(c, 'Tell me more');
  expect(response.ok).toBe(false);
  expect(JSON.stringify(c)).not.toContain('What do you enjoy cooking?');
});

test('synchronous dispatch cannot cache participant text, and teaching/mode starts are mutually exclusive', async () => {
  const c = new MockCoordinator();
  start(c);
  control(c, 'teaching.start');
  const s = c.snapshot()!;
  expect(
    c.handle('conversation.submit', {
      sessionId: s.id,
      expectedGeneration: s.generation,
      commandId: 'never-cache-text',
      text: 'private-marker',
      language: 'en',
    }).ok,
  ).toBe(false);
  expect(JSON.stringify(c)).not.toContain('private-marker');
  expect(
    c.handle('activities.start', {
      sessionId: s.id,
      commandId: 'music',
      activityId: 'music_playlist',
      packId: 'music-demo',
      packVersion: 1,
    }).ok,
  ).toBe(false);
  control(c, 'teaching.finish');
  expect(
    c.handle('activities.start', {
      sessionId: s.id,
      commandId: 'music-after-finish',
      activityId: 'music_playlist',
      packId: 'music-demo',
      packVersion: 1,
    }).ok,
  ).toBe(true);
  expect(control(c, 'teaching.start').ok).toBe(false);
});
