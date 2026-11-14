import { test, expect } from 'bun:test';
import { BrowserAudio } from '../apps/web/src/lib/features/browser-audio.ts';
function fixture() {
  const sent = [];
  const listeners = [];
  const track = {
    enabled: true,
    stopped: false,
    stop() {
      this.stopped = true;
    },
  };
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
  class Context {
    state = 'running';
    sampleRate = 48000;
    currentTime = 0;
    destination = {};
    async resume() {}
    async close() {}
    createMediaStreamSource() {
      return { connect() {}, disconnect() {} };
    }
    createScriptProcessor() {
      return { connect() {}, disconnect() {}, onaudioprocess: null };
    }
    createBuffer(_channels, count) {
      const data = new Float32Array(count);
      return { duration: count / 22050, getChannelData: () => data };
    }
    createBufferSource() {
      const source = {
        buffer: null,
        onended: null,
        connect() {},
        disconnect() {},
        start() {
          listeners.push(source);
        },
        stop() {
          source.stopped = true;
        },
      };
      return source;
    }
  }
  const original = globalThis.AudioContext;
  globalThis.AudioContext = Context;
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { mediaDevices: { getUserMedia: async () => stream } },
  });
  const session = {
    id: 'session',
    generation: 1,
    leaseId: 'lease',
    activeEndpointId: 'browser',
    phase: 'waiting',
    micMuted: false,
    captureGrant: null,
  };
  const connection = {
    session,
    send: (...args) => {
      sent.push(args);
      return true;
    },
  };
  const states = [];
  const audio = new BrowserAudio(
    connection,
    (value) => states.push(value),
    () => {},
  );
  return {
    audio,
    sent,
    track,
    listeners,
    session,
    states,
    restore() {
      audio.close();
      globalThis.AudioContext = original;
      if (descriptor) Object.defineProperty(globalThis, 'navigator', descriptor);
      else delete globalThis.navigator;
    },
  };
}
function event(type, payload, overrides = {}) {
  return { type, payload, session_id: 'session', generation: 1, turn_id: 'turn', ...overrides };
}
const meta = {
  turnId: 'turn',
  leaseId: 'lease',
  streamId: 'output',
  encoding: 'pcm_s16le',
  channels: 1,
  sampleRate: 22050,
  chunkBytes: 882,
  chunkCount: 1,
  byteLength: 882,
};
test('browser microphone remains disabled until grant and Stop closes tracks', async () => {
  const f = fixture();
  try {
    await f.audio.speak();
    expect(f.track.enabled).toBe(false);
    expect(f.sent[0][0]).toBe('input.speak');
    f.audio.receive(
      event('state.changed', {
        session: {
          ...f.session,
          phase: 'listening',
          captureGrant: { turnId: 'turn', leaseId: 'lease', streamId: 'input', generation: 1 },
        },
      }),
      'browser',
    );
    expect(f.track.enabled).toBe(true);
    expect(f.states.at(-1)).toBe(true);
    f.audio.cancel();
    expect(f.track.stopped).toBe(true);
    expect(f.states.at(-1)).toBe(false);
  } finally {
    f.restore();
  }
});
test('browser sends playback completion only after consumed samples and stream end, cancels stale output', async () => {
  const f = fixture();
  try {
    await f.audio.speak();
    f.audio.cancelInput();
    f.audio.receive(event('response.start', meta, { generation: 0 }), 'browser');
    f.audio.receive(
      event('audio.chunk', {
        leaseId: 'lease',
        streamId: 'output',
        chunkIndex: 0,
        encoding: 'pcm_s16le',
        data: btoa('\0'.repeat(882)),
      }),
      'browser',
    );
    expect(f.listeners).toHaveLength(0);
    f.audio.receive(event('response.start', meta), 'browser');
    f.audio.receive(
      event('audio.chunk', {
        leaseId: 'lease',
        streamId: 'output',
        chunkIndex: 0,
        encoding: 'pcm_s16le',
        data: btoa('\0'.repeat(882)),
      }),
      'browser',
    );
    f.audio.receive(
      event('audio.end', { leaseId: 'lease', streamId: 'output', chunkCount: 1 }),
      'browser',
    );
    expect(f.sent.filter(([type]) => type === 'audio.receipt')).toHaveLength(0);
    f.listeners[0].onended();
    expect(
      f.sent.filter(([type]) => type === 'audio.receipt').map(([, payload]) => payload.status),
    ).toEqual(['started', 'completed']);
    f.audio.receive(event('response.start', meta), 'browser');
    f.audio.receive(
      event('audio.chunk', {
        leaseId: 'lease',
        streamId: 'output',
        chunkIndex: 0,
        encoding: 'pcm_s16le',
        data: btoa('\0'.repeat(882)),
      }),
      'browser',
    );
    f.audio.receive(
      event('state.changed', { session: { ...f.session, activeEndpointId: 'robot' } }),
      'browser',
    );
    expect(f.listeners[1].stopped).toBe(true);
    expect(f.listeners[1].onended).toBeNull();
  } finally {
    f.restore();
  }
});

test('late microphone permission cannot reopen capture after local cancellation', async () => {
  const f = fixture();
  try {
    let resolvePermission;
    navigator.mediaDevices.getUserMedia = () =>
      new Promise((resolve) => {
        resolvePermission = resolve;
      });
    const work = f.audio.speak();
    await Promise.resolve();
    f.audio.cancel();
    resolvePermission({ getTracks: () => [f.track], getAudioTracks: () => [f.track] });
    await work;
    expect(f.track.stopped).toBe(true);
    expect(f.sent).toHaveLength(0);
  } finally {
    f.restore();
  }
});
