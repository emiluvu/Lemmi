# Lemmi backend status

Updated November 14, 2026 (America/Los_Angeles). Branch: `backend-deploy`.

Deployed backend runtime revision: **`275de72`**, integrating `main` at `24e7fe2`. Later documentation-only commits do not require a runtime restart.

The implemented backend is deployed on `mobrob-Precision-3680`. This is a fictional Alex integration deployment, not completed P0 scope or readiness for unattended care.

Maintain this deployment/acceptance record alongside the [backend API reference](backend_api.md) whenever backend behavior, configuration, availability or observed checks change. Do not promote unrun checks to passed or treat a new source commit as deployed.

**Media collections deployed:** migration `002_media_collections.sql` has been applied to the existing host database after a private backup. It adds corrected album/playlist metadata only; collection APIs, reviewed-pack hosting and deferred consent/journal/help/jobs/deletion/camera workflows remain unavailable. See [schema review](handoffs/anay-app-data-schema-review.md).

## Undeployed persistent-key branch

`anay/persistent-device-credentials` adds caregiver-selected persistent enrollment for `stackchan-alex` / fictional Alex in PostgreSQL mode. Keys remain valid until revoked and only their hashes persist across gateway restarts; codes/sessions/capture/output do not resume. Default one-hour credentials retain their previous behavior. Migration `003_persistent_device_credentials.sql` and a one-time `python3 scripts/pair-stackchan.py` enrollment (persistent by default; `--short-lived` opts out) are required after an authorized deployment. Revocation retries persist safely across restarts. Emilia owns firmware storage and nullable `expiresAt` / `credentialExpiresAt` handling. Observed locally: 130 Bun tests / 2,533 expectations, six Python helper tests (including the later persistent-default CLI change), type/build/format and production data/control fixture smokes passed; the data smoke also passed explicit persistent enrollment. This branch does not change the deployed runtime above, its private configuration or running services. [Exact contract, checks and handoff](handoffs/anay-persistent-device-credentials.md).

## Deployment

Public origin: **https://lemmi.chaoswarrior.dev**. Open **[/access](https://lemmi.chaoswarrior.dev/access)** to unlock the outer domain gate. `/` intentionally returns 404. The shared access key is stored privately in the host's root `.env`; it does not replace caregiver authentication or device pairing.

Traffic follows Cloudflare → `cloudflared` → loopback Nginx → SvelteKit HTTP API / Bun realtime gateway. Database, private media and speech are not public services.

| Component | Running configuration |
| --- | --- |
| HTTP API | `lemmi-web` user service, `127.0.0.1:3000` |
| Session/realtime authority | `lemmi-gateway` user service, `127.0.0.1:3001` |
| Reverse proxy | Docker Compose project `lemmi-proxy`, Nginx 1.28 Alpine, `127.0.0.1:8080` |
| Public tunnel | `lemmi-tunnel` user service, named tunnel `lemmi-backend`, four observed edge connections |
| PostgreSQL | Docker Compose project `lemmi`, PostgreSQL 17, healthy on `127.0.0.1:5432`, persistent volume |
| Private speech | `lemmi-speech` user service, `127.0.0.1:8765`, CPU Whisper/Piper; quality gate incomplete |
| Worker | Placeholder only; not deployed |

User lingering is enabled. Application/tunnel/speech services are enabled; containers use restart policies. Bun 1.4.4 and cloudflared 2026.11.0 are installed under ignored `.data/bin`. Reboot recovery has not been rehearsed. No automatic Git pull, build or deployment updater is installed.

## Authentication and persistence

