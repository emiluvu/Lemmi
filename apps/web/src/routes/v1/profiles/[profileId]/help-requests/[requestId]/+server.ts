import type { RequestHandler } from './$types';
import { handleHelpHttp, deviceHttpConfig, controlResponse } from '@lemmi/server';
import { fail } from '@lemmi/contracts';
export const GET: RequestHandler = async ({ request, params }) => {
  try {
    return await handleHelpHttp(
      request,
      { profileId: params.profileId, requestId: params.requestId },
      deviceHttpConfig(),
    );
  } catch {
    return controlResponse(fail('UNAVAILABLE', 'Protected contact service unavailable'));
  }
};
