import { expect, test } from 'bun:test';
import { ok, fail, type ProfileDetail, type Result, type SessionSnapshot } from '@lemmi/contracts';
import { caregiverProfile } from '@lemmi/contracts/fixtures';
import {
  SessionRegistry,
  createProfileLanguageResolver,
  type ChatInput,
  type SpeechAdapters,
} from '@lemmi/server';

test('German ordinary chat avoids the English activity classifier while English retains Jev routing', async () => {
  let decisions = 0;
  const registry = new SessionRegistry(
    {
      async complete(input) {
        return ok({
          text: input.language === 'de' ? 'Wir können uns Zeit lassen.' : 'We can take our time.',
          language: input.language,
        });
      },
    },
    undefined,
    Date.now,
    undefined,
    false,
    {
      scope: 'activities',
      async classify() {
        decisions++;
        return ok({
          recap: false,
          declinesRedirect: false,
          redirectTopicIds: [],
          activity: 'none',
        });
      },
    },
    createProfileLanguageResolver('profile-german-pilot'),
  );
  registry.acceptPersistentProfile({
    ...caregiverProfile,
    id: 'profile-german-pilot',
    privacyRevision: 0,
    policyRevision: 0,
    approvedFacts: [],
  });
  for (const [id, language] of [
    ['profile-german-pilot', 'de'],
    ['profile-alex', 'en'],
  ] as const) {
    const c = registry.forProfile(id);
    c.handle('session.start', {
      profileId: id,
      endpoint: 'browser',
      commandId: crypto.randomUUID(),
    });
    const s = c.snapshot()!;
    expect(
      (
        await c.submitText({
          sessionId: s.id,
          expectedGeneration: s.generation,
          commandId: crypto.randomUUID(),
          text: language === 'de' ? 'Ich sehe schöne Blumen.' : 'I see lovely flowers.',
          language,
        })
      ).ok,
    ).toBe(true);
    expect(decisions).toBe(language === 'de' ? 0 : 1);
  }
});

const germanId = 'profile-fictional-german-pilot';
function value<T>(result: Result<unknown>): T {
  if (!result.ok) throw new Error(result.error.message);
  return result.data as T;
}
function fixture(
  speech?: SpeechAdapters,
  complete?: (input: ChatInput) => Promise<Result<{ text: string; language: 'en' | 'de' }>>,
) {
  const calls: ChatInput[] = [];
  const registry = new SessionRegistry(
    {
      async complete(input) {
        calls.push(structuredClone(input));
        return complete
          ? complete(input)
          : ok({
              text:
                input.language === 'de' ? 'Wir können uns Zeit lassen.' : 'We can take our time.',
              language: input.language,
            });
      },
    },
    speech,
    Date.now,
    undefined,
    true,
    undefined,
    createProfileLanguageResolver(germanId),
  );
  registry.acceptPersistentProfile({
    ...caregiverProfile,
    id: germanId,
    preferredName: 'Tilda',
    interests: [],
    privacyRevision: 0,
    policyRevision: 0,
    approvedFacts: [],
  });
  const de = registry.forProfile(germanId),
    en = registry.forProfile('profile-alex');
  for (const [coordinator, profileId] of [
    [de, germanId],
    [en, 'profile-alex'],
  ] as const)
    value(
      coordinator.handle('session.start', {
        profileId,
        endpoint: 'browser',
        commandId: crypto.randomUUID(),
      }),
    );
  return { registry, de, en, calls };
}
function command(
  c: ReturnType<typeof fixture>['de'],
  language: 'en' | 'de',
  text = 'Guten Morgen',
) {
  const s = c.snapshot()!;
  return {
    sessionId: s.id,
    expectedGeneration: s.generation,
    commandId: crypto.randomUUID(),
    language,
    text,
  };
}

test('exact configured ID resolves German, names and new profiles preserve English defaults', async () => {
  const resolve = createProfileLanguageResolver(` ${germanId} `);
  expect(resolve(germanId)).toBe('de');
  expect(resolve('profile-alex')).toBe('en');
  expect(resolve('Tilda')).toBe('en');
  expect(() => createProfileLanguageResolver('preview-tilda')).toThrow();
  const f = fixture();
  expect(f.de.language()).toBe('de');
  expect(f.en.language()).toBe('en');
  const [de, en] = await Promise.all([
    f.de.submitText(command(f.de, 'de')),
    f.en.submitText(command(f.en, 'en', 'Good morning')),
  ]);
  expect(de.ok && de.data.kind === 'reply' && de.data.reply.language).toBe('de');
  expect(en.ok && en.data.kind === 'reply' && en.data.reply.language).toBe('en');
  expect(f.calls.find((c) => c.language === 'de')?.system).toContain('German');
  expect(f.calls.find((c) => c.language === 'en')?.system).toContain('English');
  expect(f.de.snapshot()?.profileId).not.toBe(f.en.snapshot()?.profileId);
});

