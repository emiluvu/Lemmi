import { expect, test } from 'bun:test';
import { SessionCoordinator } from '../packages/server/src/session-coordinator';
import { SessionSnapshotSchema, ConversationTextResultSchema, ok } from '@lemmi/contracts';
import type { ChatAdapter, ChatInput } from '../packages/server/src/adapters/types';

function start(coordinator: SessionCoordinator) {
  const result = coordinator.handle('session.start', {
    profileId: 'profile-alex',
    endpoint: 'robot',
    commandId: crypto.randomUUID(),
  });
  if (!result.ok) throw new Error('Fixture start failed');
  return SessionSnapshotSchema.parse(result.data);
}
function text(coordinator: SessionCoordinator, message: string, commandId = crypto.randomUUID()) {
  const session = coordinator.snapshot()!;
  return coordinator.submitText({
    sessionId: session.id,
    expectedGeneration: session.generation,
    commandId,
    text: message,
    language: 'en',
  });
}
function control(coordinator: SessionCoordinator, action: unknown) {
  const session = coordinator.snapshot()!;
  return coordinator.handle('session.command', {
    sessionId: session.id,
    expectedGeneration: session.generation,
    commandId: crypto.randomUUID(),
    action,
  });
}

test('text chat uses the existing authority, stays capture-off and keeps only transient history', async () => {
  const received: ChatInput[] = [];
  const coordinator = new SessionCoordinator('live', {
    async complete(input) {
      received.push(input);
      return ok({ text: 'We can take our time.', language: input.language });
    },
  });
  start(coordinator);
  const first = await text(coordinator, 'fictional-private-text-marker');
  expect(first.ok).toBe(true);
  if (first.ok) expect(ConversationTextResultSchema.safeParse(first.data).success).toBe(true);
  expect(coordinator.snapshot()?.phase).toBe('waiting');
  expect(coordinator.snapshot()?.captureGrant).toBeNull();
  await text(coordinator, 'A second greeting');
  expect(received[1]?.history).toHaveLength(2);
  expect(received[1]?.system).not.toContain('sensitiveTopicGuidance');
  control(coordinator, { type: 'stop' });
  expect(JSON.stringify(coordinator)).not.toContain('fictional-private-text-marker');
  expect(JSON.stringify(coordinator)).not.toContain('We can take our time.');
});

