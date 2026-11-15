# Lemmi — Build and demo plan

### Concurrent testing follow-up — November 14, 2026

Live demo UI creation and reload verified for Casey (Test) and Robin (Test); Alex unchanged. New profiles have separate empty context/default avatars and no enrolled endpoint or active session. Local, undeployed browser visibility guard prevents an observing tab from automatically pausing the robot; explicit Pause/Stop remain available. Backend Start conflict now explains profile scope/handoff. Targeted endpoint/scheduler/presentation suite: 16 passed / 214 expectations; type/Svelte and production build passed. No speech scheduling or deployment changes. Manual hidden-tab/keyboard and physical robot acceptance remain unrun. Next handoff: Anay reviews session conflict, Kylie reviews browser lifecycle, Emilia rehearses robot plus observer. See [backend status](backend-status.md#concurrent-testing-profiles-and-local-observer-fix--november-14-2026).

### Semantic conversation decisions — November 14, 2026 (local branch)

Push/handoff preparation: the [server checklist](handoffs/conversation-decisions.md#backend-server-testing-and-rollout-checklist) defines no-deployment fixture/direct-model gates, backend-deploy integration, the inherited migration 005 dependency, gateway-wide enablement scope, browser acceptance matrix and disabled-switch rollback. Deployment/model/database acceptance remain unrun here. Concurrent observer-tab/session-conflict edits discovered during push preparation are excluded from this feature commit and preserved in the workspace.

Implemented `codex/conversation-decisions` from `e628faf`: optional server-only OpenRouter Decisions adapter (Jev 1.14 / Luna Decisions), runtime-validated bounded inputs/answers, current-profile topic IDs, probability thresholds/abstention, and shared coordinator/registry wiring. Open-mode detection runs before chat, within existing turn cancellation/revision authority; fixed controls/concerns and teaching/photo flows retain their precedence. Semantic reminders use the same TTS path and preserve the substantive thread across repeated requests. Activity classification is available to response guidance only and does not execute games. Configuration defaults off and fails explicitly if enabled but invalid; no provider/model fallback or weaker-data-policy retry.

Observed: type/Svelte check zero errors/warnings, 95 relevant tests passed across eight files (2,578 expectations), production build and diff whitespace passed. Coverage includes fixed-endpoint/provider flags, malformed/probability/unknown-ID rejection, deadlines, duplicate requests, profile isolation, cancellation before late generation, a fixture STT→decision→reminder→TTS turn and maximum profile/prompt bounds. The 21-case fictional evaluator dry run passed without provider calls. These are fixture/software results, not measured Jev/Luna semantic accuracy or human microphone/playback acceptance. Full suite was not rerun; previously recorded Windows OpenSSL/POSIX and unconfigured database limitations remain. No deployment, provider calls, private configuration change, schema migration or vector store added in this slice. Anay reviews provider handling/cancellation and runs the fictional live model comparison before enablement; Kylie reviews recovery wording; game execution remains the next shared-activity handoff.

### Conversation redirects and lost-thread support — November 14, 2026 (local branch)

Added optional caregiver-owned `conversationRedirects` to the existing private profile PATCH/detail, migration 005 and profile-revision cancellation. Away/toward phrase lists are bounded; only open mode offers redirects, urgent/help/refusal handling takes priority, conflicting destinations are filtered, and empty destinations permit neutral model suggestions. Exact phrase guard replaces a redirect reply that repeats away text; semantic recognition is not claimed. One offer per configured phrase within uninterrupted context avoids repeated pressure. Existing fixed-reply interactions preserve this offer state. English explicit lost-thread requests use a bounded quote from recent transient ordinary participant text, or offer a fresh start if unavailable/redirect-marked. No inferred confusion, new stored conversation data or cross-session memory.

Observed on this Windows checkout: type/Svelte check zero errors/warnings; full Bun run 246 pass, 35 skipped, 3 failed. Two TLS fixture tests require missing `openssl`; private-media test expects POSIX 0600 but Windows returned 0666. Database tests, including new persistence/auth/revision coverage, were skipped without `LEMMI_TEST_DATABASE_URL`; migration is unverified against real PostgreSQL here. Production build passed. New coordinator tests cover redirect/fallback, participant continuation, reminder repetition/missing context, urgent precedence and configuration-change cancellation. No deployment, caregiver web editor, live model/microphone quality or hardware acceptance. Anay reviews configuration/persistence/cancellation before deployment; Kylie connects the private caregiver editor when browser authentication is available.

### General chat continuity — November 14, 2026 (local branch)

On `codex/general-chat-handsfree`, open-chat instructions now explicitly permit participant-led everyday topics and subject changes, direct answers and optional questions. Fixed non-interrupting replies preserve the six-message transient context; teaching retains its topic guard. UI adds conversation state and a bounded transient message display, with activities under a collapsed section. No deployment or wire changes. Observed: type/Svelte checks zero errors/warnings, 57 focused conversation/teaching/speech/presentation tests passed (2,710 expectations), production build and diff whitespace passed. Actual live model/microphone, browser visual/keyboard/zoom and hardware rehearsal were not run. Automatic open-chat turn continuation and voice activity launch remain pending. Next counterpart review: Anay for dialogue/cancellation and Kylie for participant layout.

### Browser playback buffering — November 14, 2026

Deployed `da731c8` for reported voice choppiness: negotiated browser credit 12×20 ms, default/robot 4, per-owner bounds, consumed-only receipts, immediate Stop/revision cancellation; models/voice/data unchanged. Type/Svelte zero errors/warnings/build/whitespace passed; 241 tests /4,357 expectations passed, 34 DB-dependent cases skipped for this audio-only run. New real-gateway/browser scheduling tests cover negotiation, refill, overflow, no premature completion, Stop and legacy behavior. Actual public temporary browser endpoint negotiated twelve without starting/taking over a session; endpoint released. Gateway/web restarted and all services active. Human audible improvement remains a requested retry, not verified acceptance. [Status](backend-status.md#smoother-browser-speech--november-14-2026).

### Public Photo Story acceptance — November 14, 2026

Deployed web/gateway `dafdf4e` after explicit user request: confirmed fictional profiles, existing endpoint WSS/audio, generic reviewed caption-only scenes, owner/revision controls and scoped current-scene media. Teaching voice continuity retained. Independent technical review found no blocking auth/cancellation defect. Full database-enabled suite 240 passed / 4,387 expectations with no skips; type/Svelte/build/whitespace and production participant/media/control smokes passed. Actual public separate-fictional-profile page/enroll/WSS/Start/Photo/scoped garden/Talk real-model reply/Skip/park/Stop passed; noncurrent/ended reads denied, temporary profile removed. Backup retained; gateway/web restarted once. No human microphone/speaker, robot or keyboard/zoom acceptance performed; private data, uploads, camera and full journals remain unavailable. [Exact boundary and observed checks](backend-status.md#public-photo-story-deployed--november-14-2026).

### Prioritized teaching voice continuity deployment — November 14, 2026

Deployed `d3d4337`: narrow server replacement-output fix from Lukas `4690bf6`, retaining live UI and per-profile access. Independent technical review found no blocking authority/cancellation problem; historical `c006d26` already had spoken switching's canceled-reply bug. Sixty-four targeted checks / 2,228 expectations, type/Svelte zero errors/warnings/build passed. Public same-key WSS Start/teaching/typed Different topic/changed prompt/Stop passed; actual microphone/provider/hardware not used. Gateway/web restarted, sessions ended safely, persistent keys retained. Broader branch hands-free local demo not integrated by this hotfix. [Status](backend-status.md#teaching-voice-continuity-deployed--november-14-2026).

### Main-based live UI alignment — November 14, 2026

Integrated `a0a3797` (`codex/main-ui-alignment`) with tested Photo Story source and installed web `eab2c35`. Live dialog/avatar/basic-information/empty summary/trends and conversation scene/control-bar refinements retain existing safe projections and handlers. Combined type/Svelte zero errors/warnings and build passed; reconciled backend had 227 tests / 4,163 expectations with no database skips and four production fixture smokes. Actual public unlock/caregiver/conversation/root/profile-list and updated UI bundle bytes passed; private profile still 401 and local photo page/worklet 404. Only web restarted; gateway PID/start time unchanged. Main/backend-deploy receive the same source. New real browser/hardware acceptance and production Photo Story hosting remain pending. See [backend status](backend-status.md#live-ui-alignment-deployed--november-14-2026).

### Photo Story backend reconciliation — November 14, 2026

Integrated Lukas checkpoint `9dfc4b6` as local-only source alongside live multi-profile/teaching/design changes. Preserved teaching and private resource boundaries; isolated Alex rehearsal enablement, removed inferred biography, and corrected inherited live-mode/port and workspace Vite launch issues. Full isolated PostgreSQL suite: 227 passed / 4,163 expectations, no skips; type/Svelte/build and production participant/data/control/long-output speech fixture smokes passed. Actual loopback launcher and typed photo flow/skip/factual events/Stop passed without speech and using reviewed-demo chat. No shared gateway restart or production photo hosting. Live scoped pack/media/activity transport, actual microphone/voice quality and counterpart review remain pending; no clinical/retention/provider/hardware acceptance follows. See [backend status](backend-status.md#photo-story-integration-source--november-14-2026).

### Designed public UI acceptance — November 14, 2026

Deployed web `cb64621`: caregiver landing/Profiles/Games/Ecosystem design and illustrated conversation at the requested public URLs, connected to existing live fictional setup/WSS/speech/teaching. The earlier source-only UI merge left those routes blocked; this corrects that mismatch. Read-only safe demo profiles, inert examples, private caregiver authorization and explicit unavailable/preview features retained. Type/Svelte zero errors/warnings, build, 43 focused tests / 452 expectations, formatting/whitespace and proxy syntax passed. Public locked-page/root redirects, designed pages, profile-list/artwork and private/mock/internal denials passed. Only web restarted; gateway retained PID/start time and existing tests. Actual interactive browser audio, keyboard/zoom and counterpart UI acceptance remain pending. No robot/provider/live session acceptance is implied. [Exact status and boundaries](backend-status.md#designed-public-ui-integration--november-14-2026).

### Kylie published UI merge acceptance — November 14, 2026

Merged requested `d8a6fe4` into backend-deploy as `733fb1c` and installed its isolated production web build. Existing integration already contained the same designed components/styles/artwork; conflict resolution retained live/mock separation, enrollment, teaching and Alex context. Final source diff is documentation/font-license whitespace only. Thirty-eight focused tests / 392 expectations, production build and actual-workspace type/Svelte checks passed. Isolated checking failed to resolve route types through shared dependency symlinks; actual-workspace check passed with zero errors/warnings. Public access/unlock/participant/profile-list, twenty matching JS/CSS bundles and three matching font/surface files passed. Restarted only web; gateway remained running with existing connections. Browser visual/hardware/counterpart UI acceptance was not repeated; caregiver/mock pages remain local. See [backend status](backend-status.md#kylie-ui-publication-merge--november-14-2026).

### Browser unlock repair acceptance — November 14, 2026

Deployed web-only fix `7ad2de1` for the native form Origin suppression caused by `Referrer-Policy: no-referrer`; policy is now `same-origin`, with strict POST Origin checks retained. Five access tests / 39 expectations, type/Svelte checks, focused formatting and isolated production build passed. Public HTTPS access/header/unlock/cookie/participant/profile-list/logout passed; opaque Origin remains rejected. Only web restarted; gateway `f5724a0`, credentials and database preserved. The user subsequently confirmed Emilia's Chrome unlock worked. Broader counterpart review remains pending. See [backend status](backend-status.md#browser-unlock-repair--november-14-2026).

## 17. Alex content preparation — November 14, 2026

**Main synchronization:** merged main `24e7fe2` into the Alex feature branch,
preserving the profile/uploader work and main's speech-pipeline increment. The
README conflict retained both Alex instructions and the updated project status.
Type/Svelte checks and all eleven profile/uploader tests pass. Full suite:
114 pass, 18 database skips, one unchanged Windows POSIX file-mode assertion
failure. No live service, provider, upload or hardware verification was performed.

**Subsequent music approval/uploader:** the user explicitly attested song source
and permission approval for demo playback. Lukas recorded that attestation and
added a local browser-login/PKCE uploader consuming the existing authenticated
profile/assets clients. No backend auth/routes/assignment/deployment changes.
Five uploader tests plus six profile tests pass (72 combined assertions);
type/Svelte and formatting pass. Full suite: 89 pass, 18 DB skips, the unchanged
Windows POSIX-mode failure remains. Browser provider configuration/private access
key are absent locally; no actual login/upload occurred. See
[uploader instructions](upload-alex-music.md). Earlier missing-permission notes
below describe the initial snapshot; photo permissions remain pending.

On `codex/alex-profile-assets`, based on main `a6f7ff9`, Lukas prepared the supplied
fictional Alex profile, caption/context drafts, favorite-song metadata, pure
revision-aware profile-update preparation and existing-contract pack bindings.
See [handoff and remaining integration](handoffs/lukas-alex-profile.md). Shared
caregiver mock interests/guidance changed; no API, backend, UI or deployment changed.
Six private PNG derivatives and the full 276.26-second PCM WAV passed the existing
media decoder; originals/watermarks remain intact. Media permission is missing,
so files remain unapproved and ignored, not playable approved uploads. Bob/Jill
remain authoritative over the Christmas filename's Jill/Joe; cooking is excluded.

Observed: six new tests pass (34 assertions); type/Svelte checks, production build
and scoped formatting/whitespace checks pass. Full Bun suite: 84 pass, 18 database
tests skipped (no dedicated test database), one existing Windows POSIX-mode
assertion fails (`0666` returned instead of `0600` in `tests/data.test.ts:117`).
No live profile write, provider call, speech/music playback, UI acceptance or
hardware check was run. Anay: review catalog IDs, authenticated profile/media
import and A05 pack hosting; Kylie: integrate existing views after hosting is
available. No automatic merge/deployment, no claim of a complete playable
supplied-media demo.
Kylie navigation correction, November 14: user requested reversal of the Dashboard color strip; plain link restored. Caregiver Setting retained. Formatting passed.

Kylie caregiver settings/navigation observation, November 14: caregiver-only settings/photo preview and unavailable account controls added; sidebar Dashboard now has a full-width green strip separated from settings. Existing root-layout appearance context is presentation-only. Bun `check` (0 Svelte errors/warnings) and production `build` passed. Account auth/password services and persistent caregiver photo storage remain Anay handoffs; browser visual/keyboard checks were not run.

Kylie Games catalog observation, November 14, 2026: Photo story / 20 questions detail dialogs and visual previews plus page-visit Add more (Music / Picture matching) implemented in the caregiver Games tab. Games Photo story uses no profile-upload source and awaits dedicated user assets. Guessing uses shared `activityScreenFixtures` without local game rules or live transitions. Bun 1.4.4 `check` passed (0 Svelte errors/warnings) and `build` passed. Browser interaction/keyboard/zoom and live activity/AI/hardware checks were not run; these are not P0 completion results. See `docs/handoffs/kylie-caregiver-ui.md` for the activity host handoff.

Use [Anay's task checklist](anay_tasks.md) for backend checkboxes, teammate blockers and Anay-agent file claims. This document retains team ownership, milestones and observed acceptance results.

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

### Backend feature-branch review — November 14, 2026

Anay requested review on `mobrob-Precision-3680`: `anay/app-data-schema` at `cff8554` and `anay/speech-pipeline` at `151ebc3`. Isolated Bun 1.4.4 / PostgreSQL 17 suites passed 97 and 109 tests respectively; a combined source tree passed 115 tests, type checks and production build. Individual type/build/format and production data smokes passed; seven speech Python tests, control/chat fixture smoke, five long-output fixture voice turns and three isolated real-local-engine CPU turns also passed. Playback was simulated and the LLM was a fixture. A separate regression reproduced recognized urgent speech returning fixed text with zero TTS calls: speech changes are not approved for voice enablement until corrected. Data metadata migration review is approved; full contact/journal/policy workflows and hardware acceptance remain pending. No branch was merged or deployed, and existing pairing-helper work was preserved. Exact revisions, finding, commands/evidence, limits and handoff: [branch review](verification/backend-branch-review-2026-11-14.md).

### Observed backend control subset — November 13, 2026

On branch `anay/device-control-foundation`, Linux workspace, Bun **1.4.4**: `bun install --frozen-lockfile`, `bun run check` (0 Svelte errors/warnings plus TypeScript), `bun run test` (**37 passed, 0 failed**), `bun run build`, `bun run format:check`, and `git diff --check` passed. The Bun lockfile/dependency versions are unchanged. The test suite includes pairing scope/single use/expiry, managed-identity verification fixtures, revocation of an active device, stale/replayed controls, capture-off unmute/resume/reconnect, watchdog, Stop/revocation at command capacity, and certificate-verified WSS through a temporary test proxy.

`bun run smoke:control` passed against the production web build: actual SvelteKit resource routes → a local fixture identity provider over certificate-verified HTTPS → gateway pairing → the computer control harness over certificate-verified WSS → start/pause/resume/revoke. Missing identity, foreign Origin, preview profile and GET pairing were rejected. The fixture CA/provider/proxy/credentials are created temporarily and removed; the smoke sends no media or notifications. OpenSSL is required for its temporary certificate. `bun run smoke:web` also passed with `bun run dev`, preserving the original mock app→gateway→music path. The inspected browser build contained no server-only auth/credential symbols (`LEMMI_AUTH_CLIENT_SECRET`, `LEMMI_CONTROL_TOKEN`, `node:crypto`, `authenticateCaregiver`).

These observations validate **the control subset only**. Identity-provider account/login integration, a selected public origin/certificate/proxy and demo-network access, database persistence, media, real notifications, K151 firmware/local controls and counterpart technical review remain pending. Credentials/pairings are bounded in-memory and revoked on restart. No full acceptance row below is upgraded by this result. Exact interfaces, configuration, nonsecret fixtures and Emilia/Kylie handoffs: [authenticated control foundation](handoffs/anay-control-foundation.md).

### Observed activity contract subset — November 13, 2026

**Conversation continuity follow-up, November 14:** reproduced a spoken teaching control changing generation and canceling its own pending reply; fresh bounded active-session output authority fixes this locally, including seven consecutive alternating explanation/control replies, late-PCM Stop/pause checks and an actual scoped WSS Next acknowledgment. The server fix is source-only pending Anay review/deployment. The browser now supports an explained explicit conversation start, fresh grant requests after completed questions, and disarming on all interrupts/Quiet/context changes. A live two-reply fictional microphone rehearsal passed automatic listening after the initial prompt and first question; the second acknowledgment had no question and correctly left capture off. A startup unmute-generation race found in live testing was fixed and regression-tested. [Exact continuity handoff](handoffs/teach-lemmi-voice-continuity.md). Broader physical/noise/clinical/P0 acceptance is not implied.

Continuity final checks: type/Svelte, production build, changed-code formatting and whitespace passed. Full suite **158 passed, 18 database-dependent skipped, one unchanged Windows POSIX-permission assertion failed** (177 total). These local server fixtures do not establish deployment of the new spoken-control fix.

**Browser question/endpoint upgrade, November 14:** preserved the previous working voice commit `16e263a` as `codex/teach-lemmi-voice-baseline-16e263a` on GitHub before editing. Primary question text now follows the latest backend reply and remains while answering. Explicit capture can auto-end after two seconds of post-speech quiet (optional Quick 1.2 seconds/Extra time four seconds); initial silence, short pauses and clicks do not become negative preference evidence. Manual Done and existing Stop/mute/grant/capture bounds remain. A separately approved fictional human sentence auto-submitted without Done, updated the primary question to the live follow-up, then Next changed it to the seaside prompt. Stop ended audio. No backend API/deployment or firmware change; broader acoustic tuning remains pending.

Upgrade verification: type/Svelte checks and production build passed; **150 automated tests passed, 18 database-dependent skipped, one unchanged Windows POSIX-permission assertion failed** (169 total). All eleven focused browser-client/endpoint tests passed, including initial silence, mid-sentence pauses, selectable quiet intervals, one-shot submission and stale-question protection. Changed-code formatting and whitespace passed. The live check above exercised the default Balanced setting; other settings and varied acoustic conditions have synthetic rather than human acceptance.

**Later live English voice rehearsal:** after Anay deployed teaching, one explicitly approved fictional human microphone turn completed backend STT/live AI/TTS and browser speaker playback; the user confirmed hearing the follow-up. Reviewed topic narration, capture-off unmute, Pause/keyboard Resume and Stop during pending topic audio were exercised. The first live playback exposed the deployed 30-control/sec budget; batching progress every two consumed PCM frames fixed the disconnect and has a regression test. The bounded capture timer ended the approved turn automatically. These observed browser results supersede the earlier pending-live statements for this specific English path only; physical Stackchan, broad speech-quality/noise/German, durable memory/journal observations, F13 and full F17/P0 remain pending.

Voice follow-up final local checks: **144 tests passed, 18 database-dependent skipped, one existing Windows POSIX-permission assertion failed**, 163 total. Type/Svelte, production build, changed-code formatting, diff whitespace, setup-script syntax and private-credential absence from the browser build passed. The initial Alex handshake advertised audio but not teaching; the later deployed human voice rehearsal above passed after Anay's integration.

**Browser voice follow-up, November 14:** `/participant/voice` now captures explicit granted microphone turns, resamples to existing PCM frames and schedules speaker output with consumed-frame receipts; Stop/mute/disconnect cancel local capture and stale output. The local Vite proxy keeps scoped credentials server-side and rejects non-loopback/foreign-Origin upgrades. Automated browser-audio and private-config checks plus a real certificate-verified fixture-proxy integration passed. Type/Svelte and production build passed. A live capability probe with the user-supplied Alex access bundle authenticated and advertised speech but not teaching; it started no session or microphone. Human voice acceptance remains pending Anay's deployment, and no P0/F17/hardware row is marked passed. [Voice manual](teach-lemmi-voice-demo.md) contains launch and acceptance checks.

Teaching-branch formatting verification: changed code and diff whitespace passed; repository-wide formatting reports 83 unchanged files. No unrelated formatting changes were made.

**Later Teach Lemmi source slice, November 14:** on `codex/teach-lemmi`, Windows, Bun 1.4.4, the user authorized backend handlers for Anay to merge/integrate/deploy. The existing coordinator now hosts reviewed teaching prompts, session-only feedback and a fifteen-minute active-time limit, with a playable scripted participant text demo. Type/Svelte checks and production build passed. Automated suite: **132 passed, 18 database-dependent skipped, one existing Windows POSIX-permission assertion failed**; Git's installed OpenSSL supplied the missing test executable. Browser checks passed for start, roses follow-up, pause, keyboard resume, Not sure, rotation/exhaustion, Finish, session-hide across teaching restart and typed Stop. Synthetic scoped device tests covered prompt playback, receipt-backed output and teaching STT/model/TTS; injected clocks covered pause/exhaustion and pending generation/audio at expiry. [Tester manual](teach-lemmi-tester-manual.md) and [counterpart handoff](handoffs/lukas-teach-lemmi.md) list exact interfaces and limits. No shared deployment, real provider/hardware, complete accessibility, durable learned policy/journal observations or F13 acceptance is claimed. Full F17/P0 and counterpart technical review remain pending.

On `anay/device-control-foundation`, Linux, Bun **1.4.4**, A01–A04 now supply four discriminated states, bounded/acyclic guessing packs, matching presentation context/evidence, and strict factual event/transition schemas. Shared fictional packs and safe UI/state/transition fixtures accompany them. The existing music reducer validates transition outputs; its coordinator preserves complete events and accurate interruption reasons. Exact interfaces, breaking fixture/view fields and review handoffs are recorded in [Anay → Lukas/Kylie](handoffs/anay-activity-contracts.md). Contract changes are committed on `anay/activity-contracts-a01-a04`; counterpart review is pending.

Observed: pre-change **37 tests** and check passed; final `bun run test` **51 passed, 0 failed**, `bun run check` (0 Svelte errors/warnings and no TypeScript errors), `bun run build`, `bun run format:check`, `git diff --check`, and `bun run smoke:web` passed. One intermediate new-test TypeScript expectation was corrected before final checks. The smoke exercised SvelteKit → gateway → music request/pause/Stop, preview rejection and explicit live unavailability; it sent no media/notifications. No dependencies or lockfile changed.

The new tests reject malformed/cyclic/unbounded guessing graphs, unknown candidates/entries, inconsistent states, stale matching session/instance/activity/presentation/policy revisions, foreign choices/sample signals, excluded distractors and private/free-text event fields. They separate request events from receipt-backed playback events and verify interruption journaling/deduplication and typed-client round trips. These are **contract/mock results**: three reducers remain unavailable, new pack content/media are placeholders, full effect/receipt authorization and catalog hosting remain A05, policy storage remains A24, and A06 Lukas/Kylie review/publication remains pending. No hardware, live-provider, full activity, browser/accessibility or F13 gate is marked passed.

### Observed speech/text subset — November 13, 2026

Framework WSL Ubuntu 22.04.5, x86_64, Python 3.10.12 and Bun 1.4.4: **70 Bun tests** and **7 Python boundary tests** passed. `bun run check` passed; production build passed after retrying outside the sandbox because its route-analysis worker initially failed with EPERM. No application defect was inferred from the sandbox failure. Source formatting was limited to this slice's files. New checks cover current-turn text deduplication, interrupt cancellation, completed-reply/mute freshness, early speech cancel, no inference queue, bounded data, private endpoint authorization and no request-content logs.

`bun scripts/smoke-control.ts --chat-fixture` passed against the built app: actual SvelteKit routes → verified HTTPS fixture identity → pairing → verified WSS computer client → fixture OpenRouter adapter response → pause/resume/revoke. Real OpenRouter keys are overridden/unused in this smoke. The live adapter/model's semantic quality/routing/retention configuration remains unverified without the user's selected model/key.

Real local CPU engines were loaded from pinned, verified assets: faster-whisper 1.2.1/multilingual base, int8/four threads; Piper 1.8.0/en_US-ljspeech-medium. The resumed synthetic English check passed with **187 ms TTS / 507 ms STT** in one run, after service model initialization. TTS output 22,050 Hz was resampled only in RAM to 16 kHz, 68,730 input bytes. Earlier observation was 130/443 ms; these isolated synthetic runs are not human-speech quality, cold-start or required 20-turn latency benchmarks. No microphone/robot/speaker playback, audio file or transcript log was used.

The service is loopback-only with a separate private token, bounded request/response/thread/job limits and a cancelable inference subprocess. Engine/model/dependency caches may persist, while speech/text buffers are transient; secure physical RAM erasure is not established. See [engine setup/privacy inventory](../services/local-speech/README.md) and [speech/text contracts and handoff](handoffs/anay-speech-chat.md). Missing A12/A13/A15 media integration, German voice review, actual provider/NVIDIA/VM/Mac/robot checks and counterpart review remain pending. No full acceptance row is upgraded. Git commands remain paused by user request; this session has not committed/pushed its speech work.

`bun run format:check` passed after formatting only speech-slice files. The built browser output contained none of the inspected server-only symbols (`OPENROUTER_API_KEY`, `LEMMI_SPEECH_TOKEN`, `createOpenRouterAdapter`, `authenticateCaregiver`, `node:crypto`). The private speech env was confirmed mode 0600 and the service tree outside the dependency environment contained no `.wav/.mp3/.pcm/.flac/.ogg/.mp4` artifacts. The owned test speech listener was stopped after verification; these checks do not establish host-wide/third-party deletion or hardware behavior.

The first resumed shutdown exposed duplicate SIGINT delivery during worker cleanup. The service now lets the parent own terminal shutdown and ignores repeated SIGINT during final cleanup. A second real engine startup/Ctrl+C cycle exited cleanly with code 0; all seven Python boundary tests passed again after that fix.

### Observed database/profile/assets subset — November 13, 2026

A18–A19, Linux, Bun **1.4.4**, native PostgreSQL **14.24** on an isolated loopback test cluster: `bun install --frozen-lockfile`, `bun run check` (0 Svelte errors/warnings, no TypeScript errors), `bun run test` with a dedicated `LEMMI_TEST_DATABASE_URL` (**84 passed, 0 failed**, including **14** data/parser/HTTP/client cases), `bun run build`, `bun run format:check`, and `git diff --check` passed. No dependencies or Bun lockfile changed. Database tests cover sole-Alex membership, revision conflicts/idempotency/rollback, approved-fact persistence/removal, credential hashes/revocation/restart, profile projections, file policy/integrity/no-follow bounds, orphan cleanup, single-authority locking, stale boot/deletion checkpoint rejection, immediate local revocation while SQL is blocked, and rapid Stop/new-Start terminal-checkpoint preservation under delayed SQL. Intermediate fixture TypeScript errors and a concurrent shutdown-close issue were fixed before final checks. A transient type failure in the concurrently edited control smoke script was resolved by its owner; the integrated check then passed. PostgreSQL constraint logging initially included fictional rejected-row details; the supplied server config now uses terse errors and disables statement/parameter/duration logs, and migration/bootstrap reject unsafe logging settings. The regression check verifies this failure mode explicitly.

`bun run smoke:data` passed against the production SvelteKit build → authenticated gateway → real PostgreSQL with certificate-verified HTTPS. It exercised profile GET/PATCH/retry/stale conflict, safe paired GET, actual approved PNG upload/byte read/metadata, unsupported SVG/preview/invalid token rejection and committed device revocation. Managed identity was a local fixture, not a selected provider. Browser output inspection found no database/control secret names or server storage/credential modules. The preexisting mock music/control/text tests still pass; no additional speech/firmware implementation was substituted.

These are database/API results only. The temporary native test cluster is stopped after checks; a permanent host/database and actual managed sign-in/proxy/network setup remain unverified. The optional PostgreSQL 17 compose configuration was not run (Docker unavailable). JPEG/MP3/range support, browser UI/accessibility, notifications, complete journal/policy/deletion workflows and counterpart boundary review remain pending. Contact/policy tables are foundations, not functioning workflows. Exact commands/contracts/limits: [database setup](../db/README.md), [A18/A19 handoff](handoffs/anay-database-profile-assets.md). Shared branch and other-agent files are preserved; this increment is uncommitted.

### backend-deploy merge verification

Refreshed/pulled `backend-deploy` (`51ede5e`) and main (`53c7a5f`) in an isolated checkout. Resolved five main-integration conflicts in merge commit `98d476c`, retaining the branch's backend implementation and main's published activity-contract notes. A reproduced stale-gateway claim could overwrite a replacement boot marker; conditional credential issuance and stale-pairing rejection now prevent it, with a new real-PostgreSQL regression test. A flaky Python oversized-body rejection test and contradictory planned API rows were also corrected.

Resolved-tree observations, Bun **1.4.4**, native PostgreSQL **14.24**: **91 Bun tests / 833 expectations**, **7 Python boundary tests**, type/Svelte check, production build, formatting/diff checks and certificate-verified control/chat and real-DB data smokes pass; the default mock web smoke also passes. Test infrastructure is temporary and no live credentials/providers/hardware were used. Conflict-marker-contaminated initial checks and a sandbox-denied initial build were discarded and rerun correctly. Full evidence, corrected defects and remaining host/product limits: [merge verification](handoffs/anay-backend-deploy-verification.md).

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

### Observed speech pipeline feature — November 14, 2026

Branch `anay/speech-pipeline`, isolated worktree based on main `be1e096` after backend deployment PR #2. The old shared checkout, main, backend-deploy and deployed services were left unchanged. Backend voice grants/PCM/end → local STT → existing chat/OpenRouter → local TTS → bounded output and receipt execution are opt-in. This remains bounded **whole-turn recognition**, not the incremental STT/silence-end target; physical K151/browser capture and playback are not accepted.

Final checks: pinned Bun **1.4.4**, frozen-lockfile dependencies unchanged; **109 tests passed / 2,107 expectations** across 15 files against a dedicated private PostgreSQL **14.24** test cluster. TypeScript/Svelte (zero errors/warnings), seven Python boundary tests, production build, formatting and diff whitespace checks passed. Production control/fixture-chat HTTPS/WSS and real isolated PostgreSQL/profile/media smoke tests passed independently. One concurrent smoke attempt returned a different preview-denial status and was not counted passed; its independent rerun passed. No production data or credentials were used by fixture checks. Inspected client bundles contained none of the inspected server secret/adapter symbols; all 36 typed operations remain documented.

A real, certificate-verified **20-turn repeated synthetic English voice endurance** run passed with local Whisper base/Piper and actual OpenRouter `z-ai/glm-5.3-flash`, plus one initial real text turn (21 model requests). It checked bounded credit, capture-off completion, three pause/resume cycles and final Stop. Playback receipts were simulated consumed chunks; the same synthesized waveform was repeated, so this is neither a varied human-conversation study nor a word-error/semantic-safety score. No raw audio/transcripts/reasoning were saved or logged. Total run 204,693 ms included synthetic capture pacing and simulated playback. Warm stage times:

| Stage | Median | p95 | Range |
| --- | --- | --- | --- |
| STT | 421.5 ms | 449 ms | 393–457 ms |
| LLM | 879.5 ms | 1,023 ms | 655–1,151 ms |
| TTS | 184.5 ms | 279 ms | 143–503 ms |
| Whole harness voice turn, including input/playback pacing | 10,142.5 ms | 11,803 ms | 8,436–13,530 ms |

Numeric per-turn evidence is in [speech-pipeline-2026-11-14.json](verification/speech-pipeline-2026-11-14.json). The selected GLM model's mandatory default reasoning exhausted the old 160-token allowance on earlier runs; explicit supported low effort/512 tokens completed the final run. Reasoning is excluded; truncation remains an explicit failure, not a retry or partial reply. Neither server nor private root settings were changed by that command-only override. Cold-start/GPU/VM/Mac/venue/human/semantic-quality acceptance remains pending.

Earlier long runs exposed a local wall-clock correction: a capture rate window reported **−418 ms wall time versus 1,257 ms monotonic**, and playback saw **740 ms wall versus 2,402 ms monotonic**. Gateway rate windows/watchdogs and speech elapsed deadlines now use monotonic time; credential/provider expiry remains UTC. A regression covers backward/forward wall-clock corrections. No system clock/resolver settings were changed. Legacy unnegotiated-audio compatibility, repeated-unmute capture invalidation, stale results/receipts, fixed help/refusal, bounded buffers, output metadata and mic-mute versus approved playback have automated checks. The simulated player also now handles end arriving after its last consumed frame.

English keyword quality is still imperfect: an initial base probe passed 8/10; a later same-waveform base/small five-phrase comparison passed 20/20, while repeated difficult-phrase comparisons passed base 3/6 versus small 5/6. Padding or larger beam size did not reliably eliminate errors. The optional pinned multilingual small model is explicit (no default change/fallback) and slower (~1.2–1.6 s in these synthetic checks). Keep human microphone/semantic/German review open rather than claiming quality solved. The private services are replaceable independently; one earlier real voice turn used the small STT endpoint with the separate base-service Piper endpoint.

The Python wrapper now tries graceful idle-worker shutdown before bounded terminate/kill; the final real engine shutdown exited **0 without the earlier semaphore warning**. This task's speech listener and PostgreSQL cluster were stopped. Models/private env/virtualenv/database/media are ignored. [Protocol/configuration and morning Emilia/Kylie handoff](handoffs/anay-speech-pipeline.md) lists remaining native-rate, framing, local controls, permissions/autoplay and receipt checks; substantive counterpart review is still required before merge/deployment.

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

**Combined deployment gate verification — November 13, 2026:** the isolated `backend-deploy` snapshot now includes the completed A18/A19 PostgreSQL/profile/media increment. With a new private PostgreSQL 14.24 test cluster, the final suite passed **88 tests / 794 expectations**, including credential hash/revocation/restart, delayed checkpoint ordering and key/cookie/OIDC/device separation. Type/Svelte check, production build and formatting passed. Certificate-verified control/WSS/fixture-chat smoke and real PostgreSQL profile/media production-route smoke passed with the domain gate enabled. The control fixture explicitly clears real database settings; the data fixture only uses its dedicated `_test` database. An initial negative smoke request hit the framework's form-origin rejection; using the API JSON content type verified the intended gate 401. Seven Python speech boundary tests had passed in the initial isolated snapshot; those service sources did not change. Live process configuration now requires independent `LEMMI_ACCESS_KEY`; browser unlock uses an expiring signed HttpOnly cookie and devices use a header. No real OIDC provider/domain/Cloudflare/hardware was exercised. Publication keeps the shared developer branch/index untouched. See [deployment handoff](handoffs/anay-backend-deploy.md).

**Deployment branch checkpoint — November 13, 2026:** the user authorized creating/pushing `backend-deploy` while preserving the other Codex session's current branch and staging area. A separate temporary index and `/tmp` checkout captured the backend/speech/shared-contract snapshot. Fresh `bun install --frozen-lockfile` used pinned Bun 1.4.4; 70 Bun tests (664 expectations), 7 Python boundary tests, type/Svelte checks, production build, formatting and the verified HTTPS/WSS control/text-chat smoke with identity/OpenRouter fixtures all passed in that isolated checkout. No real provider, domain/tunnel, new host or robot was tested. [Deployment guide](backend-deploy.md) records process/configuration/routing, ephemeral credential/session restart behavior and pending host checks. Secrets, speech models and virtual environments remain outside Git. This authorization supersedes the older Git-pause notes specifically for publication; the shared branch is not switched.

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

## 16. Ubuntu backend host setup observation — November 13, 2026

On mobrob-Precision-3680, installed checkout-local Bun 1.4.4/cloudflared, protected generated configuration, supervised loopback live gateway/web/private speech and enabled user lingering. Docker PostgreSQL 17 is healthy; Nginx loopback proxy allowlist validated. Fixed missing live `controlConfig` access-key wiring before exposure. Type/Svelte checks, production build, formatting, 88 Bun tests (794 expectations), production data smoke on a dedicated PostgreSQL test database and fixture HTTPS/WSS/chat smoke passed. Seven Python boundary tests passed. Synthetic speech recognition was intermittent and remains a failed quality gate; live device speech stays disconnected. Actual caregiver subject/bootstrap, OIDC introspection, OpenRouter model/key, Cloudflare browser authorization/tunnel/DNS/public TLS and K151 remain pending. No public tunnel, real provider success, hardware acceptance or P0 completion is claimed. See [host setup](host-setup.md) for operations and next private configuration. Anay reviews server/access/storage; Emilia reviews the real device header/pairing/control boundary.

### Cloudflare and VoidAuth follow-up — November 13, 2026

Cloudflare authorization succeeded; created `lemmi-backend`, validated ingress, added the selected hostname route and enabled supervised tunnel service. Four edge connections and verified public HTTPS unlock/gate cookie/logout plus internal/mock/credential denial were observed. Local DNS initially cached NXDOMAIN; checks retained hostname/certificate validation using the published Cloudflare edge address. VoidAuth discovery verified at `/oidc/.well-known/openid-configuration`. Added explicit opt-in `client_id` binding for non-resource tokens; default audience behavior remains strict, and present audiences still require a match. Actual VoidAuth client credentials, login/subject assignment and production Alex bootstrap remain pending, as do real model/hardware acceptance. The new loopback code/PKCE setup helper does not implement browser application login. Substantive Anay review remains required for the auth boundary.

Follow-up checks passed for explicit VoidAuth binding and the loopback setup helper: type/Svelte, formatting, production build, 90 Bun tests / 826 expectations with real isolated PostgreSQL, both production fixture smokes. Dedicated client credentials are saved privately; real caregiver browser login/assignment is pending. OpenRouter key/model are still missing.

Actual OpenRouter adapter check passed with the privately configured model/key: fixed fictional greeting, HTTP 200, ~3.6 seconds, validated complete response; no response text/credentials logged. The paired production session path still awaits real caregiver login and Alex database bootstrap.

Final live-host follow-up: actual VoidAuth code/PKCE login/introspection passed; migrations and fictional Alex assignment bootstrapped; gateway/web restarted with PostgreSQL/OpenRouter enabled. A computer harness created pairing using the private authenticated server authority, claimed through the actual Cloudflare HTTPS route, read the scoped persistent participant profile, and passed verified public WSS Start → real OpenRouter greeting → Pause → Resume → Stop; rehearsal credential revoked. Provider token discarded; no public caregiver bearer pairing request or physical hardware acceptance claimed. The lab resolver still returns no record despite cache flush; public DoH DNS resolves, and live checks retained hostname/certificate validation using the published edge IP. Normal hostname-only clients on this host remain subject to that DNS limitation. Speech quality remains intermittent; no integrated microphone/camera/media completion or full P0 completion claimed.

### Backend host redeployment — `04d050e`

Reviewed the backend merge-verification handoff and the stale-authority credential fix. Before changing running services, an isolated checkout on the deployed host passed Bun 1.4.4 frozen install, check, 91 Bun tests / 833 expectations with isolated PostgreSQL 17, seven Python fixture-boundary tests, production build, formatting, and both production control/chat and data fixture smokes. Fast-forwarded from `51ede5e`, retained the old source/build privately, installed the verified build and restarted only web/gateway. No dependency/schema migration, private environment replacement or database reset was needed.

Post-restart public unlock/gate/cookie/logout/internal/mock denial passed. Private-authority pairing → actual public HTTPS claim/persistent participant profile → verified public WSS Start → actual OpenRouter fictional greeting → Pause → Resume → Stop passed; rehearsal credential revoked. Normal system DNS now resolves the domain; hostname-only verified HTTPS unlock returned 200. Web/gateway active with zero automatic restarts; database healthy. No physical device, camera, microphone, notifications, new actual caregiver login or reboot rehearsal was performed. Speech recognition remains an unresolved prior quality gate. Updated [backend status](backend-status.md); actual provider observations remain separate from fixture results.

### Python Stackchan pairing helper — November 14, 2026

Added standard-library `scripts/pair-stackchan.py`: existing VoidAuth state/PKCE loopback login → public caregiver pairing route, printing only the private unclaimed pairing details needed for provisioning. It does not retain tokens, change configuration, revoke/claim, start a session or exercise hardware. Four local fixture tests passed (OAuth state/PKCE, public auth/fresh command IDs, assignment/HTTPS constraints, unchanged settings). Actual use of this helper against the live pairing route and firmware provisioning remains unrun. Backend status/API usage updated; no server deployment changed.

### App-data schema review — November 14, 2026

Separate later local acceptance, November 14: on `anay/app-data-schema`, reviewed Emilia's `4e8993f` app-data draft and promoted only corrected media-collection storage to `002_media_collections.sql`. Native isolated PostgreSQL 14.24 passed fresh install, populated foundation upgrade, atomic DDL/ledger rollback, unchanged foundation checksum, scope/type/position bounds, stable entry reordering and metadata cascades. All 97 Bun tests / 875 expectations, type checks, build, formatting and production fixture HTTPS/data smoke passed. A separate disposable diagnostic applied the original full draft and confirmed missing excerpt-grant, dependent-summary deletion, alias-namespace and acknowledgment-actor guards. Those areas remain inactive proposals with required service work documented in [Anay's review](handoffs/anay-app-data-schema-review.md). No deployed database, firmware or running service was changed; counterpart review and actual host upgrade remain pending.

### Chat hardening and server communication presets — November 14, 2026

Isolated branch `anay/chat-support-hardening`, based on speech commit `151ebc3`, implements English reviewed input/reply/failure fixtures and the caregiver support-state read/default-save/apply seam. The central resolver supplies distinct Conversational/Guided/Quiet policy; apply-now pauses, invalidates stale speech, updates activity presentation context, checkpoints private configuration provenance and requires explicit participant continuation. Database race checks cover denied/stale actors and revisions, idempotent retries, blocked Resume during writes, failed commits/checkpoints and Stop winning over delayed completion. No model-based staging or privacy/contact/voice changes were added.

Pinned Bun 1.4.4: **127 tests / 2,824 expectations**, Svelte/TypeScript and formatting passed. Native isolated PostgreSQL 14.24 tested the feature without media migration 002 and the existing backend regression with 002 plus new independent 003; the original 001 checksum is unchanged. Production build and fixture HTTPS/control/chat smoke passed; the expanded built HTTPS/data smoke passed caregiver support read/save/apply/retry/Resume/Stop, private gate/device/GET denial and stale-retry rejection. Identity/control endpoints in those smokes are computer fixtures. The new harness initially used an incorrect Start wire name; it was corrected to existing `input.start` and now validates outbound frames through the shared device schema.

Actual GLM text rehearsal initially passed 14/15: the zero-question guard rejected a Quiet follow-up. Quote instruction alone yielded 4/5 on a targeted run; explicit declarative-only Quiet wording yielded 5/5 targeted and final **15/15** across all presets. Four explicit rehearsals made 40 calls total, with no automatic retry. Final low-reasoning/512-token run took 740–2,894 ms per turn. [Artifact](verification/chat-support-2026-11-14.json) stores only fixture IDs, booleans and numeric diagnostics; no prompts/replies/keys. Human semantic review, German, real microphone/speaker/K151 and shared-boundary review remain pending. See [exact API/storage/client handoff](handoffs/anay-chat-support-hardening.md). The speech/schema branches under separate server review and the remote deployment were not modified by this work.

### Speech concern-response review fix — November 14, 2026

On `anay/speech-pipeline`, based on `151ebc3`, fixed the reproduced urgent voice gap: recognized urgent/unwell/refusal replies now receive new output authority after canceling the input and pausing. Fixed synthesis/playback keeps the session paused and capture off. A gateway regression exposed that the new generation was not published until TTS completed; the fix now broadcasts it before synthesis so Stop can use current state. No route/schema/dependency changes or production deployment were made.

Pinned Bun 1.4.4, separate worktree, disposable PostgreSQL 17: **116 Bun tests / 2,438 expectations** and **seven Python boundary tests** passed, as did type/Svelte check and production build. New tests cover fresh IDs/generation, model bypass, fixed PCM/receipts, completion staying paused, cancellation during synthesis and queued/playing output, late PCM wiping, obsolete receipts, mute/resume behavior and failure/expiry. Production data and TLS/control/chat fixture smokes passed. The supplied suites' earlier green review did not cover the audible fixed-reply regression; that case is now automated. Hardware/local-control, human recognition quality and counterpart acceptance remain pending. Running deployment and private configuration are unchanged.

Final integration check with the previously reviewed `anay/app-data-schema` (`cff8554`) content passed **122 tests / 2,480 expectations** on separate PostgreSQL test/schema databases. The fixed branch also passed certificate-verified WSS with a six-second fixture output and three synthetic turns using this host's separately started CPU Whisper/Piper engines (fixture LLM, simulated consumption, no microphone/speaker or external provider call). That isolated worker exited 0 without a semaphore warning. Final source formatting and diff-whitespace checks passed. The disposable test container/databases were removed after checks. No push/merge/redeployment was performed; local source is ready for Anay's review and later push instruction.

### Speech branch merge with main — November 14, 2026

Merged `main` at `a6f7ff9` into `anay/speech-pipeline` after speech fix `3fb561d`. The only content conflict was this plan's appended verification records; both the app-data review and speech-fix evidence are retained. Updated backend status/API wording to reflect the schema's presence in main without changing the recorded deployment. No application source or existing migration was edited to resolve the conflict.

On the resolved tree, pinned Bun 1.4.4, disposable PostgreSQL 17 and separate runtime/schema-test databases: **122 tests / 2,480 expectations**, type/Svelte check, production build, formatting, whitespace and production data smoke passed. TLS/identity were fixtures. No physical hardware, real provider request, new speech quality check, production database or running service was involved. The shared checkout remains on `backend-deploy`; publishing this resolution updates only the speech feature branch and leaves the final main merge to Anay.

## Observed multi-profile/browser increment — November 14, 2026

### Main-to-backend deployment — November 14, 2026

Integrated main `24e7fe2` into backend-deploy as runtime `275de72`; retained the local pairing helper and historical branch-review findings with a link to the subsequent concern fix. The only merge conflict was appended verification prose; both records were preserved. Before restart an isolated checkout passed Bun 1.4.4 frozen install, check, **122 Bun tests / 2,480 expectations** with separate PostgreSQL 17 runtime/schema databases, seven speech Python tests, four helper Python tests, production build/format, production control/data fixture smokes and the six-second output/receipt speech fixture smoke.

Created a private PostgreSQL dump/source/build backup, applied the reviewed metadata-only migration and restarted web/gateway/private speech. No full proposal, reseed, private config/model/voice/accelerator change or public speech enablement occurred. Alex persists and both migration names are in the ledger. Services active with zero automatic restarts. Normal hostname HTTPS unlock/public gate/cookie/logout/internal/mock/invalid-device denial passed. Real persistent private-authority pairing → public claim/profile → verified WSS text greeting using actual OpenRouter → Pause/Resume/Stop passed, credential revoked. Three synthetic CPU local-engine turns also passed isolated verified WSS with fixture LLM and simulated consumption (STT 291/286/292 ms, TTS 50/98/94 ms). These are transport/adapter observations, not human recognition accuracy or speaker proof. No production voice, physical microphone/speaker/camera, fresh caregiver login, notification, reboot or venue test was performed. Public voice stays disabled pending quality/counterpart/hardware acceptance. Status/API/host guides updated.

Initial checks needed sandbox escalation because local listeners/checker workers were restricted; an earlier broad run exposed a missing-credential error-order regression and a test race that observed processing before the model adapter started. The Origin guard was scoped to cookie authentication and the test now awaits actual adapter entry; final integrated checks passed. These observations establish software/fixture behavior only. No actual microphone, speaker, browser keyboard/zoom run, K151 firmware/flash, external provider, deployed host or real participant was exercised. Camera, complete activities and durable contact/journal/policy/deletion workflows remain outside this increment. Deployment/main/shared checkout were unchanged. [Exact integration and next handoff](handoffs/anay-multi-profile-endpoints.md).


## Local frontend/backend integration preparation — November 14, 2026

On the separate `integration/frontend-backend` worktree, combined Teach Lemmi/Alex (`c006d26`), the latest **local uncommitted UI copy** from `.worktrees/kylie-ui`, and Anay's browser enrollment/endpoint branch (`284dcb7`). Original UI and firmware worktrees remain untouched. Preserved scoped coordinators, fixed-reply paused-state publication, per-profile teaching expiry and current revision handling; added live teaching controls and stale reply projection checks. No deployment, shared database, actual model/media or notification action occurred.

Observed on this Mac with Bun 1.4.4: frozen install (lock unchanged), check with 0 Svelte errors/warnings, build and format check passed. Canonical `TMPDIR=/private/tmp` plus loopback access: **154 tests passed, 20 database tests skipped, 0 failed; 2,832 expectations**. Production fixture HTTPS/WSS control smoke and the existing web smoke with only its origin adapted to isolated port 5187 passed. Chrome mock text rehearsal verified the preserved dashboard/Alex background, teaching start/roses reply, Pause, keyboard Resume, Not sure/topic change and Stop. No live browser microphone/speaker, K151, combined PostgreSQL/migration or deployed acceptance is claimed. Anay must review the merge and run combined database/participant production smokes before deployment. Exact changes, environment failures, evidence and remaining gates: [frontend/backend integration handoff](handoffs/frontend-backend-integration.md).

Final UI follow-up: preview logs exposed snapshot-driven resubscription in the imported mock component. Derived scalar session/activity IDs now keep subscriptions stable. A fresh Chrome Start → teaching/Gardening → Stop rehearsal passed; observed **3 session reads over 3 seconds**. Type/Svelte check (0 errors/warnings), production build and full format check passed again after this UI-only change. Owned previews were stopped; the original local servers and uncommitted UI/firmware were preserved.
### Persistent device credential backend — November 14, 2026

On `anay/persistent-device-credentials`, isolated from the live redeployment agent and based on `618bec2`, implemented caregiver-selected `credentialMode:'persistent'` using existing pairing/claim/revoke routes. Claim and device-ready expiry are nullable for this mode. Only a hashed per-device key survives backend restart; pending codes, default one-hour credentials and active sessions do not. Gateway ownership, explicit Start/capture-off behavior and caregiver/participant separation remain enforced. Durable bounded revocation receipts preserve retry safety across restart; stale authorities cannot replace/revoke the current key. Enrollment/claim recheck current caregiver assignment. Migration `003` does not upgrade existing keys.

Observed with pinned Bun 1.4.4 and disposable PostgreSQL 17 on loopback 55447, separate runtime/schema-test databases: **130 Bun tests / 2,533 expectations** passed, including real gateway reconnect with the same key after restart, no restored session/capture, live-socket revocation, old-authority rejection, long idle validity, post-restart revoke retries sparing replacement keys, deletion, receipt capacity and populated-schema upgrade/checksum/rollback guards. Type/Svelte check, production build, formatting and whitespace checks passed. Production SvelteKit → PostgreSQL smoke passed both default and `--persistent` enrollment, scoped profile/media reads and committed revocation with verified fixture TLS/identity. Existing production control/chat fixture smoke passed. **Five Python pairing-helper fixture tests** passed, including explicit `--persistent`; a fixed-port collision in the original callback fixture was corrected by binding an ephemeral fixture port, without touching any existing listener.

No real caregiver login, public pairing, external model/notification provider, microphone/speaker/camera or physical robot was used. No deployed schema/configuration/services or firmware were changed; no push/merge/redeployment was performed. Anay explicitly assigned robot credential storage to Emilia; this task is backend-only. Exact migration/rollback limits, expiry-null contract, helper command and firmware handoff: [persistent device credentials](handoffs/anay-persistent-device-credentials.md). Deployment and counterpart review remain pending.

### Pairing helper default follow-up — November 14, 2026

On Anay's request, `pair-stackchan.py` now requests persistent enrollment by default. `--persistent` remains a compatible explicit alias; `--short-lived` requests the original one-hour key, and conflicting flags are rejected before any login/request. The underlying HTTP API's omitted-mode behavior remains unchanged. Six local Python fixtures passed, including actual CLI-to-request-body checks for all modes and the existing PKCE/authorization/assignment protections; `--help` and diff-whitespace checks passed. No live pairing, database migration or running service was changed.


### Integrated chat/support follow-up

Merged server speech fix `3fb561d` and main `a6f7ff9` into `anay/chat-support-hardening` without changing their branch pointers. The merged fixed-output path also covers the new frightening/navigation/privacy-refusal routes. Added a regression proving that a future-only preset save preserves paused fixed guidance, while explicit apply cancels pending/queued/playing fixed speech. Unknown profile COMMIT results are reconciled through an authorized read before continuation; an unavailable reconciliation disables continuation until gateway restart after database recovery while Stop/help remain available. The configuration queue is bounded to 32 pending operations, including while SQL is blocked.

Final integrated Bun suite: **143 tests / 3,318 expectations**, with all three migrations and separate backend/support/media databases. Svelte/TypeScript, production build and formatting pass; final built HTTPS data/support and fixture HTTPS/WSS chat-control smokes pass. Earlier standalone tests without 002 and the 15-turn real-model artifact above remain distinct from the integrated fixture checks. No new live-model requests, physical checks or deployment changes were performed for this follow-up.

### Persistent credentials first, chat/support deployment — November 14, 2026

Squash-merged persistent branch `41b1ea3` into main as `c402edc` first, after 130 Bun tests / 2,533 expectations and persistent production data smoke. Then combined hardening `bc83231` as squash `430269f`; integrated into backend-deploy runtime `d067ac0`. Conflicts preserved verification records, selected the persistent-default helper, and reconciled production smoke output / four-name migration expectations. Full backend tree matches the tested main tree.

Combined acceptance: 151 Bun tests / 3,371 expectations on separate PostgreSQL 17 runtime/schema/support databases, six Python helper and seven Python speech-boundary tests, type/Svelte/build/format, persistent/default data/support smokes, control/chat fixture and long-output speech fixture. Backed up private database/source/build/proxy, applied both independent `003_*` migrations, installed verified build and reloaded validated support allowlist. Public gate and support missing-key denials passed. Same temporary persistent key authenticated after actual gateway restart, no active session restored; public profile/WSS and final real greeting/Pause/Resume/Stop passed; key revoked. Initial model failures under 160/default settings remained explicit; host GLM now uses documented low/512 settings and final rehearsal passed. No automatic provider retries/fallbacks or prompt/reply/credential logs.

No device firmware/storage, physical mic/speaker/camera, new real caregiver support apply, human semantic acceptance, reboot or venue tests were performed. Public speech stays disabled. Persistent downgrade requires revocation via new code or reviewed restore/migration. Current status/API/host docs record the live-versus-fixture evidence.

Pairing helper diagnostics: eight local Python fixtures passed after adding sanitized stage/status output and provider-body redaction; existing state/PKCE and persistent-default tests remain green. Read-only live discovery and expected caregiver-less HTTP 401 passed. No new enrollment/revoke was performed; user's post-callback failure remains under diagnosis. Runtime/public voice configuration unchanged.

One-file team credential follow-up: user explicitly requested revocation of the existing key and a reusable shared test credential. Old key was durably revoked; a replacement persistent computer credential was created via private authenticated authority, claimed over public HTTPS, saved to ignored mode-0600 `.data/stackchan-access.json`, and verified against the scoped participant profile. Replacement deliberately retained for user use; no token/header values logged. Helper now claims/saves the bundle by default; `--pair-only` retains robot-side enrollment. Ten Python fixtures passed for OAuth, modes, safe errors, claim headers, secret exclusions, private-file output, overwrite refusal and failure cleanup. No server/schema/deployment, caregiver privileges, multiple-WSS support, physical confirmation, microphone or speaker acceptance changed.

### Multi-profile endpoint integration preparation — November 14, 2026

User explicitly authorized full fictional multi-profile scope. Reconciled endpoint branch 284dcb7 with the deployed persistent-key/chat-support code in an isolated checkout. Agent reviews covered credential transaction/epoch/membership/null-expiry preservation and per-profile support/cancellation. Preserved applied migration checksums; replaced the branch's colliding receipt-table creation with 004_endpoint_revocations.sql, retaining legacy receipts and existing key hashes. Added per-profile support and credential/migration race regressions. Existing example cards stay preview-only.

Candidate checks: Bun 1.4.4 frozen install, type/Svelte, 169 Bun tests / 3,585 expectations on separate PostgreSQL 17 runtime/schema/support databases, ten pairing-helper Python tests and seven speech-boundary Python tests, build/format/diff checks, built participant cookie/enrollment/concurrent-WSS/restart/release smoke, persistent data/support, control/chat and long-output speech fixture smokes passed. These use fixture providers/clients and simulated playback, not physical robot/human acceptance. Teach Lemmi was reviewed separately and remains unmerged pending per-profile ownership, timer and live-participant adaptation. Actual host upgrade/restart and public endpoint observations are recorded only after deployment below.

Multi-profile host deployment observation: runtime `17a8522` installed after the checks above. Backed up private DB/config/source/build, applied only reconciled compatibility migrations, enabled fictional enrollment and validated/reloaded proxy routes. Preserved the active shared indefinite key; public participant profile read with it passed. Public gate/participant HTML/demo route denials passed. Created two clearly fictional rehearsal profiles, enrolled distinct robot endpoints and verified simultaneous public WSS Start/Pause/Stop with profile isolation and audio false. Only rehearsal endpoints/profiles were revoked/removed; shared key unchanged. Web/gateway active with zero automatic restarts. No browser UI/hardware, new actual caregiver login, human recognition, real-model multi-profile conversation, reboot or venue test was run. Backend status/API/host instructions updated. Teach Lemmi reviewed but deliberately unmerged for now because its old gateway/live-shell assumptions need per-profile ownership/timer adaptation.

### Emilia frontend/backend integration backend gate — November 14, 2026

On `anay/frontend-backend-integration`, reconciled Emilia integration `437f065` with deployed-source `7debf9a` in an isolated worktree. Retained source/UI history and all six deployed SQL bytes; excluded old incompatible receipt migration. Added teaching/support coexistence/fencing regressions and fixed browser paused fixed-output/receipt behavior plus background suppression. Preserved the broader reviewed Stop phrases after the first combined run exposed the merge regression. Explicit generic participant art/font proxy paths and production asset checks were added; no private static-directory alias was introduced.

Observed Bun 1.4.4/PostgreSQL17: **212 tests / 3,991 expectations, no skipped database cases**; dedicated migration/credential compatibility **10 / 74**; ten helper/seven speech Python tests; frozen install, type/Svelte/build/format/diff checks passed. Built participant cookie/concurrent-profile/ownership/restart/release, persistent data/support, control/chat and six-second speech fixture smokes passed. Fixture model/identity/audio consumption only, no physical browser/K151/provider/session/config/deployment change. No main/backend-deploy merge or publication by this pass. [Detailed handoff, source decisions and remaining acceptance](handoffs/frontend-backend-integration.md#backend-integration-follow-up--november-14-2026).


### Public speech configuration observation — November 14, 2026

The deployment owner enabled speech on the existing `17a8522` runtime and observed one synthetic public verified-WSS turn through actual local STT → real OpenRouter → local TTS: **141 capture frames / 421 output chunks**, with simulated consumption receipts. This is actual provider/transport evidence; it is not browser microphone/speaker, human English recognition, K151 local-control or new frontend/Teach deployment acceptance. The reconciled frontend/Teach candidate retains its separately recorded 212-test fixture/database gate. Remote browser rehearsal is the next check: [steps and failure reporting](handoffs/remote-voice-test.md). No raw audio, transcript, reply or credential is retained in this acceptance record.


### Frontend/Teach host deployment acceptance — November 14, 2026

Anay deployed `f5724a0` from `anay/frontend-backend-integration`, including Teach Lemmi. Final isolated suite: 213 passed / 4,045 expectations, no skips; type/build/format, helper/speech tests and built participant/persistent data/control/speech smokes passed. Public fictional rehearsal passed owner-scoped teaching, actual model reply, topic advance, Pause/Finish preserving pause/Resume/Stop and profile isolation; existing persistent key survived. User approved all three reviewed teaching topic IDs for fictional Alex. No new migration or firmware flash. Browser microphone/autoplay/speaker, K151 controls and venue/reboot acceptance remain pending. See current backend status and remote voice handoff for exact runtime availability.

### Repository UI layout cleanup — November 14, 2026

**Profile import correction:** The initial selective import below was incomplete. Imported Kylie's `AdditionalInformation`, `ConversationSummary` and `PhotoStoryFiles` components, the profile-scoped paper/tape summary styles, and the `profileId` connection from `43a6064`. Added the required browser-only picture context and minimal data wiring to the existing participant Photo story preview; the surrounding header/menu, typography, participant layout/controls and original avatars remain ours. Only Alex can add preview pictures. Pictures are reviewed before approval, stay in the current tab, are revoked when removed/unmounted, and are not uploaded, persisted or sent to AI. This supersedes the earlier exclusions of additional-information and summary changes.

Observed correction: pinned Bun `check` passed with zero Svelte errors/warnings, production `build` and whitespace checks passed. Browser verification selected fictional repository artwork, reviewed and approved it, displayed its blob URL/caption in the existing participant preview with caregiver navigation hidden, then removed the test picture. Visually inspected the restored paper/tape summary cards. No live session, server storage, AI picture processing or hardware acceptance is implied. Next handoff: Kylie reviews the complete selected profile and Games integration.

**Selective Kylie update:** Fetched `origin/codex/kylie-ui` at `43a6064` and imported only the profile appearance editor and Games catalog from its change over `11f2ed1`. Imported `ProfilePanel.svelte` appearance controls, the dashboard's local background callback/URL lifecycle, the required appearance CSS selectors, `GamesCatalog.svelte`, and its dedicated `photo-story-bubbles.png`/provenance. Kept the existing `AdditionalInformation` API (no profile-photo-sharing context), summary layout, settings pages, root header/left menu, typography, participant routes and five avatar assets. No branch-wide merge or main/backend updates were applied. A pre-import archive/file comparison confirmed no other existing source files changed in this integration.

Observed: Bun 1.4.4 `check` passed with zero errors/warnings, `build` passed, and whitespace checks passed. Browser checks confirmed read-only mode has no portrait file input; Edit exposes photo/background controls; choosing Sand then Cancel restored Sage and removed the edit-only input. Games details and preview opened; the dedicated Photo story image loaded (1536px natural width), with no modal horizontal overflow at the inspected narrow width. Escape closed the modal and restored card focus. Add more → Music added a page-local card; reload restored the initial two-card catalog. These are mock/visual previews, not live games, file-upload persistence, camera or speech acceptance. Actual file selection/approval/storage and full accessibility checks were not run. Next handoff: Kylie reviews the selected editor/catalog integration while retaining this branch's surrounding UI.

**Product styling follow-up:** Added locally served Nunito variable typography (original OFL license included under `apps/web/static/fonts/`), a heavier rounded wordmark/heading hierarchy, tactile sage/cream buttons with hover/pressed/focus/disabled states, decorative SVG control icons, richer profile portrait treatments using the existing avatar, and illustrated activity/setup cards with factual availability labels. Menu moved to the left and now groups workspace destinations, settings/privacy controls and the existing caregiver account/photo preview. Navigation links use the existing caregiver route with Profiles/Games/Ecosystem hashes, which also preserve selection with browser Back. Example cards remain static, with zero links/buttons. No new session store, APIs, sign-in flow, media playback or live profile management was added.

Observed follow-up: local font loading confirmed in the browser (no third-party runtime font request); menu links opened the correct folder; keyboard tab switching and browser Back worked; Escape restored focus to the menu button. Desktop at 1440px and narrow layout at 390px had no horizontal page overflow. Participant conversation retained hidden caregiver navigation and a 56px preview button. Original avatar files/mapping/component remain unchanged. Type/Svelte check passed with zero errors/warnings, production build passed, and changed source formatting/whitespace checks passed. Full accessibility/contrast audit and live-service/hardware checks remain unrun.

On `codex/kylie-ui-refinements`, applied the user's requested cleanup directly to the existing SvelteKit app. Added a persistent Lemmi wordmark/header and skip link; kept Kylie's Profiles/Games/Ecosystem folders; aligned the toolbar and responsive profile grid; rendered the existing Morgan/Sam preview fixtures as static, clearly labeled cards with no actions. Alex remains the only functional profile. The account drawer now overlays content without changing its width. Profile dialogs, avatar choices, supporting text and controls use consistent sizing. Conversation has its own Lemmi title, a shorter responsive avatar area and no caregiver navigation; photo-preview controls wrap at phone widths. The original five avatar assets/mapping/component are untouched. No backend, activity rules or Figma files changed during this repository cleanup.

Observed with pinned Bun 1.4.4: `check` passed with zero Svelte errors/warnings, `build` passed and `git diff --check` passed. Browser checks covered the desktop dashboard, Games keyboard navigation, profile search/no-results, Alex's dialog and phone-width dialog overflow, drawer Escape/focus recovery, camera/settings/login layouts, conversation and photo preview. At 390px, the inspected dashboard/dialog and photo preview had no horizontal overflow. The desktop conversation's preview button was fully visible, at least 56px tall. Photo preview Stop returned to the ready screen. Full accessibility/200% zoom, hardware and live-service acceptance were not run. Functionality remains mock-backed; camera/voice/sign-in availability is unchanged. Next handoff: Kylie reviews the implemented spacing/sizing and retained folder structure.

### Kylie UI decorative material pass — November 14, 2026

On isolated branch `codex/kylie-ui-refinements`, the user requested generated soft game-style assets while preserving Kylie's existing format/layout and all custom animal avatars. Added a static conversation meadow surround and low-contrast cream paper material for existing folders/cards, plus inset highlights and shallow surface shadows. The original dashboard banner, five avatar images, avatar mapping/component, controls, client calls and mock availability are preserved. Asset provenance and exact built-in image-generation prompts are in [the surface asset notes](../apps/web/static/images/surfaces/README.md).

Observed: pinned Bun 1.4.4 `check` passed with zero Svelte errors/warnings, `build` passed, changed source files were formatted, and `git diff --check` passed. Browser inspection covered caregiver dashboard and conversation at 1280 × 720 and 390 × 844, with no horizontal page overflow at phone width. Dashboard arrow-key/Home tab navigation worked. SHA-256 checks confirmed all five original avatar PNGs unchanged. No layout geometry or behavior changes were introduced; this is a visual pass over the same local mock. No live speech/camera, hardware, full accessibility audit or production readiness is established. Next handoff: Kylie reviews the material/art direction and placement; no server/activity/device interface changes are needed.

### UI publication check — November 14, 2026

At the user's request, prepared the existing local UI refinements for publication
on `codex/kylie-ui-refinements`. Re-ran pinned Bun 1.4.4 `check` (zero Svelte
errors/warnings), production `build`, and `git diff --check`; all passed. No new
browser acceptance was performed in this publication pass. This branch preserves
the designed mock caregiver/participant previews, fonts and decorative assets;
it is not the deployed backend integration branch. Anay/Kylie must reconcile UI
changes with `backend-deploy` before deployment, retaining its live participant
enrollment/transport/teaching and cancellation fixes. Caregiver sign-in and live
dashboard integration remain unfinished. No firmware, credentials, migration,
server deployment or live-data claims are included in this UI publication.


### Main-based Kylie visual alignment — November 14, 2026

On `codex/main-ui-alignment`, based on `origin/main` at `818b269`, compared
`codex/kylie-ui-refinements` at `d8a6fe4`. Main already contains the reference
styles, fonts, art and dashboard. Aligned the separate live profile panel with
the reference section/card/avatar layout and the live conversation with its
larger avatar/spacing, preserving existing API/session/audio/teaching handlers.
Private fields, trends, excerpts and upload remain explicitly unavailable; no
mock caregiver data or settings are shown as live. No server/API/auth/migration
or firmware change.

Observed: pinned Bun 1.4.4 frozen install (unchanged lock), type/Svelte check
(zero errors/warnings), production build; existing suite **183 passed, 33
database tests skipped, zero failures / 3,818 expectations**. Chrome inspected
the live profile component and disconnected live conversation using a temporary,
explicitly labeled fictional visual harness at desktop/390 × 844, including
profile Escape dismissal. Corrected an overflowing unavailable-settings label.
The harness was removed before final validation/publication. Browser control
later failed with a ScreenCaptureKit stream error; no full live interaction or
active-session phone-control acceptance is claimed. Database production smoke,
real speech/K151 and counterpart review remain pending. See
[review handoff](handoffs/main-ui-alignment.md). No merge/deployment by this pass.

### November 14 — voice-led teaching UI increment

The user requested voice participation without teaching action buttons. The integration checkout now presents the current teaching topic/prompt and real listening/pending/paused/unavailable states, hides teaching text entry, and removes topic/feedback/finish action buttons. Explicit entry, microphone and shared safety controls remain. See [voice UI handoff](handoffs/teach-lemmi-voice-ui.md) for remaining backend voice entry/finish/narration work. Twenty relevant automated tests, type/Svelte check and production build passed; visual/keyboard, real voice and deployment acceptance remain pending. F17 acceptance stays pending.

November 14 avatar follow-up: enlarged the participant/teaching preview avatar and
bound mouth frames to browser playback time, with immediate close on cancellation
and no animation while awaiting audio. Six audio/presentation tests passed; checks
and build passed; Chrome larger-avatar rendering observed. Real speech synchronization,
all-avatar visual review and deployment remain pending; see voice UI handoff.

### November 14 — Lukas teaching logic integrated with voice UI

Integrated codex/teach-lemmi 4690bf6 with the larger-avatar voice UI on
integration/frontend-backend. Conversation → Play Teach Lemmi opens the same
VoiceTeaching component as /participant/voice; current replies update the main
text, and mouth frames follow local playback. No topic/feedback buttons or text
form on these voice surfaces. Full suite: 181 pass, 20 database-dependent skipped,
0 fail; type/Svelte and production build pass. Chrome confirmed entry and truthful
unconfigured-voice state. Real voice, deployment and counterpart speech-boundary
review remain pending; see the updated voice UI handoff. No P0/F17 completion claim.

November 14 live voice rehearsal blocker: fixed device.ready rejection of the
backend's optional boolean photoStory capability; microphone-off live handshake
now validates. Backend immediately closes with 1011 “Persistent data unavailable.”
UI now reports the storage outage explicitly. Fourteen client tests, type/Svelte
and build pass; real voice acceptance remains blocked pending deployment-owner
persistence repair. No model/capture requests or deployment changes in this probe.


### Teach Lemmi UI deployment and persistence recovery — November 14, 2026

User requested urgent deployment of frontend integration `b27980a` and repair of `Persistent data unavailable`. Runtime `9ad7446` merges that UI with existing public Photo Story and uses profile-scoped HttpOnly browser enrollment, bundled capture worklet and exact five avatar sprites. An isolated deleted-profile regression reproduces the prior global checkpoint disconnect and verifies unrelated profile sockets/checkpoints continue after the fix without restoring deleted rows. Observed: 268 Bun tests / 4,558 expectations, zero failures/skips, frozen install, zero-error/warning Svelte/TypeScript, production build, proxy syntax and whitespace checks. Web/gateway restarted with private source/config/database rollback backup; four services active and zero automatic gateway restarts. No schema, keys or provider settings changed. Human microphone/speaker, keyboard/zoom, robot and counterpart technical/visual acceptance remain unrun for this release. Public synthetic acceptance is recorded in backend status once observed.

Public post-restart acceptance: gate-protected conversation page, all five actual sprite images, temporary fictional profile creation/browser-cookie enrollment, owner Start, teaching topic selection and actual local TTS prompt output passed with paced simulated consumption. No microphone capture or audible-playback claim. Initial harness receipts ran too quickly and hit the existing control budget; the corrected run passed prompt speech. Its later typed topic-change assertion incorrectly expected a spoken response from the text-only input path; that harness assertion is not evidence of a voice failure. Actual spoken teaching-control continuity is covered by the automated STT/TTS/WSS regression. Cleanup releases/removes only the temporary rehearsal endpoint/profile.
### Automatic browser turn ending — November 14, 2026

On isolated `anay/natural-speech-turns`, based on integration `a7d5528`, added same-origin pinned WebRTC WASM detection inside existing granted browser capture. Four seconds of post-speech silence ends the turn; resumed speech resets the wait; manual Finish speaking remains. Initial silence uses existing explicit pause after 15 seconds, without recognition/model submission, rather than the target waiting state (documented candidate limitation). No new wire action, capture authority, TTS voice, firmware, database or deployed configuration change. Added opt-in content-free browser/backend stage durations and playback-gap observations. [Configuration, limitations and handoff](handoffs/natural-speech-turns.md).

Observed with pinned Bun **1.4.4**: frozen install and type/Svelte check passed. Final regression run: **189 passed / 33 database cases skipped / 0 failed**, **4,090 expectations**; one additional caregiver PKCE case explicitly excluded because an existing SSH tunnel owns its hardcoded port 3333. An earlier full attempt recorded that bind failure; the tunnel was not stopped or changed. No disposable database was configured for this speech-only change. The first unpinned script invocation resolved global Bun 1.3.11 and failed sandbox socket checks; only the subsequent pinned run with normal loopback permissions is the acceptance result.

Production build passed on pinned Bun after a sandbox worker-stdio `EPERM` retry with normal permissions; the built client includes the 20,560-byte WASM and BSD notice. No provider/admin secrets were added to client environment definitions. Real WASM silence/lifecycle tests pass separately from injected speech classifications. Headless Chromium 141 exercised real Web Audio/BrowserAudio with an in-memory fixed local Piper phrase and fixture grant: capture disabled before grant, one silence-triggered end, 309 matching frames, closed track, no errors or external browser requests. No audio files, human mic, physical speaker/K151, actual provider call or live backend session were used; full participant keyboard/permission/error-flow and subjective voice quality remain unrun. The temporary web server was stopped.

Before merge, Kylie reviews participant/fallback wording and actual browser flow; Anay reviews cancellation/configuration/timing; Emilia owns robot detection/local-control and room/hardware acceptance. TTS voice/pacing listening comparison remains next, rather than claiming this change improves the voice model itself. Nothing merged, pushed or deployed by this increment.


### Selected pause and HFC voice — November 14, 2026

The user reported Lukas’s browser trials favor approximately **1500 ms** and requested that default plus **`en_US-hfc_female-medium`**. Updated browser fallback/config/example defaults and current experience/technical guidance; retained selectable 1500–8000 ms and manual Finish speaking. Existing firmware has no connected endpoint detector, so 1500 ms is explicitly a Stackchan handoff target, not a flashed/verified behavior. Both endpoint types receive the same server-generated voice; no robot TTS model/second voice selector was added.

Pinned HFC ONNX/config/model card at voice repository revision `6b9cfaacb4fb2e02a9621227e3c1a48bec9710c3`, with sizes and SHA-256 hashes, and updated provisioning/new private-config generation. Existing private environments remain preserved. Model card links Hi-Fi-Captain under **CC BY-NC-SA 4.0** and names hifi_tts_92 provenance; documented noncommercial demo selection and later commercial permission review. Piper 1.8.0 consumes the recommended inference values from the voice JSON. Same output format: mono PCM16, 22,050 Hz.

Observed on isolated branch setup: hash-verified download; generated private config mode 0600 and HFC selection; repeated configure preserved all existing bytes. Real local wrapper synthetic TTS→STT smoke **passed** (209 ms synthesis / 623 ms recognition in one run), no audio file or transcript logging. Headless Chromium with actual WASM/Web Audio, HFC fixed phrase and 1500 ms default **passed**: one end, 193 matching frames, track closed, no errors/external browser requests. These are synthetic checks, not human speech quality/robot tests. Bun 1.4.4 regression: **189 passed, 33 database cases skipped, zero failed / 4,090 expectations**; existing PKCE port-3333 test excluded because an SSH tunnel owns that port. Seven Python speech boundary tests passed. Type/Svelte/format checks and final production build passed. No shared service/config, real contact, firmware or provider was changed. Temporary local listeners were stopped. User requested pushing only the feature branch after checks.


### Speech worker pools and CUDA server handoff — November 14, 2026

User requested GPU speech acceleration and removal of one-at-a-time STT/TTS, then explicitly delegated actual CUDA/server setup to an agent on the testing server. Implemented locally on `anay/natural-speech-turns`: separate bounded gateway STT/TTS lanes and per-engine Python process pools (1–4 each), independently cancelable native work, bounded eight-waiter admission, explicit busy failures and safe readiness counts. Added explicit CUDA TTS provider checks and per-worker thread bounds; existing CUDA STT path stays selectable. CPU lock/providers/defaults are preserved; no GPU dependencies or drivers installed. No target-server connection/restart/configuration, firmware or shared deployment change. [Server-agent handoff](handoffs/speech-gpu-concurrency.md) includes exact settings, dependency compatibility/isolated venv instructions, rollout order, commands, rollback/review gates and pending measurements.

Observed pinned Bun 1.4.4: **192 passed / 33 database checks skipped / zero failed, 4,109 expectations**, with the existing caregiver PKCE test excluded for the occupied fixed port 3333; no database configured. Python speech tests **13 passed**, covering parallel workers, independent native cancellation/reload, early cancellation, duplicate IDs, private-pipe result isolation, shutdown and HTTP controls during saturation, plus existing auth/privacy/bounds checks. Two-profile gateway recognition is forced to overlap before replies, retaining owner/output isolation. Type/Svelte/format/whitespace and production build passed. Existing verified TLS/WSS speech smoke passed two turns with fixture providers and simulated consumed receipts; no physical speaker/camera/real contact or external model was used.

Real local CPU base Whisper + HFC used two STT/two TTS processes, two intra-op threads each. New `scripts/speech-load.ts` synthetic probe: single STT ~1.4 jobs/sec vs two parallel ~2.3; single TTS ~5.3 vs two parallel ~9.4; mixed concurrency four completed 8/8 across two rounds (~4.7 jobs/sec). Deliberate direct four-job same-engine overload rejected 4/8 for both STT/TTS as configured, with no hidden queue/fallback. Tiny warm synthetic observations on the development host, not a stable load benchmark, full user capacity, voice quality or NVIDIA performance claim. No audio/transcript files/logs were created. An explicit CUDA TTS selection on the CPU-only runtime failed initialization with sanitized error/exit 1, without CPU fallback. Temporary real-model listeners stopped cleanly with exit 0. Target RTX 2000 Ada driver/CUDA/cuDNN/VRAM, actual GPU inference and throughput remain **unrun**, assigned to the testing-server agent.


### Integrated backend rollout — November 14, 2026

Deployed gateway/private speech `c594130`, web `12a1e47`, combining the five requested branch references in order. General chat passed its 298-test/5,085-expectation database-enabled baseline with decisions disabled before decisions integration. Combined and browser-fix regression: 311 tests/5,189 expectations, zero failures/skips; 13 Python speech tests; frozen Bun 1.4.4 install, zero-error/warning type/Svelte, production build, format/whitespace, isolated participant/data/control/long-speech smokes passed. Migration 005 applied after private rollback backup, without reseed or prior checksum/key changes. CPU 2+2/HFC speech deployed; same-origin 1,500 ms open-chat ending and UI integration retained existing teaching/Photo Story/twelve-frame buffering.

Public synthetic speech through actual STT/external LLM/TTS passed with simulated consumption (177 input frames/326 output chunks), as did scoped Photo Story/real caption reply/Skip/Stop/media denial, existing persistent key, and access/authorization checks. Actual Chromium settings and conversation at desktop/390×844, native unlock, disabled fields/password disclosure, dialog Escape, typed submit/Start/Stop, no overflow/runtime errors passed. Fixed actual typed disclosure collapse and unconditional hidden-tab Pause; two independent contexts verified observer remains passive and owner hides to Pause.

Decision evaluation failed its gate: Jev 17 matches/3 mismatches/1 unavailable of 21, Luna 21 unavailable. Decisions remain disabled; no weakened privacy/fallback. CUDA driver initialization failed with 999 even in a clean environment; no hardware reset/reboot. Actual CPU mixed four-job load passed 12/12, and real-engine A cancellation/B continuation/explicit reload passed for STT/TTS. [Detailed measured evidence and remaining handoffs](handoffs/backend-integration-2026-11-14.md). Rollback pointer `.data/backend-integration-rollback-path`; keep additive migration 005 when rolling code back.

Human microphone/speaker, room noise, full keyboard/zoom/assistive technology, physical K151, semantic held-out calibration and assigned counterpart review remain pending. These checks do not establish full P0/F17 or unattended-care readiness.

## Caregiver UI fixes — local candidate from main 01b6ffb, November 14

User requested profile editing/creation, informational conversation activity
choices with spoken selection, complete Games add menu and a persistent profile
close control. Implemented name/avatar saving for fictional profiles through the
existing guarded update pipeline; private caregiver fields remain protected.
Creation reuses the existing live database endpoint, selects an avatar, clears the
search and opens the new profile. Games now includes Teach Lemmi and Explore
pictures as well as all four built-in activities, and shows already-added options.
Conversation launch buttons are replaced by noninteractive activity suggestions;
explicit spoken/typed requests select available photo/teaching through the one
authority. Profile modal actions use a sticky top header.

Observed locally: pre-change check passed; updated Svelte/TypeScript check passed
with zero errors/warnings; production build passed. New HTTP/service tests cover
private setup access, foreign/example rejection, private-field injection, safe
projection and stale saves. New speech tests cover explicit versus incidental
requests, switching activities, unavailable games, generation-bound output,
receipts and Stop suppressing late TTS. Synthetic adapters only; no provider or
human microphone acceptance. Local caregiver preview returned HTTP 200, but the
browser-control host was unavailable: visual, keyboard, scroll and mobile QA
remain unverified. No deployment, real profile mutation or hardware test occurred.

Initial full tests inside the sandbox could not bind HTTP/WSS sockets. An
unrestricted run passed 249 tests with 34 database skips, with one media-root
failure caused by the symlinked macOS temp path; final canonical-temp run below.
Anay must review the new fictional-setup mutation and speech cancellation;
Kylie must inspect the actual UI before integrated merge/deployment. The new proxy
operation must be allowed on deployment. PostgreSQL acceptance remains pending.

Final observed result with pinned Bun 1.4.4 and `TMPDIR=/private/tmp` outside
socket restrictions: **250 pass, 34 database skips, 0 fail / 4,417 expectations**.
Final Svelte/TypeScript check again passed with zero errors/warnings. The private
media-root check remains unchanged; the canonical temp directory resolves the
macOS test-environment issue.

### Supplied avatar expressions — local, November 14

Replaced generated browser study strips with the user's supplied open-mouth and
thinking art from `Downloads/Untitled_Message`, alongside the existing five base
images. All five stable avatar IDs are preserved. `AvatarArt` uses static thinking
while session phase is processing, base/open-mouth alternation during audible
playback, and base otherwise; reduced motion disables alternation. Connected
conversation and voice teaching pass these existing playback/session states.
No speech, backend, capture, firmware or deployment changes in this increment.

Observed: inspected all ten source images and all fifteen packed frames; verified
RGBA transparency, three nonempty 724 px square cells per strip and source mapping.
`bun run check` passed with zero errors/warnings; `bun run build` passed. Asset
metadata and regeneration script record hashes, source names and requested
project-use permission. Actual browser animation/reduced-motion and hardware QA
remain unverified; browser-control infrastructure was unavailable earlier in this
session. Kylie reviews animation/art; Emilia's robot exports remain separate.

### Correct main-screen preview — local only

Added `/preview/application` to render the actual caregiver page and live
conversation component using explicit fictional UI fixtures. It is separate from
the older default mock routes. Profile edit/create forms can be inspected, but
preview handlers refuse persistence; conversation preview never opens a connection,
capture or output. Live/default routes retain their existing mode and clients.
The preview has persistent navigation to caregiver, conversation and avatar faces.
Type/Svelte check passed with zero errors/warnings; both preview URLs returned
HTTP 200. Browser interaction remains unverified due unavailable browser-control
infrastructure. This is layout/form QA, not database or voice acceptance.

### Preview correction after user review — November 14

Supersedes the read-only preview note above: profile name/avatar saving now uses
the existing mock profile clients/authority rather than rejecting Save. The
caregiver and conversation previews both load that authority's participant-safe
projection, so a saved avatar carries across navigation. No second profile or
session store, localStorage persistence, or live database write is introduced.
Create-profile preview remains non-persistent; the live creation path is separate.
Mock saves last until gateway restart. Labels disclose that lifetime.

Fixed avatar distortion by replacing percentage background sizing with a square
SVG viewBox, preserved aspect ratio and a clipped 724 px frame; base/talking/thinking
use the same source strips. Conversation game actions are text guidance rather
than buttons; shared session/microphone/help controls remain. With explicit local
`LEMMI_UI_PREVIEW=1`, normal caregiver/conversation URLs redirect to the actual UI
preview after the existing loopback check. Live mode retains its separate gate.

Observed: local HTTP mock profile save → participant-safe read confirmed the avatar
change, then restored the original test avatar. Both normal URLs returned the
expected preview redirects. Three route/access tests passed, including the live
gate with local preview flag set. Type/Svelte check passed; production build passed.
Browser visual/keyboard QA remains unverified; no deployment or hardware acceptance.

### Avatar motion refinement — November 14

Per user correction, talking now holds the supplied open-mouth frame for the
entire audible playback state; base is shown when playback ends. Removed repeated
mouth opening/closing. During thinking, SVG masks reveal the three original drawn
dots one by one over a gentle 2.4-second loop, starting anew when thinking begins.
Reduced motion shows all dots statically. Dot bounds were checked against connected
alpha components in each of the five supplied thinking frames; no art was redrawn.
The square viewBox/clipping and playback priority are retained. Avatar preview copy
now describes this behavior. Production build passed; browser animation QA remains
unverified. A strict tuple annotation also corrects the prior preview-route test's
TypeScript check, without changing its assertions or application behavior.

### Plain spoken-game phrase list — November 14, local branch

User reiterated that game selection must be spoken, with a list of phrases rather
than buttons. Added shared `ActivityVoicePhrases` to the actual live component,
default mock conversation page and standalone voice panel; removed remaining
entry buttons there and card-like styling from the phrase list. Photo action
buttons were already removed. Shared VoiceTeachingChoices displays spoken topic/
finish phrases. Connection/participant tools are collapsed; explicit microphone
and Pause/Stop/help controls remain accessible. The local-review `/participant`
route now opens the correct conversation component too.

Backend routing uses the same shared session and speech authority, with normalized
reviewed invitation aliases and explicit Finish/back-to-conversation transitions.
Every switch invalidates prior generation/output. No-topic teaching and Just look
photos allow an explicit capture to select another mode; normal content-policy
checks still guard discussion. No new backend, reducer, model-chosen action or
capture-on-unmute. Unimplemented music/guessing/matching hosting remains labeled
unavailable. Standalone Connect no longer auto-selects Teach Lemmi.

Observed final regression: **255 pass / 34 database skips / 0 failures**, 4,459
expectations with pinned Bun and canonical temp directory outside socket limits.
Type/Svelte check and production build passed. Ten direct coordinator/synthetic
speech mode-selection tests passed; every listed entry phrase gets fresh output
and receipts. Local preview returned 200. Browser visuals and actual human speech
remain unverified. No deployment. Anay reviews routing/cancellation, Kylie reviews
main/legacy/voice presentation and keyboard behavior before integrated merge.

### Conversation exit/layout, including accepted corrections — local November 14

User requested a password exit, no top app title/menu, no main-screen scrolling,
then corrected the layout to keep Lemmi centered, remove the bottom button bar and
restore the old four-digit number pad. Implemented those final choices in the
shared LiveParticipant screen used by participant and local-preview routes; removed
the duplicate legacy conversation page. Main scene centers square avatar/picture
above plain voice phrases. Optional browser controls open from the microphone
status; active listening status performs immediate local Stop. Typing/full replies
use dialogs. CSS uses a fixed dynamic viewport with compact short-screen rules.
No automatic capture was added. Header, drawer and preview links are not rendered
on conversation routes.

Restored numeric keys, four dots and automatic submit at four digits. Verification
is server-side, with same-origin POST, HttpOnly/SameSite lock cookie, bounded guesses
and no live default passcode. Dashboard/direct/Back navigation and fictional profile
mutations are gated until unlock. Local demo is `1234`; live needs a separately
configured four-digit code and two additional proxy paths. This is a navigation
barrier, not managed caregiver auth or OS kiosk mode. Existing credentials remain
separate. Live session exit requires owned-session pause confirmation; local audio
is canceled immediately when requesting exit.

Observed: **259 pass, 34 database skips, zero failures / 4,497 expectations**;
final check zero Svelte/TypeScript errors/warnings; build passed. Four new exit-gate
tests cover cookie/redirect/mutation guards, SPA lock establishment, methods/origin,
wrong/right codes, bounded guesses and live failure without configuration. A local
HTTP rehearsal independently verified wrong-code rejection and `1234` unlock.
Native Chrome accessibility inspection observed the exit dialog and absent app
menu before final number-pad/centering correction. Screenshot QA was automatically
rejected due possible unrelated private-tab capture; no screenshot was taken.
Final pixel/responsive/keyboard and human voice/hardware acceptance remain pending.
Anay reviews new web gate/config/proxy and Kylie reviews actual UI before deployment.

### Spoken-caption bubble — local UI, November 14

Added shared SpeechBubble styling for the actual authorized reply text during
browser playback, beside the centered avatar on wide viewports and below it on
narrow viewports. Uses the existing audible-playback signal and safe reply checks;
no synthetic speaking state, speech provider or persistence was added. After audio
ends, the existing readable text fallback remains. Long captions offer the full
text in the existing reply dialog; short-screen layout reduces avatar size while
captions are active rather than allowing the main screen to scroll. Mic mute no
longer discards the caption of unrelated approved playback already in progress.
The standalone voice panel also uses the shared bubble. Avatar design preview's
Talking selection shows explicitly labeled sample caption text, with no audio.

Observed: type/Svelte check passed with zero errors/warnings; production build and
`git diff --check` passed. Human voice, caption pixel layout and exact speech/text
timing remain unverified; these are reply captions, not word-aligned STT subtitles.
No backend or deployment changes in this increment. Kylie reviews responsive art/
caption placement; Anay/Emilia retain session/playback authority.
