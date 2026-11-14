# Lemmi — Build and demo plan

Use the [shared task board](tasks.md) for daily checkboxes, current blockers and agent file claims. This document retains detailed ownership, milestones and observed acceptance results.

**Status:** Shared mock starter implemented; named feature work and live/hardware acceptance pending
**Version:** 0.6  
**Updated:** November 13, 2026  
**Scope:** Hackathon prototype; optional supervised live demo with Grandma

This plan supersedes the earlier CS 1/CS 2/Engineer 3/Engineer 4 split. It implements the [product](product-spec.md), [experience](experience-spec.md), [safety/privacy](safety-and-privacy.md), [technical](technical-spec.md), and [integration contracts](integration-contracts.md). Event hours and team availability are unknown: replace relative blocks with actual times at kickoff. Only the starter evidence explicitly recorded below is implemented/checked. The remaining plan does not establish live infrastructure or product safeguards.

## Demo profile scope

The demo implements one functional fictional profile, Alex, end to end. Additional fictional profile cards may illustrate the caregiver dashboard, but must be labeled **Example profile — preview only**. They do not open live participant sessions, write journals/preferences, receive notifications, pair devices or request camera access. They have no real contacts or private data. A preview may open clearly labeled static detail content; it must never reuse Alex’s live data or credentials under another name. Multi-profile management and switching are outside this demo. Keep live APIs resource-scoped and reject unassigned/example profile IDs; isolated authorization fixtures do not require a second functional profile.

## Starter handoff — November 13, 2026

The initial workspace is implemented; each teammate can clone and run it now using [team-start.md](team-start.md). Do not wait for Anay to recreate the starter. Runtime schemas/client seams, bounded in-memory mock authority, local gateway/fake-device path and a music transition example exist. Type/Svelte checks and the Bun production build have passed. Contract/coordinator/HTTP/WebSocket tests cover the starter subset; see the guide and test files for scope. Full M0 counterpart agreement and M1/M2 live/hardware checks remain pending. No acceptance row below is upgraded to full completion by a mock result.

Start separate feature branches from the shared starter commit. Anay owns subsequent root/tooling/contracts changes; others work in their named slices and request exact missing exports. The initial UI is a disposable development shell for Kylie to evolve; the music example is Lukas’s starting point, not a completed playlist/content implementation.

## 1. Named ownership and boundaries

| Person | Primary ownership | Deliverables | Main counterpart |
| --- | --- | --- | --- |
| Anay | Backend API, local speech, database and server integration | Bun/SvelteKit HTTP routes, realtime gateway/session authority, STT/TTS processes, external LLM, auth/profile/contact/journal services, PostgreSQL/private media, worker/deployment, contracts/mocks | Emilia for device wire protocol; Lukas for activity hosting; Kylie for HTTP/UI clients |
| Emilia | Stackchan firmware and device experience | Audio/local controls/WSS/mascot; F13 camera request/Allow/stream/Stop first; then F14 top-strip petting, bounded reactions/motion, status cues and device health | Anay for gateway; Kylie for compatible art exports |
| Kylie | Art, UI design and frontend | SvelteKit participant/caregiver pages, navigation, shared controls, browser audio/fallback, profile/contact/journal screens, activity visuals on Lukas's logic, source assets/tokens | Lukas for ActivityView/actions; Anay for services; Emilia for robot art |
| Lukas | Activity implementation and demo planning | Music playlist, gentle 20 questions, photo album talk and object matching; shared content eligibility and item-retirement proposals; pure logic/view projections/content, deterministic checks, supervised demo coordination with Grandma and fallback | Kylie for presentation; Anay for orchestration/storage; Emilia for playback capability |

Anay owns session and server authority; Emilia owns immediate device enforcement. Lukas owns game rules, not another server. Kylie owns views, not duplicate game or authentication logic. Anay owns journal/summary/contact backend while Kylie owns their screens. Initial summary failure must not block the factual journal.

TurtleBot is deferred for this iteration unless the whole team later reassigns ownership after the core works. The previous CS 1 assignment is superseded. Do not presume that Emilia or Anay should absorb navigation on top of this new split.

## 2. Build order and checkpoints

