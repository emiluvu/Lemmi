import { expect, test } from 'bun:test';
import { EventEmitter } from 'node:events';
import { voiceProxy } from '../apps/web/voice-proxy';

test('voice proxy rejects remote, foreign-origin, missing-origin and query upgrades before forwarding', () => {
  const plugin = voiceProxy({
    LEMMI_PUBLIC_ORIGIN: 'https://backend.invalid',
    LEMMI_DEVICE_CREDENTIAL: 'fixture-device-token',
    LEMMI_ACCESS_KEY: 'fixture-gate',
  });
  const server = new EventEmitter();
  const configure = plugin.configureServer;
  if (typeof configure !== 'function') throw new Error('Missing server hook');
  configure.call({} as any, { httpServer: server, middlewares: { use() {} } } as any);
  for (const patch of [
    { headers: { host: '127.0.0.1:5183', origin: 'https://foreign.invalid' } },
    { headers: { host: '127.0.0.1:5183' } },
    { headers: { host: 'foreign.invalid', origin: 'http://foreign.invalid' } },
    { socket: { remoteAddress: '192.0.2.1' } },
    { url: '/voice-stream?destination=https://foreign.invalid' },
  ]) {
    let destroyed = false;
    const request = {
      url: '/voice-stream',
      headers: { host: '127.0.0.1:5183', origin: 'http://127.0.0.1:5183' },
      socket: { remoteAddress: '127.0.0.1' },
      ...patch,
    };
    server.emit('upgrade', request, {
      destroy() {
        destroyed = true;
      },
    });
    expect(destroyed).toBe(true);
    expect(request.url).toBe('/voice-rejected');
  }
  let destroyed = false;
  server.emit(
    'upgrade',
    {
      url: '/voice-stream',
      headers: { host: '127.0.0.1:5183', origin: 'http://127.0.0.1:5183' },
      socket: { remoteAddress: '127.0.0.1' },
    },
    {
      destroy() {
        destroyed = true;
      },
    },
  );
  expect(destroyed).toBe(false);
});

test('voice proxy keeps one HTTPS destination, verifies TLS and overwrites browser credentials/cookies', () => {
  expect(() =>
    voiceProxy({
      LEMMI_PUBLIC_ORIGIN: 'http://backend.invalid',
      LEMMI_DEVICE_CREDENTIAL: 'fixture',
    }),
  ).toThrow();
  expect(() =>
    voiceProxy({
      LEMMI_PUBLIC_ORIGIN: 'https://backend.invalid/path',
      LEMMI_DEVICE_CREDENTIAL: 'fixture',
    }),
  ).toThrow();
  const plugin = voiceProxy({
    LEMMI_PUBLIC_ORIGIN: 'https://backend.invalid',
    LEMMI_DEVICE_CREDENTIAL: 'private-fixture-token',
    LEMMI_ACCESS_KEY: 'private-fixture-gate',
  });
  if (typeof plugin.config !== 'function') throw new Error('Missing config hook');
  const config = plugin.config.call({} as any, {}, {} as any) as any;
  const options = config.server.proxy['/voice-stream'];
  expect(options.target).toBe('https://backend.invalid');
  expect(options.secure).toBe(true);
  expect(options.rewrite('/voice-stream?bad=https://foreign.invalid')).toBe('/v1/device-stream');
  const proxy = new EventEmitter();
  options.configure(proxy);
  const headers: Record<string, string> = {
    cookie: 'browser-cookie',
    authorization: 'browser-controlled',
  };
  proxy.emit('proxyReqWs', {
    removeHeader(key: string) {
      delete headers[key.toLowerCase()];
    },
    setHeader(key: string, value: string) {
      headers[key.toLowerCase()] = value;
    },
  });
  expect(headers.cookie).toBeUndefined();
  expect(headers.authorization).toBe('Bearer private-fixture-token');
  expect(headers.origin).toBe('https://backend.invalid');
  expect(headers['x-lemmi-access-key']).toBe('private-fixture-gate');
});
