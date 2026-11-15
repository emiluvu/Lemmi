# Backend deployment branch

Latest browser endpointing rollout: **web `405f5a3`**, November 15, 17:20:20 UTC.
Gateway/local speech `ea66280`, tunnel, private settings and database retained.
Pinned local Silero/ONNX dependencies added; no proxy/route/schema change.
Protected rollback pointer `.data/noise-endpointing-rollback-path`.
[Public noisy-speech acceptance and cold-start limits](backend-status.md#browser-noise-endpointing-deployed--november-15-2026).

Latest reliability rollout: **web/gateway/local speech `ea66280`**, November 15,
16:27:42–44 UTC. Matching 40-second capture support and post-speech configuration
`PUBLIC_LEMMI_END_SILENCE_MS=1500`; tunnel/proxy/models retained. Protected rollback
pointer `.data/reliability-rollback-path`. Roll back all three runtimes and the
silence setting together; retain current data. [Actual checks and remaining limits](backend-status.md#conversation-reliability-deployed--november-15-2026).

Latest Photo Story/conversation rollout: **web `d4e99d9`, gateway `1f1c2c4`**,
November 15, 12:10:50 UTC, with the web-only image reload correction at 12:15:17 UTC.
No migration/configuration/proxy change; speech/tunnel retained. Protected rollback
pointer: `.data/photo-stalls-rollback-path`. [Actual checks and remaining limits](backend-status.md#photo-story-and-conversation-fixes-deployed--november-15-2026).

Latest branding rollout: **web `f3f5199`**, gateway `5146030`, November 15,
10:05:17 UTC. Web-only restart; installed Nginx `-t` and reload passed for exactly
`/favicon.svg` and `/images/brand/lemmi.png`. Gateway/speech/tunnel retained.
[Public asset/browser acceptance and rollback](backend-status.md).

Latest reviewed participant release: **web/gateway `5146030`**, November 15,
09:39:52 UTC. Eligible spoken/visible teaching choices, Finish, stable mobile
captions and short English/German Start greeting reuse the deployed opening and
Resume authority. No migration/configuration/proxy change; only web/gateway
restarted. [Actual checks, prior open issues and rollback](backend-status.md).
Earlier runtime descriptions below are historical checkpoints.

Latest UI/backend runtime **`95bdcef`** adds reviewed spoken mode selection, fictional name/avatar updates, and the exit keypad. Keep a private independent four-digit `LEMMI_CAREGIVER_EXIT_PASSWORD`; no live default. Exact proxy routes `profile-update`, `conversation-lock`, `conversation-exit` are installed. No new migration or existing key change; speech remains CPU 2+2/HFC and decisions off. [Latest release and rollback](backend-status.md#conversation-ui-and-spoken-modes-deployed--november-14-2026).

Current host: gateway/private speech `c594130`, web `12a1e47`. Migration `005_conversation_redirects.sql` is applied. CPU speech uses two STT/two TTS workers and HFC female medium; match gateway/wrapper worker counts. Semantic decisions and CUDA remain disabled after observed evaluation/initialization failures. Keep the shared checkout on `backend-deploy`. [Latest acceptance/configuration/rollback](backend-status.md#integrated-backend-release--november-14-2026), [integration handoff](handoffs/backend-integration-2026-11-14.md). Earlier deployment snapshots below retain historical limitations.

`backend-deploy` is the integration branch for the team-managed backend machine. Merge tested backend changes into it and push normally; do not force-push it. The deployment machine can fetch/pull that branch and rebuild/restart using Anay's automation. This document does not install a tunnel, service manager or automatic updater.

The first snapshot includes authenticated device controls, optional OpenRouter **text** chat, private local speech engines/adapters, shared activity contracts and the [backend API inventory](backend_api.md). Browser sign-in/chat, live microphone/playback, full journal/notification workflows, real notifications and camera remain pending. This is a fictional-profile integration deployment, not completed care-service readiness.

Observed setup and remaining private configuration on the current Ubuntu machine: [host setup](host-setup.md).

## Machine setup and start

Use a dedicated checkout on the new machine, separate from developer sessions:

```sh
git clone --branch backend-deploy --single-branch https://github.com/emiluvu/Lemmi.git
cd Lemmi
bun --version # must match .bun-version: 1.4.4
bun install --frozen-lockfile
cp -n .env.example .env
```

Configure private `.env` or protected service environment with:

- `LEMMI_MODE=live`, `GATEWAY_PORT=3001`.
- `LEMMI_PUBLIC_ORIGIN=https://YOUR_DOMAIN` without a trailing slash; web `ORIGIN` must match exactly.
- An independent random `LEMMI_ACCESS_KEY` of 32–256 visible characters for the outer domain gate, shared privately with authorized team/device clients. This must differ from all other credentials.
- An independent random `LEMMI_CONTROL_TOKEN` of at least 32 characters shared by web/gateway.
- All `LEMMI_AUTH_*` verifier settings and `LEMMI_CAREGIVER_SUBJECT` from the actual RFC 7662 identity provider. Cloudflare Tunnel/Access does not substitute for the application's caregiver-token verification.
- `OPENROUTER_API_KEY` and an explicit `OPENROUTER_MODEL` to enable model text replies. These remain server-only; an enabled adapter is not a successful live-provider test.

See [.env.example](../.env.example) and the [control configuration handoff](handoffs/anay-control-foundation.md#runconfigure) for verifier constraints. Protect the private configuration file (for example, `chmod 600 .env`). Do not add secrets to the branch or copy this development machine's private files/models into Git.

```sh
bun run check
bun run test
bun run build
bun run format:check
bun scripts/smoke-control.ts --chat-fixture
```

The smoke starts its own loopback listeners, temporary certificate-verified HTTPS/WSS proxy and identity/provider fixtures. It does not validate the new domain, actual identity provider, OpenRouter account or hardware. Run it on a host that permits local sockets and has `openssl` available.

Start these as two separately supervised processes, with the checkout as their working directory and the private settings available to both:

```sh
# process 1
LEMMI_MODE=live bun run start:gateway
# process 2, replace YOUR_DOMAIN
LEMMI_MODE=live HOST=127.0.0.1 PORT=3000 ORIGIN=https://YOUR_DOMAIN bun run start:web
```

The gateway binds `127.0.0.1:3001`. Keep web bound to `127.0.0.1:3000`. Leave `ADDRESS_HEADER`, `HOST_HEADER` and `PROTOCOL_HEADER` unset so the app verifies the actual local proxy peer. Do not use `bun run dev` for live deployment. The worker is currently an unimplemented notice, not a service to deploy. Optional PostgreSQL/profile/media mode is included: follow [database setup](../db/README.md), configure private `LEMMI_DATABASE_URL`/`LEMMI_PRIVATE_MEDIA_DIR`/caregiver subject, then run `bun run db:migrate` and `bun run db:bootstrap` before gateway startup. Set `BODY_SIZE_LIMIT=29M` for static asset uploads.

For optional speech on this same host, follow the [Python 3.10 setup and model provisioning guide](../services/local-speech/README.md#setup-on-another-ubuntu-machine). Its virtual environment, models and independent private service `.env` must be provisioned on the target machine. Start the private loopback service separately:

```sh
bun --env-file=services/local-speech/.env scripts/local-speech.ts
# independent readiness/inference check in another terminal
bun --env-file=services/local-speech/.env scripts/speech-smoke.ts
```

Keep speech port 8765 private. The current live device gateway does not yet ingest microphone audio or play speech; starting the engines does not connect that path automatically.

## Domain and Cloudflare Tunnel

Use one public HTTPS origin. A simple deployment layout is **Cloudflare → cloudflared on this host → a loopback reverse proxy → web/gateway**. Cloudflare supports HTTP origin services and path ingress matching; a local proxy lets us explicitly overwrite the application-required headers and allow only implemented public paths. See Cloudflare's [routing configuration](https://developers.cloudflare.com/tunnel/features/locally-managed-tunnels/configuration-file/) and [origin parameters](https://developers.cloudflare.com/tunnel/reference/origin-parameters/). This topology has not yet been exercised on the new machine.

Point the tunnel's domain route at `http://127.0.0.1:8080`, where the local proxy listens. Enforce HTTPS at Cloudflare's public edge. Run cloudflared and the proxy in the same host network as the applications; `127.0.0.1` inside a separate container is a different endpoint. Use normal public certificate validation on clients.

### Shared domain key and OIDC

The chosen deployment uses **a shared outer access key plus the existing caregiver identity verifier**. Cloudflare Tunnel carries traffic; Cloudflare Access service tokens are not required. Configure `LEMMI_ACCESS_KEY` on both web and gateway. Live process configuration requires the key: missing, invalid or reused key configuration fails closed. Mock mode stays local without a key.

- **Browser/frontend:** open `https://YOUR_DOMAIN/access`, enter the key in the password form once, then use the app's separately authorized operations. The server exchanges it for an eight-hour, signed, `Secure; HttpOnly; SameSite=Strict; Path=/` host-only cookie. Same-origin fetch/WebSocket clients can carry that cookie without exposing the shared key in frontend source. This does not implement the missing frontend sign-in/text transport or make preview pages live.
- **Stackchan/computer client:** send `X-Lemmi-Access-Key: <private key>` on HTTPS provisioning calls and the initial WSS upgrade. Send the paired device credential separately as `Authorization: Bearer <device credential>` on WSS. The computer harness reads `LEMMI_ACCESS_KEY`; Emilia must add the header and protected provisioning to actual firmware. No browser login runs on the robot.
- **Caregiver:** sign in with the self-hosted OIDC provider and send its access token on caregiver requests. The current verifier requires that provider's RFC 7662 introspection endpoint plus issuer, audience, confidential-client credentials and Alex's assigned subject. An OIDC discovery URL alone does not guarantee introspection support; JWT/JWKS verification is not implemented in this snapshot.

The domain key gates the new profile/assets routes as well as device provisioning/WSS. It only passes the outer gate; it is not a caregiver identity, device assignment, camera consent or microphone permission. Do not put it in URLs, browser bundles, model context or logs. `/access` is the intentional public unlock page; denied API/WSS requests return 401 rather than exposing application data. POST unlock/logout requires the configured Origin; unlock attempts are globally bounded to 20/minute per web process and body size to 4 KiB. Local Lock removes this browser's cookie; it does not revoke someone else's cookie. Rotate the shared key and restart both services to invalidate all gate cookies/connections. Scoped pairing/revocation stays separate.

The following **Nginx `http` context** example uses placeholders; replace `YOUR_DOMAIN` throughout. Validate the installed Nginx configuration with `nginx -t` before loading it. This is a configuration example, not an observed Nginx/Cloudflare deployment:

```nginx
server {
    listen 127.0.0.1:8080 default_server;
    server_name _;
    access_log off;
    return 404;
}

server {
    listen 127.0.0.1:8080;
    server_name YOUR_DOMAIN;
    access_log off;
    client_max_body_size 4k;
    client_body_timeout 5s;

    # Trust only the same-host tunnel, and reject public plaintext requests.
    if ($http_x_forwarded_proto != "https") { return 403; }

    location = /v1/device-stream {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host YOUR_DOMAIN;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 30s;
        proxy_buffering off;
    }

    location ~ ^/(access(/logout)?|v1/(devices/stackchan-alex/(pairings|revoke)|device-pairings/claim))$ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host YOUR_DOMAIN;
        proxy_set_header X-Forwarded-Proto https;
        proxy_buffering off;
    }

    # Optional database-backed profile and media resources.
    location ~ ^/v1/profiles/profile-alex/(photos|assets)$ {
        client_max_body_size 29m;
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host YOUR_DOMAIN;
        proxy_set_header X-Forwarded-Proto https;
        proxy_buffering off;
    }
    location ~ ^/v1/(profiles/profile-alex(/assets/[^/]+)?|participant/profiles/profile-alex|assets/[^/]+(/metadata)?)$ {
        client_max_body_size 32k;
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host YOUR_DOMAIN;
        proxy_set_header X-Forwarded-Proto https;
        proxy_buffering off;
    }
    location / { return 404; }
}
```

Preserve `Authorization`, `Origin`, request paths/query strings and WebSocket upgrades; the applications perform their own credential, scope and origin checks. Configure the tunnel's origin HTTP Host Header to `YOUR_DOMAIN` if it would otherwise rewrite Host; verify the proxy selects the intended virtual host. Never publish `/internal/*`, mock pages/RPC, raw app ports or private speech. Cache bypass applies to all allowed routes; the applications also return `Cache-Control: no-store`. Avoid request/response/header logging of credentials, pairing data or dialogue at any proxy/tunnel layer.

## Pull/restart contract and verification

Your updater should run from the dedicated deployment checkout, serialize updates, fetch/pull **only `backend-deploy`** with fast-forward-only behavior, install from the frozen Bun lockfile, and pass checks/build before restarting. Keep the known working revision/release available if preparation fails. Use normal merge commits on the branch to integrate subsequent reviewed backend work; no automatic deployment is configured by this repository.

**Restart behavior:** with database mode enabled, approved profiles/facts/media, issued credential hashes and bounded session/factual-event checkpoints persist. **Startup retains explicitly persistent active credentials, clears short-lived credentials/pending codes, and ends prior unfinished sessions**; no pairing code, active conversation, capture or playback is restored. Persistent devices reconnect with the same key and explicitly Start; short-lived devices pair again and explicitly Start. Without database mode, the earlier in-memory behavior remains. The shared domain-key browser cookie is stateless and can remain valid until its eight-hour expiry when the same key is retained; this never restores a device token or session. Key rotation plus restart invalidates those cookies/connections. See [database storage/recovery behavior](../db/README.md#storage-and-interruption-behavior). Coordinate restarts with teammates. Full durable journal/jobs/deletion workflows remain pending.

Once domain and host setup are available, record actual observations in the build plan:

1. Check local listeners and the two process supervisors without printing secrets. A public `/` redirects to the access page when locked and `/caregiver` when unlocked; there is no public live health endpoint yet.
2. Verify HTTPS certificate/hostname and public denial of `/internal/*`, mock routes and unlisted paths; verify a missing domain key/cookie is denied and the shared key alone cannot create a pairing and bad device credentials cannot upgrade WSS.
3. With the actual managed caregiver token, pair/claim using the [API reference](backend_api.md), then connect the computer harness to the configured origin with the returned scoped credential.
4. Check start, heartbeat, pause, explicit resume, Stop, disconnect and revoke. Capture/audio/camera remain unavailable.
5. With an explicit configured OpenRouter model, test fictional English `chat Hello` through the paired harness; record real provider errors rather than converting them into fixture success. Rehearse cancellation during an in-flight reply.
6. If local speech is provisioned, run the synthetic English smoke on this host and record timings separately from robot/human speech quality.

The domain, new host access, privately configured domain key, identity-provider settings and model choice are required for those remote/live checks. Local fixture tests cannot establish that the tunnel or real providers work.

### Explicit VoidAuth token binding

`LEMMI_AUTH_TOKEN_BINDING` defaults to `audience`, preserving the required `LEMMI_AUTH_AUDIENCE` check. For VoidAuth non-resource access tokens, explicitly select `client_id`; `client_id` must then equal the dedicated configured `LEMMI_AUTH_CLIENT_ID`. Missing/foreign clients are rejected. A present `aud` still must match `LEMMI_AUTH_AUDIENCE`; it is never ignored. Issuer, active status, Bearer type, one-hour expiry bound and configured caregiver subject checks remain enforced in both modes. This is a provider-specific integration choice, not automatic fallback or JWT-only verification. The loopback-only `scripts/setup-caregiver.ts --assign-alex` helper obtains the actual subject using an explicitly authorized one-time code/PKCE login; see [host setup](host-setup.md). Production browser login UI remains pending.

Persistent credentials require `003_persistent_device_credentials.sql`; communication support requires `003_communication_support.sql` and the support proxy allowlist. Both are independently tracked full migration filenames despite their shared numeric prefix. The runner applies them once by full name/checksum. Do not rename/checksum-edit an applied migration. Preserve backups before upgrade. Downgrading to the old credential-clearing gateway while persistent keys are active requires explicit revocation with the new code or a reviewed schema/data restore; no automatic downgrade is provided.

## Current fictional multi-profile host

Runtime `17a8522` enables `LEMMI_DEMO_ENROLLMENT=1` for fictional profiles only. Keep the checked-in `deploy/nginx.conf.template` aligned with the actual proxy: `/participant`, `/_app/*`, four `/v1/demo/*` operations, scoped device/profile/media/support routes and WSS are allowed; internal/mock operations and inference/database remain blocked. The current explicit template also permits gate-protected `/caregiver` demo pages and `/participant/conversation`; private caregiver API authorization remains separate. Retain applied migration checksums; add `002_multi_profile_endpoints.sql` and `004_endpoint_revocations.sql` to the deployed schema. The compatibility migration retains old revoke receipts and existing persistent hashes; do not run the original conflicting branch `003_device_revocation_receipts.sql`.

Each profile has an independent coordinator within the one gateway. Distinct enrolled endpoint identities may connect concurrently; one profile has one active audio owner with explicit handoff and Resume. A shared device token still names one endpoint. Demo enrollments have 30-day finite expiry; existing indefinite persistent tokens retain null expiry. Restart preserves unexpired/active enrollment hashes and ends sessions/grants/output. Preserve backups and use reviewed rollback procedures because old code cannot consume the new receipt/gateway-epoch schema unchanged.
