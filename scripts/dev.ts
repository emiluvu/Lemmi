import { assertMockMode } from '@lemmi/server';
assertMockMode();
const children = [
  Bun.spawn([process.execPath, '--watch', 'apps/realtime/src/index.ts'], {
    stdout: 'inherit',
    stderr: 'inherit',
    env: process.env,
  }),
  Bun.spawn([process.execPath, 'run', '--no-orphans', 'dev'], {
    cwd: `${process.cwd()}/apps/web`,
    stdout: 'inherit',
    stderr: 'inherit',
    env: process.env,
  }),
];
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
const exitCode = await Promise.race(children.map((c) => c.exited));
stop();
await Promise.all(children.map((c) => c.exited));

process.exitCode = exitCode;
