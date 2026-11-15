import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fail } from '@lemmi/contracts';
import {
  database,
  migrate,
  PrivateMedia,
  DataRepository,
  telegramConfig,
  createTelegramSender,
  TelegramContactService,
  SessionCoordinator,
  conversationDecisionConfig,
  createOpenRouterConcernAdapter,
} from '@lemmi/server';

// This command really sends one fictional alert. It never uses the deployment DB.
const url = process.env.LEMMI_CONTACT_SMOKE_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_smoke_contact_test'))
  throw new Error('Use a dedicated disposable database ending in _smoke_contact_test');
if (process.env.LEMMI_TELEGRAM_SMOKE_SEND !== '1')
  throw new Error('Set LEMMI_TELEGRAM_SMOKE_SEND=1 to authorize one real fictional alert');
const trigger = process.env.LEMMI_CONTACT_SMOKE_TRIGGER ?? 'manual';
if (!['manual', 'jev'].includes(trigger)) throw new Error('Smoke trigger must be manual or jev');
const subject = 'telegram-smoke-caregiver';
const config = await telegramConfig({
  ...process.env,
  LEMMI_MODE: 'live',
  LEMMI_DATABASE_URL: url,
  LEMMI_CAREGIVER_SUBJECT: subject,
  LEMMI_TELEGRAM_PROFILE_IDS: 'profile-alex',
  // Smoke sends only to the primary recipient, never an untested backup/alternate.
  LEMMI_TELEGRAM_BACKUP_CHAT_ID: '',
  LEMMI_TELEGRAM_SAFE_CHAT_ID: '',
});
if (!config) throw new Error('Enable Telegram privately before running this smoke');
const sql = database(url);
let service: TelegramContactService | undefined;
try {
  await migrate(sql);
  const repository = new DataRepository(
    sql,
    await PrivateMedia.create(await mkdtemp(join(tmpdir(), 'lemmi-contact-smoke-'))),
  );
  await repository.bootstrap(subject);
  const pending =
    await sql`SELECT id FROM lemmi.help_requests WHERE status IN ('created','sending','accepted','delivery_unknown') AND expires_at>now()`;
  if (pending.length)
    throw new Error(
      'Previous smoke request is still open; acknowledge/cancel it or use a fresh smoke database',
    );
  service = new TelegramContactService(sql, config, createTelegramSender(config.token));
  await service.initialize();
  const selected = trigger === 'jev' ? conversationDecisionConfig(process.env) : null;
  if (selected && (!selected.ok || !selected.data))
    throw new Error('Jev smoke requires explicitly enabled private decision-model configuration');
  const concerns =
    selected?.ok && selected.data ? createOpenRouterConcernAdapter(selected.data) : undefined;
  const coordinator = new SessionCoordinator(
    'live',
    {
      async complete() {
        return fail('UNAVAILABLE', 'Smoke does not call the conversational LLM');
      },
    },
    undefined,
    Date.now,
    undefined,
    undefined,
    undefined,
    service,
    concerns,
  );
  coordinator.acceptPersistentProfile(await repository.approvedProfile(subject, 'profile-alex'));
  let requestId: string;
  if (trigger === 'manual') {
    // No conversation/session is required for manual help.
    const result = await coordinator.requestHelp('profile-alex', randomUUID());
    if (!result.ok) throw new Error('Manual help request failed');
    requestId = result.data.id;
  } else {
    coordinator.handle('session.start', {
      profileId: 'profile-alex',
      endpoint: 'browser',
      commandId: randomUUID(),
    });
    const snapshot = coordinator.snapshot()!;
    const result = await coordinator.submitText({
      sessionId: snapshot.id,
      expectedGeneration: snapshot.generation,
      commandId: randomUUID(),
      language: 'en',
      text: 'I am feeling very unwell right now and need someone to come and assist me.',
    });
    if (!result.ok) throw new Error('Jev concern path did not complete');
    const latest = await service.latest('profile-alex');
    if (!latest) throw new Error('Jev did not create a concern request');
    requestId = latest.id;
  }
  const deadline = Date.now() + 20000;
  let snapshot = await service.read('profile-alex', requestId, subject);
  while (['created', 'sending'].includes(snapshot.status) && Date.now() < deadline) {
    await service.tick();
    snapshot = await service.read('profile-alex', requestId, subject);
    if (['created', 'sending'].includes(snapshot.status)) await Bun.sleep(250);
  }
  if (snapshot.status !== 'accepted')
    throw new Error(
      'Telegram did not confirm acceptance; inspect contact status without replaying an uncertain send',
    );
  console.info(
    `PASS: ${trigger} → durable Lemmi help request → Telegram accepted. Reading/arrival are unconfirmed.`,
  );
  console.info(`Request ID: ${requestId}`);
  // End only this rehearsal's future attempts. The delivered message cannot be recalled.
  await service.update('profile-alex', requestId, 'cancel', subject);
  coordinator.disconnect();
} catch {
  // Neither provider errors nor SQL diagnostics may print secrets/destinations.
  console.error(
    'Telegram contact smoke failed. No acceptance is claimed; check private setup and request status before retrying.',
  );
  process.exitCode = 1;
} finally {
  await service?.stop();
  await sql.close();
}
