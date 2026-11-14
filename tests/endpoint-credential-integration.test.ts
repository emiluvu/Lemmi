import { beforeAll, afterAll, test, expect } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  database,
  migrate,
  PrivateMedia,
  DataRepository,
  DatabaseDeviceAuthority,
  SessionCoordinator,
  sha256,
} from '@lemmi/server';

const url = process.env.LEMMI_ENDPOINT_TEST_DATABASE_URL ?? process.env.LEMMI_TEST_DATABASE_URL;
const dbtest = url ? test : test.skip;
let sql: ReturnType<typeof database>, repo: DataRepository, root: string;
beforeAll(async () => {
  if (!url) return;
  if (!new URL(url).pathname.endsWith('_test'))
    throw new Error('Disposable credential integration database required');
  sql = database(url);
  await migrate(sql);
  root = await mkdtemp(join(tmpdir(), 'lemmi-endpoint-keys-'));
  repo = new DataRepository(sql, await PrivateMedia.create(root));
});
afterAll(async () => {
  if (sql) await sql.close();
  if (root) await rm(root, { recursive: true, force: true });
});
async function reset() {
  await sql`TRUNCATE lemmi.profiles CASCADE`;
  await repo.bootstrap('credential-fixture');
}
async function key(authority: DatabaseDeviceAuthority) {
  const pairing = await authority.pair('credential-fixture', {
    deviceId: 'stackchan-alex',
    profileId: 'profile-alex',
    commandId: randomUUID(),
    credentialMode: 'persistent',
  });
  if (!pairing.ok) throw new Error('Fixture persistent pairing failed');
  const claim = await authority.claim({
    pairingId: pairing.data.pairingId,
    code: pairing.data.code,
    localConfirmed: true,
  });
  if (!claim.ok) throw new Error('Fixture persistent claim failed');
  expect(claim.data.expiresAt).toBeNull();
  return claim.data.credential;
}

dbtest(
  'endpoint integration retains persistent keys, hashes and capture-off restart while fencing old authorities',
  async () => {
    await reset();
    let now = Date.now();
    const old = new DatabaseDeviceAuthority(
      repo,
      () => now,
      () => {},
    );
    await old.start();
    const credential = await key(old);
    const initial = (await old.authenticate(credential))!;
    const coordinator = new SessionCoordinator('live');
    coordinator.handle('session.start', {
      profileId: 'profile-alex',
      endpoint: 'robot',
      commandId: randomUUID(),
    });
    await repo.saveSession(coordinator.snapshot()!, [], old.bootId);
    const stored = JSON.stringify(await sql`SELECT * FROM lemmi.devices`);
    expect(stored).not.toContain(credential);
    expect(stored).toContain(sha256(credential));
    const next = new DatabaseDeviceAuthority(
      repo,
      () => now,
      () => {},
    );
    await next.start();
    now += 365 * 24 * 60 * 60_000;
    expect((await next.authenticate(credential))?.credentialId).toBe(initial.credentialId);
    expect((await next.authenticate(credential))?.expiresAt).toBeNull();
    expect(await next.verifyCurrent()).toBe(true);
    expect(await old.authenticate(credential)).toBeNull();
    expect((await sql`SELECT phase FROM lemmi.sessions`)[0].phase).toBe('ended');
    expect(
      (
        await old.revoke('credential-fixture', {
          deviceId: 'stackchan-alex',
          commandId: randomUUID(),
        })
      ).ok,
    ).toBe(false);
    expect(await next.authenticate(credential)).not.toBeNull();
    expect(
      (
        await next.pair('credential-fixture', {
          deviceId: 'stackchan-alex',
          profileId: 'profile-alex',
          commandId: randomUUID(),
          credentialMode: 'persistent',
        })
      ).ok,
    ).toBe(false);
  },
);

