import { fail, ok, type Result, type Fetcher } from '@lemmi/contracts';
import { bearer } from './control-config';
import { boundedJson } from './http-body';

export type CaregiverIdentity = { subject: string; profileId: 'profile-alex' };
export type CaregiverAuthConfig = {
  endpoint: string;
  issuer: string;
  audience: string;
  clientId: string;
  clientSecret: string;
  subject: string;
};
export function caregiverAuthConfig(
  env: Record<string, string | undefined> = process.env,
): CaregiverAuthConfig {
  const config = {
    endpoint: env.LEMMI_AUTH_INTROSPECTION_URL ?? '',
    issuer: env.LEMMI_AUTH_ISSUER ?? '',
    audience: env.LEMMI_AUTH_AUDIENCE ?? '',
    clientId: env.LEMMI_AUTH_CLIENT_ID ?? '',
    clientSecret: env.LEMMI_AUTH_CLIENT_SECRET ?? '',
    subject: env.LEMMI_CAREGIVER_SUBJECT ?? '',
  };
  if (Object.values(config).some((v) => !v))
    throw new Error('Managed caregiver authentication is not configured');
  const url = new URL(config.endpoint);
  if (url.protocol !== 'https:' || url.username || url.password || url.hash)
    throw new Error('Introspection requires HTTPS');
  return config;
}

// RFC 7662 adapter: opaque access tokens are verified by the configured identity provider.
export async function authenticateCaregiver(
  request: Request,
  config: CaregiverAuthConfig,
  fetcher: Fetcher = fetch,
  now = Date.now(),
): Promise<Result<CaregiverIdentity>> {
  const token = bearer(request);
  if (!token) return fail('UNAUTHORIZED', 'Caregiver access token required');
  try {
    const response = await fetcher(config.endpoint, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(3000),
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        authorization: `Basic ${Buffer.from(`${encodeURIComponent(config.clientId)}:${encodeURIComponent(config.clientSecret)}`).toString('base64')}`,
      },
      body: new URLSearchParams({ token, token_type_hint: 'access_token' }).toString(),
    });
    if (!response.ok) return fail('UNAVAILABLE', 'Caregiver verification unavailable');
    const value = (await boundedJson(response, 16384)) as Record<string, unknown>;
    const aud = typeof value.aud === 'string' ? [value.aud] : value.aud;
    if (
      value.active !== true ||
      value.iss !== config.issuer ||
      !Array.isArray(aud) ||
      !aud.includes(config.audience) ||
      typeof value.sub !== 'string' ||
      typeof value.exp !== 'number' ||
      !Number.isInteger(value.exp) ||
      value.exp * 1000 <= now ||
      value.exp * 1000 > now + 60 * 60_000 ||
      (value.nbf !== undefined &&
        (typeof value.nbf !== 'number' ||
          !Number.isInteger(value.nbf) ||
          value.nbf * 1000 > now)) ||
      value.token_type !== 'Bearer'
    )
      return fail('UNAUTHORIZED', 'Caregiver token is invalid or expired');
    if (value.sub !== config.subject)
      return fail('FORBIDDEN', 'Caregiver is not assigned to this profile');
    return ok({ subject: value.sub, profileId: 'profile-alex' });
  } catch {
    return fail('UNAVAILABLE', 'Caregiver verification unavailable');
  }
}
