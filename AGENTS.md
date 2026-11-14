# Lemmi — repository instructions

## Project and scope

Lemmi is a hackathon companion for familiar conversation, enjoyable activities, and caregiver continuity for people living with dementia. Stackchan K151 is the preferred participant interface where feasible. The app provides caregiver setup, notifications, and journal review, plus larger activity visuals and a complete standalone participant fallback. A caregiver may be remote; do not assume someone is beside the participant.

The repository contains planning documents and a runnable local mock starter. Read [team-start.md](docs/team-start.md) before implementation; reuse its workspace, packages, clients and commands. Do not mistake proposed architecture, folder paths, commands, safeguards, or provider choices for implemented behavior. Inspect the actual tree and configuration before starting. Use the project/companion name Lemmi. The exact five avatars are dog, cat, bunny, bird, and lemming; stable IDs match these lowercase names. Reduced motion is a setting for all five, not a sixth neutral avatar.

## Demo profile scope

The demo implements one functional fictional profile, Alex, end to end. Additional fictional profile cards may illustrate the caregiver dashboard, but must be labeled **Example profile — preview only**. They do not open live participant sessions, write journals/preferences, receive notifications, pair devices or request camera access. They have no real contacts or private data. A preview may open clearly labeled static detail content; it must never reuse Alex’s live data or credentials under another name. Multi-profile management and switching are outside this demo. Keep live APIs resource-scoped and reject unassigned/example profile IDs; isolated authorization fixtures do not require a second functional profile.

## Read the relevant specifications

- [README](README.md): project overview and current status.
- [Product specification](docs/product-spec.md): scope, priorities, and acceptance criteria.
- [Experience specification](docs/experience-spec.md): flows, controls, states, wording, and accessibility targets.
- [Safety and privacy specification](docs/safety-and-privacy.md): response boundaries, recording, contacts, retention, and deletion.
- [Technical specification](docs/technical-spec.md): architecture, schemas, APIs, device protocol, cancellation, and worker behavior.
- [Build and demo plan](docs/build-and-demo-plan.md): named ownership, individual briefs and Codex prompts in section 5, integration gates, checks, and presentation script.
- [Communication support specification](docs/communication-support-spec.md): evidence boundaries, caregiver presets, schema/application behavior and checks; not clinical staging.
- [Kylie design and UI guide](docs/kylie-design-guide.md): inspiration process, interface/page map, reusable components, avatar exports and frontend order.
- [Integration contracts](docs/integration-contracts.md): shared types/clients, activity UI/logic seam, device audio, assets and file ownership.

Follow the user's current task and accepted corrections. Within the documents, use safety/privacy for data and response boundaries, product for scope, experience for interaction, technical for contracts, and the build plan for ownership. If they conflict materially, identify the specific conflict rather than silently picking a different product direction. Resolve routine implementation details within the assigned scope and record consequential assumptions. Keep affected documents consistent when behavior changes.

## Team boundaries

| Person | Owns |
| --- | --- |
| Anay | Backend HTTP API/realtime gateway, session authority, local STT/TTS, external LLM integration, PostgreSQL/private media, auth/profile/contact/journal/summary worker, deployment, shared contracts/mocks. |
| Emilia | Stackchan firmware/WSS client, bounded audio capture/playback, immediate local mute/unmute/stop/watchdog, capture indicator, mascot conversion/rendering; F13 camera check-ins first, then F14 top-strip petting, restrained reactions/motion, status cues and device health. |
| Kylie | Art/design/tokens, all SvelteKit frontend and shared UI, participant/caregiver routes and browser fallback, views on top of Lukas's activity logic. |
| Lukas | Pure activity create/reduce/project logic, reviewed music/guessing/photo content, transition checks, demo planning and optional supervised live participation with Grandma. |

This named split supersedes the numbered roles. Use the assigned person's brief in build-plan section 5. Anay owns server/tooling/migrations; Kylie owns app layout/UI; Lukas owns activity rules; Emilia owns device behavior. Coordinate shared contracts, dependencies and cross-boundary changes without blocking routine work inside the assigned slice. Preserve others' work.

Start from one shared scaffold and typed mocks. Read [integration contracts](docs/integration-contracts.md) before parallel feature work. Kylie renders ActivityView and submits typed actions; Lukas provides deterministic reducers/effects, Anay hosts the single authoritative instance, and Emilia follows session/audio commands. Do not duplicate game rules in components, create another session store/backend, or let a model invent action types/URLs. A missing export is a specific handoff to the owner, not an invitation to replace their system.

## Added personalization and matching scope

