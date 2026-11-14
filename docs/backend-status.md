# Lemmi backend status

Observed November 13, 2026 (America/Los_Angeles). Branch: `backend-deploy`.

Historical source-baseline deployment: **`04d050e`**, following the [merge verification handoff](handoffs/anay-backend-deploy-verification.md). Anay's newer `origin/backend-deploy` record (`8f158b2`) reports runtime **`f5724a0`**, integrating teaching and the broader frontend/backend work. This task tested the current live voice endpoint but did not inspect or redeploy the host. Earlier service/revision observations below describe the baseline; Anay owns the current shared-host record.

**Undeployed teaching increment, November 14:** `codex/teach-lemmi` adds user-authorized Teach Lemmi handlers to the existing coordinator, reviewed Alex topics, session-only feedback, a fifteen-minute active-time limit and a playable scripted local text demo. Existing OpenRouter/STT/TTS adapters and scoped device controls are reused; no new auth/database/deployment configuration. Local checks: type/Svelte and build passed; 132 automated tests passed, 18 database checks skipped, one existing Windows POSIX-file-permission assertion failed. Browser flow and synthetic device/speech checks passed; actual provider/hardware, durable teaching preference/journal observation and counterpart review remain pending. [Integration handoff](handoffs/lukas-teach-lemmi.md) and [tester manual](teach-lemmi-tester-manual.md) name exact interfaces/limits. This source branch does not alter the deployed revision above.

The implemented backend is deployed on `mobrob-Precision-3680`. This is a fictional Alex integration deployment, not completed P0 scope or readiness for unattended care.

Maintain this deployment/acceptance record alongside the [backend API reference](backend_api.md) whenever backend behavior, configuration, availability or observed checks change. Do not promote unrun checks to passed or treat a new source commit as deployed.

**Undeployed increment, November 14:** `anay/app-data-schema` reviews Emilia's `4e8993f` draft and promotes only corrected album/playlist metadata in migration `002_media_collections.sql`. PostgreSQL 14.24 upgrade/rollback and existing backend tests pass locally; no public API or shared/deployed database changed. Consent/journal/help/jobs/deletion/camera tables remain proposal-only. See [review, checks and next handoff](handoffs/anay-app-data-schema-review.md). The schema increment is now merged into `main` (`a6f7ff9`) and incorporated into `anay/speech-pipeline`; neither source merge changes the deployed revision recorded above.

## Undeployed multi-profile increment

Branch `anay/multi-profile-endpoints` builds on `anay/speech-pipeline` and adds isolated profile sessions, browser/robot handoff, persistent scoped enrollment, fictional profile creation/selection and a live participant frontend. See [integration handoff](handoffs/anay-multi-profile-endpoints.md). No deployment, physical firmware acceptance or real participant rollout is implied; the deployed revision below is unchanged. Local feature verification: 129 Bun tests / 2,310 expectations with isolated PostgreSQL, type/Svelte/build/format and production participant/control/chat/data/speech fixture smokes passed. Actual browser microphone/speaker and K151 checks remain unrun. Details are recorded in the handoff and build plan.

## Deployment

**Source-only voice-control continuity fix, November 14:** the live browser exposed `REVISION_CONFLICT: Speech turn canceled` for a teaching topic change. This branch reproduced spoken teaching controls canceling the input owner before their fixed TTS reply, and adds fresh current-generation active-session output authority after validated transitions. Local consecutive-turn, cancellation and actual scoped-gateway tests cover it. It has not been deployed by this task; Anay must review/integrate it into the current authority and record the deployed revision. The independent browser hands-free loop passed two approved ordinary live replies, with a fresh server grant per microphone turn. See [continuity handoff](handoffs/teach-lemmi-voice-continuity.md); do not treat that browser check as live acceptance of the new server fix.

Continuity verification: type/Svelte, build, changed-code format and whitespace passed; 158 automated tests passed, 18 database-dependent skipped and one existing Windows permission assertion failed. No credential/provider/deployment configuration or database migration changed.

**Later live browser rehearsal, November 14:** after Anay completed teaching deployment, the Alex access bundle advertised speech and teaching. One explicitly authorized fictional human microphone turn completed through STT/live AI/TTS/browser speaker; the user confirmed hearing the follow-up. Topic narration, capture-off unmute, Pause/keyboard Resume and Stop during new-topic speech preparation were exercised. The first playback run exposed the existing control-rate budget; batching only consumed progress every two PCM frames resolved the disconnect, with a regression test. This task did not redeploy the shared backend or inspect its final runtime revision. Physical Stackchan, broad human-speech/noise/German and complete acceptance remain pending; earlier “not yet teaching” probe results below describe the predeployment state.

Voice-client follow-up verification: 144 automated tests passed, 18 database-dependent skipped, one existing Windows POSIX-permission assertion failed. Type/Svelte and production build passed, as did changed-code formatting, whitespace, script syntax and browser-bundle credential checks. The later single-turn human voice rehearsal above passed after deployment; broader acceptance and Anay's shared-host record remain separate.

