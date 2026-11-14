import { database, migrate, PrivateMedia, DataRepository, dataConfig } from '@lemmi/server';
const command = process.argv[2];
if (command !== 'migrate' && command !== 'bootstrap')
  throw new Error('Use: bun scripts/database.ts migrate|bootstrap');
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
  console.info(
    command === 'bootstrap'
      ? 'Lemmi schema and fictional Alex assignment ready.'
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
