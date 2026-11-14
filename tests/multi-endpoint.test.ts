import { expect, test } from 'bun:test';
import {
  ok,
  ProfileDetailSchema,
  ServerEventSchema,
  type ProfileDetail,
  type ServerEvent,
  type SessionSnapshot,
} from '@lemmi/contracts';
import { caregiverProfile, controlHelloFixture } from '@lemmi/contracts/fixtures';
import { startControlGateway } from '../apps/realtime/src/control';

const publicOrigin = 'https://lemmi.invalid';
const internalToken = 'multi-endpoint-test-internal-token-only';
const profiles: ProfileDetail[] = [
  ProfileDetailSchema.parse({
    ...caregiverProfile,
    privacyRevision: 0,
    policyRevision: 0,
    approvedFacts: [],
  }),
  ProfileDetailSchema.parse({
    ...caregiverProfile,
    id: 'profile-casey',
    preferredName: 'Casey',
    interests: [],
    privacyRevision: 0,
    policyRevision: 0,
    approvedFacts: [],
  }),
];

type Gateway = ReturnType<typeof startControlGateway>;
function harness(options: Partial<Parameters<typeof startControlGateway>[0]> = {}) {
  const gateway = startControlGateway({
    publicOrigin,
    internalToken,
    port: 0,
    profiles,
    devices: [
      { profileId: 'profile-alex', deviceId: 'robot-alex', endpoint: 'robot' },
      { profileId: 'profile-alex', deviceId: 'browser-alex', endpoint: 'browser' },
      { profileId: 'profile-casey', deviceId: 'robot-casey', endpoint: 'robot' },
    ],
    chatAdapter: {
      async complete(input) {
        return ok({
          text: `Hello from ${input.text === 'Hello Casey' ? 'Casey' : 'Alex'}.`,
          language: input.language,
        });
      },
    },
    ...options,
  });
  const clients: ReturnType<typeof socketClient>[] = [];
  async function internal(action: string, input: unknown) {
    const response = await fetch(
      `http://127.0.0.1:${gateway.server.port}/internal/control/${action}`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${internalToken}`, 'content-type': 'application/json' },
        body: JSON.stringify(input),
      },
    );
    return { response, result: (await response.json()) as any };
  }
  async function issue(deviceId: string, profileId: string) {
    const paired = await internal('pair', {
      actor: 'fixture-caregiver',
      input: { deviceId, profileId, commandId: crypto.randomUUID() },
    });
    expect(paired.response.status).toBe(200);
    const claimed = await internal('claim', {
      pairingId: paired.result.data.pairingId,
      code: paired.result.data.code,
      localConfirmed: true,
    });
    expect(claimed.response.status).toBe(200);
    return claimed.result.data.credential as string;
  }
  function connect(
    credential: string,
    endpoint: 'browser' | 'robot' = 'robot',
    cookieOrigin?: string | null,
  ) {
    const client = socketClient(gateway, credential, endpoint, cookieOrigin);
    clients.push(client);
    return client;
  }
  async function close() {
    for (const client of clients) client.socket.close();
    await Promise.all(clients.map((client) => client.closed));
    gateway.stop();
  }
  return { gateway, issue, connect, internal, close };
}

function socketClient(
  gateway: Gateway,
  credential: string,
  endpoint: 'browser' | 'robot',
  cookieOrigin?: string | null,
) {
  const socket = new WebSocket(`ws://127.0.0.1:${gateway.server.port}/v1/device-stream`, {
    headers: {
      host: 'lemmi.invalid',
      'x-forwarded-proto': 'https',
      ...(cookieOrigin === undefined
        ? { authorization: `Bearer ${credential}` }
        : {
            cookie: `__Host-lemmi_endpoint=${credential}`,
            ...(cookieOrigin ? { origin: cookieOrigin } : {}),
          }),
    },
  });
  const events: ServerEvent[] = [];
  const listeners = new Set<() => void>();
  let sequence = 0;
  const opened = new Promise<void>((resolve, reject) => {
    socket.onopen = () => resolve();
    socket.onerror = () => reject(new Error('Endpoint upgrade rejected'));
  });
  void opened.catch(() => {});
  const closed = new Promise<void>((resolve) => {
    socket.onclose = () => resolve();
  });
  socket.onmessage = (message) => {
    events.push(ServerEventSchema.parse(JSON.parse(String(message.data))));
    for (const listener of listeners) listener();
  };
  function wait(predicate: (event: ServerEvent) => boolean, after = 0): Promise<ServerEvent> {
    return new Promise((resolve, reject) => {
      const check = () => {
        const event = events.slice(after).find(predicate);
        if (event) {
          clearTimeout(timer);
          listeners.delete(check);
          resolve(event);
        }
      };
      const timer = setTimeout(() => {
        listeners.delete(check);
        reject(new Error('Expected endpoint event did not arrive'));
      }, 2500);
      listeners.add(check);
      check();
    });
  }
  function send(
    type: string,
    session: SessionSnapshot | null = null,
    payload: unknown = {},
    turnId: string | null = null,
  ) {
    const id = crypto.randomUUID();
    socket.send(
      JSON.stringify({
        protocol_version: 1,
        event_id: id,
        session_id: session?.id ?? null,
        turn_id: turnId,
        generation: session?.generation ?? 0,
        sequence: sequence++,
        type,
        payload,
      }),
    );
    return id;
  }
  const latest = () => {
    const state = [...events].reverse().find((event) => event.type === 'state.changed');
    return state?.type === 'state.changed' ? state.payload.session : null;
  };
  async function hello(audio = false) {
    await opened;
    send('device.hello', null, {
      ...controlHelloFixture.payload,
      endpoint,
      ...(audio
        ? {
            audio: { encoding: 'pcm_s16le', sampleRate: 16000, channels: 1, frameMs: 20 },
            playback: { encoding: 'pcm_s16le', channels: 1, sampleRates: [22050] },
          }
        : {}),
    });
    await wait((event) => event.type === 'device.ready');
    await wait((event) => event.type === 'state.changed');
  }
  async function apply(
    type: string,
    session: SessionSnapshot | null = latest(),
    payload: unknown = {},
  ) {
    const after = events.length;
    const id = send(type, session, payload);
    const ack = await wait(
      (event) => event.type === 'command.ack' && event.payload.commandId === id,
      after,
    );
    expect(ack.type === 'command.ack' && ack.payload.applied).toBe(true);
    const state = await wait((event) => event.type === 'state.changed', events.indexOf(ack) + 1);
    if (state.type !== 'state.changed' || !state.payload.session)
      throw new Error('Missing session');
    return state.payload.session;
  }
  async function rejected(
    type: string,
    session: SessionSnapshot | null = latest(),
    payload: unknown = {},
  ) {
    const after = events.length;
    const id = send(type, session, payload);
    const event = await wait(
      (event) => event.type === 'error' && event.payload.commandId === id,
      after,
    );
    if (event.type !== 'error') throw new Error('Missing scoped error');
    return event.payload.code;
  }
  return { socket, opened, closed, events, wait, send, latest, hello, apply, rejected };
}

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

