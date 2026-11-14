import { beforeAll, afterAll, expect, test } from 'bun:test';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ok,
  SessionSnapshotSchema,
  resolveCommunicationSupport,
  communicationSupportPreviews,
  createClients,
  createHttpTransport,
  type CommunicationPreset,
  type ProfileDetail,
} from '@lemmi/contracts';
import { caregiverProfile } from '@lemmi/contracts/fixtures';
import {
  SessionCoordinator,
  PersistentData,
  DataRepository,
  PrivateMedia,
  database,
  migrate,
  handleDataHttp,
} from '@lemmi/server';

const profile = (preset: CommunicationPreset = 'guided', revision = 0): ProfileDetail => ({
  ...caregiverProfile,
  revision,
  communicationSupport: { preset, configVersion: 1 },
  privacyRevision: 0,
  policyRevision: 0,
  approvedFacts: [],
});
function start(c: SessionCoordinator) {
  const r = c.handle('session.start', {
    profileId: 'profile-alex',
    endpoint: 'robot',
    commandId: crypto.randomUUID(),
  });
  if (!r.ok) throw new Error('Fixture start failed');
  return SessionSnapshotSchema.parse(r.data);
}
function control(c: SessionCoordinator, type: 'resume' | 'stop') {
  const s = c.snapshot()!;
  return c.handle('session.command', {
    sessionId: s.id,
    expectedGeneration: s.generation,
    commandId: crypto.randomUUID(),
    action: { type },
  });
}
const applyInput = (c: SessionCoordinator, revision = 1) => ({
  profileId: 'profile-alex',
  expectedProfileRevision: revision,
  sessionId: c.snapshot()!.id,
  expectedGeneration: c.snapshot()!.generation,
  commandId: crypto.randomUUID(),
});

test('one validated policy supplies distinct presets and inert same-topic previews for every avatar', () => {
  const policies = communicationSupportPreviews.map(({ preset, configVersion }) =>
    resolveCommunicationSupport({ preset, configVersion }),
  );
  expect(new Set(policies.map((p) => p.instruction)).size).toBe(3);
  expect(policies.map((p) => p.maxReplyCharacters)).toEqual([600, 360, 240]);
  expect(policies.map((p) => p.maxQuestions)).toEqual([1, 1, 0]);
  expect(
    communicationSupportPreviews.every(
      (s) => s.sample && s.topic === 'Fictional gardening example',
    ),
  ).toBe(true);
  expect(() =>
    resolveCommunicationSupport({ preset: 'severe', configVersion: 1 } as any),
  ).toThrow();
  expect(() => resolveCommunicationSupport({ preset: 'quiet', configVersion: 2 } as any)).toThrow();
  for (const avatarId of ['dog', 'cat', 'bunny', 'bird', 'lemming'] as const) {
    const c = new SessionCoordinator('live');
    c.acceptPersistentProfile({ ...profile('quiet'), avatarId });
    expect(start(c).communicationSupport.preset).toBe('quiet');
    expect(c.snapshot()?.captureGrant).toBeNull();
  }
});

test('saving a future preset preserves pending old-style work, while the next session adopts the new policy', async () => {
  let resolve!: (r: any) => void;
  const c = new SessionCoordinator('live', {
    complete() {
      return new Promise((r) => {
        resolve = r;
      });
    },
  });
  const before = start(c);
  const pending = c.submitText({
    sessionId: before.id,
    expectedGeneration: before.generation,
    commandId: 'pending',
    text: 'A garden greeting',
    language: 'en',
  });
  await Promise.resolve();
  await Promise.resolve();
  c.pauseForProfileUpdate({ communicationSupport: { preset: 'quiet', configVersion: 1 } });
  c.acceptPersistentProfile(profile('quiet', 1));
  expect(c.snapshot()).toMatchObject({
    phase: 'processing',
    generation: before.generation,
    communicationSupport: { preset: 'guided' },
  });
  resolve(ok({ text: 'Would you like flowers?', language: 'en' }));
  expect((await pending).ok).toBe(true);
  control(c, 'stop');
  expect(start(c).communicationSupport.preset).toBe('quiet');
});

