import { expect, test } from 'bun:test';
import {
  conversationExitGuard,
  lockConversationResponse,
  startConversationLock,
  verifyConversationExit,
} from '../apps/web/src/lib/server/conversation-exit';
const origin = 'https://exit.fixture.invalid';
function request(
  path: string,
  method = 'GET',
  body?: unknown,
  cookie?: string,
  requestOrigin = origin,
) {
  return new Request(origin + path, {
    method,
    headers: {
      origin: requestOrigin,
      ...(cookie ? { cookie } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
function token() {
  return `lemmi_conversation_lock=preview.${crypto.randomUUID()}`;
}
async function local(work: () => Promise<void>) {
  const previous = process.env.LEMMI_MODE;
  process.env.LEMMI_MODE = 'mock';
  try {
    await work();
  } finally {
    if (previous === undefined) delete process.env.LEMMI_MODE;
    else process.env.LEMMI_MODE = previous;
  }
}
test('conversation entry sets an HttpOnly same-site lock and dashboard/back links cannot skip it', async () => {
  await local(async () => {
    const entered = lockConversationResponse(
      request('/preview/application?screen=conversation'),
      new Response('conversation'),
    );
    const cookie = entered.headers.get('set-cookie')!;
    for (const flag of ['HttpOnly', 'SameSite=Strict', 'Secure', 'Path=/'])
      expect(cookie).toContain(flag);
    const lock = cookie.split(';')[0]!;
    for (const path of [
      '/caregiver',
      '/caregiver/settings',
      '/',
      '/preview/application',
      '/preview/avatars',
    ]) {
      const blocked = conversationExitGuard(request(path, 'GET', undefined, lock))!;
      expect(blocked.status).toBe(303);
      expect(blocked.headers.get('location')).toBe('/preview/application?screen=conversation');
    }
    expect(
      conversationExitGuard(
        request('/preview/application?screen=conversation', 'GET', undefined, lock),
      ),
    ).toBeNull();
    expect(
      conversationExitGuard(request('/v1/demo/profile-update', 'POST', {}, lock))?.status,
    ).toBe(403);
    expect(conversationExitGuard(request('/v1/demo/profiles', 'POST', {}, lock))?.status).toBe(403);
  });
});
test('client-side conversation entry can establish the lock without weakening existing authorization', async () => {
  await local(async () => {
    const response = startConversationLock(request('/v1/demo/conversation-lock', 'POST'));
    expect(response.status).toBe(200);
    const cookie = response.headers.get('set-cookie')!.split(';')[0]!;
    expect(
      startConversationLock(
        request('/v1/demo/conversation-lock', 'POST', undefined, cookie),
      ).headers.get('set-cookie'),
    ).toStartWith(cookie);
    expect(
      startConversationLock(
        request(
          '/v1/demo/conversation-lock',
          'POST',
          undefined,
          undefined,
          'https://foreign.invalid',
        ),
      ).status,
    ).toBe(403);
  });
});
test('only correct POST password clears the lock; wrong, malformed and foreign-origin attempts stay locked', async () => {
  await local(async () => {
    const cookie = token();
    const wrong = await verifyConversationExit(
      request('/v1/demo/conversation-exit', 'POST', { password: 'wrong' }, cookie),
    );
    expect(wrong.status).toBe(401);
    expect(wrong.headers.get('set-cookie')).toBeNull();
    expect(
      (
        await verifyConversationExit(
          request('/v1/demo/conversation-exit', 'GET', undefined, cookie),
        )
      ).status,
    ).toBe(405);
    expect(
      (
        await verifyConversationExit(
          request(
            '/v1/demo/conversation-exit',
            'POST',
            { password: '1234' },
            cookie,
            'https://foreign.invalid',
          ),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await verifyConversationExit(
          request('/v1/demo/conversation-exit', 'POST', { password: '1234', bypass: true }, cookie),
        )
      ).status,
    ).toBe(400);
    const accepted = await verifyConversationExit(
      request('/v1/demo/conversation-exit', 'POST', { password: '1234' }, cookie),
    );
    expect(accepted.status).toBe(200);
    expect(accepted.headers.get('set-cookie')).toContain('Max-Age=0');
    expect(JSON.stringify(await accepted.json())).not.toContain('1234');
  });
});
test('exit guesses are bounded and the live environment never accepts the demo password by default', async () => {
  await local(async () => {
    const cookie = token();
    for (let i = 0; i < 5; i++)
      expect(
        (
          await verifyConversationExit(
            request('/v1/demo/conversation-exit', 'POST', { password: 'bad' }, cookie),
            1000,
          )
        ).status,
      ).toBe(401);
    expect(
      (
        await verifyConversationExit(
          request('/v1/demo/conversation-exit', 'POST', { password: '1234' }, cookie),
          1001,
        )
      ).status,
    ).toBe(429);
    expect(
      (
        await verifyConversationExit(
          request('/v1/demo/conversation-exit', 'POST', { password: '1234' }, cookie),
          62000,
        )
      ).status,
    ).toBe(200);
  });
  const mode = process.env.LEMMI_MODE,
    password = process.env.LEMMI_CAREGIVER_EXIT_PASSWORD;
  try {
    process.env.LEMMI_MODE = 'live';
    delete process.env.LEMMI_CAREGIVER_EXIT_PASSWORD;
    expect(
      (
        await verifyConversationExit(
          request('/v1/demo/conversation-exit', 'POST', { password: '1234' }, token()),
        )
      ).status,
    ).toBe(503);
    process.env.LEMMI_CAREGIVER_EXIT_PASSWORD = '8642';
    expect(
      (
        await verifyConversationExit(
          request('/v1/demo/conversation-exit', 'POST', { password: '1234' }, token()),
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await verifyConversationExit(
          request('/v1/demo/conversation-exit', 'POST', { password: '8642' }, token()),
        )
      ).status,
    ).toBe(200);
  } finally {
    if (mode === undefined) delete process.env.LEMMI_MODE;
    else process.env.LEMMI_MODE = mode;
    if (password === undefined) delete process.env.LEMMI_CAREGIVER_EXIT_PASSWORD;
    else process.env.LEMMI_CAREGIVER_EXIT_PASSWORD = password;
  }
});
