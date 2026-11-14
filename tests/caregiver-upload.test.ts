import { test, expect } from 'bun:test';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import {
  authenticatedUploadFetcher,
  browserCaregiverLogin,
  uploadAlexMusic,
} from '../scripts/lib/caregiver-upload';
import { alexProfileDetail, alexFavoriteSong } from '@lemmi/activities';
import type { Fetcher } from '@lemmi/contracts';

test('upload credentials cannot leave the selected HTTPS origin or follow redirects', async () => {
  let calls = 0;
  const fetcher = authenticatedUploadFetcher(
    'https://backend.invalid',
    'fixture-token',
    '',
    async (_, init) => {
      calls++;
      expect(init?.redirect).toBe('error');
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer fixture-token');
      return Response.json({});
    },
  );
  await expect(fetcher('https://other.invalid/v1/profiles/profile-alex')).rejects.toThrow();
  await expect(fetcher('/v1/profiles/preview-sam')).rejects.toThrow();
  await expect(fetcher('/v1/profiles/profile-alex?token=bad')).rejects.toThrow();
  expect(calls).toBe(0);
  await fetcher('/v1/profiles/profile-alex');
  expect(calls).toBe(1);
});

async function preparedSong() {
  const root = await mkdtemp(join(tmpdir(), 'lemmi-upload-'));
  const media = join(root, 'alex-profile-media');
  await mkdir(media);
  const pcm = Buffer.alloc(640);
  const wav = Buffer.alloc(44 + pcm.length);
  wav.write('RIFF');
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(32000, 24);
  wav.writeUInt32LE(64000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(pcm.length, 40);
  const file = join(media, 'fixture.wav');
  await writeFile(file, wav);
  await writeFile(
    join(media, 'manifest.json'),
    JSON.stringify([
      {
        inputFile: alexFavoriteSong.file,
        sha256: createHash('sha256').update(wav).digest('hex'),
        mediaType: 'audio/wav',
        fullRecording: true,
      },
    ]),
  );
  return {
    root,
    wav,
    options: {
      origin: 'https://backend.invalid',
      token: 'fixture-token',
      accessKey: '',
      file,
      receiptDirectory: join(root, 'alex-uploads'),
    },
  };
}

test('a rejected caregiver cannot upload approved music', async () => {
  const { root, options } = await preparedSong();
  let uploads = 0;
  try {
    await expect(
      uploadAlexMusic(options, async (_, init) => {
        if (init?.method === 'POST') uploads++;
        return Response.json({
          ok: false,
          error: { code: 'FORBIDDEN', message: 'Wrong caregiver' },
        });
      }),
    ).rejects.toThrow('No upload sent');
    expect(uploads).toBe(0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('uncertain upload retries retain command/revision and never save tokens or audio', async () => {
  const { root, wav, options } = await preparedSong();
  const payloads: Record<string, unknown>[] = [];
  let first = true;
  const fetcher: Fetcher = async (_, init) => {
    if (init?.method !== 'POST')
      return Response.json({ ok: true, data: { ...alexProfileDetail, revision: first ? 3 : 4 } });
    const payload = JSON.parse(String(init.body));
    payloads.push(payload);
    expect(payload.permission).toBe(alexFavoriteSong.uploadPermission);
    expect(payload.source).toBe(alexFavoriteSong.uploadSource);
    expect(payload.approved).toBe(true);
    expect(Buffer.from(payload.dataBase64, 'base64')).toEqual(wav);
    if (first) {
      first = false;
      throw new Error('Response lost after commit');
    }
    return Response.json({
      ok: true,
      data: {
        id: 'c1e00000-0000-4000-8000-000000000001',
        profileId: 'profile-alex',
        version: 1,
        kind: 'music',
        mediaType: 'audio/wav',
        byteLength: wav.length,
        caption: payload.caption,
        entityIds: payload.entityIds,
        approved: true,
      },
    });
  };
  try {
    await expect(uploadAlexMusic(options, fetcher)).rejects.toThrow('Upload not confirmed');
    const asset = await uploadAlexMusic(options, fetcher);
    expect(asset.approved).toBe(true);
    expect(payloads[1]).toEqual(payloads[0]);
    expect(payloads[1]?.expectedRevision).toBe(3);
    for (const name of await readdir(options.receiptDirectory)) {
      const value = await readFile(join(options.receiptDirectory, name), 'utf8');
      expect(value).not.toContain('fixture-token');
      expect(value).not.toContain('dataBase64');
      expect(value).not.toContain(options.file);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('changed media cannot be uploaded under the inspected song manifest', async () => {
  const { root, options } = await preparedSong();
  let calls = 0;
  try {
    const bytes = Buffer.from(await Bun.file(options.file).arrayBuffer());
    bytes[44] = 1;
    await writeFile(options.file, bytes);
    await expect(
      uploadAlexMusic(options, async () => {
        calls++;
        return Response.json({});
      }),
    ).rejects.toThrow('manifest');
    expect(calls).toBe(0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('browser code/PKCE sign-in rejects wrong state, binds the verifier and keeps provider errors private', async () => {
  const issuer = 'https://identity.invalid/oidc';
  let authorization!: URL;
  let exchanges = 0;
  const fetcher: Fetcher = async (path, init) => {
    if (String(path).endsWith('openid-configuration'))
      return Response.json({
        issuer,
        authorization_endpoint: issuer + '/auth',
        token_endpoint: issuer + '/token',
      });
    exchanges++;
    const body = new URLSearchParams(String(init?.body));
    expect(body.get('redirect_uri')).toBe('http://127.0.0.1:3333/callback');
    expect(createHash('sha256').update(body.get('code_verifier')!).digest('base64url')).toBe(
      authorization.searchParams.get('code_challenge')!,
    );
    expect(init?.redirect).toBe('error');
    return Response.json({ access_token: 'fixture-token', token_type: 'Bearer' });
  };
  const token = await browserCaregiverLogin(
    {
      issuer,
      clientId: 'fixture-client',
      clientSecret: '',
      async open(url) {
        authorization = new URL(url);
        const callback = new URL(authorization.searchParams.get('redirect_uri')!);
        callback.searchParams.set('code', 'fixture-code');
        callback.searchParams.set('state', 'bad-state');
        expect((await fetch(callback)).status).toBe(403);
        expect(exchanges).toBe(0);
        callback.searchParams.set('state', authorization.searchParams.get('state')!);
        const response = await fetch(callback);
        expect(response.headers.get('cache-control')).toBe('no-store');
        expect(await response.text()).not.toContain('fixture-token');
      },
    },
    fetcher,
  );
  expect(token).toBe('fixture-token');
  expect(exchanges).toBe(1);
});
