import { test, expect } from 'bun:test';
import { handleDemoHttp, endpointCookie } from '../apps/web/src/lib/server/demo';
import { createParticipantSetup, type Fetcher } from '@lemmi/contracts';
const origin = 'https://participant.fixture.invalid';
const key = 'private-demo-key-that-is-independent-12345678';
const token = 'a'.repeat(43);
const profile = {
  id: 'profile-alex',
  preferredName: 'Alex',
  avatarId: 'lemming',
  revision: 0,
  communicationSupport: { preset: 'guided', configVersion: 1 },
};
function config() {
  const names = [
    'LEMMI_MODE',
    'LEMMI_DEMO_ENROLLMENT',
    'LEMMI_PUBLIC_ORIGIN',
    'LEMMI_CONTROL_TOKEN',
    'LEMMI_ACCESS_KEY',
  ];
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  Object.assign(process.env, {
    LEMMI_MODE: 'live',
    LEMMI_DEMO_ENROLLMENT: '1',
    LEMMI_PUBLIC_ORIGIN: origin,
    LEMMI_CONTROL_TOKEN: 'independent-internal-token-123456789012345',
    LEMMI_ACCESS_KEY: key,
  });
  return () => {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  };
}
function request(path: string, method = 'GET', body?: unknown, cookie?: string) {
  return new Request(origin + '/v1/demo/' + path, {
    method,
    headers: {
      'x-lemmi-access-key': key,
      origin,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(cookie ? { cookie } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
test('browser enrollment stores a scoped HttpOnly cookie and never returns its credential to JavaScript', async () => {
  const restore = config();
  try {
    let command: any;
    const response = await handleDemoHttp(
      request('enroll', 'POST', { profileId: 'profile-alex', endpoint: 'browser' }),
      'enroll',
      async (_url, init) => {
        command = JSON.parse(String(init?.body));
        return Response.json({
          ok: true,
          data: {
            deviceId: 'browser-1',
            profileId: 'profile-alex',
            endpoint: 'browser',
            credential: token,
            expiresAt: new Date(Date.now() + 60000).toISOString(),
          },
        });
      },
    );
    expect(command).toEqual({
      operation: 'endpoint.enroll',
      profileId: 'profile-alex',
      endpoint: 'browser',
    });
    expect(response.status).toBe(200);
    expect(JSON.stringify(await response.json())).not.toContain(token);
    const cookie = response.headers.get('set-cookie')!;
    for (const flag of ['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/'])
      expect(cookie).toContain(flag);
    expect(
      endpointCookie(new Request(origin, { headers: { cookie: cookie.split(';')[0]! } })),
    ).toBe(token);
    expect(
      endpointCookie(
        new Request(origin, {
          headers: { cookie: `__Host-lemmi_endpoint=${token}; __Host-lemmi_endpoint=${token}` },
        }),
      ),
    ).toBeUndefined();
  } finally {
    restore();
  }
});
test('setup creates explicit new profiles, constrains cookie actions to browser identity and rejects foreign origins', async () => {
  const restore = config();
  try {
    const commands: any[] = [];
    const fetcher: Fetcher = async (_url, init) => {
      const command = JSON.parse(String(init?.body));
      commands.push(command);
      return Response.json({
        ok: true,
        data: command.operation === 'profile.create' ? profile : { released: true },
      });
    };
    const created = await handleDemoHttp(
      request('profiles', 'POST', { preferredName: 'Fictional Sam' }),
      'profiles',
      fetcher,
    );
    expect(created.status).toBe(200);
    expect(commands[0]).toEqual({
      operation: 'profile.create',
      input: { preferredName: 'Fictional Sam', avatarId: 'lemming' },
    });
    const released = await handleDemoHttp(
      request('release', 'POST', {}, `__Host-lemmi_endpoint=${token}`),
      'release',
      fetcher,
    );
    expect(released.status).toBe(200);
    expect(commands[1]).toEqual({
      operation: 'endpoint.release',
      credential: token,
      endpoint: 'browser',
    });
    expect(released.headers.get('set-cookie')).toContain('Max-Age=0');
    const foreign = new Request(origin + '/v1/demo/enroll', {
      method: 'POST',
      headers: { origin: 'https://foreign.invalid', 'x-lemmi-access-key': key },
      body: '{}',
    });
    expect((await handleDemoHttp(foreign, 'enroll', fetcher)).status).toBe(403);
    expect(commands).toHaveLength(2);
    expect((await handleDemoHttp(request('release'), 'release', fetcher)).status).toBe(405);
  } finally {
    restore();
  }
});
test('participant setup client preserves explicit server errors and rejects malformed success without fixture fallback', async () => {
  const failed = createParticipantSetup(async () =>
    Response.json({ ok: false, error: { code: 'FORBIDDEN', message: 'Not assigned' } }),
  );
  expect(await failed.current()).toEqual({
    ok: false,
    error: { code: 'FORBIDDEN', message: 'Not assigned' },
  });
  const malformed = createParticipantSetup(async () =>
    Response.json({ ok: true, data: { preferredName: 'Alex' } }),
  );
  expect((await malformed.current()).ok).toBe(false);
});

test('fictional profile edit uses the private setup gate and rejects private fields or cross-origin writes', async () => {
  const restore = config();
  try {
    const edit = {
      profileId: 'profile-alex',
      expectedRevision: 0,
      commandId: 'profile-edit-fixture',
      patch: { preferredName: 'Alexandra', avatarId: 'cat' },
    };
    const commands: unknown[] = [];
    const fetcher: Fetcher = async (_url, init) => {
      commands.push(JSON.parse(String(init?.body)));
      return Response.json({
        ok: true,
        data: { ...profile, preferredName: 'Alexandra', avatarId: 'cat', revision: 1 },
      });
    };
    const saved = await handleDemoHttp(
      request('profile-update', 'POST', edit),
      'profile-update',
      fetcher,
    );
    expect(saved.status).toBe(200);
    expect(commands).toEqual([{ operation: 'profile.update', input: edit }]);
    expect(saved.headers.get('cache-control')).toContain('no-store');
    const locked = new Request(origin + '/v1/demo/profile-update', {
      method: 'POST',
      headers: {
        origin,
        'content-type': 'application/json',
        cookie: `__Host-lemmi_endpoint=${token}`,
      },
      body: JSON.stringify(edit),
    });
    expect((await handleDemoHttp(locked, 'profile-update', fetcher)).status).toBe(401);
    for (const patch of [
      { ...edit.patch, approvedFacts: [] },
      { ...edit.patch, excerptSavingEnabled: true },
      { ...edit.patch, preferredName: '' },
    ]) {
      expect(
        (
          await handleDemoHttp(
            request('profile-update', 'POST', { ...edit, patch }),
            'profile-update',
            fetcher,
          )
        ).status,
      ).toBe(400);
    }
    const foreign = new Request(origin + '/v1/demo/profile-update', {
      method: 'POST',
      headers: { origin: 'https://foreign.invalid', 'x-lemmi-access-key': key },
      body: JSON.stringify(edit),
    });
    expect((await handleDemoHttp(foreign, 'profile-update', fetcher)).status).toBe(403);
    expect(commands).toHaveLength(1);
  } finally {
    restore();
  }
});
