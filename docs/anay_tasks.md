# Anay — backend tasks and handoffs

Scope: Anay's current implementation work. Teammate names identify who needs our output or reviews a shared boundary. Check tasks off after the stated result is verified; record the commit/checks and handoff. Keep existing IDs stable.

Current branch: `anay/activity-contracts-a01-a04`. The authenticated control foundation is pushed in [`86ac155`](https://github.com/emiluvu/Lemmi/commit/86ac155); its 37 tests and web/control smoke checks passed. Actual provider setup, LAN robot integration, speech and persistence remain pending. See [control handoff](handoffs/anay-control-foundation.md) and [acceptance evidence](build-and-demo-plan.md#observed-backend-control-subset--november-13-2026).

## First: unblock Lukas and the activity UI

Publish usable schemas and fixtures before waiting for the entire live backend. Anay owns canonical contract edits; agree the fields with Lukas and the view shape with Kylie.

- [x] **A01 — Extend `ActivityStateSchema` for photos, guessing and matching.** Replace unavailable-only placeholders with discriminated state fields for position, phase and pause/resume/end behavior. **Handoff: Lukas.**
- [x] **A02 — Extend `ApprovedPackSchema` for the reviewed guessing tree.** Validate reviewed questions/candidates, yes/no/not-sure branches, skip/reveal/new-round behavior and canonical content tags/references. **Handoff: Lukas.**
- [x] **A03 — Extend `ActivityContextSchema` for matching presentations.** Add coordinator-issued presentation IDs/revisions alongside authoritative eligibility/presentation policy; define stale action/signal rejection. **Handoff: Lukas.**
- [x] **A04 — Expand activity events and validated transitions.** Cover all four activities, photo-talk requests, interruptions and actual playback receipts. Distinguish selection/request from playback; keep utterances/private guidance out of factual events. **Handoff: Lukas and Kylie.**
- [ ] **A05 — Expand authoritative activity hosting.** Replace hard-coded music-pack hosting with the reviewed catalog and correct instance/content lookup. Serialize actions/system inputs; enforce scope, revisions, retries, effect deduplication and stale receipt cancellation. Host Lukas's reducers through the existing coordinator. **Handoff: Lukas and Kylie.**
- [ ] **A06 — Publish the activity contract increment.** Update exports, typed clients, nonsecret fixtures and meaningful tests together. Document exact fields/events and mocked versus live behavior; obtain counterpart review. **Handoff: Lukas and Kylie.**

A01–A04 verified locally with Bun 1.4.4: **51 tests**, check, build, formatting and `smoke:web` passed. Contract changes are committed on `anay/activity-contracts-a01-a04`. See the [activity contract handoff](handoffs/anay-activity-contracts.md) and [acceptance evidence](build-and-demo-plan.md#observed-activity-contract-subset--november-13-2026) for exact fields, compatibility changes, fixtures and remaining scope. These checkmarks cover contracts and existing-consumer compatibility; Lukas's missing reducers/content, A05 hosting/receipt execution and A06 counterpart review remain pending.

## Device protocol and LAN access

- [ ] **X01 — Publish/review the next device protocol increment with Emilia.** Agree capability negotiation, current state, controls/ack/errors, capture grants, audio/turn end and playback receipts. Use the [control foundation](handoffs/anay-control-foundation.md); share fixtures before either side freezes media support. **Handoff: Emilia.**
- [ ] **A07 — Set up LAN HTTPS/WSS and private provisioning.** Select server LAN IP/ports, provision a certificate/trust root and test real device pairing/revocation. Keep internal/mock/model/database routes private. Public hostname/domain setup can follow later. **Handoff: Emilia.**
- [ ] **A08 — Implement actual caregiver authentication.** Select/configure the provider and verify token issuance, assigned identity and authorization. Current introspection adapter requires endpoint, issuer, audience, server client credentials and caregiver subject; adapt it if the selected provider needs another supported verifier. Supply the backend sign-in/client seam. **Handoff: Kylie.**

## Speech and chatting — next runnable path

Agreed inputs: Ubuntu 22, 32 GB RAM, Intel i9 and NVIDIA 2000 Ada; local STT/TTS initially; OpenRouter for the LLM; multiple languages. Exact GPU VRAM/driver/CUDA compatibility, model and initial tested language/voice set still need confirmation.

- [ ] **A09 — Implement the OpenRouter adapter/configuration.** `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` placeholders already exist in `.env.example`; the backend does not consume them yet. Add server-side configuration, bounded requests, timeout/cancellation, response validation, explicit provider errors and documented data-handling settings. Anay supplies the exact model/key privately.
- [ ] **A10 — Connect text chat to the existing session coordinator.** Explicit input → minimal approved context → OpenRouter → short participant-safe response. Keep dialogue transient/bounded, one question at a time, Quiet capture-off, and help/Stop independent. No model tools, transcript journal or automatic memory/biography writes. **Handoff: Kylie and Emilia.**
- [ ] **A11 — Implement/prove local multilingual STT.** Inspect the Ubuntu host, select/pin a maintained runtime/model after feasibility, and provide bounded in-memory PCM transcription with requested language/auto-detection and explicit failures. Inspect buffers/temp files/logs; retain no microphone audio or transcripts.
- [ ] **A12 — Implement the backend microphone-turn seam.** Agree/validate capture grants, framing, sequence/stream end, turn limits and backpressure. Current proposal is `pcm_s16le`, 16 kHz mono, 20 ms = 320 samples / 640 raw bytes, base64 `audio.chunk` with lease/stream IDs. This is **not verified end to end**; Emilia's offline test uses 256-sample buffers and sends no network audio. Unmute alone never grants capture. **Handoff: Emilia.**
- [ ] **A13 — Connect local STT to A10's chat path.** Keep recognized text transient, preserve selected/detected language and reject stale results. Test Stop/pause/mute/help/disconnect/revocation while recognition/model work is pending. No silent cloud fallback.
- [ ] **A14 — Implement a local multilingual TTS adapter.** Select/pin reviewed language/voice assets, verify licensing/quality, bound in-memory audio generation/queues and cancellation, and document engine buffers/logging. Unsupported language/voice is explicit; preserve a replaceable provider seam.
- [ ] **A15 — Integrate response playback and receipts.** Supply bounded output streams, current lease/revision checks and actual endpoint playback receipts. Enforce one active speaker and no simultaneous mic/music/TTS/camera. Playback completion never grants capture. **Handoff: Emilia and Kylie's browser endpoint.**
- [ ] **A16 — Implement conversation safety/language fixtures.** Cover repetition, missing biography, sensitive topics, refusal, medication/clinical questions, help/urgent concern and unclear/quoted speech. Use fixed application-owned help routing and document actual language coverage/recognition limits.
- [ ] **A17 — Benchmark speech/chat and prepare fallback.** Run at least 20 fictional turns on the selected host/network. Record warm/cold timing, STT/LLM/TTS stages, resource use, failures and cancellation. Test the selected models on the laptop fallback.

## Backend APIs, data and caregiver continuity

- [ ] **A18 — Implement PostgreSQL schema/migrations and private storage.** Scope profile/device/session/contact/journal/policy records to Alex. Replace in-memory credential management deliberately and document restart/revocation behavior. Example cards remain nonfunctional.
- [ ] **A19 — Implement protected profile and approved-asset APIs.** Participant-safe/caregiver projections, approved biography edits, avatar/support settings, revision conflicts and scoped media access. Verify ownership on every route and keep credentials/server code out of browser bundles. **Handoff: Kylie.**
- [ ] **A20 — Resolve/apply communication presets centrally.** Validate Conversational/Guided/Quiet, future-session default saves and explicit apply-now pause/invalidation. Publish same-topic preview fixtures and effective session configuration; no automatic staging or weaker help/privacy controls. **Handoff: Kylie, Lukas and Emilia.**
- [ ] **A21 — Configure/test real contact routing.** Select a provider/channel and verified opted-in team recipients; use fictional concerns. Keep destinations private and contact readiness explicit. **Handoff: Kylie and Emilia.**
- [ ] **A22 — Implement durable help/outbox execution.** LLM/journal-independent manual help, bounded retries, uncertain-send reconciliation, deduplication, backup/expiry, signed callbacks and authenticated explicit acknowledgment. Requests survive conversation Stop/worker restart; cancel future attempts separately from resolution.
- [ ] **A23 — Implement factual journal and permitted summaries.** Persist source-labeled events and observation/review/edit/remove APIs. Excerpts default off; summaries use only permitted retained sources. Provide no-summary/failed-write states without blocking factual events. **Handoff: Kylie.**
- [ ] **A24 — Implement F15 preferences and global eligibility.** Separate remembering permission, canonical IDs/aliases, bounded policy, evidence validation and filtering across conversation/all activities. First uncertainty hides this session; a later distinct occasion may retire with remembering permission. Refusal wins; no deliberate retesting or ability score. **Handoff: Lukas, Kylie and Emilia.**
- [ ] **A25 — Implement forget/revoke/delete races.** Clear dependent rows/private objects/controlled caches/summaries and prevent late writes/callbacks/output from recreating data. Preserve session-only refusal on failed policy saves; state external deletion limits accurately.
- [ ] **A26 — Implement F17 Teach Lemmi execution.** Use existing conversation mode/session/speech, reviewed eligible prompts, next/not-sure/finish and cancellation. No fifth reducer, correctness scoring, training service or biography auto-write. **Handoff: Lukas's prompts, Kylie/Emilia's clients.**
- [ ] **A27 — Implement caregiver overview composition.** Protected source-linked profile/readiness/activity/help/journal cards with partial/error/no-summary states. Optional duration aggregates use known active intervals and honest gaps, without clinical/engagement inference. **Handoff: Kylie.**

## Our camera/backend work — F13 before F14 polish

- [ ] **A28 — Agree camera media contracts with Emilia.** Her current offline experiment uses RGB565 160×120; the shared preliminary header is JPEG-only. Resolve encoding/conversion, dimensions, hard byte/frame limits, freshness and queue bounds from measurements. Publish matching fixtures/consumers; do not claim camera feasibility from a compile.
- [ ] **A29 — Implement authorized check-in state/control APIs.** Default-disabled permission, caregiver/device scope, single viewer, idempotent request, current local Allow/nonce, start timeout, expiry, end/revocation/restart and bounded access-metadata cleanup. **Handoff: Emilia and Kylie.**
- [ ] **A30 — Implement authenticated bounded camera relay.** Keep media/control queues separate on the existing gateway, bind sender/viewer to the current check-in/revisions and forward only fresh frames. No image recording, model/vision input, notification images or durable frame payloads. **Handoff: Emilia and Kylie.**
- [ ] **A31 — Coordinate camera/audio/activity cancellation.** Invalidate pending capture/output/talk before camera start, dispatch system pauses to Lukas's reducers and prevent progression. Ending camera leaves activities paused until explicit Resume; queued effects never replay.
- [ ] **A32 — Verify our F13 access/termination boundaries with counterparts.** Test unauthorized/no-Allow/duplicate-viewer, stale/late start/frame, expiry, disconnect, access revoke and server restart. Obtain real K151/local Stop evidence from Emilia; record mock/hardware status separately before declaring the gate passed.
- [ ] **A33 — After the F13 gate, validate/ingest measured F14 health.** Publish supported-field/freshness/unavailable fixtures for Kylie's UI. Reject invented battery/runtime values; device telemetry is not participant health. Petting/motion firmware stays Emilia's work.

## Our integration and release checks

- [ ] **A34 — Complete substantive backend boundary review.** Review server/data/access, contracts, privacy, cancellation and contact changes with the assigned counterpart; resolve findings before integrated merge. Publish exact export/event/command changes and test evidence.
- [ ] **A35 — Prove the backend's first complete slice.** Actual voice turn → approved music playback/pause → persisted factual event → real opted-in caregiver request and explicit acknowledgment, with local Stop and browser fallback. Coordinate UI/device/activity checks; do not present simulations as live results.
- [ ] **A36 — Finish backend failure/privacy checks.** Authorization/forged callbacks/GET previews, delayed results/media, deduplication, provider outages, database/worker restart, failed saves, deletion races and no raw audio/transcript logs.
- [ ] **A37 — Verify host/deployment/recovery.** Real LAN/venue access, private services, power/sleep, model downloads, laptop fallback and later remote-caregiver/public-origin networking. LAN-only testing does not establish remote readiness.
- [ ] **A38 — Record the backend handoff for rehearsal/freeze.** Exact versions/run commands, contracts, actual live/mock/unmet status, recovery steps and remaining owners. Update README/build-plan acceptance evidence and support the two full rehearsals.

## Agent claims

Claim exact tasks/files before parallel edits. Shared contracts, coordinator, clients and root manifests/lockfile have one editor at a time. Do not independently implement the same session or speech/chat pipeline.

| Agent | Claimed tasks | Branch | Exclusive files/scope | Status |
| --- | --- | --- | --- | --- |
| Activity-contract agent | A01–A04 | `anay/activity-contracts-a01-a04` | Activity contracts/fixtures, contract tests, minimal existing consumer compatibility, documentation handoff | Complete; 51 tests/check/build/format/web smoke passed; Lukas/Kylie review pending in A06 |
| Second Anay agent | Unclaimed | To choose | Agree before editing | Available |

Suggested assignment: one agent takes **A01–A06** to unblock Lukas; another takes **A11** for isolated local STT feasibility/service work. Agree the speech-service path/interface first; request shared contract/client/dependency edits from their current editor. Assign **A09/A10/A13** to one editor when connecting OpenRouter and speech to the coordinator.

## Inputs we still need

- Exact OpenRouter model; real key placed privately in `.env`/server configuration.
- Actual Ubuntu-host access/driver/VRAM details and initial languages/voices to test.
- Emilia's measured capture/playback/camera capabilities and protocol review.
- Chosen identity/notification providers and private test-recipient configuration when implementing those integrations.

Parked ideas: online STT/TTS adapters and a supported ChatGPT sign-in option for LLM access. Neither blocks the current local-speech/OpenRouter path.

Add new Anay tasks here with a stable ID, affected handoff, dependencies and observable completion condition. Keep credentials, contacts, private biography/media and firmware backups out of this file/Git.
