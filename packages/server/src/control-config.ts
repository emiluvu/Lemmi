import { secretMatches } from './device-access';
export function controlConfig(env: Record<string, string | undefined> = process.env) {
  const origin = new URL(env.LEMMI_PUBLIC_ORIGIN ?? '');
  if (
    origin.protocol !== 'https:' ||
    origin.origin !== env.LEMMI_PUBLIC_ORIGIN ||
    origin.username ||
    origin.password
  )
    throw new Error('LEMMI_PUBLIC_ORIGIN must be an HTTPS origin without a path');
  const internalToken = env.LEMMI_CONTROL_TOKEN ?? '';
  if (
    internalToken.length < 32 ||
    secretMatches(internalToken, env.LEMMI_MOCK_TOKEN ?? 'local-mock-only')
  )
    throw new Error(
      'LEMMI_CONTROL_TOKEN must be an independent random secret of at least 32 characters',
    );
  return { publicOrigin: origin.origin, internalToken };
}
export function bearer(request: Request): string | null {
  const header = request.headers.get('authorization') ?? '';
  return /^Bearer [\x21-\x7e]{1,4096}$/.test(header) ? header.slice(7) : null;
}
export function controlResponse(result: { ok: boolean; error?: { code: string } }) {
  const status = result.ok
    ? 200
    : ({
        UNAUTHORIZED: 401,
        FORBIDDEN: 403,
        NOT_FOUND: 404,
        REVISION_CONFLICT: 409,
        UNAVAILABLE: 503,
      }[result.error?.code ?? ''] ?? 400);
  return Response.json(result, { status, headers: { 'Cache-Control': 'no-store' } });
}