- The missing live access-key wiring in `controlConfig` was repaired. Live configuration now requires an independent outer key, passed to both HTTP and WSS gate checks.
- Actual VoidAuth discovery, authorization-code login with state/PKCE and authenticated introspection passed. Issuer: `https://auth.chaoswarrior.dev/oidc`.
- This host explicitly selects `LEMMI_AUTH_TOKEN_BINDING=client_id` for VoidAuth non-resource tokens. Client identity, issuer, active status, Bearer type, expiry and assigned caregiver subject remain required. Any present audience must match the configured audience. Other deployments default to strict audience binding; there is no automatic fallback.
- The loopback-only `scripts/setup-caregiver.ts --assign-alex` helper saved the verified subject/database configuration without retaining tokens. It is setup tooling, not production browser sign-in.
- Migrations and fictional Alex bootstrap completed. The running gateway uses PostgreSQL for the implemented profile, credential-hash and bounded factual/session-checkpoint storage. Private approved media uses protected local storage.
- Revision `04d050e` fences pairing/claim writes to the current database boot owner. Stale authorities cannot overwrite a replacement gateway’s ownership or issue usable credentials.
- Gateway restart invalidates issued device credentials and ends interrupted sessions. It does not resume listening, playback or a conversation. Explicit re-pairing/start is required.
- Root and speech environment files are mode 0600. Provider credentials, identity identifiers, tunnel credential JSON, certificates, models, databases and private media are excluded from source control.

## Observed verification

| Check | Result and scope |
| --- | --- |
| Pinned frozen-lockfile install | Passed; Bun lockfile unchanged |
| Type/Svelte, production build, formatting, diff whitespace | Passed |
| Bun automated suite | **122 tests passed, 2,480 expectations**, including real isolated `lemmi_test` PostgreSQL |
| Production control/chat smoke | Passed with certificate-verified HTTPS/WSS and explicit identity/model fixtures |
| Production data smoke | Passed with real isolated PostgreSQL/private media and fixture identity |
| Python speech boundary suite | **7 tests passed**; fixture inference worker |
| Python pairing helper | **4 fixture tests passed**; no live pairing made by this helper |
| Speech WSS fixtures | Six-second output/window/receipt smoke passed; playback simulated |
| Actual private speech engines | Three synthetic CPU turns passed through an isolated verified WSS gateway; fixture LLM and simulated playback; not a recognition-accuracy or hardware check |
| Public access boundary | Verified HTTPS unlock, secure cookie exchange/logout, missing-key/device rejection and internal/mock route denial |
| Hostname resolution | Earlier DNS issue cleared; normal system lookup and hostname-only verified HTTPS unlock passed during redeployment |
| Actual identity provider | VoidAuth code/PKCE login and introspection passed; tokens discarded |
| Actual model provider | OpenRouter fictional greeting passed; standalone request approximately 3.6 seconds; reply/credentials not logged |
| Public computer-device path | Real persistent pairing authority → public HTTPS claim/profile → verified WSS Start → real model greeting → Pause → Resume → Stop passed; rehearsal credential revoked |

The live computer rehearsal created its pairing through the private authenticated server authority. It did **not** exercise a public caregiver-bearer pairing request; real caregiver verification was tested separately. No physical robot, microphone, camera, real contact or notification was used. Fixture tests remain distinct from these live observations.

## Remaining limits and next handoff

**Speech code deployed, opt-in disabled:** bounded capture grants, PCM ingestion, STT→chat→TTS and output/receipt execution are present in the runtime. The recognized concern/refusal fix is included: fresh fixed-output authority keeps capture off and the session paused, with cancellation preserved. The public gateway has not enabled `LEMMI_SPEECH_ENABLED=1`; existing text-only behavior remains available. See the [protocol/handoff](handoffs/anay-speech-pipeline.md) before enabling voice.

1. **Speech:** synthetic English recognition was intermittent. The backend speech transport is implemented and the engines run privately, but public voice remains disabled pending recognition quality, counterpart review and actual device/browser capture/playback acceptance. Music execution remains incomplete. No robot voice-readiness claim follows from engine startup.
2. **Product work:** production browser OIDC sign-in/participant text transport, full journal/summary, notification/outbox, preferences/deletion workflows, completed activities, camera and physical K151 acceptance remain pending as described in the [API inventory](backend_api.md) and team plan.
3. **Review:** Anay reviews access/storage/deployment changes; Emilia verifies real firmware headers, pairing and independent local controls. The remote merge-verification handoff reviewed this credential fix with a regression test. Actual firmware compatibility, broader shared-boundary counterpart review and reboot/network-failure rehearsal remain outstanding.

