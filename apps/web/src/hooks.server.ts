import { conversationExitGuard, lockConversationResponse } from '#lib/server/conversation-exit.ts';
import { participantEntryGuard } from '#lib/server/participant-entry.ts';
import type { Handle } from '@sveltejs/kit/hooks';
import {
  isLoopbackHost,
  controlConfig,
  hasPrivateAccess,
  createPrivateAccessHandler,
} from '@lemmi/server';
const accessHandler = createPrivateAccessHandler();
// The public demo pages use only the fictional setup projection. Private caregiver
// resources still require their independent caregiver authorization.
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
  const dataRoute =
    /^\/v1\/(profiles\/[^/]+(?:\/(?:(photos|assets)(?:\/[^/]+)?|communication-support(?:\/apply)?))?|participant\/profiles\/[^/]+|assets\/[^/]+(?:\/metadata)?)$/.test(
      event.url.pathname,
    );
  const demoPage = [
    '/',
    '/caregiver',
    '/caregiver/settings',
    '/caregiver/check-in',
    '/caregiver/sign-in',
    '/participant',
    '/participant/conversation',
    '/participant/photo-story',
  ].includes(event.url.pathname);
  const participantRoute =
    demoPage ||
    event.url.pathname.startsWith('/v1/demo/') ||
    event.url.pathname.startsWith('/_app/');
  const accessRoute = event.url.pathname === '/access' || event.url.pathname === '/access/logout';
  if (
    process.env.LEMMI_MODE === 'live' &&
    (deviceRoute || dataRoute || accessRoute || participantRoute)
  ) {
    try {
      const config = controlConfig();
      if (
        !peer ||
        !isLoopbackHost(peer) ||
        event.url.origin !== config.publicOrigin ||
        event.request.headers.get('x-forwarded-proto') !== 'https'
      )
        return new Response('Trusted HTTPS proxy required', { status: 403 });
      if (accessRoute) return accessHandler(event.request, config.accessKey, config.publicOrigin);
      if (demoPage && process.env.LEMMI_DEMO_ENROLLMENT !== '1')
        return new Response('Fictional demo setup is disabled', { status: 404 });
      if (!hasPrivateAccess(event.request, config.accessKey)) {
        if (demoPage)
          return new Response(null, {
            status: 303,
            headers: { Location: '/access', 'Cache-Control': 'no-store' },
          });
        return Response.json(
          { ok: false, error: { code: 'UNAUTHORIZED', message: 'Private access key required' } },
          { status: 401, headers: { 'Cache-Control': 'no-store' } },
        );
      }
      const blocked = conversationExitGuard(event.request);
      if (blocked) return blocked;
      const selection = await participantEntryGuard(event.request);
      if (selection) return selection;
      if (event.url.pathname === '/')
        return new Response(null, {
          status: 303,
          headers: { Location: '/caregiver', 'Cache-Control': 'no-store' },
        });
      const response = await resolve(event);
      response.headers.set('Cache-Control', 'no-store');
      return lockConversationResponse(event.request, response);
    } catch {
      return new Response('Authenticated device access is not configured', { status: 503 });
    }
  }
  if (!isLoopbackHost(event.url.hostname) || !peer || !isLoopbackHost(peer))
    return new Response('Local mock starter only', { status: 403 });
  const blocked = conversationExitGuard(event.request);
  if (blocked) return blocked;
  // Opt-in local review uses the real UI components with the existing mock backend.
  if (process.env.LEMMI_UI_PREVIEW === '1') {
    const preview =
      event.url.pathname === '/caregiver'
        ? '/preview/application'
        : event.url.pathname === '/participant/conversation' ||
            event.url.pathname === '/participant'
          ? '/preview/application?screen=conversation'
          : null;
    if (preview)
      return lockConversationResponse(
        event.request,
        new Response(null, {
          status: 303,
          headers: { Location: preview, 'Cache-Control': 'no-store' },
        }),
      );
  }
  const response = await resolve(event);
  response.headers.set('Cache-Control', 'no-store');
  return lockConversationResponse(event.request, response);
};