dbtest(
  'endpoint revoke receipts preserve replacement keys and stale pending claims cannot seize ownership',
  async () => {
    await reset();
    const old = new DatabaseDeviceAuthority(repo, Date.now, () => {});
    await old.start();
    const pending = await old.pair('credential-fixture', {
      deviceId: 'stackchan-alex',
      profileId: 'profile-alex',
      commandId: randomUUID(),
      credentialMode: 'persistent',
    });
    if (!pending.ok) throw new Error('Fixture pending pairing failed');
    const replacement = new DatabaseDeviceAuthority(repo, Date.now, () => {});
    await replacement.start();
    expect(
      (
        await old.claim({
          pairingId: pending.data.pairingId,
          code: pending.data.code,
          localConfirmed: true,
        })
      ).ok,
    ).toBe(false);
    const original = await key(replacement);
    const revoke = { deviceId: 'stackchan-alex', commandId: randomUUID() };
    expect((await replacement.revoke('credential-fixture', revoke)).ok).toBe(true);
    const current = new DatabaseDeviceAuthority(repo, Date.now, () => {});
    await current.start();
    expect(await current.authenticate(original)).toBeNull();
    const nextKey = await key(current);
    const reboot = new DatabaseDeviceAuthority(repo, Date.now, () => {});
    await reboot.start();
    expect((await reboot.revoke('credential-fixture', revoke)).ok).toBe(true);
    expect(await reboot.authenticate(nextKey)).not.toBeNull();
    await sql`DELETE FROM lemmi.profiles WHERE id='profile-alex'`;
    expect(await reboot.authenticate(nextKey)).toBeNull();
    await repo.bootstrap('credential-fixture');
    const fresh = new DatabaseDeviceAuthority(repo, Date.now, () => {});
    await fresh.start();
    expect(await fresh.authenticate(nextKey)).toBeNull();
  },
);

dbtest(
  'persistent claims recheck caregiver membership and preserve null-expiry database shape',
  async () => {
    await reset();
    const authority = new DatabaseDeviceAuthority(repo, Date.now, () => {});
    await authority.start();
    await expect(sql`UPDATE lemmi.devices SET credential_persistent=true`).rejects.toThrow();
    const pairing = await authority.pair('credential-fixture', {
      deviceId: 'stackchan-alex',
      profileId: 'profile-alex',
      commandId: randomUUID(),
      credentialMode: 'persistent',
    });
    if (!pairing.ok) throw new Error('Fixture pairing failed');
    await sql`DELETE FROM lemmi.profile_access WHERE profile_id='profile-alex'`;
    expect(
      (
        await authority.claim({
          pairingId: pairing.data.pairingId,
          code: pairing.data.code,
          localConfirmed: true,
        })
      ).ok,
    ).toBe(false);
    expect((await sql`SELECT credential_id FROM lemmi.devices`)[0].credential_id).toBeNull();
  },
);

dbtest(
  'receipt upgrade copies legacy retry identities without deleting active persistent hashes',
  async () => {
    await reset();
    const first = new DatabaseDeviceAuthority(repo, Date.now, () => {});
    await first.start();
    const currentKey = await key(first);
    const commandId = randomUUID();
    // Rehearse the actual 004 SQL in a rollback-only transaction on populated state.
    const migration = await readFile('db/migrations/004_endpoint_revocations.sql', 'utf8');
    const rollback = new Error('fixture rollback');
    await expect(
      sql.begin(async (tx) => {
        await tx`DROP TABLE lemmi.device_revocations`;
        await tx`ALTER TABLE lemmi.legacy_device_revocations RENAME TO device_revocations`;
        await tx`INSERT INTO lemmi.device_revocations(profile_id,subject,command_id) VALUES ('profile-alex','credential-fixture',${commandId})`;
        await tx.unsafe(migration);
        const receipts =
          await tx`SELECT actor,device_id FROM lemmi.device_revocations WHERE command_id=${commandId}`;
        expect(receipts[0].actor).toBe('credential-fixture');
        expect(receipts[0].device_id).toBe('stackchan-alex');
        const device =
          await tx`SELECT credential_hash,credential_persistent FROM lemmi.devices WHERE id='stackchan-alex'`;
        expect(device[0].credential_hash).toBe(sha256(currentKey));
        expect(device[0].credential_persistent).toBe(true);
        throw rollback;
      }),
    ).rejects.toBe(rollback);
    // Insert a migrated retry identity and prove boot restoration will not revoke
    // the already-active replacement whose raw key is not present in old history.
    await sql`INSERT INTO lemmi.device_revocations(device_id,actor,command_id) VALUES ('stackchan-alex','credential-fixture',${commandId})`;
    const next = new DatabaseDeviceAuthority(repo, Date.now, () => {});
    await next.start();
    expect(
      (await next.revoke('credential-fixture', { deviceId: 'stackchan-alex', commandId })).ok,
    ).toBe(true);
    expect(await next.authenticate(currentKey)).not.toBeNull();
  },
);
