import type { SQL } from 'bun';
import { createHash } from 'node:crypto';
import { fail, ok, type Result } from '@lemmi/contracts';
import { DataRequestSchema } from '../../../contracts/src/profile-assets';
import { DataRepository, DataError, type DataPrincipal } from './repository';
import { DatabaseDeviceAuthority } from './device-authority';
import { PrivateMedia } from './private-media';
import { database } from './database';
import type { SessionCoordinator } from '../session-coordinator';

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
    private coordinator: SessionCoordinator,
    now: () => number,
    invalidated: () => void,
    private readonly changed: () => void = () => {},
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
      this.coordinator.acceptPersistentProfile(await this.repository.approvedProfile(this.subject));
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
        snapshot.supportSelections,
      );
    };
    const result = this.checkpoints.then(work);
    this.checkpoints = result.catch(() => {});
    return result;
  }
  async close() {
    await this.profileWork;
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
  async principal(actor: unknown, credential: unknown): Promise<DataPrincipal> {
    if (typeof actor === 'string' && actor === this.subject && credential === undefined)
      return {
        kind: 'caregiver',
        subject: actor,
        profileId: 'profile-alex',
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
  private uploadBusy = false;
  private profileWork = Promise.resolve();
  private changeProfile<T>(work: () => Promise<T>): Promise<T> {
    const result = this.profileWork.then(work);
    this.profileWork = result.then(
      () => {},
      () => {},
    );
    return result;
  }
  async handle(raw: unknown, actor: unknown, credential: unknown) {
    const request = DataRequestSchema.safeParse(raw);
    if (!request.success) throw new DataError('VALIDATION_ERROR', 'Invalid resource request');
    const principal = await this.principal(actor, credential);
    switch (request.data.operation) {
      case 'support.read': {
        const id = request.data.profileId;
        return this.changeProfile(async () => {
          const profile = await this.repository.profile(principal, id, true);
          const session = this.coordinator.snapshot();
          return ok({
            profileId: id,
            profileRevision: profile.revision,
            saved: profile.communicationSupport,
            session: session?.phase === 'ended' ? null : session,
          });
        });
      }
      case 'profile.read':
        return ok(
          await this.repository.profile(principal, request.data.profileId, request.data.caregiver),
        );
      case 'profile.update': {
        const input = request.data.input;
        return this.changeProfile(async () => {
          let release: () => unknown = () => {};
          try {
            const profile = await this.repository.update(principal, input, () => {
              release = this.coordinator.beginProfileUpdate(input.patch);
              this.changed();
            });
            this.coordinator.acceptPersistentProfile(profile);
            return ok(profile);
          } finally {
            release();
          }
        });
      }
      case 'support.apply': {
        const input = request.data.input;
        return this.changeProfile(async () => {
          let release: () => unknown = () => {};
          try {
            const result = await this.repository.withSupportProfile(principal, input, (profile) => {
              const applied = this.coordinator.applyCommunicationSupport(
                input,
                profile,
                principal.kind === 'caregiver' ? principal.subject : '',
              );
              if (applied.ok) {
                release = this.coordinator.holdConfiguration();
                this.changed();
              }
              return applied;
            });
            if (!result.ok) return result;
            try {
              await this.checkpoint();
            } catch {
              this.coordinator.disconnect();
              this.changed();
              throw new DataError(
                'UNAVAILABLE',
                'Support checkpoint failed; interaction remains paused',
              );
            }
            const latest = this.coordinator.snapshot();
            if (
              !latest ||
              latest.id !== result.data.id ||
              latest.generation !== result.data.generation ||
              latest.phase !== 'paused'
            )
              throw new DataError(
                'REVISION_CONFLICT',
                'Session changed during support apply; reload its state',
              );
            return ok(latest);
          } finally {
            release();
          }
        });
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
