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
  constructor() {
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
  start() {}
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
  const client = new VoiceClient((value: unknown) => (state = value));
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
