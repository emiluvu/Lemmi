export function isLoopbackHost(host: string): boolean {
  return ['localhost', '127.0.0.1', '[::1]', '::1'].includes(host);
}
export function localMockRequestAllowed(request: Request, peer: string | null): boolean {
  const url = new URL(request.url);
  if (!isLoopbackHost(url.hostname) || !peer || !isLoopbackHost(peer)) return false;
  const origin = request.headers.get('origin');
  // Browser mutations require same origin. Non-browser tools authenticate separately.
  return !origin || origin === url.origin;
}
export const MOCK_TOKEN = () => process.env.LEMMI_MOCK_TOKEN ?? 'local-mock-only';
export function assertMockMode() {
  if ((process.env.LEMMI_MODE ?? 'mock') !== 'mock')
    throw new Error('Live mode is not implemented. Refusing to start mock services.');
}
