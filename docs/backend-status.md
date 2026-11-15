# Lemmi backend status

**Undeployed speech concurrency increment:** separate STT/TTS admission lanes and independently cancelable 1–4-worker engine pools replace the global single-job gate. Match `LEMMI_SPEECH_STT_WORKERS` / `LEMMI_SPEECH_TTS_WORKERS` in gateway and speech-wrapper environments; existing input/output limits and per-profile ownership remain. CUDA TTS is explicitly selectable; target NVIDIA validation is delegated to the server agent. Private `/health` adds engine device/compute and configured/ready worker counts; public HTTP/WSS schemas are unchanged. [Implementation, local evidence and server-agent steps](handoffs/speech-gpu-concurrency.md).

**Selected speech defaults (undeployed):** browser post-speech silence is now **1500 ms**, following the user’s report of Lukas’s trials. New speech provisioning/configuration selects **`en_US-hfc_female-medium`**, shared by browser/Stackchan output (22,050 Hz). Existing private configs remain preserved and require the explicit voice-path/restart step in the [local guide](../services/local-speech/README.md). Firmware detection remains a 1500 ms integration target; no deployed config or firmware was changed.
**Undeployed speech candidate — `anay/natural-speech-turns`:** optional content-free stage/receipt timings (`LEMMI_SPEECH_DIAGNOSTICS=1`) through the existing coordinator/scheduler, with browser turn ending on integration base `a7d5528`. No API/schema/database/voice/firmware replacement. The deployed revision below is unchanged. [Behavior, configuration and observed limits](handoffs/natural-speech-turns.md); final checks are in the build plan.

Updated November 14, 2026 (America/Los_Angeles). Branch: `backend-deploy`.

Deployed backend runtime revision: **`17a8522`**, integrating `anay/multi-profile-endpoints` (`284dcb7`) with the later persistent-key/chat-support compatibility fixes. Later documentation-only commits do not require a runtime restart.

The implemented backend is deployed on `mobrob-Precision-3680`. This is a fictional multi-profile integration deployment, not completed P0 scope or readiness for unattended care.

Maintain this deployment/acceptance record alongside the [backend API reference](backend_api.md) whenever backend behavior, configuration, availability or observed checks change. Do not promote unrun checks to passed or treat a new source commit as deployed.

**Media collections deployed:** migration `002_media_collections.sql` has been applied to the existing host database after a private backup. It adds corrected album/playlist metadata only; collection APIs, reviewed-pack hosting and deferred consent/journal/help/jobs/deletion/camera workflows remain unavailable. See [schema review](handoffs/anay-app-data-schema-review.md).

## Undeployed Emilia frontend/backend candidate

`anay/frontend-backend-integration` combines Emilia's `integration/frontend-backend` (`437f065`) with deployed-source `7debf9a`, retaining the deployed migrations, persistent keys, per-profile authority and chat/support hardening. It adds reviewed Teach Lemmi to the cookie-enrolled live participant shell and preserves the local caregiver/mock conversation UI. No running service, private configuration, credential, database or firmware was changed.

Completed Emilia's requested backend gate on an isolated worktree/PostgreSQL 17: **212 Bun tests / 3,991 expectations**, with all database suites enabled; **ten pairing-helper and seven speech Python tests**; type/Svelte, production build, formatting and whitespace passed. Dedicated migration/credential compatibility checks passed **10 tests / 74 expectations**; all six SQL files byte-match deployed source, and the conflicting old receipt migration is excluded. Production participant cookie/enrollment/concurrent-WSS/restart/release (including UI assets), persistent profile/media/support, TLS control/chat and six-second speech-output fixture smokes passed. These use fictional data, fixture providers/clients and simulated consumption; they do not establish physical browser/robot acceptance.

