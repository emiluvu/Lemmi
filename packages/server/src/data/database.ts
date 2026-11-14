import { SQL, type TransactionSQL } from 'bun';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export function database(url: string) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid PostgreSQL URL configuration');
  }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol))
    throw new Error('PostgreSQL URL required');
  // Private/local server by default. Remote hosts need certificate-verified TLS.
  if (
    !['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname) &&
    parsed.searchParams.get('sslmode') !== 'verify-full'
  )
    throw new Error('Remote PostgreSQL requires sslmode=verify-full');
  return new SQL(url, {
    max: 4,
    connectionTimeout: 3,
    idleTimeout: 10,
    connection: { application_name: 'lemmi', statement_timeout: '5000', lock_timeout: '3000' },
  });
}
export async function assertPrivateDatabaseLogging(sql: SQL | TransactionSQL) {
  const required: Record<string, string> = {
    log_statement: 'none',
    log_min_error_statement: 'panic',
    log_parameter_max_length: '0',
    log_parameter_max_length_on_error: '0',
    log_error_verbosity: 'terse',
    log_duration: 'off',
    log_min_duration_statement: '-1',
  };
  const settings =
    await sql`SELECT name, setting FROM pg_settings WHERE name IN ('log_statement','log_min_error_statement','log_parameter_max_length','log_parameter_max_length_on_error','log_error_verbosity','log_duration','log_min_duration_statement')`;
  if (
    settings.length !== Object.keys(required).length ||
    settings.some((row: { name: string; setting: string }) => required[row.name] !== row.setting)
  )
    throw new Error('PostgreSQL private logging settings are required; see db/README.md');
}
export async function migrate(sql: SQL) {
  await assertPrivateDatabaseLogging(sql);
  const directory = fileURLToPath(new URL('../../../../db/migrations/', import.meta.url));
  await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(1437236101)`;
    await tx`CREATE TABLE IF NOT EXISTS public.lemmi_migrations (name text PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`;
    for (const name of (await readdir(directory))
      .filter((name) => /^\d+_[a-z_]+\.sql$/.test(name))
      .sort()) {
      const content = await readFile(`${directory}/${name}`, 'utf8');
      const digest = createHash('sha256').update(content).digest('hex');
      const previous = await tx`SELECT sha256 FROM public.lemmi_migrations WHERE name=${name}`;
      if (previous.length) {
        if (previous[0].sha256 !== digest) throw new Error('Applied migration checksum mismatch');
        continue;
      }
      await tx.unsafe(content);
      await tx`INSERT INTO public.lemmi_migrations (name,sha256) VALUES (${name},${digest})`;
    }
  });
}