test('apply-now validates revisions before canceling, clears old response authority, and requires explicit Resume', async () => {
  let finish!: (r: any) => void, signal!: AbortSignal;
  const c = new SessionCoordinator('live', {
    complete(_input, s) {
      signal = s;
      return new Promise((r) => {
        finish = r;
      });
    },
  });
  const original = start(c);
  const pending = c.submitText({
    sessionId: original.id,
    expectedGeneration: original.generation,
    commandId: 'old',
    text: 'private-old-turn-marker',
    language: 'en',
  });
  await Promise.resolve();
  await Promise.resolve();
  c.acceptPersistentProfile(profile('quiet', 1));
  expect(
    c.applyCommunicationSupport(
      { ...applyInput(c), expectedGeneration: 99 },
      profile('quiet', 1),
      'fixture-caregiver',
    ).ok,
  ).toBe(false);
  expect(signal.aborted).toBe(false);
  const input = applyInput(c),
    result = c.applyCommunicationSupport(input, profile('quiet', 1), 'fixture-caregiver');
  expect(result.ok).toBe(true);
  expect(signal.aborted).toBe(true);
  expect((await pending).ok).toBe(false);
  finish(ok({ text: 'stale-output-marker', language: 'en' }));
  await Promise.resolve();
  expect(c.snapshot()).toMatchObject({
    phase: 'paused',
    generation: original.generation + 1,
    captureGrant: null,
    micMuted: original.micMuted,
    privacyRevision: original.privacyRevision,
    policyRevision: original.policyRevision,
    communicationSupport: { preset: 'quiet' },
  });
  expect(c.isCurrentTextReply('old')).toBe(false);
  expect(JSON.stringify(c)).not.toContain('private-old-turn-marker');
  expect(JSON.stringify(c.snapshot())).not.toContain('fixture-caregiver');
  expect(c.applyCommunicationSupport(input, profile('quiet', 1), 'fixture-caregiver').ok).toBe(
    true,
  );
  expect(control(c, 'resume').ok).toBe(true);
  expect(c.snapshot()).toMatchObject({
    phase: 'ready',
    captureGrant: null,
    communicationSupport: { preset: 'quiet' },
  });
  expect(c.applyCommunicationSupport(input, profile('quiet', 1), 'fixture-caregiver').ok).toBe(
    false,
  );
  expect(c.snapshot()?.phase).toBe('ready');
});

test('mock activity apply-now pauses its reducer and changes no playback receipt or privacy permission', () => {
  const c = new SessionCoordinator();
  start(c);
  const started = c.handle('activities.start', {
    sessionId: c.snapshot()!.id,
    activityId: 'music_playlist',
    packId: 'music-demo',
    packVersion: 1,
    commandId: 'music',
  });
  if (!started.ok) throw new Error('Fixture activity failed');
  const result = c.handle('profile.applySupport', { ...applyInput(c, 0) });
  expect(result.ok).toBe(true);
  const activity = c.handle('activities.view', {
    sessionId: c.snapshot()!.id,
    instanceId: (started.data as any).instanceId,
  });
  expect(activity.ok && (activity.data as any).phase).toBe('paused');
  const events = c.persistenceSnapshot()!.events;
  expect(events).toContainEqual({
    type: 'activity_paused',
    reason: 'config_change',
    source: 'measured_event',
  });
  expect(events.some((e) => e.type === 'track_played')).toBe(false);
  expect(c.snapshot()?.captureGrant).toBeNull();
});

