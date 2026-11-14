import { controlConfig, hasPrivateAccess } from '@lemmi/server';
import { endpointCookie } from '#lib/server/demo.ts';

const assets = new Set(['photo-story-garden', 'photo-story-park']);
const headers = {
  'Content-Type': 'image/svg+xml',
  'Cache-Control': 'no-store, private',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; sandbox",
};
const denied = (status: number) =>
  new Response(null, {
    status,
    headers: { 'Cache-Control': 'no-store, private' },
  });
export const GET = async ({
  request,
  params,
}: {
  request: Request;
  params: { assetId: string };
}): Promise<Response> => {
  if (process.env.LEMMI_MODE !== 'live' || process.env.LEMMI_DEMO_ENROLLMENT !== '1')
    return denied(404);
  if (!assets.has(params.assetId)) return denied(404);
  try {
    const config = controlConfig();
    const url = new URL(request.url);
    if (
      url.origin !== config.publicOrigin ||
      url.search ||
      (request.headers.has('origin') && request.headers.get('origin') !== config.publicOrigin)
    )
      return denied(403);
    if (!hasPrivateAccess(request, config.accessKey)) return denied(401);
    const credential = endpointCookie(request);
    if (!credential) return denied(401);
    const response = await fetch(
      `http://127.0.0.1:${Number(process.env.GATEWAY_PORT ?? 3001)}/internal/data`,
      {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(5000),
        headers: {
          authorization: `Bearer ${config.internalToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          operation: 'photo.scene.read',
          credential,
          assetId: params.assetId,
        }),
      },
    );
    if (!response.ok) {
      await response.body?.cancel();
      return denied([401, 403, 404, 409, 503].includes(response.status) ? response.status : 503);
    }
    if (response.headers.get('content-type')?.split(';')[0] !== 'image/svg+xml') {
      await response.body?.cancel();
      return denied(503);
    }
    const reader = response.body?.getReader();
    if (!reader) return denied(503);
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > 65536) {
          await reader.cancel();
          return denied(503);
        }
        chunks.push(chunk.value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new Response(bytes, { headers: { ...headers, 'Content-Length': String(size) } });
  } catch {
    return denied(503);
  }
};
