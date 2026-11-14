# Lemmi backend status

Updated November 14, 2026 (America/Los_Angeles). Branch: `backend-deploy`.

Deployed web runtime revision: **`eab2c35`** (main-based live UI alignment, with designed landing/conversation routes); gateway remains **`f5724a0`**, integrating `anay/frontend-backend-integration` (`a7d5528`), Teach Lemmi (`c006d26`), fictional multi-profile endpoints and the persistent-key/chat-support fixes. Later documentation-only commits do not require a runtime restart.

## Live UI alignment deployed — November 14, 2026

User requested the newer UI branch; `codex/kylie-ui-refinements` was unchanged at `d8a6fe4`, while `codex/main-ui-alignment` had new checkpoint `a0a3797`. Integrated that checkpoint as `eab2c35` on top of the tested Photo Story source reconciliation. The live profile dialog now uses the reference sage portrait/five avatar cards/basic information/paper summary/empty trends design; private data/editing/upload/excerpt settings stay unavailable. Conversation uses the reference 440px maximum avatar, scene spacing, state-aware heading and responsive control bar. Connection/enrollment/speech/teaching handlers and authorization are unchanged by this UI checkpoint.

Final combined type/Svelte check passed with zero errors/warnings and production build passed. The prior full 227-test database-enabled suite and participant/data/control/long speech fixture smokes cover the reconciled backend; subsequent changes are presentation only. Installed the combined web build and restarted only web, with prior build/manifest at `.data/live-ui-alignment-rollback-path`. Gateway PID/start time remained unchanged. Public HTTPS unlock, caregiver/conversation/profile-list and root redirect passed; fetched updated profile UI bundle byte-matched the installed file. Private profile read without caregiver token stayed 401; local Photo Story page/worklet stayed 404. No new actual browser/hardware acceptance or live session/model turn was performed. Source is published to both main and backend-deploy; gateway still runs `f5724a0` and Photo Story is not a live-site activity.

## Photo Story integration source — November 14, 2026

Integrated Lukas's `codex/photo-story-conversation` checkpoint `9dfc4b6` with the current designed UI, per-profile authority and Teach Lemmi. This is an explicitly local rehearsal, not a new production activity. The running gateway remains `f5724a0`; its sessions, credentials, private data and provider settings were not changed. Public Photo Story hosting/media and production activity transport are still unavailable.

Preserved existing `conversation.submit`, teaching approved-output/cancellation and current caregiver/conversation designs while adding the pure photo reducer/context/skip/event recap and opt-in local speech operations. Rehearsal configuration requires `localOnly:true` and explicit Alex profile binding; ordinary live coordinators cannot gain activity/private caregiver operations from this merge. Removed inferred hard-coded biography from gardening interest, validated photo system inputs before dispatch, and labeled selection events without claiming actual viewing. The launcher now forces mock mode/port 3011 and resolves Vite from the actual web workspace; it cannot inherit the shared host's live gateway mode/port. Caption-only reviewed garden/park illustrations remain local; no pixels or participant utterances are persisted or sent as images.

Observed in an isolated installed Bun 1.4.4 worktree/PostgreSQL17: 227 tests / 4,163 expectations, no skips; type/Svelte zero errors/warnings and production build passed. Production participant, persistent profile/media/support and control/chat TLS smokes passed; six-second speech fixture smoke passed with 300 simulated consumed chunks. Actual local launcher/HTTP page/status/Start/photo opening/typed turn/Skip/factual journal/Stop passed with speech disabled and explicit reviewed-demo chat. The initial test had an adapter-entry synchronization race, fixed before the final full pass; the actual launcher smoke exposed and fixed an incorrect root Vite path. No new actual STT/TTS/OpenRouter, browser microphone/keyboard or K151 acceptance was run. Production integration of scoped approved pack/media availability, activity WSS and counterpart UI/firmware review remains the handoff.

## Designed public UI integration — November 14, 2026

