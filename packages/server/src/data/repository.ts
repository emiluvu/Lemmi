import type { SQL, TransactionSQL } from 'bun';
import { randomUUID } from 'node:crypto';
import { readdir } from 'node:fs/promises';
import {
  CaregiverProfileSchema,
  ParticipantProfileSchema,
  JournalEventSchema,
  type SessionSnapshot,
  type ParticipantProfile,
} from '@lemmi/contracts';
import {
  ProfileDetailSchema,
  ProfileUpdateSchema,
  AssetCreateSchema,
  AssetMetadataSchema,
  ProfileCreateSchema,
  type ProfileDetail,
  type AssetMetadata,
} from '../../../contracts/src/profile-assets';
import { PrivateMedia, decodeMedia, sha256 } from './private-media';
import { assertPrivateDatabaseLogging } from './database';

export type DataPrincipal =
  | { kind: 'caregiver'; subject: string; profileId: string; bootId?: string }
  | {
      kind: 'participant';
      profileId: string;
      deviceId: string;
      credentialId: string;
      bootId: string;
    };
export class DataError extends Error {
  constructor(
    readonly code:
      | 'FORBIDDEN'
      | 'NOT_FOUND'
      | 'REVISION_CONFLICT'
      | 'UNAVAILABLE'
      | 'VALIDATION_ERROR',
    message: string,
  ) {
    super(message);
  }
}
export class DataRepository {
  constructor(
    readonly sql: SQL,
    readonly media: PrivateMedia,
  ) {}
  async bootstrap(subject: string) {
    await assertPrivateDatabaseLogging(this.sql);
    if (!subject || subject.length > 200) throw new Error('Configured caregiver subject required');
    await this.sql.begin(async (tx) => {
      await tx`INSERT INTO lemmi.profiles (id,preferred_name,avatar_id,communication_preset,is_demo) VALUES ('profile-alex','Alex','lemming','guided',true) ON CONFLICT DO NOTHING`;
      const access =
        await tx`SELECT subject FROM lemmi.profile_access WHERE profile_id='profile-alex'`;
      if (access.length && !access.some((row: any) => row.subject === subject))
        throw new Error('Caregiver assignment differs; explicit migration required');
      await tx`INSERT INTO lemmi.profile_access (profile_id,subject,role) VALUES ('profile-alex',${subject},'caregiver') ON CONFLICT DO NOTHING`;
      await tx`INSERT INTO lemmi.devices (id,profile_id) VALUES ('stackchan-alex','profile-alex') ON CONFLICT DO NOTHING`;
    });
  }
  private async scoped(tx: TransactionSQL, principal: DataPrincipal, id: string, write = false) {
    if (
      id.startsWith('preview-') ||
      principal.profileId !== id ||
      (write && principal.kind !== 'caregiver')
    )
      throw new DataError('FORBIDDEN', 'Profile is not assigned');
    // Lock revision, authorization and reads together. No query chooses scope from a model.
    const rows =
      await tx`SELECT * FROM lemmi.profiles WHERE id=${id} AND deletion_state='active' FOR UPDATE`;
    if (!rows.length) throw new DataError('NOT_FOUND', 'Profile is unavailable');
    if (principal.kind === 'caregiver' && principal.bootId) {
      const epoch =
        await tx`SELECT 1 FROM lemmi.gateway_state WHERE singleton AND boot_id=${principal.bootId}::uuid FOR SHARE`;
      if (!epoch.length)
        throw new DataError('UNAVAILABLE', 'Gateway ownership changed; restart this process');
    }
    if (principal.kind === 'caregiver') {
      const member =
        await tx`SELECT 1 FROM lemmi.profile_access WHERE profile_id=${id} AND subject=${principal.subject} AND role='caregiver' FOR SHARE`;
      if (!member.length) throw new DataError('FORBIDDEN', 'Caregiver is not assigned');
    } else {
      const device =
        await tx`SELECT 1 FROM lemmi.devices WHERE id=${principal.deviceId} AND profile_id=${id} AND credential_id=${principal.credentialId}::uuid AND boot_id=${principal.bootId}::uuid AND revoked_at IS NULL AND credential_expires_at>now() FOR SHARE`;
      if (!device.length) throw new DataError('FORBIDDEN', 'Device access has ended');
    }
    return rows[0];
  }
  private async detail(tx: TransactionSQL, row: any): Promise<ProfileDetail> {
    const facts =
      await tx`SELECT id,field,value,source FROM lemmi.profile_facts WHERE profile_id=${row.id} ORDER BY id`;
    return ProfileDetailSchema.parse({
      id: row.id,
      preferredName: row.preferred_name,
      avatarId: row.avatar_id,
      revision: row.revision,
      source: 'caregiver_provided',
      interests: row.interests,
      sensitiveTopicGuidance: row.sensitive_guidance,
      rememberingEnabled: row.remembering_enabled,
      excerptSavingEnabled: row.excerpt_saving_enabled,
      communicationSupport: { preset: row.communication_preset, configVersion: 1 },
      privacyRevision: row.privacy_revision,
      policyRevision: row.policy_revision,
      approvedFacts: facts.map((r: any) => ({ ...r })),
    });
  }
  async profile(principal: DataPrincipal, id: string, caregiver = false) {
    return this.sql.begin(async (tx) => {
      if (caregiver && principal.kind !== 'caregiver')
        throw new DataError('FORBIDDEN', 'Caregiver access required');
      const row = await this.scoped(tx, principal, id);
      const detail = await this.detail(tx, row);
      if (caregiver) return detail;
      return ParticipantProfileSchema.parse({
        id: detail.id,
        preferredName: detail.preferredName,
        avatarId: detail.avatarId,
        revision: detail.revision,
        communicationSupport: detail.communicationSupport,
      });
    });
  }
  async approvedProfile(subject: string, profileId = 'profile-alex'): Promise<ProfileDetail> {
    return (await this.profile(
      { kind: 'caregiver', subject, profileId },
      profileId,
      true,
    )) as ProfileDetail;
  }
  async listProfiles(subject: string, demoOnly = false): Promise<ParticipantProfile[]> {
    const rows = await this
      .sql`SELECT p.id,p.preferred_name,p.avatar_id,p.revision,p.communication_preset FROM lemmi.profiles p JOIN lemmi.profile_access a ON a.profile_id=p.id WHERE a.subject=${subject} AND a.role='caregiver' AND p.deletion_state='active' AND (NOT ${demoOnly} OR p.is_demo) ORDER BY p.id LIMIT 100`;
    return rows.map((row: any) =>
      ParticipantProfileSchema.parse({
        id: row.id,
        preferredName: row.preferred_name,
        avatarId: row.avatar_id,
        revision: row.revision,
        communicationSupport: { preset: row.communication_preset, configVersion: 1 },
      }),
    );
  }
  async createProfile(subject: string, raw: unknown, demo = false, bootId?: string) {
    const input = ProfileCreateSchema.parse(raw);
    const id = `profile-${randomUUID()}`;
    await this.sql.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(1437236103)`;
      if (bootId) {
        const epoch =
          await tx`SELECT 1 FROM lemmi.gateway_state WHERE singleton AND boot_id=${bootId}::uuid FOR SHARE`;
        if (!epoch.length) throw new DataError('UNAVAILABLE', 'Gateway ownership changed');
      }
      const count = await tx`SELECT count(*)::int AS n FROM lemmi.profiles`;
      if (count[0].n >= 100) throw new DataError('UNAVAILABLE', 'Profile capacity reached');
      await tx`INSERT INTO lemmi.profiles (id,preferred_name,avatar_id,communication_preset,is_demo) VALUES (${id},${input.preferredName},${input.avatarId},'guided',${demo})`;
      await tx`INSERT INTO lemmi.profile_access (profile_id,subject,role) VALUES (${id},${subject},'caregiver')`;
    });
    return this.approvedProfile(subject, id);
  }
  async update(
    principal: DataPrincipal,
    raw: unknown,
    beforeCommit: () => void,
  ): Promise<ProfileDetail> {
    const parsed = ProfileUpdateSchema.safeParse(raw);
    if (!parsed.success) throw new DataError('VALIDATION_ERROR', 'Invalid profile update');
    const input = parsed.data;
    return this.sql.begin(async (tx) => {
      const row = await this.scoped(tx, principal, input.profileId, true);
      if (principal.kind !== 'caregiver') throw new DataError('FORBIDDEN', 'Caregiver required');
      const hash = sha256(JSON.stringify(input));
      const receipts =
        await tx`SELECT fingerprint,result_revision FROM lemmi.mutation_receipts WHERE profile_id=${input.profileId} AND subject=${principal.subject} AND operation='profile.update' AND command_id=${input.commandId}`;
      if (receipts.length) {
        if (receipts[0].fingerprint !== hash || receipts[0].result_revision !== row.revision)
          throw new DataError('REVISION_CONFLICT', 'Update receipt is stale or command changed');
        return this.detail(tx, row);
      }
      if (row.revision !== input.expectedRevision)
        throw new DataError('REVISION_CONFLICT', 'Reload the current profile');
      const count =
        await tx`SELECT count(*)::int AS n FROM lemmi.mutation_receipts WHERE profile_id=${input.profileId}`;
      if (count[0].n >= 1000) throw new DataError('UNAVAILABLE', 'Mutation capacity reached');
      const previous = await this.detail(tx, row);
      const next = { ...previous, ...input.patch, revision: row.revision + 1 };
      // Stop stale context before COMMIT. A failed commit leaves the session paused.
      beforeCommit();
      const changed =
        await tx`UPDATE lemmi.profiles SET preferred_name=${next.preferredName},avatar_id=${next.avatarId},
        communication_preset=${next.communicationSupport.preset},interests=${tx.json(next.interests)},
        sensitive_guidance=${next.sensitiveTopicGuidance},revision=revision+1,updated_at=now() WHERE id=${input.profileId} RETURNING *`;
      if (input.patch.approvedFacts) {
        await tx`DELETE FROM lemmi.profile_facts WHERE profile_id=${input.profileId}`;
        for (const fact of input.patch.approvedFacts)
          await tx`INSERT INTO lemmi.profile_facts (id,profile_id,field,value,source,author,revision) VALUES (${fact.id}::uuid,${input.profileId},${fact.field},${fact.value},'caregiver_provided',${principal.subject},${next.revision})`;
      }
      await tx`INSERT INTO lemmi.mutation_receipts (profile_id,subject,operation,command_id,fingerprint,result_revision) VALUES (${input.profileId},${principal.subject},'profile.update',${input.commandId},${hash},${next.revision})`;
      return this.detail(tx, changed[0]);
    });
  }
  private metadata(row: any): AssetMetadata {
    return AssetMetadataSchema.parse({
      id: row.id,
      profileId: row.profile_id,
      version: 1,
      kind: row.kind,
      mediaType: row.media_type,
      byteLength: row.byte_length,
      caption: row.caption,
      entityIds: row.entity_ids,
      approved: true,
      ...(row.width ? { width: row.width, height: row.height } : {}),
    });
  }
  async createAsset(principal: DataPrincipal, raw: unknown): Promise<AssetMetadata> {
    if (principal.kind !== 'caregiver')
      throw new DataError('FORBIDDEN', 'Caregiver access required');
    const parsed = AssetCreateSchema.safeParse(raw);
    if (!parsed.success) throw new DataError('VALIDATION_ERROR', 'Invalid approved asset');
    const input = parsed.data;
    if ((input.kind === 'image') !== input.mediaType.startsWith('image/'))
      throw new DataError('VALIDATION_ERROR', 'Media kind/type mismatch');
    let decoded: ReturnType<typeof decodeMedia>;
    try {
      decoded = decodeMedia(input.dataBase64, input.mediaType);
    } catch {
      throw new DataError(
        'VALIDATION_ERROR',
        'Unsupported, malformed or oversized media; use plain PNG or PCM WAV',
      );
    }
    const bytes = decoded.bytes;
    const digest = sha256(bytes);
    const hash = sha256(JSON.stringify({ ...input, dataBase64: undefined, sha256: digest }));
    const key = randomUUID();
    let written = false;
    try {
      return await this.sql.begin(async (tx) => {
        const profile = await this.scoped(tx, principal, input.profileId, true);
        const receipts =
          await tx`SELECT fingerprint,resource_id FROM lemmi.mutation_receipts WHERE profile_id=${input.profileId} AND subject=${principal.subject} AND operation='asset.create' AND command_id=${input.commandId}`;
        if (receipts.length) {
          if (receipts[0].fingerprint !== hash)
            throw new DataError('REVISION_CONFLICT', 'Asset command ID reused');
          const assets =
            await tx`SELECT * FROM lemmi.media_assets WHERE id=${receipts[0].resource_id}::uuid AND profile_id=${input.profileId} AND approved`;
          if (!assets.length)
            throw new DataError('REVISION_CONFLICT', 'Asset is no longer available');
          return this.metadata(assets[0]);
        }
        if (profile.revision !== input.expectedRevision)
          throw new DataError('REVISION_CONFLICT', 'Reload current profile before upload');
        const count =
          await tx`SELECT count(*)::int AS n FROM lemmi.media_assets WHERE profile_id=${input.profileId}`;
        if (count[0].n >= 100)
          throw new DataError('UNAVAILABLE', 'Approved asset capacity reached');
        await this.media.write(key, bytes);
        written = true;
        const id = randomUUID();
        const rows =
          await tx`INSERT INTO lemmi.media_assets (id,profile_id,storage_key,kind,media_type,byte_length,sha256,width,height,caption,discussion_context,entity_ids,source,permission,approved_by,profile_revision,privacy_revision,policy_revision)
          VALUES (${id}::uuid,${input.profileId},${key}::uuid,${input.kind},${input.mediaType},${bytes.length},${digest},${decoded.width ?? null},${decoded.height ?? null},${input.caption},${input.discussionContext},${tx.json(input.entityIds)},${input.source},${input.permission},${principal.subject},${profile.revision},${profile.privacy_revision},${profile.policy_revision}) RETURNING *`;
        await tx`INSERT INTO lemmi.mutation_receipts (profile_id,subject,operation,command_id,fingerprint,resource_id,result_revision) VALUES (${input.profileId},${principal.subject},'asset.create',${input.commandId},${hash},${id},${profile.revision})`;
        return this.metadata(rows[0]);
      });
    } catch (error) {
      // An uncertain COMMIT must not erase bytes that the DB may have committed.
      if (written) {
        try {
          const linked = await this
            .sql`SELECT 1 FROM lemmi.media_assets WHERE storage_key=${key}::uuid`;
          if (!linked.length) await this.media.remove(key);
        } catch {
          /* startup reconciles unreferenced objects */
        }
      }
      throw error;
    } finally {
      bytes.fill(0);
    }
  }
  async asset(principal: DataPrincipal, id: string, readBytes = false) {
    return this.sql.begin(async (tx) => {
      const profile = await this.scoped(tx, principal, principal.profileId);
      const rows =
        await tx`SELECT * FROM lemmi.media_assets WHERE id=${id}::uuid AND profile_id=${principal.profileId} AND approved`;
      if (!rows.length) throw new DataError('NOT_FOUND', 'Approved asset not found');
      const row = rows[0];
      // Current policy always wins over static approval; no private policy reasons leak.
      const blocked =
        await tx`SELECT 1 FROM lemmi.profile_preferences WHERE profile_id=${principal.profileId} AND value='avoid' AND entity_id IN (SELECT jsonb_array_elements_text(${tx.json(row.entity_ids)}))
        UNION ALL SELECT 1 FROM lemmi.profile_item_policies WHERE profile_id=${principal.profileId} AND status='retired' AND entity_id IN (SELECT jsonb_array_elements_text(${tx.json(row.entity_ids)}))`;
      if (blocked.length)
        throw new DataError('NOT_FOUND', 'Approved asset not available under current policy');
      const metadata = this.metadata(row);
      // Lock stays held through bounded file read so revocation/policy/deletion cannot race it.
      const bytes = readBytes
        ? await this.media.read(row.storage_key, row.byte_length, row.sha256)
        : undefined;
      return { metadata, bytes, revision: profile.revision };
    });
  }
  async restart(bootId: string) {
    await this.sql.begin(async (tx) => {
      await tx`INSERT INTO lemmi.gateway_state (singleton,boot_id) VALUES (true,${bootId}::uuid) ON CONFLICT (singleton) DO UPDATE SET boot_id=EXCLUDED.boot_id`;
      await tx`UPDATE lemmi.devices SET boot_id=${bootId}::uuid`;
      await tx`UPDATE lemmi.sessions SET phase='ended',generation=generation+1,ended_at=now() WHERE phase<>'ended'`;
    });
    const linked = await this.sql`SELECT storage_key FROM lemmi.media_assets`;
    const keys = new Set(linked.map((row: any) => row.storage_key));
    for (const key of await readdir(this.media.root))
      if (/^[0-9a-f-]{36}$/.test(key) && !keys.has(key)) await this.media.remove(key);
  }
  async saveSession(
    snapshot: SessionSnapshot,
    events: { id: string; event: unknown }[],
    bootId?: string,
  ) {
    await this.sql.begin(async (tx) => {
      const profile =
        await tx`SELECT 1 FROM lemmi.profiles WHERE id=${snapshot.profileId} AND deletion_state='active' AND revision>=${snapshot.profileRevision} AND privacy_revision=${snapshot.privacyRevision} AND policy_revision=${snapshot.policyRevision} FOR UPDATE`;
      if (!profile.length) throw new DataError('REVISION_CONFLICT', 'Session profile changed');
      if (bootId) {
        const epoch =
          await tx`SELECT 1 FROM lemmi.gateway_state WHERE singleton AND boot_id=${bootId}::uuid FOR SHARE`;
        if (!epoch.length) throw new DataError('REVISION_CONFLICT', 'Gateway epoch changed');
      }
      await tx`INSERT INTO lemmi.sessions (id,profile_id,generation,phase,profile_revision,privacy_revision,policy_revision,endpoint,lease_id,ended_at) VALUES (${snapshot.id},${snapshot.profileId},${snapshot.generation},${snapshot.phase},${snapshot.profileRevision},${snapshot.privacyRevision},${snapshot.policyRevision},${snapshot.endpoint},${snapshot.leaseId},${snapshot.phase === 'ended' ? new Date() : null})
        ON CONFLICT (id) DO UPDATE SET generation=EXCLUDED.generation,phase=EXCLUDED.phase,profile_revision=EXCLUDED.profile_revision,privacy_revision=EXCLUDED.privacy_revision,policy_revision=EXCLUDED.policy_revision,endpoint=EXCLUDED.endpoint,lease_id=EXCLUDED.lease_id,ended_at=EXCLUDED.ended_at WHERE lemmi.sessions.generation<=EXCLUDED.generation`;
      for (const raw of events) {
        const event = JournalEventSchema.parse(raw.event);
        await tx`INSERT INTO lemmi.activity_events (id,profile_id,session_id,event) VALUES (${raw.id}::uuid,${snapshot.profileId},${snapshot.id},${tx.json(event)}) ON CONFLICT (id) DO NOTHING`;
      }
    });
  }
}
