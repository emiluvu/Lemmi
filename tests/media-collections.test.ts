import { beforeAll, afterAll, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { database, migrate } from '@lemmi/server';

const url = process.env.LEMMI_SCHEMA_TEST_DATABASE_URL;
const dbtest = url ? test : test.skip;
let sql: ReturnType<typeof database>;
const image = randomUUID(),
  music = randomUUID(),
  secondImage = randomUUID();
const album = randomUUID(),
  playlist = randomUUID();
const digest = (s: string) => createHash('sha256').update(s).digest('hex');
beforeAll(async () => {
  if (!url) return;
  if (!new URL(url).pathname.endsWith('_schema_test'))
    throw new Error(
      'Use a fresh disposable database ending in _schema_test, separate from backend tests',
    );
  sql = database(url);
  // This explicitly selected disposable schema database is reset for migration-upgrade tests.
  await sql.unsafe(
    'DROP SCHEMA IF EXISTS lemmi CASCADE; DROP TABLE IF EXISTS public.lemmi_migrations',
  );
  const foundation = await readFile('db/migrations/001_foundation.sql', 'utf8');
  await sql.begin(async (tx) => {
    await tx.unsafe(foundation);
    await tx.unsafe(
      'CREATE TABLE public.lemmi_migrations (name text PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())',
    );
    await tx`INSERT INTO public.lemmi_migrations (name,sha256) VALUES ('001_foundation.sql',${digest(foundation)})`;
    await tx`INSERT INTO lemmi.profiles (id,preferred_name,avatar_id,communication_preset) VALUES ('profile-alex','Alex','lemming','guided')`;
    await tx`INSERT INTO lemmi.devices (id,profile_id,credential_id,credential_hash,credential_expires_at) VALUES ('stackchan-alex','profile-alex',${randomUUID()}::uuid,${'a'.repeat(64)},now()+interval '1 hour')`;
  });
});
afterAll(async () => {
  if (sql) await sql.close();
});

async function asset(id: string, kind: 'image' | 'music', profile = 'profile-alex') {
  await sql`INSERT INTO lemmi.media_assets
    (id,profile_id,storage_key,kind,media_type,byte_length,sha256,caption,entity_ids,source,permission,approved_by,profile_revision,privacy_revision,policy_revision)
    VALUES (${id}::uuid,${profile},${randomUUID()}::uuid,${kind},${kind === 'image' ? 'image/png' : 'audio/wav'},64,${'0'.repeat(64)},'Fictional metadata only','["object:kettle"]'::jsonb,'Synthetic fixture','Team fixture','fixture-caregiver',0,0,0)`;
}

dbtest(
  'media migration is atomic, upgrades a populated foundation and preserves its checksum',
  async () => {
    await asset(image, 'image');
    await asset(music, 'music');
    await asset(secondImage, 'image');
    const before = (
      await sql`SELECT sha256 FROM public.lemmi_migrations WHERE name='001_foundation.sql'`
    )[0].sha256;
    // Fail after the migration has added its FK key and created album tables.
    await sql.unsafe('CREATE TABLE lemmi.music_tracks (dummy boolean)');
    await expect(migrate(sql)).rejects.toThrow();
    expect((await sql`SELECT to_regclass('lemmi.albums') AS table_name`)[0].table_name).toBeNull();
    expect(
      (
        await sql`SELECT count(*)::int AS n FROM pg_constraint WHERE conname='media_assets_profile_kind_key'`
      )[0].n,
    ).toBe(0);
    expect((await sql`SELECT count(*)::int AS n FROM public.lemmi_migrations`)[0].n).toBe(1);
    await sql.unsafe('DROP TABLE lemmi.music_tracks');
    await migrate(sql);
    await migrate(sql);
    expect(
      (await sql`SELECT name FROM public.lemmi_migrations ORDER BY name`).map(
        (r: { name: string }) => r.name,
      ),
    ).toEqual([
      '001_foundation.sql',
      '002_media_collections.sql',
      '002_multi_profile_endpoints.sql',
      '003_communication_support.sql',
      '003_persistent_device_credentials.sql',
      '004_endpoint_revocations.sql',
      '005_conversation_redirects.sql',
      '006_profile_context_memory.sql',
    ]);
    expect(
      (await sql`SELECT sha256 FROM public.lemmi_migrations WHERE name='001_foundation.sql'`)[0]
        .sha256,
    ).toBe(before);
    expect((await sql`SELECT count(*)::int AS n FROM lemmi.media_assets`)[0].n).toBe(3);
    expect(
      (
        await sql`SELECT credential_persistent,credential_expires_at IS NOT NULL AS has_expiry FROM lemmi.devices`
      )[0],
    ).toMatchObject({ credential_persistent: false, has_expiry: true });
    expect(
      (await sql`SELECT excerpt_saving_enabled,remembering_enabled FROM lemmi.profiles`)[0],
    ).toMatchObject({ excerpt_saving_enabled: false, remembering_enabled: false });
    await sql`INSERT INTO lemmi.albums (id,profile_id,title,collection_kind) VALUES (${album}::uuid,'profile-alex','Fictional album','album')`;
    await sql`INSERT INTO lemmi.playlists (id,profile_id,title) VALUES (${playlist}::uuid,'profile-alex','Fictional playlist')`;
  },
);

dbtest(
  'same-profile foreign keys reject media type confusion and duplicate membership/positions',
  async () => {
    await expect(sql`INSERT INTO lemmi.album_photos (id,profile_id,album_id,asset_id,position)
    VALUES (${randomUUID()}::uuid,'profile-alex',${album}::uuid,${music}::uuid,0)`).rejects.toThrow();
    await expect(sql`INSERT INTO lemmi.music_tracks (profile_id,asset_id,title,duration_ms)
    VALUES ('profile-alex',${image}::uuid,'Wrong kind',1000)`).rejects.toThrow();
    await sql`INSERT INTO lemmi.album_photos (id,profile_id,album_id,asset_id,position)
    VALUES (${randomUUID()}::uuid,'profile-alex',${album}::uuid,${image}::uuid,0)`;
    await expect(sql`INSERT INTO lemmi.album_photos (id,profile_id,album_id,asset_id,position)
    VALUES (${randomUUID()}::uuid,'profile-alex',${album}::uuid,${image}::uuid,1)`).rejects.toThrow();
    await expect(sql`INSERT INTO lemmi.album_photos (id,profile_id,album_id,asset_id,position)
    VALUES (${randomUUID()}::uuid,'profile-alex',${album}::uuid,${secondImage}::uuid,0)`).rejects.toThrow();
    await sql`INSERT INTO lemmi.music_tracks (profile_id,asset_id,title,duration_ms)
    VALUES ('profile-alex',${music}::uuid,'Fictional track',1000)`;
    await sql`INSERT INTO lemmi.playlist_tracks (id,profile_id,playlist_id,asset_id,position)
    VALUES (${randomUUID()}::uuid,'profile-alex',${playlist}::uuid,${music}::uuid,0)`;
    await expect(sql`INSERT INTO lemmi.playlist_tracks (id,profile_id,playlist_id,asset_id,position)
    VALUES (${randomUUID()}::uuid,'profile-alex',${playlist}::uuid,${image}::uuid,1)`).rejects.toThrow();
  },
);

dbtest('metadata bounds match activity limits and positions cap membership at twenty', async () => {
  await expect(sql`INSERT INTO lemmi.albums (id,profile_id,title,collection_kind)
    VALUES (${randomUUID()}::uuid,'profile-alex','   ','album')`).rejects.toThrow();
  await expect(
    sql`UPDATE lemmi.music_tracks SET title=${'x'.repeat(101)} WHERE asset_id=${music}::uuid`,
  ).rejects.toThrow();
  await expect(
    sql`UPDATE lemmi.playlists SET title=${' '.repeat(100) + 'x'} WHERE id=${playlist}::uuid`,
  ).rejects.toThrow();
  await expect(
    sql`UPDATE lemmi.music_tracks SET duration_ms=300001 WHERE asset_id=${music}::uuid`,
  ).rejects.toThrow();
  await expect(
    sql`UPDATE lemmi.album_photos SET position=20 WHERE album_id=${album}::uuid`,
  ).rejects.toThrow();
  await expect(
    sql`UPDATE lemmi.playlist_tracks SET position=-1 WHERE playlist_id=${playlist}::uuid`,
  ).rejects.toThrow();
});

dbtest(
  'deferred ordering swaps positions without changing stable entry IDs or duplicating context',
  async () => {
    await sql`INSERT INTO lemmi.album_photos (id,profile_id,album_id,asset_id,position)
    VALUES (${randomUUID()}::uuid,'profile-alex',${album}::uuid,${secondImage}::uuid,1)`;
    const before = await sql`SELECT id,asset_id,position FROM lemmi.album_photos ORDER BY position`;
    await sql.begin(async (tx) => {
      await tx.unsafe('SET CONSTRAINTS lemmi.album_photo_position DEFERRED');
      await tx`UPDATE lemmi.album_photos SET position=1-position WHERE album_id=${album}::uuid`;
    });
    const after = await sql`SELECT id,asset_id,position FROM lemmi.album_photos ORDER BY position`;
    expect(after[0].id).toBe(before[1].id);
    expect(after[1].id).toBe(before[0].id);
    expect(after[0].asset_id).toBe(before[1].asset_id);
    await expect(
      sql.begin(async (tx) => {
        await tx.unsafe('SET CONSTRAINTS lemmi.album_photo_position DEFERRED');
        await tx`UPDATE lemmi.album_photos SET position=0 WHERE album_id=${album}::uuid`;
      }),
    ).rejects.toThrow();
    expect(
      (await sql`SELECT position FROM lemmi.album_photos ORDER BY position`).map(
        (r: { position: number }) => r.position,
      ),
    ).toEqual([0, 1]);
    const columns = (
      await sql`SELECT column_name FROM information_schema.columns WHERE table_schema='lemmi' AND table_name='album_photos'`
    ).map((r: { column_name: string }) => r.column_name);
    expect(columns).not.toContain('discussion_context');
    expect(columns).not.toContain('caption');
  },
);

dbtest(
  'isolated foreign-profile fixtures cannot link media and do not enable a second live profile',
  async () => {
    await sql.begin(async (tx) => {
      // Authorization fixture only: temporarily relax and restore the one-profile CHECK.
      await tx.unsafe('ALTER TABLE lemmi.profiles DROP CONSTRAINT profiles_id_check');
      await tx`INSERT INTO lemmi.profiles (id,preferred_name,avatar_id,communication_preset)
      VALUES ('scope-fixture','Fictional scope fixture','cat','quiet')`;
      const foreign = randomUUID();
      await tx`INSERT INTO lemmi.albums (id,profile_id,title,collection_kind)
      VALUES (${foreign}::uuid,'scope-fixture','Other scope','album')`;
      const save = tx.savepoint(async (sp) => {
        await sp`INSERT INTO lemmi.album_photos (id,profile_id,album_id,asset_id,position)
        VALUES (${randomUUID()}::uuid,'scope-fixture',${foreign}::uuid,${image}::uuid,0)`;
      });
      await expect(save).rejects.toThrow();
      // Restore one-profile constraint by removing the ephemeral fixture in the same transaction.
      await tx`DELETE FROM lemmi.profiles WHERE id='scope-fixture'`;
      await tx.unsafe(
        "ALTER TABLE lemmi.profiles ADD CONSTRAINT profiles_id_check CHECK (id='profile-alex')",
      );
    });
    expect((await sql`SELECT id FROM lemmi.profiles`).map((r: { id: string }) => r.id)).toEqual([
      'profile-alex',
    ]);
  },
);

dbtest(
  'asset/profile cleanup cascades metadata without deleting unrelated assets or enabling draft features',
  async () => {
    await sql`DELETE FROM lemmi.media_assets WHERE id=${image}::uuid`;
    expect((await sql`SELECT count(*)::int AS n FROM lemmi.album_photos`)[0].n).toBe(1);
    expect((await sql`SELECT count(*)::int AS n FROM lemmi.media_assets`)[0].n).toBe(2);
    const permissions =
      await sql`SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='lemmi' AND c.relname IN ('albums','album_photos','music_tracks','playlists','playlist_tracks')
    AND EXISTS (SELECT 1 FROM aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) x WHERE x.grantee=0)`;
    expect(permissions).toHaveLength(0);
    for (const table of [
      'journal_sources',
      'summaries',
      'jobs',
      'deletion_jobs',
      'camera_access_events',
    ])
      expect((await sql`SELECT to_regclass(${'lemmi.' + table}) AS name`)[0].name).toBeNull();
    await sql`DELETE FROM lemmi.profiles WHERE id='profile-alex'`;
    for (const table of [
      'albums',
      'album_photos',
      'music_tracks',
      'playlists',
      'playlist_tracks',
      'media_assets',
    ]) {
      const rows = await sql.unsafe('SELECT count(*)::int AS n FROM lemmi.' + table);
      expect(rows[0].n).toBe(0);
    }
  },
);