const url = process.env.LEMMI_SUPPORT_TEST_DATABASE_URL;
const dbtest = url ? test : test.skip;
let sql: ReturnType<typeof database>, repo: DataRepository;
beforeAll(async () => {
  if (!url) return;
  if (
    !new URL(url).pathname.endsWith('_support_test') ||
    (process.env.LEMMI_TEST_DATABASE_URL &&
      new URL(url).pathname === new URL(process.env.LEMMI_TEST_DATABASE_URL).pathname)
  )
    throw new Error('Use a separate disposable database ending in _support_test');
  sql = database(url);
  await migrate(sql);
  repo = new DataRepository(
    sql,
    await PrivateMedia.create(await mkdtemp(join(tmpdir(), 'lemmi-support-test-'))),
  );
});
afterAll(async () => {
  if (sql) await sql.close();
});
async function persistent(changed: (c: SessionCoordinator) => void = () => {}) {
  await sql`TRUNCATE lemmi.profiles CASCADE`;
  const c = new SessionCoordinator('live');
  const data = new PersistentData(
    repo,
    'fixture-caregiver',
    c,
    Date.now,
    () => {},
    () => changed(c),
  );
  await data.start();
  start(c);
  return { c, data };
}
async function saveQuiet(data: PersistentData) {
  const input = {
    profileId: 'profile-alex',
    expectedRevision: 0,
    commandId: crypto.randomUUID(),
    patch: { communicationSupport: { preset: 'quiet', configVersion: 1 } },
  };
  const result = await data.handle(
    { operation: 'profile.update', input },
    'fixture-caregiver',
    undefined,
  );
  expect(result.ok).toBe(true);
  return input;
}

dbtest(
  'saved selections and session context persist once with authenticated provenance; previews and retries do not create history',
  async () => {
    const { c, data } = await persistent();
    try {
      expect(await sql`SELECT * FROM lemmi.profile_support_selections`).toHaveLength(0);
      const saved = await saveQuiet(data);
      const state = await data.handle(
        { operation: 'support.read', profileId: 'profile-alex' },
        'fixture-caregiver',
        undefined,
      );
      expect(state).toMatchObject({
        ok: true,
        data: {
          profileRevision: 1,
          saved: { preset: 'quiet' },
          session: { communicationSupport: { preset: 'guided' } },
        },
      });
      expect(JSON.stringify(state)).not.toContain('fixture-caregiver');
      await data.handle(
        { operation: 'profile.update', input: saved },
        'fixture-caregiver',
        undefined,
      );
      expect(c.snapshot()?.communicationSupport.preset).toBe('guided');
      const history = await sql`SELECT preset,actor_subject FROM lemmi.profile_support_selections`;
      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({ preset: 'quiet', actor_subject: 'fixture-caregiver' });
      const input = applyInput(c);
      expect(
        (await data.handle({ operation: 'support.apply', input }, 'fixture-caregiver', undefined))
          .ok,
      ).toBe(true);
      expect(
        (await data.handle({ operation: 'support.apply', input }, 'fixture-caregiver', undefined))
          .ok,
      ).toBe(true);
      const context =
        await sql`SELECT preset,source,actor_subject FROM lemmi.session_support_selections ORDER BY generation`;
      expect(context).toHaveLength(2);
      expect(context[0]).toMatchObject({
        preset: 'guided',
        source: 'profile_default',
        actor_subject: null,
      });
      expect(context[1]).toMatchObject({
        preset: 'quiet',
        source: 'caregiver_apply',
        actor_subject: 'fixture-caregiver',
      });
      expect(c.snapshot()).toMatchObject({
        phase: 'paused',
        captureGrant: null,
        communicationSupport: { preset: 'quiet' },
      });
      const row = (
        await sql`SELECT remembering_enabled,excerpt_saving_enabled FROM lemmi.profiles`
      )[0];
      expect(row).toMatchObject({ remembering_enabled: false, excerpt_saving_enabled: false });
      await sql`DELETE FROM lemmi.profiles`;
      expect(await sql`SELECT * FROM lemmi.profile_support_selections`).toHaveLength(0);
      expect(await sql`SELECT * FROM lemmi.session_support_selections`).toHaveLength(0);
    } finally {
      await data.close();
    }
  },
);

