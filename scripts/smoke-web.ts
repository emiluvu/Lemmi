import { createClients, createHttpTransport, type Result } from '@lemmi/contracts';
const origin = 'http://127.0.0.1:5173';
const clients = createClients(
  createHttpTransport('mock', (input, init) => {
    const headers = new Headers(init?.headers);
    headers.set('origin', origin);
    return fetch(new URL(String(input), origin), { ...init, headers });
  }),
);
function data<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
  return result.data;
}
const profile = data(await clients.profile.load({ profileId: 'profile-alex' }));
if (profile.preferredName !== 'Alex') throw new Error('Wrong profile');
const denied = await clients.profile.load({ profileId: 'preview-sam' });
if (denied.ok) throw new Error('Preview accessed live service');
let session = data(
  await clients.session.start({
    profileId: profile.id,
    commandId: crypto.randomUUID(),
    endpoint: 'browser',
  }),
);
try {
  const activity = data(
    await clients.activities.start({
      sessionId: session.id,
      commandId: crypto.randomUUID(),
      activityId: 'music_playlist',
      packId: 'music-demo',
      packVersion: 1,
    }),
  );
  const requested = data(
    await clients.activities.submit({
      sessionId: session.id,
      instanceId: activity.instanceId,
      commandId: crypto.randomUUID(),
      expectedRevision: activity.revision,
      action: { type: 'track.play' },
    }),
  );
  if (requested.activityId !== 'music_playlist' || requested.playback !== 'requested')
    throw new Error('Playback was incorrectly represented');
  session = data(
    await clients.session.command({
      sessionId: session.id,
      commandId: crypto.randomUUID(),
      expectedGeneration: session.generation,
      action: { type: 'pause' },
    }),
  );
  if (session.captureGrant !== null || session.phase !== 'paused') throw new Error('Pause failed');
  const live = createClients(
    createHttpTransport('live', (input, init) => fetch(new URL(String(input), origin), init)),
  );
  if ((await live.profile.load({ profileId: profile.id })).ok)
    throw new Error('Unexpected live success');
  console.info(
    'PASS: SvelteKit proxy → shared gateway → music reducer, preview denial, pause and explicit unavailable live adapter. No media or real messages.',
  );
} finally {
  const current = data(await clients.session.get({ sessionId: session.id }));
  data(
    await clients.session.command({
      sessionId: current.id,
      commandId: crypto.randomUUID(),
      expectedGeneration: current.generation,
      action: { type: 'stop' },
    }),
  );
}
