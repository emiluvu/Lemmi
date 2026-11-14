import { test, expect } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DeviceEventSchema, ServerEventSchema } from '@lemmi/contracts';

test('local browser WebSocket reaches one certificate-verified backend with private headers only on the server', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lemmi-browser-voice-'));
  let backend: ReturnType<typeof Bun.serve> | undefined,
    child: ReturnType<typeof Bun.spawn> | undefined,
    ws: WebSocket | undefined;
  try {
    const key = join(directory, 'key.pem'),
      cert = join(directory, 'cert.pem');
    const generated = Bun.spawnSync(
      [
        'openssl',
        'req',
        '-x509',
        '-newkey',
        'rsa:2048',
        '-nodes',
        '-keyout',
        key,
        '-out',
        cert,
        '-days',
        '1',
        '-subj',
        '/CN=localhost',
        '-addext',
        'subjectAltName=DNS:localhost,IP:127.0.0.1',
      ],
      { stdout: 'ignore', stderr: 'ignore' },
    );
    if (generated.exitCode !== 0) throw new Error('Test certificate provisioning failed');
    const credential = crypto.randomUUID() + crypto.randomUUID(),
      accessKey = crypto.randomUUID();
    let upstreamRequests = 0,
      headersValid = false;
    backend = Bun.serve({
      hostname: '127.0.0.1',
      port: 0,
      tls: { key: Bun.file(key), cert: Bun.file(cert) },
      fetch(request, server) {
        upstreamRequests++;
        headersValid =
          request.headers.get('authorization') === `Bearer ${credential}` &&
          request.headers.get('x-lemmi-access-key') === accessKey &&
          !request.headers.has('cookie') &&
          request.headers.get('origin') === `https://127.0.0.1:${server.port}` &&
          new URL(request.url).pathname === '/v1/device-stream';
        if (!headersValid) return new Response(null, { status: 403 });
        return server.upgrade(request, { data: undefined })
          ? undefined
          : new Response(null, { status: 400 });
      },
      websocket: {
        message(socket, data) {
          const event = DeviceEventSchema.parse(JSON.parse(String(data)));
          if (event.type === 'device.hello')
            socket.send(
              JSON.stringify(
                ServerEventSchema.parse({
                  protocol_version: 1,
                  event_id: 'ready',
                  session_id: null,
                  turn_id: null,
                  generation: 0,
                  sequence: 0,
                  type: 'device.ready',
                  payload: {
                    mode: 'live',
                    deviceId: 'stackchan-alex',
                    profileId: 'profile-alex',
                    credentialExpiresAt: null,
                    audio: false,
                    camera: false,
                    textChat: true,
                    teaching: true,
                    controls: [
                      'start',
                      'stop',
                      'pause',
                      'resume',
                      'mute',
                      'help',
                      'text',
                      'speak',
                      'handoff',
                    ],
                  },
                }),
              ),
            );
        },
      },
    });
    child = Bun.spawn([process.execPath, 'run', 'dev:web', '--port', '0'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_EXTRA_CA_CERTS: cert,
        LEMMI_MODE: 'mock',
        LEMMI_PUBLIC_ORIGIN: `https://127.0.0.1:${backend.port}`,
        LEMMI_DEVICE_CREDENTIAL: credential,
        LEMMI_ACCESS_KEY: accessKey,
      },
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const reader = (child.stdout as ReadableStream<Uint8Array>).getReader();
    let output = '',
      match: RegExpMatchArray | null = null;
    const deadline = setTimeout(() => child?.kill(), 25000);
    try {
      while (!match) {
        const item = await reader.read();
        if (item.done) throw new Error('Local voice web server did not become ready');
        output += new TextDecoder().decode(item.value);
        match = output.match(/Local:\s+http:\/\/127\.0\.0\.1:(\d+)\//);
      }
    } finally {
      clearTimeout(deadline);
      reader.releaseLock();
    }
    const origin = `http://127.0.0.1:${match![1]}`;
    const config = await fetch(origin + '/voice-config');
    expect(await config.json()).toEqual({ configured: true });
    ws = new WebSocket(origin.replace('http:', 'ws:') + '/voice-stream', {
      headers: { origin, cookie: 'do-not-forward', authorization: 'browser-value-must-not-win' },
    });
    await new Promise<void>((resolve, reject) => {
      ws!.onopen = () => resolve();
      ws!.onerror = () => reject(new Error('Verified local voice proxy connection failed'));
    });
    const ready = new Promise<any>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('No backend capability message')), 4000);
      ws!.onmessage = (e) => {
        clearTimeout(timer);
        resolve(ServerEventSchema.parse(JSON.parse(String(e.data))));
      };
    });
    ws.send(
      JSON.stringify({
        protocol_version: 1,
        event_id: 'hello',
        session_id: null,
        turn_id: null,
        generation: 0,
        sequence: 0,
        type: 'device.hello',
        payload: {
          firmwareVersion: 'fixture',
          cameraSupported: false,
          pettingSupported: false,
          audio: { supported: false },
        },
      }),
    );
    expect((await ready).payload.teaching).toBe(true);
    expect(headersValid).toBe(true);
    const before = upstreamRequests;
    const foreign = new WebSocket(origin.replace('http:', 'ws:') + '/voice-stream', {
      headers: { origin: 'https://foreign.invalid' },
    });
    await new Promise<void>((resolve) => {
      foreign.onerror = () => resolve();
      foreign.onclose = () => resolve();
    });
    foreign.close();
    expect(upstreamRequests).toBe(before);
    expect(output).not.toContain(credential);
    expect(output).not.toContain(accessKey);
  } finally {
    ws?.close();
    child?.kill();
    if (child) await child.exited;
    backend?.stop(true);
    await rm(directory, { recursive: true, force: true });
  }
}, 30000);
