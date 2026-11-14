import { DeviceEventSchema, ServerEventSchema, type SessionSnapshot } from '@lemmi/contracts';

// Computer-side authenticated control harness, not firmware or proof of hardware controls.
export async function runControlDevice() {
  const origin = new URL(process.env.LEMMI_PUBLIC_ORIGIN ?? '');
  const credential = process.env.LEMMI_DEVICE_CREDENTIAL ?? '';
  if (
    origin.protocol !== 'https:' ||
    origin.origin !== process.env.LEMMI_PUBLIC_ORIGIN ||
    credential.length < 40
  )
    throw new Error('A configured HTTPS origin and paired device credential are required');
  const caFile = process.env.LEMMI_DEVICE_CA_FILE;
  const socket = new WebSocket(`wss://${origin.host}/v1/device-stream`, {
    headers: { Authorization: `Bearer ${credential}` },
    ...(caFile ? { tls: { ca: await Bun.file(caFile).text() } } : {}),
  });
  let sequence = 0;
  let session: SessionSnapshot | null = null;
  let ready = false;
  let lastHeartbeat = Date.now();
  function send(type: string, payload: unknown = {}, start = false) {
    socket.send(
      JSON.stringify(
        DeviceEventSchema.parse({
          protocol_version: 1,
          event_id: crypto.randomUUID(),
          session_id: start ? null : (session?.id ?? null),
          turn_id: null,
          generation: start ? 0 : (session?.generation ?? 0),
          sequence: sequence++,
          type,
          payload,
        }),
      ),
    );
  }
  const timer = setInterval(() => {
    if (Date.now() - lastHeartbeat > 6000) {
      console.info('Control watchdog expired; capture/output remain off');
      socket.close();
    } else if (ready && socket.readyState === WebSocket.OPEN) send('heartbeat');
  }, 2000);
  socket.onopen = () =>
    send('device.hello', {
      firmwareVersion: 'computer-control-harness/0.1',
      cameraSupported: false,
      pettingSupported: false,
      audio: { supported: false },
    });
  socket.onmessage = (event) => {
    let raw: unknown;
    try {
      raw = JSON.parse(String(event.data));
    } catch {
      socket.close(1008, 'Invalid server JSON');
      return;
    }
    const parsed = ServerEventSchema.safeParse(raw);
    if (!parsed.success) {
      socket.close(1008, 'Invalid server event');
      return;
    }
    const value = parsed.data;
    if (value.type === 'device.ready') {
      ready = true;
      console.info(
        'Authenticated computer harness. No capture/output. Commands: start, pause, resume, stop, mute, unmute, help, quit',
      );
    }
    if (value.type === 'heartbeat') lastHeartbeat = Date.now();
    if (value.type === 'state.changed') {
      session = value.payload.session;
      console.info(
        'Session:',
        session?.phase ?? 'none',
        'mic muted:',
        session?.micMuted ?? true,
        'capture: off',
      );
    }
    if (value.type === 'error') console.info(value.payload.code, value.payload.message);
  };
  socket.onerror = () =>
    console.error('Authenticated control connection failed; check pairing and certificate trust');
  socket.onclose = () => {
    clearInterval(timer);
    console.info('Control harness closed; no automatic reconnect');
    process.exit(0);
  };
  process.on('SIGINT', () => socket.close());
  let pending = '';
  for await (const chunk of Bun.stdin.stream()) {
    pending += new TextDecoder().decode(chunk);
    if (pending.length > 1024) {
      pending = '';
      console.info('Command too long');
      continue;
    }
    let index: number;
    while ((index = pending.indexOf('\n')) !== -1) {
      const command = pending.slice(0, index).trim();
      pending = pending.slice(index + 1);
      if (command === 'quit') {
        socket.close();
        return;
      }
      if (!ready || socket.readyState !== WebSocket.OPEN) {
        console.info('Control connection is not ready');
        continue;
      }
      if (command === 'start') send('input.start', {}, true);
      else if (command === 'mute' || command === 'unmute')
        send('input.mute', { muted: command === 'mute' });
      else if (['pause', 'resume', 'stop', 'help'].includes(command)) send(`input.${command}`);
      else console.info('Unknown command');
    }
  }
}
