import type { Plugin } from 'vite';
import { isLoopbackHost } from '@lemmi/server';

// Development-only fixed destination. Secrets stay in the local server process;
// browser messages never select an upstream URL or receive authorization headers.
export function voiceProxy(env: Record<string, string>): Plugin {
  const configured = !!env.LEMMI_DEVICE_CREDENTIAL && !!env.LEMMI_PUBLIC_ORIGIN;
  let upstream: URL | null = null;
  if (configured) {
    upstream = new URL(env.LEMMI_PUBLIC_ORIGIN!);
    if (
      upstream.protocol !== 'https:' ||
      upstream.origin !== env.LEMMI_PUBLIC_ORIGIN ||
      upstream.username ||
      upstream.password
    )
      throw new Error('Voice demo needs a configured HTTPS backend origin');
  }
  const key = env.LEMMI_ACCESS_KEY ?? '',
    credential = env.LEMMI_DEVICE_CREDENTIAL ?? '';
  if (/[\r\n]/.test(key + credential)) throw new Error('Invalid private voice configuration');
  return {
    name: 'lemmi-local-voice-proxy',
    config: () => ({
      server: {
        proxy: upstream
          ? {
              '/voice-stream': {
                target: upstream.origin,
                ws: true,
                changeOrigin: true,
                secure: true,
                rewrite: () => '/v1/device-stream',
                headers: {
                  Authorization: `Bearer ${credential}`,
                  'X-Lemmi-Access-Key': key,
                  Origin: upstream.origin,
                },
                configure(proxy) {
                  proxy.on('proxyReqWs', (request) => {
                    request.removeHeader('cookie');
                    request.setHeader('Authorization', `Bearer ${credential}`);
                    request.setHeader('X-Lemmi-Access-Key', key);
                    request.setHeader('Origin', upstream!.origin);
                  });
                  // Provider/proxy error details can include private request headers. Never log them.
                  proxy.on('error', () => {});
                },
              },
            }
          : undefined,
      },
    }),
    configureServer(server) {
      server.httpServer?.prependListener('upgrade', (request, socket) => {
        if (!request.url?.startsWith('/voice-stream')) return;
        const host = request.headers.host ?? '',
          peer = request.socket.remoteAddress ?? '';
        const allowedPeer = isLoopbackHost(peer) || peer === '::ffff:127.0.0.1';
        let allowed = false;
        try {
          const url = new URL(`http://${host}`);
          allowed =
            allowedPeer &&
            isLoopbackHost(url.hostname) &&
            request.headers.origin === url.origin &&
            request.url === '/voice-stream' &&
            configured;
        } catch {}
        if (!allowed) {
          request.url = '/voice-rejected';
          socket.destroy();
        }
      });
      server.middlewares.use('/voice-config', (request, response) => {
        const host = request.headers.host ?? '';
        let allowed = false;
        try {
          allowed =
            isLoopbackHost(new URL(`http://${host}`).hostname) &&
            (isLoopbackHost(request.socket.remoteAddress ?? '') ||
              request.socket.remoteAddress === '::ffff:127.0.0.1');
        } catch {}
        response.setHeader('Cache-Control', 'no-store');
        response.setHeader('Content-Type', 'application/json');
        response.statusCode = allowed ? 200 : 403;
        response.end(JSON.stringify({ configured: allowed && configured }));
      });
    },
  };
}
