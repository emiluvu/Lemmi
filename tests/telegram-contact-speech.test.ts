import { expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { fail, ok } from '@lemmi/contracts';
import { SessionCoordinator, type CaregiverContact } from '@lemmi/server';

function setup(text: string, contact: CaregiverContact) {
  let chats = 0;
  const spoken: string[] = [];
  const c = new SessionCoordinator(
    'live',
    {
      async complete() {
        chats++;
        return ok({ text: 'Unused model response', language: 'en' });
      },
    },
    {
      stt: {
        async transcribe() {
          return ok({ text, language: 'en' });
        },
      },
      tts: {
        async synthesize(input) {
          spoken.push(input.text);
          return ok({
            pcm: new Uint8Array(1280).fill(1),
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
    undefined,
    contact,
  );
  c.handle('session.start', {
    profileId: 'profile-alex',
    endpoint: 'robot',
    commandId: randomUUID(),
  });
  function control(action: unknown) {
    const s = c.snapshot()!;
    return c.handle('session.command', {
      sessionId: s.id,
      expectedGeneration: s.generation,
      commandId: randomUUID(),
      action,
    });
  }
  control({ type: 'mute', muted: false });
  const s = c.snapshot()!;
  expect(
    c.requestCapture(
      {
        sessionId: s.id,
        expectedGeneration: s.generation,
        commandId: randomUUID(),
        language: 'en',
      },
      [16000],
    ).ok,
  ).toBe(true);
  const capture = c.snapshot()!;
  const scope = {
    sessionId: capture.id,
    expectedGeneration: capture.generation,
    turnId: capture.captureGrant!.turnId,
    streamId: capture.captureGrant!.streamId,
    leaseId: capture.leaseId,
  };
  expect(
    c.acceptCaptureChunk({
      ...scope,
      chunkIndex: 0,
      encoding: 'pcm_s16le',
      data: Buffer.alloc(640, 1).toString('base64'),
    }).ok,
  ).toBe(true);
  return {
    c,
    capture,
    scope,
    spoken,
    chats: () => chats,
    control,
    finish: () => c.finishCapture({ ...scope, chunkCount: 1 }),
  };
}

test('STT-recognized help creates one request and speaks fixed contact status using fresh paused authority', async () => {
  const requests: Parameters<CaregiverContact['create']>[0][] = [];
  const f = setup('I need assistance', {
    async create(input) {
      requests.push(input);
      expect(input.current?.()).toBe(true);
      return ok({
        id: randomUUID(),
        profileId: input.profileId,
        status: 'created',
        mode: 'real',
        reason: 'manual',
        message: 'Creating contact request',
      });
    },
  });
  try {
    const result = await f.finish();
    expect(result.ok).toBe(true);
    if (!result.ok || result.data.kind !== 'reply') throw new Error('Expected fixed help reply');
    expect(result.data.reply.source).toBe('fixed');
    expect(result.data.reply.turnId).not.toBe(f.scope.turnId);
    expect(f.c.snapshot()?.generation).toBeGreaterThan(f.capture.generation);
    expect(f.c.snapshot()?.phase).toBe('paused');
    expect(f.c.snapshot()?.captureGrant).toBeNull();
    expect(requests).toHaveLength(1);
    expect(requests[0]?.category).toBe('help_request');
    expect(JSON.stringify(requests)).not.toContain('I need assistance');
    expect(f.chats()).toBe(0);
    expect(f.spoken).toHaveLength(1);
    expect(f.spoken[0]).toBe("I'm notifying your trusted contact.");
    const output = f.c.speechOutputInfo()!;
    expect(output.turnId).toBe(result.data.reply.turnId);
    const batch = f.c.drainSpeechOutput()!;
    expect(batch.end).toBe(true);
    const playback = {
      sessionId: f.c.snapshot()!.id,
      expectedGeneration: f.c.snapshot()!.generation,
      turnId: output.turnId,
      streamId: output.streamId,
      leaseId: output.leaseId,
    };
    expect(f.c.playbackReceipt({ ...playback, status: 'started', playedChunks: 0 }).ok).toBe(true);
    expect(
      f.c.playbackReceipt({ ...playback, status: 'completed', playedChunks: batch.chunks.length })
        .ok,
    ).toBe(true);
    expect(f.c.snapshot()?.phase).toBe('paused');
    expect(f.c.snapshot()?.captureGrant).toBeNull();
  } finally {
    f.control({ type: 'stop' });
  }
});

test('urgent STT guidance and TTS do not wait for a delayed contact save; Stop fences its still-pending trigger', async () => {
  let request: Parameters<CaregiverContact['create']>[0] | undefined;
  let finishSave!: (value: Awaited<ReturnType<CaregiverContact['create']>>) => void;
  const f = setup("I can't breathe", {
    create(input) {
      request = input;
      return new Promise((resolve) => {
        finishSave = resolve;
      });
    },
  });
  try {
    const result = await Promise.race([
      f.finish(),
      Bun.sleep(500).then(() => {
        throw new Error('Urgent guidance waited for contact persistence');
      }),
    ]);
    expect(result.ok).toBe(true);
    expect(request?.category).toBe('urgent');
    expect(request?.current?.()).toBe(true);
    expect(f.spoken).toHaveLength(1);
    expect(f.spoken[0]).toContain('cannot call emergency services');
    expect(f.c.snapshot()?.phase).toBe('paused');
    expect(f.c.snapshot()?.captureGrant).toBeNull();
    expect(f.c.speechOutputInfo()).not.toBeNull();
    expect(f.chats()).toBe(0);
    f.control({ type: 'stop' });
    expect(request?.current?.()).toBe(false);
    finishSave(fail('REVISION_CONFLICT', 'Stopped before contact creation'));
    await Bun.sleep(0);
    expect(f.c.snapshot()?.phase).toBe('ended');
    expect(f.c.speechOutputInfo()).toBeNull();
    expect(f.c.snapshot()?.captureGrant).toBeNull();
    expect(f.spoken).toHaveLength(1);
  } finally {
    finishSave?.(fail('REVISION_CONFLICT', 'Fixture cleanup'));
    f.control({ type: 'stop' });
  }
});