test('duplicate pending/completed text IDs call the model once, and changed bodies conflict', async () => {
  let finish!: (result: any) => void;
  let calls = 0;
  const coordinator = new SessionCoordinator('live', {
    complete() {
      calls++;
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
  });
  start(coordinator);
  const id = crypto.randomUUID();
  const first = text(coordinator, 'Hello', id);
  const duplicate = text(coordinator, 'Hello', id);
  await Promise.resolve();
  expect(calls).toBe(1);
  expect((await text(coordinator, 'Different input', id)).ok).toBe(false);
  finish(ok({ text: 'Hello.', language: 'en' }));
  expect(await first).toEqual(await duplicate);
  expect((await text(coordinator, 'Hello', id)).ok).toBe(true);
  expect(calls).toBe(1);
});

test('Stop/pause/mute/disconnect/revoke cancel pending generation and discard every late result', async () => {
  for (const interrupt of [
    (c: SessionCoordinator) => control(c, { type: 'stop' }),
    (c: SessionCoordinator) => control(c, { type: 'pause' }),
    (c: SessionCoordinator) => control(c, { type: 'mute', muted: true }),
    (c: SessionCoordinator) => c.disconnect(),
    (c: SessionCoordinator) => c.revokeDeviceAccess(),
    (c: SessionCoordinator) => control(c, { type: 'handoff', endpoint: 'browser' }),
  ]) {
    let finish!: (result: any) => void;
    let signal!: AbortSignal;
    const coordinator = new SessionCoordinator('live', {
      complete(_input, canceled) {
        signal = canceled;
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
    });
    start(coordinator);
    const work = text(coordinator, 'A pending fictional turn');
    await Promise.resolve();
    expect(coordinator.snapshot()?.phase).toBe('processing');
    interrupt(coordinator);
    expect(signal.aborted).toBe(true);
    expect((await work).ok).toBe(false);
    finish(ok({ text: 'late-private-response-marker', language: 'en' }));
    await Promise.resolve();
    expect(JSON.stringify(coordinator)).not.toContain('late-private-response-marker');
    expect(coordinator.snapshot()?.captureGrant).toBeNull();
    expect(coordinator.snapshot()?.phase).not.toBe('processing');
  }
});

test('fixed help/refusal/concern routes bypass a broken or missing model and never claim delivery', async () => {
  let calls = 0;
  const adapter: ChatAdapter = {
    async complete() {
      calls++;
      throw new Error('Fixture model unavailable');
    },
  };
  for (const message of ['Help', 'I do not feel well', 'I cannot breathe', 'I need…', 'Stop']) {
    const coordinator = new SessionCoordinator('live', adapter);
    start(coordinator);
    const result = await text(coordinator, message);
    if (message === 'Help') {
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toContain('no request was created or sent');
      expect(coordinator.snapshot()?.phase).toBe('paused');
    } else expect(result.ok).toBe(true);
  }
  expect(calls).toBe(0);
  const noModel = new SessionCoordinator('live');
  start(noModel);
  expect((await text(noModel, 'Hello')).ok).toBe(false);
});

test('an explicit urgent phrase interrupts a pending ordinary model turn', async () => {
  const coordinator = new SessionCoordinator('live', {
    complete() {
      return new Promise(() => {});
    },
  });
  start(coordinator);
  const ordinary = text(coordinator, 'Hello');
  const urgent = await text(coordinator, 'I cannot breathe');
  expect(urgent.ok).toBe(true);
  expect((await ordinary).ok).toBe(false);
  expect(coordinator.snapshot()?.phase).toBe('paused');
});

test('topic refusal pauses without generation and clears the old topic before explicit continuation', async () => {
  const seen: ChatInput[] = [];
  const coordinator = new SessionCoordinator('live', {
    async complete(input) {
      seen.push(input);
      return ok({ text: 'Hello.', language: input.language });
    },
  });
  start(coordinator);
  await text(coordinator, 'old-topic-private-marker');
  const refusal = await text(coordinator, "Don't ask about that");
  expect(refusal.ok).toBe(true);
  expect(seen).toHaveLength(1);
  expect(coordinator.snapshot()?.phase).toBe('paused');
  expect(JSON.stringify(coordinator)).not.toContain('old-topic-private-marker');
  control(coordinator, { type: 'resume' });
  await text(coordinator, 'A fresh topic');
  expect(seen[1]?.history).toEqual([]);
});

test('completed replies lose output authorization immediately on mute without changing generation', async () => {
  const coordinator = new SessionCoordinator('live', {
    async complete() {
      return ok({ text: 'Hello.', language: 'en' });
    },
  });
  const session = start(coordinator);
  const id = crypto.randomUUID();
  expect((await text(coordinator, 'Hello', id)).ok).toBe(true);
  expect(coordinator.isCurrentTextReply(id)).toBe(true);
  control(coordinator, { type: 'mute', muted: true });
  expect(coordinator.snapshot()?.generation).toBe(session.generation);
  expect(coordinator.isCurrentTextReply(id)).toBe(false);
  expect((await text(coordinator, 'Hello', id)).ok).toBe(false);
});

test('manual safety controls still act at generic command capacity', async () => {
  const coordinator = new SessionCoordinator('live');
  const session = start(coordinator);
  for (let i = 0; i < 260; i++) control(coordinator, { type: 'mute', muted: false });
  expect(control(coordinator, { type: 'mute', muted: true }).ok).toBe(true);
  expect(coordinator.snapshot()?.micMuted).toBe(true);
  expect(control(coordinator, { type: 'pause' }).ok).toBe(true);
  const help = coordinator.handle('help.create', {
    profileId: session.profileId,
    commandId: crypto.randomUUID(),
    mode: 'real',
  });
  expect(help.ok).toBe(false);
  if (!help.ok) expect(help.error.message).toContain('no request was created or sent');
  expect(control(coordinator, { type: 'stop' }).ok).toBe(true);
  expect(coordinator.snapshot()?.phase).toBe('ended');
});

test('foreign/stale/paused requests cannot generate; response question limits are enforced', async () => {
  let calls = 0;
  const coordinator = new SessionCoordinator('live', {
    async complete() {
      calls++;
      return ok({ text: 'One? Two?', language: 'en' });
    },
  });
  const session = start(coordinator);
  expect(
    (
      await coordinator.submitText({
        commandId: 'foreign',
        sessionId: 'someone-else',
        expectedGeneration: 0,
        text: 'Hello',
        language: 'en',
      })
    ).ok,
  ).toBe(false);
  expect(
    (
      await coordinator.submitText({
        commandId: 'stale',
        sessionId: session.id,
        expectedGeneration: 100,
        text: 'Hello',
        language: 'en',
      })
    ).ok,
  ).toBe(false);
  expect(calls).toBe(0);
  expect((await text(coordinator, 'Hello')).ok).toBe(false);
  expect(calls).toBe(1);
  control(coordinator, { type: 'pause' });
  expect((await text(coordinator, 'Hello')).ok).toBe(false);
  expect(calls).toBe(1);
});
