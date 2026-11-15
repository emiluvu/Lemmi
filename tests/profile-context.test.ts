import { expect, test } from 'bun:test';
import { ProfileContextSchema, ok, type ProfileDetail } from '@lemmi/contracts';
import { caregiverProfile } from '@lemmi/contracts/fixtures';
import {
  fillDemoContext,
  profileContextFacts,
  selectProfileFacts,
  memoryContext,
} from '../packages/server/src/profile-context';
import { SessionCoordinator } from '../packages/server/src/session-coordinator';
import type { ChatInput } from '../packages/server/src/adapters/types';

function profile(enabled = false): ProfileDetail {
  return {
    ...caregiverProfile,
    privacyRevision: 0,
    policyRevision: 0,
    approvedFacts: [],
    context: ProfileContextSchema.parse({ career: 'Librarian', favourites: { flower: 'Daisy' } }),
    summaryMemoryEnabled: enabled,
    memories: enabled
      ? [
          {
            sessionId: 'previous-session',
            summary: 'Participant spoke about growing daisies.',
            source: 'ai_summary',
            updatedAt: new Date().toISOString(),
          },
        ]
      : [],
  };
}
function start(c: SessionCoordinator) {
  return c.handle('session.start', {
    profileId: 'profile-alex',
    endpoint: 'robot',
    commandId: crypto.randomUUID(),
  });
}
function text(c: SessionCoordinator, message: string) {
  const s = c.snapshot()!;
  return c.submitText({
    sessionId: s.id,
    expectedGeneration: s.generation,
    commandId: crypto.randomUUID(),
    text: message,
    language: 'en',
  });
}

test('fictional fill preserves supplied facts, pictures and choices and is idempotent', () => {
  const input = ProfileContextSchema.parse({
    career: 'Architect',
    favourites: { color: 'Green' },
    avoidTopics: ['old job'],
    photos: [{ assetId: crypto.randomUUID(), description: 'A garden', portrait: true }],
  });
  const result = fillDemoContext(input);
  expect(result.career).toBe('Architect');
  expect(result.favourites.color).toBe('Green');
  expect(result.photos).toEqual(input.photos);
  expect(result.avoidTopics).toEqual(input.avoidTopics);
  expect(fillDemoContext(result)).toEqual(result);
  expect(result.biography).toContain('Fictional');
  expect(
    ProfileContextSchema.safeParse({
      ...result,
      photos: [...result.photos, { ...result.photos[0], assetId: crypto.randomUUID() }],
    }).success,
  ).toBe(false);
});
test('bounded retrieval selects relevant caregiver details and older summaries without photo bytes', () => {
  const context = fillDemoContext(ProfileContextSchema.parse({}));
  expect(selectProfileFacts(profileContextFacts(context), 'Tell me about tea', 1)[0]).toContain(
    'Tea',
  );
  const memories = Array.from({ length: 10 }, (_, i) => ({
    sessionId: `session-${i}`,
    summary: i === 9 ? 'Participant discussed the garden.' : 'Participant discussed books.',
    source: 'ai_summary' as const,
    updatedAt: new Date().toISOString(),
  }));
  expect(memoryContext(memories, 'garden')).toContain('garden');
  expect(memoryContext(memories, 'garden')).toContain('unreviewed');
  const longMemories = memories.map((memory) => ({ ...memory, summary: '"'.repeat(300) }));
  const bounded = memoryContext(longMemories, '', 1000);
  expect(bounded.length).toBeLessThanOrEqual(1000);
  expect(JSON.parse(bounded.split('Data: ')[1]!).length).toBe(1);
  expect(memoryContext(longMemories, '', 10)).toBe('');
});
test('ordinary chat grounds in caregiver context; memory off makes no summary call or durable memory', async () => {
  const calls: ChatInput[] = [];
  const c = new SessionCoordinator('live', {
    async complete(input) {
      calls.push(input);
      return ok({ text: 'We can take our time.', language: 'en' });
    },
  });
  c.acceptPersistentProfile(profile());
  start(c);
  expect((await text(c, 'I enjoy flowers')).ok).toBe(true);
  expect(calls.length).toBe(1);
  expect(calls[0]!.system).toContain('Daisy');
  expect(c.persistenceSnapshot()?.memory).toBeUndefined();
});
test('opt-in summary reaches later sessions; privacy refusal removes use and requests durable revocation', async () => {
  const calls: ChatInput[] = [];
  const c = new SessionCoordinator('live', {
    async complete(input) {
      calls.push(input);
      return ok({
        text: input.system.startsWith('Write a short')
          ? 'Participant discussed flowers.'
          : 'Daisies can be lovely.',
        language: 'en',
      });
    },
  });
  c.acceptPersistentProfile(profile(true));
  start(c);
  await text(c, 'I like daisies');
  expect(calls[0]!.system).toContain('growing daisies');
  for (let i = 0; i < 20 && !c.persistenceSnapshot()?.memory; i++)
    await new Promise((resolve) => setTimeout(resolve, 1));
  expect(c.persistenceSnapshot()?.memory?.summary).toContain('flowers');
  const s = c.snapshot()!;
  c.handle('session.command', {
    sessionId: s.id,
    expectedGeneration: s.generation,
    commandId: crypto.randomUUID(),
    action: { type: 'stop' },
  });
  start(c);
  await text(c, 'How about flowers?');
  expect(calls[2]!.system).toContain('Participant discussed flowers.');
  await text(c, "Don't save this");
  expect(c.persistenceSnapshot()?.memory).toBeUndefined();
  expect(c.persistenceSnapshot()?.forgetMemory).toBe(true);
});
test('profile revocation during an optional summary discards its late result', async () => {
  let finish: ((value: any) => void) | undefined;
  const c = new SessionCoordinator('live', {
    async complete(input) {
      if (input.system.startsWith('Write a short'))
        return new Promise((resolve) => (finish = resolve));
      return ok({ text: 'We can take our time.', language: 'en' });
    },
  });
  c.acceptPersistentProfile(profile(true));
  start(c);
  const pending = text(c, 'I like flowers');
  for (let i = 0; i < 20 && !finish; i++) await new Promise((resolve) => setTimeout(resolve, 1));
  expect(finish).toBeDefined();
  c.pauseForProfileUpdate({ summaryMemoryEnabled: false });
  c.acceptPersistentProfile({ ...profile(false), revision: 1 });
  finish!(ok({ text: 'Late private summary.', language: 'en' }));
  // The ordinary reply was already delivered; revocation cancels only the optional job.
  expect((await pending).ok).toBe(true);
  await new Promise((resolve) => setTimeout(resolve, 1));
  expect(c.persistenceSnapshot()?.memory).toBeUndefined();
});