test('teaching eligibility, owner handoff and deadline sweeping stay isolated after registry integration', async () => {
  let now = 1000;
  const h = harness({ now: () => now });
  try {
    const alex = h.connect(await h.issue('robot-alex', 'profile-alex'));
    const browser = h.connect(await h.issue('browser-alex', 'profile-alex'), 'browser');
    const casey = h.connect(await h.issue('robot-casey', 'profile-casey'));
    await Promise.all([alex.hello(), browser.hello(), casey.hello()]);
    await alex.apply('input.start', null);
    await casey.apply('input.start', null);
    const teaching = await alex.apply('input.teaching.start');
    expect(teaching.teaching?.entityId).toBe('topic:gardening');
    const sparse = await casey.apply('input.teaching.start');
    expect(sparse.teaching?.entityId).toBeNull();
    expect(sparse.teaching?.prompt).toBeNull();
    expect(await browser.rejected('input.teaching.next', teaching)).toBe('FORBIDDEN');
    const handoff = await browser.apply('input.handoff', teaching);
    expect(handoff.phase).toBe('paused');
    expect(handoff.activeEndpointId).toBe('browser-alex');
    await browser.apply('input.resume', handoff);
    const next = await browser.apply('input.teaching.next');
    expect(next.teaching?.entityId).toBe('topic:beaches');
    expect(await alex.rejected('input.teaching.next', next)).toBe('FORBIDDEN');
    const after = browser.events.length;
    now += 900001;
    for (const client of [alex, browser, casey]) client.send('heartbeat', client.latest());
    await browser.wait(
      (event) =>
        event.type === 'state.changed' && event.payload.session?.conversationMode === 'open',
      after,
    );
    expect(browser.latest()?.captureGrant).toBeNull();
    expect(browser.latest()?.phase).toBe('ready');
    expect(casey.latest()?.conversationMode).toBe('teach_lemmi');
    expect(casey.latest()?.teaching?.entityId).toBeNull();
  } finally {
    await h.close();
  }
});