Follow [personalization-and-matching-spec.md](docs/personalization-and-matching-spec.md): F15 per-profile preferences grow with separate remembering permission; F16 object_matching is the fourth built-in activity. Excerpts off still forbids utterance/paraphrase retention; only explicitly permitted structured preference IDs/policy may persist. Explicit refusal stops a topic now; first explicit object uncertainty hides it this session, a second distinct later occasion retires the canonical object across proactive prompts/activities. No deliberate retesting, ability score or automatic biography/preset changes. Anay owns policy/storage/contracts, Lukas matching/eligibility integration, Kylie feedback/preferences/game views, Emilia revision/cancellation and device actions. Read the new spec before implementing memory, matching or object-linked prompts.

## Added robot implementation scope

Follow [robot-capabilities-spec.md](docs/robot-capabilities-spec.md): implement **F13 caregiver camera check-ins before F14 local petting/reactions/status/health**. Emilia owns firmware; Anay owns scoped access, schemas, relay and session cancellation; Kylie owns permission/viewer/participant panels and reaction art; Lukas owns activity pause/resume integration and supervised demo. Foundation stop/security controls precede both. Camera is off by default, requires explicit local Allow per request, pauses audio/activities, expires, and never restarts on reconnect. Local Stop ends camera independently of the server. Mic mute is not camera-off. No image recording, vision inference or face recognition. These requirements supersede earlier camera exclusions; all implementation/hardware checks remain pending.

## Implementation approach

- Build the first complete path early: fictional profile → Stackchan conversation → one activity → caregiver contact → factual journal. Complete all four activities (music playlist, gentle 20 questions, photo album talk, object matching) and required failure checks before calling the P0 scope done.
- Stack direction: Bun tooling/runtime, SvelteKit/Svelte/TypeScript web app, SvelteKit backend HTTP routes, native Bun realtime gateway and Bun worker, local PostgreSQL/private photos, and a K151-compatible firmware client. Provider selections and versions remain subject to feasibility checks. Reuse the actual scaffold once present.
- Run the backend, PostgreSQL, and local STT/TTS models on a selected team-managed lab desktop, laptop, or homelab. The lab desktop is a preferred candidate to test, not a verified latency winner. Keep the LLM external. Verify the actual demo network and laptop fallback; no STT/TTS inference is required on the ESP32. Anay owns speech/model integration and server/database deployment; Emilia owns device transport/local control.
- Use one shared backend and session authority, one active audio endpoint, typed validated contracts, and replaceable speech/model/notification/device adapters. Do not add an agent framework, vector database, microservices, or public executable plugins without a concrete task need.
- Follow the technical specification's proposed layout when scaffolding. Keep feature code in its assigned slice. Keep mocks explicit and isolated; never convert a failed live request into fake success.
- Inspect manifests and lockfiles before installing or running tools. Use the pinned Bun version, `bun install --frozen-lockfile`, and the existing `dev`, `check`, `test`, `build` and `fake-device` scripts. Preserve the Bun lockfile; do not recreate tooling or introduce npm/yarn lockfiles. Do not invent commands or claim they ran.
- Use fictional fixtures, including approved photo context. Real contact details belong in protected configuration/storage, not fixture files. NFC, always-on listening, face identification, and microphone/generated-speech/video recording are outside the initial build. Camera is now committed as short, authorized, locally accepted caregiver check-ins, not continuous monitoring. Approved static music assets with source/permission metadata are allowed and are not microphone recordings.
- TurtleBot is deferred under the named-team plan, with no current implementation owner. Subscription + robot sales and reviewed partner marketplace are business hypotheses, not billing/commerce/plugin tasks. Keep a declarative activity-pack seam; no public executable packs or third-party patient-data access.

## Required behavior boundaries

- Caregiver Conversation support uses validated Conversational/Guided/Quiet presets, not a dementia severity score. No automatic changes from speech/games, clinical-stage mapping, or weaker privacy/help/stop rules. Read the support spec before implementing it; Anay owns policy, Kylie UI, Lukas presentation, Emilia device verification.
- Lemmi does not diagnose, assess cognitive decline, recommend treatment, infer clinical mood, guarantee emergency detection, or replace human care. Do not add those claims to prompts, screens, journals, or presentations.
- Ground personal responses in approved context; acknowledge uncertainty. Caregiver-provided facts, participant statements, measured events, caregiver observations, and AI summaries remain distinct. Conversation and summary review cannot silently rewrite biography.
- Use short, patient responses and one question at a time. Activities avoid naming/recall tests (optional visible-picture matching follows F16), countdowns, failure counts, streak penalties, and automatic difficulty escalation. Respect refusal without persuasion.
- Implement sensitive-topic and urgent-concern behavior from the safety specification. Do not invent reassuring biography, impersonate relatives, affirm frightening beliefs as verified facts, or claim the robot checked an environment it cannot assess.
- One endpoint owns music or speech playback; never overlap microphone capture/music/TTS in the first build. Session pause/stop/help silence music and speech; mic mute has a distinct label and controls capture. Unmute alone does not start capture. Local stop/mute must work without a model or server round trip. Capture only during the visible listening state. Pause, stop, disconnect, restart, and handoff invalidate stale capture/output work; late results cannot resume interaction. Verify actual device behavior before claiming independent robot use.
- Manual help bypasses model generation and journal saving. Use verified recipients and application-owned routing. Distinguish request creation, provider acceptance, reported delivery, authenticated acknowledgment, and human-recorded resolution. None implies arrival. Network failures remain explicit.
- Keep notification jobs durable, retries bounded, and backup/expiry behavior aligned with the specifications. Conversation stop does not silently cancel an initiated request; canceling future contact attempts is separate. Simulation is labeled and cannot send real messages or satisfy real-delivery checks.

