import { resolve } from 'node:path';
import { browserCaregiverLogin, httpsOrigin, uploadAlexMusic } from './lib/caregiver-upload';

// Secrets are entered locally without echo, never as arguments or chat messages.
async function secret(label: string): Promise<string> {
  if (!process.stdin.isTTY) throw new Error('Use an interactive terminal for private credentials');
  process.stdout.write(label);
  const wasRaw = process.stdin.isRaw;
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((resolve, reject) => {
    let value = '';
    const finish = (error?: Error) => {
      process.stdin.off('data', onData);
      process.stdin.setRawMode(wasRaw);
      process.stdin.pause();
      process.stdout.write('\n');
      if (error) reject(error);
      else resolve(value);
    };
    const onData = (chunk: Buffer) => {
      for (const char of chunk.toString()) {
        if (char === '\u0003') {
          finish(new Error('Cancelled'));
          return;
        }
        if (char === '\r' || char === '\n') {
          finish();
          return;
        }
        if (char === '\u007f' || char === '\b') value = value.slice(0, -1);
        else if (/^[\x21-\x7e]$/.test(char)) value += char;
        if (value.length > 4096) {
          finish(new Error('Credential too long'));
          return;
        }
      }
    };
    process.stdin.on('data', onData);
  });
}
function option(name: string, fallback = '') {
  const index = process.argv.indexOf(name);
  return index < 0 ? fallback : (process.argv[index + 1] ?? '');
}
if (process.argv.includes('--help')) {
  console.info(`Upload Alex's approved full-song WAV through the existing caregiver API.

bun run upload:alex-music --origin https://YOUR_BACKEND --issuer https://YOUR_ISSUER/oidc --client-id YOUR_REGISTERED_CLIENT

Browser login uses http://127.0.0.1:3333/callback (must be registered with Anay).
--public-client skips the client-secret prompt only for an actually registered public client.
--token prompts for an existing caregiver access token instead of browser login.
--no-access-key skips the private demo gate key prompt only if that gate is disabled.
--file <path> selects the prepared WAV (must match the private conversion manifest).
Secrets are hidden prompts or private environment variables, never command arguments.
Environment: LEMMI_PUBLIC_ORIGIN, LEMMI_AUTH_ISSUER, LEMMI_AUTH_CLIENT_ID,
LEMMI_AUTH_CLIENT_SECRET, LEMMI_ACCESS_KEY, LEMMI_UPLOAD_CAREGIVER_TOKEN.
No profile changes, caregiver reassignment, media publication or playback occurs.`);
} else {
  try {
    const origin = httpsOrigin(option('--origin', process.env.LEMMI_PUBLIC_ORIGIN));
    const file = option('--file', resolve('.data/alex-profile-media/My Way (2008 Remastered).wav'));
    // Check basic prerequisites before launching the browser.
    if (!(await Bun.file(file).exists()))
      throw new Error('Prepared WAV missing; run prepare-alex-media.py first');
    const accessKey = process.argv.includes('--no-access-key')
      ? ''
      : process.env.LEMMI_ACCESS_KEY || (await secret('Private Lemmi access key (hidden): '));
    let token: string;
    if (process.argv.includes('--token'))
      token =
        process.env.LEMMI_UPLOAD_CAREGIVER_TOKEN ||
        (await secret('Caregiver access token (hidden): '));
    else {
      const issuer = option('--issuer', process.env.LEMMI_AUTH_ISSUER);
      const clientId = option('--client-id', process.env.LEMMI_AUTH_CLIENT_ID);
      if (!issuer || !clientId)
        throw new Error('Browser login needs --issuer and --client-id from Anay. See --help.');
      const clientSecret = process.argv.includes('--public-client')
        ? ''
        : process.env.LEMMI_AUTH_CLIENT_SECRET ||
          (await secret('OIDC client secret (hidden; provided privately by Anay): '));
      token = await browserCaregiverLogin({
        issuer,
        clientId,
        clientSecret,
        async open(url) {
          console.info(
            'Opening caregiver login in your browser. Sign in with the account assigned to Alex.',
          );
          // Argument arrays only; no shell interpolation of the authorization URL.
          const args =
            process.platform === 'win32'
              ? ['rundll32.exe', 'url.dll,FileProtocolHandler', url]
              : process.platform === 'darwin'
                ? ['open', url]
                : ['xdg-open', url];
          const child = Bun.spawn(args, { stdout: 'ignore', stderr: 'ignore' });
          if ((await child.exited) !== 0) throw new Error('Browser could not be opened');
        },
      });
    }
    const asset = await uploadAlexMusic({
      origin,
      token,
      accessKey,
      file,
      receiptDirectory: resolve('.data/alex-uploads'),
    });
    token = '';
    console.info(
      `Uploaded approved private music asset: ${asset.id}\nReceipt: .data/alex-uploads/\nThe playlist/runtime still needs to consume this asset; upload does not start playback.`,
    );
  } catch (error) {
    // Only our bounded application messages, never provider responses or tokens.
    const message = error instanceof Error ? error.message : '';
    const safe =
      /^(Use a plain HTTPS|Prepared WAV missing|Browser login needs|Caregiver |Upload not confirmed|WAV does not match|Missing or oversized|Unexpected upload|Invalid local upload|Use an interactive|Cancelled|Credential too long|Invalid private access key|Invalid caregiver token)/.test(
        message,
      );
    console.error(
      safe
        ? message
        : 'Upload failed. Check local configuration, file format and registered login settings. No mock fallback was used.',
    );
    process.exitCode = 1;
  }
}
