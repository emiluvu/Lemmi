import type { RequestHandler } from './$types';
import { fail } from '@lemmi/contracts';
import { controlResponse } from '@lemmi/server';
import { handleDemoHttp } from '#lib/server/demo.ts';
const handle: RequestHandler = async ({ request, params }) => {
  try {
    return await handleDemoHttp(request, params.operation);
  } catch {
    return controlResponse(fail('UNAVAILABLE', 'Participant setup unavailable; retry explicitly'));
  }
};
export const GET = handle;
export const POST = handle;