test('distinct robots connect concurrently and conversation, forged controls and disconnect stay profile-scoped', async () => {
  const h = harness();
  try {
    const [alexCredential, caseyCredential] = await Promise.all([
      h.issue('robot-alex', 'profile-alex'),
      h.issue('robot-casey', 'profile-casey'),
    ]);
    const alex = h.connect(alexCredential);
    const casey = h.connect(caseyCredential);
    await Promise.all([alex.hello(), casey.hello()]);
    const [a, c] = await Promise.all([
      alex.apply('input.start', null),
      casey.apply('input.start', null),
    ]);
    expect(a.profileId).toBe('profile-alex');
    expect(c.profileId).toBe('profile-casey');
    expect(a.id).not.toBe(c.id);
    const aId = alex.send('input.text', a, { text: 'Hello Alex', language: 'en' });
    const cId = casey.send('input.text', c, { text: 'Hello Casey', language: 'en' });
    await Promise.all([
      alex.wait((event) => event.type === 'response.text' && event.payload.turnId === aId),
      casey.wait((event) => event.type === 'response.text' && event.payload.turnId === cId),
    ]);
    await tick();
    expect(alex.events.some((event) => event.session_id === c.id)).toBe(false);
    expect(casey.events.some((event) => event.session_id === a.id)).toBe(false);
    expect(await casey.rejected('input.stop', alex.latest())).toBe('REVISION_CONFLICT');
    expect(alex.latest()?.phase).toBe('waiting');
    const paused = await casey.apply('input.pause');
    expect(paused.phase).toBe('paused');
    expect(alex.latest()?.phase).toBe('waiting');
    const resumed = await casey.apply('input.resume');
    const before = casey.events.length;
    alex.socket.close();
    await alex.closed;
    await casey.wait((event) => event.type === 'state.changed', before);
    expect(casey.latest()?.id).toBe(resumed.id);
    expect(casey.latest()?.phase).toBe('ready');
    expect(casey.latest()?.generation).toBe(resumed.generation);
  } finally {
    await h.close();
  }
});

test('one robot and browser share a profile while explicit handoff rotates ownership and invalidates old work', async () => {
  let pending: { signal: AbortSignal; finish: (result: any) => void } | undefined;
  const h = harness({
    chatAdapter: {
      async complete(_input, signal) {
        return new Promise((finish) => {
          pending = { signal, finish };
        });
      },
    },
  });
  try {
    const robot = h.connect(await h.issue('robot-alex', 'profile-alex'));
    const browserCredential = await h.issue('browser-alex', 'profile-alex');
    const browser = h.connect(browserCredential, 'browser');
    await Promise.all([robot.hello(), browser.hello()]);
    const active = await robot.apply('input.start', null);
    await browser.wait(
      (event) => event.type === 'state.changed' && event.payload.session?.id === active.id,
    );
    expect(browser.latest()?.activeEndpointId).toBe('robot-alex');
    expect(
      await browser.rejected('input.text', browser.latest(), { text: 'Hello', language: 'en' }),
    ).toBe('FORBIDDEN');
    // An observer closing does not pause an active robot.
    browser.socket.close();
    await browser.closed;
    await tick();
    robot.send('heartbeat');
    await robot.wait((event) => event.type === 'heartbeat');
    expect(robot.latest()?.generation).toBe(active.generation);
    expect(robot.latest()?.phase).toBe('ready');
    const nextBrowser = h.connect(browserCredential, 'browser');
    await nextBrowser.hello();
    const oldTurn = robot.send('input.text', robot.latest(), {
      text: 'A fictional pending greeting',
      language: 'en',
    });
    await robot.wait(
      (event) => event.type === 'state.changed' && event.payload.session?.phase === 'processing',
    );
    const claimed = await nextBrowser.apply('input.handoff', nextBrowser.latest());
    expect(claimed.activeEndpointId).toBe('browser-alex');
    expect(claimed.endpoint).toBe('browser');
    expect(claimed.generation).toBeGreaterThan(active.generation);
    expect(claimed.leaseId).not.toBe(active.leaseId);
    expect(claimed.phase).toBe('paused');
    expect(claimed.captureGrant).toBeNull();
    expect(pending?.signal.aborted).toBe(true);
    pending?.finish(ok({ text: 'This late response must be discarded.', language: 'en' }));
    await tick();
    expect(
      robot.events.some(
        (event) => event.type === 'response.text' && event.payload.turnId === oldTurn,
      ),
    ).toBe(false);
    expect(
      nextBrowser.events.some(
        (event) => event.type === 'response.text' && event.payload.turnId === oldTurn,
      ),
    ).toBe(false);
    await nextBrowser.apply('input.resume');
    expect(await robot.rejected('input.resume', robot.latest())).toBe('FORBIDDEN');
    // Safety controls remain usable from the non-owning endpoint.
    const stopped = await robot.apply('input.stop');
    expect(stopped.phase).toBe('ended');
  } finally {
    await h.close();
  }
});

