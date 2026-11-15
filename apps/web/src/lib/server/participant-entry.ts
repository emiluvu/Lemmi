import { ParticipantEndpointSchema, ResultSchema, type Fetcher } from '@lemmi/contracts';
import { handleDemoHttp } from './demo';
import { conversationLock, conversationPage } from './conversation-exit';

// Selection happens in the caregiver workspace. Visiting a participant URL never
// enrolls an endpoint or silently substitutes the browser's previous profile.
export async function participantEntryGuard(request: Request, fetcher: Fetcher = fetch) {
  const url = new URL(request.url);
  if (!conversationPage(url) || url.pathname.startsWith('/preview/') || conversationLock(request))
    return null;
  const currentRequest = new Request(new URL('/v1/demo/current', url).href, {
    headers: request.headers,
  });
  const current = await handleDemoHttp(currentRequest, 'current', fetcher);
  const result = ResultSchema(ParticipantEndpointSchema).safeParse(await current.json());
  if (!result.success || (!result.data.ok && result.data.error.code === 'UNAVAILABLE'))
    return new Response('Participant setup unavailable. Reload to try again.', {
      status: 503,
      headers: { 'cache-control': 'no-store' },
    });
  const requested = url.searchParams.get('profile');
  if (result.data.ok && (!requested || requested === result.data.data.profileId)) return null;
  const headers = new Headers({ location: '/caregiver', 'cache-control': 'no-store' });
  const clear = current.headers.get('set-cookie');
  if (clear) headers.append('set-cookie', clear);
  return new Response(null, { status: 303, headers });
}
