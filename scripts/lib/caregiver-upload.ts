// Local API consumer only. Existing backend owns identity, scope and approval storage.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  createClients,
  createHttpTransport,
  type Fetcher,
  AssetCreateSchema,
  AssetMetadataSchema,
  type AssetMetadata,
} from '@lemmi/contracts';
import { decodeMedia } from '../../packages/server/src/data/private-media';
import { alexFavoriteSong } from '@lemmi/activities';

export function httpsOrigin(value: string): string {
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  )
    throw new Error('Use a plain HTTPS backend origin');
  return url.origin;
}

export function authenticatedUploadFetcher(
  origin: string,
  token: string,
  accessKey: string,
  fetcher: Fetcher = fetch,
): Fetcher {
  const base = httpsOrigin(origin);
  if (!/^[\x21-\x7e]{1,4096}$/.test(token)) throw new Error('Invalid caregiver token');
  if (accessKey && !/^[\x21-\x7e]{32,256}$/.test(accessKey))
    throw new Error('Invalid private access key');
  return async (path, init) => {
    const url = new URL(String(path), base);
    if (
      url.origin !== base ||
      !/^\/v1\/profiles\/profile-alex(?:\/assets)?$/.test(url.pathname) ||
      url.search ||
      url.hash
    )
      throw new Error('Unexpected upload API route');
    const headers = new Headers(init?.headers);
    headers.set('authorization', `Bearer ${token}`);
    if (accessKey) headers.set('x-lemmi-access-key', accessKey);
    return fetcher(url, {
      ...init,
      headers,
      redirect: 'error',
      signal: AbortSignal.timeout(init?.method === 'POST' ? 60000 : 15000),
    });
  };
}

