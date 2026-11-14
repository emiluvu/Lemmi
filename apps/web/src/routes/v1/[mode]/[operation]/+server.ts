import type { RequestHandler } from './$types';
import { fail, operations } from '@lemmi/contracts';
import { MOCK_TOKEN, localMockRequestAllowed } from '@lemmi/server';
const env = process.env;
export const POST: RequestHandler = async ({ request, params, getClientAddress }) => {
  if (!localMockRequestAllowed(request, getClientAddress()))
    return Response.json(fail('FORBIDDEN', 'Same-origin local mock access only'), { status: 403 });
  if (params.mode !== 'mock')
    return Response.json(
      fail('UNAVAILABLE', 'Live adapters are not implemented; no mock fallback'),
      { status: 503 },
    );
  if (!Object.hasOwn(operations, params.operation))
    return Response.json(fail('NOT_FOUND', 'Unknown operation'), { status: 404 });
  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > 32768)
    return Response.json(fail('VALIDATION_ERROR', 'Body too large'), { status: 413 });
  const text = await request.text();
  if (new TextEncoder().encode(text).length > 32768)
    return Response.json(fail('VALIDATION_ERROR', 'Body too large'), { status: 413 });
  try {
    const response = await fetch(
      `http://127.0.0.1:${env.GATEWAY_PORT ?? 3001}/internal/mock/${params.operation}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${MOCK_TOKEN()}` },
        body: text,
        signal: AbortSignal.timeout(process.env.LEMMI_PHOTO_STORY_DEMO === '1' ? 65000 : 3000),
      },
    );
    return new Response(await response.text(), {
      status: response.status,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    });
  } catch {
    return Response.json(fail('UNAVAILABLE', 'Mock gateway is unavailable; start bun run dev'), {
      status: 503,
    });
  }
};
