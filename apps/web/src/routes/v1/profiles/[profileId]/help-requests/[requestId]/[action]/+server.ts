import type { RequestHandler } from './$types';
import { handleHelpHttp, deviceHttpConfig, controlResponse } from '@lemmi/server';
import { fail } from '@lemmi/contracts';
export const POST: RequestHandler = async ({ request, params }) => {
  if (!['acknowledge', 'cancel', 'resolve'].includes(params.action))
    return controlResponse(fail('NOT_FOUND', 'Unknown help action'));
  try {
    return await handleHelpHttp(
      request,
      {
        profileId: params.profileId,
        requestId: params.requestId,
        action: params.action as 'acknowledge' | 'cancel' | 'resolve',
      },
      deviceHttpConfig(),
    );
  } catch {
    return controlResponse(fail('UNAVAILABLE', 'Protected contact service unavailable'));
  }
};
