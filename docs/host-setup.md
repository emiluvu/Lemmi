# Backend on mobrob-Precision-3680

Current public UI: `/access` → `/caregiver` landing/Profiles dashboard → `/participant/conversation` for the designed live companion. Exact demo pages require the shared gate and fictional-demo switch; private APIs still require independent authorization. Earlier root-404/local-only page observations below are historical. Web-only `cb64621` and proxy allowlist are installed; gateway remains `f5724a0`. See current backend status.

Observed November 13, 2026 (local time). Checkout: `/home/anayn/project/Lemmi`, branch `backend-deploy`. Public hostname selected by Anay: `lemmi.chaoswarrior.dev`. Current deployment summary: [backend status](backend-status.md). This setup does not configure automatic publication or deployment updates.

## Running services

- User systemd: `lemmi-gateway`, `lemmi-web`, `lemmi-speech`. User lingering is enabled for startup without an interactive login. Bun 1.4.4 is installed privately at `.data/bin/bun-linux-x64/bun`; global Bun remains unchanged.
- Docker Compose project `lemmi`: PostgreSQL 17, healthy on `127.0.0.1:5432`, with its own persistent volume. Existing containers/images were preserved.
- Docker Compose project `lemmi-proxy`: Nginx 1.28 Alpine on `127.0.0.1:8080`, using `.data/nginx.conf`. The checked-in template is `deploy/nginx.conf.template`. No default Nginx public listener is included. Access logging is off; container logging is disabled.
- Speech is private on `127.0.0.1:8765`, CPU/int8 faster-whisper and English Piper. Models and the hash-locked Python environment were provisioned locally. Speech is **not connected to live device capture/playback**. Synthetic recognition was intermittent (one diagnostic pass, two unchanged-smoke recognition failures); quality acceptance remains pending. The first smoke also raced initialization and returned connection refused. No microphone or recorded audio was used.
- Private root `.env` and speech `.env` are mode 0600 with independent generated keys. Do not paste their contents in chat. The real VoidAuth caregiver login/introspection passed; actual subject and local database URL were saved privately. Migrations and fictional Alex bootstrap completed, and gateway/web were restarted with PostgreSQL persistence enabled. OpenRouter key/model are now configured; one real adapter check passed (HTTP 200, approximately 3.6 seconds) with a fixed fictional greeting, without logging response text or credentials. The live gateway now persists its supported profile/device/session checkpoint data in PostgreSQL.
- `lemmi-tunnel.service` is enabled and running. Tunnel `lemmi-backend` routes `lemmi.chaoswarrior.dev` to the loopback proxy; four Cloudflare edge connections were observed. Public TLS/unlock and boundary checks pass. No automatic Git pull/update was installed.

From the checkout:

```sh
systemctl --user status lemmi-gateway lemmi-web lemmi-speech
docker compose --env-file .env -p lemmi -f db/compose.yaml ps
docker compose -p lemmi-proxy -f deploy/compose.proxy.yaml ps
```

Unit source templates are in `deploy/systemd`; installed copies replace `@ROOT@` with this checkout. Restarting the gateway ends sessions, clears pending codes and short-lived credentials, and retains explicitly persistent active keys. Persistent devices reconnect with their saved key but must explicitly Start; they never restore capture/output. Existing short-lived keys require re-pairing.

## Configure your identity provider privately

Create a dedicated confidential Lemmi client in the self-hosted provider, with access to its RFC 7662 introspection endpoint using `client_secret_basic`. Keep access tokens short-lived (at most one hour). Default verification requires a Lemmi audience. For VoidAuth non-resource tokens, this host explicitly selects `LEMMI_AUTH_TOKEN_BINDING=client_id`: the token must belong to the dedicated configured client; any present `aud` must still match a configured audience. This never falls back automatically from a bad audience. Assign the authorized caregiver account. The current backend consumes bearer access tokens; browser OIDC sign-in/redirect handling is not implemented, so a redirect URL alone cannot enable sign-in. The provider is VoidAuth. Its actual discovery endpoint is `https://auth.chaoswarrior.dev/oidc/.well-known/openid-configuration`; observed issuer is `https://auth.chaoswarrior.dev/oidc` and introspection endpoint is `https://auth.chaoswarrior.dev/oidc/token/introspection`. Those two public settings have been populated in the private environment. The dedicated client ID/secret have now been saved privately; the real caregiver subject was verified through the one-time browser login. VoidAuth supports `client_secret_basic`; use that authentication method. Actual VoidAuth token issuance/introspection passed the one-time code/PKCE setup.