Operations, private provisioning and service commands: [host setup](host-setup.md). General deployment topology and acceptance checklist: [backend deployment](backend-deploy.md). Observed team acceptance record: [build and demo plan](build-and-demo-plan.md).

## Redeployment of `04d050e`

The handoff was inspected and the branch fast-forwarded from `51ede5e` after isolated verification on this host. The release fixes stale database gateway pairing/credential issuance: an old authority cannot replace the current boot marker when claiming credentials. No dependency or schema migration changes were required.

A fresh frozen-lockfile install, type/Svelte checks, 91 Bun tests / 833 expectations against isolated PostgreSQL 17, seven Python boundary tests, production build, formatting, and both production fixture smokes passed before the running services were changed. The verified build was installed, gateway/web restarted, and prior source/build retained privately under `.data/releases` for rollback. No database reset, caregiver reassignment or private-configuration replacement occurred.

After restart, public gate/cookie/logout/internal-route/device-denial checks passed. A fictional computer rehearsal passed real persistent pairing authority → public HTTPS claim/profile → verified WSS Start → actual OpenRouter greeting → Pause → Resume → Stop. Its temporary credential was revoked. As before, pairing creation used the private authenticated authority; this does not claim a public caregiver-bearer pairing request or hardware test. Web/gateway report active with zero automatic restarts; PostgreSQL remains healthy. The hostname now resolves normally and verified HTTPS `/access` returns 200 without an address override.

The default mock-web smoke, a new actual VoidAuth browser login, reboot recovery, speech recognition quality and physical hardware checks were not repeated during this redeployment. The fixture identity/model checks remain distinct from the actual tunnel/model observations. Restart invalidated earlier device credentials; re-pair before testing a physical client.

## Pairing helper — November 14, 2026

Added `scripts/pair-stackchan.py`, a Python 3.10+ standard-library client for interactive VoidAuth code/PKCE login and public caregiver pairing creation. It prints a fresh, unclaimed ID/code for Stackchan, never auto-revokes/claims, and saves no tokens or configuration. Run `python3 scripts/pair-stackchan.py` from the repo root; see the [API reference](backend_api.md#python-pairing-helper) for options. Four local fixture tests passed; no live pairing/provider login was performed with this helper. No API/server behavior or deployed runtime changed; the runtime was still `04d050e` when this helper was first added; the current runtime is recorded above.

## Main integration deployment — November 14, 2026

Integrated main `24e7fe2` into `backend-deploy` as runtime commit `275de72`, retaining the existing pairing helper and historical review. Only the appended build-plan verification records conflicted; both were preserved. Application code was not changed to resolve the merge.

An isolated checkout passed Bun 1.4.4 frozen install, type/Svelte checks, **122 Bun tests / 2,480 expectations** using separate PostgreSQL 17 runtime/schema-test databases, seven speech Python tests, four helper tests, production build, formatting, and control/data/speech fixture smokes. The schema tests exercised a populated foundation upgrade and atomic migration rollback before production migration.

A private custom-format PostgreSQL backup and previous source/build were retained under ignored `.data/releases`. Applied only the reviewed `002_media_collections.sql`; the historical full app-data proposal was not executed. Alex and private configuration were preserved, with no profile reseed or database reset. Restarted web/gateway/private speech; all report active and zero automatic restarts. Voice opt-in remains disabled; no model/voice/accelerator/provider setting was changed.

Public gate/cookie/logout/internal/mock/device-denial checks and normal hostname HTTPS unlock passed. The real persistent computer-client rehearsal passed public claim/profile → verified WSS → real OpenRouter greeting → Pause → Resume → Stop; temporary credential revoked. As before, pairing creation used private server authority and no real caregiver bearer request was repeated. Three additional synthetic CPU STT/TTS turns passed an isolated verified WSS gateway with a fixture LLM and simulated consumption; numeric STT totals 869 ms and TTS totals 242 ms across three turns. No audio/dialogue was saved or printed.

No physical microphone/speaker/camera, production voice session, human recognition-quality test, fresh VoidAuth browser login, notification, reboot or venue-network rehearsal was performed. Existing devices must explicitly pair again after restart.
