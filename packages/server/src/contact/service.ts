import { createHash, randomUUID } from 'node:crypto';
import type { SQL, TransactionSQL } from 'bun';
import { ok, fail, HelpSnapshotSchema, type HelpSnapshot, type Result } from '@lemmi/contracts';
import { DataError } from '../data/repository';
import { contactStatusText, type CaregiverContact, type ContactCategory } from './types';
import type { TelegramConfig, TelegramSender } from './telegram';

const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const uuid = (value: string) => {
  const h = digest(value).slice(0, 32);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};
type Row = Record<string, any>;
const open = ['created', 'sending', 'accepted', 'delivery_unknown'];

export class TelegramContactService implements CaregiverContact {
  private stopped = false;
  private running: Promise<void> | null = null;
  private timer?: ReturnType<typeof setInterval>;
  private readonly sending = new AbortController();
  constructor(
    private readonly sql: SQL,
    private readonly config: TelegramConfig,
    private readonly sender: TelegramSender,
    private readonly changed: (help: HelpSnapshot) => void = () => {},
  ) {}
  private snapshot(row: Row): HelpSnapshot {
    return HelpSnapshotSchema.parse({
      id: row.id,
      profileId: row.profile_id,
      mode: 'real',
      reason: ['help_request', 'contact_request'].includes(row.category)
        ? 'manual'
        : row.category === 'urgent'
          ? 'urgent_concern'
          : 'concern',
      status: row.status,
      message: contactStatusText(row.status, 'en'),
    });
  }
  async initialize() {
    await this.sql.begin(async (tx) => {
      // One trusted configuration for this service. Removing a profile disables its old route.
      const previousRoutes =
        await tx`SELECT profile_id FROM lemmi.telegram_routes WHERE subject=${this.config.subject}`;
      for (const route of previousRoutes)
        if (!this.config.profileIds.includes(route.profile_id))
          await tx`UPDATE lemmi.telegram_routes SET enabled=false WHERE profile_id=${route.profile_id}`;
      for (const profileId of this.config.profileIds) {
        const profiles =
          await tx`SELECT p.id FROM lemmi.profiles p JOIN lemmi.profile_access a ON a.profile_id=p.id WHERE p.id=${profileId} AND p.deletion_state='active' AND p.is_demo AND a.subject=${this.config.subject} FOR UPDATE OF p`;
        if (!profiles.length)
          throw new Error('Telegram profile must be an assigned fictional profile');
        const contacts: Partial<Record<'primary' | 'backup' | 'safe', string>> = {};
        for (const [slot, destination] of [
          ['primary', this.config.chatId],
          ['backup', this.config.backupChatId],
          ['safe', this.config.safeChatId],
        ] as const) {
          if (!destination) continue;
          const id = uuid(`telegram:${profileId}:${slot}`);
          await tx`INSERT INTO lemmi.contacts (id,profile_id,display_name,destination,channel,opted_in,verified_at,tested_at) VALUES (${id}::uuid,${profileId},${`Configured ${slot} team recipient`},${destination},'telegram',true,now(),now()) ON CONFLICT (id) DO UPDATE SET destination=EXCLUDED.destination, opted_in=CASE WHEN lemmi.contacts.destination<>EXCLUDED.destination THEN true ELSE lemmi.contacts.opted_in END, verified_at=CASE WHEN lemmi.contacts.destination<>EXCLUDED.destination THEN now() ELSE lemmi.contacts.verified_at END, tested_at=CASE WHEN lemmi.contacts.destination<>EXCLUDED.destination THEN now() ELSE lemmi.contacts.tested_at END, revision=lemmi.contacts.revision + CASE WHEN lemmi.contacts.destination<>EXCLUDED.destination THEN 1 ELSE 0 END`;
          contacts[slot] = id;
        }
        const revision = digest([
          this.config.subject,
          this.config.chatId,
          this.config.backupChatId,
          this.config.safeChatId,
          this.config.autoAlerts,
        ]);
        await tx`INSERT INTO lemmi.telegram_routes (profile_id,subject,revision,enabled,auto_alerts,primary_contact_id,backup_contact_id,safe_contact_id) VALUES (${profileId},${this.config.subject},${revision},true,${this.config.autoAlerts},${contacts.primary}::uuid,${contacts.backup ?? null}::uuid,${contacts.safe ?? null}::uuid) ON CONFLICT (profile_id) DO UPDATE SET subject=EXCLUDED.subject, revision=EXCLUDED.revision, enabled=CASE WHEN lemmi.telegram_routes.revision<>EXCLUDED.revision THEN true ELSE lemmi.telegram_routes.enabled END, auto_alerts=EXCLUDED.auto_alerts, primary_contact_id=EXCLUDED.primary_contact_id, backup_contact_id=EXCLUDED.backup_contact_id, safe_contact_id=EXCLUDED.safe_contact_id`;
      }
    });
  }
  async create(input: Parameters<CaregiverContact['create']>[0]): Promise<Result<HelpSnapshot>> {
    try {
      const result = await this.sql.begin(async (tx) => {
        const profiles =
          await tx`SELECT * FROM lemmi.profiles WHERE id=${input.profileId} AND deletion_state='active' AND is_demo FOR UPDATE`;
        const profile = profiles[0];
        if (!profile || !this.config.profileIds.includes(input.profileId))
          return fail('FORBIDDEN', 'Contact profile is not assigned');
        if (
          (input.current && !input.current()) ||
          (input.profileRevision !== undefined && input.profileRevision !== profile.revision) ||
          (input.privacyRevision !== undefined &&
            input.privacyRevision !== profile.privacy_revision) ||
          (input.policyRevision !== undefined && input.policyRevision !== profile.policy_revision)
        )
          return fail('REVISION_CONFLICT', 'Contact trigger is no longer current');
        const routes =
          await tx`SELECT r.* FROM lemmi.telegram_routes r JOIN lemmi.profile_access a ON a.profile_id=r.profile_id AND a.subject=r.subject WHERE r.profile_id=${input.profileId} AND r.subject=${this.config.subject} AND r.enabled FOR SHARE OF r`;
        const route = routes[0];
        if (
          !route ||
          (!['help_request', 'contact_request'].includes(input.category) && !route.auto_alerts)
        )
          return fail(
            'UNAVAILABLE',
            'Caregiver contact or automatic concern alerts are not configured',
          );
        const fingerprint = digest([input.category, input.source]);
        const receipts =
          await tx`SELECT * FROM lemmi.help_receipts WHERE profile_id=${input.profileId} AND command_id=${input.commandId}`;
        if (receipts[0]) {
          if (receipts[0].fingerprint !== fingerprint)
            return fail('REVISION_CONFLICT', 'Help command ID reused with different input');
          const rows =
            await tx`SELECT * FROM lemmi.help_requests WHERE id=${receipts[0].request_id}::uuid`;
          return ok(this.snapshot(rows[0]));
        }
        const safe = input.category === 'safeguarding';
        const contactId = safe ? route.safe_contact_id : route.primary_contact_id;
        if (!contactId)
          return fail(
            'UNAVAILABLE',
            safe
              ? 'Safe alternate contact is unavailable; no ordinary caregiver was notified'
              : 'Caregiver contact is unavailable',
          );
        const contacts =
          await tx`SELECT id,revision FROM lemmi.contacts WHERE profile_id=${input.profileId} AND id=${contactId}::uuid AND channel='telegram' AND opted_in AND verified_at IS NOT NULL AND tested_at IS NOT NULL FOR SHARE`;
        if (!contacts.length)
          return fail('UNAVAILABLE', 'Verified opted-in caregiver contact is unavailable');
        let rows =
          await tx`SELECT * FROM lemmi.help_requests WHERE profile_id=${input.profileId} AND category=${input.category} AND status IN ('created','sending','accepted','delivery_unknown') AND expires_at>now() AND route_revision=${route.revision} AND profile_revision=${profile.revision} AND privacy_revision=${profile.privacy_revision} AND policy_revision=${profile.policy_revision} ORDER BY created_at DESC LIMIT 1`;
        if (!rows.length) {
          if (input.current && !input.current())
            return fail('REVISION_CONFLICT', 'Contact trigger was canceled before persistence');
          const id = randomUUID();
          rows =
            await tx`INSERT INTO lemmi.help_requests (id,profile_id,category,source,route_revision,profile_revision,privacy_revision,policy_revision,status,expires_at) VALUES (${id}::uuid,${input.profileId},${input.category},${input.source},${route.revision},${profile.revision},${profile.privacy_revision},${profile.policy_revision},'created',now()+interval '120 seconds') RETURNING *`;
          await tx`INSERT INTO lemmi.help_attempts (id,request_id,contact_id,contact_revision,slot,state,due_at) VALUES (${randomUUID()}::uuid,${id}::uuid,${contactId}::uuid,${contacts[0].revision},${safe ? 'safe' : 'primary'},'pending',now())`;
          if (!safe && route.backup_contact_id) {
            const backup =
              await tx`SELECT * FROM lemmi.contacts WHERE id=${route.backup_contact_id}::uuid AND profile_id=${input.profileId} AND channel='telegram' AND opted_in AND verified_at IS NOT NULL AND tested_at IS NOT NULL FOR SHARE`;
            if (backup.length)
              await tx`INSERT INTO lemmi.help_attempts (id,request_id,contact_id,contact_revision,slot,state,due_at) VALUES (${randomUUID()}::uuid,${id}::uuid,${backup[0].id}::uuid,${backup[0].revision},'backup','pending',now()+interval '60 seconds')`;
          }
        }
        await tx`INSERT INTO lemmi.help_receipts (profile_id,command_id,fingerprint,request_id) VALUES (${input.profileId},${input.commandId},${fingerprint},${rows[0].id}::uuid)`;
        if (input.current && !input.current())
          throw new DataError('REVISION_CONFLICT', 'Contact trigger canceled before commit');
        return ok(this.snapshot(rows[0]));
      });
      if (result.ok) this.notify(result.data);
      return result;
    } catch (error) {
      if (error instanceof DataError) return fail(error.code, error.message);
      return fail('SAVE_FAILED', 'Help request could not be saved; no new send was started');
    }
  }
  private notify(help: HelpSnapshot) {
    try {
      this.changed(help);
    } catch {
      /* Observer cannot change delivery. */
    }
  }
  async read(profileId: string, requestId: string, subject?: string) {
    return this.sql.begin(async (tx) => {
      await this.authorize(tx, profileId, subject);
      const rows =
        await tx`SELECT * FROM lemmi.help_requests WHERE profile_id=${profileId} AND id=${requestId}::uuid`;
      if (!rows.length) throw new DataError('NOT_FOUND', 'Help request not found');
      return this.snapshot(rows[0]);
    });
  }
  async latest(profileId: string) {
    return this.sql.begin(async (tx) => {
      await this.authorize(tx, profileId);
      const rows =
        await tx`SELECT * FROM lemmi.help_requests WHERE profile_id=${profileId} ORDER BY created_at DESC LIMIT 1`;
      return rows.length ? this.snapshot(rows[0]) : null;
    });
  }
  private async authorize(tx: TransactionSQL, profileId: string, subject?: string) {
    const rows =
      await tx`SELECT p.id FROM lemmi.profiles p JOIN lemmi.profile_access a ON a.profile_id=p.id WHERE p.id=${profileId} AND p.deletion_state='active' AND a.subject=${subject ?? this.config.subject} FOR SHARE OF p`;
    if (
      !rows.length ||
      !this.config.profileIds.includes(profileId) ||
      (subject !== undefined && subject !== this.config.subject)
    )
      throw new DataError('FORBIDDEN', 'Help request is not assigned');
  }
  async update(
    profileId: string,
    requestId: string,
    action: 'acknowledge' | 'cancel' | 'resolve',
    subject: string,
  ) {
    const result = await this.sql.begin(async (tx) => {
      await this.authorize(tx, profileId, subject);
      const rows =
        await tx`SELECT * FROM lemmi.help_requests WHERE profile_id=${profileId} AND id=${requestId}::uuid FOR UPDATE`;
      const row = rows[0];
      if (!row) throw new DataError('NOT_FOUND', 'Help request not found');
      if (action === 'resolve' && !row.acknowledged_at)
        throw new DataError('REVISION_CONFLICT', 'Acknowledge before resolving');
      if (action === 'acknowledge' && row.status !== 'resolved')
        await tx`UPDATE lemmi.help_requests SET status='acknowledged',acknowledged_at=COALESCE(acknowledged_at,now()),acknowledged_by=COALESCE(acknowledged_by,${subject}) WHERE id=${requestId}::uuid`;
      else if (action === 'resolve')
        await tx`UPDATE lemmi.help_requests SET status='resolved',resolved_at=COALESCE(resolved_at,now()) WHERE id=${requestId}::uuid`;
      else if (action === 'cancel' && !['acknowledged', 'resolved'].includes(row.status))
        await tx`UPDATE lemmi.help_requests SET status='canceled' WHERE id=${requestId}::uuid`;
      await tx`UPDATE lemmi.help_attempts SET state='canceled' WHERE request_id=${requestId}::uuid AND state='pending'`;
      const current = await tx`SELECT * FROM lemmi.help_requests WHERE id=${requestId}::uuid`;
      return this.snapshot(current[0]);
    });
    this.notify(result);
    return result;
  }
  start() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.tick().catch(() => {});
    }, 500);
    this.timer.unref();
    void this.tick().catch(() => {});
  }
  async stop() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.sending.abort();
    await this.running;
  }
  tick(): Promise<void> {
    if (this.stopped) return Promise.resolve();
    if (this.running) return this.running;
    this.running = this.runOnce().finally(() => {
      this.running = null;
    });
    return this.running;
  }
  private async runOnce() {
    const changed: HelpSnapshot[] = [];
    const job = await this.sql.begin(async (tx) => {
      // A crash after the network call cannot safely be retried without provider idempotency.
      const recovered =
        await tx`UPDATE lemmi.help_attempts SET state='unknown',lease_id=NULL,lease_expires_at=NULL WHERE state='sending' AND lease_expires_at<now() RETURNING request_id`;
      for (const row of recovered) {
        const status = await this.refresh(tx, row.request_id);
        if (status) changed.push(status);
      }
      const expired =
        await tx`UPDATE lemmi.help_requests SET status='no_response' WHERE status IN ('created','sending','accepted','delivery_unknown') AND expires_at<=now() RETURNING *`;
      for (const row of expired) changed.push(this.snapshot(row));
      await tx`UPDATE lemmi.help_attempts a SET state='canceled' FROM lemmi.help_requests r WHERE a.request_id=r.id AND a.state='pending' AND (r.expires_at<=now() OR r.status IN ('acknowledged','resolved','canceled','expired','no_response'))`;
      const jobs =
        await tx`SELECT a.*,r.profile_id,r.category,r.source,r.created_at,r.route_revision,r.profile_revision,r.privacy_revision,r.policy_revision FROM lemmi.help_attempts a JOIN lemmi.help_requests r ON r.id=a.request_id WHERE a.state='pending' AND a.due_at<=now() AND a.tries<2 AND r.expires_at>now() AND r.status IN ('created','sending','accepted','delivery_unknown') ORDER BY a.due_at LIMIT 1 FOR UPDATE OF a SKIP LOCKED`;
      if (!jobs.length) return null;
      const a = jobs[0];
      const valid =
        await tx`SELECT c.destination,p.preferred_name FROM lemmi.contacts c JOIN lemmi.profiles p ON p.id=c.profile_id JOIN lemmi.telegram_routes t ON t.profile_id=p.id JOIN lemmi.profile_access pa ON pa.profile_id=p.id AND pa.subject=t.subject WHERE c.id=${a.contact_id}::uuid AND p.id=${a.profile_id} AND p.deletion_state='active' AND p.is_demo AND p.revision=${a.profile_revision} AND p.privacy_revision=${a.privacy_revision} AND p.policy_revision=${a.policy_revision} AND c.revision=${a.contact_revision} AND c.opted_in AND c.verified_at IS NOT NULL AND c.tested_at IS NOT NULL AND c.channel='telegram' AND t.enabled AND t.subject=${this.config.subject} AND t.revision=${a.route_revision} AND (${a.category} IN ('help_request','contact_request') OR t.auto_alerts) AND c.id=CASE WHEN ${a.slot}='safe' THEN t.safe_contact_id WHEN ${a.slot}='backup' THEN t.backup_contact_id ELSE t.primary_contact_id END FOR SHARE OF p,c,t`;
      if (!valid.length || !this.config.profileIds.includes(a.profile_id)) {
        await tx`UPDATE lemmi.help_attempts SET state='canceled' WHERE id=${a.id}::uuid`;
        const canceled =
          await tx`UPDATE lemmi.help_requests SET status='canceled' WHERE id=${a.request_id}::uuid AND status IN ('created','sending','accepted','delivery_unknown') RETURNING *`;
        if (canceled.length) changed.push(this.snapshot(canceled[0]));
        return null;
      }
      const leaseId = randomUUID();
      await tx`UPDATE lemmi.help_attempts SET state='sending',tries=tries+1,lease_id=${leaseId}::uuid,lease_expires_at=now()+interval '20 seconds' WHERE id=${a.id}::uuid`;
      await tx`UPDATE lemmi.help_requests SET status='sending' WHERE id=${a.request_id}::uuid AND status='created'`;
      return { ...a, leaseId, ...valid[0] };
    });
    changed.forEach((help) => this.notify(help));
    if (!job || this.stopped) return;
    // Recheck after claiming and before network I/O. Already in-flight messages cannot be recalled.
    const current = await this
      .sql`SELECT 1 FROM lemmi.help_requests r JOIN lemmi.profiles p ON p.id=r.profile_id JOIN lemmi.telegram_routes t ON t.profile_id=p.id JOIN lemmi.contacts c ON c.id=${job.contact_id}::uuid JOIN lemmi.profile_access pa ON pa.profile_id=p.id AND pa.subject=t.subject WHERE r.id=${job.request_id}::uuid AND r.status IN ('created','sending','accepted','delivery_unknown') AND r.expires_at>now() AND p.deletion_state='active' AND p.is_demo AND p.revision=r.profile_revision AND p.privacy_revision=r.privacy_revision AND p.policy_revision=r.policy_revision AND t.enabled AND t.subject=${this.config.subject} AND t.revision=r.route_revision AND (r.category IN ('help_request','contact_request') OR t.auto_alerts) AND c.profile_id=p.id AND c.channel='telegram' AND c.opted_in AND c.verified_at IS NOT NULL AND c.tested_at IS NOT NULL AND c.revision=${job.contact_revision} AND c.id=CASE WHEN ${job.slot}='safe' THEN t.safe_contact_id WHEN ${job.slot}='backup' THEN t.backup_contact_id ELSE t.primary_contact_id END`;
    if (!current.length || this.stopped) {
      await this
        .sql`UPDATE lemmi.help_attempts SET state='canceled',lease_id=NULL,lease_expires_at=NULL WHERE id=${job.id}::uuid AND lease_id=${job.leaseId}::uuid`;
      return;
    }
    const reason =
      job.category === 'help_request'
        ? 'Help requested — Human assistance requested'
        : job.category === 'contact_request'
          ? 'Call/contact requested'
          : job.category === 'departure'
            ? 'Departure/travel plan reported'
            : job.category === 'human_support'
              ? 'Lemmi recommended trusted human support'
              : job.category === 'urgent'
                ? 'Urgent concern reported'
                : 'Wellbeing or safety concern detected';
    const attribution =
      job.source === 'model_reply'
        ? 'Lemmi suggested support from a trusted person.'
        : job.source === 'model'
          ? 'Automated classification; unverified.'
          : 'Participant request/report; unverified.';
    const portal = this.config.portalUrl
      ? `Please check the caregiver portal: ${this.config.portalUrl}`
      : 'Please check the caregiver portal.';
    const message = `Lemmi fictional demo: ${reason}\nParticipant: ${job.preferred_name}\nRequest: ${job.request_id}\nTime: ${new Date(job.created_at).toISOString()}\n${attribution}\n${portal}\nPlease check in with the participant when you can.`;
    const result = await this.sender
      .send(job.destination, message, this.sending.signal)
      .catch(() => ({ status: 'unknown' as const }));
    const updated = await this.sql.begin(async (tx) => {
      // Deletion, cancellation or a new lease wins; no INSERT can recreate deleted records.
      const rows =
        await tx`SELECT * FROM lemmi.help_attempts WHERE id=${job.id}::uuid AND lease_id=${job.leaseId}::uuid AND state='sending' FOR UPDATE`;
      if (!rows.length) return;
      if (result.status === 'retry' && rows[0].tries < 2) {
        await tx`UPDATE lemmi.help_attempts SET state='pending',due_at=now()+${result.delayMs}*interval '1 millisecond',lease_id=NULL,lease_expires_at=NULL WHERE id=${job.id}::uuid`;
      } else {
        const state =
          result.status === 'accepted'
            ? 'accepted'
            : result.status === 'unknown'
              ? 'unknown'
              : 'failed';
        await tx`UPDATE lemmi.help_attempts SET state=${state},provider_message_id=${result.status === 'accepted' ? result.messageId : null},lease_id=NULL,lease_expires_at=NULL WHERE id=${job.id}::uuid`;
        if (state === 'failed')
          await tx`UPDATE lemmi.help_attempts SET due_at=now() WHERE request_id=${job.request_id}::uuid AND slot='backup' AND state='pending'`;
      }
      return this.refresh(tx, job.request_id);
    });
    if (updated) this.notify(updated);
  }
  private async refresh(tx: TransactionSQL, id: string) {
    const rows = await tx`SELECT * FROM lemmi.help_requests WHERE id=${id}::uuid FOR UPDATE`;
    const request = rows[0];
    if (!request || !open.includes(request.status)) return;
    const attempts = await tx`SELECT state FROM lemmi.help_attempts WHERE request_id=${id}::uuid`;
    const states = attempts.map((a: Row) => a.state);
    const status = states.includes('accepted')
      ? 'accepted'
      : states.includes('unknown')
        ? 'delivery_unknown'
        : states.includes('sending')
          ? 'sending'
          : states.includes('pending')
            ? 'created'
            : 'failed';
    const updated =
      await tx`UPDATE lemmi.help_requests SET status=${status} WHERE id=${id}::uuid RETURNING *`;
    return this.snapshot(updated[0]);
  }
}
