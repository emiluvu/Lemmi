import { test, expect } from 'bun:test';
import { ParticipantConnection } from '@lemmi/contracts';
test('browser reconnect ignores stale socket callbacks and bounds its outgoing queue', () => {
  const original = globalThis.WebSocket;
  const sockets = [];
  class Socket {
    static OPEN = 1;
    readyState = 1;
    bufferedAmount = 0;
    sent = [];
    constructor() {
      sockets.push(this);
    }
    send(value) {
      this.sent.push(value);
    }
    close() {
      this.closed = true;
    }
  }
  globalThis.WebSocket = Socket;
  let closes = 0;
  const errors = [];
  const events = [];
  const connection = new ParticipantConnection({
    origin: 'https://fixture.invalid',
    onClose: () => closes++,
    onError: (value) => errors.push(value),
    onEvent: (event) => events.push(event),
  });
  try {
    connection.connect();
    const old = sockets[0];
    old.onopen();
    expect(old.sent).toHaveLength(1);
    connection.connect();
    const current = sockets[1];
    current.onopen();
    old.onclose();
    old.onmessage({ data: 'invalid' });
    expect(closes).toBe(0);
    expect(errors).toHaveLength(0);
    current.bufferedAmount = 65537;
    expect(connection.send('heartbeat')).toBe(false);
    expect(current.closed).toBe(true);
    expect(closes).toBe(1);
    expect(errors).toHaveLength(1);
  } finally {
    connection.close();
    globalThis.WebSocket = original;
  }
});