dbtest(
  'unassigned identities, participant principals and stale profile/session revisions cannot apply support',
  async () => {
    const { c, data } = await persistent();
    try {
      await saveQuiet(data);
      const input = applyInput(c),
        before = c.snapshot();
      await expect(
        data.handle({ operation: 'support.apply', input }, 'unassigned', undefined),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      await expect(
        repo.withSupportProfile(
          {
            kind: 'participant',
            profileId: 'profile-alex',
            deviceId: 'stackchan-alex',
            credentialId: crypto.randomUUID(),
            bootId: data.devices.bootId,
          },
          input,
          () => {
            throw new Error('Must not reach apply');
          },
        ),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      await expect(
        data.handle(
          { operation: 'support.apply', input: { ...input, expectedProfileRevision: 0 } },
          'fixture-caregiver',
          undefined,
        ),
      ).rejects.toMatchObject({ code: 'REVISION_CONFLICT' });
      const stale = await data.handle(
        { operation: 'support.apply', input: { ...input, expectedGeneration: 99 } },
        'fixture-caregiver',
        undefined,
      );
      expect(stale.ok).toBe(false);
      await expect(
        data.handle(
          { operation: 'support.apply', input: { ...input, profileId: 'preview-sam' } },
          'fixture-caregiver',
          undefined,
        ),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      expect(c.snapshot()).toEqual(before);
    } finally {
      await data.close();
    }
  },
);

dbtest(
  'an in-flight context save blocks Resume/new sessions while Stop remains immediate',
  async () => {
    let paused!: () => void;
    const reachedPause = new Promise<void>((r) => {
      paused = r;
    });
    const { c, data } = await persistent((x) => {
      if (x.snapshot()?.phase === 'paused') paused();
    });
    const blocker = await sql.reserve();
    let work: Promise<unknown> | undefined;
    try {
      await sql.unsafe(`CREATE FUNCTION lemmi.fixture_block_profile() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_advisory_xact_lock(1437236199); RETURN NEW; END $$;
      CREATE TRIGGER fixture_block_profile BEFORE UPDATE ON lemmi.profiles FOR EACH ROW EXECUTE FUNCTION lemmi.fixture_block_profile()`);
      await blocker`SELECT pg_advisory_lock(1437236199)`;
      work = data.handle(
        {
          operation: 'profile.update',
          input: {
            profileId: 'profile-alex',
            expectedRevision: 0,
            commandId: crypto.randomUUID(),
            patch: { preferredName: 'Alex Fictional' },
          },
        },
        'fixture-caregiver',
        undefined,
      );
      await reachedPause;
      // A blocked configuration write cannot grow an unbounded caregiver queue.
      const queued = Array.from({ length: 33 }, () =>
        data
          .handle(
            { operation: 'support.read', profileId: 'profile-alex' },
            'fixture-caregiver',
            undefined,
          )
          .then(
            () => true,
            () => false,
          ),
      );
      expect(control(c, 'resume').ok).toBe(false);
      expect(control(c, 'stop').ok).toBe(true);
      expect(
        c.handle('session.start', {
          profileId: 'profile-alex',
          endpoint: 'robot',
          commandId: 'too-early',
        }).ok,
      ).toBe(false);
      expect(c.snapshot()?.phase).toBe('ended');
      await blocker`SELECT pg_advisory_unlock(1437236199)`;
      await work;
      expect((await Promise.all(queued)).filter((ok) => !ok)).toHaveLength(2);
      expect(start(c).profileRevision).toBe(1);
    } finally {
      await blocker`SELECT pg_advisory_unlock_all()`;
      blocker.release();
      if (work) await work.catch(() => {});
      await sql.unsafe(
        'DROP TRIGGER IF EXISTS fixture_block_profile ON lemmi.profiles; DROP FUNCTION IF EXISTS lemmi.fixture_block_profile()',
      );
      await data.close();
    }
  },
);

dbtest(
  'failed support checkpoint leaves the interaction paused and releases the configuration fence',
  async () => {
    const { c, data } = await persistent();
    const original = repo.saveSession;
    try {
      await saveQuiet(data);
      repo.saveSession = async () => {
        throw new Error('Fixture checkpoint failure');
      };
      await expect(
        data.handle(
          { operation: 'support.apply', input: applyInput(c) },
          'fixture-caregiver',
          undefined,
        ),
      ).rejects.toMatchObject({ code: 'UNAVAILABLE' });
      expect(c.snapshot()).toMatchObject({ phase: 'paused', captureGrant: null });
      repo.saveSession = original;
      expect(control(c, 'resume').ok).toBe(true);
      expect(c.snapshot()?.captureGrant).toBeNull();
    } finally {
      repo.saveSession = original;
      await data.close();
    }
  },
);

dbtest(
  'a failed context transaction keeps the old profile, rolls back support history and releases Resume',
  async () => {
    const { c, data } = await persistent();
    try {
      await sql.unsafe(`CREATE FUNCTION lemmi.fixture_reject_profile() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture reject'; RETURN NEW; END $$;
      CREATE TRIGGER fixture_reject_profile BEFORE UPDATE ON lemmi.profiles FOR EACH ROW EXECUTE FUNCTION lemmi.fixture_reject_profile()`);
      await expect(
        data.handle(
          {
            operation: 'profile.update',
            input: {
              profileId: 'profile-alex',
              expectedRevision: 0,
              commandId: crypto.randomUUID(),
              patch: {
                preferredName: 'Fictional change',
                communicationSupport: { preset: 'quiet', configVersion: 1 },
              },
            },
          },
          'fixture-caregiver',
          undefined,
        ),
      ).rejects.toThrow();
      expect(c.snapshot()).toMatchObject({
        phase: 'paused',
        captureGrant: null,
        communicationSupport: { preset: 'guided' },
      });
      expect(
        (await sql`SELECT revision,communication_preset FROM lemmi.profiles`)[0],
      ).toMatchObject({ revision: 0, communication_preset: 'guided' });
      expect(await sql`SELECT * FROM lemmi.profile_support_selections`).toHaveLength(0);
      expect(control(c, 'resume').ok).toBe(true);
    } finally {
      await sql.unsafe(
        'DROP TRIGGER IF EXISTS fixture_reject_profile ON lemmi.profiles; DROP FUNCTION IF EXISTS lemmi.fixture_reject_profile()',
      );
      await data.close();
    }
  },
);

dbtest(
  'Stop wins while apply-now persistence is delayed; its completion cannot restore the session',
  async () => {
    const { c, data } = await persistent();
    const original = repo.saveSession;
    let entered!: () => void, release!: () => void;
    const gate = new Promise<void>((r) => {
        release = r;
      }),
      waiting = new Promise<void>((r) => {
        entered = r;
      });
    let work: ReturnType<PersistentData['handle']> | undefined;
    try {
      await saveQuiet(data);
      repo.saveSession = async (...args: Parameters<DataRepository['saveSession']>) => {
        entered();
        await gate;
        return original.apply(repo, args);
      };
      work = data.handle(
        { operation: 'support.apply', input: applyInput(c) },
        'fixture-caregiver',
        undefined,
      );
      void work.catch(() => {});
      await waiting;
      expect(control(c, 'resume').ok).toBe(false);
      expect(control(c, 'stop').ok).toBe(true);
      release();
      await expect(work).rejects.toMatchObject({ code: 'REVISION_CONFLICT' });
      expect(c.snapshot()).toMatchObject({ phase: 'ended', captureGrant: null });
      expect(control(c, 'resume').ok).toBe(false);
    } finally {
      release();
      if (work) await work.catch(() => {});
      repo.saveSession = original;
      await data.close();
    }
  },
);

dbtest(
  'a lost profile COMMIT reply is reconciled before explicit continuation uses the current profile',
  async () => {
    const { c, data } = await persistent();
    const original = repo.update;
    try {
      repo.update = async (...args: Parameters<DataRepository['update']>) => {
        await original.apply(repo, args);
        throw new Error('Fixture lost COMMIT response');
      };
      await expect(
        data.handle(
          {
            operation: 'profile.update',
            input: {
              profileId: 'profile-alex',
              expectedRevision: 0,
              commandId: crypto.randomUUID(),
              patch: { preferredName: 'Committed Fictional Name' },
            },
          },
          'fixture-caregiver',
          undefined,
        ),
      ).rejects.toThrow();
      expect(c.snapshot()).toMatchObject({
        phase: 'paused',
        profileRevision: 1,
        captureGrant: null,
      });
      expect(control(c, 'resume').ok).toBe(true);
      expect(c.snapshot()?.profileRevision).toBe(1);
      expect(
        (
          await repo.profile(
            { kind: 'caregiver', profileId: 'profile-alex', subject: 'fixture-caregiver' },
            'profile-alex',
            true,
          )
        ).preferredName,
      ).toBe('Committed Fictional Name');
    } finally {
      repo.update = original;
      await data.close();
    }
  },
);

dbtest(
  'an unreconciled profile outcome blocks continuation until restart while Stop still works',
  async () => {
    const { c, data } = await persistent();
    const originalUpdate = repo.update,
      originalRead = repo.profile;
    try {
      repo.update = async (...args: Parameters<DataRepository['update']>) => {
        await originalUpdate.apply(repo, args);
        throw new Error('Fixture unknown outcome');
      };
      repo.profile = async () => {
        throw new Error('Fixture unavailable read');
      };
      await expect(
        data.handle(
          {
            operation: 'profile.update',
            input: {
              profileId: 'profile-alex',
              expectedRevision: 0,
              commandId: crypto.randomUUID(),
              patch: { preferredName: 'Fictional pending outcome' },
            },
          },
          'fixture-caregiver',
          undefined,
        ),
      ).rejects.toMatchObject({ code: 'UNAVAILABLE' });
      expect(c.snapshot()).toMatchObject({ phase: 'paused', captureGrant: null });
      expect(control(c, 'resume').ok).toBe(false);
      expect(control(c, 'stop').ok).toBe(true);
      expect(
        c.handle('session.start', {
          profileId: 'profile-alex',
          endpoint: 'robot',
          commandId: crypto.randomUUID(),
        }).ok,
      ).toBe(false);
    } finally {
      repo.update = originalUpdate;
      repo.profile = originalRead;
      await data.close();
    }
  },
);

test('caregiver support HTTP is POST-only, rejects forged actors/device tokens, and has a typed resource client', async () => {
  const c = new SessionCoordinator('live');
  start(c);
  const config = {
    publicOrigin: 'https://lemmi.test',
    internalToken: 'x'.repeat(32),
    accessKey: null,
    gatewayPort: 3001,
    auth: {
      endpoint: 'https://identity.test',
      issuer: 'fixture',
      audience: 'lemmi',
      clientId: 'fixture',
      clientSecret: 'fixture',
      subject: 'fixture-caregiver',
    },
  };
  const path = 'https://lemmi.test/v1/profiles/profile-alex/communication-support/apply';
  let mutations = 0;
  const fetcher: import('@lemmi/contracts').Fetcher = async (input, init) => {
    if (String(input) === 'https://identity.test')
      return Response.json({
        active: new URLSearchParams(String(init?.body)).get('token') === 'caregiver-token',
        iss: 'fixture',
        aud: 'lemmi',
        sub: 'fixture-caregiver',
        exp: Math.floor(Date.now() / 1000) + 300,
        token_type: 'Bearer',
      });
    const body = JSON.parse(String(init?.body));
    expect(body.actor).toBe('fixture-caregiver');
    expect(body.credential).toBeUndefined();
    if (body.operation === 'support.read')
      return Response.json(
        ok({
          profileId: 'profile-alex',
          profileRevision: 0,
          saved: c.snapshot()!.communicationSupport,
          session: c.snapshot(),
        }),
      );
    mutations++;
    expect(body.operation).toBe('support.apply');
    return Response.json(ok(c.snapshot()!));
  };
  const route = { kind: 'support', profileId: 'profile-alex', apply: true } as const;
  const request = (token: string, body: unknown = applyInput(c, 0)) =>
    new Request(path, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  expect((await handleDataHttp(new Request(path), route, config, fetcher)).status).toBe(405);
  expect((await handleDataHttp(request('device-token'), route, config, fetcher)).status).toBe(401);
  expect(
    (
      await handleDataHttp(
        request('caregiver-token', { ...applyInput(c, 0), actor: 'spoofed' }),
        route,
        config,
        fetcher,
      )
    ).status,
  ).toBe(400);
  expect((await handleDataHttp(request('caregiver-token'), route, config, fetcher)).status).toBe(
    200,
  );
  expect(mutations).toBe(1);
  expect(
    (
      await handleDataHttp(
        new Request(path.replace('/apply', ''), {
          headers: { authorization: 'Bearer caregiver-token' },
        }),
        { kind: 'support', profileId: 'profile-alex' },
        config,
        fetcher,
      )
    ).status,
  ).toBe(200);
  expect(
    (
      await handleDataHttp(
        new Request(path.replace('/apply', ''), {
          headers: { authorization: 'Bearer device-token' },
        }),
        { kind: 'support', profileId: 'profile-alex' },
        config,
        fetcher,
      )
    ).status,
  ).toBe(401);
  const calls: string[] = [];
  const clients = createClients(
    createHttpTransport('live', async (input, init) => {
      calls.push(String(input));
      if (String(input).endsWith('/apply')) {
        expect(init?.method).toBe('POST');
        return Response.json(ok(c.snapshot()!));
      }
      expect(init?.method).toBe('GET');
      expect(init?.body).toBeUndefined();
      return Response.json(
        ok({
          profileId: 'profile-alex',
          profileRevision: 0,
          saved: c.snapshot()!.communicationSupport,
          session: c.snapshot(),
        }),
      );
    }),
  );
  expect((await clients.profile.applySupport(applyInput(c, 0))).ok).toBe(true);
  expect((await clients.profile.support({ profileId: 'profile-alex' })).ok).toBe(true);
  expect(calls).toEqual([
    '/v1/profiles/profile-alex/communication-support/apply',
    '/v1/profiles/profile-alex/communication-support',
  ]);
});

dbtest(
  'per-profile support apply and context writes cancel only their own pending turns',
  async () => {
    await sql`TRUNCATE lemmi.profiles CASCADE`;
    const pending: Array<{ signal: AbortSignal; finish: (value: any) => void }> = [];
    const { SessionRegistry } = await import('../packages/server/src/session-registry');
    let changes = 0;
    const registry = new SessionRegistry({
      complete(_input, signal) {
        return new Promise((finish) => pending.push({ signal, finish }));
      },
    });
    const data = new PersistentData(
      repo,
      'fixture-caregiver',
      registry,
      Date.now,
      () => {},
      () => {
        changes++;
      },
    );
    try {
      await data.start();
      const other = await repo.createProfile(
        'fixture-caregiver',
        { preferredName: 'Casey', avatarId: 'cat' },
        true,
        data.devices.bootId,
      );
      registry.acceptPersistentProfile(other);
      const alex = registry.forProfile('profile-alex');
      const casey = registry.forProfile(other.id);
      for (const [id, coordinator] of [
        ['profile-alex', alex],
        [other.id, casey],
      ] as const) {
        expect(
          coordinator.handle('session.start', {
            profileId: id,
            endpoint: 'robot',
            commandId: crypto.randomUUID(),
          }).ok,
        ).toBe(true);
      }
      function submit(coordinator: SessionCoordinator) {
        const session = coordinator.snapshot()!;
        return coordinator.submitText({
          sessionId: session.id,
          expectedGeneration: session.generation,
          commandId: crypto.randomUUID(),
          text: 'A fictional garden greeting',
          language: 'en',
        });
      }
      const alexTurn = submit(alex),
        caseyTurn = submit(casey);
      for (let i = 0; i < 10 && pending.length < 2; i++) await Promise.resolve();
      expect(pending).toHaveLength(2);
      const beforeAlex = alex.snapshot()!;
      const saved = await data.handle(
        {
          operation: 'profile.update',
          input: {
            profileId: other.id,
            expectedRevision: 0,
            commandId: crypto.randomUUID(),
            patch: { communicationSupport: { preset: 'quiet', configVersion: 1 } },
          },
        },
        'fixture-caregiver',
        undefined,
      );
      expect(saved.ok).toBe(true);
      expect(pending.every((entry) => !entry.signal.aborted)).toBe(true);
      const read = await data.handle(
        { operation: 'support.read', profileId: other.id },
        'fixture-caregiver',
        undefined,
      );
      expect(read.ok).toBe(true);
      const { CommunicationSupportStateSchema } = await import('@lemmi/contracts');
      if (!read.ok) throw new Error('Scoped support read failed');
      expect(CommunicationSupportStateSchema.parse(read.data)).toMatchObject({
        profileId: other.id,
        saved: { preset: 'quiet' },
        session: { profileId: other.id, communicationSupport: { preset: 'guided' } },
      });
      const caseyBeforeApply = casey.snapshot()!;
      const apply = await data.handle(
        {
          operation: 'support.apply',
          input: {
            profileId: other.id,
            expectedProfileRevision: 1,
            sessionId: caseyBeforeApply.id,
            expectedGeneration: caseyBeforeApply.generation,
            commandId: crypto.randomUUID(),
          },
        },
        'fixture-caregiver',
        undefined,
      );
      expect(apply.ok).toBe(true);
      expect(casey.snapshot()).toMatchObject({
        profileId: other.id,
        phase: 'paused',
        communicationSupport: { preset: 'quiet' },
      });
      expect(pending[1]!.signal.aborted).toBe(true);
      expect(pending[0]!.signal.aborted).toBe(false);
      expect(alex.snapshot()).toEqual(beforeAlex);
      expect((await caseyTurn).ok).toBe(false);
      const selections =
        await sql`SELECT profile_id,preset,source FROM lemmi.session_support_selections WHERE source='caregiver_apply'`;
      expect(selections).toHaveLength(1);
      expect(selections[0]).toMatchObject({ profile_id: other.id, preset: 'quiet' });
      expect(control(casey, 'resume').ok).toBe(true);
      const secondCaseyTurn = submit(casey);
      for (let i = 0; i < 10 && pending.length < 3; i++) await Promise.resolve();
      expect(pending).toHaveLength(3);
      const changed = await data.handle(
        {
          operation: 'profile.update',
          input: {
            profileId: 'profile-alex',
            expectedRevision: 0,
            commandId: crypto.randomUUID(),
            patch: { preferredName: 'Alex fixture' },
          },
        },
        'fixture-caregiver',
        undefined,
      );
      expect(changed.ok).toBe(true);
      expect(pending[0]!.signal.aborted).toBe(true);
      expect(pending[2]!.signal.aborted).toBe(false);
      expect(alex.snapshot()?.phase).toBe('paused');
      expect(casey.snapshot()?.phase).toBe('processing');
      expect((await alexTurn).ok).toBe(false);
      pending[2]!.finish(ok({ text: 'Flowers can be lovely.', language: 'en' }));
      expect((await secondCaseyTurn).ok).toBe(true);
      pending[0]!.finish(ok({ text: 'Late obsolete reply.', language: 'en' }));
      pending[1]!.finish(ok({ text: 'Late obsolete reply.', language: 'en' }));
      expect(casey.snapshot()?.phase).toBe('waiting');
      expect(changes).toBeGreaterThan(0);
    } finally {
      registry.disconnect();
      await data.close();
    }
  },
);
