// Bun loads the selected .env. Give the inference process only speech/runtime settings.
export {};
const env: Record<string, string> = {};
for (const [key, value] of Object.entries(process.env)) {
  if (
    value !== undefined &&
    (key.startsWith('LEMMI_SPEECH_') ||
      ['PATH', 'LANG', 'LC_ALL', 'LD_LIBRARY_PATH', 'CUDA_VISIBLE_DEVICES'].includes(key))
  )
    env[key] = value;
}
const child = Bun.spawn(
  ['services/local-speech/.venv/bin/python', 'services/local-speech/server.py'],
  { env, stdin: 'ignore', stdout: 'inherit', stderr: 'inherit' },
);
const stop = () => child.kill('SIGINT');
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
process.exitCode = await child.exited;
