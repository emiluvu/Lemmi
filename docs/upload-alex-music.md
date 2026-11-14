# Upload Alex's approved song

The user attested source and permission approval for intended Lemmi demo playback
on November 14, 2026. This is a recorded user attestation, not independent license
verification or permission to publish the song on GitHub. The importer uploads
the full prepared WAV, never the MP3, to existing private backend storage.

## Run locally

Use Bun 1.4.4 from the repository root. No Python packages or new dependencies
are needed for the uploader itself. The prepared WAV and conversion manifest
already exist in ignored `.data/alex-profile-media` on Lukas's checkout. If absent,
follow the conversion command in [the content handoff](handoffs/lukas-alex-profile.md).
Do not run the caregiver assignment/setup script for an upload.

Obtain the registered caregiver OIDC client ID and client secret privately from
Anay. The client must allow `http://127.0.0.1:3333/callback`, matching the existing
setup helper. The provider must issue a bearer token accepted by the backend's
configured audience/client binding. Sign in with the caregiver account already
assigned to Alex. This utility cannot assign another account or bypass that check.

```powershell
bun run upload:alex-music --origin https://lemmi.chaoswarrior.dev --issuer https://auth.chaoswarrior.dev/oidc --client-id YOUR_REGISTERED_CLIENT_ID
```

If Bun is only installed in this checkout:

```powershell
& '.\.tools\bun-1.4.4\bun-windows-x64\bun.exe' run upload:alex-music --origin https://lemmi.chaoswarrior.dev --issuer https://auth.chaoswarrior.dev/oidc --client-id YOUR_REGISTERED_CLIENT_ID
```

The domain/issuer above are the existing documented team deployment, not an
automatically discovered or newly deployed backend. Anay must confirm any changes.

1. Enter the private Lemmi access key at the hidden terminal prompt. This is the
   outer demo gate key, separate from your caregiver account password.
2. Enter the OIDC client secret at its hidden prompt. Never paste it into chat,
   put it in command arguments or share server `.env` files.
3. The system browser opens the provider login. Enter your caregiver credentials
   only on that provider page. The callback listener binds to loopback only and
   expires after five minutes. Port 3333 must be free.
4. Return to the terminal for the actual upload result. Sign-in success alone
   does not mean the upload succeeded. A successful upload prints its asset UUID.

Private environment variables can supply existing local configuration instead of
prompts: `LEMMI_PUBLIC_ORIGIN`, `LEMMI_AUTH_ISSUER`, `LEMMI_AUTH_CLIENT_ID`,
`LEMMI_AUTH_CLIENT_SECRET`, `LEMMI_ACCESS_KEY`. Do not copy all server configuration
to the laptop. The importer needs no database password, introspection admin token,
OpenRouter key or backend control token. It never writes `.env` or changes servers.
Only use `--public-client` if Anay has registered a genuine public PKCE client
whose tokens the backend accepts. Only use `--no-access-key` if the selected
backend has no outer private gate. `--token` provides a hidden bearer-token prompt
instead of browser login when needed. `--help` lists available options.

## What happens

The importer validates the bounded WAV with the existing `decodeMedia`, compares
its hash with the private full-song conversion manifest, and reads Alex's current
profile through `clients.profile.detail`. Only an authenticated, assigned caregiver
can proceed. It then calls `clients.assets.create` with `AssetCreateSchema`-validated
data, current revision, `kind: music`, `mediaType: audio/wav`, `approved: true`,
the user-attested source/permission, the reviewed caption and `topic:music`.

The source says this is the user-supplied local MP3 converted in full; it does
not claim the song was newly recorded by the user. Permission records the dated
user confirmation for demo playback. Photos are not approved/uploaded by this utility.
The token and client secret stay transient. HTTPS validation stays enabled,
requests cannot follow redirects, and credentials go only to their intended origin.
No audio, token, login callback, provider error body or private configuration is logged.

An ignored `.data/alex-uploads` receipt records the command ID, expected revision,
approval-record timestamp, origin and file hash before sending. A separate result
file stores returned `AssetMetadata`, not audio, credentials or absolute file paths.
Retry the exact same command after network uncertainty: it reuses the command ID
and payload, allowing the backend's existing idempotency checks to resolve a lost
response. Do not delete receipts to force retries. On revision conflict, have Anay
check whether the asset committed before making a new upload. On 401/403, check
the gate key, registered client and assigned caregiver; never disable backend checks.

Upload success means the backend accepted the approved private asset. It does
not start playback or finish playlist/catalog hosting. Pass the returned metadata
to the existing `buildAlexMusicPack`; Anay's reviewed hosting and the existing
participant playback flow still need to consume that pack. No shared deployment
or database change was performed while creating this script.

## Verification

Fixture tests cover wrong-state rejection and PKCE binding, credential origin and
redirect restrictions, unauthorized caregivers, altered-file rejection, uncertain
upload retry/idempotency, and credential-free receipts. The login fixture exercises
the real local callback server with an isolated fake provider; it is not a live
VoidAuth or production-upload test. Live use requires the private client settings
and an interactive authorized caregiver. Run:

Observed on this Windows checkout: all five uploader tests and six profile-content
tests passed (72 assertions together); type/Svelte checks and scoped formatting
passed. Full suite with the existing OpenSSL tool on PATH: 89 passed, 18 database
tests skipped, one unchanged POSIX file-mode assertion failed (Windows returned
0666 instead of 0600). An initial run without OpenSSL on PATH also failed the TLS
fixture; restoring the existing tool resolved it. No live provider login or backend
upload was performed. Production UI/build sources are unaffected by this CLI change.

```powershell
bun test tests/caregiver-upload.test.ts tests/alex-profile.test.ts
bun run check
```