Edit `/home/anayn/project/Lemmi/.env` locally and populate these existing entries:

```dotenv
LEMMI_AUTH_INTROSPECTION_URL=THE_PROVIDER_HTTPS_INTROSPECTION_ENDPOINT
LEMMI_AUTH_ISSUER=EXACT_ISSUER_FROM_DISCOVERY
LEMMI_AUTH_AUDIENCE=EXACT_ACCESS_TOKEN_AUDIENCE
LEMMI_AUTH_CLIENT_ID=THE_CONFIDENTIAL_CLIENT_ID
LEMMI_AUTH_CLIENT_SECRET=THE_PRIVATE_CLIENT_SECRET
LEMMI_CAREGIVER_SUBJECT=YOUR_ACCOUNT_SUB_FROM_THIS_ISSUER
```

Do not guess the issuer from the hostname or use a username/email in place of `sub`. The standard root discovery path at `auth.chaoswarrior.dev` returned HTML/404 during inspection; application/realm-specific discovery may be required. Introspection must return `active`, matching `iss`, the configured audience/client binding, `sub`, integer `exp` within one hour, and `token_type: Bearer`. JWT/JWKS-only verification is not implemented. Keep all current generated keys unchanged.

After the actual subject is configured, set `LEMMI_DATABASE_URL` privately to the local `lemmi` database URL, using the generated `LEMMI_POSTGRES_PASSWORD` already in the same file (URL-encode passwords if changed). Then:

```sh
.data/bin/bun-linux-x64/bun run db:migrate
.data/bin/bun-linux-x64/bun run db:bootstrap
systemctl --user restart lemmi-gateway lemmi-web
```

This seeds fictional Alex with the actual caregiver assignment. The fictional Alex bootstrap has now completed with the actual verified caregiver assignment. Do not substitute the fixture identity used in tests. For real text replies, also configure `OPENROUTER_API_KEY` and an explicit `OPENROUTER_MODEL` privately and restart the gateway; both the standalone real adapter greeting and the public paired computer-session rehearsal passed.

## Cloudflare Tunnel — running

`cloudflared` 2026.11.0 runs as the enabled `lemmi-tunnel` user service. Tunnel `lemmi-backend` (UUID `a239d1c5-06b3-4d2e-a96e-abff317de731`) has four observed Cloudflare edge connections. DNS creation succeeded without replacing another record. Configuration is `.data/cloudflared/config.yml`; mode-0600 credentials are `.data/cloudflared/credentials.json`. The account certificate is `~/.cloudflared/cert.pem`, mode 0600. Do not copy these into Git.

Public HTTPS `/access` returned 200 and `Cache-Control: no-store`. Internal, mock, participant/caregiver pages and `/` returned 404. Unkeyed participant resources/WSS returned 401; key exchange issued a Secure/HttpOnly/SameSite=Strict cookie; the key alone could not pair; bad device credentials returned 401; explicit cookie logout passed. The local resolver initially cached NXDOMAIN, so public checks used the newly published Cloudflare address with hostname/certificate validation retained. Python urllib received 403 while curl passed; initial public gate checks used curl; the later live HTTPS/WSS rehearsal used Bun with explicit Host/TLS SNI and certificate validation. Plain HTTP cannot reach application data because the proxy requires forwarded HTTPS; edge-wide redirect/cache dashboard settings were not changed or independently audited.

Cloudflare's official [local tunnel setup](https://developers.cloudflare.com/tunnel/features/locally-managed-tunnels/create-local-tunnel/) and [ingress configuration](https://developers.cloudflare.com/tunnel/features/locally-managed-tunnels/configuration-file/) document this topology.

`https://lemmi.chaoswarrior.dev/access` is the unlock page. The shared key is the existing private `LEMMI_ACCESS_KEY`; caregiver bearer identity/device pairing remains separate. `/` intentionally returns 404. Never expose raw app/database/speech ports or `/internal/*`. See [the deployment guide](backend-deploy.md) for the allowed routes and remote acceptance checks.

