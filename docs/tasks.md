# Lemmi — shared task board

Updated November 13, 2026. Add tasks here as the team discovers them. Keep IDs stable so handoffs can name a task precisely.

**How to use:** check a box only when its stated result has been observed; link the commit/test/rehearsal evidence. Code, mock integration, provider integration and hardware verification are separate results. Record partial progress without checking the whole task. Detailed acceptance results belong in [build and demo plan](build-and-demo-plan.md#7-acceptance-tracker); the [integration contracts](integration-contracts.md) and relevant specs still define behavior.

Only fictional **Alex** is functional. Other profile cards stay preview-only. One backend/session authority, four built-in activities, and existing Bun workspace/clients. Camera F13 precedes F14 polish; speech/activity work can proceed alongside camera. Teach Lemmi is a conversation mode, not a fifth game.

## Immediate blockers and next handoffs

**Lukas is blocked on Anay's shared activity contracts and backend hosting.** Publish the schemas/fixtures first so pure reducer work can continue before all persistence/provider work is finished.

- [ ] **A01 — Anay + Lukas: extend `ActivityStateSchema`.** Add useful discriminated states for `photo_album`, `twenty_questions` and `object_matching`; they currently only permit unavailable placeholders. Agree fields for position, phase and safe pause/resume/end behavior.
- [ ] **A02 — Anay + Lukas: extend `ApprovedPackSchema`.** Add the reviewed guessing question tree/candidate structure, including yes/no/not-sure paths, skip/reveal/new-round behavior and canonical content tags. Validate pack references before creating state.
- [ ] **A03 — Anay + Lukas: extend `ActivityContextSchema`.** Supply coordinator-issued matching presentation IDs/revisions with current eligibility and presentation policy. Define their lifetime and stale-action/signal behavior; no client-generated evidence.
- [ ] **A04 — Anay + Lukas: expand validated activity events/transitions.** Cover all four reducers and factual journal proposals, including actual playback receipts versus requests, photo talk and interruption events. Keep utterances/private guidance out of factual events.
- [ ] **A05 — Anay: expand backend activity hosting.** Replace hard-coded music-pack hosting with the reviewed pack catalog and correct per-instance state/content. Serialize actions and system inputs; enforce scope, revisions, retry/effect deduplication and stale receipt cancellation for all four activities.
- [ ] **A06 — Anay + Lukas + Kylie: publish/review the contract handoff.** Update clients, fixtures, views and tests together. Tell Lukas the exact exports/fields available. Do not require him or Kylie to create a second store/protocol.
- [ ] **X01 — Anay + Emilia: agree the next device protocol increment.** Review the [backend control handoff](handoffs/anay-control-foundation.md) against Emilia's latest firmware before implementing network audio/camera consumers. Freeze concrete request/ack/state/error examples, capability negotiation and ownership.

## Confirmed decisions and inputs

These are agreed inputs, not completed integrations:

| Topic | Current decision / missing detail |
| --- | --- |
| Initial testing | LAN first; public hostname/domain setup later. Keep pairing and TLS verification. A LAN-IP certificate/private CA can be provisioned for the test setup. |
| Local speech host | Ubuntu 22, 32 GB RAM, Intel i9, NVIDIA 2000 Ada, reported by Anay. Exact GPU VRAM, driver/CUDA compatibility and measurements still needed. |
| LLM | Start with **OpenRouter**. Anay will provide the exact model and configure his key privately. No model is selected yet. |
| Languages | Multiple languages requested. Define the first tested languages and select compatible local TTS voices; do not equate language-code support with verified quality. |
| Speech adapters | Local STT/TTS initially; preserve an interface for possible online providers later. No silent cloud speech fallback. |
| Proposed microphone transport | `pcm_s16le`, 16 kHz mono, 20 ms = 320 samples / 640 raw bytes, base64 JSON `audio.chunk` with lease/stream IDs. **Not verified end to end.** |
| Current firmware mic experiment | Transient 256-sample buffers at 16 kHz; no network audio. Emilia must validate capture/reframing before the 20 ms transport is frozen. |
| Future LLM access | Explore a supported ChatGPT sign-in option later. No integration or availability is assumed; OpenRouter is the current target. |

## Completed foundation — limited to the evidence listed

- [x] **D01 — Shared mock starter.** Bun/SvelteKit workspace, runtime contracts/clients/fixtures, one in-memory coordinator, UI shells, music reducer example and fake-device path. This is not completed M0 counterpart agreement or P0 scope.
- [x] **D02 — Anay's authenticated control foundation pushed.** Commit [`86ac155`](https://github.com/emiluvu/Lemmi/commit/86ac155), branch `anay/device-control-foundation`: scoped single-use pairing, expiring/revocable device credentials, managed-provider verification adapter, control WebSockets and explicit unavailable media/contact paths. Credentials remain in memory; provider responses were fixtures.
- [x] **D03 — Backend control subset checked.** 37 automated tests, type/Svelte checks, build, formatting, original mock web smoke and production control smoke passed on Bun 1.4.4. TLS smoke uses temporary fixture identity/proxy/CA with certificate verification; no real provider or robot acceptance implied. See [recorded evidence](build-and-demo-plan.md#observed-backend-control-subset--november-13-2026).
- [x] **D04 — Emilia's foundation hardware observations recorded.** Private original backup verified; foundation firmware uploaded; startup capture/camera off and Stop → Unmute → Ready behavior observed. Active-audio cancellation/network behavior is still pending. Source/evidence: [firmware branch](https://github.com/emiluvu/Lemmi/blob/b9ba5ce/firmware/stackchan/hardware-checks.md).
- [x] **D05 — Emilia's offline feasibility source uploaded.** At [`b9ba5ce`](https://github.com/emiluvu/Lemmi/commit/b9ba5ce), feasibility 0.2 is compiled/flashed; off-at-startup and a local camera permission prompt are reported. This is not a working network/camera/audio check-in; active tests remain below.

## Anay — speech, chatting and LAN integration

- [ ] **A07 — Set up LAN HTTPS/WSS and private provisioning.** Select the server LAN IP/ports, create/provision trust, test device certificate/hostname-or-IP verification and explicit pairing/revocation across the real LAN. Keep mock/internal/model/database routes private; public DNS can wait.
- [ ] **A08 — Configure caregiver identity.** Select the provider, implement/verify the actual token path and assigned caregiver identity, and connect the UI sign-in with Kylie. Current introspection adapter needs endpoint, issuer, audience, server client credentials and caregiver subject; adapt the verifier if the chosen provider uses a different supported mechanism.
- [ ] **A09 — OpenRouter configuration and adapter.** `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` placeholders are now in `.env.example`; the current control backend does not consume them yet. Implement server-side configuration/adapter and bounded request settings. Model remains Anay's choice. Include timeout/cancellation, response validation, explicit provider errors and documented routing/retention settings. No credentials in clients, firmware or logs.
- [ ] **A10 — First text chat through the existing coordinator.** Explicit participant input → approved minimal context → OpenRouter → bounded participant-safe response. Keep dialogue transient/bounded, stop/help independent, one question at a time, and Quiet capture-off. No tools, auto-biography writes, implicit memory or transcript journal.
- [ ] **A11 — Local multilingual STT feasibility/service.** Inspect the Ubuntu host/GPU/driver, select and pin a maintained local runtime/model after feasibility, and prove bounded in-memory PCM transcription without audio/temp-file/transcript logging. Support requested language/auto-detection explicitly and report unsupported/error states. Start with fictional/team rehearsal audio.
- [ ] **A12 — Integrate microphone turns with Emilia.** Agree capture grants, exact frame/sequence/stream-end bounds and turn limits. Reframe device samples to measured transport; handle backpressure and silence/explicit turn-end without unbounded buffers. Unmute alone must never capture. The proposed format above is not frozen hardware evidence.
- [ ] **A13 — Connect STT → chat.** Reuse A10, keep recognized text transient, preserve the selected/detected language, reject stale STT/LLM results, and test Stop/pause/mute/help/disconnect/revocation during each stage. No automatic cloud fallback.
- [ ] **A14 — Local multilingual TTS adapter.** Select/pin reviewed language/voice assets with licensing and quality checks. Generate audio in memory with bounded queues and cancellation; document any runtime buffers/logs. Unsupported voices/languages stay explicit. Online TTS is a later replaceable adapter.
- [ ] **A15 — Real response playback.** Integrate TTS output, actual endpoint receipts and lease checks with Emilia/browser fallback; one active speaker and no simultaneous capture/music/TTS/camera. Playback completion never opens capture by itself.
- [ ] **A16 — Conversation safety/language fixtures.** Exercise repetition, missing biography, sensitive topics, refusal, medication/clinical questions, explicit help/urgent concern and unclear/quoted speech. Use fixed application routing for help; document language coverage and recognition limits without emergency-detection claims.
- [ ] **A17 — Speech/LLM benchmark and fallback.** Run at least 20 fictional turns on the selected host/network; record warm/cold timing, STT/LLM/TTS stages, resource use, failed turns and Stop responsiveness. Prepare and test the laptop fallback.

## Anay — persistence, privacy and caregiver continuity

- [ ] **A18 — PostgreSQL foundation.** Implement schema/migrations and private storage configuration for scoped profile/device/session/contact/journal/policy records. Do not seed example cards as live profiles. Replace ephemeral credential management deliberately; document restart/revocation behavior.
- [ ] **A19 — Protected profile and asset APIs.** Participant-safe versus caregiver projections, biography/source review, avatar/support settings, optimistic revisions and private approved-media access. Verify object ownership on every route and keep server-only code out of browser bundles.
- [ ] **A20 — Communication presets.** Resolve Conversational/Guided/Quiet centrally; save for future sessions by default, with explicit apply-now invalidation/pause. Share same-topic previews with Kylie; never infer clinical stage or change privacy/help rules.
- [ ] **A21 — Real contact readiness.** Choose/test a notification provider with verified opted-in team recipients and fictional concerns. Keep destinations private and readiness explicit.
- [ ] **A22 — Durable help/outbox worker.** Manual help independent of LLM/journal; bounded retries, uncertain-send reconciliation, backup/expiry, deduplication, signed callbacks and authenticated explicit acknowledgment. Preserve requests across conversation Stop/worker restart; separate cancel-future-attempts from resolution.
- [ ] **A23 — Factual journal and permitted summaries.** Persist source-labeled activity/session events; add observation/review/edit/remove paths. Excerpts default off; summary jobs use only permitted retained sources, never live dialogue when excerpts are off. No-summary/failure is a valid explicit state.
- [ ] **A24 — F15 preferences and eligibility authority.** Separate remembering permission, canonical IDs/aliases, bounded preference/item policy, evidence validation and global filtering for conversation/all activities. First uncertainty hides in-session; a later distinct occasion may retire with permission. Current refusal wins; no deliberate retesting or ability score.
- [ ] **A25 — Forget/revoke/delete races.** Clear dependent rows/private objects/controlled caches/summaries, invalidate late writes/callbacks/output, and preserve session-only refusal if a policy save fails. Do not promise deletion of delivered messages/provider records.
- [ ] **A26 — F17 Teach Lemmi execution.** Use existing conversation mode/session/speech with reviewed eligible prompts, next/not-sure/finish and cancellation. No fifth reducer, correctness scoring, training service or biography auto-write.
- [ ] **A27 — Caregiver overview composition.** Protected source-linked profile/readiness/activity/help/journal cards with partial/error/no-summary states. Optional duration aggregates use known active intervals and honest gaps; no mood/engagement/clinical inference.

## F13 camera check-ins — joint secure integration, before F14

- [ ] **C01 — Emilia: complete offline peripheral measurements.** Verify decline/request timeout, changing active preview, mic level/tone, Stop/expiry/reboot, repeated audio→camera→audio and runtime memory/control latency. Keep the private backup intact. See [current procedure](https://github.com/emiluvu/Lemmi/blob/b9ba5ce/firmware/stackchan/feasibility-checks.md).
- [ ] **C02 — Anay + Emilia: settle camera encoding/transport.** Current firmware experiment is RGB565 160×120; shared preliminary header is JPEG-only. Measure/agree conversion or supported format, hard byte/frame/freshness limits and bounded queues before changing both consumers. Neither path is proven yet.
- [ ] **C03 — Anay: implement check-in authority.** Default-disabled permission, caregiver/device scope, single viewer, idempotent request, current local Allow/nonce, coordinated audio/activity pause, start timeout, expiry, end/revocation/restart and source-safe access metadata cleanup.
- [ ] **C04 — Emilia: implement local consent/enforcement.** Visible request and Allow/Not now, persistent camera-on notice, local Stop/deadline/watchdog and frame invalidation without server round trip. No reopen on reconnect; mic mute is separate.
- [ ] **C05 — Anay: authenticated bounded relay.** Separate media/control queues on the existing gateway; bind sender/viewer to current check-in/revisions, forward only fresh frames and close on access/connection loss. No recording, LLM/vision, notifications or durable frame payloads.
- [ ] **C06 — Kylie: caregiver/participant camera UI.** Permission setup, awaiting/declined/unavailable states, viewer freshness/expiry, End and participant notices using shared snapshots. Blank stale/ended images and clear local image state.
- [ ] **C07 — Lukas + Anay: activity interruption integration.** All four games retain position without effects/progression during check-in. End camera leaves them paused until explicit Resume; resume never replays queued output.
- [ ] **C08 — Joint F13 gate.** Exercise actual K151 frames/local Stop under load plus unauthorized viewer, no Allow, duplicate viewer, stale/late frame/start, disconnect, expiry, access revoke and restart. Record hardware/provider evidence and counterpart review before calling F13 complete.

## Lukas — pure activities, reviewed content and demo

- [ ] **L01 — Review A01–A06 and supply required examples.** Anay edits canonical schemas; Lukas supplies state/pack/presentation/event requirements and transition fixtures. Backend hosting completion should not block pure logic once contracts are available.
- [ ] **L02 — Complete music logic/content.** Approved playable tracks with source/license metadata, selection/play/pause/next/missing-asset/failure paths and factual receipts. A requested track is not evidence of playback.
- [ ] **L03 — Complete photo album logic.** Selection/navigation/just-look/talk, approved captions/context/tags, missing-photo/caption behavior, invalidated stale photo talk, and eligible `place_scenes` packs for Explore pictures.
- [ ] **L04 — Complete reviewed guessing logic.** Bounded question tree with yes/no/not-sure/skip/reveal/new round/finish; Lemmi asks about a visible object. No recall test, pressure, scoring or model-invented rules.
- [ ] **L05 — Complete visible-picture matching.** Approved sample/two candidates with presentation revisions, Show me/Not sure/Next/Finish, graceful nonmatching choice/all-ineligible exit and no repeats/retests. Return policy proposals; Anay commits them.
- [ ] **L06 — Shared pure transition checks.** Create/reduce/project and coordinator-only system inputs for all four activities; no I/O/timers, deterministic inputs, eligibility on every projection, terminal end and no progression/effects during pause/camera.
- [ ] **L07 — F17 reviewed teaching topics.** Eligible canonical topic/object invitations and assets, skip/uncertainty/refusal/all-retired examples; no corrections, obligation, independent model service or biography writes.
- [ ] **L08 — Demo planning.** Record actual event hours/capacity, first vertical slice, all-four-activity rehearsal and teammate fallback. Keep optional Grandma participation voluntary, privately rehearsed and separately agreed for camera/public media; no assumption about diagnosis or collection of private biography.

## Kylie — frontend, art and standalone participant fallback

- [ ] **K01 — Design/navigation foundation.** Evolve existing SvelteKit app, accessible tokens/shared controls, participant/caregiver route map and state-complete shells. No second app/session/game store.
- [ ] **K02 — Five avatars and device art handoff.** Dog/cat/bunny/bird/lemming, chooser previews and six static states each, source/permission/alt metadata. Prove one full set with Emilia's measured display/memory format first; reduced motion is a setting for every avatar.
- [ ] **K03 — Caregiver setup/settings.** Authenticated Alex profile/context, approved media, support previews, contact readiness and pairing/revocation with Anay's clients. Other cards clearly preview-only and never use Alex's live credentials/data.
- [ ] **K04 — Participant conversation/browser audio.** Explicit start/speak/listening/processing/output/waiting/error states, visible capture, separate mute/pause/stop/help, permission/autoplay recovery and explicit endpoint handoff. No duplicate capture/playback authority.
- [ ] **K05 — Four activity views.** Render shared `ActivityView` and typed actions from Lukas/Anay, including unavailable/loading/paused/missing-media states, optional large-screen assistance and no duplicated rules.
- [ ] **K06 — Help and journal UI.** Honest created/accepted/delivered/acknowledged/failed/no-response states, explicit acknowledgment/cancel-future-attempts, factual sources and summary review/edit/remove/no-summary. No clinical charts or arrival guarantees.
- [ ] **K07 — F15/F16 preferences/feedback.** Interests & boundaries, remembering/excerpts as separate permissions, forget/undo/source labels, participant refusal/feedback and matching presentation UI without ability labels.
- [ ] **K08 — F17 and Explore pictures UI.** Teaching tile/panel with supplied topic and different/not-sure/finish controls; reuse approved photo packs for scene exploration.
- [ ] **K09 — Caregiver overview.** Source-linked cards and honest readiness/partial/error/gap states; optional factual duration charts only after core cards.
- [ ] **K10 — Accessibility/recovery inspection.** Actual keyboard flow, focus, readable controls, contrast/zoom, reduced motion, disconnected/failed saves and browser-only fallback. Record observed checks instead of mirroring markup with tests.

## Emilia — device integration and F14 after the F13 gate

- [ ] **E01 — LAN control client.** Implement the reviewed WSS/pairing/heartbeat/control protocol, explicit local provisioning and certificate trust. Verify actual startup off, Stop/mute before acknowledgment, reconnect reconciliation and device access revocation.
- [ ] **E02 — Microphone transport.** Complete local capture tests, confirm native audio/reframing and bounded 20 ms proposal, visible listening/grants, mic mute clearing unsent capture, explicit turn-end and no reconnect backlog. Coordinate A12.
- [ ] **E03 — Playback transport.** Confirm output format/queues/receipts, one active endpoint and local Stop/watchdog during speech/music. Unmute/playback completion alone never starts capture; audio/camera remain mutually exclusive.
- [ ] **E04 — Mascot/revision integration.** Render agreed avatar/state assets with independent mic/camera indicators, consume profile/privacy/policy/session revisions and reject stale render/audio instructions. Use browser assistance for unreadable activity controls.
- [ ] **E05 — F14 petting, only after C08.** Debounced top-strip input and local static acknowledgment; never grant consent/capture, dismiss help or advance an activity. Side panels are LEDs, not touch inputs.
- [ ] **E06 — F14 restrained motion/status.** Reduced-motion/off modes, bounded safe firmware-owned reactions and distinct status cues. Keep servo reactions off if safe placement/holding cannot be established; Stop/watchdog beat queued motion.
- [ ] **E07 — F14 measured health.** Report only supported measured telemetry with timestamps; Anay validates/ingests and Kylie displays freshness/unavailable. No invented battery percentage/runtime or participant-health inference.

## Joint integration, review and release

- [ ] **R01 — Review the shared boundaries.** Anay: server/data/access; Emilia: device/local controls; Lukas: activity transitions; Kylie: UI/assets. Critical auth/privacy/cancellation/contact work needs substantive technical review before integrated merge; isolated feature work can proceed.
- [ ] **R02 — Prove the first complete slice.** Alex → actual robot/browser voice turn → real approved music play/pause → factual persisted journal event → real opted-in caregiver request and explicit acknowledgment, with Stop and app fallback.
- [ ] **R03 — Complete the committed feature set.** All four activities, F12 support, F13 camera, F14 local interactions, F15 preferences, F16 matching, F17 teaching and approved scene/overview refinements. Do not treat R02 as full P0 completion.
- [ ] **R04 — Failure/security/privacy rehearsal.** Authorization/forged callbacks/GET previews, delayed audio/results, deduplication, provider outage, database/worker restart, failed saves, deletion/revocation races, no raw media/transcript logs, and actual browser/device controls.
- [ ] **R05 — Deployment readiness.** Actual venue/LAN and any remote caregiver network, private services, host power/sleep, model/voice downloads and laptop recovery. Add public hostname/domain deployment when needed; LAN-only checks do not prove remote operation.
- [ ] **R06 — Final freeze/rehearsals.** Reserve the final quarter, finish critical fixes, run two full rehearsals and record exact live/mock/unmet status, versions, recovery and submission materials. Update README/build-plan evidence.

## Later work and ideas to assess

- [ ] **FUT01 — Optional online STT/TTS.** Replace adapters only after explicit provider/data-handling decisions and tests; never use silent cloud fallback.
- [ ] **FUT02 — Optional ChatGPT sign-in for LLM access.** Investigate a supported integration and its permitted API/auth flow before promising compatibility; no current implementation or dependency.
- [ ] **FUT03 — Optional factual duration charts.** Only after overview/source cards; known active intervals, no double counting or inferred engagement.
- [ ] **FUT04 — Solitaire, last stretch.** Only after committed work and other optional features. No core dependency. TurtleBot, public executable packs, billing and marketplace implementation remain deferred/outside this build.

## Agent claims and safe parallel work

Named team ownership in `AGENTS.md` still applies. Multiple agents working for Anay must additionally agree exact file ownership. Claim a task here before editing; add branch, scope and status. Canonical contracts, coordinator, root manifests/lockfile and shared clients have one editor at a time. Do not interpret an unchecked task as permission to edit someone else's files concurrently.

| Agent / person | Claimed task IDs | Branch | Exclusive files/scope | Status |
| --- | --- | --- | --- | --- |
| Anay — this Codex session | Task-board setup | `anay/device-control-foundation` | `docs/tasks.md`, README/build-plan links | Completed; choose next implementation claim with Anay |
| Second Anay Codex agent | Unclaimed | To choose | To agree before editing | Available |

Suggested split for Anay to assign: one agent owns **A01–A06** (shared activity contracts/hosting, coordination with Lukas); another owns **A11** (Ubuntu speech-runtime feasibility and an isolated in-memory STT service). Agree the speech service's path/adapter interface first; a proposed new directory is not an already implemented service. The STT agent should request shared schema/client/root-dependency edits from their current owner. **A09/A10/A13** then connect the selected service and OpenRouter through the existing coordinator; do not let both agents independently implement that pipeline.

## New tasks / discussion inbox

Add Anay's next requirements below, then assign a stable ID, owner, dependencies and observable completion condition before implementation.

Keep private API keys, contact details, Wi-Fi credentials, patient biography, raw audio/photos and firmware backups out of this board and Git.
