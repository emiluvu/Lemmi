import { database, migrate, PrivateMedia, DataRepository, dataConfig } from '@lemmi/server';
import { fillDemoContext } from '../packages/server/src/profile-context';
const command = process.argv[2];
if (command !== 'migrate' && command !== 'bootstrap' && command !== 'fill-demo-context')
  throw new Error('Use: bun scripts/database.ts migrate|bootstrap|fill-demo-context');
const config = dataConfig();
if (!config)
  throw new Error(
    'Set LEMMI_DATABASE_URL, LEMMI_PRIVATE_MEDIA_DIR and LEMMI_CAREGIVER_SUBJECT privately',
  );
const sql = database(config.url);
try {
  await migrate(sql);
  if (command === 'bootstrap')
    await new DataRepository(sql, await PrivateMedia.create(config.mediaDirectory)).bootstrap(
      config.subject,
    );
  if (command === 'fill-demo-context') {
    // Offline maintenance only: do not bypass the running session authority.
    const lock = await sql.reserve();
    try {
      const acquired = await lock`SELECT pg_try_advisory_lock(1437236102) AS acquired`;
      if (!acquired[0].acquired) throw new Error('Stop the gateway before demo maintenance');
      const repository = new DataRepository(sql, await PrivateMedia.create(config.mediaDirectory));
      for (const profile of await repository.listProfiles(config.subject, true)) {
        const current = await repository.approvedProfile(config.subject, profile.id);
        const context = fillDemoContext(current.context!);
        if (JSON.stringify(context) === JSON.stringify(current.context)) continue;
        await repository.update(
          { kind: 'caregiver', subject: config.subject, profileId: profile.id },
          {
            profileId: profile.id,
            expectedRevision: profile.revision,
            commandId: crypto.randomUUID(),
            patch: { context },
          },
          () => {},
          true,
        );
      }
    } finally {
      await lock`SELECT pg_advisory_unlock(1437236102)`;
      lock.release();
    }
  }
  console.info(
    command === 'bootstrap'
      ? 'Lemmi schema and fictional Alex assignment ready.'
      : command === 'fill-demo-context'
        ? 'Missing fictional demo details filled; existing values and permissions preserved.'
        : 'Lemmi migrations verified/applied.',
  );
} catch {
  // SQL errors can contain values/connection details: never print them.
  console.error(
    'Database setup failed. Check private configuration, server readiness and migration compatibility.',
  );
  process.exitCode = 1;
} finally {
  await sql.close();
}
