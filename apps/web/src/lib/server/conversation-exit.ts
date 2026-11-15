import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { boundedJson } from '@lemmi/server';

const COOKIE = 'lemmi_conversation_lock';
const attempts = new Map<string, { count: number; until: number }>();
const headers = { 'cache-control': 'no-store' };
export function conversationLock(request: Request): string | null {
  const values = (request.headers.get('cookie') ?? '')
    .split(';')
    .map((v) => v.trim())
    .filter((v) => v.startsWith(COOKIE + '='));
  return values.length
    ? values.length === 1
      ? values[0]!.slice(COOKIE.length + 1) || 'locked'
      : 'locked'
    : null;
}
export function conversationPage(url: URL): boolean {
  return (
    url.pathname === '/participant' ||
    url.pathname.startsWith('/participant/conversation') ||
    url.pathname === '/participant/photo-story' ||
    (url.pathname === '/preview/application' && url.searchParams.get('screen') === 'conversation')
  );
}
function cookie(request: Request, value: string, clear = false) {
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}${clear ? '; Max-Age=0' : ''}`;
}
export function conversationExitGuard(request: Request): Response | null {
  const lock = conversationLock(request);
  if (!lock) return null;
  const url = new URL(request.url);
  const caregiverPage =
    url.pathname === '/' ||
    url.pathname.startsWith('/caregiver') ||
    (url.pathname.startsWith('/preview/') && !conversationPage(url));
  if (caregiverPage)
    return new Response(null, {
      status: 303,
      headers: {
        ...headers,
        location: lock.startsWith('preview.')
          ? '/preview/application?screen=conversation'
          : '/participant/conversation',
      },
    });
  if (
    request.method !== 'GET' &&
    ['/v1/demo/profiles', '/v1/demo/profile-update'].includes(url.pathname)
  )
    return Response.json(
      {
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Use the caregiver exit password before changing profiles.',
        },
      },
      { status: 403, headers },
    );
  return null;
}
export function lockConversationResponse(request: Request, response: Response): Response {
  if (conversationPage(new URL(request.url)) && !conversationLock(request)) {
    const preview =
      new URL(request.url).pathname.startsWith('/preview/') ||
      (process.env.LEMMI_MODE !== 'live' && process.env.LEMMI_UI_PREVIEW === '1');
    response.headers.append(
      'set-cookie',
      cookie(request, `${preview ? 'preview' : 'live'}.${randomUUID()}`),
    );
  }
  return response;
}

export function startConversationLock(request: Request): Response {
  if (request.method !== 'POST')
    return new Response(null, { status: 405, headers: { ...headers, allow: 'POST' } });
  if (request.headers.get('origin') !== new URL(request.url).origin)
    return Response.json(
      { ok: false, error: 'Same-origin request required.' },
      { status: 403, headers },
    );
  const token =
    conversationLock(request) ??
    `${process.env.LEMMI_MODE === 'live' ? 'live' : 'preview'}.${randomUUID()}`;
  return Response.json(
    { ok: true },
    { headers: { ...headers, 'set-cookie': cookie(request, token) } },
  );
}
export async function verifyConversationExit(
  request: Request,
  now = Date.now(),
): Promise<Response> {
  const url = new URL(request.url);
  if (request.method !== 'POST')
    return new Response(null, { status: 405, headers: { ...headers, allow: 'POST' } });
  if (request.headers.get('origin') !== url.origin)
    return Response.json(
      { ok: false, error: 'Same-origin request required.' },
      { status: 403, headers },
    );
  const password =
    process.env.LEMMI_MODE === 'live' ? process.env.LEMMI_CAREGIVER_EXIT_PASSWORD : '1234';
  if (!password || !/^\d{4}$/.test(password))
    return Response.json(
      {
        ok: false,
        error: 'The caregiver exit password is not configured. Ask the caregiver to configure it.',
      },
      { status: 503, headers },
    );
  const lock = conversationLock(request);
  if (!lock)
    return Response.json(
      { ok: false, error: 'No conversation lock is active.' },
      { status: 409, headers },
    );
  for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
  const key = createHash('sha256').update(lock).digest('hex');
  const prior = attempts.get(key);
  if ((prior?.count ?? 0) >= 5 || (!prior && attempts.size >= 256))
    return Response.json(
      { ok: false, error: 'Please wait a minute before trying again.' },
      { status: 429, headers: { ...headers, 'retry-after': '60' } },
    );
  let body: unknown;
  try {
    body = await boundedJson(request, 1024);
  } catch {
    return Response.json({ ok: false, error: 'Invalid exit request.' }, { status: 400, headers });
  }
  if (
    !body ||
    typeof body !== 'object' ||
    Object.keys(body).length !== 1 ||
    !('password' in body) ||
    typeof body.password !== 'string' ||
    body.password.length > 128
  )
    return Response.json(
      { ok: false, error: 'Enter the caregiver exit password.' },
      { status: 400, headers },
    );
  attempts.set(key, { count: (prior?.count ?? 0) + 1, until: prior?.until ?? now + 60000 });
  const digest = (value: string) => createHash('sha256').update(value).digest();
  if (!timingSafeEqual(digest(body.password), digest(password)))
    return Response.json(
      { ok: false, error: 'Incorrect password. You are still with Lemmi.' },
      { status: 401, headers },
    );
  attempts.delete(key);
  return Response.json(
    { ok: true },
    { headers: { ...headers, 'set-cookie': cookie(request, '', true) } },
  );
}
