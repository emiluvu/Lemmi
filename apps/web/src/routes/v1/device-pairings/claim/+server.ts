import type { RequestHandler } from './$types';
import { fail } from '@lemmi/contracts';
import { deviceHttpConfig, handleDeviceHttp, controlResponse } from '@lemmi/server';
export const POST: RequestHandler = async ({ request }) => {
  try {
    return await handleDeviceHttp(request, { action: 'claim' }, deviceHttpConfig());
  } catch {
    return controlResponse(fail('UNAVAILABLE', 'Authenticated device access is not configured'));
  }
};
