import type { Handle } from '@sveltejs/kit/hooks';
import { isLoopbackHost } from '@lemmi/server';
// Local-only rehearsal, NOT caregiver auth. Do not expose this starter through a public tunnel.
export const handle: Handle = async ({ event, resolve }) => {
  let peer: string | null = null;
  try {
    peer = event.getClientAddress();
  } catch {
    /* fail closed */
  }
  if (!isLoopbackHost(event.url.hostname) || !peer || !isLoopbackHost(peer))
    return new Response('Local mock starter only', { status: 403 });
  const response = await resolve(event);
  response.headers.set('Cache-Control', 'no-store');
  return response;
};
