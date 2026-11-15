import { afterAll, beforeAll, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ok } from '@lemmi/contracts';
import {
  database,
  migrate,
  PrivateMedia,
  DataRepository,
  PersistentData,
  SessionRegistry,
  type SpeechAdapters,
} from '@lemmi/server';

const url = process.env.LEMMI_DEMO_TEST_DATABASE_URL;
const dbtest = url ? test : test.skip;
const subject = 'fictional-demo-edit-caregiver';
let sql: ReturnType<typeof database>, repo: DataRepository, data: PersistentData;
let sessions: SessionRegistry, root: string;
const immediateTts: SpeechAdapters['tts']['synthesize'] = async () =>
  ok({
    pcm: new Uint8Array(1280),
    sampleRate: 16000,
    channels: 1,
    encoding: 'pcm_s16le',
    language: 'en',
  });
let synthesize = immediateTts;
beforeAll(async () => {
  if (!url) return;
  if (!new URL(url).pathname.endsWith('_demo_test'))
    throw new Error('Dedicated _demo_test database required');
  sql = database(url);
  await migrate(sql);
  await sql`TRUNCATE lemmi.profiles CASCADE`;
  root = await mkdtemp(join(tmpdir(), 'lemmi-demo-profile-data-'));
  repo = new DataRepository(sql, await PrivateMedia.create(root));
  sessions = new SessionRegistry(
    {
      async complete(input) {
        return ok({ text: 'We can take our time.', language: input.language });
      },
    },
    {
      stt: {
        async transcribe() {
          return ok({ text: 'Start Photo Story', language: 'en' });
        },
      },
      tts: { synthesize: (...args) => synthesize(...args) },
    },
    Date.now,
    () => {},
    true,
  );
  data = new PersistentData(repo, subject, sessions, Date.now, () => {});
  await data.start();
});
afterAll(async () => {
  if (data) await data.close();
  if (sql) await sql.close();
  if (root) await rm(root, { recursive: true, force: true });
});
async function create() {
  const result = await data.demoHandle({
    operation: 'profile.create',
    input: { preferredName: 'Fictional isolated edit' },
  });
  if (!result.ok) throw new Error('Fixture create failed');
  return result.data as { id: string; revision: number };
}
const update = (id: string, revision = 0, commandId = crypto.randomUUID()) => ({
  operation: 'profile.update',
  input: {
    profileId: id,
    expectedRevision: revision,
    commandId,
    patch: { preferredName: 'Fictional renamed profile', avatarId: 'bird' },
  },
});
dbtest(
  'demo identity edits use durable receipts, retain redirects/private context, and pause only their own profile',
  async () => {
    const a = await create(),
      b = await create();
    await sql`UPDATE lemmi.profiles SET sensitive_guidance='private fictional guidance', conversation_redirects='{"awayFrom":["previous employment"],"toward":["flowers"]}'::jsonb WHERE id=${a.id}`;
    for (const p of [a, b]) {
      const started = sessions.forProfile(p.id).handle('session.start', {
        profileId: p.id,
        endpoint: 'browser',
        commandId: crypto.randomUUID(),
      });
      expect(started.ok).toBe(true);
    }
    const request = update(a.id);
    const result = await data.demoHandle(request);
    expect(result.ok).toBe(true);
    expect(result.ok && Object.keys(result.data as object).sort()).toEqual([
      'avatarId',
      'communicationSupport',
      'id',
      'language',
      'preferredName',
      'revision',
    ]);
    expect(sessions.forProfile(a.id).snapshot()?.phase).toBe('paused');
    expect(sessions.forProfile(b.id).snapshot()?.phase).toBe('ready');
    const row = (await sql`SELECT * FROM lemmi.profiles WHERE id=${a.id}`)[0];
    expect(row.revision).toBe(1);
    expect(row.sensitive_guidance).toBe('private fictional guidance');
    expect(row.conversation_redirects).toEqual({
      awayFrom: ['previous employment'],
      toward: ['flowers'],
    });
    expect(await data.demoHandle(request)).toEqual(result);
    await expect(data.demoHandle(update(a.id))).rejects.toMatchObject({
      code: 'REVISION_CONFLICT',
    });
    expect(
      (
        await sql`SELECT count(*)::int AS n FROM lemmi.mutation_receipts WHERE profile_id=${a.id}`
      )[0].n,
    ).toBe(1);
  },
);
dbtest(
  'demo assignment and is_demo must still hold inside the locked write transaction',
  async () => {
    const profile = await create();
    const original = repo.listProfiles.bind(repo);
    let changed = false;
    repo.listProfiles = async (...args: Parameters<typeof repo.listProfiles>) => {
      const result = await original(...args);
      if (!changed && args[1] === true) {
        changed = true;
        await sql`UPDATE lemmi.profiles SET is_demo=false WHERE id=${profile.id}`;
      }
      return result;
    };
    try {
      await expect(data.demoHandle(update(profile.id))).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
      const row = (
        await sql`SELECT revision, preferred_name FROM lemmi.profiles WHERE id=${profile.id}`
      )[0];
      expect(row.revision).toBe(0);
      expect(row.preferred_name).toBe('Fictional isolated edit');
      expect(
        (
          await sql`SELECT count(*)::int AS n FROM lemmi.mutation_receipts WHERE profile_id=${profile.id}`
        )[0].n,
      ).toBe(0);
    } finally {
      repo.listProfiles = original;
    }
  },
);
dbtest(
  'demo updates cannot edit real/foreign/deleted profiles or inject private fields',
  async () => {
    const real = await repo.createProfile(
      subject,
      { preferredName: 'Protected fixture' },
      false,
      data.devices.bootId,
    );
    const foreign = await repo.createProfile(
      'another-fixture-caregiver',
      { preferredName: 'Foreign fixture' },
      true,
      data.devices.bootId,
    );
    const removed = await create();
    await sql`DELETE FROM lemmi.profiles WHERE id=${removed.id}`;
    for (const id of [real.id, foreign.id, removed.id, 'preview-morgan'])
      await expect(data.demoHandle(update(id))).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const profile = await create();
    await expect(
      data.demoHandle({
        ...update(profile.id),
        input: {
          ...update(profile.id).input,
          patch: {
            preferredName: 'Injected',
            avatarId: 'dog',
            conversationRedirects: { awayFrom: [], toward: [] },
          },
        },
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(
      (await sql`SELECT revision FROM lemmi.profiles WHERE id=${profile.id}`)[0].revision,
    ).toBe(0);
  },
);

dbtest(
  'a durable demo edit cancels pending spoken mode output and cannot persist its utterance',
  async () => {
    const profile = await create(),
      other = await create();
    const c = sessions.forProfile(profile.id);
    for (const p of [profile, other])
      expect(
        sessions.forProfile(p.id).handle('session.start', {
          profileId: p.id,
          endpoint: 'browser',
          commandId: crypto.randomUUID(),
        }).ok,
      ).toBe(true);
    let s = c.snapshot()!;
    expect(
      c.handle('session.command', {
        sessionId: s.id,
        expectedGeneration: s.generation,
        commandId: crypto.randomUUID(),
        action: { type: 'mute', muted: false },
      }).ok,
    ).toBe(true);
    s = c.snapshot()!;
    const requested = c.requestCapture(
      {
        sessionId: s.id,
        expectedGeneration: s.generation,
        commandId: crypto.randomUUID(),
        language: 'en',
      },
      [16000],
    );
    if (!requested.ok) throw new Error('Fixture capture failed');
    const grant = requested.data.captureGrant!;
    const stream = {
      sessionId: s.id,
      expectedGeneration: s.generation,
      turnId: grant.turnId,
      leaseId: grant.leaseId,
      streamId: grant.streamId,
    };
    expect(
      c.acceptCaptureChunk({
        ...stream,
        chunkIndex: 0,
        encoding: 'pcm_s16le',
        data: Buffer.alloc(640).toString('base64'),
      }).ok,
    ).toBe(true);
    let entered!: () => void, finish!: (value: any) => void;
    const began = new Promise<void>((resolve) => {
      entered = resolve;
    });
    synthesize = () => {
      entered();
      return new Promise((resolve) => {
        finish = resolve;
      });
    };
    try {
      const pending = c.finishCapture({ ...stream, chunkCount: 1 });
      await began;
      expect((await data.demoHandle(update(profile.id))).ok).toBe(true);
      const pcm = new Uint8Array(1280).fill(42);
      finish(ok({ pcm, sampleRate: 16000, channels: 1, encoding: 'pcm_s16le', language: 'en' }));
      expect((await pending).ok).toBe(false);
      await Bun.sleep(0);
      expect(pcm.every((value) => value === 0)).toBe(true);
      expect(c.drainSpeechOutput()).toBeNull();
      expect(c.snapshot()?.phase).toBe('paused');
      expect(sessions.forProfile(other.id).snapshot()?.phase).toBe('ready');
      await data.checkpoint(c.persistenceSnapshot());
      const stored =
        await sql`SELECT s.*, (SELECT jsonb_agg(e) FROM lemmi.activity_events e WHERE e.session_id=s.id) AS events FROM lemmi.sessions s WHERE s.profile_id=${profile.id}`;
      expect(JSON.stringify(stored)).not.toContain('Start Photo Story');
      expect(JSON.stringify(c.persistenceSnapshot())).not.toContain('Start Photo Story');
    } finally {
      synthesize = immediateTts;
    }
  },
);
