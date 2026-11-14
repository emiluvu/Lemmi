# Anay → Kylie / Emilia: multiple profiles and endpoints

Feature branch: `anay/multi-profile-endpoints`, based on `anay/speech-pipeline` at `151ebc3`. Worktree: `/tmp/lemmi-multi-profile-endpoints`. The shared checkout, main, backend-deploy and running deployment are unchanged. This extends the user-authorized demo beyond the earlier Alex-only scope. Existing preview cards remain static and cannot become live sessions.

## Run and integrate

Use pinned Bun 1.4.4, the existing frozen lockfile and existing PostgreSQL/private-media setup. Apply migrations before starting this version. Migration 002 preserves existing profiles/media, adds independent profile/device scope and a separate gateway epoch; migration 003 stores bounded revocation retry receipts containing IDs only. Do not run schema changes against a shared host before the corresponding release is ready.

```sh
bun install --frozen-lockfile
bun run db:migrate
bun run db:bootstrap
bun run check
bun run test
bun run build
# Start gateway and web separately with the existing private live configuration:
LEMMI_MODE=live LEMMI_DEMO_ENROLLMENT=1 bun run start:gateway
LEMMI_MODE=live LEMMI_DEMO_ENROLLMENT=1 HOST=127.0.0.1 PORT=3000 bun run start:web
```

`ORIGIN` and `LEMMI_PUBLIC_ORIGIN` must match the same HTTPS origin. PostgreSQL, `LEMMI_PRIVATE_MEDIA_DIR`, `LEMMI_CAREGIVER_SUBJECT`, independent `LEMMI_CONTROL_TOKEN` and `LEMMI_ACCESS_KEY` remain private configuration. Demo setup does not require copying an OIDC token into every endpoint. Managed caregiver APIs still verify their own identity and profile membership. Use the existing optional OpenRouter and local speech configuration to enable those services; configuration is not proof of their availability.

The explicitly enabled demo setup grants access only to records marked `is_demo` and assigned to the configured caregiver subject. It is for fictional team integration data. It cannot authorize caregiver biography edits, private guidance, contacts, journals or camera consent. A future real-participant enrollment flow needs its own authorized setup; do not insert private care data through the demo profile selector.

Proxy `/access`, `/participant`, `/_app/*`, `/v1/demo/{profiles,enroll,current,release}`, supported resource routes and WSS `/v1/device-stream`. The updated deployment-guide example shows the route changes. Preserve Cookie and Origin headers. Internal gateway/data/speech/database routes remain private; browser mutations and cookie-authenticated WSS require the configured Origin. The default loopback mock starter is unchanged.

## Browser setup and shared client

Open `/access`, enter the private demo key, then open `/participant`. Choose Alex or create/select another fictional participant. Enrollment stores a 30-day, scoped `__Host-lemmi_endpoint` cookie with Secure/HttpOnly/SameSite=Strict attributes. No bearer token is returned to browser JavaScript. The current assignment is recovered on reload/restart. Each browser cookie context has one endpoint connection; use separate browser profiles/contexts for independent participant instances. Multiple tabs in the same cookie context do not represent independently enrolled devices.

Exports from `@lemmi/contracts`:

- `createParticipantSetup(fetcher?)`: `profiles()`, `create(preferredName)`, `current()`, `enroll(profileId)`, `release()`.
- `ParticipantConnection`: validated protocol-v1 WSS client, heartbeats, transient current snapshot, local close, stale-connection rejection. Cookie transport uses no URL credentials.
- `ParticipantEndpointSchema`, `ParticipantEnrollmentSchema` and request/response schemas support frontend and provisioning integrations.

The frontend shows the selected participant, connection and session state, text conversation and control actions. Its browser speech adapter uses explicit Speak/Finish controls, a server capture grant, bounded 16 kHz mono PCM frames and negotiated output receipts. Browser permission, autoplay, actual microphone quality, speaker playback, keyboard/zoom and physical device checks remain acceptance work; mocked/transport checks do not establish those results. Camera stays off and unavailable. Unsupported activities/help providers retain their explicit unavailable behavior.

“Change participant” cancels local input/output, closes the socket, releases that enrollment and clears the previous view. New profiles start with their own empty context rather than a copy of Alex’s biography. Existing approved data can be edited only through the scoped caregiver resource APIs.

## Public setup routes

All responses use the existing `{ok,data}` / `{ok:false,error}` envelope, are no-store and require the private gate plus explicit demo enrollment. Setup mutations require the configured Origin, or the private header for native provisioning. The server derives the caregiver assignment; callers cannot supply an actor or private fields.

| Route | Input | Result |
| --- | --- | --- |
| `GET /v1/demo/profiles` | None | Array of participant-safe fictional profiles |
| `POST /v1/demo/profiles` | `{preferredName, avatarId?}` | New participant-safe profile with a distinct ID |
| `POST /v1/demo/enroll` | `{profileId, endpoint:'browser'|'robot'}` | Browser: safe metadata plus HttpOnly cookie. Robot: metadata and scoped credential returned once |
| `GET /v1/demo/current` | Browser cookie | Safe endpoint metadata and participant-safe profile |
| `POST /v1/demo/release` | `{}` plus browser cookie | Revocation of that browser enrollment and cookie removal |