test('mismatched text and capture cannot select profile language or open capture', async () => {
  const f = fixture();
  const result = await f.de.submitText(command(f.de, 'en'));
  expect(!result.ok && result.error.code).toBe('VALIDATION_ERROR');
  const { text: _, ...capture } = command(f.de, 'en');
  const requested = f.de.requestCapture(capture, [16000]);
  expect(!requested.ok && requested.error.code).toBe('VALIDATION_ERROR');
  expect(f.de.snapshot()?.captureGrant).toBeNull();
  expect(f.de.snapshot()?.phase).toBe('ready');
  expect(f.calls).toHaveLength(0);
});

test('German activity entry is unavailable through text and direct typed commands', async () => {
  const f = fixture();
  for (const phrase of ['Start Teach Lemmi', 'Start Photo Story', 'Explore pictures']) {
    const result = await f.de.submitText(command(f.de, 'de', phrase));
    expect(result.ok && result.data.kind === 'reply' && result.data.reply.text).toContain(
      'noch nicht verfügbar',
    );
    expect(f.de.snapshot()?.conversationMode).toBe('open');
    expect(f.de.snapshot()?.teaching).toBeNull();
  }
  const s = f.de.snapshot()!;
  const teaching = f.de.handle('session.command', {
    sessionId: s.id,
    expectedGeneration: s.generation,
    commandId: crypto.randomUUID(),
    action: { type: 'teaching.start' },
  });
  expect(!teaching.ok && teaching.error.code).toBe('UNAVAILABLE');
  const photo = f.de.startPhoto(crypto.randomUUID());
  expect(!photo.ok && photo.error.message).toContain('Deutsch');
  expect(f.de.publicPhotoEnabled()).toBe(false);
  expect(f.calls).toHaveLength(0);
});

test('German capture carries de through STT/model/TTS; missing voice leaves capture off', async () => {
  const stages: string[] = [];
  const f = fixture({
    stt: {
      async transcribe(input) {
        stages.push('stt:' + input.language);
        return ok({ text: 'Guten Morgen', language: 'de' });
      },
    },
    tts: {
      async synthesize(input) {
        stages.push('tts:' + input.language);
        return fail('UNAVAILABLE', 'German voice unavailable');
      },
    },
  });
  const session = f.de.snapshot()!;
  value(
    f.de.handle('session.command', {
      sessionId: session.id,
      expectedGeneration: session.generation,
      commandId: crypto.randomUUID(),
      action: { type: 'mute', muted: false },
    }),
  );
  const { text: _, ...capture } = command(f.de, 'de');
  const listening = value<SessionSnapshot>(f.de.requestCapture(capture, [16000]));
  const grant = listening.captureGrant!;
  expect(grant.language).toBe('de');
  const stream = {
    sessionId: listening.id,
    expectedGeneration: listening.generation,
    turnId: grant.turnId,
    leaseId: grant.leaseId,
    streamId: grant.streamId,
  };
  value(
    f.de.acceptCaptureChunk({
      ...stream,
      chunkIndex: 0,
      encoding: 'pcm_s16le',
      data: Buffer.alloc(640).toString('base64'),
    }),
  );
  const result = await f.de.finishCapture({ ...stream, chunkCount: 1 });
  expect(result.ok).toBe(false);
  expect(stages).toEqual(['stt:de', 'tts:de']);
  expect(f.calls[0]?.language).toBe('de');
  expect(f.de.snapshot()?.captureGrant).toBeNull();
  expect(['waiting', 'paused']).toContain(f.de.snapshot()!.phase);
  expect(f.de.drainSpeechOutput()).toBeNull();
});

