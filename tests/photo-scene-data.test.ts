import { beforeAll, afterAll, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import {
  database,
  migrate,
  PrivateMedia,
  DataRepository,
  DatabaseDeviceAuthority,
  type DataPrincipal,
} from '@lemmi/server';

const url = process.env.LEMMI_TEST_DATABASE_URL;
const dbtest = url ? test : test.skip;
const caregiver: DataPrincipal = {
  kind: 'caregiver',
  subject: 'photo-scene-fixture',
  profileId: 'profile-alex',
};
let sql: ReturnType<typeof database>, repo: DataRepository, root: string;
beforeAll(async () => {
  if (!url) return;
  if (!new URL(url).pathname.endsWith('_test'))
    throw new Error('Disposable test database required');
  sql = database(url);
  await migrate(sql);
  root = await mkdtemp(join(tmpdir(), 'lemmi-photo-scene-data-'));
  repo = new DataRepository(sql, await PrivateMedia.create(root));
});
afterAll(async () => {
  if (sql) await sql.close();
  if (root) await rm(root, { recursive: true, force: true });
});
function png() {
  const chunk = (type: string, data: Buffer) => {
    const bytes = Buffer.alloc(data.length + 12);
    bytes.writeUInt32BE(data.length);
    bytes.write(type, 4);
    data.copy(bytes, 8);
    let crc = 0xffffffff;
    for (const byte of bytes.subarray(4, -4)) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    bytes.writeUInt32BE((crc ^ 0xffffffff) >>> 0, bytes.length - 4);
    return bytes;
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
async function fixture() {
  await sql`TRUNCATE lemmi.profiles CASCADE`;
  await repo.bootstrap('photo-scene-fixture');
  const authority = new DatabaseDeviceAuthority(repo, Date.now, () => {});
  await authority.start();
  const pairing = await authority.pair('photo-scene-fixture', {
    profileId: 'profile-alex',
    deviceId: 'stackchan-alex',
    commandId: randomUUID(),
    credentialMode: 'persistent',
  });
  if (!pairing.ok) throw new Error('Fixture pairing failed');
  const claim = await authority.claim({
    pairingId: pairing.data.pairingId,
    code: pairing.data.code,
    localConfirmed: true,
  });
  if (!claim.ok) throw new Error('Fixture claim failed');
  const identity = await authority.authenticate(claim.data.credential);
  if (!identity) throw new Error('Fixture authentication failed');
  const asset = await repo.createAsset(
    caregiver,
    {
      profileId: 'profile-alex',
      commandId: randomUUID(),
      expectedRevision: 0,
      kind: 'image',
      mediaType: 'image/png',
      source: 'Generated fictional pixel',
      permission: 'Team fixture',
      caption: 'Fictional test picture',
      discussionContext: 'Approved fixture only',
      entityIds: ['profile:approved-photo'],
      approved: true,
      dataBase64: png().toString('base64'),
    },
    true,
  );
  const profile = await repo.update(
    caregiver,
    {
      profileId: 'profile-alex',
      commandId: randomUUID(),
      expectedRevision: 0,
      patch: {
        context: {
          photos: [{ assetId: asset.id, description: 'A fictional pixel.', portrait: false }],
        },
      },
    },
    () => {},
    true,
  );
  const principal: DataPrincipal = {
    kind: 'participant',
    profileId: 'profile-alex',
    deviceId: identity.deviceId,
    credentialId: identity.credentialId,
    bootId: authority.bootId,
  };
  return {
    asset,
    principal,
    token: {
      profileRevision: profile.revision,
      privacyRevision: profile.privacyRevision,
      policyRevision: profile.policyRevision,
    },
  };
}

dbtest('private photo repository rejects stale scene revisions before reading media', async () => {
  const f = await fixture();
  const read = repo.media.read.bind(repo.media);
  let reads = 0;
  repo.media.read = async (...args) => {
    reads++;
    return read(...args);
  };
  try {
    for (const field of ['profileRevision', 'privacyRevision', 'policyRevision'] as const) {
      await expect(
        repo.asset(f.principal, f.asset.id, true, true, {
          token: { ...f.token, [field]: f.token[field] + 1 },
          current: () => true,
        }),
      ).rejects.toMatchObject({ code: 'REVISION_CONFLICT' });
    }
    expect(reads).toBe(0);
    const allowed = await repo.asset(f.principal, f.asset.id, true, true, {
      token: f.token,
      current: () => true,
    });
    expect(allowed.bytes).toEqual(png());
    expect(reads).toBe(1);
  } finally {
    repo.media.read = read;
  }
});

dbtest(
  'private photo repository rejects a replaced gateway epoch before reading media',
  async () => {
    const f = await fixture();
    await sql`UPDATE lemmi.gateway_state SET boot_id=${randomUUID()}::uuid WHERE singleton`;
    const read = repo.media.read.bind(repo.media);
    let reads = 0;
    repo.media.read = async (...args) => {
      reads++;
      return read(...args);
    };
    try {
      await expect(
        repo.asset(f.principal, f.asset.id, true, true, { token: f.token, current: () => true }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      expect(reads).toBe(0);
    } finally {
      repo.media.read = read;
    }
  },
);

dbtest(
  'private photo repository cancels and wipes bytes when scene authority changes during read',
  async () => {
    const f = await fixture();
    const read = repo.media.read.bind(repo.media);
    const entered = Promise.withResolvers<void>(),
      release = Promise.withResolvers<void>();
    let current = true,
      captured: Uint8Array | undefined;
    repo.media.read = async (...args) => {
      const bytes = await read(...args);
      captured = bytes;
      entered.resolve();
      await release.promise;
      return bytes;
    };
    try {
      const pending = repo.asset(f.principal, f.asset.id, true, true, {
        token: f.token,
        current: () => current,
      });
      await entered.promise;
      current = false;
      release.resolve();
      await expect(pending).rejects.toMatchObject({ code: 'REVISION_CONFLICT' });
      expect(captured!.byteLength).toBeGreaterThan(0);
      expect(captured!.every((byte) => byte === 0)).toBe(true);
    } finally {
      release.resolve();
      repo.media.read = read;
    }
  },
);
