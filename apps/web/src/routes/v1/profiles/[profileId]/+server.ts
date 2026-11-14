import type { RequestHandler } from './$types';
import { fail } from '@lemmi/contracts';
import { dataHttpConfig, handleDataHttp, controlResponse } from '@lemmi/server';
const handler: RequestHandler = async ({ request, params }) => {
  try {
    if (params.profileId.startsWith('preview-'))
      return controlResponse(fail('FORBIDDEN', 'Profile is not assigned'));
    return await handleDataHttp(
      request,
      { kind: 'profile', profileId: params.profileId, caregiver: true },
      dataHttpConfig(),
    );
  } catch {
    return controlResponse(fail('UNAVAILABLE', 'Protected data service is not configured'));
  }
};
export const GET = handler;
export const PATCH = handler;
