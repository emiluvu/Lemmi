import { expect, test } from 'bun:test';
import { ok, type Result, type SessionSnapshot } from '@lemmi/contracts';
import { caregiverProfile } from '@lemmi/contracts/fixtures';
import {
  SessionCoordinator,
  type ConversationDecision,
  type ConversationDecisionAdapter,
} from '@lemmi/server';

const idle: ConversationDecision = {
  recap: false,
  declinesRedirect: false,
  redirectTopicIds: [],
  activity: 'none',
};
const request = 'Could I explain how flowers grow to you?';
function value<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(result.error.message);
  return result.data;
}
function fixture(decisions: ConversationDecisionAdapter, profileId = 'profile-alex') {
  let generated = 0;
  const profile = {
    ...caregiverProfile,
    id: profileId,
    approvedFacts: [],
    privacyRevision: 0,
    policyRevision: 0,
  };
  const c = new SessionCoordinator(
    'live',
    {
      async complete() {
        generated++;
        return ok({ text: 'We can take our time.', language: 'en' });
      },
    },
    {
      stt: {
        async transcribe() {
          return ok({ text: request, language: 'en' });
        },
      },
      tts: {
        async synthesize() {
          return ok({
            pcm: new Uint8Array(1280),
            sampleRate: 16000,
            channels: 1,
            encoding: 'pcm_s16le',
            language: 'en',
          });
        },
      },
    },
    Date.now,
    undefined,
    undefined,
    decisions,
  );
  c.acceptPersistentProfile(profile);
  const start = () =>
    value(
      c.handle('session.start', {
        profileId,
        endpoint: 'browser',
        commandId: crypto.randomUUID(),
      }),
    );
  const control = (action: Record<string, unknown>) =>
    value(
      c.handle('session.command', {
        sessionId: c.snapshot()!.id,
        expectedGeneration: c.snapshot()!.generation,
        commandId: crypto.randomUUID(),
        action,
      }),
    );
  const say = (text: string, commandId = crypto.randomUUID()) =>
    c.submitText({
      sessionId: c.snapshot()!.id,
      expectedGeneration: c.snapshot()!.generation,
      commandId,
      text,
      language: 'en',
    });
  start();
  return { c, profile, start, control, say, generated: () => generated };
}

test('late semantic activity decisions cannot survive endpoint or profile/privacy/policy invalidation', async () => {
  for (const interruption of [
    'stop',
    'mute',
    'handoff',
    'revoke',
    'privacy',
    'profile',
    'policy',
  ] as const) {
    let finish!: (result: Result<ConversationDecision>) => void;
    let entered!: () => void;
    let signal!: AbortSignal;
    let calls = 0;
    const began = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const f = fixture({
      scope: 'activities',
      classify(input, canceled) {
        calls++;
        if (input.text !== request) return Promise.resolve(ok(idle));
        signal = canceled;
        entered();
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
    });
    const commandId = crypto.randomUUID();
    const pending = f.say(request, commandId);
    const duplicate = f.say(request, commandId);
    await began;
    expect(calls).toBe(1);
    if (interruption === 'revoke') f.c.revokeDeviceAccess();
    else if (['privacy', 'profile', 'policy'].includes(interruption)) {
      const changed = {
        ...f.profile,
        revision: 1,
        privacyRevision: interruption === 'privacy' ? 1 : 0,
        policyRevision: interruption === 'policy' ? 1 : 0,
      };
      f.c.pauseForProfileUpdate({ revision: 1 });
      f.c.acceptPersistentProfile(changed);
    } else
      f.control(
        interruption === 'mute'
          ? { type: 'mute', muted: true }
          : interruption === 'handoff'
            ? { type: 'handoff', endpoint: 'robot' }
            : { type: 'stop' },
      );
    expect(signal.aborted).toBe(true);
    expect((await pending).ok).toBe(false);
    expect(await duplicate).toEqual(await pending);
    finish(ok({ ...idle, activity: 'teach_lemmi' }));
    await Bun.sleep(0);
    expect(f.generated()).toBe(0);
    expect(f.c.snapshot()?.teaching).toBeNull();
    expect(f.c.snapshot()?.captureGrant).toBeNull();
    expect(JSON.stringify(f.c.persistenceSnapshot())).not.toContain(request);
    if (f.c.snapshot()?.phase === 'ended') f.start();
    else if (f.c.snapshot()?.phase === 'paused') f.control({ type: 'resume' });
    value(await f.say('Yes please'));
    expect(f.c.snapshot()?.teaching).toBeNull();
    expect(f.generated()).toBe(1);
  }
});

test('a shared stateless activity adapter cannot transfer confirmation consent between profiles', async () => {
  const adapter: ConversationDecisionAdapter = {
    scope: 'activities',
    async classify(input) {
      return ok({ ...idle, activity: input.text === request ? 'teach_lemmi' : 'none' });
    },
  };
  const first = fixture(adapter, 'fictional-first');
  const second = fixture(adapter, 'fictional-second');
  const offered = value(await first.say(request));
  expect(offered.kind).toBe('reply');
  value(await second.say('Yes please'));
  expect(second.c.snapshot()?.teaching).toBeNull();
  expect(second.generated()).toBe(1);
  value(await first.say('Yes please'));
  expect(first.c.snapshot()?.teaching).not.toBeNull();
  expect(first.generated()).toBe(0);
  expect(first.c.snapshot()?.captureGrant).toBeNull();
  expect(second.c.snapshot()?.captureGrant).toBeNull();
});

test('failed playback receipt retires a spoken semantic offer before later agreement', async () => {
  const f = fixture({
    scope: 'activities',
    async classify(input) {
      return ok({ ...idle, activity: input.text === request ? 'teach_lemmi' : 'none' });
    },
  });
  f.control({ type: 'mute', muted: false });
  const before = f.c.snapshot()!;
  const listening = value(
    f.c.requestCapture(
      {
        sessionId: before.id,
        expectedGeneration: before.generation,
        commandId: crypto.randomUUID(),
        language: 'en',
      },
      [16000],
    ),
  ) as SessionSnapshot;
  const grant = listening.captureGrant!;
  const inputScope = {
    sessionId: listening.id,
    expectedGeneration: listening.generation,
    turnId: grant.turnId,
    leaseId: grant.leaseId,
    streamId: grant.streamId,
  };
  value(
    f.c.acceptCaptureChunk({
      ...inputScope,
      chunkIndex: 0,
      encoding: 'pcm_s16le',
      data: Buffer.alloc(640).toString('base64'),
    }),
  );
  value(await f.c.finishCapture({ ...inputScope, chunkCount: 1 }));
  const output = f.c.drainSpeechOutput()!;
  expect(output.chunks.length).toBeGreaterThan(0);
  const current = f.c.snapshot()!;
  value(
    f.c.playbackReceipt({
      sessionId: current.id,
      expectedGeneration: current.generation,
      turnId: output.metadata.turnId,
      leaseId: output.metadata.leaseId,
      streamId: output.metadata.streamId,
      status: 'failed',
      playedChunks: 0,
    }),
  );
  expect(f.c.speechOutputInfo()).toBeNull();
  value(await f.say('Yes please'));
  expect(f.c.snapshot()?.teaching).toBeNull();
  expect(f.c.snapshot()?.captureGrant).toBeNull();
  expect(f.generated()).toBe(1);
});
