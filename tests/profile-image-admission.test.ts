import { expect, test } from 'bun:test';
import { ProfileContextSchema } from '@lemmi/contracts';
import { caregiverProfile } from '@lemmi/contracts/fixtures';
import { SessionRegistry } from '@lemmi/server';
import { PersistentData } from '../packages/server/src/data/service';
import { DataError } from '../packages/server/src/data/repository';

const subject = 'fictional-image-admission';
function fixture() {
  let revision = 0,
    entered = 0,
    writes = 0;
  let reached!: () => void, release!: () => void;
  const began = new Promise<void>((resolve) => {
    reached = resolve;
  });
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const repository = {
    sql: async () => [{ one: 1 }],
    async profile(principal: unknown, profileId: string, caregiver: boolean, demoOnly: boolean) {
      expect(principal).toMatchObject({ kind: 'caregiver', subject, profileId });
      expect(caregiver).toBe(true);
      expect(demoOnly).toBe(true);
      return {
        ...caregiverProfile,
        id: profileId,
        revision,
        approvedFacts: [],
        privacyRevision: 0,
        policyRevision: 0,
        context: ProfileContextSchema.parse({}),
        summaryMemoryEnabled: false,
        memories: [],
      };
    },
    async createAsset(
      principal: unknown,
      input: { profileId: string; expectedRevision: number },
      demoOnly: boolean,
    ) {
      entered++;
      expect(principal).toMatchObject({ kind: 'caregiver', subject, profileId: input.profileId });
      expect(demoOnly).toBe(true);
      if (entered === 1) {
        reached();
        await pending;
      }
      // Represents the repository's authoritative transaction-time check after
      // admission, independently of the earlier profile-context read.
      if (input.expectedRevision !== revision)
        throw new DataError('REVISION_CONFLICT', 'Profile changed before asset commit');
      writes++;
      return {
        id: crypto.randomUUID(),
        profileId: input.profileId,
        version: 1,
        kind: 'image',
        mediaType: 'image/png',
        byteLength: 3,
        caption: 'Fictional fixture',
        entityIds: ['profile:approved-photo'],
        approved: true,
      };
    },
  };
  const data = new PersistentData(
    repository as any,
    subject,
    new SessionRegistry(),
    Date.now,
    () => {},
  );
  const upload = (expectedRevision = 0) =>
    data.demoHandle({
      operation: 'profile.image.upload',
      input: {
        profileId: 'profile-alex',
        expectedRevision,
        commandId: crypto.randomUUID(),
        dataBase64: 'AAAA',
        description: 'Fictional fixture',
      },
    });
  return {
    data,
    upload,
    began,
    release,
    revise: () => {
      revision++;
    },
    counts: () => ({ entered, writes }),
  };
}

test('demo image uploads share one admission slot and a late revision conflict releases it', async () => {
  const f = fixture();
  const pending = f.upload();
  await f.began;
  await expect(f.upload()).rejects.toMatchObject({ code: 'UNAVAILABLE' });
  expect(f.counts()).toEqual({ entered: 1, writes: 0 });
  f.revise();
  f.release();
  await expect(pending).rejects.toMatchObject({ code: 'REVISION_CONFLICT' });
  expect(f.counts()).toEqual({ entered: 1, writes: 0 });
  expect((await f.upload(1)).ok).toBe(true);
  expect(f.counts()).toEqual({ entered: 2, writes: 1 });
  expect((await f.upload(1)).ok).toBe(true);
  expect(f.counts()).toEqual({ entered: 3, writes: 2 });
});

test('a pending demo picture also blocks entry through the ordinary asset API', async () => {
  const f = fixture();
  const pending = f.upload();
  await f.began;
  try {
    await expect(
      f.data.handle(
        {
          operation: 'asset.create',
          input: {
            profileId: 'profile-alex',
            expectedRevision: 0,
            commandId: crypto.randomUUID(),
            kind: 'image',
            mediaType: 'image/png',
            source: 'Fictional fixture',
            permission: 'Team fixture',
            caption: 'Fictional fixture',
            discussionContext: null,
            entityIds: ['profile:approved-photo'],
            approved: true,
            dataBase64: 'AAAA',
          },
        },
        subject,
        undefined,
      ),
    ).rejects.toMatchObject({ code: 'UNAVAILABLE' });
    expect(f.counts()).toEqual({ entered: 1, writes: 0 });
  } finally {
    f.release();
  }
  expect((await pending).ok).toBe(true);
  expect(f.counts()).toEqual({ entered: 1, writes: 1 });
});