test('profile language revision cancels pending output and rejects old-language retry', async () => {
  let finish!: (result: Result<{ text: string; language: 'en' | 'de' }>) => void;
  const f = fixture(
    undefined,
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const pending = f.de.submitText(command(f.de, 'de'));
  await Promise.resolve();
  f.de.acceptPersistentProfile({
    ...caregiverProfile,
    id: germanId,
    language: 'en',
    preferredName: 'Tilda',
    revision: 1,
    interests: [],
    privacyRevision: 0,
    policyRevision: 0,
    approvedFacts: [],
  } satisfies ProfileDetail);
  finish(ok({ text: 'Eine verspätete Antwort.', language: 'de' }));
  expect((await pending).ok).toBe(false);
  expect(f.de.snapshot()?.phase).toBe('paused');
  expect(f.de.snapshot()?.captureGrant).toBeNull();
  const retry = await f.de.submitText(command(f.de, 'de'));
  expect(!retry.ok && retry.error.code).toBe('VALIDATION_ERROR');
});

test('German recap uses the reviewed German fixed response without model generation', async () => {
  const f = fixture();
  await f.de.submitText(command(f.de, 'de', 'Ich möchte über Blumen sprechen'));
  const result = await f.de.submitText(command(f.de, 'de', 'Worüber haben wir gesprochen'));
  expect(result.ok && result.data.kind === 'reply' && result.data.reply.source).toBe('fixed');
  expect(result.ok && result.data.kind === 'reply' && result.data.reply.text).toContain(
    'Gerade haben Sie gesagt',
  );
  expect(f.calls).toHaveLength(1);
  expect(f.de.snapshot()?.captureGrant).toBeNull();
});

function promptCommand(c: ReturnType<typeof fixture>['de'], language: 'en' | 'de') {
  const { text: _text, ...input } = command(c, language);
  return input;
}

for (const preset of ['guided', 'quiet'] as const)
  test(`German ${preset} Start/Resume uses approved German text with missing or failed playback`, async () => {
    for (const mode of ['disabled', 'no-playback', 'failed', 'throws'] as const) {
      const synthesis: { text: string; language: string }[] = [];
      const f = fixture(
        mode === 'disabled'
          ? undefined
          : {
              stt: {
                async transcribe() {
                  throw new Error('No capture requested');
                },
              },
              tts: {
                async synthesize(input) {
                  synthesis.push(input);
                  if (mode === 'throws') throw new Error('Fixture voice unavailable');
                  return fail('UNAVAILABLE', 'Fixture German voice unavailable');
                },
              },
            },
      );
      f.registry.acceptPersistentProfile({
        ...caregiverProfile,
        id: germanId,
        preferredName: 'Tilda',
        communicationSupport: { preset, configVersion: 1 },
        privacyRevision: 0,
        policyRevision: 0,
        approvedFacts: [],
      });
      value(
        f.de.handle('session.command', {
          sessionId: f.de.snapshot()!.id,
          expectedGeneration: f.de.snapshot()!.generation,
          commandId: crypto.randomUUID(),
          action: { type: 'stop' },
        }),
      );
      value(
        f.de.handle('session.start', {
          profileId: germanId,
          endpoint: 'browser',
          commandId: crypto.randomUUID(),
        }),
      );
      for (const resume of [false, true]) {
        if (resume)
          for (const type of ['pause', 'resume'] as const)
            value(
              f.de.handle('session.command', {
                sessionId: f.de.snapshot()!.id,
                expectedGeneration: f.de.snapshot()!.generation,
                commandId: crypto.randomUUID(),
                action: { type },
              }),
            );
        const result = await f.de.speakSessionPrompt(
          promptCommand(f.de, 'de'),
          mode === 'no-playback' ? [] : [16000],
          resume,
        );
        expect(result.ok).toBe(true);
        if (!result.ok || result.data.kind !== 'reply') throw new Error('Missing German prompt');
        expect(result.data.reply.language).toBe('de');
        expect(result.data.reply.text).toContain(
          resume ? 'Wir sind wieder' : 'Hallo, ich bin Lemmi',
        );
        expect(result.data.reply.text.includes('?')).toBe(resume && preset !== 'quiet');
        expect(f.de.snapshot()?.phase).toBe('waiting');
        expect(f.de.snapshot()?.captureGrant).toBeNull();
        expect(JSON.stringify(f.de.persistenceSnapshot())).not.toContain(result.data.reply.text);
      }
      expect(synthesis.length).toBe(mode === 'disabled' || mode === 'no-playback' ? 0 : 2);
      expect(synthesis.every((input) => input.language === 'de')).toBe(true);
      expect(f.calls).toEqual([]);
    }
  });

test('approved Start/Resume rejects a client language mismatch and late German synthesis failure after Stop', async () => {
  let finish!: () => void;
  const entered = Promise.withResolvers<void>();
  const f = fixture({
    stt: {
      async transcribe() {
        throw new Error('No capture');
      },
    },
    tts: {
      synthesize() {
        return new Promise((resolve) => {
          finish = () => resolve(fail('UNAVAILABLE', 'Late failure'));
          entered.resolve();
        });
      },
    },
  });
  expect((await f.de.speakSessionPrompt(promptCommand(f.de, 'en'), [])).ok).toBe(false);
  expect(f.de.snapshot()?.phase).toBe('ready');
  const work = f.de.speakSessionPrompt(promptCommand(f.de, 'de'), [16000]);
  expect(f.de.snapshot()?.phase).toBe('processing');
  await entered.promise;
  value(
    f.de.handle('session.command', {
      sessionId: f.de.snapshot()!.id,
      expectedGeneration: f.de.snapshot()!.generation,
      commandId: crypto.randomUUID(),
      action: { type: 'stop' },
    }),
  );
  finish();
  expect((await work).ok).toBe(false);
  expect(f.de.snapshot()?.phase).toBe('ended');
  expect(f.de.snapshot()?.captureGrant).toBeNull();
});
