import { fail, ResultSchema, SessionSnapshotSchema } from '@lemmi/contracts';
import { authenticateCaregiver } from '../caregiver-auth';
import { bearer, controlResponse } from '../control-config';
import { boundedJson } from '../http-body';
import { deviceHttpConfig, type DeviceHttpConfig } from '../device-http';
import {
  AssetCreateSchema,
  AssetMetadataSchema,
  AssetIdSchema,
  ProfileDetailSchema,
  ProfileUpdateSchema,
  ApplyCommunicationSupportSchema,
  CommunicationSupportStateSchema,
} from '../../../contracts/src/profile-assets';
import { ParticipantProfileSchema } from '@lemmi/contracts';
import type { Fetcher } from '@lemmi/contracts';

export type DataRoute =
  | { kind: 'support'; profileId: string; apply?: boolean }
  | { kind: 'profile'; profileId: string; caregiver?: boolean; participant?: boolean }
  | { kind: 'upload'; profileId: string; photosOnly?: boolean }
  | { kind: 'asset'; assetId: string; metadata?: boolean; participant?: boolean };
export function dataHttpConfig() {
  return deviceHttpConfig();
}
export async function handleDataHttp(
  request: Request,
  route: DataRoute,
  config: DeviceHttpConfig,
  fetcher: Fetcher = fetch,
): Promise<Response> {
  const url = new URL(request.url);
  const method = request.method;
  const allowed =
    route.kind === 'support'
      ? route.apply
        ? ['POST']
        : ['GET']
      : route.kind === 'profile'
        ? ['GET', 'PATCH']
        : route.kind === 'upload'
          ? ['POST']
          : ['GET'];
  if (method === 'PATCH' && route.kind === 'profile' && !route.caregiver)
    return controlResponse(fail('FORBIDDEN', 'Participant scope is read-only'));
  if (!allowed.includes(method))
    return new Response(null, {
      status: 405,
      headers: { Allow: allowed.join(', '), 'Cache-Control': 'no-store' },
    });
  if (
    url.origin !== config.publicOrigin ||
    url.search ||
    (request.headers.has('origin') && request.headers.get('origin') !== config.publicOrigin)
  )
    return controlResponse(fail('FORBIDDEN', 'Configured same-origin HTTPS required'));
  if ('profileId' in route && route.profileId !== 'profile-alex')
    return controlResponse(fail('FORBIDDEN', 'Only Alex is assigned'));
  if (route.kind === 'asset' && !AssetIdSchema.safeParse(route.assetId).success)
    return controlResponse(fail('NOT_FOUND', 'Approved asset not found'));
  const token = bearer(request);
  if (!token)
    return controlResponse(
      fail('UNAUTHORIZED', 'Caregiver or paired participant access token required'),
    );
  const participant = 'participant' in route && route.participant === true;
  if (participant && (method !== 'GET' || (route.kind === 'profile' && route.caregiver)))
    return controlResponse(fail('FORBIDDEN', 'Participant scope is read-only'));
  let actor: string | undefined;
  if (!participant) {
    const verified = await authenticateCaregiver(request, config.auth, fetcher);
    if (!verified.ok) return controlResponse(verified);
    actor = verified.data.subject;
  }
  let operation: Record<string, unknown>;
  let schema =
    route.kind === 'support'
      ? route.apply
        ? SessionSnapshotSchema
        : CommunicationSupportStateSchema
      : route.kind === 'asset'
        ? AssetMetadataSchema
        : route.kind === 'profile' && !route.caregiver && method === 'GET'
          ? ParticipantProfileSchema
          : ProfileDetailSchema;
  if (route.kind === 'support' && !route.apply) {
    operation = { operation: 'support.read', profileId: route.profileId };
  } else if (route.kind === 'support') {
    let raw: unknown;
    try {
      raw = await boundedJson(request, 4096);
    } catch {
      return controlResponse(fail('VALIDATION_ERROR', 'Invalid or oversized JSON'));
    }
    const parsed = ApplyCommunicationSupportSchema.safeParse(raw);
    if (!parsed.success)
      return controlResponse(fail('VALIDATION_ERROR', 'Invalid support apply request'));
    if (parsed.data.profileId !== route.profileId)
      return controlResponse(fail('FORBIDDEN', 'Resource path/body mismatch'));
    operation = { operation: 'support.apply', input: parsed.data };
  } else if (method === 'PATCH' || method === 'POST') {
    let raw: unknown;
    try {
      raw = await boundedJson(request, route.kind === 'upload' ? 28 * 1024 * 1024 : 32768);
    } catch {
      return controlResponse(fail('VALIDATION_ERROR', 'Invalid or oversized JSON'));
    }
    const parsed =
      method === 'PATCH' ? ProfileUpdateSchema.safeParse(raw) : AssetCreateSchema.safeParse(raw);
    if (!parsed.success)
      return controlResponse(fail('VALIDATION_ERROR', 'Invalid resource mutation'));
    if ('profileId' in route && parsed.data.profileId !== route.profileId)
      return controlResponse(fail('FORBIDDEN', 'Resource path/body mismatch'));
    if (
      route.kind === 'upload' &&
      route.photosOnly &&
      'kind' in parsed.data &&
      parsed.data.kind !== 'image'
    )
      return controlResponse(fail('VALIDATION_ERROR', 'Photo upload requires an image'));
    operation = {
      operation: method === 'PATCH' ? 'profile.update' : 'asset.create',
      input: parsed.data,
    };
    schema = method === 'PATCH' ? ProfileDetailSchema : AssetMetadataSchema;
  } else
    operation =
      route.kind === 'profile'
        ? {
            operation: 'profile.read',
            profileId: route.profileId,
            caregiver: route.caregiver ?? false,
          }
        : {
            operation: 'asset.read',
            assetId: route.kind === 'asset' ? route.assetId : '',
            bytes: route.kind === 'asset' && !route.metadata,
          };
  try {
    const response = await fetcher(`http://127.0.0.1:${config.gatewayPort}/internal/data`, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
      headers: {
        authorization: `Bearer ${config.internalToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ ...operation, ...(actor ? { actor } : { credential: token }) }),
    });
    if (
      route.kind === 'asset' &&
      !route.metadata &&
      response.ok &&
      response.headers.get('content-type') !== 'application/json'
    ) {
      // Already authenticated/authorized by the authority. No raw paths or redirect URLs.
      const headers = new Headers({
        'Cache-Control': 'no-store, private',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'Content-Disposition': 'inline',
      });
      for (const key of ['content-type', 'content-length', 'content-range', 'accept-ranges'])
        if (response.headers.has(key)) headers.set(key, response.headers.get(key)!);
      return new Response(response.body, { status: response.status, headers });
    }
    const value = ResultSchema(schema).safeParse(await boundedJson(response, 32768));
    return controlResponse(
      value.success ? value.data : fail('UNAVAILABLE', 'Invalid private data response'),
    );
  } catch {
    return controlResponse(
      fail('UNAVAILABLE', 'Private data service unavailable; no mock fallback'),
    );
  }
}
