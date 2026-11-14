// Starts the existing app/gateway and optional existing local speech service.
try {
  const response = await fetch('http://127.0.0.1:5173/v1/mock/photoStory.status', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
    signal: AbortSignal.timeout(1500),
  });
  const current = (await response.json()) as { ok?: boolean; data?: { enabled?: boolean } };
  if (current.ok && current.data?.enabled) {
    console.info('Photo Story is already running: http://127.0.0.1:5173/participant/photo-story');
    process.exit(0);
  }
} catch {
  /* No existing demo. Start our own children below. */
}
const speechEnv = await Bun.file('services/local-speech/.env').exists();
const flags = speechEnv ? ['--env-file=services/local-speech/.env'] : [];
const env = {
  ...process.env,
  LEMMI_MODE: 'mock',
  LEMMI_PHOTO_STORY_DEMO: '1',
  BODY_SIZE_LIMIT: '900000',
};
const children = [
  Bun.spawn([process.execPath, ...flags, 'scripts/dev.ts'], {
    env,
    stdout: 'inherit',
    stderr: 'inherit',
  }),
];
if (speechEnv)
  children.push(
    Bun.spawn([process.execPath, ...flags, 'scripts/local-speech.ts'], {
      env,
      stdout: 'inherit',
      stderr: 'inherit',
    }),
  );
console.info('Photo Story fictional local demo: http://127.0.0.1:5173/participant/photo-story');
console.info(
  'Default responses are explicitly reviewed demo text. Set LEMMI_PHOTO_STORY_CHAT=openrouter for configured OpenRouter.',
);
let stopping = false;
const stop = () => {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
process.exitCode = await Promise.race(children.map((child) => child.exited));
stop();
await Promise.all(children.map((child) => child.exited));
export {};
