import type { RequestHandler } from './$types';
import { fail } from '@lemmi/contracts';
import { dataHttpConfig, handleDataHttp, controlResponse } from '@lemmi/server';

export const GET: RequestHandler = async ({ request, params }) => {
  try {
    return await handleDataHttp(
      request,
      { kind: 'support', profileId: params.profileId },
      dataHttpConfig(),
    );
  } catch {
    return controlResponse(fail('UNAVAILABLE', 'Protected support service is not configured'));
  }
};
