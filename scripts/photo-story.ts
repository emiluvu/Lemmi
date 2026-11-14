// Local-only opt-in rehearsal, using the existing gateway/dev launcher and speech adapters.
import { resolve, isAbsolute, join } from 'node:path';
import { localSpeechConfig } from '@lemmi/server';
const homeArg = process.argv.indexOf('--speech-home');
if (homeArg >= 0 && !process.argv.includes('--prepared')) {
  const home = resolve(process.argv[homeArg + 1] ?? '.');
  const child = Bun.spawn(
    [
      process.execPath,
      `--env-file=${join(home, 'services/local-speech/.env')}`,
      import.meta.path,
      '--prepared',
    ],
    { env: { ...process.env, LEMMI_SPEECH_HOME: home }, stdout: 'inherit', stderr: 'inherit' },
  );
  process.on('SIGINT', () => child.kill());
  process.on('SIGTERM', () => child.kill());
  process.exitCode = await child.exited;
} else {
  const speechHome = process.env.LEMMI_SPEECH_HOME ?? process.cwd();
  for (const key of [
    'LEMMI_SPEECH_STT_MODEL_PATH',
    'LEMMI_SPEECH_VOICE_EN',
    'LEMMI_SPEECH_VOICE_DE',
  ]) {
    const value = process.env[key];
    if (value && !isAbsolute(value)) process.env[key] = resolve(speechHome, value);
  }
  const selected = localSpeechConfig();
  let engine: ReturnType<typeof Bun.spawn> | undefined;
  if (
    selected.ok &&
    selected.data.sttBackend === 'local-http' &&
    selected.data.ttsBackend === 'local-http'
  ) {
    const ready = async () => {
      try {
        const r = await fetch(`${selected.data.sttUrl}/health`, {
          headers: { authorization: `Bearer ${selected.data.token}` },
          signal: AbortSignal.timeout(1000),
        });
        return r.ok;
      } catch {
        return false;
      }
    };
    if (!(await ready())) {
      const python = join(
        speechHome,
        process.platform === 'win32'
          ? 'services/local-speech/.venv/Scripts/python.exe'
          : 'services/local-speech/.venv/bin/python',
      );
      if (!(await Bun.file(python).exists()))
        throw new Error(
          'Existing speech environment missing. Follow services/local-speech/README.md.',
        );
      const env = Object.fromEntries(
        Object.entries(process.env).filter(
          ([key, value]) =>
            value !== undefined &&
            (key.startsWith('LEMMI_SPEECH_') ||
              ['PATH', 'SYSTEMROOT', 'TEMP', 'TMP', 'LANG', 'LD_LIBRARY_PATH'].includes(key)),
        ),
      );
      engine = Bun.spawn([python, join(speechHome, 'services/local-speech/server.py')], {
        env,
        stdout: 'inherit',
        stderr: 'inherit',
      });
      let healthy = false;
      for (let i = 0; i < 120; i++) {
        if (await ready()) {
          healthy = true;
          break;
        }
        if (engine.exitCode !== null) break;
        await Bun.sleep(500);
      }
      if (!healthy) {
        engine.kill();
        throw new Error('Local speech did not become ready. No mock speech fallback.');
      }
    }
  } else
    console.info(
      'STT/TTS configuration unavailable: text-only mode. Pass --speech-home <existing configured checkout> to enable real voice.',
    );
  process.env.LEMMI_PHOTO_STORY_DEMO = '1';
  process.env.GATEWAY_PORT ??= '3011';
  process.env.LEMMI_PHOTO_STORY_CHAT ??= 'reviewed_demo';
  console.info('Photo Story local rehearsal: http://127.0.0.1:5183/participant/photo-story');
  console.info(
    `Chat: ${process.env.LEMMI_PHOTO_STORY_CHAT}; photo pixels are not analyzed. Speech requires existing private local-speech configuration.`,
  );
  const gateway = Bun.spawn([process.execPath, 'apps/realtime/src/index.ts'], {
    env: process.env,
    stdout: 'inherit',
    stderr: 'inherit',
  });
  const web = Bun.spawn(
    [
      process.execPath,
      resolve('node_modules/vite/bin/vite.js'),
      '--host',
      '127.0.0.1',
      '--port',
      '5183',
      '--strictPort',
    ],
    { cwd: `${process.cwd()}/apps/web`, env: process.env, stdout: 'inherit', stderr: 'inherit' },
  );
  const stop = () => {
    gateway.kill();
    web.kill();
    engine?.kill();
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  await Promise.race([gateway.exited, web.exited]);
  stop();
}
