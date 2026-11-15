import { test, expect } from 'bun:test';
import { BrowserAudio } from '../apps/web/src/lib/features/browser-audio.ts';
function fixture(options = {}) {
  const sent = [];
  const listeners = [];
  const processors = [];
  const errors = [];
  const timings = [];
  let now = 0;
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
      const processor = { connect() {}, disconnect() {}, onaudioprocess: null };
      processors.push(processor);
      return processor;
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
        start(at) {
          source.startedAt = at;
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
    (error) => errors.push(error),
    (value) => playback.push(value),
    { automatic: false, now: () => now, onTiming: (timing) => timings.push(timing), ...options },
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
    errors,
    timings,
    processors,
    advance(ms) {
      now += ms;
    },
    grant() {
      session.phase = 'listening';
      session.captureGrant = { turnId: 'turn', leaseId: 'lease', streamId: 'input', generation: 1 };
      audio.receive(event('state.changed', { session: { ...session } }), 'browser');
      processors
        .at(-1)
        .onaudioprocess({ inputBuffer: { getChannelData: () => new Float32Array(1) } });
    },
    frames(voice, count) {
      for (let i = 0; i < count; i++) {
        now += 20;
        processors.at(-1).onaudioprocess?.({
          inputBuffer: { getChannelData: () => new Float32Array(960).fill(voice ? 0.2 : 0) },
        });
      }
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

function automatic(overrides = {}) {
  const detector = {
    closed: false,
    process: (pcm) => new DataView(pcm.buffer).getInt16(20, true) !== 0,
    destroy() {
      this.closed = true;
    },
  };
  return {
    detector,
    ...fixture({ automatic: true, loadDetector: async () => detector, ...overrides }),
  };
}

test('automatic turn ending tolerates thinking pauses and resumed speech, then submits exactly once', async () => {
  const f = automatic();
  try {
    await f.audio.speak();
    expect(f.track.enabled).toBe(false);
    f.grant();
    f.frames(true, 15);
    f.frames(false, 60); // 1.2 seconds stays below the selected 1.5-second threshold.
    expect(f.sent.filter(([type]) => type === 'audio.end')).toHaveLength(0);
    f.frames(true, 10);
    f.frames(false, 74);
    expect(f.track.stopped).toBe(false);
    f.frames(false, 1);
    expect(f.track.stopped).toBe(true);
    expect(f.detector.closed).toBe(true);
    const end = f.sent.filter(([type]) => type === 'audio.end');
    expect(end).toHaveLength(1);
    expect(end[0][1].chunkCount).toBe(f.sent.filter(([type]) => type === 'audio.chunk').length);
    f.audio.finish();
    expect(f.sent.filter(([type]) => type === 'audio.end')).toHaveLength(1);
    expect(f.timings.at(-1).reason).toBe('silence');
  } finally {
    f.restore();
  }
});

test('initial silence and a brief noise burst pause locally without submitting recognition', async () => {
  const f = automatic();
  try {
    await f.audio.speak();
    f.grant();
    f.frames(true, 2);
    f.frames(false, 748);
    expect(f.track.stopped).toBe(true);
    expect(f.sent.at(-1)[0]).toBe('input.pause');
    expect(f.sent.some(([type]) => type === 'audio.end')).toBe(false);
    expect(f.errors.at(-1)).toContain('No speech detected');
  } finally {
    f.restore();
  }
});

test('manual finish works with detection unavailable and late initialization is disposed after Stop', async () => {
  const f = automatic({
    loadDetector: async () => {
      throw new Error('No WASM');
    },
  });
  try {
    await f.audio.speak();
    f.grant();
    f.frames(true, 10);
    f.audio.finish();
    expect(f.errors[0]).toContain('Tap Finish speaking');
    expect(f.sent.filter(([type]) => type === 'audio.end')).toHaveLength(1);
    expect(f.timings.at(-1).reason).toBe('manual');
  } finally {
    f.restore();
  }

  let resolve;
  const late = automatic({
    loadDetector: () =>
      new Promise((done) => {
        resolve = done;
      }),
  });
  try {
    const work = late.audio.speak();
    await Promise.resolve();
    late.audio.cancel();
    resolve(late.detector);
    await work;
    expect(late.detector.closed).toBe(true);
    expect(late.sent).toHaveLength(0);
  } finally {
    late.restore();
  }
});

test('a stalled detector falls back to manual control and its late result is destroyed', async () => {
  let resolve;
  const f = automatic({
    loadDetector: () =>
      new Promise((done) => {
        resolve = done;
      }),
  });
  try {
    await f.audio.speak(); // Three-second bounded initialization, no open mic yet.
    expect(f.errors[0]).toContain('Automatic turn ending is unavailable');
    expect(f.track.enabled).toBe(false);
    resolve(f.detector);
    await Promise.resolve();
    expect(f.detector.closed).toBe(true);
    f.grant();
    f.frames(true, 10);
    f.audio.finish();
    expect(f.sent.filter(([type]) => type === 'audio.end')).toHaveLength(1);
  } finally {
    f.restore();
  }
});

test('a detector error during speech preserves manual submission without restarting capture', async () => {
  let fail = false;
  const detector = {
    process: () => {
      if (fail) throw new Error('WASM failed');
      return true;
    },
    destroy() {},
  };
  const f = automatic({ loadDetector: async () => detector });
  try {
    await f.audio.speak();
    f.grant();
    f.frames(true, 10);
    fail = true;
    f.frames(true, 1);
    expect(f.errors.at(-1)).toContain('Tap Finish speaking');
    expect(f.track.stopped).toBe(false);
    f.audio.finish();
    expect(f.track.stopped).toBe(true);
    expect(f.sent.filter(([type]) => type === 'audio.end')).toHaveLength(1);
    expect(f.sent.filter(([type]) => type === 'input.speak')).toHaveLength(1);
  } finally {
    f.restore();
  }
});

test('cancellation and authority changes retire voice detection and queued capture callbacks', async () => {
  for (const change of [
    { phase: 'paused', captureGrant: null },
    { micMuted: true, captureGrant: null },
    { generation: 2 },
    { privacyRevision: 2 },
    { policyRevision: 2 },
    { profileRevision: 2 },
    { activeEndpointId: 'robot' },
  ]) {
    const f = automatic();
    try {
      await f.audio.speak();
      f.grant();
      f.frames(true, 10);
      const late = f.processors[0].onaudioprocess;
      Object.assign(f.session, change);
      f.audio.receive(event('state.changed', { session: { ...f.session } }), 'browser');
      expect(f.detector.closed).toBe(true);
      expect(f.track.stopped).toBe(true);
      const count = f.sent.length;
      late({ inputBuffer: { getChannelData: () => new Float32Array(960) } });
      expect(f.sent).toHaveLength(count);
      expect(f.sent.some(([type]) => type === 'audio.end')).toBe(false);
    } finally {
      f.restore();
    }
  }
});

test('manual mode remains available and capture never exceeds the existing bounded turn', async () => {
  const f = automatic();
  try {
    await f.audio.speak();
    f.grant();
    f.frames(true, 975);
    expect(f.sent.filter(([type]) => type === 'audio.chunk')).toHaveLength(975);
    expect(f.sent.at(-1)[0]).toBe('audio.end');
    expect(f.timings.at(-1).reason).toBe('limit');
    expect(f.track.stopped).toBe(true);
  } finally {
    f.restore();
  }
});

test('browser diagnostics measure scheduled start and playback gaps without content or identifiers', async () => {
  const f = automatic();
  try {
    await f.audio.speak();
    f.grant();
    f.frames(true, 10);
    f.audio.finish();
    f.session.phase = 'processing';
    f.session.captureGrant = null;
    f.advance(500);
    f.audio.receive(
      event('response.start', { ...meta, chunkCount: 2, byteLength: 1764 }),
      'browser',
    );
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
    chunk(0);
    expect(f.timings.at(-1)).toEqual({ stage: 'turn_end_to_scheduled_playback', durationMs: 580 });
    f.audio.context.currentTime = 0.2;
    chunk(1);
    expect(f.timings.at(-1)).toEqual({ stage: 'playback_gap', durationMs: 100 });
    expect(JSON.stringify(f.timings)).not.toContain('turnId');
    expect(JSON.stringify(f.timings)).not.toContain('lease');
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
    ).toEqual(['started', 'progress', 'progress', 'progress', 'progress', 'completed']);
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
    f.context.currentTime = 0.09;
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(f.playback.at(-1)).toBe(true);
    f.context.currentTime = 0.2;
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(f.playback.at(-1)).toBe(false);
    f.context.currentTime = 0.09;
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

function readyPlayback(audio, window) {
  audio.receive(event('device.ready', { audio: { outputWindowChunks: window } }), 'browser');
}
function receivePlaybackChunk(f, metadata, chunkIndex) {
  f.audio.receive(
    event('audio.chunk', {
      leaseId: metadata.leaseId,
      streamId: metadata.streamId,
      chunkIndex,
      encoding: 'pcm_s16le',
      data: btoa('\0'.repeat(metadata.chunkBytes)),
    }),
    'browser',
  );
}
test('browser negotiated twelve-frame cushion schedules contiguous audio and credits only consumed frames', async () => {
  const f = fixture();
  try {
    await f.audio.speak();
    f.audio.cancelInput();
    readyPlayback(f.audio, 12);
    const metadata = { ...meta, chunkCount: 12, byteLength: meta.chunkBytes * 12 };
    f.audio.receive(event('response.start', metadata), 'browser');
    for (let i = 0; i < 12; i++) receivePlaybackChunk(f, metadata, i);
    expect(f.listeners).toHaveLength(12);
    expect(f.sent.filter(([type]) => type === 'audio.receipt')).toHaveLength(0);
    for (let i = 0; i < 12; i++) expect(f.listeners[i].startedAt).toBeCloseTo(0.08 + i * 0.02, 8);
    f.audio.receive(
      event('audio.end', { leaseId: 'lease', streamId: 'output', chunkCount: 12 }),
      'browser',
    );
    expect(f.sent.filter(([type]) => type === 'audio.receipt')).toHaveLength(0);
    f.listeners[0].onended();
    expect(
      f.sent
        .filter(([type]) => type === 'audio.receipt')
        .map(([, p]) => [p.status, p.playedChunks]),
    ).toEqual([['started', 0]]);
    f.listeners[1].onended();
    expect(f.sent.filter(([type]) => type === 'audio.receipt').at(-1)[1]).toMatchObject({
      status: 'progress',
      playedChunks: 2,
    });
    for (let i = 2; i < 12; i++) f.listeners[i].onended();
    expect(f.sent.filter(([type]) => type === 'audio.receipt').at(-1)[1]).toMatchObject({
      status: 'completed',
      playedChunks: 12,
    });
  } finally {
    f.restore();
  }
});
test('browser negotiated playback window stays bounded and Stop cancels every scheduled frame', async () => {
  for (const window of [4, 12]) {
    const f = fixture();
    try {
      await f.audio.speak();
      f.audio.cancelInput();
      readyPlayback(f.audio, window);
      const metadata = {
        ...meta,
        chunkCount: window + 1,
        byteLength: meta.chunkBytes * (window + 1),
      };
      f.audio.receive(event('response.start', metadata), 'browser');
      for (let i = 0; i < window; i++) receivePlaybackChunk(f, metadata, i);
      expect(f.listeners).toHaveLength(window);
      expect(f.sent.filter(([type]) => type === 'audio.receipt')).toHaveLength(0);
      receivePlaybackChunk(f, metadata, window);
      expect(f.listeners).toHaveLength(window);
      expect(f.listeners.every((node) => node.stopped && node.onended === null)).toBe(true);
      expect(f.sent.filter(([type]) => type === 'audio.receipt').at(-1)[1]).toMatchObject({
        status: 'failed',
        playedChunks: 0,
      });
    } finally {
      f.restore();
    }
  }
  const f = fixture();
  try {
    await f.audio.speak();
    f.audio.cancelInput();
    readyPlayback(f.audio, 12);
    const metadata = { ...meta, chunkCount: 12, byteLength: meta.chunkBytes * 12 };
    f.audio.receive(event('response.start', metadata), 'browser');
    for (let i = 0; i < 12; i++) receivePlaybackChunk(f, metadata, i);
    f.audio.cancel();
    expect(f.listeners.every((node) => node.stopped && node.onended === null)).toBe(true);
    expect(f.sent.filter(([type]) => type === 'audio.receipt')).toHaveLength(0);
  } finally {
    f.restore();
  }
});
