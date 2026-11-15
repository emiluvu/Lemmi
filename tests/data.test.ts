import { test, expect, beforeAll, afterAll } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readdir, stat, symlink, writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  database,
  assertPrivateDatabaseLogging,
  migrate,
  PrivateMedia,
  DataRepository,
  DataError,
  DatabaseDeviceAuthority,
  SessionCoordinator,
  PersistentData,
  decodeMedia,
  sha256,
  handleDataHttp,
  type DataPrincipal,
} from '@lemmi/server';
import {
  ProfileDetailSchema,
  ParticipantProfileSchema,
  createClients,
  createHttpTransport,
  ProfileContextSchema,
  type Fetcher,
} from '@lemmi/contracts';
import { startControlGateway } from '../apps/realtime/src/control';

const url = process.env.LEMMI_TEST_DATABASE_URL;
const dbtest = url ? test : test.skip;
const caregiver: DataPrincipal = {
  kind: 'caregiver',
  subject: 'fixture-caregiver',
  profileId: 'profile-alex',
};
let sql: ReturnType<typeof database>, repo: DataRepository, root: string;
function png() {
  const chunk = (type: string, data: Buffer) => {
    const buffer = Buffer.alloc(data.length + 12);
    buffer.writeUInt32BE(data.length);
    buffer.write(type, 4);
    data.copy(buffer, 8);
    let crc = 0xffffffff;
    for (const byte of buffer.subarray(4, -4)) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    buffer.writeUInt32BE((crc ^ 0xffffffff) >>> 0, buffer.length - 4);
    return buffer;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1);
  header.writeUInt32BE(1, 4);
  header[8] = 8;
  header[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.from([0, 100, 120, 140]))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
function upload(overrides: Record<string, unknown> = {}) {
  return {
    profileId: 'profile-alex',
    commandId: randomUUID(),
    expectedRevision: 0,
    kind: 'image',
    mediaType: 'image/png',
    source: 'Generated fictional test pixel',
    permission: 'Team fixture',
    caption: 'Fictional pixel',
    discussionContext: 'Private reviewed fixture context',
    entityIds: ['object:kettle'],
    approved: true,
    dataBase64: png().toString('base64'),
    ...overrides,
  };
}
function update(revision: number, patch: Record<string, unknown>) {
  return { profileId: 'profile-alex', commandId: randomUUID(), expectedRevision: revision, patch };
}
async function reset() {
  await sql`TRUNCATE lemmi.profiles CASCADE`;
  await repo.bootstrap('fixture-caregiver');
}
beforeAll(async () => {
  if (!url) return;
  if (!new URL(url).pathname.endsWith('_test'))
    throw new Error('Database tests require a dedicated database ending in _test');
  sql = database(url);
  await migrate(sql);
  root = await mkdtemp(join(tmpdir(), 'lemmi-data-test-'));
  repo = new DataRepository(sql, await PrivateMedia.create(root));
});
afterAll(async () => {
  if (sql) await sql.close();
});

test('media parser rejects wrong magic, bad CRC, pixel bounds and metadata; keys never become paths', async () => {
  const bytes = png();
  expect(decodeMedia(bytes.toString('base64'), 'image/png').width).toBe(1);
  const broken = Buffer.from(bytes);
  broken[broken.length - 1] = broken[broken.length - 1]! ^ 1;
  expect(() => decodeMedia(broken.toString('base64'), 'image/png')).toThrow();
  expect(() => decodeMedia('<svg/>', 'image/png')).toThrow();
  expect(() => decodeMedia(bytes.toString('base64'), 'image/jpeg')).toThrow();
  expect(() =>
    decodeMedia(Buffer.from('captured microphone').toString('base64'), 'audio/wav'),
  ).toThrow();
  const directory = await mkdtemp(join(tmpdir(), 'lemmi-private-'));
  const media = await PrivateMedia.create(directory);
  const key = randomUUID();
  await media.write(key, bytes);
  expect((await stat(join(directory, key))).mode & 0o777).toBe(0o600);
  expect((await stat(directory)).mode & 0o777).toBe(0o700);
  expect(await media.read(key, bytes.length, sha256(bytes))).toEqual(bytes);
  await expect(media.read('../escape', 1, 'x')).rejects.toThrow();
  const alias = randomUUID();
  await symlink(join(directory, key), join(directory, alias));
  await expect(media.read(alias, bytes.length, sha256(bytes))).rejects.toThrow();
  await writeFile(join(directory, key), Buffer.alloc(bytes.length));
  await expect(media.read(key, bytes.length, sha256(bytes))).rejects.toThrow();
});

dbtest('migrations are repeatable, checksummed and only Alex is seeded', async () => {
  await sql.begin(async (tx) => {
    await tx`SET LOCAL log_error_verbosity='default'`;
    await expect(assertPrivateDatabaseLogging(tx)).rejects.toThrow('private logging settings');
  });
  await migrate(sql);
  await reset();
  expect((await sql`SELECT id FROM lemmi.profiles`).map((row: any) => row.id)).toEqual([
    'profile-alex',
  ]);
  await expect(
    sql`INSERT INTO lemmi.profiles (id,preferred_name,avatar_id,communication_preset) VALUES ('preview-sam','Sam','cat','quiet')`,
  ).rejects.toThrow();
  await expect(repo.bootstrap('different-subject')).rejects.toThrow();
  await expect(
    repo.profile({ ...caregiver, subject: 'foreign' }, 'profile-alex', true),
  ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  await expect(repo.profile(caregiver, 'preview-sam', true)).rejects.toMatchObject({
    code: 'FORBIDDEN',
  });
});

dbtest(
  'profile summaries require opt-in and current revisions; forget blocks stale checkpoints',
  async () => {
    await reset();
    const c = new SessionCoordinator('live');
    c.acceptPersistentProfile(await repo.approvedProfile(caregiver.subject));
    c.handle('session.start', {
      profileId: 'profile-alex',
      endpoint: 'robot',
      commandId: randomUUID(),
    });
    const snapshot = c.snapshot()!;
    const memory = {
      summary: 'Participant discussed gardens.',
      profileRevision: 0,
      privacyRevision: 0,
    };
    await repo.saveSession(snapshot, [], undefined, [], memory);
    expect((await sql`SELECT * FROM lemmi.conversation_memories`).length).toBe(0);
    const enabled = await repo.update(
      caregiver,
      update(0, {
        summaryMemoryEnabled: true,
        context: ProfileContextSchema.parse({ career: 'Librarian' }),
      }),
      () => {},
    );
    const current = { ...snapshot, profileRevision: enabled.revision };
    await repo.saveSession(current, [], undefined, [], {
      ...memory,
      profileRevision: enabled.revision,
    });
    expect((await repo.approvedProfile(caregiver.subject)).memories?.length).toBe(1);
    const participant = await repo.profile({ ...caregiver, kind: 'caregiver' }, 'profile-alex');
    expect(participant).not.toHaveProperty('memories');
    expect(participant).not.toHaveProperty('context');
    await repo.update(
      caregiver,
      update(enabled.revision, { summaryMemoryEnabled: false }),
      () => {},
    );
    await repo.saveSession(current, [], undefined, [], {
      ...memory,
      profileRevision: enabled.revision,
    });
    expect((await sql`SELECT * FROM lemmi.conversation_memories`).length).toBe(0);
    await sql`UPDATE lemmi.profiles SET is_demo=false WHERE id='profile-alex'`;
    await expect(repo.profile(caregiver, 'profile-alex', true, true)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  },
);
dbtest(
  'participant memory refusal invalidates stale forms and cannot override later explicit opt-in',
  async () => {
    await reset();
    const enabled = await repo.update(
      caregiver,
      update(0, { summaryMemoryEnabled: true }),
      () => {},
    );
    const c = new SessionCoordinator('live');
    c.acceptPersistentProfile(enabled);
    c.handle('session.start', {
      profileId: 'profile-alex',
      endpoint: 'robot',
      commandId: randomUUID(),
    });
    const old = c.snapshot()!;
    const originalMemory = {
      summary: 'Participant discussed gardening.',
      profileRevision: enabled.revision,
      privacyRevision: enabled.privacyRevision,
    };
    await repo.saveSession(old, [], undefined, [], originalMemory);
    expect((await repo.approvedProfile(caregiver.subject)).memories).toHaveLength(1);

    await repo.saveSession(old, [], undefined, [], undefined, true);
    const refused = await repo.approvedProfile(caregiver.subject);
    expect(refused.summaryMemoryEnabled).toBe(false);
    expect(refused.revision).toBe(enabled.revision + 1);
    expect(refused.memories).toHaveLength(0);
    await repo.saveSession(old, [], undefined, [], undefined, true);
    await repo.saveSession(old, [], undefined, [], undefined, true);
    expect((await repo.approvedProfile(caregiver.subject)).revision).toBe(refused.revision);
    await expect(
      repo.update(
        caregiver,
        update(enabled.revision, {
          preferredName: 'Alex',
          summaryMemoryEnabled: true,
        }),
        () => {},
      ),
    ).rejects.toMatchObject({ code: 'REVISION_CONFLICT' });
    // The coordinator can still checkpoint its older paused-session revision.
    await repo.saveSession(old, [], undefined, [], originalMemory);
    expect((await sql`SELECT * FROM lemmi.conversation_memories`).length).toBe(0);

    const reenabled = await repo.update(
      caregiver,
      update(refused.revision, { summaryMemoryEnabled: true }),
      () => {},
    );
    const latest = { ...old, profileRevision: reenabled.revision };
    await repo.saveSession(latest, [], undefined, [], {
      ...originalMemory,
      summary: 'Participant discussed flowers.',
      profileRevision: reenabled.revision,
    });
    // Simulate an older already-queued refusal arriving after fresh explicit opt-in.
    await repo.saveSession(old, [], undefined, [], undefined, true);
    await repo.saveSession(old, [], undefined, [], undefined, true);
    const preserved = await repo.approvedProfile(caregiver.subject);
    expect(preserved.summaryMemoryEnabled).toBe(true);
    expect(preserved.revision).toBe(reenabled.revision);
    expect(preserved.memories?.map((memory) => memory.summary)).toEqual([
      'Participant discussed flowers.',
    ]);

    await repo.saveSession(latest, [], undefined, [], undefined, true);
    await repo.saveSession(latest, [], undefined, [], {
      ...originalMemory,
      profileRevision: reenabled.revision,
    });
    const forgottenAgain = await repo.approvedProfile(caregiver.subject);
    expect(forgottenAgain.summaryMemoryEnabled).toBe(false);
    expect(forgottenAgain.revision).toBe(reenabled.revision + 1);
    expect((await sql`SELECT * FROM lemmi.conversation_memories`).length).toBe(0);
  },
);

dbtest(
  'delayed summary checkpoints cannot recreate a removed profile or its memories',
  async () => {
    await reset();
    const enabled = await repo.update(
      caregiver,
      update(0, { summaryMemoryEnabled: true }),
      () => {},
    );
    const c = new SessionCoordinator('live');
    c.acceptPersistentProfile(enabled);
    c.handle('session.start', {
      profileId: 'profile-alex',
      endpoint: 'robot',
      commandId: randomUUID(),
    });
    const snapshot = c.snapshot()!;
    const memory = {
      summary: 'Participant discussed gardens.',
      profileRevision: enabled.revision,
      privacyRevision: enabled.privacyRevision,
    };
    await repo.saveSession(snapshot, [], undefined, [], memory);
    await sql`DELETE FROM lemmi.profiles WHERE id='profile-alex'`;
    await expect(repo.saveSession(snapshot, [], undefined, [], memory)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(
      repo.saveSession(snapshot, [], undefined, [], undefined, true),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect((await sql`SELECT * FROM lemmi.profiles`).length).toBe(0);
    expect((await sql`SELECT * FROM lemmi.conversation_memories`).length).toBe(0);
  },
);

dbtest('redirect settings persist privately with revision checks and caregiver scope', async () => {
  await reset();
  const settings = { awayFrom: ['old job'], toward: ['flowers'] };
  const saved = await repo.update(
    caregiver,
    update(0, { conversationRedirects: settings }),
    () => {},
  );
  expect(saved.conversationRedirects).toEqual(settings);
  expect((await repo.approvedProfile(caregiver.subject)).conversationRedirects).toEqual(settings);
  expect(JSON.stringify(await repo.profile(caregiver, caregiver.profileId))).not.toContain(
    'old job',
  );
  await expect(
    repo.update(
      { ...caregiver, subject: 'foreign' },
      update(1, { conversationRedirects: settings }),
      () => {},
    ),
  ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  await expect(
    repo.update(caregiver, update(0, { conversationRedirects: settings }), () => {}),
  ).rejects.toMatchObject({ code: 'REVISION_CONFLICT' });
  const cleared = await repo.update(
    caregiver,
    update(1, { conversationRedirects: { awayFrom: [], toward: [] } }),
    () => {},
  );
  expect(cleared.conversationRedirects?.awayFrom).toEqual([]);
});
dbtest(
  'profile transactions survive new connections, reject concurrent stale edits, and retain no old fact text',
  async () => {
    await reset();
    const factId = randomUUID();
    let paused = 0;
    const first = update(0, {
      preferredName: 'Alex Example',
      avatarId: 'bunny',
      approvedFacts: [
        {
          id: factId,
          field: 'personal_context',
          value: 'Fictional garden context',
          source: 'caregiver_provided',
        },
      ],
    });
    const saved = await repo.update(caregiver, first, () => paused++);
    expect(saved.revision).toBe(1);
    expect(paused).toBe(1);
    expect(await repo.update(caregiver, first, () => paused++)).toEqual(saved);
    expect(paused).toBe(1);
    const independent = database(url!);
    try {
      expect(
        (await new DataRepository(independent, repo.media).approvedProfile('fixture-caregiver'))
          .approvedFacts[0]?.value,
      ).toBe('Fictional garden context');
    } finally {
      await independent.close();
    }
    const results = await Promise.allSettled([
      repo.update(caregiver, update(1, { preferredName: 'First' }), () => {}),
      repo.update(caregiver, update(1, { preferredName: 'Second' }), () => {}),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    await expect(repo.update(caregiver, first, () => {})).rejects.toMatchObject({
      code: 'REVISION_CONFLICT',
    });
    await repo.update(caregiver, update(2, { approvedFacts: [] }), () => {});
    expect(await sql`SELECT * FROM lemmi.profile_facts`).toHaveLength(0);
    const receipts = JSON.stringify(await sql`SELECT * FROM lemmi.mutation_receipts`);
    expect(receipts).not.toContain('Fictional garden context');
    expect(receipts).not.toContain('Alex Example');
    await expect(
      repo.update(caregiver, update(3, { rememberingEnabled: true }), () => {}),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  },
);
dbtest(
  'failed update rolls back while cancellation precedes commit; late/forged/profile-deleted writes fail',
  async () => {
    await reset();
    let called = false;
    await expect(
      repo.update(caregiver, update(0, { preferredName: 'Never committed' }), () => {
        called = true;
        throw new Error('Cancelled');
      }),
    ).rejects.toThrow();
    expect(called).toBe(true);
    expect((await repo.approvedProfile('fixture-caregiver')).revision).toBe(0);
    await sql`UPDATE lemmi.profiles SET deletion_state='deleting'`;
    await expect(
      repo.update(caregiver, update(0, { preferredName: 'late' }), () => {}),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(repo.createAsset(caregiver, upload())).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  },
);
dbtest(
  'device issuance is committed as hashes, revoke retries spare replacements and restart preserves enrollment',
  async () => {
    await reset();
    let invalidations = 0;
    const authority = new DatabaseDeviceAuthority(repo, Date.now, () => invalidations++);
    await authority.start();
    const pair = await authority.pair('fixture-caregiver', {
      deviceId: 'stackchan-alex',
      profileId: 'profile-alex',
      commandId: 'pair-1',
    });
    if (!pair.ok) throw new Error('pair');
    const claim = await authority.claim({
      pairingId: pair.data.pairingId,
      code: pair.data.code,
      localConfirmed: true,
    });
    if (!claim.ok) throw new Error('claim');
    expect(await authority.authenticate(claim.data.credential)).not.toBeNull();
    const stored = JSON.stringify(await sql`SELECT * FROM lemmi.devices`);
    expect(stored).not.toContain(claim.data.credential);
    expect(stored).not.toContain(pair.data.code);
    const identity = (await authority.authenticate(claim.data.credential))!;
    const participant: DataPrincipal = {
      kind: 'participant',
      profileId: 'profile-alex',
      deviceId: identity.deviceId,
      credentialId: identity.credentialId,
      bootId: authority.bootId,
    };
    const projection = await repo.profile(participant, 'profile-alex');
    expect(ParticipantProfileSchema.safeParse(projection).success).toBe(true);
    await expect(repo.profile(participant, 'profile-alex', true)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(
      repo.update(participant, update(0, { avatarId: 'cat' }), () => {}),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(
      (
        await authority.revoke('fixture-caregiver', {
          deviceId: 'stackchan-alex',
          commandId: 'revoke-1',
        })
      ).ok,
    ).toBe(true);
    await expect(repo.profile(participant, 'profile-alex')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    const p2 = await authority.pair('fixture-caregiver', {
      deviceId: 'stackchan-alex',
      profileId: 'profile-alex',
      commandId: 'pair-2',
    });
    if (!p2.ok) throw new Error('pair');
    const c2 = await authority.claim({
      pairingId: p2.data.pairingId,
      code: p2.data.code,
      localConfirmed: true,
    });
    if (!c2.ok) throw new Error('claim');
    await authority.revoke('fixture-caregiver', {
      deviceId: 'stackchan-alex',
      commandId: 'revoke-1',
    });
    expect(await authority.authenticate(c2.data.credential)).not.toBeNull();
    const restart = new DatabaseDeviceAuthority(repo, Date.now, () => {});
    await restart.start();
    expect(await authority.authenticate(c2.data.credential)).toBeNull();
    expect(await restart.authenticate(c2.data.credential)).not.toBeNull();
    await restart.revoke('fixture-caregiver', {
      deviceId: 'stackchan-alex',
      commandId: 'revoke-1',
    });
    expect(await restart.authenticate(c2.data.credential)).not.toBeNull();
    expect(invalidations).toBeGreaterThan(0);
  },
);
dbtest(
  'private media is scoped, idempotent, policy-filtered, integrity checked and inaccessible after revocation/deletion',
  async () => {
    await reset();
    const input = upload();
    const asset = await repo.createAsset(caregiver, input);
    expect((await repo.createAsset(caregiver, input)).id).toBe(asset.id);
    expect(await sql`SELECT * FROM lemmi.media_assets`).toHaveLength(1);
    const read = await repo.asset(caregiver, asset.id, true);
    expect(read.bytes).toEqual(png());
    expect(JSON.stringify(read.metadata)).not.toContain('Private reviewed');
    expect(JSON.stringify(read.metadata)).not.toContain('storage_key');
    await expect(
      repo.createAsset(caregiver, { ...input, caption: 'changed' }),
    ).rejects.toMatchObject({ code: 'REVISION_CONFLICT' });
    await expect(
      repo.asset({ ...caregiver, subject: 'foreign' }, asset.id, true),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await sql`INSERT INTO lemmi.profile_item_policies (profile_id,entity_id,status,revision) VALUES ('profile-alex','object:kettle','retired',1)`;
    await expect(repo.asset(caregiver, asset.id, true)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await sql`DELETE FROM lemmi.profile_item_policies`;
    await sql`UPDATE lemmi.media_assets SET approved=false`;
    await expect(repo.asset(caregiver, asset.id, true)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await sql`UPDATE lemmi.media_assets SET approved=true`;
    await sql`UPDATE lemmi.profiles SET deletion_state='deleting'`;
    await expect(repo.asset(caregiver, asset.id, true)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  },
);
dbtest(
  'orphan recovery keeps registered media, removes crash leftovers, and does not restore active sessions',
  async () => {
    await reset();
    const asset = await repo.createAsset(caregiver, upload());
    const orphan = randomUUID();
    await repo.media.write(orphan, png());
    const c = new SessionCoordinator('live');
    c.acceptPersistentProfile(await repo.approvedProfile('fixture-caregiver'));
    const start = c.handle('session.start', {
      profileId: 'profile-alex',
      commandId: 'start',
      endpoint: 'robot',
    });
    expect(start.ok).toBe(true);
    const snapshot = c.snapshot()!;
    await repo.saveSession(snapshot, []);
    await repo.restart(randomUUID());
    expect((await sql`SELECT phase FROM lemmi.sessions WHERE id=${snapshot.id}`)[0].phase).toBe(
      'ended',
    );
    expect((await readdir(root)).includes(orphan)).toBe(false);
    expect((await repo.asset(caregiver, asset.id, true)).bytes).toEqual(png());
  },
);
dbtest(
  'existing authority applies biography revisions, aborts pending responses and preserves future-only support settings',
  async () => {
    await reset();
    let resolveReply: (value: any) => void = () => {};
    let aborted = false;
    const c = new SessionCoordinator('live', {
      complete(_input, signal) {
        signal.addEventListener('abort', () => {
          aborted = true;
        });
        return new Promise((resolve) => {
          resolveReply = resolve;
        });
      },
    });
    const data = new PersistentData(repo, 'fixture-caregiver', c, Date.now, () => {});
    await data.start();
    try {
      c.handle('session.start', {
        profileId: 'profile-alex',
        commandId: 'start',
        endpoint: 'robot',
      });
      const old = c.snapshot()!;
      const pending = c.submitText({
        commandId: 'turn',
        sessionId: old.id,
        expectedGeneration: old.generation,
        text: 'Hello',
        language: 'en',
      });
      const input = update(0, { preferredName: 'Alex Fictional' });
      const result = await data.handle(
        { operation: 'profile.update', input },
        'fixture-caregiver',
        undefined,
      );
      expect(result.ok).toBe(true);
      expect(c.snapshot()?.phase).toBe('paused');
      expect(aborted).toBe(true);
      resolveReply({ ok: true, data: { text: 'obsolete', language: 'en' } });
      expect((await pending).ok).toBe(false);
      const paused = c.snapshot()!;
      c.handle('session.command', {
        commandId: 'resume',
        sessionId: paused.id,
        expectedGeneration: paused.generation,
        action: { type: 'resume' },
      });
      const before = c.snapshot()!;
      await data.handle(
        {
          operation: 'profile.update',
          input: update(1, { communicationSupport: { preset: 'quiet', configVersion: 1 } }),
        },
        'fixture-caregiver',
        undefined,
      );
      expect(c.snapshot()?.phase).toBe(before.phase);
      expect(c.snapshot()?.communicationSupport.preset).toBe('guided');
    } finally {
      await data.close();
    }
  },
);

test('public resource routes use managed caregiver verification or device verification without leaking a device token to the provider', async () => {
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
  const calls: string[] = [];
  const fetcher: Fetcher = async (input, init) => {
    calls.push(String(input));
    if (String(input).startsWith('https://identity.test'))
      return Response.json({
        active: true,
        iss: 'fixture',
        aud: 'lemmi',
        sub: 'fixture-caregiver',
        exp: Math.floor(Date.now() / 1000) + 300,
        token_type: 'Bearer',
      });
    const body = JSON.parse(String(init?.body));
    if (body.operation === 'profile.read')
      return Response.json({
        ok: true,
        data: {
          id: 'profile-alex',
          preferredName: 'Alex',
          avatarId: 'lemming',
          revision: 0,
          communicationSupport: { preset: 'guided', configVersion: 1 },
        },
      });
    return Response.json(
      { ok: false, error: { code: 'FORBIDDEN', message: 'No access' } },
      { status: 403 },
    );
  };
  const response = await handleDataHttp(
    new Request('https://lemmi.test/v1/participant/profiles/profile-alex', {
      headers: { authorization: 'Bearer private-device' },
    }),
    { kind: 'profile', profileId: 'profile-alex', participant: true },
    config,
    fetcher,
  );
  expect(response.status).toBe(200);
  expect(calls).toHaveLength(1);
  expect(calls[0]).toContain('/internal/data');
  expect(response.headers.get('cache-control')).toContain('no-store');
  const denied = await handleDataHttp(
    new Request('https://lemmi.test/v1/profiles/preview-sam', {
      headers: { authorization: 'Bearer fixture' },
    }),
    { kind: 'profile', profileId: 'preview-sam', caregiver: true },
    config,
    fetcher,
  );
  expect(denied.status).toBe(403);
  const noToken = await handleDataHttp(
    new Request('https://lemmi.test/v1/profiles/profile-alex'),
    { kind: 'profile', profileId: 'profile-alex', caregiver: true },
    config,
    fetcher,
  );
  expect(noToken.status).toBe(401);
  const cross = await handleDataHttp(
    new Request('https://lemmi.test/v1/profiles/profile-alex', {
      headers: { authorization: 'Bearer fixture', origin: 'https://foreign.test' },
    }),
    { kind: 'profile', profileId: 'profile-alex', caregiver: true },
    config,
    fetcher,
  );
  expect(cross.status).toBe(403);
});

dbtest(
  'real gateway routes share DB-backed credentials/profile/media and safe shutdown, without exposing internal routes',
  async () => {
    await reset();
    const internalToken = randomUUID(),
      publicOrigin = 'https://lemmi.test';
    const gateway = startControlGateway({
      publicOrigin,
      internalToken,
      port: 0,
      repository: repo,
      caregiverSubject: 'fixture-caregiver',
    });
    await gateway.ready;
    const base = `http://127.0.0.1:${gateway.server.port}`;
    async function internal(path: string, body: unknown, token: string = internalToken) {
      return fetch(`${base}/internal/${path}`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
    }
    try {
      const denied = await internal(
        'data',
        {
          operation: 'profile.read',
          profileId: 'profile-alex',
          caregiver: true,
          actor: 'fixture-caregiver',
        },
        'wrong',
      );
      expect(denied.status).toBe(401);
      const pair = await internal('control/pair', {
        actor: 'fixture-caregiver',
        input: { deviceId: 'stackchan-alex', profileId: 'profile-alex', commandId: randomUUID() },
      });
      const p = ((await pair.json()) as any).data;
      const claim = await internal('control/claim', {
        pairingId: p.pairingId,
        code: p.code,
        localConfirmed: true,
      });
      const credential = ((await claim.json()) as any).data.credential;
      const profile = await internal('data', {
        operation: 'profile.read',
        profileId: 'profile-alex',
        caregiver: false,
        credential,
      });
      expect(profile.status).toBe(200);
      expect(JSON.stringify(await profile.json())).not.toContain('sensitiveTopicGuidance');
      const forbidden = await internal('data', {
        operation: 'profile.read',
        profileId: 'profile-alex',
        caregiver: true,
        credential,
      });
      expect(forbidden.status).toBe(403);
      const uploaded = await internal('data', {
        operation: 'asset.create',
        input: upload(),
        actor: 'fixture-caregiver',
      });
      expect(uploaded.status).toBe(200);
      const asset = ((await uploaded.json()) as any).data;
      const bytes = await internal('data', {
        operation: 'asset.read',
        assetId: asset.id,
        bytes: true,
        credential,
      });
      expect(bytes.status).toBe(200);
      expect(Buffer.from(await bytes.arrayBuffer())).toEqual(png());
      expect(bytes.headers.get('content-type')).toBe('image/png');
      const updateResult = await internal('data', {
        operation: 'profile.update',
        input: update(0, { avatarId: 'cat' }),
        actor: 'fixture-caregiver',
      });
      expect(updateResult.status).toBe(200);
      const preview = await internal('data', {
        operation: 'profile.read',
        profileId: 'preview-sam',
        caregiver: false,
        credential,
      });
      expect(preview.status).toBe(403);
      await internal('control/revoke', {
        actor: 'fixture-caregiver',
        input: { deviceId: 'stackchan-alex', commandId: randomUUID() },
      });
      expect(
        (
          await internal('data', {
            operation: 'asset.read',
            assetId: asset.id,
            bytes: true,
            credential,
          })
        ).status,
      ).toBe(403);
    } finally {
      gateway.stop();
      await gateway.data?.close();
    }
  },
);

test('typed profile and asset clients use resource-scoped methods and do not submit GET bodies', async () => {
  const calls: { path: string; method?: string; body?: RequestInit['body'] }[] = [];
  const clients = createClients(
    createHttpTransport('live', async (path, init) => {
      calls.push({ path: String(path), method: init?.method, body: init?.body });
      return Response.json({ ok: false, error: { code: 'UNAVAILABLE', message: 'fixture' } });
    }),
  );
  await clients.profile.load({ profileId: 'profile-alex' });
  await clients.profile.detail({ profileId: 'profile-alex' });
  await clients.profile.update(update(0, { avatarId: 'bird' }) as any);
  await clients.assets.metadata({ assetId: randomUUID() });
  expect(calls[0]).toMatchObject({
    path: '/v1/participant/profiles/profile-alex',
    method: 'GET',
    body: undefined,
  });
  expect(calls[1]).toMatchObject({
    path: '/v1/profiles/profile-alex',
    method: 'GET',
    body: undefined,
  });
  expect(calls[2]?.method).toBe('PATCH');
  expect(calls[3]?.method).toBe('GET');
});

dbtest(
  'single-authority locking and database epochs reject stale processes and post-deletion checkpoints',
  async () => {
    await reset();
    const first = new PersistentData(
      repo,
      'fixture-caregiver',
      new SessionCoordinator('live'),
      Date.now,
      () => {},
    );
    await first.start();
    const independent = database(url!);
    try {
      const secondRepo = new DataRepository(independent, repo.media);
      const second = new PersistentData(
        secondRepo,
        'fixture-caregiver',
        new SessionCoordinator('live'),
        Date.now,
        () => {},
      );
      await expect(second.start()).rejects.toThrow('Only one live gateway');
      const c = new SessionCoordinator('live');
      c.acceptPersistentProfile(await repo.approvedProfile('fixture-caregiver'));
      c.handle('session.start', {
        profileId: 'profile-alex',
        commandId: 'old-session',
        endpoint: 'robot',
      });
      const snapshot = c.snapshot()!;
      const event = {
        id: randomUUID(),
        event: { type: 'session_stopped', source: 'measured_event' },
      };
      await repo.saveSession(snapshot, [event], first.devices.bootId);
      await repo.saveSession(snapshot, [event], first.devices.bootId);
      expect(await sql`SELECT * FROM lemmi.activity_events`).toHaveLength(1);
      const replacement = randomUUID();
      await repo.restart(replacement);
      await expect(repo.saveSession(snapshot, [event], first.devices.bootId)).rejects.toMatchObject(
        { code: 'REVISION_CONFLICT' },
      );
      await expect(
        first.handle(
          { operation: 'profile.update', input: update(0, { preferredName: 'obsolete' }) },
          'fixture-caregiver',
          undefined,
        ),
      ).rejects.toMatchObject({ code: 'UNAVAILABLE' });
      await sql`UPDATE lemmi.profiles SET deletion_state='deleting'`;
      await expect(repo.saveSession(snapshot, [event], replacement)).rejects.toMatchObject({
        code: 'REVISION_CONFLICT',
      });
    } finally {
      await first.close();
      await independent.close();
    }
  },
);

dbtest('revocation cancels local access immediately while SQL is blocked', async () => {
  await reset();
  const authority = new DatabaseDeviceAuthority(repo, Date.now, () => {});
  await authority.start();
  const pair = await authority.pair('fixture-caregiver', {
    deviceId: 'stackchan-alex',
    profileId: 'profile-alex',
    commandId: randomUUID(),
  });
  if (!pair.ok) throw new Error('fixture');
  const claim = await authority.claim({
    pairingId: pair.data.pairingId,
    code: pair.data.code,
    localConfirmed: true,
  });
  if (!claim.ok) throw new Error('fixture');
  const identity = await authority.authenticate(claim.data.credential);
  expect(identity).not.toBeNull();
  let unlock: () => void = () => {};
  let locked: () => void = () => {};
  const acquired = new Promise<void>((resolve) => {
    locked = resolve;
  });
  const lock = sql.begin(async (tx) => {
    await tx`SELECT 1 FROM lemmi.devices FOR UPDATE`;
    locked();
    await new Promise<void>((resolve) => {
      unlock = resolve;
    });
  });
  await acquired;
  const command = { deviceId: 'stackchan-alex', commandId: randomUUID() };
  const revoke = authority.revoke('fixture-caregiver', command);
  const duplicate = authority.revoke('fixture-caregiver', command);
  let acknowledged = false;
  void duplicate.then(() => {
    acknowledged = true;
  });
  await Bun.sleep(10);
  expect(acknowledged).toBe(false);
  expect(authority.current(identity!)).toBe(false);
  unlock();
  await lock;
  expect((await revoke).ok).toBe(true);
});

dbtest(
  'rapid Stop then new Start retains the previous terminal checkpoint while SQL is delayed',
  async () => {
    await reset();
    const internalToken = randomUUID();
    const gateway = startControlGateway({
      publicOrigin: 'https://lemmi.test',
      internalToken,
      port: 0,
      repository: repo,
      caregiverSubject: 'fixture-caregiver',
    });
    await gateway.ready;
    const pair = await gateway.data!.devices.pair('fixture-caregiver', {
      deviceId: 'stackchan-alex',
      profileId: 'profile-alex',
      commandId: randomUUID(),
    });
    if (!pair.ok) throw new Error('fixture');
    const claim = await gateway.data!.devices.claim({
      pairingId: pair.data.pairingId,
      code: pair.data.code,
      localConfirmed: true,
    });
    if (!claim.ok) throw new Error('fixture');
    const messages: any[] = [];
    const ws = new WebSocket(`ws://127.0.0.1:${gateway.server.port}/v1/device-stream`, {
      headers: {
        authorization: `Bearer ${claim.data.credential}`,
        host: 'lemmi.test',
        'x-forwarded-proto': 'https',
      },
    });
    ws.onmessage = (event) => messages.push(JSON.parse(String(event.data)));
    const until = async (predicate: () => boolean) => {
      const deadline = Date.now() + 3000;
      while (!predicate()) {
        if (Date.now() > deadline) throw new Error('Socket fixture timeout');
        await Bun.sleep(5);
      }
    };
    let sequence = 0;
    const send = (
      type: string,
      session_id: string | null = null,
      generation = 0,
      payload: unknown = {},
    ) =>
      ws.send(
        JSON.stringify({
          protocol_version: 1,
          event_id: randomUUID(),
          session_id,
          turn_id: null,
          generation,
          sequence: sequence++,
          type,
          payload,
        }),
      );
    let unlock: () => void = () => {};
    let lock: Promise<unknown> | undefined;
    try {
      await until(() => ws.readyState === WebSocket.OPEN);
      send('device.hello', null, 0, {
        firmwareVersion: 'fixture',
        cameraSupported: false,
        pettingSupported: false,
        audio: { supported: false },
      });
      await until(() => messages.some((event) => event.type === 'device.ready'));
      let locked: () => void = () => {};
      const acquired = new Promise<void>((resolve) => {
        locked = resolve;
      });
      lock = sql.begin(async (tx) => {
        await tx`SELECT 1 FROM lemmi.profiles FOR UPDATE`;
        locked();
        await new Promise<void>((resolve) => {
          unlock = resolve;
        });
      });
      await acquired;
      send('input.start');
      await until(() =>
        messages.some(
          (event) => event.type === 'state.changed' && event.payload.session?.phase === 'waiting',
        ),
      );
      const first = messages.find(
        (event) => event.type === 'state.changed' && event.payload.session?.phase === 'waiting',
      ).payload.session;
      send('input.stop', first.id, first.generation);
      send('input.start');
      await until(() =>
        messages.some(
          (event) =>
            event.type === 'state.changed' &&
            event.payload.session?.phase === 'waiting' &&
            event.payload.session.id !== first.id,
        ),
      );
      unlock();
      await lock;
      await gateway.flush();
      const rows = await sql`SELECT id,phase FROM lemmi.sessions ORDER BY started_at`;
      expect(rows).toHaveLength(2);
      expect(rows.find((row: any) => row.id === first.id)?.phase).toBe('ended');
      expect(rows.filter((row: any) => row.phase !== 'ended')).toHaveLength(1);
      expect(
        await sql`SELECT * FROM lemmi.activity_events WHERE session_id=${first.id}`,
      ).toHaveLength(1);
    } finally {
      unlock();
      await lock;
      ws.close();
      gateway.stop();
      await gateway.flush();
      await gateway.data?.close();
    }
  },
);

dbtest(
  'stale gateway pairing cannot overwrite a replacement boot or issue usable credentials',
  async () => {
    await reset();
    const old = new DatabaseDeviceAuthority(repo, Date.now, () => {});
    await old.start();
    const pending = await old.pair('fixture-caregiver', {
      deviceId: 'stackchan-alex',
      profileId: 'profile-alex',
      commandId: randomUUID(),
    });
    if (!pending.ok) throw new Error('Fixture pairing failed');
    const replacement = new DatabaseDeviceAuthority(repo, Date.now, () => {});
    await replacement.start();
    const stale = await old.claim({
      pairingId: pending.data.pairingId,
      code: pending.data.code,
      localConfirmed: true,
    });
    expect(stale.ok).toBe(false);
    const rows =
      await sql`SELECT boot_id, credential_id FROM lemmi.devices WHERE id='stackchan-alex'`;
    expect(rows[0].boot_id).toBe(replacement.bootId);
    expect(rows[0].credential_id).toBeNull();
    expect(
      (
        await old.pair('fixture-caregiver', {
          deviceId: 'stackchan-alex',
          profileId: 'profile-alex',
          commandId: randomUUID(),
        })
      ).ok,
    ).toBe(false);
    const next = await replacement.pair('fixture-caregiver', {
      deviceId: 'stackchan-alex',
      profileId: 'profile-alex',
      commandId: randomUUID(),
    });
    if (!next.ok) throw new Error('Current gateway pairing failed');
    const issued = await replacement.claim({
      pairingId: next.data.pairingId,
      code: next.data.code,
      localConfirmed: true,
    });
    expect(issued.ok).toBe(true);
    if (!issued.ok) throw new Error('Current gateway claim failed');
    expect(await replacement.authenticate(issued.data.credential)).not.toBeNull();
    expect(await old.authenticate(issued.data.credential)).toBeNull();
  },
);

dbtest(
  'fictional profiles and browser/robot enrollment remain isolated through restart and switching',
  async () => {
    await reset();
    const { SessionRegistry } = await import('@lemmi/server');
    const sessions = new SessionRegistry();
    const invalidated: string[] = [];
    const data = new PersistentData(repo, 'fixture-caregiver', sessions, Date.now, (id) => {
      if (id) invalidated.push(id);
    });
    await data.start();
    let browser: any, robot: any, other: any;
    try {
      const list = await data.demoHandle({ operation: 'profile.list' });
      expect(list.ok && list.data).toMatchObject([{ id: 'profile-alex', preferredName: 'Alex' }]);
      const created = await data.demoHandle({
        operation: 'profile.create',
        input: { preferredName: 'Taylor', avatarId: 'dog' },
      });
      if (!created.ok || !('id' in created.data)) throw new Error('create fixture');
      const id = created.data.id;
      expect(id).not.toBe('profile-alex');
      expect(id).not.toStartWith('preview-');
      expect(
        sessions
          .forProfile(id)
          .handle('session.start', { profileId: id, endpoint: 'robot', commandId: randomUUID() })
          .ok,
      ).toBe(true);
      expect(sessions.forProfile('profile-alex').snapshot()).toBeNull();
      const own = await data.demoHandle({
        operation: 'endpoint.enroll',
        profileId: 'profile-alex',
        endpoint: 'browser',
      });
      const second = await data.demoHandle({
        operation: 'endpoint.enroll',
        profileId: id,
        endpoint: 'robot',
      });
      if (!own.ok || !second.ok) throw new Error('enroll fixture');
      browser = own.data;
      robot = second.data;
      expect(browser.deviceId).not.toBe(robot.deviceId);
      expect(JSON.stringify(await sql`SELECT * FROM lemmi.devices`)).not.toContain(
        browser.credential,
      );
      const principal = await data.principal(undefined, browser.credential);
      expect((await repo.profile(principal, 'profile-alex')).id).toBe('profile-alex');
      await expect(repo.profile(principal, id)).rejects.toMatchObject({ code: 'FORBIDDEN' });
      await expect(repo.profile(principal, 'profile-alex', true)).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
      await expect(
        data.demoHandle({
          operation: 'endpoint.current',
          credential: robot.credential,
          endpoint: 'browser',
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      await expect(
        data.demoHandle({
          operation: 'endpoint.enroll',
          profileId: id,
          endpoint: 'browser',
          previousCredential: robot.credential,
          previousEndpoint: 'browser',
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      expect(await data.devices.authenticate(robot.credential)).not.toBeNull();
      await expect(
        data.demoHandle({
          operation: 'endpoint.enroll',
          profileId: 'preview-sam',
          endpoint: 'robot',
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      const privateProfile = await repo.createProfile('fixture-caregiver', {
        preferredName: 'Private fixture',
      });
      await expect(
        data.demoHandle({
          operation: 'endpoint.enroll',
          profileId: privateProfile.id,
          endpoint: 'robot',
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      expect((await repo.listProfiles('unassigned-caregiver')).length).toBe(0);
      // Reassignment rotates this endpoint only; other participant credentials remain valid.
      const changed = await data.demoHandle({
        operation: 'endpoint.enroll',
        profileId: id,
        endpoint: 'browser',
        previousCredential: browser.credential,
      });
      if (!changed.ok) throw new Error('switch fixture');
      other = changed.data;
      expect(await data.devices.authenticate(browser.credential)).toBeNull();
      expect(await data.devices.authenticate(robot.credential)).not.toBeNull();
      expect(invalidated).toContain(browser.deviceId);
      await data.checkpoint(sessions.forProfile(id).persistenceSnapshot());
    } finally {
      await data.close();
    }
    const replacementSessions = new SessionRegistry();
    const replacement = new PersistentData(
      repo,
      'fixture-caregiver',
      replacementSessions,
      Date.now,
      () => {},
    );
    await replacement.start();
    try {
      expect(await replacement.devices.authenticate(browser.credential)).toBeNull();
      expect(await replacement.devices.authenticate(robot.credential)).not.toBeNull();
      expect(await replacement.devices.authenticate(other.credential)).not.toBeNull();
      expect(replacementSessions.forProfile(robot.profileId).snapshot()).toBeNull();
      expect((await sql`SELECT phase FROM lemmi.sessions`)[0].phase).toBe('ended');
      // A durable device can be revoked before its first post-restart authentication.
      const fresh = new DatabaseDeviceAuthority(repo, Date.now, () => {});
      await fresh.start();
      expect(
        (
          await fresh.revoke('fixture-caregiver', {
            deviceId: robot.deviceId,
            commandId: 'restart-revoke',
          })
        ).ok,
      ).toBe(true);
      expect(await fresh.authenticate(robot.credential)).toBeNull();
      expect(await fresh.authenticate(other.credential)).not.toBeNull();
    } finally {
      await replacement.close();
    }
  },
);

dbtest(
  'the final admitted revocation receipt persists at capacity and restart cannot reopen enrollment',
  async () => {
    await reset();
    // Populate actual durable history so restart exercises the admission boundary.
    await sql`INSERT INTO lemmi.device_revocations(device_id,actor,command_id) SELECT 'stackchan-alex','fixture-caregiver','capacity-'||n FROM generate_series(1,9999) n`;
    const authority = new DatabaseDeviceAuthority(repo, Date.now, () => {});
    await authority.start();
    const pair = await authority.pair('fixture-caregiver', {
      deviceId: 'stackchan-alex',
      profileId: 'profile-alex',
      commandId: 'capacity-pair',
    });
    if (!pair.ok) throw new Error('Pairing before capacity must work');
    const claim = await authority.claim({
      pairingId: pair.data.pairingId,
      code: pair.data.code,
      localConfirmed: true,
    });
    if (!claim.ok) throw new Error('Claim before capacity must work');
    const command = { deviceId: 'stackchan-alex', commandId: 'last-admitted-revoke' };
    expect((await authority.revoke('fixture-caregiver', command)).ok).toBe(true);
    expect((await sql`SELECT count(*)::int AS n FROM lemmi.device_revocations`)[0].n).toBe(10000);
    expect(
      await sql`SELECT 1 FROM lemmi.device_revocations WHERE device_id='stackchan-alex' AND command_id='last-admitted-revoke'`,
    ).toHaveLength(1);
    const replacement = new DatabaseDeviceAuthority(repo, Date.now, () => {});
    await replacement.start();
    expect((await replacement.revoke('fixture-caregiver', command)).ok).toBe(true);
    expect(
      (
        await replacement.pair('fixture-caregiver', {
          deviceId: 'stackchan-alex',
          profileId: 'profile-alex',
          commandId: 'after-capacity',
        })
      ).ok,
    ).toBe(false);
    expect(await replacement.authenticate(claim.data.credential)).toBeNull();
    // Revocation remains available after capacity; receipts cannot grow without bound.
    expect(
      (
        await replacement.revoke('fixture-caregiver', {
          deviceId: 'stackchan-alex',
          commandId: 'uncached-safety-revoke',
        })
      ).ok,
    ).toBe(true);
    expect((await sql`SELECT count(*)::int AS n FROM lemmi.device_revocations`)[0].n).toBe(10000);
  },
);

dbtest(
  'deleted rehearsal profile checkpoints do not disconnect or block another profile',
  async () => {
    await reset();
    const removed = await repo.createProfile(
      'fixture-caregiver',
      { preferredName: 'Removed fictional rehearsal' },
      true,
    );
    const gateway = startControlGateway({
      publicOrigin: 'https://lemmi.test',
      internalToken: randomUUID(),
      port: 0,
      repository: repo,
      caregiverSubject: 'fixture-caregiver',
      demoEnrollment: true,
    });
    await gateway.ready;
    const sockets: WebSocket[] = [];
    async function endpoint(profileId: string) {
      const enrolled = await gateway.data!.demoHandle({
        operation: 'endpoint.enroll',
        profileId,
        endpoint: 'robot',
      });
      if (!enrolled.ok) throw new Error('enrollment fixture');
      const credential = (enrolled.data as { credential: string }).credential;
      const ws = new WebSocket(`ws://127.0.0.1:${gateway.server.port}/v1/device-stream`, {
        headers: {
          authorization: `Bearer ${credential}`,
          host: 'lemmi.test',
          'x-forwarded-proto': 'https',
        },
      });
      sockets.push(ws);
      let seq = 0;
      let snapshot: any;
      let closed = false;
      let ready = false;
      ws.onclose = () => {
        closed = true;
      };
      ws.onmessage = (e) => {
        const x = JSON.parse(String(e.data));
        if (x.type === 'device.ready') ready = true;
        if (x.type === 'state.changed') snapshot = x.payload.session;
      };
      const until = async (p: () => boolean) => {
        const end = Date.now() + 3000;
        while (!p()) {
          if (Date.now() > end || closed) throw new Error('deleted profile socket regression');
          await Bun.sleep(5);
        }
      };
      const send = (type: string, payload: unknown = {}) =>
        ws.send(
          JSON.stringify({
            protocol_version: 1,
            event_id: randomUUID(),
            session_id: type === 'input.start' ? null : (snapshot?.id ?? null),
            generation: type === 'input.start' ? 0 : (snapshot?.generation ?? 0),
            turn_id: null,
            sequence: seq++,
            type,
            payload,
          }),
        );
      await until(() => ws.readyState === WebSocket.OPEN);
      send('device.hello', {
        firmwareVersion: 'fixture',
        cameraSupported: false,
        pettingSupported: false,
        audio: { supported: false },
      });
      await until(() => ready);
      send('input.start');
      await until(() => snapshot?.phase === 'waiting');
      await gateway.flush();
      return { send, until, closed: () => closed, snapshot: () => snapshot };
    }
    try {
      await endpoint(removed.id);
      await sql`DELETE FROM lemmi.profiles WHERE id=${removed.id}`;
      const current = await endpoint('profile-alex');
      await gateway.flush();
      current.send('input.pause');
      await current.until(() => current.snapshot()?.phase === 'paused');
      await gateway.flush();
      expect(current.closed()).toBe(false);
      expect(await sql`SELECT id FROM lemmi.profiles WHERE id=${removed.id}`).toHaveLength(0);
      expect(await sql`SELECT id FROM lemmi.sessions WHERE profile_id=${removed.id}`).toHaveLength(
        0,
      );
      expect(await sql`SELECT phase FROM lemmi.sessions WHERE profile_id='profile-alex'`).toEqual([
        expect.objectContaining({ phase: 'paused' }),
      ]);
    } finally {
      for (const ws of sockets) ws.close();
      gateway.stop();
      await Bun.sleep(30);
    }
  },
);