## Shared control and activity contracts

Use integration-contracts sections 3 and 5: required eligibility/presentation context for activity create/reduce/project, coordinator-only `applyActivitySystemInput` for interrupts/receipts/policy changes, and explicit preference-signal effects. Mic mute cancels capture and its pending input turn, not unrelated approved playback or camera; unmute never opens capture. Quiet returns to capture-off waiting after speech. Do not implement conflicting local interpretations.

## Privacy and security

- Use fictional participant data and team-only failure rehearsals. Lukas is planning optional supervised live participation with Grandma; her health status is unspecified. Require a private readiness rehearsal, her freely given agreement, clear local-speech/external-LLM disclosure, separate public recording/media permission, immediate stop, and a teammate fallback. Do not collect private biography or infer diagnosis. Apply the safety spec’s care-review rules if dementia-specific care needs are involved. A remote-caregiver product requirement does not establish readiness for unattended real-world use. Real notification tests use only verified, opted-in team recipients and fictional concerns within the authorized task.
- Keep provider/admin credentials server-side and out of source control, firmware, browser bundles, model context, logs, screenshots, and demo materials. Pair devices explicitly and scope their access; validate TLS certificates.
- Use simple managed caregiver sign-in and paired/scoped participant device credentials; participants have no password/login flow. Caregiver and participant areas are separate routes and server-enforced permissions in the same app. Enforce authentication and resource authorization outside the model. A demo role switch is not security. Participant clients cannot read private caregiver guidance, contacts, or journals. Verify notification callbacks and require an explicit authorized acknowledgment action; GET/link previews cannot acknowledge.
- Do not persist raw audio or full transcripts. Excerpt saving defaults off; when off, persisted summaries cannot contain utterance text or paraphrases. Build summaries only from permitted retained sources. Keep prompts/transcripts/photos/contact destinations out of logs and durable job payloads.
- Check profile/privacy/session revisions before accepting delayed results or writes. Revocation/deletion must clear dependent summaries and prevent late work or callbacks from recreating removed records. Delete private storage objects and controlled caches as well as database rows.
- Document actual local speech-engine buffer/temp-file/log handling and external LLM/notification provider data handling and external retention limits. Application deletion does not erase delivered messages or automatically erase provider records. Never claim universal deletion, compliance, or clinical validation without evidence.

## Verification and handoff

Run checks appropriate to the change. Use meaningful automated checks for authorization, cancellation, privacy revisions, notification deduplication/escalation, and deletion races. For UI/content, inspect the actual flow, keyboard use, readable controls, and error states; avoid tests that merely mirror implementation. Hardware behavior requires hardware checks, not only mocks.

Before merging integrated work, demonstrate the slice and have the counterpart review shared boundaries as assigned in the build plan: Anay for server/data/access, Emilia for local device controls, Lukas for activity transitions, Kylie for UI/assets. Critical privacy/cancellation/contact changes need substantive technical review, not only visual approval. Review coordination does not prevent completing and testing an isolated feature beforehand.

Report what changed, checks actually performed, failures or unavailable hardware/services, mock-versus-live status, affected interfaces, and the next handoff. Record observed acceptance results in the build plan without marking unrun checks passed. If a safeguard fails, fix or disable the affected feature and describe the fallback. Keep README setup steps and known limitations accurate.

## Confirmed whiteboard direction

F17 Teach Lemmi is required: Lemmi supplies a simple eligible object/topic and invites the participant to explain it. Reuse conversation mode/session/speech, not a fifth game reducer. No naming test, correction, emotional pressure or automatic biography write. Follow experience section 16, integration section 11 and build-plan section 15 for exact handoffs: Lukas supplies reviewed prompts/scene packs, Anay executes teaching/overview/contact routing, Kylie renders panels/cards, Emilia enforces local controls and revisions. Explore pictures reuses approved photo packs; caregiver overview uses permitted source-linked highlights and optional factual duration charts, not clinical/engagement inference. Never promote the whiteboard's 99%/instant alert or happier/less-aggressive notes to guarantees/validated outcomes. Solitaire is explicitly the last stretch item after committed work and other optional features; no core implementation dependency.