**Added priority:** Implement F13 camera check-ins (earlier recommendation #2) before F14 petting/reactions/status/health (earlier #1). Both are committed. Follow [robot-capabilities-spec.md](robot-capabilities-spec.md) for exact flow, schemas and gates. Foundational pairing, security, local stop and capture indicators precede camera. Audio/activity work may proceed alongside it; camera must pass its secure end-to-end gate before F14 polish.

First complete slice: fictional profile → robot connection and one voice turn → music play/pause → typed activity event in journal → manual caregiver request and acknowledgment. Music is first because it exercises content, UI, media transport, controls, and events without waiting for complex game logic. Complete target: all four activities, real approved contact routing, caregiver controls, app fallback, F13/F14, F15 growing preferences/F16 matching, F17 Teach Lemmi conversation mode, and required failure/privacy checks. Approved scene exploration reuses photo album talk; solitaire is last stretch.

Reserve the final quarter of available time for integration/fixes/rehearsal/submission. First integration happens well before this block. A thin milestone is not proof that every P0 criterion is complete.

### Milestones and capacity check

- **M0 — Shared foundation:** running scaffold, schemas/mock clients, one music view, fake device and proposed protocol fixtures. This unblocks parallel work; it is not a completed product.
- **M1 — First integrated slice:** Alex → real voice turn → music play/pause → factual journal event → real opted-in caregiver request and acknowledgment, with local Stop and browser fallback. This proves integration, not full P0 completion.
- **M2 — Committed completion:** all four activities, communication presets, preference policy, teaching, approved scene packs, caregiver overview, F13 then F14, and the required access/privacy/failure checks. Do not relabel uncompleted criteria as passed because M1 works.
- **M3 — Freeze and rehearsal:** final quarter of available time, two full rehearsals, recovery/submission notes and explicit live/mock/unmet status.

At kickoff Lukas records actual event hours and each person’s availability; each owner estimates their next slices and dependencies. Reassess after M0, M1 and hardware/notification gates. If the committed target cannot fit, record the unmet items and a proposed scope change for the team/user; do not silently drop features or spend the freeze on new architecture. No duration in this plan guarantees feasibility.

| Block / gate | Anay | Emilia | Kylie | Lukas | Exit evidence |
| --- | --- | --- | --- | --- | --- |
| Kickoff, first 45–60 min | Scaffold minimal workspace/contracts/mocks and choose local host candidate | Inspect firmware/toolchain, report audio/control/display capabilities | Agree routes/tokens and mascot export constraints | Confirm activity IDs/actions, demo availability and private rehearsal plan | Everyone runs one starter path; v1 schemas/sample messages agreed; missing choices recorded |
| Foundation, next work block | Fake device, minimal gateway/API, local STT/TTS readiness, PostgreSQL, early notification test | One official hardware example, local mute/stop, WSS hello, bounded audio | Layout and one music view from a mock; static mascot state sheet | Pure music state/actions/events and a tiny approved playlist | No separate projects; mocked UI uses the same contracts as live services; host/network blocker known |
| Camera gate — before F14 polish; beside audio/music slice | Validated check-in schemas/mocks, authorized request/end, relay, session pause and expiry | Official camera + input/display test, local Allow/decline/Stop/deadline, bounded real frames | Permission settings, request/viewer and participant notices from mocks then live | External pause/resume fixtures for all activities; consenting teammate demo scene | Authorized viewer sees fresh real frames; unauthorized/no Allow/stale/reconnect paths fail closed; no frame storage; all results recorded |
| Preference foundation — before matching integration | F15 memory permission, canonical IDs/policy/client/mocks, storage/forget and cancellation | Consume profile/policy revisions; no firmware memory store | Interests & boundaries/feedback UI from mocks | Reviewed matching pack, pure reducer, first/later uncertainty fixtures | One functional profile; preview IDs cannot access live operations; explicit refusal enforced; excerpt-off structured memory and session-only mode distinguished |
| First vertical slice | Wire session/speech, activity host, journal write, help worker | Real audio round trip, playback receipt, stop/watchdog | Show real state/events/contact status; browser fallback starts | Exercise music transitions through same reducer; inspect events | A teammate completes the first slice; distinguish live/mock and actual failures |
| Feature completion — F14 follows passed camera gate | Health schema/ingestion after F13; implement local data/privacy, secure caregiver/profile/media/contact/journal endpoints, external LLM/summary integration | Mascot conversion, stable controls/handoff; local petting, restrained motion/LED cues and measured telemetry after F13 | All participant/caregiver screens and four ActivityView renderers | Photo album then bounded guessing tree, then matching through shared eligibility; content/retired/missing-asset cases | All four activity logic/UI paths integrated; no hidden success fallbacks |
| Reliability and rehearsal | Real send/ack/failure/backup, deletion races, host restart/laptop fallback | Disconnect/reboot/late audio/mute while speaking or music | Keyboard/zoom/error states; source labels; private/public views | Run full script, Grandma's private optional rehearsal, teammate fallback | Required checks observed, not merely specified; clear go/no-go for public participation |
| Final-quarter freeze | Fix critical issues, document actual run commands/versions and submission | Freeze tested firmware and provide recovery steps | Freeze assets/layout and projection plan | Lead two complete rehearsals and submission checklist | No new architecture/features; repeatable honest demo and fallback |

Anay has the broadest foundational workload. His first handoff is the runnable starter, shared validation/error envelopes, mock-client seams and one end-to-end fixture, before completing all backend services. Emilia supplies device/control/camera fixture examples, Lukas supplies activity/context/system-input/receipt and eligibility examples, and Kylie supplies required view/error/preview states. Anay owns canonical schema edits; counterparts review and exercise their fixtures. Record missing exports and the responsible owner. Unblock the others with thin contracts and mocks first; do not finish every service before sharing a starter. Kylie and Lukas integrate a mocked activity together while Emilia uses a fake gateway. Anay can stub model/summary output explicitly for scaffolding, but must prove real voice/contact before those are presented as working.

## 3. Freeze the handoffs before parallel implementation

Use [integration-contracts.md](integration-contracts.md) as the canonical small shared reference. At kickoff, validate and publish these examples as test fixtures:

- One participant-safe profile, one caregiver-only projection, one session snapshot.
- A device hello/control/audio message and matching server acknowledgment/state event.
- Camera capability, request/Allow/decline/active/end snapshots, bounded frame envelope, expiry/revocation/stale fixtures, plus `device.health` and `pet_ack` handoffs from the robot capability spec.
- One ActivityView and action/result for each of `music_playlist`, `twenty_questions`, `photo_album`, `object_matching`, plus profile preference/eligibility and uncertainty-retirement fixtures.
- One journal session with typed sources, one no-summary response, one failed write.
- Help states for sending, acceptance, delivery unknown, delivery, acknowledgment, failed/no-response, and isolated simulation.
- Asset manifest covering IDs/version, approved source/permissions, captions, robot export size/format and playback format.

Anay owns root scripts/dependencies/migrations and server exports; Kylie owns layout/routes outside `/v1`; Lukas owns activity package/content; Emilia owns firmware/device fixtures. Agree exact file ownership before concurrent edits. No two people should independently implement the same session store, backend, protocol, reducer, audio controller, or error schema.

Use one fictional fixture: Alex, gardening interest, approved fictional context, generic album, and verified opted-in teammate contact destinations configured privately. Never commit those destinations, credentials, Grandma's private biography, or actual family photos without separate permission.

## 4. Definition of a handoff

Each task ends with: changed files, public exports/events, mock/live status, actual run/check commands, observed result, known limitations, and the next counterpart task. Do not claim unrun tests passed or that the docs' proposed folders already exist.

Feature work uses one flow at a time. Keep a short issue list by owner rather than silently inventing missing APIs. Routine local decisions proceed within scope; shared-contract changes update mocks/consumers together. Reuse existing scaffold and package versions. Pin compatible versions after feasibility, not through guesses in planning prose.

Review split: Anay reviews authorization/data/notification work; Emilia reviews local device behavior; Lukas reviews activity transitions; Kylie reviews UI/art/accessibility. Cross-boundary changes receive counterpart review. Local hardware behavior requires a real device check, not only simulated events. Meaningful automated checks cover stale messages, revisions, deduplication, deletion, and pure activity transitions; inspect reversible visual/content changes directly rather than writing tests that duplicate implementation.

## 5. Individual Codex briefs

These prompts are implementation entry points after the relevant foundation exists. Keep them in the same repository/spec context, inspect current files, and do not recreate the project if another teammate already scaffolded it. Each person can use small follow-up tasks within their slice.

### Anay — backend, speech, database and integration

**Own:** SvelteKit `/v1` HTTP/server routes, shared server-only modules, Bun realtime gateway, session state, local STT/TTS processes, external LLM, PostgreSQL/private media, auth, profile/contact/journal APIs, summary generation/persistence, durable worker, server/network deployment, shared contracts and mocks. Read technical, safety, integration, and product specifications first.

**Added F15/F16 responsibility:** Anay owns profile-isolated remembering permission, structured preferences/item policies, validated signals, global eligibility and forget/revision cancellation. Publish the shared client/mocks before matching integration. Follow [personalization-and-matching-spec.md](personalization-and-matching-spec.md); never persist raw speech or let a model edit biography.

**First tasks:** (1) Minimal shared workspace/types/stubs/run instructions; (2) fake device/session path and CheckInClient schemas/mocks with Emilia/Kylie; (3) authorized F13 request/relay/end/expiry plus audio cancellation and local speech/notification readiness in parallel; (4) host Lukas's pure music engine and persist one event; (5) complete data/privacy APIs, then F14 telemetry ingestion after camera gate. Do not take over the activity UI, art, or firmware while doing this.

**Checks:** Camera ownership/local Allow, single-viewer access, fresh-frame bounds, expiry/revocation/restart and no image retention; explicit activity resume; then telemetry validation. Real local STT → external LLM → local TTS; scoped access; revision/cancellation; duplicate/expired requests; verified acknowledgment; no transcript/audio logs; deletion/reload; host/laptop fallback. Share measured host/model/voice versions and loopback service configuration. Keep manual help independent of the LLM, game reducer, and journal saving.

> Implement Anay's Lemmi backend/speech/database slice from the current specs and integration contracts. Include F17 teaching conversation-mode snapshots/commands, approved scene packs, caregiver overview composition and concern-routing fixtures per integration section 11 and safety section 15; no new model/backend or transcript retention. Include F15/F16 in docs/personalization-and-matching-spec.md: shared topic/entity IDs, scoped memory permission and policy client/mocks, global eligibility, bounded signals and retirement, forget/deletion and stale-policy output checks. Excerpts off permits only separately agreed structured preference state, never utterances or biography auto-writes. Inspect existing code first. Use Bun + SvelteKit for HTTP routes, one Bun realtime session gateway, local PostgreSQL/private media and local STT/TTS on the selected team server; the LLM stays external. First deliver the smallest runnable workspace, runtime-validated contracts, sample fixtures, typed mock/real client seams and fake device so the team is unblocked. Include CheckInClient and camera snapshots from docs/robot-capabilities-spec.md; implement F13 scoped request/relay/expiry/revocation and audio/activity cancellation before F14 telemetry polish. Camera images never reach the LLM, journal, logs or durable storage. Agree device events with Emilia and ActivityView/reducer/effects with Lukas/Kylie before changing them. Host Lukas's activity logic instead of recreating it. Build durable verified caregiver contact, journal/privacy/deletion and authorization incrementally with meaningful failure checks. Keep provider keys, contact details and server-only modules out of browser/firmware bundles. Report actual checks, unresolved assumptions, exports and next handoffs after every slice. Do not invent completed infrastructure, take over the other teammates' slices, or begin billing/marketplace/TurtleBot.

### Emilia — Stackchan firmware, camera first, then local reactions

**Own:** K151 firmware, WSS client, negotiated audio frames, playback/control receipts, local mute/unmute/stop, capture indicator, watchdog/reconnect, mascot conversion/rendering; **F13 camera check-ins before F14 top-strip petting, restrained expressions/head motion, readable status/LED cues and device health**. Read [robot-capabilities-spec.md](robot-capabilities-spec.md) before adding these features. Read device/audio contracts, experience states, and safety rules. Anay owns the server gateway and speech models; Kylie supplies art.

**First tasks:** (1) Record installed firmware/toolchain; test camera/display/touch together and establish local Stop; (2) hello/heartbeat and camera request/Allow/decline/Stop against Anay's fake gateway; (3) bounded real F13 frames, visible notice, local deadline/watchdog and end-to-end secure camera gate with Anay/Kylie; (4) audio round trip/mute/mascot work alongside the camera path, preserving immediate controls; (5) after the camera gate, add debounced top-strip petting, static reactions first, restrained motion after release, LED cues and measured telemetry. Share format/memory/input constraints with Anay/Kylie early. No simultaneous video and speech in this first version.

**Added F15/F16 responsibility:** Consume authoritative profile/policy revisions, clear stale topic audio/views on change, and expose matching actions only if robot choices are usable; otherwise use explicit app assistance. No local preference inference/store or object recognition. Preserve F13-before-F14 ordering.

**Checks:** Camera stays off without current local Allow; Stop camera/global Stop/help/expiry/disconnect/revocation clear capture and buffers; late starts/frames cannot reopen; indicators and inputs remain responsive under camera load. Petting cannot authorize capture or dismiss help; motion-off/reduced-motion works; telemetry shows measured values. Mute locally stops transmission; unmute alone never begins capture; stop invalidates queued speech/music; late frames cannot resume; watchdog/reboot capture-off; same session handoff; one speaker. Robot may connect to the backend without an open app browser. Support the app's shared session, not an additional robot backend. Confirm music formats before promising robot-only playlists.

> Implement Emilia's K151 firmware/device slice. Consume F17 teaching-mode snapshots and eligible prompt assets; emit shared next/not-sure/finish actions where usable, preserve camera/stop/revision cancellation and use app assistance for unreadable choices. Follow F15/F16 in docs/personalization-and-matching-spec.md for profile/policy revision cancellation and matching controls or larger-screen handoff; never infer/store preferences in firmware. Inspect the actual hardware/toolchain and read the technical, safety, experience and integration docs. Coordinate wire protocol, pairing, sample messages and frame format with Anay before building a competing endpoint. Follow docs/robot-capabilities-spec.md: after foundational local Stop/pairing, prioritize F13 camera request/local Allow/bounded stream/Stop/expiry through Anay's gateway before F14 petting, restrained reactions/motion, LED cues and device health. Test official camera initialization with touch/display and share measured limits. Keep camera off by default, separate from mic mute, without recording or automatic reopening; camera pauses audio and activities. Build the audio round trip alongside this using the same session. Never substitute the factory mobile app for the authorized Lemmi flow. Enforce mute/stop/watchdog locally before network acknowledgment; unmute only clears mute and still requires a valid listening state. Do not run STT/TTS/LLM on the ESP32 or put server/provider secrets on it. Consume Kylie's agreed mascot exports; begin with static state faces and preserve local-control responsiveness. Produce observed hardware checks, exact firmware/tool versions, recovery instructions and unsupported capabilities. No automatic restart, audio backlog, unsupervised movement, or duplicate app/robot audio.

### Kylie — art, design and complete frontend

**Own:** F13 caregiver permission/check-in viewer and participant camera notices, then F14 petting art/status/device-health views; participant and protected caregiver SvelteKit views, layouts/navigation, shared controls/tokens, mascot source art/exports, browser audio controls, profile/contact/journal interfaces, and visuals for Lukas's four activities. Anay owns auth enforcement/data services; Lukas owns activity rules. Read [Kylie’s design and UI guide](kylie-design-guide.md), experience, integration, and safety specs first. The guide inventories participant/caregiver pages, robot modes, state panels and a time-boxed inspiration workflow.

**First tasks:** Include mock-backed camera settings/viewer and local request/active/ended notices immediately after minimal shared controls; integrate these with Anay/Emilia before petting art/motion polish. (1) Agree device asset constraints with Emilia, page routes with Anay and ActivityView with Lukas; collect 6–9 annotated inspiration references and choose one coherent direction; (2) establish readable design tokens/shared controls and music view using Anay's mocks; (3) participant home/conversation/status and caregiver profile/contact routes; (4) photo/guessing views, journal/source/review screens; (5) replace mocks with real clients and inspect failures/accessibility. The five identities are dog, cat, bunny, bird and lemming. Sketch five chooser thumbnails, validate one full six-state set with Emilia, then export the remaining four (30 static state frames total). Do not block logic on polished art or animation.

**Added F15/F16 responsibility:** Build `/participant/activities/matching`, participant topic feedback, and Profile Interests & boundaries with remembering/forget/edit/undo and source labels. No failure tally or ability charts. Use Anay's client and Lukas's matching view. See the personalization spec and Kylie guide for states.

**Checks:** UI renders authoritative ActivityView, no game rules copied into components; local pending UI is explicit; user-initiated music/browser permissions; pause/stop/help in every activity; distinct real/simulation/delivery/ack states; private caregiver data never preloaded into participant payloads; no-summary/error/revision-conflict states; zoom/keyboard/contrast. Work with Anay on authorization checks rather than treating a hidden link as security.

> Implement Kylie's art/design/frontend slice using the existing Bun + SvelteKit starter and shared client/contracts. Follow design-guide section 12: Teach Lemmi entry/panel in conversation, Explore pictures within photos, source-linked caregiver overview cards and optional factual duration charts; solitaire is last stretch, not a core screen. Include F15/F16 in docs/personalization-and-matching-spec.md: participant topic feedback, Profile Interests & boundaries/remembering/forget controls, and matching page from Lukas's view, with no clinical or failure scores. Read docs/kylie-design-guide.md, experience, integration and safety docs. Guide the inspiration pass with actual source links when browsing, then map participant/caregiver pages and reusable error/paused/empty states. Use exactly dog, cat, bunny, bird and lemming; validate one complete static state set with Emilia before exporting all five. First create readable shared controls/design tokens, static mascot exports agreed with Emilia, and a music view using explicit mocks. Render Lukas's ActivityView/actions rather than implementing game transitions or a separate session store. Build participant home/conversation/activities and protected caregiver profile/contact/journal screens in small runnable increments. Implement F13 camera permissions, /caregiver/check-in and participant/robot request/active/ended panels from CheckInClient before F14 petting polish; show freshness/expiry/Stop and never open camera on page load. Add measured device-health freshness to Overview/Settings. Follow docs/robot-capabilities-spec.md and keep camera state separate from mic mute. Anay supplies real auth/data/API services and Lukas supplies logic/content; report missing exports instead of creating another backend. Handle failures, optional summary/excerpts, source labels, audio ownership and browser permissions truthfully. Inspect actual layouts, keyboard and zoom. Do not expose private caregiver data in participant page loads, silently fake live success, or add billing/marketplace screens.

### Lukas — activity logic, content and supervised demo

**Own:** Activity pause/resume integration for F13 camera check-ins and supervised camera-demo planning; pure activity create/reduce/project functions, versioned reviewed content/manifests, music playlist/20 questions/photo album behavior, deterministic transition checks, demo script/rehearsal, Grandma coordination and teammate fallback. Kylie renders; Anay hosts/persists/routes model effects; Emilia provides output capability.

**First tasks:** (1) Freeze activity IDs/view/actions with Kylie/Anay; (2) deterministic music engine and approved sample tracks; (3) album selection/next/previous/just-look/talk effects; (4) reviewed guessing question tree with not-sure/skip/reveal; (5) add object matching against shared eligibility/retirement fixtures and integrate all four through the same path; (6) coordinate private voluntary rehearsal and final script. Choose reusable generic/fictional media early and document permissions. No external music-account integration is required.

**Added F15/F16 responsibility:** Implement `object_matching` after the existing activity paths, with approved visible image pairs and shared canonical tags. First explicit uncertainty hides the object this session; second distinct later occasion proposes retirement via Anay. No reattempt/automatic retest, wrong-tap inference or direct database write. Apply authoritative eligibility across activity content; all-ineligible content exits gracefully.

**Checks:** All four activities pause without progression during camera, invalidate pending talk/audio, preserve position and require explicit Resume afterward; pets cannot advance games. Pure reducers perform no I/O, clocks/randomness injected if used; no duplicate progression on retry; media requests differ from actual playback receipts; guessing accepts uncertainty without scoring or pressure; photo changes invalidate stale talk; leave/pause/stop predictable. Game answers never become clinical metrics. “20 questions” defaults to Lemmi asking yes/no about a chosen visible object/picture; review suitability individually rather than claiming a treatment effect.

> Implement Lukas's reviewed built-in activities and demo plan from the shared specs. Supply reviewed simple object/topic invitations for F17 Teach Lemmi and approved scene packs; Anay hosts teaching through conversation, without a fifth reducer. Add no-correction/skip/retirement/camera interruption fixtures; solitaire stays last stretch. Include F16 object_matching and shared F15 eligibility from docs/personalization-and-matching-spec.md: pure picture-pair reducer, canonical object IDs, uncertainty proposals, no repeats/retests or score, graceful all-retired exit. Anay commits policy; consume it across all activities. Start with pure typed createActivity/reduceActivity/projectActivity functions and deterministic music fixtures; no HTTP server, database, microphone code, or direct LLM calls. Return safe views, factual event proposals and allowlisted effect requests for Anay to execute after session checks. Coordinate exact view/actions with Kylie so frontend and logic fit without duplicate rules. Follow docs/robot-capabilities-spec.md: supply externally imposed pause/resume fixtures for music/guessing/photos; camera end never auto-resumes and petting never advances activities. Plan the camera demonstration with a consenting teammate; Grandma needs a separate voluntary camera choice. Add photo album talk through Anay's existing conversation path, then a bounded reviewed guessing tree with yes/no/not-sure/skip/reveal and graceful finish. Use only approved demo assets, no clinical scores or recall testing. Check transitions, invalid/stale actions and missing assets. Own the optional supervised live-demo rehearsal with Grandma, clear data explanation/agreement, immediate stop and teammate fallback; do not assume her diagnosis, collect private biography by default, or pressure participation. Document actual observations and show live versus mock honestly.

## 6. Demo with Grandma — optional live participation

The user intends a supervised live demo with Grandma. Her health status is unspecified. Lukas coordinates privately before inviting public participation; the plan is not evidence that consent/rehearsal/readiness is complete.

- Start with team-only rehearsal and a fictional profile/generic approved media, excerpt saving off. Explain audio going to the team server, text going to an external LLM, and what the journal shows.
- Ask whether she wants to take part and what she finds comfortable; public demo, recording/projection and use of personal photos/biography are separate choices. Do not put her health details or consent evidence into public source control.
- Keep a familiar support person present, accessible stop/mute, low volume/quiet surroundings, and optional short activity choice. Do not use distress/urgent scenarios or evaluate memory ability with her on stage.
- If her participation involves dementia-specific care needs, apply the care-professional/person-centered review in the safety spec before proceeding. Do not treat family permission alone as blanket authorization.
- Rehearse privately only after core stop/privacy/data-flow checks pass. If she declines, becomes uncomfortable, is unavailable, or the system is unreliable, use a teammate without explanation about her health or abilities. No feature/demo success criterion requires her participation.
- End the session explicitly, inspect permitted storage, remove any accidentally entered private information, and do not claim clinical benefit from positive feedback.

### Combined hardware feasibility handoff

Emilia’s early experiment combines camera/display/touch/Wi-Fi and sequential audio→camera→audio operation on the chosen firmware, preserving local controls under load. Share measured format, memory/frame limits and Stop latency with Anay/Kylie before media-contract freeze or full art exports. Failed camera remains disabled and an unmet F13 criterion; browser conversation does not satisfy it.

## 7. Acceptance tracker

All results start pending. Add a reproduction note, actual configuration and observed result when checked. Unsafe or broken features are fixed/disabled with an honest fallback, not marked passed because a prompt contains a rule.

### Observed backend control subset — November 13, 2026

On branch `anay/device-control-foundation`, Linux workspace, Bun **1.4.4**: `bun install --frozen-lockfile`, `bun run check` (0 Svelte errors/warnings plus TypeScript), `bun run test` (**37 passed, 0 failed**), `bun run build`, `bun run format:check`, and `git diff --check` passed. The Bun lockfile/dependency versions are unchanged. The test suite includes pairing scope/single use/expiry, managed-identity verification fixtures, revocation of an active device, stale/replayed controls, capture-off unmute/resume/reconnect, watchdog, Stop/revocation at command capacity, and certificate-verified WSS through a temporary test proxy.

`bun run smoke:control` passed against the production web build: actual SvelteKit resource routes → a local fixture identity provider over certificate-verified HTTPS → gateway pairing → the computer control harness over certificate-verified WSS → start/pause/resume/revoke. Missing identity, foreign Origin, preview profile and GET pairing were rejected. The fixture CA/provider/proxy/credentials are created temporarily and removed; the smoke sends no media or notifications. OpenSSL is required for its temporary certificate. `bun run smoke:web` also passed with `bun run dev`, preserving the original mock app→gateway→music path. The inspected browser build contained no server-only auth/credential symbols (`LEMMI_AUTH_CLIENT_SECRET`, `LEMMI_CONTROL_TOKEN`, `node:crypto`, `authenticateCaregiver`).

These observations validate **the control subset only**. Identity-provider account/login integration, a selected public origin/certificate/proxy and demo-network access, database persistence, media, real notifications, K151 firmware/local controls and counterpart technical review remain pending. Credentials/pairings are bounded in-memory and revoked on restart. No full acceptance row below is upgraded by this result. Exact interfaces, configuration, nonsecret fixtures and Emilia/Kylie handoffs: [authenticated control foundation](handoffs/anay-control-foundation.md).

| Check | Owner | Counterpart | Result |
| --- | --- | --- | --- |
| F15 one functional profile; example/unassigned IDs rejected by live services; explicit refusal/preference precedence; separate remembering permission | Anay | Kylie + Emilia | Pending |
| F16 first/later uncertainty, deduplication, cross-activity alias/distractor exclusion, no deliberate retests | Lukas + Anay | Kylie | Pending |
| F15/F16 failed save, session-only mode, stale queued prompts and forget/revocation/deletion races | Anay | Emilia + Lukas | Pending |
| F16 matching UI/device or app handoff, all-ineligible exit, no ability/miss labels | Kylie + Lukas | Emilia | Pending |
| F17 supplied topic/object teaching, change/not-sure/finish, eligibility and stale response cancellation, no grading | Anay + Lukas | Kylie + Emilia | Pending |
| Approved scene exploration, source-linked Overview highlights, no-summary/partial/error/privacy cases | Kylie | Anay + Lukas | Pending |
| Concern phrase fixtures: explicit help, incomplete need, nonspecific unwell, urgent detail, quoted/unclear speech | Anay | Emilia + Kylie | Pending |
| Shared starter, schemas/mocks, routes, fake device; system-input/context/signal/control and Quiet capture fixtures | Anay | All | Pending |
| F13 real camera request/local Allow/fresh viewer/local Stop/expiry; secure gate before F14 | Emilia | Anay + Kylie | Pending |
| F13 unauthorized/duplicate viewer/late frame/revocation/disconnect/restart fail closed; no retained images | Anay + Emilia | Kylie | Pending |
| F13 all activities/audio pause; explicit resume, no stale talk/music; separate camera consent | Lukas | Anay + Kylie | Pending |
| F14 local top-strip reaction, stop/motion bounds/reduced motion, truthful cues and telemetry freshness | Emilia | Kylie + Anay | Pending |
| Real robot audio round trip + visible capture + local mute/unmute/stop | Emilia | Anay | Pending |
| Disconnect/reboot/stale speech/music frames cannot restart capture/output | Emilia | Anay | Pending |
| Local STT/TTS, external LLM, sensitive examples, permitted summary sources | Anay | Lukas | Pending |
| Music playback/pause/next/receipts, photo navigation/talk, guessing uncertainty/reveal/exit | Lukas | Kylie + Anay | Pending |
| UI renders same logic, browser audio permissions, shared controls, explicit handoff | Kylie | Lukas + Emilia | Pending |
| Profile revisions, journal/source/edit/review/no-summary, private projections | Anay + Kylie | Lukas | Pending |
| Real opted-in help, delivery unknown/ack/failure/no-response/backup/expiry/restart | Anay | Emilia + Kylie | Pending |
| Forged callback/access rejected; no acknowledgment on GET/link preview | Anay | Kylie | Pending |
| No raw mic/generated speech logs; excerpt-off summary; revocation/deletion races | Anay | Emilia + Kylie | Pending |
| Actual demo-network host access, warm/cold speech benchmark, laptop fallback | Anay | Emilia | Pending |
| Keyboard/zoom/contrast/readability; preview-only cards cannot perform live actions; robot export size/capture indicator | Kylie | Emilia | Pending |
| Team rehearsal twice, Grandma readiness or teammate substitution | Lukas | All | Pending |

Keep timing targets from the technical spec; do not silently shorten the listening pause to improve a latency number. Local inference/GPU advantages and the 2–3-second post-explicit-turn target are unverified until measured. Manual help bypasses the LLM and game engine. An app fallback cannot fix an unreachable shared server.

## 8. Demo script and fallback

Five-minute draft; adapt to actual event allowance. Grandma may choose one short segment after private rehearsal; teammates demonstrate the remaining features/failure scenarios. No audience member should see private contact details or secrets.

| Time | Action / presenter | Evidence |
| --- | --- | --- |
| 0:00–0:30 | Lukas introduces scope and fictional data | Companion/activities/caregiver continuity; no diagnosis or emergency guarantee |
| 0:30–1:00 | Anay shows profile and server/speech readiness through Kylie's UI | Local STT/TTS/PostgreSQL, external LLM, verified test contact; no private server console |
| 1:00–2:00 | Emilia starts Stackchan and one conversation; shows mute/stop | Same backend session; actual capture indication; explicit restart |
| 2:00–3:15 | Kylie shows activity UI; Lukas explains logic; Grandma optionally chooses a brief segment | Brief tour of all four activities plus teaching entry; demonstrate selected live transitions and explicit larger-screen/audio handoff as needed |
| 3:15–4:00 | Request help; opted-in teammate acknowledges remotely | Sending/delivery/ack truthful; no claim of arrival; async delays shown honestly |
| 4:00–4:40 | Anay/Kylie show journal | Typed sources and events, no cognition metrics; no-summary state acceptable if generation failed |
| 4:40–5:00 | Lukas shows app fallback and rough business direction | Subscription + optional robot sales as future hypothesis; partner packs later; implemented limits named |

The timed stage tour is a subset of acceptance rehearsal, not proof of full completion. Show matching and Teach Lemmi through brief transitions where time permits; cover memory/forget, all activity paths and failure checks in the recorded acceptance tracker before calling M2 complete. Re-time the script against actual event allowance instead of assuming all requirements fit five minutes.

Include a short teammate camera request → local Allow → fresh viewer → Stop demonstration before petting, by shortening other segments or extending only if the event permits. F14 can show one local top-strip reaction and measured device status after camera. No private scene or unpermitted bystanders should be projected. Grandma may decline this segment separately; use a teammate.

Failure rehearsal is separate: service outage, invalid transcript, missing media, worker/server restart, no caregiver response, revision conflicts and deletion. Use deterministic mocks only when labeled; they do not prove live delivery. Prepare a short clearly labeled recorded rehearsal as presentation contingency, not fabricated live output.

## 9. Local host, deployment and freeze

Evaluate the lab desktop first (team-reported Ethernet/GPU), then laptop/homelab alternatives. Anay owns deployment/local PostgreSQL/private media; Emilia verifies device reachability and Lukas runs the full script from the actual venue. Check permission to install/use the host, exact memory/GPU drivers, warm/cold model performance, power/sleep, and approved network paths.

Preload model/voice assets; keep inference endpoints and PostgreSQL private. Configure authenticated SSH/VNC if needed for administration, outside the public app tunnel. Services must outlive remote-desktop/SSH sessions. Test HTTPS/WSS/callbacks/auth and external LLM access from the real campus/caregiver network; being on campus does not imply Wi-Fi-to-lab reachability. Local speech does not mean offline contact/LLM.

Prepare a laptop fallback with compatible models and seeded fictional data. Provision secrets/test destinations privately, stop the previous worker before migration, and verify no expired/duplicate sends. Re-test on the fallback hardware rather than assuming a desktop GPU model fits. A fresh endpoint/session must be explicit after failover. Document actual run/recovery/reset commands and versions in README once implemented.

Freeze new features in the final quarter. Run the entire presentation twice after the last shared change. Lukas coordinates submission timing/materials; each owner supplies their feature status, screenshots or permitted recordings, run notes, and limits. Remove fictional records and real test contacts from controlled stores afterward; external delivered-message/provider retention remains separate.

## 10. Business and future work

The rough pitch is a service subscription plus optional robot sales, with an app-only option. The team still needs cost/customer/support validation; do not implement billing, enforce subscriptions, invent prices, promise health outcomes, or make stop/help unavailable behind payment.

A possible later marketplace connects reviewed activity/content companies through the activity-pack contract. No partner selection/outreach, arbitrary code upload, third-party patient-data access, payment/revenue-sharing flow or marketplace backend is authorized by this rough plan. Keep a small declarative pack manifest now; evaluate suitable partners and commercial terms later. TurtleBot stays deferred unless explicitly reprioritized and assigned.

## 11. Kickoff decisions to fill in

| Decision | Owner | State |
| --- | --- | --- |
| Event timetable, freeze/submission and demo lead | Lukas + team | Pending |
| Exact package versions, start commands, runtime contracts/mocks | Anay with all | Initial scaffold available; pinned Bun 1.4.4, SvelteKit 3.2.0; see team-start.md. Full v1 counterpart freeze pending. |
| Camera encoding/byte limits, control responsiveness, local Allow/Stop mapping, deadlines and real network streaming | Emilia + Anay + Kylie | Pending hardware experiment; before F14 polish |
| Firmware route, local input mapping, audio/mascot constraints | Emilia with Anay/Kylie | Pending |
| Local host, speech engines/voice, external LLM, auth/notification service | Anay | Pending testing |
| Five-avatar sketches/30 static state exports, route map and annotated inspiration board | Kylie with Emilia/Anay/Lukas | Pending design/constraints |
| Three approved track assets, three generic photos, small guessing pack | Lukas with Kylie | Pending selection/permissions |
| Private optional rehearsal and public participation preferences | Lukas with Grandma/support person | Pending; no health assumption |
| Partner marketplace/customer/pricing research | Team later | Hypothesis, outside P0 |

## 12. Added requirement: conversation support (F12)

After the first audio/music/contact vertical slice, implement the research-informed [Conversation support presets](communication-support-spec.md). Anay owns the validated enum, profile/session config and safe application/cancellation; Kylie owns the caregiver selector and same-topic preview; Lukas consumes presentation policy; Emilia checks effective robot speech/capture behavior. Start with three fixed presets, not a large advanced editor or a clinical severity score. Add a demo step showing one caregiver preview/change if time permits; readiness still requires no automatic staging, privacy/help changes, or stale output after apply-now. The preset does not widen the initial audience or authorize unattended use. All checks for this new feature remain pending.

## 13. Camera-first implementation briefs and shared gate

The [robot capability spec](robot-capabilities-spec.md) supplements every brief above with precise F13/F14 scope, frame/control contracts, timeout proposals, consent and privacy rules. Both are committed; F13 passes before F14 polish. Each engineer starts against the same schemas/mocks, reports live versus mock, and updates counterpart consumers when the protocol changes. Hardware failures must be fixed or the feature disabled with an unmet acceptance result; do not silently relabel it stretch or claim a factory example proves the integrated feature.

## 14. Evolving preferences and matching delivery

F15/F16 are committed additions in [personalization-and-matching-spec.md](personalization-and-matching-spec.md). Four activities are now required; the old sorting design stays superseded. Freeze the memory/eligibility contracts before matching integration, develop matching against typed mocks beside the existing paths, and preserve the camera-before-petting gate. Do not squeeze new scope into the final freeze: re-estimate actual availability at kickoff and report incomplete criteria honestly.

Add a fictional two-session demonstration: a preferred topic is retained with permission, an unwanted topic is avoided, and seeded/labeled prior uncertainty plus a new teammate Not sure retires a canonical object everywhere. Clearly label seeded policy; do not pretend two live sessions occurred. Show Forget on Alex and labeled preview-only dashboard cards; verify example/unassigned IDs cannot access Alex’s live services using isolated authorization fixtures. Do not present a second functional profile. This is policy behavior, not proof of memory improvement. Grandma is never asked to produce uncertainty or distress to demonstrate it.

## 15. Confirmed whiteboard work and handoffs

The user clarified Teach Lemmi: **Lemmi supplies a simple object/topic and invites the participant to teach it.** Implement F17 through the existing conversation mode after the basic voice/eligibility path works; do not create a fifth activity engine. Approved town/place exploration reuses photo packs. Keep four required game/activity reducers, plus this conversation mode.

| Owner | Additional work | Counterpart handoff |
| --- | --- | --- |
| Anay | Teaching mode/commands, permitted topic selection and response cancellation; overview read composition; known activity-time intervals; deterministic concern phrase routing | Shared schemas/mocks to Kylie/Emilia; approved prompt contract to Lukas; source-safe highlights and honest timing/error states |
| Emilia | Render teaching prompt/name/image where readable; normal listening/playback and shared topic-change/Not sure/Finish; confirm policy/profile/camera/stop invalidation | Measured device constraints to Kylie; sample command fixtures to Anay; no separate firmware memory or keyword-routing system |
| Kylie | Teach Lemmi entry/panel; approved scene selector; Profile/context entry; caregiver card overview/source links/empty/error states | Existing clients/views from Anay/Lukas; optional duration charts only after cards, no inference of wellbeing |
| Lukas | Reviewed simple-object/topic invitations and scene packs/tags; teaching skip/uncertainty/eligibility fixtures and demo segment | Use Anay's conversation execution, no correction/quizzing or biography writes; voluntary participant explanation, no pressure |

Integrate in small increments: shared teaching/overview fixtures → one supplied topic through normal voice → change/not-sure/finish and cancellation → approved scene collection → source-linked overview cards → optional duration charts. Core audio/contact, four activities, camera-before-petting, privacy and failure gates stay required. Use the existing final-quarter freeze; identify uncompleted scope honestly rather than adding late architecture.

Whiteboard observations are requirements/design inputs, not measured outcomes: no 99%/instant-alert promise, happiness/aggression measure or full-chat retention. Demonstrate concern routing only with fictional cases and opted-in teammate recipients; actual acknowledgment/delivery remain distinct.

### Final stretch order

1. Reviewed built-in activity-library browsing and other already scoped optional polish, only after committed features and safeguards.
2. Optional factual activity-duration visualization, only after source-linked caregiver cards and interval checks work.
3. **Solitaire — last/bottom priority.** No implementation or required handoff until all committed work and other optional items are complete; use the shared activity seam if later taken up. TurtleBot remains separately deferred with no assigned owner.