`POST /internal/demo` is the independently authenticated SvelteKit-to-gateway seam. Its operations are `profile.list`, `profile.create` with nested `input`, `endpoint.enroll`, `endpoint.current`, `endpoint.release`; this route must never be exposed publicly. Browser current/release enforce endpoint kind. Standard caregiver profile/assets/pair/revoke resource routes now authorize their specific profile/device rather than hardcoding Alex.

## Robot setup

With the private origin/key configured, run:

```sh
bun run enroll-device profile-alex .data/alex-robot.json
# Use the new profile ID returned by profile creation for another participant:
bun run enroll-device PROFILE_ID .data/other-robot.json
```

The helper writes a mode-0600 private configuration and reuses that file on later runs. It does not print credentials. Each physical robot needs its own enrollment file/device identity. Keep it outside firmware source and browser bundles, transfer it through the device’s protected provisioning mechanism, and preserve it in non-application storage through normal firmware flashes where supported. A full erase still needs provisioning again. Actual K151 storage/flash behavior is Emilia’s integration work and has not been tested here.

Native WSS sends the existing outer `X-Lemmi-Access-Key` and separate `Authorization: Bearer <scoped credential>` headers. TLS verification remains enabled. Browser credentials use cookies. `device.hello.payload.endpoint` is optional for legacy robot clients; supplied values must match authenticated enrollment.

## Session ownership and cancellation

`SessionRegistry` owns one existing `SessionCoordinator` per authorized profile inside the same gateway. Distinct profiles run independent sessions/conversation histories/revisions and can connect concurrently. One profile retains a single active session and one active audio endpoint. `SessionSnapshot.activeEndpointId` identifies the owner; `endpoint` remains `browser` or `robot`.

- `input.start` still uses null session/generation zero and starts explicitly. A second endpoint learns an existing session from its hello snapshot.
- `input.handoff` has `{}` payload and current session/generation. It pauses/cancels pending work, rotates the audio lease and assigns the caller as active endpoint. Explicit Resume returns to capture-off ready; handoff never starts listening.
- Only the active endpoint submits conversation/media, receipts, resume and microphone changes. Other assigned endpoints may observe safe state and send Stop/Pause/Help or request handoff. Replies/media are delivered only to their submitting/owning endpoint.
- Each device has one atomic connection reservation. Duplicate connections conflict; other devices connect independently. Observer disconnect/revocation does not pause or cancel the owner. Owner disconnect/watchdog pauses its own profile; active endpoint revocation ends that profile’s session. Late work is rejected by session/generation/lease/revision checks.
- Shared local speech adapters use one bounded FIFO (eight waiting jobs) across STT/TTS. Canceling queued work removes it immediately; canceling one participant does not cancel another. An uncooperative native request retains its slot until settlement. Over-capacity work fails explicitly without an unbounded queue or cloud fallback.

## Restart and limits

Database-backed enrollment hashes survive normal gateway restarts until expiry/revocation. Demo enrollment lasts 30 days; the existing short-code claim credentials retain their one-hour lifetime. Restarts end unfinished sessions and clear pairing codes, dialogue, grants and output. Reconnect requires explicit session start; capture/playback never restores automatically. Without PostgreSQL, the old explicit mock/test credential path remains ephemeral and the demo selector is unavailable.

Bounds: 100 profiles, 1,000 persisted endpoint records, 200 simultaneous gateway reservations, existing per-profile session/event/command limits and 10,000 durable revocation receipts. At receipt capacity, fresh credential issuance is disabled while revocation remains available. These are integration bounds, not a measured host capacity guarantee. Expired/revoked records require future lifecycle/cleanup tooling; do not repeatedly enroll instead of reusing saved assignments.

## Verification and remaining handoffs

Observed: 129 Bun tests / 2,310 expectations with isolated PostgreSQL, type/Svelte checks (0 errors/warnings), production build, formatting/whitespace and production participant/control/chat/data/speech fixture smokes passed. Concurrency tests also passed ten repeated runs (70 tests / 1,100 expectations). See the build plan/backend status for scope and earlier fixed failures. Run `LEMMI_TEST_DATABASE_URL=... bun run smoke:participant` against a dedicated database ending in `_test` after a production build. It creates fictional profiles, exercises actual SvelteKit HTTP cookie setup, verified concurrent browser/robot TLS/WSS, isolated fixture chat, restart assignment and release. It does not access the running deployment or external model/notification services.

Kylie should integrate the exported clients and participant components with the full UI and verify keyboard/zoom/errors. Emilia should store enrollment privately, consume ownership/handoff and verify local Stop/mute/watchdog plus actual PCM/playback on K151. Anay should review auth/persistence changes, then explicitly integrate/deploy the branch with migrations/proxy updates. Complete activities, durable contact/journal/policy/deletion flows and actual participant/hardware readiness remain separate unfinished scope.
