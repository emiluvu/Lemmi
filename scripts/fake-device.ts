import { DeviceEventSchema, ServerEventSchema } from '@lemmi/contracts';
import { MOCK_TOKEN, assertMockMode } from '@lemmi/server';
assertMockMode();
let sequence = 0;
let sessionId: string | null = null;
let generation = 0;
let lastHeartbeat = Date.now();
const ws = new WebSocket(`ws://127.0.0.1:${process.env.GATEWAY_PORT ?? 3001}/v1/device-stream`, {
  headers: { Authorization: `Bearer ${MOCK_TOKEN()}` },
});
function send(type: string, payload: unknown = {}) {
  ws.send(
    JSON.stringify(
      DeviceEventSchema.parse({
        protocol_version: 1,
        event_id: crypto.randomUUID(),
        session_id: sessionId,
        turn_id: null,
        generation,
        sequence: sequence++,
        type,
        payload,
      }),
    ),
  );
}
ws.onopen = () => {
  send('device.hello', {
    firmwareVersion: 'fake-device/0.1',
    cameraSupported: false,
    pettingSupported: false,
    audio: { encoding: 'pcm_s16le', sampleRate: 16000, channels: 1, frameMs: 20 },
  });
  console.info(
    'FAKE device connected. No capture or output. Ctrl+C disconnects and pauses session.',
  );
};
ws.onmessage = (event) => {
  const data = ServerEventSchema.parse(JSON.parse(String(event.data)));
  if (data.type === 'heartbeat') lastHeartbeat = Date.now();
  if (data.type === 'state.changed') {
    sessionId = data.payload.session?.id ?? null;
    generation = data.payload.session?.generation ?? 0;
    console.info('Mock session:', data.payload.session?.phase ?? 'none', 'generation:', generation);
  }
};
ws.onerror = () => console.error('Fake device connection failed');
const timer = setInterval(() => {
  if (Date.now() - lastHeartbeat > 6000) {
    console.info('Fake watchdog: capture/output remain off');
    ws.close();
  } else if (ws.readyState === WebSocket.OPEN) send('heartbeat');
}, 2000);
ws.onclose = () => {
  clearInterval(timer);
  console.info('Fake device closed');
  process.exit(0);
};
process.on('SIGINT', () => ws.close());
