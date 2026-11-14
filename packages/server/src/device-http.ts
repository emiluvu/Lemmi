import { operations, fail, ResultSchema, type Operation, type Fetcher } from '@lemmi/contracts';
import {
  authenticateCaregiver,
  caregiverAuthConfig,
  type CaregiverAuthConfig,
} from './caregiver-auth';
import { controlConfig, controlResponse } from './control-config';
import { boundedJson } from './http-body';

export type DeviceHttpConfig = ReturnType<typeof controlConfig> & {
  gatewayPort: number;
  auth: CaregiverAuthConfig;
};
export function deviceHttpConfig(): DeviceHttpConfig {
  if (process.env.LEMMI_MODE !== 'live') throw new Error('Device access is disabled in mock mode');
  return {
    ...controlConfig(),
    gatewayPort: Number(process.env.GATEWAY_PORT ?? 3001),
    auth: caregiverAuthConfig(),
  };
}

// SvelteKit remains the public business HTTP boundary. Only this authenticated adapter can
// send a caregiver actor to the gateway's private, independently authenticated control seam.
export async function handleDeviceHttp(
  request: Request,
  route: { action: 'pairings' | 'revoke' | 'claim'; deviceId?: string },
  config: DeviceHttpConfig,
  fetcher: Fetcher = fetch,
): Promise<Response> {
  if (request.method !== 'POST')
    return new Response(null, { status: 405, headers: { 'Cache-Control': 'no-store' } });
  if (
    new URL(request.url).origin !== config.publicOrigin ||
    new URL(request.url).search ||
    (request.headers.has('origin') && request.headers.get('origin') !== config.publicOrigin)
  )
    return controlResponse(fail('FORBIDDEN', 'Configured same-origin HTTPS required'));
  const op: Operation =
    route.action === 'pairings'
      ? 'device.pair'
      : route.action === 'claim'
        ? 'device.claim'
        : 'device.revoke';
  let subject: string | undefined;
  if (route.action !== 'claim') {
    const identity = await authenticateCaregiver(request, config.auth, fetcher);
    if (!identity.ok) return controlResponse(identity);
    subject = identity.data.subject;
  }
  let input: unknown;
  try {
    input = await boundedJson(request);
  } catch {
    return controlResponse(fail('VALIDATION_ERROR', 'Invalid or oversized JSON'));
  }
  const parsed = operations[op].input.safeParse(input);
  if (!parsed.success)
    return controlResponse(fail('VALIDATION_ERROR', 'Invalid device access command'));
  if (route.deviceId && (!('deviceId' in parsed.data) || parsed.data.deviceId !== route.deviceId))
    return controlResponse(fail('FORBIDDEN', 'Device path and body must match'));
  try {
    const response = await fetcher(
      `http://127.0.0.1:${config.gatewayPort}/internal/control/${route.action === 'pairings' ? 'pair' : route.action}`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${config.internalToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(subject ? { actor: subject, input: parsed.data } : parsed.data),
        redirect: 'error',
        signal: AbortSignal.timeout(3000),
      },
    );
    const result = ResultSchema(operations[op].output).safeParse(await boundedJson(response));
    return controlResponse(
      result.success ? result.data : fail('UNAVAILABLE', 'Invalid control response'),
    );
  } catch {
    return controlResponse(fail('UNAVAILABLE', 'Device authority unavailable; no mock fallback'));
  }
}