test('duplicate-device upgrades remain atomic while a different device can connect', async () => {
  const h = harness();
  try {
    const credential = await h.issue('robot-alex', 'profile-alex');
    const first = h.connect(credential);
    const second = h.connect(credential);
    const results = await Promise.allSettled([first.opened, second.opened]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const casey = h.connect(await h.issue('robot-casey', 'profile-casey'));
    await casey.hello();
    expect(casey.events.some((event) => event.type === 'device.ready')).toBe(true);
  } finally {
    await h.close();
  }
});

test('revocation and heartbeat timeout close only their assigned device/profile', async () => {
  let now = Date.now();
  const h = harness({ now: () => now });
  try {
    const alexCredential = await h.issue('robot-alex', 'profile-alex');
    const caseyCredential = await h.issue('robot-casey', 'profile-casey');
    const alex = h.connect(alexCredential);
    const casey = h.connect(caseyCredential);
    await Promise.all([alex.hello(), casey.hello()]);
    await alex.apply('input.start', null);
    const other = await casey.apply('input.start', null);
    const revoked = await h.internal('revoke', {
      actor: 'fixture-caregiver',
      input: { deviceId: 'robot-alex', commandId: crypto.randomUUID() },
    });
    expect(revoked.response.status).toBe(200);
    await alex.closed;
    expect(casey.socket.readyState).toBe(WebSocket.OPEN);
    expect(casey.latest()?.phase).toBe('ready');
    const browser = h.connect(await h.issue('browser-alex', 'profile-alex'), 'browser');
    await browser.hello();
    await browser.apply('input.start', null);
    now += 6100;
    casey.send('heartbeat');
    await casey.wait((event) => event.type === 'heartbeat');
    await browser.closed;
    expect(casey.socket.readyState).toBe(WebSocket.OPEN);
    expect(casey.latest()?.id).toBe(other.id);
    expect(casey.latest()?.generation).toBe(other.generation);
    expect(casey.latest()?.phase).toBe('ready');
  } finally {
    await h.close();
  }
});

test('browser cookie upgrades require the assigned browser endpoint and exact configured Origin', async () => {
  const h = harness();
  try {
    const browserToken = await h.issue('browser-alex', 'profile-alex');
    const robotToken = await h.issue('robot-alex', 'profile-alex');
    for (const [token, origin] of [
      [browserToken, null],
      [browserToken, 'https://foreign.invalid'],
      [robotToken, publicOrigin],
    ] as const) {
      const denied = h.connect(token, 'browser', origin);
      await expect(denied.opened).rejects.toThrow('Endpoint upgrade rejected');
    }
    const accepted = h.connect(browserToken, 'browser', publicOrigin);
    await accepted.hello();
    const session = await accepted.apply('input.start', null);
    expect(session.activeEndpointId).toBe('browser-alex');
    expect(session.endpoint).toBe('browser');
  } finally {
    await h.close();
  }
});

test('concurrent speech output is delivered only to each profile owner, never an observer or another profile', async () => {
  const h = harness({
    speech: {
      stt: {
        async transcribe(input) {
          return ok({ text: input.pcm[0] === 3 ? 'Hello Casey' : 'Hello Alex', language: 'en' });
        },
      },
      tts: {
        async synthesize(input) {
          return ok({
            pcm: new Uint8Array(882 * 2).fill(input.text.includes('Casey') ? 3 : 2),
            sampleRate: 22050,
            encoding: 'pcm_s16le',
            channels: 1,
            language: 'en',
          });
        },
      },
    },
  });
  try {
    const alex = h.connect(await h.issue('robot-alex', 'profile-alex'));
    const casey = h.connect(await h.issue('robot-casey', 'profile-casey'));
    const observer = h.connect(await h.issue('browser-alex', 'profile-alex'), 'browser');
    await Promise.all([alex.hello(true), casey.hello(true), observer.hello(true)]);
    await Promise.all([alex.apply('input.start', null), casey.apply('input.start', null)]);
    await Promise.all([
      alex.apply('input.mute', alex.latest(), { muted: false }),
      casey.apply('input.mute', casey.latest(), { muted: false }),
    ]);
    const capture = async (client: typeof alex, marker: number) => {
      const listening = await client.apply('input.speak', client.latest(), { language: 'en' });
      const grant = listening.captureGrant!;
      for (let chunkIndex = 0; chunkIndex < 2; chunkIndex++)
        client.send(
          'audio.chunk',
          listening,
          {
            leaseId: grant.leaseId,
            streamId: grant.streamId,
            chunkIndex,
            encoding: 'pcm_s16le',
            data: Buffer.alloc(640, marker).toString('base64'),
          },
          grant.turnId,
        );
      client.send(
        'audio.end',
        listening,
        { leaseId: grant.leaseId, streamId: grant.streamId, chunkCount: 2 },
        grant.turnId,
      );
      const start = await client.wait((event) => event.type === 'response.start');
      await client.wait((event) => event.type === 'audio.end');
      if (start.type !== 'response.start') throw new Error('Missing speech metadata');
      return start.payload;
    };
    const [a, c] = await Promise.all([capture(alex, 2), capture(casey, 3)]);
    for (const [client, marker, meta] of [
      [alex, 2, a],
      [casey, 3, c],
    ] as const) {
      const chunks = client.events.filter((event) => event.type === 'audio.chunk');
      expect(chunks).toHaveLength(2);
      expect(
        chunks.every(
          (event) =>
            event.type === 'audio.chunk' &&
            Buffer.from(event.payload.data, 'base64').every((byte) => byte === marker),
        ),
      ).toBe(true);
      expect(chunks.every((event) => event.turn_id === meta.turnId)).toBe(true);
    }
    expect(
      observer.events.some((event) =>
        ['response.start', 'response.text', 'audio.chunk', 'audio.end'].includes(event.type),
      ),
    ).toBe(false);
    const after = observer.events.length;
    const forged = observer.send(
      'audio.receipt',
      observer.latest(),
      { leaseId: a.leaseId, streamId: a.streamId, status: 'completed', playedChunks: 2 },
      a.turnId,
    );
    const rejected = await observer.wait(
      (event) => event.type === 'error' && event.payload.commandId === forged,
      after,
    );
    expect(rejected.type === 'error' && rejected.payload.code).toBe('FORBIDDEN');
    expect(alex.latest()?.phase).toBe('processing');
    await casey.apply('input.stop');
    expect(alex.latest()?.phase).toBe('processing');
    expect(alex.events.some((event) => event.type === 'response.cancel')).toBe(false);
  } finally {
    await h.close();
  }
});

test('revoking an observing browser rejects its reconnect without canceling the robot owner turn', async () => {
  let finish!: (result: any) => void;
  let signal!: AbortSignal;
  let modelStarted!: () => void;
  const modelReady = new Promise<void>((resolve) => {
    modelStarted = resolve;
  });
  const h = harness({
    chatAdapter: {
      complete(_input, canceled) {
        signal = canceled;
        return new Promise((resolve) => {
          finish = resolve;
          modelStarted();
        });
      },
    },
  });
  try {
    const robot = h.connect(await h.issue('robot-alex', 'profile-alex'));
    const token = await h.issue('browser-alex', 'profile-alex');
    const browser = h.connect(token, 'browser');
    await Promise.all([robot.hello(), browser.hello()]);
    const started = await robot.apply('input.start', null);
    const turn = robot.send('input.text', started, {
      text: 'A fictional greeting',
      language: 'en',
    });
    await robot.wait(
      (event) => event.type === 'state.changed' && event.payload.session?.phase === 'processing',
    );
    // A processing snapshot can precede the asynchronous adapter invocation.
    // Wait for the actual pending model turn before revoking an observer.
    await modelReady;
    const revoke = await h.internal('revoke', {
      actor: 'fixture-caregiver',
      input: { deviceId: 'browser-alex', commandId: crypto.randomUUID() },
    });
    expect(revoke.response.status).toBe(200);
    await browser.closed;
    expect(signal.aborted).toBe(false);
    const stale = h.connect(token, 'browser', publicOrigin);
    await expect(stale.opened).rejects.toThrow('Endpoint upgrade rejected');
    finish(ok({ text: 'Hello from your companion.', language: 'en' }));
    await robot.wait((event) => event.type === 'response.text' && event.payload.turnId === turn);
    await robot.wait(
      (event) => event.type === 'state.changed' && event.payload.session?.phase === 'waiting',
    );
    expect(robot.latest()?.phase).toBe('waiting');
    expect(robot.latest()?.generation).toBe(started.generation);
  } finally {
    await h.close();
  }
});
