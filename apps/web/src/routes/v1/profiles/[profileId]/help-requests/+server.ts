import type { RequestHandler } from './$types';
import { handleHelpHttp, deviceHttpConfig, controlResponse } from '@lemmi/server';
import { fail } from '@lemmi/contracts';
export const POST: RequestHandler = async ({ request, params }) => {
  try {
    return await handleHelpHttp(request, { profileId: params.profileId }, deviceHttpConfig());
  } catch {
    return controlResponse(fail('UNAVAILABLE', 'Protected contact service unavailable'));
  }
};
