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
  let context;
  class Context {
    constructor() {
      context = this;
    }
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
  const playback = [];
  const audio = new BrowserAudio(
    connection,
    (value) => states.push(value),
    () => {},
    (value) => playback.push(value),
  );
  return {
    audio,
    sent,
    track,
    listeners,
    session,
    states,
    playback,
    get context() {
      return context;
    },
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

test('paused fixed speech survives receipt snapshots and completes without granting capture', async () => {
  const f = fixture();
  try {
    await f.audio.speak();
    f.audio.cancelInput();
    f.session.phase = 'paused';
    const fixed = { ...meta, chunkCount: 8, byteLength: 882 * 8 };
    const state = () =>
      f.audio.receive(event('state.changed', { session: { ...f.session } }), 'browser');
    state();
    f.audio.receive(
      event('response.text', {
        turnId: 'turn',
        text: 'Fixed application guidance',
        language: 'en',
        source: 'fixed',
      }),
      'browser',
    );
    f.audio.receive(event('response.start', fixed), 'browser');
    const chunk = (index) =>
      f.audio.receive(
        event('audio.chunk', {
          leaseId: 'lease',
          streamId: 'output',
          chunkIndex: index,
          encoding: 'pcm_s16le',
          data: btoa('\0'.repeat(882)),
        }),
        'browser',
      );
    for (let i = 0; i < 4; i++) chunk(i);
    expect(f.listeners).toHaveLength(4);
    f.listeners[0].onended();
    expect(f.sent.at(-1)[1].status).toBe('started');
    state();
    expect(f.listeners[1].stopped).not.toBe(true);
    for (let i = 1; i < 4; i++) f.listeners[i].onended();
    state();
    for (let i = 4; i < 8; i++) chunk(i);
    f.audio.receive(
      event('audio.end', { leaseId: 'lease', streamId: 'output', chunkCount: 8 }),
      'browser',
    );
    for (let i = 4; i < 8; i++) f.listeners[i].onended();
    expect(
      f.sent.filter(([type]) => type === 'audio.receipt').map(([, payload]) => payload.status),
    ).toEqual(['started', 'progress', 'progress', 'completed']);
    expect(f.session.phase).toBe('paused');
    expect(f.track.stopped).toBe(true);
    expect(f.sent.filter(([type]) => type === 'input.speak')).toHaveLength(1);
  } finally {
    f.restore();
  }
});

test('paused audio requires matching current fixed text and local cancellation retires that permission', async () => {
  const f = fixture();
  try {
    await f.audio.speak();
    f.audio.cancelInput();
    f.session.phase = 'paused';
    const chunk = () =>
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
    const fixed = (overrides = {}) =>
      event(
        'response.text',
        { turnId: 'turn', text: 'Guidance', language: 'en', source: 'fixed' },
        overrides,
      );
    for (const text of [
      null,
      event('response.text', {
        turnId: 'turn',
        text: 'Model response',
        language: 'en',
        source: 'model',
      }),
      fixed({ generation: 0 }),
      fixed({ turn_id: 'foreign' }),
    ]) {
      if (text) f.audio.receive(text, 'browser');
      f.audio.receive(event('response.start', meta), 'browser');
      chunk();
      expect(f.listeners).toHaveLength(0);
    }
    f.audio.receive(fixed(), 'browser');
    f.audio.receive(event('response.start', meta), 'browser');
    chunk();
    expect(f.listeners).toHaveLength(1);
    f.audio.cancel();
    expect(f.listeners[0].stopped).toBe(true);
    f.audio.receive(event('response.start', meta), 'browser');
    chunk();
    expect(f.listeners).toHaveLength(1);
  } finally {
    f.restore();
  }
});

test('same-lease generation or policy changes flush fixed playback and reject its old authorization', async () => {
  for (const change of [
    { generation: 2 },
    { policyRevision: 1 },
    { privacyRevision: 1 },
    { profileRevision: 1 },
    { activeEndpointId: 'other' },
  ]) {
    const f = fixture();
    try {
      await f.audio.speak();
      f.audio.cancelInput();
      f.session.phase = 'paused';
      f.audio.receive(
        event('response.text', {
          turnId: 'turn',
          text: 'Guidance',
          language: 'en',
          source: 'fixed',
        }),
        'browser',
      );
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
      expect(f.listeners).toHaveLength(1);
      Object.assign(f.session, change);
      f.audio.receive(event('state.changed', { session: { ...f.session } }), 'browser');
      expect(f.listeners[0].stopped).toBe(true);
      expect(f.listeners[0].onended).toBeNull();
    } finally {
      f.restore();
    }
  }
});

test('avatar follows consumed playback time and closes on gaps and cancellation', async () => {
  const f = fixture();
  try {
    await f.audio.speak();
    f.audio.cancelInput();
    f.audio.receive(event('response.start', meta), 'browser');
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(f.playback).toEqual([]);
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
    // Scheduled audio has not reached the speaker yet.
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(f.playback).toEqual([]);
    f.context.currentTime = 0.04;
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(f.playback.at(-1)).toBe(true);
    f.context.currentTime = 0.2;
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(f.playback.at(-1)).toBe(false);
    f.context.currentTime = 0.04;
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(f.playback.at(-1)).toBe(true);
    f.audio.cancel();
    expect(f.playback.at(-1)).toBe(false);
    const count = f.playback.length;
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(f.playback).toHaveLength(count);
  } finally {
    f.restore();
  }
});
