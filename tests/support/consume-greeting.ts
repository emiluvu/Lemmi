import { expect } from 'bun:test';
import type { ServerEvent } from '@lemmi/contracts';

// Consume the new session opening before testing a later interaction. Receipts
// model consumed PCM, and never request microphone capture.
export async function consumeGreeting(
  events: ServerEvent[],
  send: (type: string, payload: unknown, turnId: string) => unknown,
) {
  const until = async (condition: () => boolean) => {
    const deadline = Date.now() + 2500;
    while (!condition()) {
      if (Date.now() > deadline) throw new Error('Greeting fixture timed out');
      await Bun.sleep(5);
    }
  };
  await until(() => events.some((event) => event.type === 'response.start'));
  const start = events.find((event) => event.type === 'response.start');
  if (start?.type !== 'response.start') throw new Error('Missing greeting');
  const meta = start.payload;
  const receipt = (status: string, playedChunks: number) =>
    send(
      'audio.receipt',
      {
        leaseId: meta.leaseId,
        streamId: meta.streamId,
        status,
        playedChunks,
      },
      meta.turnId,
    );
  expect(
    events.some(
      (event) =>
        event.type === 'response.text' &&
        /Hi, I'm Lemmi|Hallo, ich bin Lemmi/.test(event.payload.text),
    ),
  ).toBe(true);
  receipt('started', 0);
  let consumed = 0;
  while (consumed < meta.chunkCount) {
    await until(
      () =>
        events.filter((event) => event.type === 'audio.chunk' && event.turn_id === meta.turnId)
          .length > consumed,
    );
    consumed = events.filter(
      (event) => event.type === 'audio.chunk' && event.turn_id === meta.turnId,
    ).length;
    receipt('progress', consumed);
  }
  await until(() =>
    events.some((event) => event.type === 'audio.end' && event.turn_id === meta.turnId),
  );
  receipt('completed', meta.chunkCount);
  await until(() =>
    events.some(
      (event) => event.type === 'state.changed' && event.payload.session?.phase === 'waiting',
    ),
  );
  // Retain handshake/state evidence, scope subsequent stream assertions to the next turn.
  for (let i = events.length - 1; i >= 0; i--)
    if (events[i]!.type.startsWith('response.') || events[i]!.type.startsWith('audio.'))
      events.splice(i, 1);
}
