import {
  ParticipantProfileSchema,
  ParticipantProfilesSchema,
  ParticipantEnrollmentSchema,
  ParticipantEndpointSchema,
  ParticipantCreateSchema,
  ParticipantEnrollRequestSchema,
  ParticipantEmptySchema,
  ParticipantReleaseSchema,
  ResultSchema,
  fail,
} from '@lemmi/contracts';
import type { Fetcher } from '@lemmi/contracts';
import { boundedJson, controlConfig, controlResponse, hasPrivateAccess } from '@lemmi/server';

const COOKIE = '__Host-lemmi_endpoint';
export function endpointCookie(request: Request): string | undefined {
  const matches = (request.headers.get('cookie') ?? '')
    .split(';')
    .map((v) => v.trim())
    .filter((v) => v.startsWith(`${COOKIE}=`));
  if (matches.length !== 1) return undefined;
  const value = matches[0]!.slice(COOKIE.length + 1);
  return /^[A-Za-z0-9_-]{40,100}$/.test(value) ? value : undefined;
}
export async function handleDemoHttp(
  request: Request,
  operation: string,
  fetcher: Fetcher = fetch,
) {
  if (process.env.LEMMI_MODE !== 'live' || process.env.LEMMI_DEMO_ENROLLMENT !== '1')
    return controlResponse(fail('UNAVAILABLE', 'Fictional demo enrollment is disabled'));
  const config = controlConfig();
  const url = new URL(request.url);
  if (
    url.origin !== config.publicOrigin ||
    url.search ||
    (request.headers.has('origin') && request.headers.get('origin') !== config.publicOrigin) ||
    (request.method !== 'GET' &&
      request.headers.get('origin') !== config.publicOrigin &&
      !request.headers.has('x-lemmi-access-key'))
  )
    return controlResponse(fail('FORBIDDEN', 'Configured same-origin request required'));
  if (!hasPrivateAccess(request, config.accessKey))
    return controlResponse(fail('UNAUTHORIZED', 'Unlock private access first'));
  const routes: Record<string, { method: string; name: string }> = {
    profiles: {
      method: request.method === 'GET' ? 'GET' : 'POST',
      name: request.method === 'GET' ? 'profile.list' : 'profile.create',
    },
    enroll: { method: 'POST', name: 'endpoint.enroll' },
    current: { method: 'GET', name: 'endpoint.current' },
    release: { method: 'POST', name: 'endpoint.release' },
  };
  const route = routes[operation];
  if (!route) return controlResponse(fail('NOT_FOUND', 'Unknown demo operation'));
  if (route.method !== request.method) return new Response(null, { status: 405 });
  let body: Record<string, unknown> = {};
  if (request.method === 'POST') {
    const schema =
      operation === 'profiles'
        ? ParticipantCreateSchema
        : operation === 'enroll'
          ? ParticipantEnrollRequestSchema
          : ParticipantEmptySchema;
    try {
      const parsed = schema.safeParse(await boundedJson(request, 4096));
      if (!parsed.success)
        return controlResponse(fail('VALIDATION_ERROR', 'Invalid setup request'));
      body = parsed.data;
    } catch {
      return controlResponse(fail('VALIDATION_ERROR', 'Invalid setup request'));
    }
  }
  const credential = endpointCookie(request);
  if ((operation === 'current' || operation === 'release') && !credential)
    return controlResponse(fail('UNAUTHORIZED', 'Choose a participant for this browser'));
  const raw = {
    operation: route.name,
    ...(operation === 'profiles' && request.method === 'POST' ? { input: body } : body),
    ...(operation === 'current' || operation === 'release'
      ? { credential, endpoint: 'browser' }
      : {}),
    ...(operation === 'enroll' && credential
      ? { previousCredential: credential, previousEndpoint: 'browser' }
      : {}),
  };
  const response = await fetcher(
    `http://127.0.0.1:${Number(process.env.GATEWAY_PORT ?? 3001)}/internal/demo`,
    {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
      headers: {
        authorization: `Bearer ${config.internalToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(raw),
    },
  );
  const schema =
    operation === 'profiles'
      ? request.method === 'GET'
        ? ParticipantProfilesSchema
        : ParticipantProfileSchema
      : operation === 'enroll'
        ? ParticipantEnrollmentSchema
        : operation === 'current'
          ? ParticipantEndpointSchema
          : ParticipantReleaseSchema;
  const result = ResultSchema(schema).safeParse(await boundedJson(response, 32768));
  if (!result.success) return controlResponse(fail('UNAVAILABLE', 'Invalid setup response'));
  if (!result.data.ok) {
    const outgoing = controlResponse(result.data);
    if (
      (operation === 'current' || operation === 'release' || operation === 'enroll') &&
      ['UNAUTHORIZED', 'FORBIDDEN'].includes(result.data.error.code)
    )
      outgoing.headers.set(
        'set-cookie',
        `${COOKIE}=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0`,
      );
    return outgoing;
  }
  const value = result.data.data;
  if (operation === 'enroll' && 'credential' in value && value.endpoint === 'browser') {
    const { credential: token, ...safe } = value;
    if (value.expiresAt === null) throw new Error('Browser enrollment requires finite expiry');
    const expiry = Math.max(0, Math.floor((Date.parse(value.expiresAt) - Date.now()) / 1000));
    return Response.json(
      { ok: true, data: safe },
      {
        headers: {
          'cache-control': 'no-store',
          'set-cookie': `${COOKIE}=${token}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${expiry}`,
        },
      },
    );
  }
  const outgoing = controlResponse(result.data);
  if (operation === 'release')
    outgoing.headers.set(
      'set-cookie',
      `${COOKIE}=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0`,
    );
  return outgoing;
}
