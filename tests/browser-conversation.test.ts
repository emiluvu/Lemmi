import { expect, test } from 'bun:test';
import { controlSessionFixture } from '@lemmi/contracts/fixtures';
import type { ServerEvent, SessionSnapshot } from '@lemmi/contracts';
import { BrowserConversation } from '../apps/web/src/lib/features/browser-conversation';

function fixture(initial: SessionSnapshot | null = null) {
  const sent: { type: string; payload: unknown; independent?: boolean }[] = [];
  const errors: string[] = [],
    enabled: boolean[] = [];
  let requests = 0,
    canceled = 0;
  const session: SessionSnapshot = {
    ...structuredClone(controlSessionFixture),
    phase: 'ready',
    activeEndpointId: 'browser',
    micMuted: false,
  };
  const connection = {
    session: initial,
    send(type: string, payload: unknown = {}, independent?: boolean) {
      sent.push({ type, payload, independent });
      return true;
    },
  };
  const audio = {
    prepare: async () => true,
    speak: async () => {
      requests++;
      connection.send('input.speak');
    },
    cancelInput: () => {
      canceled++;
    },
    hasOutput: false,
  };
  const c = new BrowserConversation(
    connection,
    audio,
    'browser',
    (value) => enabled.push(value),
    (value) => errors.push(value),
  );
  const state = (patch: Partial<SessionSnapshot> = {}) => {
    connection.session = { ...session, ...connection.session, ...patch };
    c.receive({ type: 'state.changed', payload: { session: connection.session } } as ServerEvent);
    return { ...connection.session };
  };
  return {
    c,
    connection,
    audio,
    session,
    sent,
    errors,
    enabled,
    state,
    requests: () => requests,
    canceled: () => canceled,
  };
}
test('one Start waits for greeting playback, then unmute acknowledgment and a fresh capture request', async () => {
  const f = fixture();
  await f.c.start();
  expect(f.sent).toEqual([{ type: 'input.start', payload: {}, independent: true }]);
  expect(f.requests()).toBe(0);
  f.state({ phase: 'processing', micMuted: true });
  f.state({ phase: 'ready', micMuted: true });
  expect(f.sent.some((x) => x.type === 'input.mute')).toBe(false);
  f.audio.hasOutput = true;
  const output = f.state({ phase: 'speaking' });
  f.c.receive({
    type: 'response.start',
    session_id: output.id,
    generation: output.generation,
  } as ServerEvent);
  f.audio.hasOutput = false;
  f.c.playbackCompleted(output);
  expect(f.requests()).toBe(0);
  f.state({ phase: 'waiting', micMuted: true });
  f.state({ phase: 'waiting', micMuted: true });
  expect(f.sent.filter((x) => x.type === 'input.mute')).toEqual([
    { type: 'input.mute', payload: { muted: false }, independent: undefined },
  ]);
  expect(f.requests()).toBe(0);
  f.state({ micMuted: false });
  f.state({ micMuted: false });
  expect(f.requests()).toBe(1);
  f.c.stop();
});

