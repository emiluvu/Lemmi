// Validate the host parser fixtures and outgoing controls with the exact fetched
// shared schemas, without switching branches, installing tools or contacting a
// service. Requires the repository's already installed TypeScript and Zod.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { createRequire } = require('node:module');
const contractsRequire = createRequire(path.resolve(__dirname, '../../..', 'packages/contracts/package.json'));
const assert = require('node:assert/strict');
const ref = process.argv[2];
if (!ref || !/^[a-zA-Z0-9_./-]+$/.test(ref) || ref.startsWith('-')) {
  throw new Error('Pass a fetched backend ref, for example origin/backend-deploy');
}
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const source = execFileSync('git', ['show', `${ref}:${file}.ts`], { encoding: 'utf8' });
  const output = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} };
  cache.set(file, module.exports);
  new Function('require', 'module', 'exports', output)(
    (name) => name === 'zod' ? contractsRequire('zod') : name.startsWith('.')
      ? load(path.posix.normalize(path.posix.join(path.posix.dirname(file), name)))
      : (() => { throw new Error('Unexpected contract dependency'); })(),
    module, module.exports,
  );
  return module.exports;
}
const { ServerEventSchema, DeviceEventSchema } = load('packages/contracts/src/device');
const source = fs.readFileSync(path.join(__dirname, 'control_protocol.cpp'), 'utf8');
function fixture(name) {
  const match = source.match(new RegExp(`static const char\\* ${name}=R"\\(([\\s\\S]*?)\\)";`));
  assert(match, `Missing ${name} fixture`);
  return JSON.parse(match[1]);
}
const base = { protocol_version: 1, event_id: 'fixture-command', session_id: null,
  turn_id: null, generation: 0, sequence: 0 };
ServerEventSchema.parse({ ...base, type: 'device.ready', payload: fixture('ready') });
ServerEventSchema.parse({ ...base, type: 'state.changed', session_id: 'fixture-session',
  generation: 2, sequence: 1, payload: fixture('session') });
const browser = fixture('session');
Object.assign(browser.session, {
  endpoint: 'browser', activeEndpointId: 'fixture-browser', phase: 'listening', micMuted: false,
  captureGrant: { turnId: 'fixture-turn', generation: 2, leaseId: 'fixture-lease',
    streamId: 'fixture-stream', language: 'en', expiresAt: '2030-01-01T00:00:20Z' },
});
ServerEventSchema.parse({ ...base, type: 'state.changed', session_id: 'fixture-session',
  generation: 2, sequence: 2, payload: browser });
DeviceEventSchema.parse({ ...base, type: 'device.hello', payload: {
  firmwareVersion: 'lemmi-control/0.9', endpoint: 'robot', cameraSupported: false,
  pettingSupported: false, audio: { supported: false },
} });
DeviceEventSchema.parse({ ...base, type: 'input.handoff', session_id: 'fixture-session',
  generation: 2, sequence: 2, payload: {} });
console.log(`PASS: firmware fixtures/hello/handoff match ${ref} shared runtime schemas`);
