import { expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { fail, ok, type Result } from '@lemmi/contracts';
import { caregiverProfile } from '@lemmi/contracts/fixtures';
import {
  SessionCoordinator,
  type CaregiverContact,
  type ConcernAdapter,
  type ConcernCategory,
} from '@lemmi/server';
import { companionInput } from '../packages/server/src/adapters/companion-prompt';

type ContactInput = Parameters<CaregiverContact['create']>[0];

test('the companion prompt accurately distinguishes enabled caregiver notifications from unavailable contact', () => {
  const common = {
    text: 'A fictional greeting',
    language: 'en' as const,
    preset: 'guided' as const,
    preferredName: 'Alex',
  };
  const enabled = companionInput({ ...common, caregiverNotifications: true });
  const disabled = companionInput({ ...common, caregiverNotifications: false });
  expect(enabled.ok).toBe(true);
  expect(disabled.ok).toBe(true);
  if (!enabled.ok || !disabled.ok) throw new Error('Expected bounded companion input');
  expect(enabled.data.system).toMatch(/notify configured caregivers|caregiver notifications/i);
  expect(enabled.data.system).toMatch(
    /cannot place calls|never arbitrary recipients or phone calls/i,
  );
  expect(enabled.data.system).not.toContain('Caregiver notifications are unavailable');
  expect(disabled.data.system).toContain('You cannot message, call');
  expect(disabled.data.system).not.toContain('application can notify configured caregivers');
  expect(enabled.data.system).not.toBe(disabled.data.system);
});
function setup(
  options: {
    reply?: string;
    replyLanguage?: 'en' | 'de';
    preset?: 'conversational' | 'guided' | 'quiet';
    classifyReply?: NonNullable<ConcernAdapter['classifyReply']>;
  } = {},
) {
  const requests: ContactInput[] = [];
  let inputClassifications = 0;
  let replyClassifications = 0;
  let generations = 0;
  const contact: CaregiverContact = {
    async create(input) {
      requests.push(input);
      expect(input.current?.()).toBe(true);
      return ok({
        id: randomUUID(),
        profileId: input.profileId,
        status: 'created',
        mode: 'real',
        reason: 'concern',
        message: 'Trying configured caregiver notification',
      });
    },
  };
  const concerns: ConcernAdapter = {
    async classify() {
      inputClassifications++;
      return ok('none');
    },
    async classifyReply(...args) {
      replyClassifications++;
      return options.classifyReply ? options.classifyReply(...args) : ok('human_support');
    },
  };
  const c = new SessionCoordinator(
    'live',
    {
      async complete() {
        generations++;
        return ok({
          text: options.reply ?? 'You could speak with a trusted person about that.',
          language: options.replyLanguage ?? 'en',
        });
      },
    },
    undefined,
    Date.now,
    undefined,
    undefined,
    undefined,
    contact,
    concerns,
  );
  c.acceptPersistentProfile({
    ...caregiverProfile,
    revision: 0,
    privacyRevision: 0,
    policyRevision: 0,
    approvedFacts: [],
    communicationSupport: {
      preset: options.preset ?? caregiverProfile.communicationSupport.preset,
      configVersion: 1,
    },
  });
  c.handle('session.start', {
    profileId: 'profile-alex',
    endpoint: 'browser',
    commandId: randomUUID(),
  });
  const say = (text: string) =>
    c.submitText({
      sessionId: c.snapshot()!.id,
      expectedGeneration: c.snapshot()!.generation,
      commandId: randomUUID(),
      text,
      language: 'en',
    });
  const stop = () =>
    c.handle('session.command', {
      sessionId: c.snapshot()!.id,
      expectedGeneration: c.snapshot()!.generation,
      commandId: randomUUID(),
      action: { type: 'stop' },
    });
  return {
    c,
    requests,
    say,
    stop,
    counts: () => ({ inputClassifications, replyClassifications, generations }),
  };
}

test('direct requests to call or speak with a named person notify the configured caregiver without inventing a phone call', async () => {
  for (const text of [
    'Please call my sister',
    'Could you contact Maya',
    'I would like to speak to my friend',
  ]) {
    const f = setup();
    try {
      const result = await f.say(text);
      expect(result.ok).toBe(true);
      expect(f.requests).toHaveLength(1);
      expect(f.requests[0]).toMatchObject({
        category: 'contact_request',
        source: 'participant_phrase',
      });
      expect(f.counts()).toEqual({
        inputClassifications: 0,
        replyClassifications: 0,
        generations: 0,
      });
      if (!result.ok || result.data.kind !== 'reply')
        throw new Error('Expected fixed notification status');
      expect(result.data.reply.source).toBe('fixed');
      expect(result.data.reply.text).toContain('caregiver');
      expect(result.data.reply.text).not.toMatch(
        /I (?:called|have called|am calling|will call) (?:your sister|Maya|your friend)/i,
      );
      expect(JSON.stringify(f.requests)).not.toContain(text);
      expect(f.c.snapshot()?.phase).toBe('paused');
      expect(f.c.snapshot()?.captureGrant).toBeNull();
    } finally {
      f.stop();
    }
  }
});

test('an explicit departure report creates a departure alert without waiting for ordinary generation', async () => {
  const f = setup();
  try {
    const result = await f.say("I'm going home");
    expect(result.ok).toBe(true);
    expect(f.requests).toHaveLength(1);
    expect(f.requests[0]).toMatchObject({ category: 'departure', source: 'participant_phrase' });
    expect(f.counts().generations).toBe(0);
    expect(f.c.snapshot()?.phase).toBe('paused');
  } finally {
    f.stop();
  }
});

test('validated model recommendations for human support are classified and enqueue a minimal model_reply alert', async () => {
  let classified: { text: string; reply: string; language: string } | undefined;
  const f = setup({
    classifyReply: async (text, reply, language) => {
      classified = { text, reply, language };
      return ok('human_support');
    },
  });
  try {
    const text = 'I have been thinking about the afternoon';
    const result = await f.say(text);
    expect(result.ok).toBe(true);
    expect(classified).toEqual({
      text,
      reply: 'You could speak with a trusted person about that.',
      language: 'en',
    });
    expect(f.requests).toHaveLength(1);
    expect(f.requests[0]).toMatchObject({ category: 'human_support', source: 'model_reply' });
    expect(JSON.stringify(f.requests)).not.toContain(text);
    expect(JSON.stringify(f.requests)).not.toContain('You could speak');
    expect(f.counts()).toEqual({
      inputClassifications: 1,
      replyClassifications: 1,
      generations: 1,
    });
    expect(f.c.snapshot()?.phase).toBe('paused');
  } finally {
    f.stop();
  }
});

test('ordinary family mentions skip reply classification and rejected generated replies cannot create alerts', async () => {
  const ordinary = setup({ reply: 'My sister likes gardening.' });
  try {
    expect((await ordinary.say('Tell me something about gardening')).ok).toBe(true);
    expect(ordinary.counts().replyClassifications).toBe(0);
    expect(ordinary.requests).toHaveLength(0);
  } finally {
    ordinary.stop();
  }
  for (const options of [
    { reply: "I've contacted your caregiver. You could speak with a trusted person." },
    { reply: 'You could speak with a trusted person.', replyLanguage: 'de' as const },
    { reply: 'You could speak with a trusted person. https://untrusted.invalid' },
  ]) {
    const rejected = setup(options);
    try {
      expect((await rejected.say('A fictional ordinary message')).ok).toBe(false);
      expect(rejected.counts().replyClassifications).toBe(0);
      expect(rejected.requests).toHaveLength(0);
    } finally {
      rejected.stop();
    }
  }
});

test('a late reply classification after Stop never creates a new caregiver alert', async () => {
  let finish!: (result: Result<ConcernCategory>) => void;
  let signal: AbortSignal | undefined;
  const f = setup({
    classifyReply: async (_text, _reply, _language, canceled) => {
      signal = canceled;
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
  });
  try {
    const pending = f.say('A fictional current conversation');
    const deadline = Date.now() + 1000;
    while (!finish && Date.now() < deadline) await Bun.sleep(1);
    expect(finish).toBeDefined();
    f.stop();
    expect(signal?.aborted).toBe(true);
    finish(ok('human_support'));
    expect((await pending).ok).toBe(false);
    expect(f.requests).toHaveLength(0);
    expect(f.c.snapshot()?.phase).toBe('ended');
    expect(f.c.snapshot()?.captureGrant).toBeNull();
  } finally {
    finish?.(ok('none'));
    f.stop();
  }
});

test('a failed reply classification leaves an honest retryable state without a stuck processing turn or alert', async () => {
  const f = setup({ classifyReply: async () => fail('UNAVAILABLE', 'Fixture classifier outage') });
  try {
    const result = await f.say('A fictional ordinary message');
    expect(result.ok).toBe(false);
    expect(f.requests).toHaveLength(0);
    expect(f.c.snapshot()?.phase).toBe('waiting');
    expect(f.c.snapshot()?.captureGrant).toBeNull();
    const retry = await f.say('A second fictional ordinary message');
    expect(retry.ok).toBe(false);
    if (!retry.ok) expect(retry.error.code).toBe('UNAVAILABLE');
    expect(f.counts().generations).toBe(2);
  } finally {
    f.stop();
  }
});

test('safeguarding in a model recommendation keeps its safe-contact category and never becomes generic human support', async () => {
  const f = setup({ classifyReply: async () => ok('safeguarding') });
  try {
    expect((await f.say('I want to discuss an earlier conversation')).ok).toBe(true);
    expect(f.requests).toHaveLength(1);
    expect(f.requests[0]).toMatchObject({ category: 'safeguarding', source: 'model_reply' });
    expect(f.requests.some((request) => request.category === 'human_support')).toBe(false);
  } finally {
    f.stop();
  }
});

test('fixed bereavement and personal-location support recommendations use the same reviewed notification path', async () => {
  for (const text of ['Is my husband dead', 'Where is my sister']) {
    const f = setup();
    try {
      expect((await f.say(text)).ok).toBe(true);
      expect(f.requests).toHaveLength(1);
      expect(f.requests[0]).toMatchObject({ category: 'human_support', source: 'model_reply' });
      expect(f.counts().replyClassifications).toBe(1);
      expect(f.counts().generations).toBe(0);
      expect(JSON.stringify(f.requests)).not.toContain(text);
    } finally {
      f.stop();
    }
  }
});

test('a maximum-length support recommendation still returns bounded fixed notification status', async () => {
  const reply = 'You could speak with a trusted person about that.'.padEnd(600, '.');
  const f = setup({ reply, preset: 'conversational' });
  const result = await f.say('A fictional personal question');
  expect(f.requests).toHaveLength(1);
  expect(result.ok && result.data.kind === 'reply').toBe(true);
  if (!result.ok || result.data.kind !== 'reply') throw new Error('Expected bounded contact reply');
  expect(result.data.reply.text.length).toBeLessThanOrEqual(600);
  expect(result.data.reply.text).toBe("I'm notifying your caregiver.");
  expect(f.c.snapshot()?.phase).toBe('paused');
});

test('topic and privacy refusals immediately pause and cancel a pending support classifier without a late alert', async () => {
  for (const refusal of ["I don't want to talk about that", "Please don't save that"]) {
    let finish!: (result: Result<ConcernCategory>) => void;
    let signal: AbortSignal | undefined;
    const f = setup({
      classifyReply: async (_text, _reply, _language, canceled) => {
        signal = canceled;
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
    });
    try {
      const pending = f.say('A fictional current conversation');
      const deadline = Date.now() + 1000;
      while (!finish && Date.now() < deadline) await Bun.sleep(1);
      expect(finish).toBeDefined();
      expect(signal?.aborted).toBe(false);
      const refusalResult = f.say(refusal);
      expect(signal?.aborted).toBe(true);
      expect(f.c.snapshot()?.phase).toBe('paused');
      expect(f.c.snapshot()?.captureGrant).toBeNull();
      const response = await refusalResult;
      expect(response.ok && response.data.kind === 'reply').toBe(true);
      if (!response.ok || response.data.kind !== 'reply')
        throw new Error('Expected immediate fixed refusal reply');
      expect(response.data.reply.source).toBe('fixed');
      expect(f.counts().generations).toBe(1);
      finish(ok('human_support'));
      expect((await pending).ok).toBe(false);
      await Bun.sleep(0);
      expect(f.requests).toHaveLength(0);
      expect(f.c.snapshot()?.phase).toBe('paused');
      expect(f.c.snapshot()?.captureGrant).toBeNull();
    } finally {
      finish?.(ok('none'));
      f.stop();
    }
  }
});