## Observed validation

Frozen-lockfile dependency install, type/Svelte checks, production build and formatting passed after repairing the missing access-key wiring in `controlConfig`. The initial 88 Bun tests / 794 expectations passed against a separate local `lemmi_test` database. The production data smoke passed using real PostgreSQL/private media and fixture identity. The control/chat smoke passed with certificate-verified HTTPS/WSS, signed domain-gate cookie, pairing/revocation and fixture model replies. All seven Python speech boundary tests passed. Those fixture checks do not establish live-provider or hardware acceptance; subsequent real-provider/tunnel checks are recorded below, and K151 acceptance remains pending.

Actual loopback proxy observations: HTTPS-forwarded `/access` 200, unkeyed claim 401, internal path 404, `/` 404, plaintext unlock 403. Gateway/web remain bound to loopback. Counterpart review: Anay for access/storage/deployment, Emilia for actual device handshake/local controls; frontend ownership is unchanged.

## VoidAuth client and one-time caregiver setup

In **VoidAuth → OIDC Apps**, create a dedicated app:

| Setting | Value |
| --- | --- |
| Display name | Lemmi backend |
| Client ID | The dedicated ID generated by VoidAuth (or `lemmi-backend` if configurable) |
| Authentication method | `client_secret_basic` |
| Response types | `code` |
| Grant types | `authorization_code` |
| Redirect URL | `http://127.0.0.1:3333/callback` |
| Groups/access | Restrict to the intended caregiver account/group |

Save the client ID and secret privately in the existing `LEMMI_AUTH_CLIENT_ID` and `LEMMI_AUTH_CLIENT_SECRET` entries. The issuer/introspection URLs and explicit `client_id` binding have already been configured. Do not invent an audience or subject.

The one-time helper opens only a loopback listener, uses state and PKCE, verifies the real access token through configured introspection, and saves the signed-in caregiver's subject plus the local database URL to mode-0600 `.env`. It does not save tokens or create a browser application session. It requires an explicit assignment flag:

```sh
.data/bin/bun-linux-x64/bun scripts/setup-caregiver.ts --assign-alex
```

Open its printed authorization URL in a browser **on this machine** and sign in as the caregiver to assign to Alex. The callback expires after five minutes. Then run the migration/bootstrap/restart commands above. This helper does not implement the still-pending production browser login UI. It must finish before `.env` is edited again; concurrent edits abort setup.

