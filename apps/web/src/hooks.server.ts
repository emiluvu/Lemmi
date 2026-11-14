import type { Handle } from '@sveltejs/kit/hooks';
import { isLoopbackHost, controlConfig } from '@lemmi/server';
// Mock pages stay local. Live mode exposes only the narrowly scoped device resource routes
// through the trusted local TLS proxy; each route independently verifies its authorization.
export const handle: Handle = async ({ event, resolve }) => {
  let peer: string | null = null;
  try {
    peer = event.getClientAddress();
  } catch {
    /* fail closed */
  }
  const deviceRoute = /^\/v1\/(devices\/[^/]+\/(pairings|revoke)|device-pairings\/claim)$/.test(
    event.url.pathname,
  );
  if (process.env.LEMMI_MODE === 'live' && deviceRoute) {
    try {
      const config = controlConfig();
      if (
        !peer ||
        !isLoopbackHost(peer) ||
        event.url.origin !== config.publicOrigin ||
        event.request.headers.get('x-forwarded-proto') !== 'https'
      )
        return new Response('Trusted HTTPS proxy required', { status: 403 });
      const response = await resolve(event);
      response.headers.set('Cache-Control', 'no-store');
      return response;
    } catch {
      return new Response('Authenticated device access is not configured', { status: 503 });
    }
  }
  if (!isLoopbackHost(event.url.hostname) || !peer || !isLoopbackHost(peer))
    return new Response('Local mock starter only', { status: 403 });
  const response = await resolve(event);
  response.headers.set('Cache-Control', 'no-store');
  return response;
};