export async function uploadAlexMusic(
  input: {
    origin: string;
    token: string;
    accessKey: string;
    file: string;
    receiptDirectory: string;
  },
  fetcher: Fetcher = fetch,
): Promise<AssetMetadata> {
  const origin = httpsOrigin(input.origin);
  // Bound before buffering/base64. No MP3, microphone or synthesized speech uploads.
  const file = Bun.file(input.file);
  if (!(await file.exists()) || file.size > 20 * 1024 * 1024)
    throw new Error('Missing or oversized WAV');
  const bytes = Buffer.from(await file.arrayBuffer());
  try {
    const base64 = bytes.toString('base64');
    decodeMedia(base64, 'audio/wav');
    const digest = createHash('sha256').update(bytes).digest('hex');
    // Bind to the inspected full-song derivative, not an arbitrary recording.
    const manifestFile = join(input.receiptDirectory, '..', 'alex-profile-media', 'manifest.json');
    const manifest: unknown = JSON.parse(await readFile(manifestFile, 'utf8'));
    if (
      !Array.isArray(manifest) ||
      !manifest.some(
        (item) =>
          item?.inputFile === alexFavoriteSong.file &&
          item?.sha256 === digest &&
          item?.mediaType === 'audio/wav' &&
          item?.fullRecording === true,
      )
    )
      throw new Error(
        'WAV does not match the prepared full-song manifest; rerun media preparation',
      );
    const clients = createClients(
      createHttpTransport(
        'live',
        authenticatedUploadFetcher(origin, input.token, input.accessKey, fetcher),
      ),
    );
    const current = await clients.profile.detail({ profileId: 'profile-alex' });
    if (!current.ok)
      throw new Error(
        `Caregiver verification/profile read failed (${current.error.code}). No upload sent.`,
      );
    if (current.data.id !== 'profile-alex') throw new Error('Unexpected assigned profile');
    const content = {
      profileId: 'profile-alex',
      kind: 'music' as const,
      mediaType: 'audio/wav' as const,
      source: alexFavoriteSong.uploadSource,
      permission: alexFavoriteSong.uploadPermission,
      caption: 'My Way — Frank Sinatra (caregiver-provided selection).',
      discussionContext: null,
      entityIds: ['topic:music'],
      approved: true as const,
    };
    const fingerprint = createHash('sha256')
      .update(JSON.stringify({ origin, content, digest }))
      .digest('hex');
    await mkdir(input.receiptDirectory, { recursive: true, mode: 0o700 });
    const receiptFile = join(input.receiptDirectory, `${fingerprint}.json`);
    const newReceipt = {
      version: 1,
      fingerprint,
      origin,
      sha256: digest,
      commandId: crypto.randomUUID(),
      expectedRevision: current.data.revision,
      approvalRecordedAt: new Date().toISOString(),
    };
    try {
      await writeFile(receiptFile, JSON.stringify(newReceipt, null, 2), {
        flag: 'wx',
        mode: 0o600,
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
    const receipt: unknown = JSON.parse(await readFile(receiptFile, 'utf8'));
    if (
      !receipt ||
      typeof receipt !== 'object' ||
      !('fingerprint' in receipt) ||
      receipt.fingerprint !== fingerprint ||
      !('commandId' in receipt) ||
      !('expectedRevision' in receipt) ||
      !('approvalRecordedAt' in receipt) ||
      typeof receipt.approvalRecordedAt !== 'string'
    )
      throw new Error('Invalid local upload receipt; no upload sent');
    const payload = AssetCreateSchema.parse({
      ...content,
      commandId: receipt.commandId,
      expectedRevision: receipt.expectedRevision,
      dataBase64: base64,
    });
    const result = await clients.assets.create(payload);
    if (!result.ok)
      throw new Error(
        `Upload not confirmed (${result.error.code}). Keep the receipt and retry the same command. For REVISION_CONFLICT, ask Anay to review the receipt before starting another upload.`,
      );
    const asset = AssetMetadataSchema.parse(result.data);
    if (
      asset.kind !== 'music' ||
      asset.mediaType !== 'audio/wav' ||
      asset.byteLength !== bytes.length ||
      asset.caption !== content.caption ||
      JSON.stringify(asset.entityIds) !== JSON.stringify(content.entityIds)
    )
      throw new Error('Unexpected upload metadata; retain the receipt for review');
    await writeFile(
      join(input.receiptDirectory, `${fingerprint}.result.json`),
      JSON.stringify({ asset, approvalRecordedAt: receipt.approvalRecordedAt }, null, 2),
      { mode: 0o600 },
    );
    return asset;
  } finally {
    bytes.fill(0);
  }
}

export function oidcEndpoint(issuer: string, value: unknown): string {
  const base = new URL(issuer);
  const url = new URL(String(value));
  if (
    base.protocol !== 'https:' ||
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    url.protocol !== 'https:' ||
    url.origin !== base.origin ||
    url.username ||
    url.password ||
    url.hash
  )
    throw new Error('Unexpected OIDC endpoint');
  return url.href;
}

async function smallJson(response: Response): Promise<Record<string, unknown>> {
  if (!response.ok || !response.body) throw new Error('Identity provider request rejected');
  const reader = response.body.getReader();
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16384) throw new Error('Identity response too large');
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  const value: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid identity response');
  return value as Record<string, unknown>;
}

// Same code/PKCE pattern and registered loopback URI as setup-caregiver.ts.
// Unlike setup, this never introspects with server credentials or assigns Alex.
export async function browserCaregiverLogin(
  input: {
    issuer: string;
    clientId: string;
    clientSecret: string;
    open: (url: string) => void | Promise<void>;
  },
  fetcher: Fetcher = fetch,
): Promise<string> {
  const issuer = input.issuer.replace(/\/$/, '');
  oidcEndpoint(issuer, issuer);
  if (!input.clientId) throw new Error('Caregiver OIDC client ID is required');
  const metadata = await smallJson(
    await fetcher(`${issuer}/.well-known/openid-configuration`, {
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    }),
  );
  if (metadata.issuer !== issuer) throw new Error('OIDC issuer mismatch');
  const authorization = new URL(oidcEndpoint(issuer, metadata.authorization_endpoint));
  const tokenEndpoint = oidcEndpoint(issuer, metadata.token_endpoint);
  const state = crypto.randomUUID();
  const verifier = crypto.randomUUID() + crypto.randomUUID();
  const redirect = 'http://127.0.0.1:3333/callback';
  for (const [key, value] of Object.entries({
    client_id: input.clientId,
    redirect_uri: redirect,
    response_type: 'code',
    scope: 'openid',
    state,
    code_challenge_method: 'S256',
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
  }))
    authorization.searchParams.set(key, value);
  let resolve!: (token: string) => void;
  let reject!: (error: Error) => void;
  const completed = new Promise<string>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  // The callback may reject while the browser-opening task is still pending.
  void completed.catch(() => {});
  let busy = false;
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 3333,
    maxRequestBodySize: 4096,
    async fetch(request) {
      const url = new URL(request.url);
      const headers = {
        'Cache-Control': 'no-store',
        'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
        'Referrer-Policy': 'no-referrer',
      };
      if (
        request.method !== 'GET' ||
        url.origin !== 'http://127.0.0.1:3333' ||
        url.pathname !== '/callback'
      )
        return new Response('Not found', { status: 404, headers });
      if (
        busy ||
        url.searchParams.getAll('state').length !== 1 ||
        url.searchParams.get('state') !== state
      )
        return new Response('Invalid login callback', { status: 403, headers });
      busy = true;
      try {
        const code = url.searchParams.get('code');
        if (
          url.searchParams.has('error') ||
          !code ||
          code.length > 4096 ||
          url.searchParams.getAll('code').length !== 1
        )
          throw new Error('Caregiver login was not completed');
        const tokenHeaders = new Headers({ 'content-type': 'application/x-www-form-urlencoded' });
        if (input.clientSecret)
          tokenHeaders.set(
            'authorization',
            `Basic ${Buffer.from(`${encodeURIComponent(input.clientId)}:${encodeURIComponent(input.clientSecret)}`).toString('base64')}`,
          );
        const tokens = await smallJson(
          await fetcher(tokenEndpoint, {
            method: 'POST',
            headers: tokenHeaders,
            redirect: 'error',
            signal: AbortSignal.timeout(15000),
            body: new URLSearchParams({
              grant_type: 'authorization_code',
              client_id: input.clientId,
              code,
              redirect_uri: redirect,
              code_verifier: verifier,
            }),
          }),
        );
        if (
          tokens.token_type !== 'Bearer' ||
          typeof tokens.access_token !== 'string' ||
          !/^[\x21-\x7e]{1,4096}$/.test(tokens.access_token)
        )
          throw new Error('No caregiver bearer token');
        resolve(tokens.access_token);
        return new Response('Sign-in complete. Return to the terminal for the upload result.', {
          headers,
        });
      } catch {
        reject(
          new Error(
            'Caregiver login failed. Check private OIDC client settings; no upload was sent.',
          ),
        );
        return new Response('Sign-in failed. Return to the terminal.', { status: 400, headers });
      }
    },
  });
  const timeout = setTimeout(
    () => reject(new Error('Caregiver sign-in timed out; no upload sent')),
    5 * 60000,
  );
  try {
    await input.open(authorization.href);
    return await completed;
  } finally {
    clearTimeout(timeout);
    server.stop(false);
  }
}
