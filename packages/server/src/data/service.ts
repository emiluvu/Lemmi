import type { SQL } from 'bun';
import { createHash } from 'node:crypto';
import { fail, ok, type Result } from '@lemmi/contracts';
import { DataRequestSchema, DemoSetupRequestSchema } from '../../../contracts/src/profile-assets';
import { DataRepository, DataError, type DataPrincipal } from './repository';
import { DatabaseDeviceAuthority } from './device-authority';
import { PrivateMedia } from './private-media';
import { database } from './database';
import type { SessionCoordinator } from '../session-coordinator';
type ProfileSessions = Pick<
  SessionCoordinator,
  'acceptPersistentProfile' | 'persistenceSnapshot'
> & {
  pauseForProfileUpdate(patch: Record<string, unknown>, profileId?: string): void;
  forProfile?(profileId: string): SessionCoordinator;
};

export function dataConfig(env: Record<string, string | undefined> = process.env) {
  if (!env.LEMMI_DATABASE_URL) return null;
  if (!env.LEMMI_PRIVATE_MEDIA_DIR || !env.LEMMI_CAREGIVER_SUBJECT)
    throw new Error('Database mode needs private media directory and caregiver subject');
  return {
    url: env.LEMMI_DATABASE_URL,
    mediaDirectory: env.LEMMI_PRIVATE_MEDIA_DIR,
    subject: env.LEMMI_CAREGIVER_SUBJECT,
  };
}
export class PersistentData {
  readonly devices: DatabaseDeviceAuthority;
  private lock?: Awaited<ReturnType<SQL['reserve']>>;
  constructor(
    readonly repository: DataRepository,
    readonly subject: string,
    private coordinator: ProfileSessions,
    now: () => number,
    invalidated: (deviceId?: string) => void,
  ) {
    this.devices = new DatabaseDeviceAuthority(repository, now, invalidated);
  }
  async start() {
    this.lock = await this.repository.sql.reserve();
    const result = await this.lock`SELECT pg_try_advisory_lock(1437236102) AS acquired`;
    if (!result[0].acquired) {
      this.lock.release();
      this.lock = undefined;
      throw new Error('Only one live gateway may own the database');
    }
    try {
      await this.repository.bootstrap(this.subject);
      await this.devices.start();
      const profiles = await this.repository.listProfiles(this.subject);
      for (const profile of profiles) {
        if (this.coordinator.forProfile || profile.id === 'profile-alex')
          this.coordinator.acceptPersistentProfile(
            await this.repository.approvedProfile(this.subject, profile.id),
          );
      }
    } catch (error) {
      await this.close();
      throw error;
    }
  }
  private checkpoints = Promise.resolve();
  checkpoint(snapshot = this.coordinator.persistenceSnapshot()) {
    if (!snapshot) return this.checkpoints;
    const work = async () => {
      await this.repository.saveSession(
        snapshot.session,
        snapshot.events.map((event, index) => {
          const hash = createHash('sha256')
            .update(`${snapshot.session.id}:${index}`)
            .digest('hex')
            .slice(0, 32);
          return {
            id: `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20)}`,
            event,
          };
        }),
        this.devices.bootId,
      );
    };
    const result = this.checkpoints.then(work);
    this.checkpoints = result.catch(() => {});
    return result;
  }
  async close() {
    await this.checkpoints;
    const lock = this.lock;
    this.lock = undefined;
    if (lock) {
      try {
        await lock`SELECT pg_advisory_unlock(1437236102)`;
      } finally {
        lock.release();
      }
    }
  }
  async principal(
    actor: unknown,
    credential: unknown,
    profileId = 'profile-alex',
  ): Promise<DataPrincipal> {
    if (typeof actor === 'string' && actor === this.subject && credential === undefined)
      return {
        kind: 'caregiver',
        subject: actor,
        profileId,
        bootId: this.devices.bootId,
      };
    if (typeof credential === 'string' && actor === undefined) {
      const device = await this.devices.authenticate(credential);
      if (device)
        return {
          kind: 'participant',
          profileId: device.profileId,
          deviceId: device.deviceId,
          credentialId: device.credentialId,
          bootId: this.devices.bootId,
        };
    }
    throw new DataError('FORBIDDEN', 'Assigned caregiver or current paired device required');
  }
  // Caller must enforce explicit demo-enrollment configuration and private setup access.
  async demoHandle(raw: unknown) {
    const parsed = DemoSetupRequestSchema.safeParse(raw);
    if (!parsed.success) throw new DataError('VALIDATION_ERROR', 'Invalid demo setup request');
    const request = parsed.data;
    const epoch = await this.repository
      .sql`SELECT 1 FROM lemmi.gateway_state WHERE singleton AND boot_id=${this.devices.bootId}::uuid`;
    if (!epoch.length) throw new DataError('UNAVAILABLE', 'Gateway ownership changed');
    if (request.operation === 'endpoint.current' || request.operation === 'endpoint.release') {
      const identity = await this.devices.authenticate(request.credential);
      if (!identity || (request.endpoint && request.endpoint !== (identity.endpoint ?? 'robot')))
        throw new DataError('FORBIDDEN', 'Endpoint access has ended');
      const profiles = await this.repository.listProfiles(this.subject, true);
      if (!profiles.some((profile) => profile.id === identity.profileId))
        throw new DataError('FORBIDDEN', 'Demo profile is not assigned');
      if (request.operation === 'endpoint.release') {
        const revoked = await this.devices.revoke(this.subject, {
          deviceId: identity.deviceId,
          commandId: crypto.randomUUID(),
        });
        if (!revoked.ok) return revoked;
        return ok({ released: true });
      }
      return ok({
        deviceId: identity.deviceId,
        profileId: identity.profileId,
        endpoint: identity.endpoint ?? 'robot',
        expiresAt: new Date(identity.expiresAt).toISOString(),
        profile: profiles.find((profile) => profile.id === identity.profileId),
      });
    }
    if (request.operation === 'profile.list')
      return ok(await this.repository.listProfiles(this.subject, true));
    if (request.operation === 'profile.create') {
      const profile = await this.repository.createProfile(
        this.subject,
        request.input,
        true,
        this.devices.bootId,
      );
      this.coordinator.acceptPersistentProfile(profile);
      return ok(
        (await this.repository.listProfiles(this.subject, true)).find(
          (value) => value.id === profile.id,
        )!,
      );
    }
    const profiles = await this.repository.listProfiles(this.subject, true);
    if (!profiles.some((profile) => profile.id === request.profileId))
      throw new DataError('FORBIDDEN', 'Demo profile is not assigned');
    if (request.deviceId && !request.previousCredential)
      throw new DataError('FORBIDDEN', 'Existing device changes require its credential');
    if (request.previousCredential) {
      const previous = await this.devices.authenticate(request.previousCredential);
      if (
        !previous ||
        (request.deviceId && previous.deviceId !== request.deviceId) ||
        (request.previousEndpoint && request.previousEndpoint !== (previous.endpoint ?? 'robot'))
      )
        throw new DataError('FORBIDDEN', 'Endpoint is not assigned');
    }
    return ok(
      await this.devices.enroll(
        this.subject,
        request.profileId,
        request.endpoint,
        request.previousCredential,
      ),
    );
  }
  private uploadBusy = false;
  async handle(raw: unknown, actor: unknown, credential: unknown) {
    const request = DataRequestSchema.safeParse(raw);
    if (!request.success) throw new DataError('VALIDATION_ERROR', 'Invalid resource request');
    let profileId =
      'profileId' in request.data
        ? request.data.profileId
        : 'input' in request.data
          ? request.data.input.profileId
          : undefined;
    if (request.data.operation === 'asset.read' && typeof actor === 'string') {
      const rows = await this.repository
        .sql`SELECT profile_id FROM lemmi.media_assets WHERE id=${request.data.assetId}::uuid`;
      profileId = rows[0]?.profile_id;
    }
    const principal = await this.principal(actor, credential, profileId);
    switch (request.data.operation) {
      case 'profile.read':
        return ok(
          await this.repository.profile(principal, request.data.profileId, request.data.caregiver),
        );
      case 'profile.update': {
        const input = request.data.input;
        const profile = await this.repository.update(principal, input, () =>
          this.coordinator.pauseForProfileUpdate(input.patch, input.profileId),
        );
        this.coordinator.acceptPersistentProfile(profile);
        return ok(profile);
      }
      case 'asset.create': {
        if (this.uploadBusy)
          throw new DataError('UNAVAILABLE', 'An asset upload is already running');
        this.uploadBusy = true;
        try {
          return ok(await this.repository.createAsset(principal, request.data.input));
        } finally {
          this.uploadBusy = false;
        }
      }
      case 'asset.read':
        return ok(await this.repository.asset(principal, request.data.assetId, request.data.bytes));
    }
  }
}
export function dataFailure(error: unknown): Result<never> {
  return error instanceof DataError
    ? fail(error.code, error.message)
    : fail('UNAVAILABLE', 'Private data service unavailable; no mock fallback');
}
export async function openData(config: NonNullable<ReturnType<typeof dataConfig>>) {
  return new DataRepository(database(config.url), await PrivateMedia.create(config.mediaDirectory));
}
