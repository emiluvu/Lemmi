import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { database } from '@lemmi/server';

// Diagnostic of a historical proposal, not acceptance tests for active behavior.
// This explicitly selected database is reset; never point it at shared data.
const url = process.env.LEMMI_REVIEW_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_review_test')) {
  throw new Error(
    'Select a disposable database ending in _review_test with LEMMI_REVIEW_DATABASE_URL',
  );
}
const pool = database(url);
const sql = await pool.reserve();
try {
  await sql.unsafe('DROP SCHEMA IF EXISTS lemmi CASCADE');
  await sql.unsafe(await readFile('db/migrations/001_foundation.sql', 'utf8'));
  await sql.unsafe(await readFile('db/proposals/002_app_data.sql', 'utf8'));
  await sql`INSERT INTO lemmi.profiles (id,preferred_name,avatar_id,communication_preset)
    VALUES ('profile-alex','Alex','lemming','guided')`;
  await sql`INSERT INTO lemmi.sessions
    (id,profile_id,generation,phase,profile_revision,privacy_revision,policy_revision,endpoint,lease_id)
    VALUES ('proposal-fixture','profile-alex',0,'waiting',0,0,0,'browser','fixture-lease')`;
  const source = randomUUID(),
    summary = randomUUID();
  // Fictional markers only. Neither text nor database credentials are reported.
  await sql`INSERT INTO lemmi.journal_sources
    (id,profile_id,session_id,source_type,text_value,recognition_uncertain,saved_privacy_revision,saved_generation)
    VALUES (${source}::uuid,'profile-alex','proposal-fixture','participant_excerpt','Fictional review marker',false,0,0)`;
  const excerptWithoutGrant =
    (await sql`SELECT count(*)::int AS n FROM lemmi.journal_sources`)[0].n === 1 &&
    (await sql`SELECT count(*)::int AS n FROM lemmi.session_excerpt_permissions`)[0].n === 0;
  const permissionsOff = (
    await sql`SELECT NOT excerpt_saving_enabled AND NOT remembering_enabled AS off FROM lemmi.profiles`
  )[0].off;
  await sql`INSERT INTO lemmi.summaries
    (id,profile_id,session_id,text_value,model_id,policy_version,profile_revision,privacy_revision,policy_revision)
    VALUES (${summary}::uuid,'profile-alex','proposal-fixture','Fictional dependent marker','fixture','fixture',0,0,0)`;
  await sql`INSERT INTO lemmi.summary_sources (profile_id,session_id,summary_id,source_id,source_revision)
    VALUES ('profile-alex','proposal-fixture',${summary}::uuid,${source}::uuid,0)`;
  await sql`DELETE FROM lemmi.journal_sources WHERE id=${source}::uuid`;
  const orphanSummary =
    (await sql`SELECT count(*)::int AS n FROM lemmi.summaries`)[0].n === 1 &&
    (await sql`SELECT count(*)::int AS n FROM lemmi.summary_sources`)[0].n === 0;
  await sql`INSERT INTO lemmi.content_entities (id,kind,label)
    VALUES ('object:fixture-a','object','Fixture A'),('object:fixture-b','object','Fixture B')`;
  await sql`INSERT INTO lemmi.content_entity_aliases (alias_id,canonical_id)
    VALUES ('object:fixture-a','object:fixture-b')`;
  const aliasCollision =
    (
      await sql`SELECT count(*)::int AS n FROM lemmi.content_entity_aliases a
    JOIN lemmi.content_entities c ON c.id=a.alias_id`
    )[0].n === 1;
  await sql`INSERT INTO lemmi.help_requests
    (id,profile_id,mode,trigger_kind,routing_revision,state,backup_due_at,no_response_due_at,expires_at)
    VALUES (${randomUUID()}::uuid,'profile-alex','simulation','manual',0,'acknowledged',now(),now(),now())`;
  const ackWithoutActor =
    (
      await sql`SELECT count(*)::int AS n FROM lemmi.help_requests
    WHERE state='acknowledged' AND acknowledged_by_subject IS NULL`
    )[0].n === 1;
  console.log(
    JSON.stringify(
      {
        proposalCommit: '4e8993f16e7919b70920ef538f7d9394f662eb24',
        draftApplied: true,
        profilePermissionsRemainOff: permissionsOff,
        observedMissingGuards: {
          excerptInsertedWithoutSessionGrant: excerptWithoutGrant,
          dependentSummarySurvivedSourceDeletion: orphanSummary,
          canonicalIdAlsoAcceptedAsDifferentAlias: aliasCollision,
          acknowledgedStateAcceptedWithoutActor: ackWithoutActor,
        },
        activeMigrationAcceptance: false,
      },
      null,
      2,
    ),
  );
} finally {
  await sql.unsafe('DROP SCHEMA IF EXISTS lemmi CASCADE');
  sql.release();
  await pool.close();
}