test('a held optional summary cannot hold up the ordinary reply, and its completion queues a checkpoint', async () => {
  let finish!: (value: any) => void;
  let changed = 0;
  const c = new SessionCoordinator(
    'live',
    {
      async complete(input) {
        if (input.system.startsWith('Write a short'))
          return new Promise((resolve) => (finish = resolve));
        return ok({ text: 'We can enjoy the flowers.', language: 'en' });
      },
    },
    undefined,
    Date.now,
    () => changed++,
  );
  c.acceptPersistentProfile(profile(true));
  start(c);
  let delivered = false;
  const pending = text(c, 'I enjoy looking at the garden').then((reply) => {
    delivered = reply.ok;
    return reply;
  });
  for (let i = 0; i < 20 && !delivered; i++) await new Promise((resolve) => setTimeout(resolve, 1));
  expect(finish).toBeDefined();
  expect(delivered).toBe(true);
  expect(c.snapshot()?.phase).toBe('waiting');
  expect(c.persistenceSnapshot()?.memory).toBeUndefined();
  finish(ok({ text: 'Participant discussed gardens.', language: 'en' }));
  for (let i = 0; i < 20 && !c.persistenceSnapshot()?.memory; i++)
    await new Promise((resolve) => setTimeout(resolve, 1));
  expect((await pending).ok).toBe(true);
  expect(c.persistenceSnapshot()?.memory?.summary).toBe('Participant discussed gardens.');
  expect(changed).toBe(1);
});

test('a new no-saving request revokes the current permission after a future-preset revision', async () => {
  const c = new SessionCoordinator('live', {
    async complete() {
      return ok({ text: 'We can take our time.', language: 'en' });
    },
  });
  c.acceptPersistentProfile(profile(true));
  start(c);
  c.acceptPersistentProfile(
    { ...profile(true), revision: 1, communicationSupport: { preset: 'quiet', configVersion: 1 } },
    false,
  );
  expect(c.snapshot()?.profileRevision).toBe(0);
  expect((await text(c, "Don't save this")).ok).toBe(true);
  expect(c.persistenceSnapshot()?.forgetMemory).toBe(true);
  expect(c.snapshot()?.profileRevision).toBe(1);
  expect(c.snapshot()?.communicationSupport.preset).toBe('guided');
  expect(c.snapshot()?.phase).toBe('paused');
});

test('Stop or a newer input discards a late optional summary without losing either successful reply', async () => {
  for (const interruption of ['stop', 'new_turn'] as const) {
    let finish!: (value: any) => void;
    let summaries = 0;
    const c = new SessionCoordinator('live', {
      async complete(input) {
        if (input.system.startsWith('Write a short')) {
          summaries++;
          if (summaries === 1) return new Promise((resolve) => (finish = resolve));
          return ok({ text: 'Participant discussed books.', language: 'en' });
        }
        return ok({ text: 'We can take our time.', language: 'en' });
      },
    });
    c.acceptPersistentProfile(profile(true));
    start(c);
    expect((await text(c, 'I enjoy the garden')).ok).toBe(true);
    if (interruption === 'stop') {
      const s = c.snapshot()!;
      c.handle('session.command', {
        sessionId: s.id,
        expectedGeneration: s.generation,
        commandId: crypto.randomUUID(),
        action: { type: 'stop' },
      });
    } else expect((await text(c, 'I like reading books')).ok).toBe(true);
    finish(ok({ text: 'Late discarded topic.', language: 'en' }));
    await new Promise((resolve) => setTimeout(resolve, 2));
    expect(c.persistenceSnapshot()?.memory?.summary).not.toBe('Late discarded topic.');
    if (interruption === 'stop') expect(c.persistenceSnapshot()?.memory).toBeUndefined();
  }
});