test('a new-session greeting completes before the first fresh capture, and Stop prevents its continuation', async () => {
  for (const stopped of [false, true]) {
    const f = fixture();
    await f.c.start();
    f.state({ phase: 'processing', micMuted: true });
    f.audio.hasOutput = true;
    const output = f.state({ phase: 'speaking', micMuted: true });
    f.c.receive({
      type: 'response.start',
      session_id: output.id,
      generation: output.generation,
    } as ServerEvent);
    expect(f.requests()).toBe(0);
    if (stopped) f.c.stop();
    f.audio.hasOutput = false;
    f.c.playbackCompleted(output);
    f.state({ phase: 'waiting', micMuted: true });
    expect(f.requests()).toBe(0);
    f.state({ phase: 'waiting', micMuted: false });
    expect(f.requests()).toBe(stopped ? 0 : 1);
    f.c.stop();
  }
});
test('intermediate waiting never overlaps response playback and consumption opens only one later turn', async () => {
  const f = fixture();
  f.connection.session = f.session;
  await f.c.start();
  expect(f.requests()).toBe(1);
  const input = f.state({ phase: 'listening' });
  f.c.submitted(input);
  f.state({ phase: 'processing' });
  f.state({ phase: 'waiting' });
  f.state({ phase: 'waiting' });
  expect(f.requests()).toBe(1);
  f.audio.hasOutput = true;
  const output = f.state({ phase: 'speaking' });
  f.audio.hasOutput = false;
  f.c.playbackCompleted(output);
  expect(f.requests()).toBe(1);
  f.state({ phase: 'waiting' });
  f.state({ phase: 'waiting' });
  f.c.playbackCompleted(output);
  expect(f.requests()).toBe(2);
  f.c.stop();
});
test('reviewed spoken mode generation changes preserve a completed reply but not stale completion', async () => {
  const f = fixture();
  f.connection.session = f.session;
  await f.c.start();
  f.c.submitted(f.state({ phase: 'listening' }));
  const output = f.state({ phase: 'speaking', generation: f.session.generation + 2 });
  f.c.playbackCompleted(output);
  f.state({ phase: 'waiting' });
  expect(f.requests()).toBe(2);
  f.c.stop();
});
test('Quiet allows the explicitly started turn, then returns to capture-off waiting', async () => {
  const f = fixture();
  f.connection.session = {
    ...f.session,
    communicationSupport: { ...f.session.communicationSupport, preset: 'quiet' },
  };
  await f.c.start();
  expect(f.requests()).toBe(1);
  f.c.submitted(f.state({ phase: 'listening' }));
  const output = f.state({ phase: 'speaking' });
  f.c.playbackCompleted(output);
  f.state({ phase: 'waiting' });
  expect(f.requests()).toBe(1);
  expect(f.enabled.at(-1)).toBe(false);
});
test('Pause/mute/Stop, owner/handoff, session and privacy/policy changes prevent late continuation', async () => {
  const changes: Partial<SessionSnapshot>[] = [
    { phase: 'paused' },
    { phase: 'ended' },
    { phase: 'unavailable' },
    { micMuted: true },
    { activeEndpointId: 'robot' },
    { id: 'replacement-session' },
    { leaseId: 'replacement-lease' },
    { profileRevision: 7 },
    { privacyRevision: 7 },
    { policyRevision: 7 },
  ];
  for (const patch of changes) {
    const f = fixture();
    f.connection.session = f.session;
    await f.c.start();
    const token = f.state({ phase: 'listening' });
    f.c.submitted(token);
    f.state(patch);
    f.c.playbackCompleted(token);
    f.state({ phase: 'waiting', micMuted: false });
    expect(f.requests()).toBe(1);
    expect(f.enabled.at(-1)).toBe(false);
  }
});
test('a canceled sound/permission promise cannot send Start or reopen capture', async () => {
  const f = fixture();
  let finish!: (value: boolean) => void;
  f.audio.prepare = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  const start = f.c.start();
  f.c.stop();
  finish(true);
  await start;
  expect(f.sent).toEqual([]);
  expect(f.requests()).toBe(0);
  expect(f.enabled.at(-1)).toBe(false);
});
test('observers cannot acquire an endpoint and cancellation during permission preparation invalidates its capture', async () => {
  const f = fixture();
  f.connection.session = { ...f.session, activeEndpointId: 'robot' };
  await f.c.start();
  expect(f.sent).toEqual([]);
  expect(f.errors).toHaveLength(1);
  f.connection.session = f.session;
  await f.c.start();
  f.state({ generation: f.session.generation + 1 });
  expect(f.enabled.at(-1)).toBe(false);
});
test('an explicit resume waits for reorientation playback; unmute alone does not opt into conversation', async () => {
  const f = fixture();
  f.connection.session = { ...f.session, phase: 'paused', micMuted: true };
  await f.c.start();
  expect(f.sent[0]?.type).toBe('input.resume');
  expect(f.requests()).toBe(0);
  f.state({ phase: 'processing' });
  expect(f.requests()).toBe(0);
  f.audio.hasOutput = true;
  const output = f.state({ phase: 'speaking' });
  f.c.receive({
    type: 'response.start',
    session_id: output.id,
    generation: output.generation,
  } as ServerEvent);
  f.audio.hasOutput = false;
  f.c.playbackCompleted(output);
  f.state({ phase: 'waiting' });
  f.state({ micMuted: false });
  expect(f.requests()).toBe(1);
  f.c.stop();
  f.state({ phase: 'waiting', micMuted: false });
  expect(f.requests()).toBe(1);
});

test('late failure of an old capture request cannot disable a newly started conversation', async () => {
  const f = fixture();
  f.connection.session = f.session;
  let reject!: (reason: Error) => void;
  f.audio.speak = () =>
    new Promise((_, fail) => {
      reject = fail;
    });
  await f.c.start();
  f.c.stop();
  f.audio.speak = async () => {};
  await f.c.start();
  reject(new Error('Retired microphone request'));
  await Bun.sleep(0);
  expect(f.enabled.at(-1)).toBe(true);
  expect(f.errors).toEqual([]);
  f.c.stop();
});

for (const resume of [false, true]) {
  test(`${resume ? 'Resume' : 'Start'} text fallback ends the listening attempt without requesting microphone access`, async () => {
    const f = fixture();
    if (resume) f.connection.session = { ...f.session, phase: 'paused' };
    await f.c.start();
    f.state({ phase: 'processing' });
    f.state({ phase: 'waiting' });
    expect(f.requests()).toBe(0);
    const current = f.connection.session!;
    f.c.receive({
      type: 'response.text',
      session_id: current.id,
      generation: current.generation,
      payload: { source: 'fixed', text: 'An approved prompt.' },
    } as ServerEvent);
    f.state({ phase: 'waiting' });
    expect(f.requests()).toBe(0);
    expect(f.enabled.at(-1)).toBe(false);
  });
  test(`${resume ? 'Resume' : 'Start'} Quiet greeting and interrupted opening never open capture`, async () => {
    for (const interrupt of [false, true]) {
      const f = fixture();
      if (resume) f.connection.session = { ...f.session, phase: 'paused' };
      await f.c.start();
      f.state({ phase: 'processing', communicationSupport: { preset: 'quiet', configVersion: 1 } });
      const output = f.state({ phase: 'speaking' });
      f.c.receive({
        type: 'response.start',
        session_id: output.id,
        generation: output.generation,
      } as ServerEvent);
      if (interrupt) f.c.stop();
      f.c.playbackCompleted(output);
      f.state({ phase: 'waiting' });
      expect(f.requests()).toBe(0);
      expect(f.enabled.at(-1)).toBe(false);
    }
  });
}
