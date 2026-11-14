import adapter from '@sveltejs/adapter-bun';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';
import { voiceProxy } from './voice-proxy.ts';
import { readFileSync } from 'node:fs';
import { voiceAccessSettings } from './voice-access.ts';
export default defineConfig(() => {
  const env = {
    ...loadEnv('voice', fileURLToPath(new URL('../../', import.meta.url)), 'LEMMI_'),
    ...process.env,
  };
  if (env.LEMMI_VOICE_ACCESS_FILE && !env.LEMMI_DEVICE_CREDENTIAL) {
    try {
      Object.assign(
        env,
        voiceAccessSettings(JSON.parse(readFileSync(env.LEMMI_VOICE_ACCESS_FILE, 'utf8'))),
      );
    } catch {
      throw new Error(
        'Could not load the private Alex voice access file. Check its path and pairing; no secrets were printed.',
      );
    }
  }
  return {
    plugins: [voiceProxy(env as Record<string, string>), sveltekit({ adapter: adapter() })],
  };
});
