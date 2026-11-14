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
  'device issuance is committed as hashes, revoke retries spare replacements and restart requires re-pairing',
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
    expect(await restart.authenticate(c2.data.credential)).toBeNull();
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
      expect(preview.status).toBe(400);
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
    await tx`SELECT 1 FROM lemmi.profiles FOR UPDATE`;
    locked();
    await new Promise<void>((resolve) => {
      unlock = resolve;
    });
  });
  await acquired;
  const revoke = authority.revoke('fixture-caregiver', {
    deviceId: 'stackchan-alex',
    commandId: randomUUID(),
  });
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
          (event) => event.type === 'state.changed' && event.payload.session?.phase === 'ready',
        ),
      );
      const first = messages.find(
        (event) => event.type === 'state.changed' && event.payload.session?.phase === 'ready',
      ).payload.session;
      send('input.stop', first.id, first.generation);
      send('input.start');
      await until(() =>
        messages.some(
          (event) =>
            event.type === 'state.changed' &&
            event.payload.session?.phase === 'ready' &&
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
