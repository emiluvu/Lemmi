import type { RequestHandler } from './$types';
import { fail } from '@lemmi/contracts';
import { dataHttpConfig, handleDataHttp, controlResponse } from '@lemmi/server';
const handler: RequestHandler = async ({ request, params }) => {
  try {
    return await handleDataHttp(
      request,
      { kind: 'asset', assetId: params.assetId, participant: true },
      dataHttpConfig(),
    );
  } catch {
    return controlResponse(fail('UNAVAILABLE', 'Protected data service is not configured'));
  }
};
export const GET = handler;
