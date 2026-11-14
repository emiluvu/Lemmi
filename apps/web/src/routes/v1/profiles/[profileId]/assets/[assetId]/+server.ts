import type { RequestHandler } from './$types';
import { fail } from '@lemmi/contracts';
import { dataHttpConfig, handleDataHttp, controlResponse } from '@lemmi/server';
const handler: RequestHandler = async ({ request, params }) => {
  try {
    if (params.profileId !== 'profile-alex')
      return controlResponse(fail('FORBIDDEN', 'Profile is not assigned'));
    return await handleDataHttp(
      request,
      { kind: 'asset', assetId: params.assetId },
      dataHttpConfig(),
    );
  } catch {
    return controlResponse(fail('UNAVAILABLE', 'Protected data service is not configured'));
  }
};
export const GET = handler;