**Browser voice follow-up observation, November 14:** this branch adds a local browser microphone/PCM/speaker endpoint through a credential-bearing development-only proxy; no shared backend redeployment was performed here. The supplied Alex access bundle authenticated to the existing HTTPS/WSS backend and advertised audio; teaching was not yet advertised. Anay's newer `origin/backend-deploy` record reports runtime `17a8522`; this task did not independently inspect the host revision. Client schemas now match its nullable credential expiry, handoff control and optional active-endpoint metadata. Actual human voice/teaching acceptance still needs the teaching deployment. See [voice demo setup](teach-lemmi-voice-demo.md); earlier revision/service observations below are historical, not a claim that this task redeployed them.

For the undeployed teaching increment, changed-code formatting and whitespace checks passed; repository-wide formatting still reports 83 unchanged files. The deployed services below remain unchanged.

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
| Bun automated suite | **91 tests passed, 833 expectations**, including real isolated `lemmi_test` PostgreSQL |
| Production control/chat smoke | Passed with certificate-verified HTTPS/WSS and explicit identity/model fixtures |
| Production data smoke | Passed with real isolated PostgreSQL/private media and fixture identity |
| Python speech boundary suite | **7 tests passed**; fixture inference worker |
| Public access boundary | Verified HTTPS unlock, secure cookie exchange/logout, missing-key/device rejection and internal/mock route denial |
| Hostname resolution | Earlier DNS issue cleared; normal system lookup and hostname-only verified HTTPS unlock passed during redeployment |
| Actual identity provider | VoidAuth code/PKCE login and introspection passed; tokens discarded |
| Actual model provider | OpenRouter fictional greeting passed; standalone request approximately 3.6 seconds; reply/credentials not logged |
| Public computer-device path | Real persistent pairing authority → public HTTPS claim/profile → verified WSS Start → real model greeting → Pause → Resume → Stop passed; rehearsal credential revoked |

The live computer rehearsal created its pairing through the private authenticated server authority. It did **not** exercise a public caregiver-bearer pairing request; real caregiver verification was tested separately. No physical robot, microphone, camera, real contact or notification was used. Fixture tests remain distinct from these live observations.

## Remaining limits and next handoff

**Undeployed feature branch:** `anay/speech-pipeline` adds backend microphone grants, PCM ingestion, STT→chat→TTS and bounded output/receipt execution. See [feature protocol/handoff](handoffs/anay-speech-pipeline.md). Its local synthetic checks do not change the deployed revision or host acceptance below. A subsequent local fix gives recognized concern/refusal replies fresh fixed-output authority after pausing, keeps capture off and cancels on later controls/revisions. The new regression suite passes 116 Bun tests / 2,438 expectations against isolated PostgreSQL 17 plus seven Python boundary tests, type checks and production build. This fix is not deployed; physical playback and counterpart review remain pending. See the feature handoff and build-plan follow-up for validation details.

1. **Speech:** synthetic English recognition was intermittent. Engines are running privately, but integrated device/browser capture, STT-to-chat, speech/music playback and receipts are incomplete. No robot voice-readiness claim follows from engine startup.
2. **Product work:** production browser OIDC sign-in/participant text transport, full journal/summary, notification/outbox, preferences/deletion workflows, completed activities, camera and physical K151 acceptance remain pending as described in the [API inventory](backend_api.md) and team plan.
3. **Review:** Anay reviews access/storage/deployment changes; Emilia verifies real firmware headers, pairing and independent local controls. The remote merge-verification handoff reviewed this credential fix with a regression test. Actual firmware compatibility, broader shared-boundary counterpart review and reboot/network-failure rehearsal remain outstanding.

Operations, private provisioning and service commands: [host setup](host-setup.md). General deployment topology and acceptance checklist: [backend deployment](backend-deploy.md). Observed team acceptance record: [build and demo plan](build-and-demo-plan.md).

## Redeployment of `04d050e`

The handoff was inspected and the branch fast-forwarded from `51ede5e` after isolated verification on this host. The release fixes stale database gateway pairing/credential issuance: an old authority cannot replace the current boot marker when claiming credentials. No dependency or schema migration changes were required.

A fresh frozen-lockfile install, type/Svelte checks, 91 Bun tests / 833 expectations against isolated PostgreSQL 17, seven Python boundary tests, production build, formatting, and both production fixture smokes passed before the running services were changed. The verified build was installed, gateway/web restarted, and prior source/build retained privately under `.data/releases` for rollback. No database reset, caregiver reassignment or private-configuration replacement occurred.

After restart, public gate/cookie/logout/internal-route/device-denial checks passed. A fictional computer rehearsal passed real persistent pairing authority → public HTTPS claim/profile → verified WSS Start → actual OpenRouter greeting → Pause → Resume → Stop. Its temporary credential was revoked. As before, pairing creation used the private authenticated authority; this does not claim a public caregiver-bearer pairing request or hardware test. Web/gateway report active with zero automatic restarts; PostgreSQL remains healthy. The hostname now resolves normally and verified HTTPS `/access` returns 200 without an address override.

The default mock-web smoke, a new actual VoidAuth browser login, reboot recovery, speech recognition quality and physical hardware checks were not repeated during this redeployment. The fixture identity/model checks remain distinct from the actual tunnel/model observations. Restart invalidated earlier device credentials; re-pair before testing a physical client.