User clarified that the intended public UI is the published branch's `/caregiver` (Profiles/Games/Ecosystem folders) and `/participant/conversation` scene, with caregiver as the landing page. The previous merge preserved its source but left these routes blocked/local and retained the separate live shell; that did not fulfill the requested experience. Web `cb64621` now serves the exact designed routes behind the existing domain gate and explicit fictional-demo switch; unlocked `/` redirects to `/caregiver`. The unlock page links to the caregiver workspace and designed conversation. Proxy allowlist adds only these exact pages and generic banner/game-picture artwork.

Dashboard profile listing/explicit creation uses existing typed live fictional setup, with independent profiles and inert labeled example cards. Conversation reuses the existing live controller, cookie enrollment, WSS, BrowserAudio and teaching controls inside the published illustrated scene. Returning to caregiver cancels local audio and pauses an owned session; opening the dashboard remotely creates no connection and sends no session command. Start/teaching text is admitted only through existing current-session/revision reply guards. No new gateway, API resource, migration, provider setting or credential was introduced. Read-only profile panels show only the safe participant projection. Private profile editing/journals remain unavailable pending separate caregiver sign-in; no private guidance/contacts/journals are exposed by the shared demo key. Games stay explicit previews and camera controls are disabled/unavailable. There is no fallback from failed live profile loading to mock success.

Observed: type/Svelte zero errors/warnings, isolated production build, 43 focused tests / 452 expectations (including new page-gate/proxy/demo-switch checks), formatting and whitespace passed. Initial type check found a nullable callback reference/declaration order; corrected before final checks. Proxy syntax validated and gracefully reloaded; only web restarted, gateway PID/start time preserved. Actual public HTTPS verified locked-page redirects, root → caregiver, caregiver/settings/check-in/sign-in and designed conversation 200, live profile-list 200, generic artwork, private profile read without caregiver token 401, mock/internal paths 404. No live session commands/model calls were sent during this acceptance; actual browser microphone/playback, keyboard/zoom and counterpart UI review remain pending. Backup build/proxy/manifest pointer: `.data/designed-routes-rollback-path`. This entry supersedes earlier claims that caregiver/conversation must stay local or root returns 404.

## Kylie UI publication merge — November 14, 2026

Merged requested `codex/kylie-ui-refinements` commit `d8a6fe4` as `733fb1c` into `backend-deploy`. Its designed components, CSS and binary artwork were already present via the earlier local-UI integration. Reconciled conflicts by preserving live/mock route separation, live enrollment/transport, scripted Teach Lemmi and approved Alex context; retained both teams' documentation. The resulting diff from prior deployment source contains only the UI publication record and whitespace in the font license: there is no new visual/behavior change. Caregiver/mock previews remain local, not newly public routes.

Built in an isolated worktree and installed that build, retaining the previous build/manifest under `.data/releases` with pointer `.data/kylie-ui-rollback-path`. Restarted only web; gateway PID/start time and active test connections were preserved. Thirty-eight focused access/browser/teaching tests / 392 expectations passed, production build passed, and the actual workspace type/Svelte check passed with zero errors/warnings. Isolated symlinked-worktree checking could not resolve generated route types; the unchanged source passed in the actual workspace. Public verified HTTPS unlock, participant/profile-list and twenty JS/CSS bundles passed; all twenty bundles and the three checked font/surface assets byte-match installed files. No session commands or real model calls were sent. No new visual browser/hardware acceptance was performed.

## Browser unlock repair — November 14, 2026

**Robot WSS conflict observation:** Emilia reported upgrade 409 at 21:17:13 UTC. Subsequent read-only checks found one established gateway socket, an Alex session in waiting/robot mode, and a deliberately incomplete upgrade probe using the existing saved `stackchan-alex` identity returned 409 / `REVISION_CONFLICT` / `Device already connected`. No valid handshake, session command, restart or credential change was sent. The user reports Lukas is testing Teach Lemmi using the shared JSON and Emilia also uses `stackchan-alex`; this is consistent with the enforced one-connection-per-identity rule. The exact historical request/remote holder cannot be reconstructed from disabled request logs. Leave the active test alone; after its client closes, retry the robot connection. Separate concurrent endpoints require separate enrollment identities and explicit audio handoff for the same profile. No robot acceptance is implied.