Fixed integration defects include preserving authoritative teaching policy on support-only saves, updating invitations on explicit support apply, fencing teaching while context saves are pending, preserving broader recognized Stop phrases, allowing only authorized fixed browser PCM while paused, suppressing late output on background pause, and exposing only the generic static art/font paths needed by the live shell. Deployment must separately install the candidate build and explicit proxy allowlist; public voice remains disabled. [Exact handoff and remaining gates](handoffs/frontend-backend-integration.md#backend-integration-follow-up--november-14-2026).

## Multi-profile endpoints — deployed

The user explicitly authorized full fictional multi-profile support on November 14. The deployed release integrates `anay/multi-profile-endpoints` (`284dcb7`) with the later persistent-key and chat/support implementation. It permits separately created fictional profiles, scoped browser/robot enrollments and independent per-profile session coordinators inside the same gateway. Existing preview cards remain static; no profile may borrow Alex's context or credentials.

| Deployed surface | Integration contract / acceptance status |
| --- | --- |
| Frontend setup | `/access` → `/participant`; explicitly enabled `LEMMI_DEMO_ENROLLMENT=1`; safe list/create/enroll/current/release routes. Public gating, participant HTML and native setup/isolation checks passed. |
| Browser client | `createParticipantSetup` and `ParticipantConnection`; 30-day HttpOnly endpoint cookie, same-origin WSS, explicit Start and local teardown. Actual browser permission/autoplay/keyboard/zoom recovery still unrun here. |
| Robot setup | `bun run enroll-device PROFILE_ID PRIVATE_FILE`; separate device identity/file for each endpoint, 30-day demo enrollment. Firmware storage/flash acceptance remains Emilia's work. |
| Existing shared key | Indefinite persistent legacy key remains valid until revoked, with null expiry; it was preserved and verified after the actual upgrade. Sharing one identity still permits one simultaneous connection for that identity. |
| Session ownership | Multiple authorized endpoints may connect; each profile retains one active audio owner. `activeEndpointId` plus explicit handoff/Resume guards conversation/media. Different profiles remain isolated. |
| Caregiver support | Existing hardening, profile membership, save/apply cancellation and revision behavior is preserved and regression-tested independently for each profile. |
| Speech | Existing bounded transport and shared eight-waiter adapter queue; public speech remains disabled. Hardware/quality acceptance is not established by fixtures. |
| Teach Lemmi | `codex/teach-lemmi` and its handoff reviewed; no merge or deployment in this prioritized endpoint deployment. Shared schema/coordinator/protocol/UI conflicts require a separate integration. |

The migration candidate retains all existing checksummed migrations, adds `002_multi_profile_endpoints.sql`, and replaces the branch's incompatible receipt-table creation with `004_endpoint_revocations.sql`. The latter preserves legacy revoke history while introducing per-device receipts; no checksum edit/rename of an already applied migration is permitted. Source and tests are being reconciled in an isolated checkout. No candidate test count, production migration, new browser deployment or unchanged-key live proof is claimed until the deployment owner records it below.

Frontend/robot integration entry point: [endpoint contract and quickstart](backend_api.md#endpoint-integration-candidate--frontend-and-robot-contracts), [endpoint handoff](handoffs/anay-multi-profile-endpoints.md). The current running deployment is `17a8522`; earlier candidate observations in this section are historical.

## Persistent credentials and chat support — deployed

Persistent enrollment and chat/support hardening are deployed together. Migrations `003_communication_support.sql` and `003_persistent_device_credentials.sql` have been applied in addition to existing `001`/`002`. Both full filenames are independently tracked/checksummed; no applied migration was renamed or edited. The proxy now allows the protected communication-support read/apply paths.

Run `python3 scripts/pair-stackchan.py` for a fresh persistent enrollment by default (`--short-lived` opts out). Stackchan must accept null claim/ready expiry and store its returned key privately. Existing short-lived keys are not upgraded. Persistent keys survive gateway restart; sessions, pending codes, capture and output do not. Successful revocation remains durable, and a lost claim response still requires revoke/re-enrollment. Firmware storage and real hardware acceptance remain Emilia's handoff. [Persistent contract](handoffs/anay-persistent-device-credentials.md), [chat/support handoff](handoffs/anay-chat-support-hardening.md).


## Deployment

**Historical branch evidence, before deployment:** `anay/chat-support-hardening` adds English chat hardening and caregiver support read/save/apply with central policy, immediate cancellation, explicit continuation and private PostgreSQL configuration provenance. It includes speech fix `3fb561d` and main `a6f7ff9`; neither existing feature branch nor the deployed host was modified by this work. Final live text regression passed 15/15 after a Quiet prompt mismatch was found and fixed. No microphone/speaker/K151 acceptance follows. See [handoff and test scope](handoffs/anay-chat-support-hardening.md); current host acceptance is recorded in the deployment follow-up below.

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
- Gateway restart retains explicitly persistent active keys in PostgreSQL mode, clears short-lived keys/pending codes and ends sessions. Persistent devices reconnect with a fresh hello/sequence and explicit Start; no listening/playback/conversation is restored. Short-lived devices re-pair.
- Root and speech environment files are mode 0600. Provider credentials, identity identifiers, tunnel credential JSON, certificates, models, databases and private media are excluded from source control.

## Observed verification

| Check | Result and scope |
| --- | --- |
| Pinned frozen-lockfile install | Passed; Bun lockfile unchanged |
| Type/Svelte, production build, formatting, diff whitespace | Passed |
| Bun automated suite | **169 tests passed, 3,585 expectations**, including real isolated `lemmi_test` PostgreSQL |
| Production control/chat smoke | Passed with certificate-verified HTTPS/WSS and explicit identity/model fixtures |
| Production data smoke | Passed with real isolated PostgreSQL/private media and fixture identity |
| Python speech boundary suite | **7 tests passed**; fixture inference worker |
| Python pairing helper | **6 fixture tests passed**; no live pairing made by this helper |
| Speech WSS fixtures | Six-second output/window/receipt smoke passed; playback simulated |
| Actual private speech engines | Three synthetic CPU turns passed through an isolated verified WSS gateway; fixture LLM and simulated playback; not a recognition-accuracy or hardware check |
| Public access boundary | Verified HTTPS unlock, secure cookie exchange/logout, missing-key/device rejection and internal/mock route denial |
| Hostname resolution | Earlier DNS issue cleared; normal system lookup and hostname-only verified HTTPS unlock passed during redeployment |
| Actual identity provider | VoidAuth code/PKCE login and introspection passed; tokens discarded |
| Actual model provider | OpenRouter fictional greeting passed; standalone request approximately 3.6 seconds; reply/credentials not logged |
| Public computer-device path | Persistent public claim with null expiry → actual gateway restart → same-key HTTPS profile/WSS, no restored active session → Start/model greeting/Pause/Resume/Stop passed; rehearsal credential revoked |

The live computer rehearsal created its pairing through the private authenticated server authority. It did **not** exercise a public caregiver-bearer pairing request; real caregiver verification was tested separately. No physical robot, microphone, camera, real contact or notification was used. Fixture tests remain distinct from these live observations.

## Remaining limits and next handoff

**Speech code deployed, opt-in disabled:** bounded capture grants, PCM ingestion, STT→chat→TTS and output/receipt execution are present in the runtime. The recognized concern/refusal fix is included: fresh fixed-output authority keeps capture off and the session paused, with cancellation preserved. The public gateway has not enabled `LEMMI_SPEECH_ENABLED=1`; existing text-only behavior remains available. See the [protocol/handoff](handoffs/anay-speech-pipeline.md) before enabling voice.

1. **Speech:** synthetic English recognition was intermittent. The backend speech transport is implemented and the engines run privately, but public voice remains disabled pending recognition quality, counterpart review and actual device/browser capture/playback acceptance. Music execution remains incomplete. No robot voice-readiness claim follows from engine startup.
2. **Product work:** production browser OIDC sign-in/participant text transport, caregiver selector/browser UI, full journal/summary, notification/outbox, preferences/deletion workflows, completed activities, camera and physical K151 acceptance remain pending as described in the [API inventory](backend_api.md) and team plan.
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

## Persistent-key/chat deployment acceptance — November 14, 2026

Published separate squash commits to main: persistent credentials first (`c402edc`), then chat hardening/support (`430269f`). Integrated them into backend-deploy as runtime `d067ac0`. Resolved overlapping helper additions using the tested persistent-default version; the backend integration tree exactly matched the tested main candidate. Kept both branches' verification records; the production smoke message and migration ledger expectation were reconciled to cover both features.

Persistent-only preparation passed 130 Bun tests / 2,533 expectations, six helper tests, type/build checks and the persistent production data smoke. Combined release passed 151 Bun tests / 3,371 expectations with separate runtime/schema/support PostgreSQL 17 databases, six helper Python tests, seven speech Python tests, type/Svelte, build, format, default/persistent data/support smokes, control/chat fixture smoke and six-second speech fixture output. No dependencies changed.

Backed up private PostgreSQL/source/build/proxy state, applied both new discovered migrations, installed the verified build, and validated/reloaded the real Nginx allowlist. No reseed/reset, historical full SQL proposal, public voice enablement or physical device action occurred. Post-deployment public gate/cookie/logout/route denials passed. Support GET and same-origin JSON apply without a key returned 401; the initial bodyless POST probe hit SvelteKit's 403 form-origin protection. Full support save/apply/cancellation acceptance used fixture identity and real isolated PostgreSQL, not a fresh real caregiver login.

A temporary persistent computer credential returned null expiry and survived a real gateway restart. Public scoped profile and WSS authentication passed with no active session restored. Final Start → real model reply → Pause → Resume → Stop passed, then the test key was revoked. Two initial model turns returned sanitized provider-unavailable errors under the old GLM 160-token/default-reasoning settings. A separate fictional metadata-only diagnostic returned HTTP 200/stop, 100 completion tokens including 78 reasoning tokens. Following the handoff's documented GLM configuration, the host now uses low reasoning and 512 maximum tokens; the subsequent complete live rehearsal passed. This is not proof that every earlier failure was budget exhaustion or broad semantic acceptance. Previous private configuration is retained in the rollback directory. No prompt/reply/key was logged. One immediate test attempt raced startup and created no pairing; the readiness-delayed check passed.

Persistent-key downgrade warning: old gateway code is incompatible with an active new persistent marker. Revoke persistent keys with the new implementation before downgrade, or perform a separately reviewed migration/restore. No automatic downgrade is supplied. Hardware key storage/null-expiry handling, recognition quality, actual caregiver UI and reboot/venue tests remain open.

### Pairing-helper diagnostic follow-up — November 14, 2026

A reported helper failure after the browser callback was hidden behind its generic error. Added safe stage/HTTP reporting without provider bodies or token values; eight Python fixtures pass, including error-body redaction and CLI stage output. Read-only checks confirmed real OIDC discovery is accessible, caregiver-less profile access returns 401, no active device key exists and durable revoke count is 3 (below capacity). A pending in-memory pairing was not inspected, cleared or revoked. Exact live failure cause awaits the user's next helper error; this change does not claim a new successful enrollment or alter the deployed API/runtime. For remote login, forward laptop port 3333 to host loopback with SSH, then run the helper in that session and open its URL on the laptop.

### One-file team access — November 14, 2026

On explicit user instruction, durably revoked the previous device key/pending enrollment and created one replacement persistent team-test credential. Public HTTPS claim returned null expiry; participant profile access using the resulting headers passed. Creation used the authorized private server authority; no new caregiver browser login or physical robot action was performed. The replacement is intentionally left active for the user's teammates. Its raw credential and outer key are saved only in ignored `.data/stackchan-access.json`, mode 0600; their values were not logged. Distribute that single file privately. It grants device scope, not caregiver/admin access; one active connection per device identity remains the limit; distinct enrolled devices may now connect concurrently with one audio owner per profile.

The Python helper now performs claim and writes that same bundle by default, with `--pair-only` for the previous unclaimed-code flow. It refuses to overwrite an existing bundle before making any request. Ten local Python fixtures passed, including file/claim/redaction protections. This tooling/configuration action changes no server API or deployed runtime revision and requires no service restart. No automatic key rotation/revoke is added; a lost response still needs explicit revoke/re-enrollment.

## Multi-profile endpoint deployment acceptance — November 14, 2026

Deployed runtime `17a8522` after explicit full fictional multi-profile authorization. The original endpoint branch predates the later persistent-key/chat-support work; the integration preserved that work, nullable indefinite keys, current chat guards, and per-profile support/default-save/apply/context cancellation. Parallel technical reviews added transaction/epoch/membership fencing and four credential/migration regressions plus a cross-profile support regression. Teach Lemmi was reviewed only; it still requires registry/ownership/timer/live-shell adaptation and was not merged.

Before production restart, the isolated integrated tree passed frozen Bun 1.4.4 install, type/Svelte, **169 Bun tests / 3,585 expectations** with separate PostgreSQL 17 runtime/schema/support databases, ten helper and seven speech-boundary Python tests, production build/format, participant-cookie/concurrent-endpoint/restart/release smoke, persistent data/support smoke, TLS control/chat fixture and six-second speech fixture output. Existing applied migration contents were byte-checked unchanged. These fixture smokes use simulated clients/model/playback, not physical hardware.

Backed up private database/environment/proxy and previous source/build under ignored `.data/releases`. Applied `002_multi_profile_endpoints.sql` and reconciled `004_endpoint_revocations.sql` through the normal checksum runner; no previously applied migration changed, no existing profile was reseeded and no existing credential was rotated. The original conflicting branch receipt-creation migration was not applied. The old private revoke table is retained as `legacy_device_revocations` and command identities copied to the new device-scoped table. Enabled only fictional `LEMMI_DEMO_ENROLLMENT=1`, installed the validated scoped proxy allowlist, and restarted web/gateway. Voice settings/model/key remain unchanged.

Observed after deployment: the existing shared persistent file still authenticates public scoped profile reads; its values were neither printed nor changed. Public `/access` returns 200, locked `/participant` redirects to `/access`, unkeyed `/v1/demo/profiles` returns 401, internal/caregiver/root paths return 404, and unlocked participant HTML returns 200. Created two explicitly named fictional rehearsal profiles through public APIs, enrolled distinct robot identities and connected them simultaneously over verified public WSS. Start/Pause/Stop stayed isolated by profile and audio negotiated false as configured. Revoked only those rehearsal endpoints and removed only the newly created rehearsal profiles through host-admin cleanup. The user's shared key was preserved and left active. Web/gateway report active with zero automatic restarts. No physical browser interaction/microphone/speaker/camera, new real caregiver login, real-model multi-profile conversation, reboot or venue test was performed.

Frontend integration may use the same-origin participant clients and browser cookies now; robot integration may create a separate protected enrollment file/device ID per endpoint. Sharing one legacy key still identifies one device and does not create independent concurrent connections. See [current API quickstarts](backend_api.md#deployed-endpoints--frontend-and-robot-contracts) and [endpoint handoff](handoffs/anay-multi-profile-endpoints.md).
