import type { ServerEvent, SessionSnapshot } from '@lemmi/contracts';

// Presentation checks supplement the server's authority; they never grant a session or turn.
export function mayPresentReply(
  event: Extract<ServerEvent, { type: 'response.text' }>,
  session: SessionSnapshot | null,
  deviceId: string | undefined,
) {
  return !!(
    session &&
    deviceId &&
    session.activeEndpointId === deviceId &&
    event.session_id === session.id &&
    event.generation === session.generation &&
    event.turn_id === event.payload.turnId &&
    session.phase !== 'ended' &&
    (session.phase !== 'paused' || event.payload.source === 'fixed')
  );
}