Emilia reported Chrome failing after Unlock. The access page sent `Referrer-Policy: no-referrer`, which makes native browser form navigations serialize Origin as `null`; the required same-origin POST check then rejected them. The earlier manually supplied-Origin HTTP check missed this browser behavior. Changed the page policy to `same-origin`, retaining rejection of missing/null/foreign origins and suppressing cross-origin referrers. Existing keys/cookies, API authorization, database and gateway are unchanged.

Deployed the isolated production build from `7ad2de1` and restarted only `lemmi-web`; all four services remain active. Previous web build/manifest retained privately under `.data/releases`, with pointer `.data/access-fix-rollback-path`. Five access security tests / 39 expectations, type/Svelte checks, focused formatting and production build passed. Initial sandbox-only attempts could not open the test socket/build worker; reruns with those permissions passed. Public HTTPS verified the new header, unlock/cookie, participant and profile-list 200, logout/cookie clearing, and null-Origin rejection 403. The user subsequently confirmed Emilia's Chrome unlock worked after this deployment. Broader counterpart review remains pending; no hardware/provider/session test was implied.

The implemented backend is deployed on `mobrob-Precision-3680`. This is a fictional multi-profile integration deployment, not completed P0 scope or readiness for unattended care.

Maintain this deployment/acceptance record alongside the [backend API reference](backend_api.md) whenever backend behavior, configuration, availability or observed checks change. Do not promote unrun checks to passed or treat a new source commit as deployed.

**Media collections deployed:** migration `002_media_collections.sql` has been applied to the existing host database after a private backup. It adds corrected album/playlist metadata only; collection APIs, reviewed-pack hosting and deferred consent/journal/help/jobs/deletion/camera workflows remain unavailable. See [schema review](handoffs/anay-app-data-schema-review.md).

## Frontend and Teach Lemmi — deployed

`anay/frontend-backend-integration` combines Emilia's `integration/frontend-backend` (`437f065`) with deployed-source `7debf9a`, retaining the deployed migrations, persistent keys, per-profile authority and chat/support hardening. It adds reviewed Teach Lemmi to the cookie-enrolled live participant shell and preserves the local caregiver/mock conversation UI. The tested build and exact generic artwork/font proxy allowlist are now installed; existing keys and all six migration files were preserved. Firmware was not flashed.

Completed Emilia's requested backend gate on an isolated worktree/PostgreSQL 17: **212 Bun tests / 3,991 expectations**, with all database suites enabled; **ten pairing-helper and seven speech Python tests**; type/Svelte, production build, formatting and whitespace passed. Dedicated migration/credential compatibility checks passed **10 tests / 74 expectations**; all six SQL files byte-match deployed source, and the conflicting old receipt migration is excluded. Production participant cookie/enrollment/concurrent-WSS/restart/release (including UI assets), persistent profile/media/support, TLS control/chat and six-second speech-output fixture smokes passed. These use fictional data, fixture providers/clients and simulated consumption; they do not establish physical browser/robot acceptance.

