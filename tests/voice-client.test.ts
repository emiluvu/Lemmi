import { test, expect, afterEach } from 'bun:test';
import { controlSessionFixture } from '@lemmi/contracts/fixtures';

const original = new Map<string, PropertyDescriptor | undefined>();
function replace(key: string, value: unknown) {
  if (!original.has(key)) original.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
}
afterEach(() => {
  for (const [key, descriptor] of original) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
  original.clear();
});
class Socket {
  static OPEN = 1;
  static last: Socket;
  readyState = 1;
  bufferedAmount = 0;
  sent: any[] = [];
  onopen: (() => void) | null = null;
  onclose: ((event: { code: number; reason: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  url: string;
  constructor(url: string) {
    this.url = url;
    Socket.last = this;
  }
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  close() {
    this.readyState = 3;
  }
}
class Node {
  static last: Node;
  constructor() {
    Node.last = this;
  }
  buffer: any = null;
  onended: (() => void) | null = null;
  stopped = false;
  port = { onmessage: null as ((e: { data: Float32Array }) => void) | null };
  connect() {}
  disconnect() {}
  startedAt: number | null = null;
  start(at: number) {
    this.startedAt = at;
  }
  stop() {
    this.stopped = true;
  }
}
class Context {
  static last: Context;
  state = 'running';
  sampleRate = 48000;
  currentTime = 0;
  destination = {};
  nodes: Node[] = [];
  audioWorklet = { addModule: async () => {} };
  constructor() {
    Context.last = this;
  }
  async resume() {}
  async close() {
    this.state = 'closed';
  }
  createBuffer(_channels: number, length: number, rate: number) {
    const data = new Float32Array(length);
    return {
      duration: length / rate,
      copyToChannel(input: Float32Array) {
        data.set(input);
      },
      getChannelData() {
        return data;
      },
    };
  }
  createBufferSource() {
    const node = new Node();
    this.nodes.push(node);
    return node;
  }
  createMediaStreamSource() {
    return new Node();
  }
  createGain() {
    return { gain: { value: 1 }, connect() {}, disconnect() {} };
  }
}
async function setup(
  getUserMedia: () => Promise<any> = async () => ({ getTracks: () => [{ stop() {} }] }),
  browserDeviceId?: string,
) {
  // This file exercises browser code in Bun with explicit audio/socket fixtures.
  // Keep DOM declarations out of the backend compilation (Bun has its own WebSocket).
  const browserModule = '../apps/web/src/lib/' + 'voice-client.ts';
  const { VoiceClient } = await import(browserModule);
  replace('WebSocket', Socket);
  replace('AudioContext', Context);
  replace('AudioWorkletNode', Node);
  replace('location', { protocol: 'http:', host: '127.0.0.1:5183' });
  replace('navigator', { mediaDevices: { getUserMedia } });
  let state: any;
  const client = new VoiceClient((value: unknown) => (state = value), browserDeviceId);
  await client.connect();
  const ws = Socket.last;
  ws.onopen!();
  let sequence = 0;
  let session = { ...controlSessionFixture, phase: 'ready' as const, micMuted: false };
  const emit = (type: string, payload: any, turn: string | null = null) =>
    ws.onmessage!({
      data: JSON.stringify({
        protocol_version: 1,
        event_id: crypto.randomUUID(),
        session_id: session.id,
        turn_id: turn,
        generation: session.generation,
        sequence: sequence++,
        type,
        payload,
      }),
    });
  emit('state.changed', { mode: 'live', session });
  return { client, ws, emit, session, state: () => state };
}
const ticks = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

function teachingSession(d: Awaited<ReturnType<typeof setup>>, preset = 'guided') {
  return {
    ...d.session,
    phase: 'waiting',
    conversationMode: 'teach_lemmi',
    communicationSupport: { preset, configVersion: 1 },
    teaching: {
      mode: 'teach_lemmi',
      entityId: 'topic:gardening',
      assetId: null,
      topicLabel: 'Gardening',
      prompt: 'Would you like to tell me about flowers?',
      presentationId: 'teaching',
      revision: 0,
      policyRevision: 0,
      phase: 'ready',
    },
  };
}
function playQuestion(
  d: Awaited<ReturnType<typeof setup>>,
  turnId: string,
  text = 'How do you care for roses?',
) {
  d.emit('response.text', { turnId, text, language: 'en', source: 'model' }, turnId);
  const meta = {
    turnId,
    leaseId: d.session.leaseId,
    streamId: `stream-${turnId}`,
    encoding: 'pcm_s16le',
    channels: 1,
    sampleRate: 16000,
    chunkBytes: 640,
    chunkCount: 1,
    byteLength: 640,
  };
  d.emit('response.start', meta, turnId);
  d.emit(
    'audio.chunk',
    {
      leaseId: meta.leaseId,
      streamId: meta.streamId,
      chunkIndex: 0,
      encoding: 'pcm_s16le',
      data: Buffer.alloc(640).toString('base64'),
    },
    turnId,
  );
  d.emit('audio.end', { leaseId: meta.leaseId, streamId: meta.streamId, chunkCount: 1 }, turnId);
  Context.last.nodes.at(-1)!.onended!();
}

test('conversation requests the next microphone grant only after played questions and backend waiting, repeatedly', async () => {
  let opened = 0;
  const d = await setup(async () => {
    opened++;
    return { getTracks: () => [{ stop() {} }] };
  });
  try {
    const session = teachingSession(d);
    d.emit('state.changed', { mode: 'live', session });
    d.client.startConversation();
    await ticks();
    expect(d.state().automaticReplies).toBe(true);
    expect(d.ws.sent.filter((e) => e.type === 'input.speak')).toHaveLength(1);
    for (let i = 1; i <= 4; i++) {
      d.emit('state.changed', { mode: 'live', session: { ...session, phase: 'processing' } });
      playQuestion(d, `question-${i}`);
      await ticks();
      expect(d.ws.sent.filter((e) => e.type === 'input.speak')).toHaveLength(i);
      d.emit('state.changed', { mode: 'live', session });
      await ticks();
      expect(d.ws.sent.filter((e) => e.type === 'input.speak')).toHaveLength(i + 1);
      expect(opened).toBe(0); // a request is not a server capture grant
    }
  } finally {
    d.client.close();
  }
});

test('conversation startup waits for the teaching revision before requesting unmute', async () => {
  const d = await setup();
  try {
    d.emit('state.changed', { mode: 'live', session: { ...d.session, micMuted: true } });
    d.client.startTeachingConversation();
    expect(d.ws.sent.filter((e) => e.type === 'input.mute')).toHaveLength(0);
    const session = { ...teachingSession(d), generation: d.session.generation + 1, micMuted: true };
    d.emit('state.changed', { mode: 'live', session });
    const unmute = d.ws.sent.filter((e) => e.type === 'input.mute');
    expect(unmute).toHaveLength(1);
    expect(unmute[0].generation).toBe(session.generation);
    expect(unmute[0].payload.muted).toBe(false);
    expect(d.ws.sent.filter((e) => e.type === 'input.speak')).toHaveLength(0);
  } finally {
    d.client.close();
  }
});

test('pause, mute, Stop and finish disarm automatic replies even if a late waiting state arrives', async () => {
  for (const action of ['pause', 'mute', 'stop', 'teaching.finish']) {
    const d = await setup();
    try {
      const session = teachingSession(d);
      d.emit('state.changed', { mode: 'live', session });
      d.client.startConversation();
      await ticks();
      playQuestion(d, 'finished-question');
      d.client.command(action);
      const requests = d.ws.sent.filter((e) => e.type === 'input.speak').length;
      d.emit('state.changed', { mode: 'live', session });
      await ticks();
      expect(d.state().automaticReplies).toBe(false);
      expect(d.ws.sent.filter((e) => e.type === 'input.speak')).toHaveLength(requests);
    } finally {
      d.client.close();
    }
  }
});

test('Quiet, non-question replies, backgrounding and changed policy never automatically open another turn', async () => {
  for (const scenario of ['quiet', 'statement', 'background', 'policy']) {
    const d = await setup();
    try {
      const session = teachingSession(d, scenario === 'quiet' ? 'quiet' : 'guided');
      d.emit('state.changed', { mode: 'live', session });
      d.client.startConversation();
      await ticks();
      const requests = d.ws.sent.filter((e) => e.type === 'input.speak').length;
      playQuestion(
        d,
        'last-turn',
        scenario === 'statement' ? 'Thank you for sharing.' : 'Would you like to explain?',
      );
      if (scenario === 'background') d.client.background();
      d.emit('state.changed', {
        mode: 'live',
        session:
          scenario === 'policy'
            ? {
                ...session,
                policyRevision: 1,
                teaching: { ...session.teaching, policyRevision: 1 },
              }
            : session,
      });
      await ticks();
      expect(d.ws.sent.filter((e) => e.type === 'input.speak')).toHaveLength(requests);
    } finally {
      d.client.close();
    }
  }
});

test('voice client negotiates PCM and contains no browser credential; Stop suppresses late output locally', async () => {
  const d = await setup();
  try {
    expect(d.ws.sent[0].payload.playback.sampleRates).toContain(22050);
    expect(JSON.stringify(d.ws.sent)).not.toContain('credential');
    const meta = {
      turnId: 'voice-turn',
      leaseId: d.session.leaseId,
      streamId: 'voice-stream',
      encoding: 'pcm_s16le',
      channels: 1,
      sampleRate: 16000,
      chunkBytes: 640,
      chunkCount: 1,
      byteLength: 640,
    };
    d.emit('response.start', meta, meta.turnId);
    d.emit(
      'audio.chunk',
      {
        leaseId: meta.leaseId,
        streamId: meta.streamId,
        chunkIndex: 0,
        encoding: 'pcm_s16le',
        data: Buffer.alloc(640, 2).toString('base64'),
      },
      meta.turnId,
    );
    expect(Context.last.nodes).toHaveLength(1);
    d.client.command('stop');
    expect(Context.last.nodes[0]!.stopped).toBe(true);
    expect(d.ws.sent.at(-1).type).toBe('input.stop');
    d.emit('response.start', meta, meta.turnId);
    expect(Context.last.nodes).toHaveLength(1);
    expect(d.state().listening).toBe(false);
  } finally {
    d.client.close();
  }
});

test('speaker receipts follow consumed samples, never merely received frames', async () => {
  const d = await setup();
  try {
    const meta = {
      turnId: 'voice-turn',
      leaseId: d.session.leaseId,
      streamId: 'voice-stream',
      encoding: 'pcm_s16le',
      channels: 1,
      sampleRate: 16000,
      chunkBytes: 640,
      chunkCount: 1,
      byteLength: 640,
    };
    d.emit('response.start', meta, meta.turnId);
    d.emit(
      'audio.chunk',
      {
        leaseId: meta.leaseId,
        streamId: meta.streamId,
        chunkIndex: 0,
        encoding: 'pcm_s16le',
        data: Buffer.alloc(640).toString('base64'),
      },
      meta.turnId,
    );
    d.emit(
      'audio.end',
      { leaseId: meta.leaseId, streamId: meta.streamId, chunkCount: 1 },
      meta.turnId,
    );
    expect(d.ws.sent.filter((e) => e.type === 'audio.receipt')).toHaveLength(0);
    Context.last.nodes[0]!.onended!();
    expect(
      d.ws.sent.filter((e) => e.type === 'audio.receipt').map((e) => e.payload.status),
    ).toEqual(['started', 'completed']);
    expect(d.state().playing).toBe(false);
    expect(d.state().listening).toBe(false);
  } finally {
    d.client.close();
  }
});

test('microphone opens only after server listening grant and a delayed permission cannot reopen after Stop', async () => {
  let open = 0,
    release!: (stream: any) => void,
    stopped = 0;
  const d = await setup(() => {
    open++;
    return new Promise((resolve) => (release = resolve));
  });
  try {
    await d.client.speak();
    expect(open).toBe(0);
    expect(d.ws.sent.at(-1).type).toBe('input.speak');
    const session = {
      ...d.session,
      phase: 'listening',
      captureGrant: {
        turnId: 'capture-turn',
        streamId: 'capture-stream',
        generation: d.session.generation,
        leaseId: d.session.leaseId,
        language: 'en',
        expiresAt: '2026-11-14T20:00:00.000Z',
      },
    };
    d.emit('state.changed', { mode: 'live', session });
    await ticks();
    expect(open).toBe(1);
    d.client.command('stop');
    release({
      getTracks: () => [
        {
          stop() {
            stopped++;
          },
        },
      ],
    });
    await ticks();
    expect(stopped).toBe(1);
    expect(d.state().listening).toBe(false);
    expect(d.ws.sent.filter((e) => e.type === 'audio.chunk')).toHaveLength(0);
  } finally {
    d.client.close();
  }
});

test('disconnect closes capture and queued audio without automatic reconnection', async () => {
  const d = await setup();
  d.ws.onclose!({ code: 1006, reason: '' });
  expect(d.state().connected).toBe(false);
  expect(d.state().listening).toBe(false);
  expect(Context.last.state).toBe('closed');
  expect(d.ws.readyState).toBe(3);
  d.client.close();
});

test('the current Lemmi reply remains visible during the next input and updates on each response', async () => {
  const d = await setup();
  try {
    d.emit(
      'response.text',
      { turnId: 'first', text: 'How do you care for roses?', language: 'en', source: 'model' },
      'first',
    );
    expect(d.state().reply).toBe('How do you care for roses?');
    await d.client.speak();
    expect(d.state().reply).toBe('How do you care for roses?');
    d.emit(
      'response.text',
      {
        turnId: 'second',
        text: 'What do you like about the sea?',
        language: 'en',
        source: 'model',
      },
      'second',
    );
    expect(d.state().reply).toBe('What do you like about the sea?');
    d.emit('state.changed', {
      mode: 'live',
      session: { ...d.session, generation: d.session.generation + 1 },
    });
    expect(d.state().reply).toBe('');
    d.emit(
      'response.text',
      { turnId: 'obsolete', text: 'Obsolete topic question', language: 'en', source: 'model' },
      'obsolete',
    );
    expect(d.state().reply).toBe('');
  } finally {
    d.client.close();
  }
});

test('a granted microphone turn auto-submits once after speech and quiet, closing hardware immediately', async () => {
  let stopped = 0;
  const d = await setup(async () => ({
    getTracks: () => [
      {
        stop() {
          stopped++;
        },
      },
    ],
  }));
  try {
    await d.client.speak();
    const session = {
      ...d.session,
      phase: 'listening',
      captureGrant: {
        turnId: 'capture-turn',
        streamId: 'capture-stream',
        generation: d.session.generation,
        leaseId: d.session.leaseId,
        language: 'en',
        expiresAt: '2026-11-14T20:00:00.000Z',
      },
    };
    d.emit('state.changed', { mode: 'live', session });
    await ticks();
    const mic = Node.last;
    for (let i = 0; i < 10; i++) mic.port.onmessage!({ data: new Float32Array(960).fill(0.1) });
    for (let i = 0; i < 100; i++) mic.port.onmessage!({ data: new Float32Array(960) });
    expect(d.ws.sent.filter((e) => e.type === 'audio.end')).toHaveLength(1);
    expect(stopped).toBe(1);
    expect(d.state().listening).toBe(false);
    expect(d.state().pending).toBe(true);
    expect(mic.port.onmessage).toBeNull();
  } finally {
    d.client.close();
  }
});

test('playback progress receipts fit the deployed control budget without inventing consumed frames', async () => {
  const d = await setup();
  try {
    const meta = {
      turnId: 'voice-turn',
      leaseId: d.session.leaseId,
      streamId: 'voice-stream',
      encoding: 'pcm_s16le',
      channels: 1,
      sampleRate: 16000,
      chunkBytes: 640,
      chunkCount: 4,
      byteLength: 2560,
    };
    d.emit('response.start', meta, meta.turnId);
    for (let chunkIndex = 0; chunkIndex < 4; chunkIndex++)
      d.emit(
        'audio.chunk',
        {
          leaseId: meta.leaseId,
          streamId: meta.streamId,
          chunkIndex,
          encoding: 'pcm_s16le',
          data: Buffer.alloc(640).toString('base64'),
        },
        meta.turnId,
      );
    d.emit(
      'audio.end',
      { leaseId: meta.leaseId, streamId: meta.streamId, chunkCount: 4 },
      meta.turnId,
    );
    Context.last.nodes[0]!.onended!();
    expect(
      d.ws.sent.filter((e) => e.type === 'audio.receipt').map((e) => e.payload.status),
    ).toEqual(['started']);
    Context.last.nodes[1]!.onended!();
    Context.last.nodes[2]!.onended!();
    Context.last.nodes[3]!.onended!();
    expect(
      d.ws.sent
        .filter((e) => e.type === 'audio.receipt')
        .map((e) => [e.payload.status, e.payload.playedChunks]),
    ).toEqual([
      ['started', 0],
      ['progress', 2],
      ['completed', 4],
    ]);
  } finally {
    d.client.close();
  }
});

test('teaching avatar opens only inside local speaker playback and closes immediately on Stop', async () => {
  const d = await setup();
  try {
    const turnId = 'mouth-turn';
    const meta = {
      turnId,
      leaseId: d.session.leaseId,
      streamId: 'mouth-output',
      encoding: 'pcm_s16le',
      channels: 1,
      sampleRate: 16000,
      chunkBytes: 640,
      chunkCount: 1,
      byteLength: 640,
    };
    d.emit('response.start', meta, turnId);
    d.emit(
      'audio.chunk',
      {
        leaseId: meta.leaseId,
        streamId: meta.streamId,
        chunkIndex: 0,
        encoding: 'pcm_s16le',
        data: Buffer.alloc(640).toString('base64'),
      },
      turnId,
    );
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(d.state().playing).toBe(false);
    Context.last.currentTime = 0.09;
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(d.state().playing).toBe(true);
    Context.last.currentTime = 0.2;
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(d.state().playing).toBe(false);
    Context.last.currentTime = 0.09;
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(d.state().playing).toBe(true);
    d.client.command('stop');
    expect(d.state().playing).toBe(false);
    expect(Context.last.nodes[0]!.stopped).toBe(true);
  } finally {
    d.client.close();
  }
});

test('deployed photoStory capability does not prevent the teaching handshake', async () => {
  const d = await setup();
  try {
    const payload = {
      mode: 'live',
      deviceId: 'stackchan-alex',
      profileId: 'profile-alex',
      credentialExpiresAt: null,
      audio: false,
      camera: false,
      teaching: true,
      photoStory: true,
      controls: ['start', 'stop', 'pause', 'resume', 'mute', 'help', 'text', 'speak', 'handoff'],
    };
    d.emit('device.ready', payload);
    expect(d.state().connected).toBe(true);
    expect(d.state().ready).toBe(true);
    expect(d.state().teaching).toBe(true);
    expect(d.state().message).not.toContain('Invalid audio');
    const { ServerEventSchema } = await import('@lemmi/contracts');
    const envelope = {
      protocol_version: 1,
      event_id: 'fixture-capability',
      session_id: null,
      turn_id: null,
      generation: 0,
      sequence: 0,
      type: 'device.ready',
      payload,
    };
    expect(ServerEventSchema.safeParse(envelope).success).toBe(true);
    expect(
      ServerEventSchema.safeParse({ ...envelope, payload: { ...payload, photoStory: 'true' } })
        .success,
    ).toBe(false);
    expect(
      ServerEventSchema.safeParse({
        ...envelope,
        payload: { ...payload, arbitraryCapability: true },
      }).success,
    ).toBe(false);
  } finally {
    d.client.close();
  }
});

test('backend persistence failures are explained without automatic reconnect or capture', async () => {
  const d = await setup();
  d.ws.onclose!({ code: 1011, reason: 'Persistent data unavailable' });
  expect(d.state().message).toContain('Backend storage is unavailable');
  expect(d.state().connected).toBe(false);
  expect(d.state().listening).toBe(false);
  expect(d.state().playing).toBe(false);
  expect(d.ws.sent.some((e) => e.type === 'input.start' || e.type === 'input.speak')).toBe(false);
  d.client.close();
});

test('deployed voice uses the enrolled browser socket and rejects another endpoint playback', async () => {
  const d = await setup(undefined, 'enrolled-browser');
  try {
    expect(d.ws.url).toEndWith('/v1/device-stream');
    expect(d.ws.sent[0].payload.endpoint).toBe('browser');
    d.emit('response.text', {
      turnId: 'foreign-turn',
      text: 'Foreign endpoint reply?',
      language: 'en',
      source: 'model',
    });
    expect(d.state().reply).toBe('');
    await d.client.speak();
    expect(d.ws.sent.some((e: any) => e.type === 'input.speak')).toBe(false);
  } finally {
    d.client.close();
  }
});

function negotiatedVoicePlayback(d: Awaited<ReturnType<typeof setup>>, window: 4 | 12) {
  d.emit('device.ready', {
    mode: 'live',
    deviceId: 'stackchan-alex',
    profileId: 'profile-alex',
    credentialExpiresAt: null,
    audio: {
      encoding: 'pcm_s16le',
      sampleRate: 16000,
      channels: 1,
      frameMs: 20,
      maxCaptureMs: 20000,
      playback: { encoding: 'pcm_s16le', channels: 1, sampleRates: [16000] },
      outputWindowChunks: window,
    },
    camera: false,
    teaching: true,
    controls: ['start', 'stop', 'pause', 'resume', 'mute', 'help', 'text', 'speak'],
  });
}
function voiceChunk(d: Awaited<ReturnType<typeof setup>>, metadata: any, chunkIndex: number) {
  d.emit(
    'audio.chunk',
    {
      leaseId: metadata.leaseId,
      streamId: metadata.streamId,
      chunkIndex,
      encoding: 'pcm_s16le',
      data: Buffer.alloc(metadata.chunkBytes).toString('base64'),
    },
    metadata.turnId,
  );
}
test('voice client negotiates twelve queued frames with continuous scheduled times and truthful consumption', async () => {
  const d = await setup();
  try {
    const hello = d.ws.sent.find((e) => e.type === 'device.hello');
    expect(hello.payload.playback.outputWindowChunks).toBe(12);
    negotiatedVoicePlayback(d, 12);
    const metadata = {
      turnId: 'buffered-turn',
      leaseId: d.session.leaseId,
      streamId: 'buffered-stream',
      encoding: 'pcm_s16le',
      channels: 1,
      sampleRate: 16000,
      chunkBytes: 640,
      chunkCount: 12,
      byteLength: 7680,
    };
    d.emit('response.start', metadata, metadata.turnId);
    for (let i = 0; i < 12; i++) voiceChunk(d, metadata, i);
    expect(Context.last.nodes).toHaveLength(12);
    expect(d.ws.sent.filter((e) => e.type === 'audio.receipt')).toHaveLength(0);
    for (let i = 0; i < 12; i++)
      expect(Context.last.nodes[i]!.startedAt).toBeCloseTo(0.08 + i * 0.02, 8);
    d.emit(
      'audio.end',
      { leaseId: metadata.leaseId, streamId: metadata.streamId, chunkCount: 12 },
      metadata.turnId,
    );
    expect(d.ws.sent.filter((e) => e.type === 'audio.receipt')).toHaveLength(0);
    Context.last.nodes[0]!.onended!();
    expect(
      d.ws.sent
        .filter((e) => e.type === 'audio.receipt')
        .map((e) => [e.payload.status, e.payload.playedChunks]),
    ).toEqual([['started', 0]]);
    Context.last.nodes[1]!.onended!();
    expect(d.ws.sent.filter((e) => e.type === 'audio.receipt').at(-1).payload).toMatchObject({
      status: 'progress',
      playedChunks: 2,
    });
    for (let i = 2; i < 12; i++) Context.last.nodes[i]!.onended!();
    expect(d.ws.sent.filter((e) => e.type === 'audio.receipt').at(-1).payload).toMatchObject({
      status: 'completed',
      playedChunks: 12,
    });
  } finally {
    d.client.close();
  }
});
test('voice client enforces the negotiated four or twelve frame bound and stops scheduled audio locally', async () => {
  for (const window of [4, 12] as const) {
    const d = await setup();
    try {
      negotiatedVoicePlayback(d, window);
      const metadata = {
        turnId: 'bounded-turn',
        leaseId: d.session.leaseId,
        streamId: 'bounded-stream',
        encoding: 'pcm_s16le',
        channels: 1,
        sampleRate: 16000,
        chunkBytes: 640,
        chunkCount: window + 1,
        byteLength: 640 * (window + 1),
      };
      d.emit('response.start', metadata, metadata.turnId);
      for (let i = 0; i < window; i++) voiceChunk(d, metadata, i);
      expect(Context.last.nodes).toHaveLength(window);
      expect(d.ws.sent.filter((e) => e.type === 'audio.receipt')).toHaveLength(0);
      voiceChunk(d, metadata, window);
      expect(Context.last.nodes).toHaveLength(window);
      expect(Context.last.nodes.every((node) => node.stopped && node.onended === null)).toBe(true);
      expect(d.state().message).toContain('Invalid audio');
      expect(d.ws.sent.filter((e) => e.type === 'audio.receipt')).toHaveLength(0);
    } finally {
      d.client.close();
    }
  }
  const d = await setup();
  try {
    negotiatedVoicePlayback(d, 12);
    const metadata = {
      turnId: 'stop-buffered',
      leaseId: d.session.leaseId,
      streamId: 'stop-stream',
      encoding: 'pcm_s16le',
      channels: 1,
      sampleRate: 16000,
      chunkBytes: 640,
      chunkCount: 12,
      byteLength: 7680,
    };
    d.emit('response.start', metadata, metadata.turnId);
    for (let i = 0; i < 12; i++) voiceChunk(d, metadata, i);
    d.client.command('stop');
    expect(Context.last.nodes.every((node) => node.stopped && node.onended === null)).toBe(true);
    expect(d.ws.sent.filter((e) => e.type === 'audio.receipt')).toHaveLength(0);
    expect(d.ws.sent.at(-1).type).toBe('input.stop');
  } finally {
    d.client.close();
  }
});
