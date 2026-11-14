// Keep epoch-shaped grant deadlines while measuring their duration monotonically.
// Credentials/provider claims must continue to use UTC, not this duration clock.
export function elapsedEpochClock(
  wall: () => number = Date.now,
  monotonic: () => number = () => performance.now(),
): () => number {
  const epoch = wall(),
    began = monotonic();
  return () => epoch + monotonic() - began;
}