Fixed integration defects include preserving authoritative teaching policy on support-only saves, updating invitations on explicit support apply, fencing teaching while context saves are pending, preserving broader recognized Stop phrases, allowing only authorized fixed browser PCM while paused, suppressing late output on background pause, and exposing only the generic static art/font paths needed by the live shell. The build and explicit proxy allowlist are deployed; public voice remains explicitly enabled for fictional team testing. [Exact handoff and remaining gates](handoffs/frontend-backend-integration.md#backend-integration-follow-up--november-14-2026).

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
| Speech | Public speech is now explicitly enabled; a synthetic public local-STT → actual-OpenRouter → local-TTS turn passed (141 input frames / 421 output chunks), with simulated playback receipts. Actual browser microphone/speaker and K151 acceptance remain unrun. |
| Teach Lemmi | Deployed through `anay/frontend-backend-integration`; owner-only reviewed topics, model replies and Pause/Finish/Resume passed an actual public fictional rehearsal. |

The deployed migration set retains all existing checksummed migrations and includes `002_multi_profile_endpoints.sql` and replaces the branch's incompatible receipt-table creation with `004_endpoint_revocations.sql`. The latter preserves legacy revoke history while introducing per-device receipts; no checksum edit/rename of an already applied migration is permitted. The upgrade and unchanged-key acceptance are recorded in the deployment section below. The frontend/Teach candidate adds no new migration; its six SQL files byte-match this deployed set.

Frontend/robot integration entry point: [endpoint contract and quickstart](backend_api.md#deployed-endpoints--frontend-and-robot-contracts), [endpoint handoff](handoffs/anay-multi-profile-endpoints.md). The current running deployment is `f5724a0`; earlier candidate observations in this section are historical.

## Persistent credentials and chat support — deployed

Persistent enrollment and chat/support hardening are deployed together. Migrations `003_communication_support.sql` and `003_persistent_device_credentials.sql` have been applied in addition to existing `001`/`002`. Both full filenames are independently tracked/checksummed; no applied migration was renamed or edited. The proxy now allows the protected communication-support read/apply paths.

Run `python3 scripts/pair-stackchan.py` for a fresh persistent enrollment by default (`--short-lived` opts out). Stackchan must accept null claim/ready expiry and store its returned key privately. Existing short-lived keys are not upgraded. Persistent keys survive gateway restart; sessions, pending codes, capture and output do not. Successful revocation remains durable, and a lost claim response still requires revoke/re-enrollment. Firmware storage and real hardware acceptance remain Emilia's handoff. [Persistent contract](handoffs/anay-persistent-device-credentials.md), [chat/support handoff](handoffs/anay-chat-support-hardening.md).


## Deployment

**Historical branch evidence, before deployment:** `anay/chat-support-hardening` adds English chat hardening and caregiver support read/save/apply with central policy, immediate cancellation, explicit continuation and private PostgreSQL configuration provenance. It includes speech fix `3fb561d` and main `a6f7ff9`; neither existing feature branch nor the deployed host was modified by this work. Final live text regression passed 15/15 after a Quiet prompt mismatch was found and fixed. No microphone/speaker/K151 acceptance follows. See [handoff and test scope](handoffs/anay-chat-support-hardening.md); current host acceptance is recorded in the deployment follow-up below.

Public origin: **https://lemmi.chaoswarrior.dev**. Open **[/access](https://lemmi.chaoswarrior.dev/access)** to unlock the outer domain gate. `/` opens the gate-protected `/caregiver` landing page; `/participant/conversation` is the designed live companion screen. The shared access key is stored privately in the host's root `.env`; it does not replace caregiver authentication or device pairing.

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
| Python pairing helper | **10 fixture tests passed** in latest endpoint acceptance; later private provisioning is recorded separately below |
| Speech WSS fixtures | Six-second output/window/receipt smoke passed; playback simulated |
| Actual private speech engines | Earlier isolated CPU turns used a fixture LLM; later public synthetic speech used actual local STT, actual OpenRouter and local TTS (141 input frames / 421 output chunks), with simulated playback receipts. Neither is a human recognition-accuracy or hardware check |
| Public access boundary | Verified HTTPS unlock, secure cookie exchange/logout, missing-key/device rejection and internal/mock route denial |
| Hostname resolution | Earlier DNS issue cleared; normal system lookup and hostname-only verified HTTPS unlock passed during redeployment |
| Actual identity provider | VoidAuth code/PKCE login and introspection passed; tokens discarded |
| Actual model provider | OpenRouter fictional greeting passed; standalone request approximately 3.6 seconds; reply/credentials not logged |
| Public computer-device path | Persistent public claim with null expiry → actual gateway restart → same-key HTTPS profile/WSS, no restored active session → Start/model greeting/Pause/Resume/Stop passed; rehearsal credential revoked |

The live computer rehearsal created its pairing through the private authenticated server authority. It did **not** exercise a public caregiver-bearer pairing request; real caregiver verification was tested separately. No physical robot, microphone, camera, real contact or notification was used. Fixture tests remain distinct from these live observations.

## Remaining limits and next handoff

**Public speech enabled for fictional team testing:** the host now explicitly sets `LEMMI_SPEECH_ENABLED=1`. The deployed bounded capture/STT→chat→TTS/output path passed a synthetic public verified-WSS turn using the actual local engines and OpenRouter, with simulated consumption receipts. This configuration change does not deploy Teach Lemmi or prove browser/physical playback. Use the [remote voice test](handoffs/remote-voice-test.md); capture always requires explicit participant action. The fixed concern/refusal path keeps capture off and the session paused, with cancellation preserved.

1. **Speech:** synthetic English recognition has been intermittent. Human English quality, actual browser permissions/microphone/speaker, counterpart review and K151 local controls remain acceptance work. Music execution remains incomplete. No unattended-use or robot voice-readiness claim follows from the public synthetic test.
2. **Product work:** production caregiver browser OIDC sign-in/dashboard, full journal/summary, notification/outbox, preferences/deletion workflows, completed activities, camera and physical K151 acceptance remain pending as described in the [API inventory](backend_api.md) and team plan.
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


## Public speech enablement observation — November 14, 2026

On the existing `17a8522` runtime, the deployment owner enabled public speech in private host configuration. An actual synthetic public HTTPS/WSS rehearsal passed granted PCM capture → local STT → real OpenRouter → local TTS → bounded PCM output and simulated receipt consumption: **141 input frames / 421 output chunks**. This is an actual provider/transport observation, separate from candidate fixture checks. It does not establish human recognition quality, audible playback, microphone capture, browser permission/autoplay behavior, physical robot controls or a completed frontend/Teach deployment. No raw audio, transcript, generated reply or credential belongs in this record.


## Frontend/Teach deployment follow-up — November 14, 2026

Installed runtime **`f5724a0`**, containing both requested branches, on `backend-deploy`. Added a reviewed regression fix so finishing teaching while paused preserves pause until explicit Resume. Final isolated acceptance: **213 Bun tests / 4,045 expectations, zero skipped/failed**, type/Svelte, production build, formatting, ten helper and seven speech Python tests; built participant/assets/enrollment/concurrent-WSS/restart/release, persistent data/support, TLS control/chat and six-second bounded speech fixture smokes passed. The 49-file browser output secret scan passed. All six deployed migrations byte-match; no migration, reset or reseed was needed. A private database/source/build/config backup is retained in ignored `.data/releases`.

Actual public HTTPS/WSS checks passed existing shared persistent-key access, isolated fictional profile creation/enrollment, Start → Teach Gardening → actual model reply → Beaches → Pause → Finish remains paused → explicit Resume → Stop, with capture off and separate profile authority. Rehearsal enrollments and only their fictional profiles were removed. Host-admin SQL cleanup leaves in-memory rehearsal coordinators until restart; the gateway is restarted after cleanup before final availability checks. This is test cleanup, not an implemented participant deletion API. The shared key was preserved. Exact generic avatar/surface/font URLs return 200; caregiver/mock conversation/internal/README paths remain 404.

The user explicitly approved enabling `topic:gardening`, `topic:beaches` and `topic:banking` for fictional Alex; applied through the guarded profile update path, without biography facts or remembering permission. Newly created profiles still need their own approved interests; there is no unrestricted teaching fallback. Existing sessions affected by configuration require explicit Resume.

Remote team test: [voice and participant handoff](handoffs/remote-voice-test.md). Actual browser microphone/autoplay/speaker and K151 local controls remain unverified.

The post-install actual public voice recheck passed **138 input frames / 276 output chunks**, using local STT, the configured real OpenRouter model, local TTS and simulated consumed receipts, ending capture-off and stopped. Initial repeats closed with a persistence error because host-admin test cleanup had removed profiles while their coordinators were still resident; clearing those rehearsal coordinators by restarting the gateway resolved it. The final gateway restart after cleanup preserves keys and leaves sessions/capture/output stopped. All four user services are active with zero automatic restarts.