The helper has fixture coverage for state rejection, foreign-client rejection, successful private assignment and no token/secret output. Actual VoidAuth login and caregiver assignment succeeded; no tokens or credentials were logged or saved by the helper. See [VoidAuth's client setup](https://github.com/voidauth/voidauth/blob/main/docs/OIDC-Setup.md).

Follow-up verification: explicit provider binding and setup helper passed type/Svelte checks, formatting, production build, 90 Bun tests / 826 expectations on real isolated PostgreSQL, and both production fixture smokes. Smoke fixtures now explicitly select audience binding so private host provider settings cannot alter their test mode. The host’s dedicated VoidAuth client credentials are saved; the loopback login helper verified the real caregiver identity and completed assignment configuration. OpenRouter key/model are now configured; a real adapter request with a fictional greeting passed (HTTP 200, 3.6 seconds). No response text or secrets were logged. The final live acceptance section below records the subsequent paired production session check.

## Final live host acceptance — November 13, 2026

The one-time real VoidAuth code/PKCE flow and issuer/client/expiry/subject validation passed. The helper saved the actual caregiver assignment and local database URL without retaining tokens. Ran `db:migrate`, `db:bootstrap`, and restarted gateway/web successfully.

A fictional computer harness used the authenticated private server pairing authority, then exercised the **actual public Cloudflare HTTPS claim**, scoped PostgreSQL-backed participant profile, and **verified public WSS**. Start → real OpenRouter greeting → waiting → Pause → explicit Resume → Stop passed. The harness did not log dialogue, and its credential was revoked afterward. This does not claim a public caregiver bearer pairing request was exercised; the real provider login was verified separately and its token discarded. The initial harness attempt omitted the JSON/origin headers and was rejected by SvelteKit before claim; its pairing was revoked and the corrected attempt passed.

The lab machine's system DNS still fails to resolve this newly created hostname even after cache flush. Public DNS-over-HTTPS resolves the Cloudflare addresses. Live HTTP/WSS checks used the published edge IP with the original hostname in Host and TLS SNI plus certificate validation enabled. No insecure TLS override or global resolver/network change was applied. Normal hostname-only clients on this machine require the local/upstream DNS issue to clear or be separately configured.

Current remaining limits: speech synthetic recognition quality is intermittent; integrated microphone/playback/camera and actual K151 operation are not implemented/accepted. Production browser OIDC sign-in UI remains pending. Notifications, full journals/preferences/deletion workflows remain pending. The worker remains an unimplemented placeholder and is not deployed. No automatic Git updater or counterpart technical review was performed. Deployment source/templates and the observed status are tracked on `backend-deploy`; private host configuration and artifacts remain ignored.

## Redeployment follow-up — `04d050e`

Fast-forwarded the deployment checkout from `51ede5e` to the reviewed `04d050e` security fix after isolated install/check/test/build/fixture-smoke verification. Installed the prepared production build and restarted web/gateway; private configuration and database contents were preserved. Previous source/build is retained under ignored `.data/releases`, with its path in `.data/rollback-release-path`. Public gate and live computer-device text/control checks passed; temporary device credential revoked. Earlier DNS failures are historical: the system resolver now resolves the public hostname and normal verified HTTPS unlock returns 200. See [current backend status](backend-status.md) for detailed acceptance and checks not repeated.

## Main integration deployment — November 14, 2026

Runtime `275de72` integrates main `24e7fe2`, the corrected speech pipeline and reviewed `002_media_collections.sql`. A private database backup plus previous source/build were retained under `.data/releases`; migration was applied without reseeding Alex, then web/gateway/private speech restarted with the verified build. Existing credentials were invalidated as designed. All services are active with no automatic restarts. Public text/chat/control acceptance and three isolated synthetic local-engine turns passed. Public speech remains disabled, with model/voice/accelerator/private configuration unchanged. See [backend status](backend-status.md) for exact scope and unrun hardware/quality checks.

## Persistent keys and chat support — November 14, 2026

Runtime `d067ac0` is deployed with `003_communication_support.sql` and `003_persistent_device_credentials.sql`. A private database/source/build/proxy backup is retained under `.data/releases`; its path is `.data/rollback-release-path`. New communication-support proxy paths were validated/reloaded. Same-key public authentication after a real gateway restart and complete text/control rehearsal passed; temporary persistent key revoked. The Python helper now requests persistent enrollment by default; one-hour credentials are not automatically upgraded. Keep null expiry support and private robot key storage in Emilia's firmware scope.

GLM is configured with the documented `LEMMI_LLM_REASONING_EFFORT=low` and `LEMMI_LLM_MAX_TOKENS=512`; model/key unchanged. The previous mode-0600 environment is retained privately with the rollback backup. Never downgrade to pre-persistent code while persistent keys remain active: revoke through the new implementation first or use a reviewed restore/migration. See current [backend status](backend-status.md) for all observed tests and limits.

## Fictional multi-profile endpoints — November 14, 2026

Runtime `17a8522` deployed after 169 backend and 17 Python tests plus production fixture smokes. Database/source/build/environment/proxy backups retained under `.data/releases`; current backup path is `.data/rollback-release-path`. Existing persistent shared key/file is unchanged and public authentication passed after upgrade. Full fictional profile/enrollment routes are enabled with `LEMMI_DEMO_ENROLLMENT=1`; `/participant` is gate-protected. Migration `002_multi_profile_endpoints.sql` adds profile/device/gateway scope and `004_endpoint_revocations.sql` preserves old revoke receipts while changing their device scope. No applied migration was edited. Two public fictional rehearsal profiles/endpoints passed concurrent WSS control isolation; only those rehearsal records were cleaned up.

Use `/access` then `/participant` for browser setup. For independent robot identities use the existing `bun run enroll-device PROFILE_ID PRIVATE_FILE`; each saved file is a distinct finite 30-day identity, while the earlier shared indefinite token remains valid. One profile has one active audio endpoint with explicit handoff; no automatic capture or output after reconnect. Public voice stays disabled and Teach Lemmi remains a separate unmerged integration. Backend status/API docs give exact consumer contracts and checks not yet performed.
