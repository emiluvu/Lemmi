import type { RequestHandler } from './$types';
import { fail } from '@lemmi/contracts';
import { deviceHttpConfig, handleDeviceHttp, controlResponse } from '@lemmi/server';
export const POST: RequestHandler = async ({ request, params }) => {
  if (params.action !== 'pairings' && params.action !== 'revoke')
    return controlResponse(fail('NOT_FOUND', 'Unknown device operation'));
  try {
    return await handleDeviceHttp(
      request,
      { deviceId: params.deviceId, action: params.action },
      deviceHttpConfig(),
    );
  } catch {
    return controlResponse(fail('UNAVAILABLE', 'Authenticated device access is not configured'));
  }
};
