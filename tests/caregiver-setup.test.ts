import { expect, test } from 'bun:test';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

test('loopback caregiver setup validates state and provider binding before private assignment', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lemmi-caregiver-setup-'));
  const portProbe = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: () => new Response(null) });
  const setupPort = portProbe.port!;
  portProbe.stop(true);
  const original = 'LEMMI_CAREGIVER_SUBJECT=\nLEMMI_DATABASE_URL=\n';
  let child: ReturnType<typeof Bun.spawn> | undefined;
  try {
    const preload = join(directory, 'provider-fixture.ts');
    await writeFile(
      preload,
      `
      globalThis.fetch = async (input, init) => {
        const url = String(input);
        const issuer = 'https://setup-fixture.invalid/oidc';
        if (url === issuer + '/.well-known/openid-configuration')
          return Response.json({issuer, authorization_endpoint:issuer+'/auth', token_endpoint:issuer+'/token', introspection_endpoint:issuer+'/introspect'});
        if (init?.headers?.authorization !== 'Basic '+Buffer.from('setup-client:fixture-secret').toString('base64'))
          return new Response(null,{status:401});
        const body = new URLSearchParams(String(init.body));
        if (url === issuer+'/token') {
          if(body.get('code')!=='fixture-code' || body.get('code_verifier')?.length!==72 || body.get('redirect_uri')!=='http://127.0.0.1:'+process.env.LEMMI_SETUP_PORT+'/callback')
            return new Response(null,{status:400});
          return Response.json({access_token:'fixture-access-token',token_type:'Bearer'});
        }
        if(url === issuer+'/introspect')
          return Response.json({active:body.get('token')==='fixture-access-token',iss:issuer,client_id:process.env.SETUP_BAD_BINDING==='yes'?'other-app':'setup-client',sub:'fixture-caregiver',exp:Math.floor(Date.now()/1000)+300,token_type:'Bearer'});
        throw new Error('Unexpected fixture request');
      };
    `,
    );
    for (const badBinding of [true, false]) {
      await writeFile(join(directory, '.env'), original, { mode: 0o600 });
      const started = Bun.spawn(
        [
          process.execPath,
          '--preload',
          preload,
          resolve('scripts/setup-caregiver.ts'),
          '--assign-alex',
        ],
        {
          cwd: directory,
          env: {
            PATH: process.env.PATH,
            LEMMI_SETUP_PORT: String(setupPort),
            LEMMI_AUTH_INTROSPECTION_URL: 'https://setup-fixture.invalid/oidc/introspect',
            LEMMI_AUTH_ISSUER: 'https://setup-fixture.invalid/oidc',
            LEMMI_AUTH_TOKEN_BINDING: 'client_id',
            LEMMI_AUTH_CLIENT_ID: 'setup-client',
            LEMMI_AUTH_CLIENT_SECRET: 'fixture-secret',
            LEMMI_POSTGRES_PASSWORD: 'fixture-db-password',
            SETUP_BAD_BINDING: badBinding ? 'yes' : 'no',
          },
          stdout: 'pipe',
          stderr: 'pipe',
        },
      );
      child = started;
      const reader = started.stdout.getReader();
      let output = '';
      const timeout = AbortSignal.timeout(5000);
      const readUntilReady = async () => {
        while (!output.includes('code_challenge_method=S256')) {
          const chunk = await reader.read();
          if (chunk.done) throw new Error('Setup fixture failed to start');
          output += new TextDecoder().decode(chunk.value);
        }
      };
      await Promise.race([
        readUntilReady(),
        new Promise((_, reject) =>
          timeout.addEventListener('abort', () => reject(new Error('Setup timeout')), {
            once: true,
          }),
        ),
      ]);
      const authorization = new URL(
        output.split('\n').find((line) => line.startsWith('https://'))!,
      );
      const callback = new URL(`http://127.0.0.1:${setupPort}/callback`);
      callback.searchParams.set('code', 'fixture-code');
      callback.searchParams.set('state', 'wrong-state');
      expect((await fetch(callback)).status).toBe(403);
      expect(await readFile(join(directory, '.env'), 'utf8')).toBe(original);
      callback.searchParams.set('state', authorization.searchParams.get('state')!);
      const response = await fetch(callback);
      expect(response.status).toBe(badBinding ? 400 : 200);
      expect(await child.exited).toBe(badBinding ? 1 : 0);
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        output += new TextDecoder().decode(chunk.value);
      }
      output += await new Response(started.stderr).text();
      expect(output).not.toContain('fixture-access-token');
      expect(output).not.toContain('fixture-secret');
      expect(output).not.toContain('fixture-db-password');
      const saved = await readFile(join(directory, '.env'), 'utf8');
      if (badBinding) expect(saved).toBe(original);
      else {
        expect(saved).toContain('LEMMI_CAREGIVER_SUBJECT=fixture-caregiver');
        expect(saved).toContain('/lemmi');
        expect(saved).not.toContain('fixture-access-token');
      }
      child = undefined;
    }
  } finally {
    child?.kill();
    await rm(directory, { recursive: true, force: true });
  }
}, 15000);
