# Lemmi — Integration contracts and handoffs

Stackchan playback update: optional hello `playback.outputWindowChunks:12` negotiates the same bounded240ms credit already used by browser audio; omitted/explicit4 retains80ms. Consume receipts, per-owner authority and Stop cancellation stay mandatory. Firmware locally flushes queued playback on Stop and honors the actual ready window, including short output ending before its prebuffer is full. [Exact handoff and deployed acceptance](handoffs/stackchan-playback-window.md).

November 14 browser listening update (`d6d2ff6`): an explicit Start/Start listening/Resume conversation gesture sequences existing Start/acknowledged unmute/capture commands and opts into half-duplex continuation. Every turn still needs the current server grant; no client permission/authority/schema is added. Continuation waits for actual consumed output and current session/revisions/lease. Quiet returns to waiting. Mute/Stop/Pause, background/disconnect/handoff/profile/privacy changes and errors retire the transient opt-in; plain Unmute and raw Resume remain capture-off. Firmware behavior is unchanged. [Exact handoff and observed checks](handoffs/browser-default-listening.md).

November 14 additive profile-context contracts are exported from `@lemmi/contracts`: `ProfileContext`, `ProfileContextView`, summary records, validated update/upload/read requests, and six fictional-only demo bridge operations. Participant profile/session payloads do not expose caregiver context or memory records. `PersistentData` passes an optional revision-tagged summary and explicit privacy-refusal flag through its existing checkpoint; no new session authority or worker is introduced. Anay reviews storage/access/revocation; Kylie reviews the shared form. [Rollout and interface detail](handoffs/profile-context-memory-2026-11-14.md).

**Undeployed speech concurrency increment:** separate STT/TTS admission lanes and independently cancelable 1–4-worker engine pools replace the global single-job gate. Match `LEMMI_SPEECH_STT_WORKERS` / `LEMMI_SPEECH_TTS_WORKERS` in gateway and speech-wrapper environments; existing input/output limits and per-profile ownership remain. CUDA TTS is explicitly selectable; target NVIDIA validation is delegated to the server agent. Private `/health` adds engine device/compute and configured/ready worker counts; public HTTP/WSS schemas are unchanged. [Implementation, local evidence and server-agent steps](handoffs/speech-gpu-concurrency.md).

**Undeployed browser speech candidate:** [natural speech turns](handoffs/natural-speech-turns.md) adds local WebRTC detection using existing granted PCM/`audio.end`/`input.pause`. No wire/schema change. Optional internal `SpeechAdapters.onTiming` propagates through the scheduler. Public web settings control automatic/manual ending and content-free durations. The user-selected browser default is 1500 ms after speech; firmware silence detection remains pending with the same initial target. Backend provisioning now selects `en_US-hfc_female-medium` (22,050 Hz) for either output endpoint. Initial silence uses paused + explicit Resume; whole-turn STT and capture bounds remain.

**Status:** Starter baseline implemented; full v1/provider/hardware contract freeze pending
**Version:** 0.1  
**Owners:** Anay (server/contracts), Emilia (device contract), Lukas (activity contract), Kylie (views/assets)

This is the small shared implementation reference for all four Codex workstreams. Read it with the [technical specification](technical-spec.md) and [build plan](build-and-demo-plan.md). The initial exports now exist in `packages/contracts/`, alongside a minimal pure music example and single mock coordinator. See [team-start.md](team-start.md) for the exact implemented subset. The prose below includes required future extensions: not every field/event/adapter is implemented. Anay maintains the baseline; freeze the complete version 1 only after counterpart and hardware checks. Change the contract and consumers together; do not invent a second protocol or backend when an interface is missing.

## Persistent device credential extension (undeployed)

On `anay/persistent-device-credentials`, `PairDeviceInput` accepts caregiver-selected optional `credentialMode:'persistent'`. PostgreSQL gateways retain its hashed key until revoked across restarts. `ClaimDeviceResult.expiresAt` and `device.ready.credentialExpiresAt` may be `null`; omitted mode keeps the one-hour behavior. Existing routes, outer domain gate, paired scope, single session authority and explicit-start/local-control rules are preserved. Restarts never restore a session/capture/output. Revocation remains caregiver-only and its retry receipts are durable. Emilia owns persistence of the returned key and nullable-expiry handling in firmware; no firmware source/hardware check is included. Exact schema/migration/rollout/remaining limits: [persistent-device handoff](handoffs/anay-persistent-device-credentials.md).

## Public Photo Story browser extension — November 14, 2026

Runtime `dafdf4e` hosts reviewed generic photo scenes for confirmed fictional profiles. Browser-only capability `device.ready.photoStory`, current-generation owner commands `input.photo.start`, `input.photo.action {instanceId,expectedRevision,action}`, `input.photo.repeat`, and safe `activity.changed {activity}` reuse one session/coordinator/audio lease. Added `photo.skip`/`photo_skipped`; scene bytes use current browser cookie/profile/device/epoch/revision checks at `/v1/demo/photo-assets/:assetId`, never client URLs. Scope is caption-only reviewed illustrations; private uploads, image analysis, camera, full journals and other game hosting remain unavailable. Existing Stop/Pause/mute/handoff/revision rules govern all pending work. Teaching spoken transitions use fresh server-owned output authority from `4690bf6`; unmute/resume never starts capture. Exact contracts and acceptance: [backend API](backend_api.md), [status](backend-status.md).

## Implemented transport baseline

**Browser voice follow-up:** the local `/participant/voice` demo uses the existing device events/audio grants/PCM/receipts, with a development-only credential proxy to the configured HTTPS backend. It is a transport/player, not a second session authority. [Voice setup and acceptance](teach-lemmi-voice-demo.md) distinguish automated and live results. Compatibility with Anay's already deployed endpoint metadata adds nullable credential expiry, `handoff` to the nine-control allowlist and optional `activeEndpointId`; no new credential permissions or multi-profile activity behavior is introduced.

**Teach Lemmi branch increment:** `codex/teach-lemmi` implements conversation-mode teaching handlers and reviewed Alex prompts, a local scripted text client, active-time expiry and synthetic device/speech checks. [Exact interface changes and owner handoff](handoffs/lukas-teach-lemmi.md) include `TeachingSnapshot.prompt/topicLabel`, feedback actions, teaching wire events and the mock-only `conversation.submit` client. No fifth ActivityId or independent authority. Durable policy/journal observations, actual firmware/browser voice and shared deployment acceptance remain pending.

**Multi-profile/browser increment (November 14, feature branch):** `SessionRegistry` isolates the existing coordinator by authorized profile. Multiple device connections are admitted with an atomic reservation per device. Same-profile browser/robot endpoints share snapshots and explicitly hand off a single audio lease using `input.handoff`; `activeEndpointId` identifies its owner. `createParticipantSetup` and `ParticipantConnection` expose the browser setup/WSS seam. Demo enrollment is PostgreSQL-backed, explicitly enabled, limited to fictional profiles and protected by the private domain gate. Enrollment hashes survive restart; sessions/capture/output do not. See [exact routes, setup and handoff](handoffs/anay-multi-profile-endpoints.md). This increment supersedes earlier single-device/profile and restart-repairing statements on this feature branch; it does not change the deployed backend.

**A18/A19 database/profile/assets increment:** optional PostgreSQL/private media now supports `profile.detail/update`, safe paired `profile.load`, approved-media creation/metadata and authenticated resource byte reads. [Exact fields/routes/setup/limits](handoffs/anay-database-profile-assets.md) cover credential persistence/restart, revision cancellation and shared clients. Legacy mock `profile.save/loadCaregiver/assets.resolve` do not become live by implication. Contact/policy tables are only storage foundations; A20–A25 workflows and production/counterpart/hardware verification remain pending.

For the current executable interface inventory, use [backend_api.md](backend_api.md): public/private paths, client operation availability, device/text events, speech wire API, limits, credentials and unresolved production routes. Maintain it alongside schema/authority/client changes; proposed routes below are still not implementation claims.

**Earlier speech/text increment (superseded for voice/browser transport by the feature handoffs below):** see [Anay → Emilia/Kylie](handoffs/anay-speech-chat.md). Optional authenticated `input.text`/`response.text` uses `SessionCoordinator.submitText` with session/generation checks, bounded transient dialogue and cancelable OpenRouter integration. `device.ready.textChat` indicates configuration only; audio/camera remain false. A private local STT/TTS wrapper is tested independently of the device. No mic grants/ingestion, complete STT→chat/playback, live LLM-provider acceptance or German voice validation is implied. Shared conversation schemas supplement device WSS; generic `/v1/live/<operation>` RPC remains unavailable and browser text transport is a pending handoff.

**Activity contract increment A01–A04:** [Anay → Lukas/Kylie handoff](handoffs/anay-activity-contracts.md) documents implemented discriminated states, guessing graph validation, required nullable matching context, command/signal freshness helpers and strict factual event/transition schemas. Guessing views now include `roundPhase`/`offeredGuess`; matching views/commands use a nested nullable `presentation` instead of the old top-level presentation fields. Shared state/screen fixtures are available, while the host still runs only mock music. Missing reducers/content, A05 hosting/execution and A06 counterpart review remain pending.

**Control foundation update:** see [Anay → Emilia/Kylie handoff](handoffs/anay-control-foundation.md). An opt-in authenticated control mode now shares the existing `SessionCoordinator`, with scoped device pairing/claim/revocation resource routes, `clients.device`, managed-provider introspection verification and `device.ready`/live control snapshots. `DeviceEventSchema` can represent `audio:{supported:false}` and explicit `input.start`. These additions do not implement media, camera, production event streaming, sign-in UI, persistent credentials or real notifications. Provider responses and device behavior have been tested with fixtures/computer clients only; actual provider/deployment/hardware and counterpart review remain pending. Default mock transport is preserved.

`ServiceClients`, `createClients`, `createHttpTransport` and `createFixtureTransport` are exported from `@lemmi/contracts`. The local mock path uses POST `/v1/mock/<operation>` through SvelteKit to the loopback gateway’s internal adapter. These are development RPC endpoints, not replacements for the specified production resource routes. `/v1/live/<operation>` explicitly returns UNAVAILABLE; it never falls back to mocks. Browser subscriptions currently poll the same authority once per second and return an unsubscribe function; a production event stream remains Anay’s task.

`DeviceEventSchema` and `ServerEventSchema` cover the initial fake-device hello/heartbeat/control/snapshot path plus the branch increments above. The fake client uses local `ws://` and a development-only token, not production pairing or TLS. Camera frame/health/control shapes and UI snapshots are preliminary schemas; camera authorization/streaming and learned-preference storage remain unavailable. Treat numeric media limits as proposed targets until measured. The web app uses SvelteKit 3: `vite.config.ts`, `#lib/*` imports and `$app/tsconfig`, not a new `svelte.config.js` or older aliases.

## 1. One system, four ownership areas

| Owner | Proposed files/modules | Consumes | Produces |
| --- | --- | --- | --- |
| Anay | `apps/web/src/routes/v1/`, `apps/web/src/lib/server/`, `apps/realtime/`, `apps/worker/`, `packages/server/`, `db/`, root tooling | Emilia's device events; Lukas's pure activity module | HTTP/WSS, session coordination, local STT/TTS, external LLM, auth/data/contact/journal services, typed mocks |
| Emilia | `firmware/stackchan/`, device test fixtures, robot asset conversion | Versioned device protocol; Kylie's mascot exports | Robot audio transport, capture indicator, local mute/unmute/stop, reconnect/watchdog behavior, compatible mascot rendering |
| Kylie | `apps/web/src/lib/features/`, page/layout components outside `/v1`, shared UI/assets | ActivityView and journal/profile/help clients | Participant and caregiver UI, art/tokens, browser audio client, accessible controls and all loading/error states |
| Lukas | `packages/activities/`, reviewed activity content, demo materials in the build plan | Shared activity schemas; approved asset metadata | Music/guessing/photo/matching logic, teaching prompts, tests, public view projection, factual event outputs, supervised live-demo plan |

Anay owns package setup, migrations and server authorization. Kylie owns app navigation/design/shared UI. Emilia and Anay jointly agree wire-level device changes. Lukas and Kylie jointly agree activity presentation fields. A shared file has one editing owner at a time; request the needed change by exact type/export name. These boundaries do not block routine edits already assigned by the user.

## 2. Shared types and clients

`packages/contracts/` contains environment-neutral runtime schemas and inferred TypeScript types. It must not import Svelte, firmware code, database clients, or secrets. `packages/server/` is server-only and must never enter browser bundles; configure package/import boundaries and verify the production bundle.

Proposed activity IDs: `music_playlist`, `twenty_questions`, `photo_album`, `object_matching`. Preserve versioned pack IDs separately. Object matching is the new fourth required activity; the prior sorting design remains superseded.

```ts
type ActivityId = 'music_playlist' | 'twenty_questions' | 'photo_album' | 'object_matching';
type ChoiceAnswer = 'yes' | 'no' | 'not_sure';
type ActivityAction =
  | { type: 'track.select'; trackId: string }
  | { type: 'track.play' | 'track.pause' | 'track.next' }
  | { type: 'guess.answer'; answer: ChoiceAnswer }
  | { type: 'guess.skip' | 'guess.reveal' | 'guess.new_round' }
  | { type: 'photo.select'; photoId: string }
  | { type: 'photo.next' | 'photo.previous' | 'photo.just_look' | 'photo.talk' }
  | { type: 'match.select'; choiceId: string }
  | { type: 'match.show' | 'match.not_sure' | 'match.next' | 'match.finish' }
  | { type: 'activity.leave' };

interface ActivityCommand {
  commandId: string;          // retry deduplication key
  sessionId: string;
  instanceId: string;
  expectedRevision: number;
  action: ActivityAction;
  presentation?: MatchingPresentation; // required for match.*; echo current view
}

interface MatchingPresentation {
  instanceId: string;
  presentationId: string;
  presentationRevision: number;
  policyRevision: number;
}

interface ActivityView {
  activityId: ActivityId;
  instanceId: string;
  revision: number;
  phase: 'ready' | 'active' | 'paused' | 'ended' | 'unavailable';
  title: string;
  prompt: string | null;
  assetIds: string[];
  choices: { id: string; label: string; action: ActivityAction }[];
  capabilities: { audioRequired: boolean; largeScreenPreferred: boolean };
  // Actual discriminated per-activity fields live in ActivityViewSchema.
}
```

Do not overload activity actions with session pause/stop/help/mute. Those use the shared session/device client and take priority over activity transitions. Playback receipts are typed device/browser events, not untrusted user claims that audio played.

Anay supplies client interfaces and explicit mock/real implementations for:

| Client | Minimum operations | Consumer |
| --- | --- | --- |
| Profile | load/save participant-safe and caregiver projections; revision conflict | Kylie |
| Session | start, pause, resume, stop, mute state, endpoint handoff, subscribe | Kylie, Emilia through device protocol |
| Activities | list packs, start, get view, submit action, leave, subscribe | Kylie; backed by Lukas's module |
| Caregiver contact | create request, status, acknowledge, cancel future attempts | Kylie; robot uses Anay's fixed help event handler |
| Preferences | load/update/forget learned policy, remembering setting, validated feedback signal, scoped eligibility snapshot | Kylie; Anay authority, Lukas consumes eligibility, Emilia follows revisions |
| Journal | list/detail, add observation, edit/review/remove summary | Kylie |
| Assets | resolve approved asset ID for scoped use; metadata/errors | Kylie, Lukas, Emilia via negotiated device projection |

Operations return typed success or stable errors: `UNAUTHORIZED`, `FORBIDDEN`, `REVISION_CONFLICT`, `UNAVAILABLE`, `NOT_FOUND`, `VALIDATION_ERROR`, `SAVE_FAILED`. Failed live calls never fall back to mock success. Mock fixtures cover missing assets, no excerpts/summary, failed writes, disconnected device, and unavailable speech/model services.

## 3. Activity engine seam: Lukas → Anay → Kylie

Lukas implements pure `createActivity`, `reduceActivity`, and `projectActivity` functions against shared schemas. They accept state/action/approved content and explicit inputs, and return next state, participant-safe view, factual event proposals, and allowlisted effect requests. They perform no network calls, database writes, microphone capture, filesystem reads, or timer scheduling. Inject clock/randomness if needed; prefer deterministic first content.

Anay hosts the authoritative activity state alongside the session coordinator. Serialize commands per activity, enforce scope/revision, deduplicate by command ID, validate permitted effects, and persist bounded factual events through the journal service. A failed transition returns an error rather than inventing completion. Duplicate/out-of-order inputs cannot advance twice. After reconnect, send a fresh snapshot; clients never merge two competing states.

Kylie renders only `ActivityView` and submits its typed actions. Do not copy game rules into Svelte components. UI may hold pending/loading presentation state; backend snapshots remain authoritative. Fake clients must call the same pure module/fixtures where useful, not independently reimplement the games.

Effect types are an allowlist, initially `speak_approved_text`, `play_approved_track`, `stop_media`, `offer_photo_conversation`, and `request_listening`. F15/F16 extend this allowlist with `preference.signal` and `item.uncertain`, carrying only canonical IDs and supported presentation evidence, never raw utterances. Effects are proposals, not permission: Anay checks current session generation, privacy revision, asset access, and endpoint lease before execution. An LLM cannot invent effect types, asset URLs, contact destinations, or motor commands.

`photo.talk` requests Anay's existing conversation path with the approved current photo context. Guessing uses a small reviewed question tree/candidate set first; free-form LLM game generation is deferred. No private biography is needed for guessing. Only approved playlist IDs/files can be played; the model cannot choose an arbitrary external stream.

### Reducer and view contracts to scaffold first

Implement runtime-validated discriminated activity states and views rather than an arbitrary JSON blob. Minimum state fields: music = playlist/current track/playback phase; guessing = reviewed pack/current question/candidate IDs/asked count/round phase; photo = album/current photo/just-look-or-talk phase. Asset/pack references must be validated before state is created. Keep private state separate from participant-safe projection and from any LLM context.

Proposed pure interfaces:

```ts
interface ActivityContext {
  eligibility: EligibilitySnapshot; // current server-filtered content/entity IDs
  presentationPolicy: ActivityPresentationPolicy; // bounded effective support config
}

type ActivitySystemInput =
  | { type: 'system.pause'; reason: 'participant' | 'camera' | 'help' | 'disconnect' | 'handoff' | 'config_change' }
  | { type: 'system.resume' }
  | { type: 'system.end'; reason: 'stop' | 'session_end' | 'revoked' }
  | { type: 'system.eligibility_changed' }
  | { type: 'system.playback_receipt'; receipt: ValidatedPlaybackReceipt };

createActivity(input: StartActivityInput, content: ApprovedPack,
               context: ActivityContext): ActivityState;
reduceActivity(state: ActivityState, action: ActivityAction,
               content: ApprovedPack, context: ActivityContext): ActivityTransition;
applyActivitySystemInput(state: ActivityState, input: ActivitySystemInput,
                         content: ApprovedPack, context: ActivityContext): ActivityTransition;
projectActivity(state: ActivityState, content: ApprovedPack,
                context: ActivityContext): ActivityView;
```

These function exports now exist in `packages/activities/` for the starter music example. The other three reducers remain unimplemented, with unavailable view fixtures; their placeholder states and pack schemas must be extended with Lukas before those games can run. Anay and Lukas freeze the discriminated context, presentation policy, receipt and transition schemas together. `ValidatedPlaybackReceipt` binds instance, effect/stream ID, current generation/lease, sequence and actual endpoint playback state; only Anay accepts and normalizes endpoint receipts before reducer dispatch. Clients cannot submit `ActivitySystemInput` through activity-action routes. Anay maps authorized session/device events to system inputs and serializes them with participant actions. Lukas owns their pure state transitions; session authority remains Anay’s.

Pause preserves position and produces no new playback/listening/progression; Anay cancels pending effects before dispatching it. Resume requires an explicit participant command, returns the activity to ready at its retained position and never replays old effects. End is terminal. While paused, reject ordinary progression actions; eligibility updates may safely remove excluded content without speech/progression. If the current item becomes ineligible, clear it and return a safe empty/ready view, retaining paused status until explicit Resume. Generation/lease/revision checks reject delayed receipts, which cannot reactivate a paused/ended activity. Any required clock/random input is explicit and deterministic.

Context is required for creation, transitions and projections, including matching, so excluded targets, alternatives and prompts cannot leak through a view-only path. Refresh it on policy changes before more actions/output. An unavailable required eligibility snapshot is an explicit unavailable state, never an unrestricted fallback. Presentation IDs/revisions come from the coordinator and accompany matching views/evidence. The existing `ActivityAction` remains participant-only; stop/help/mute never become game actions.

`ActivityTransition` returns `nextState`, `events`, and `effects`, each validated against shared schemas. Instance/session/revision/command IDs come from the coordinator; reducers cannot mint authorization or declare playback succeeded. `ApprovedPack` is a discriminated pack: music tracks, album entries with caption/context, a bounded guessing tree/candidate set, or matching samples/choices with canonical entity tags. Resolve media bytes through the server asset adapter, not inside the reducer. Do not import server-only pack metadata into a participant bundle if it contains private captions/guidance.

Serialize per-instance actions. A first valid command increments revision once; a retry with the same ID returns its prior result, not a second transition. An old revision returns `REVISION_CONFLICT` with the current safe snapshot. Each effect has a stable ID associated with that committed transition, and the executor deduplicates it before playing audio. After pause/stop/handoff, invalidate the generation/lease before processing more effects. A client animation or network retry cannot count as an additional question, advance two photos, or play the same track twice.

Shared fixture set: music ready/playing/paused/failed; guessing yes/no/not-sure/skip/reveal/round end; album next/previous/just-look/talk/missing caption/image; duplicate action, stale revision, session stop during pending effect. Lukas owns pure transition checks; Anay owns orchestration/retry/privacy checks; Kylie and Emilia exercise the same fixtures in their clients.

### Required seam checks

Exercise all four activities with participant actions interleaved with system pause/resume/end, policy updates and validated playback receipts. Reject client-forged system inputs, duplicate/stale receipts and actions after end; resume must not replay effects. Verify filtering of matching targets/distractors and photo/guessing/music prompts in every projection, plus both preference-signal effects and save failures. Use the same fixtures in Anay’s host and Kylie/Emilia clients. Check mic mute during pending recognition/generation separately from unrelated approved playback; Quiet completion and unmute remain capture-off.

## 4. HTTP and event seam

Keep the technical specification's profile/session/help/journal routes. Add these proposed activity routes under `/v1`:

- `GET /activity-packs`: authorized catalog of reviewed built-in packs.
- `POST /sessions/:id/activities`: start `{activityId, packId, packVersion}` with an idempotency key; returns initial participant-safe view.
- `GET /sessions/:id/activities/:instanceId`: current authorized view.
- `POST /sessions/:id/activities/:instanceId/actions`: validated `ActivityCommand`; returns updated view or revision conflict.
- `GET /assets/:id`: authorized streaming/read of approved media, never a raw server path. File-type/range/size limits must match the selected playback implementation.

Use `activity.view` snapshots over the existing event connection. Include `sessionId`, generation, instance/revision, event ID, and server time. Participant views exclude private guidance, contacts, hidden game internals, and journal text. Avoid stuffing raw statements into activity-event payloads; fixed IDs and enum codes are sufficient.

Activity journal events: `activity_started`, `activity_ended`, `track_selected`, `track_played`, `track_paused`, `question_answered`, `question_skipped`, `guess_offered`, `photo_selected`, `photo_talk_requested`, `media_failed`, plus shared interruption events. A selection/request is not proof of playback. Only endpoint receipts support playback events; count assistance/technical context without cognition scores. The technical spec's privacy rules govern any permitted statement excerpts.

## 5. Audio and device seam: Emilia ↔ Anay

**Feature branch increment:** `anay/speech-pipeline` implements the backend voice seam; [exact protocol and handoff](handoffs/anay-speech-pipeline.md) and [API reference](backend_api.md#opt-in-voice-turns-and-playback) cover configuration, capabilities, current capture grant, indexed PCM/end, bounded output and consumed-playback receipts. Shared `speech*Fixture` exports contain fictional IDs/generated silence. Legacy hello remains audio-disabled without negotiated playback. K151 integration and actual browser microphone/speaker acceptance remain pending. The multi-profile increment now supplies browser transport and local controls.

The current engine accepts a bounded complete utterance after explicit `audio.end`; the technical-spec incremental-recognition target and silence-end detection are **not yet implemented**. One current explicit turn is limited to 20 seconds/640,000 input bytes; four output frames may be ahead of consumed receipts. All presets return capture-off waiting after completion. The computer player's receipts are simulated, not hardware proof.

The robot's WebSocket connects to Anay's realtime gateway, not to a second app-owned backend. The SvelteKit app subscribes to the same session and can use the browser endpoint as fallback. Firmware never knows LLM keys, caregiver destinations, database credentials, or private guidance.

Begin with the technical specification's protocol v1 and negotiate actual firmware-supported audio capabilities. Share a sample `device.hello`, control event, audio chunk, and server state response before writing both ends. Agree frame format, sample rate, channel count, endianness, queue limits, heartbeat, and TLS/pairing. The initial PCM proposal must be benchmarked; changes require both Emilia and Anay to update fixtures.

Local mute immediately stops capture/transmission. Unmute clears the mute setting but does not itself start recording; capture additionally requires an explicit/current valid listening state. Local stop clears capture/playback queues. Network acknowledgments never override a local stopped/muted condition. Show actual capture state on the robot. Disconnect/reboot begins muted or capture-off, with explicit restart; no audio backlog uploads.

One endpoint owns output at a time, whether it is speech or music. Apply the shared control-semantics table below to pending music and speech jobs; microphone mute cancels its input turn but does not globally invalidate unrelated output. During music playback, microphone capture is off. To talk, explicitly stop/pause music first. No simultaneous microphone capture, music, and TTS in the first build. Muting the microphone alone does not mute music; label controls separately. Session pause/stop/help silence music as well as speech. Preserve the track/position where supported and resume only explicitly.

If robot music playback is not feasible, use an explicit companion-screen audio handoff and indicate the active speaker. Do not play the same track on both. Browser autoplay restrictions must be handled by user-initiated playback and a visible recovery state.

### Shared control semantics

This table governs firmware, browser and server behavior. Local capture/output restrictions apply before network acknowledgment; stale commands cannot undo them. Cancellation of capture invalidates the affected input turn/results; it need not invalidate unrelated music output. Use separate input-turn and output validity rather than treating every mute as a global playback cancellation.

| Control | Capture and pending input | Speech/music output | Camera and activity | Next step |
| --- | --- | --- | --- | --- |
| Mic mute | Immediately stop capture/transmission, discard unsent capture and cancel its pending turn/results | Existing approved speech/music may finish or continue; mute does not itself stop output | No camera consent/state change; does not advance or pause the activity | Remain capture-off |
| Mic unmute | Clear mute setting only; never open capture | No output restart | No camera/activity change | A fresh explicit Speak now or valid explicit start is required |
| Pause | Stop capture and cancel pending turns | Stop/flush speech/music and invalidate queued effects | Pause activity at its position; does not authorize or end an already active camera check-in | Explicit Resume may request one fresh reviewed reorientation; browser listening intent still needs consumed output/current waiting and a fresh capture grant; Quiet/text fallback remain capture-off |
| Global Stop | Stop/flush capture and cancel all pending turns | Stop/flush speech/music and queued motion | End camera locally and end session/activity | New explicit session start only; initiated help requests remain independent |
| Stop camera | Keep capture off | Keep speech/music off | End camera locally, clear frames, leave activity paused | Explicit Resume, then a fresh speak/play action |
| Get help | Stop capture and cancel pending turns | Stop/flush ordinary speech/music; only current fixed help-status output may run afterward | End camera locally and pause activity; initiate fixed contact routing | No automatic resume; request cancellation is separate |

Disconnect/watchdog stops capture, output, camera and motion locally, invalidates stale work, and requires explicit continuation after reconciliation. Mic mute must not be used as a substitute for Pause/Stop or advertised as camera-off. If a capture turn caused pending model/TTS work, muting cancels that work; unrelated already-approved playback is governed by its own output token. Tests must distinguish these cases.

The undeployed [Photo Story Start/Resume candidate](handoffs/photo-story-start-resume-2026-11-14.md) uses existing approved-output authority for a new greeting/reorientation on explicit Start/Resume. This is coordinator-owned output, not replay of reducer effects. Server-resolved English/German is authoritative; unavailable/failed playback returns current approved text with capture off. German activities remain unavailable. Reminders are transient and revision-bound; newer robot/browser output credit and local-control requirements remain.

### Fixed speech while interaction remains paused

The opt-in speech implementation cancels a recognized concern/refusal input, pauses it, and creates fresh authority only for the application-owned fixed reply. The gateway publishes the paused generation immediately. Existing `response.text` (`source:'fixed'`), `response.start` and PCM events share a new turn ID/current generation/lease; receipts must use those identifiers. Ordinary output never gains permission to run while paused. A paused state alone cannot authorize playback. Local Stop/pause/watchdog always override this output; capture remains off and completion/failure/expiry leaves the interaction paused. Firmware/UI should track this bounded fixed playback independently from session phase. Backend software checks pass; physical enforcement and counterpart review remain pending. See [speech handoff](handoffs/anay-speech-pipeline.md#fixed-concernrefusal-output-after-pause).

## 6. Asset handoff: Kylie → Emilia/Lukas/Anay

The project/companion name is Lemmi. The exact avatar set is `dog`, `cat`, `bunny`, `bird`, `lemming` (labels Dog, Cat, Bunny, Bird, Lemming). Define `AvatarId` as this enum in shared contracts. Store `avatarId` with profile revision and expose it in participant-safe profile/device state; `expressionId` is a separate interaction-state enum. Do not use the animal name as an expression or activity ID. Validate both fields at the boundary. Avatar changes follow the same approved profile-update path and invalidate outdated render instructions; preserve the choice on app/device handoff.

All five use the same session rules, activity logic, controls and voice configuration. The minimum final asset target is five avatars × six static states = 30 frames, plus app chooser previews. First prove one complete avatar/state set with Emilia, then extend the approved format to the remaining four. Static/reduced-motion mode does not require a sixth neutral avatar. Missing device support is explicit; do not silently render another animal. Stop/microphone indicators remain independent of face art. See [Kylie’s guide](kylie-design-guide.md) for inspiration and exports.

Kylie owns source art, UI tokens, mascot expression IDs, and app layouts. Emilia owns conversion/rendering and reports actual display/firmware constraints first. Agree a small expression set: `idle`, `listening`, `processing`, `speaking`, `paused`, `unavailable`; actual microphone state also has a textual/icon indicator independent of the face. Export static frames first, simple animation only after audio/control works.

Create an asset manifest with ID/version, purpose, dimensions, encoding, file size, creator/source, permission/license note, and alt/caption text. Robot exports must fit its tested memory budget and 320 × 240 display; do not assume app graphics can be copied directly. Lukas references approved asset IDs; Anay resolves them through scoped storage. Commit only approved generic demo media, never private family photos or contact details. Licensed static music assets are distinct from forbidden recorded microphone/generated-speech files.

## 7. Contract freeze, integration, and done

The starter now supplies initial validated shared types, a running local app/gateway, clients/fixtures, subscriptions by non-overlapping polling, and a contract fixture. Reuse it; Anay completes the missing schemas/live adapters rather than starting another scaffold. Emilia and Lukas verify their seams; Kylie runs one screen against each mock. Missing scaffolding is a foundation task owned by Anay, not a reason for three independent projects.

First integration proves: app starts session → robot receives state → microphone turn reaches local speech/backend → response plays → music starts/stops through shared lease → activity event appears in journal → help bypasses the LLM. Then add photo and guessing through the same interfaces, not new paths.

Record checks and exact tested versions in the build plan. Every owner hands off changed files/contracts, run commands that actually exist, mock/live status, checks performed, and blockers. Anay reviews server/data changes; Emilia reviews device changes; Lukas reviews activity transitions; Kylie reviews UI/assets. Cross-boundary changes receive the counterpart's review, without blocking isolated feature work.

Open selections: exact firmware/engine/voice, accessible device controls, approved media, host/network, notification channel/auth library, and actual event timetable. The docs set interfaces and priorities; they do not establish untested performance or infrastructure.

## 8. Conversation support contract extension

Backend communication-support increment (November 14, `anay/chat-support-hardening`): use `clients.profile.support` for the saved preset/current session, existing `profile.update` for a future-session default, and `profile.applySupport` for explicit apply-now. The latter pauses/cancels and requires participant Resume; it cannot supply an unsaved preset or actor. `resolveCommunicationSupport` and `communicationSupportPreviews` are shared exports. Current `ActivityContext.presentationPolicy` now follows the effective session value instead of the fixture's hard-coded Guided value. No device wire schema changes. See [Anay's support handoff](handoffs/anay-chat-support-hardening.md) for exact GET/POST paths, bounds and counterpart work; these additions are not deployed.

Use the caregiver-configured `CommunicationSupport` enum/schema and session-snapshot/application rules in [communication-support-spec.md](communication-support-spec.md). Anay owns schema/authorization/config resolution; Kylie owns the single selector/preview component in caregiver profile; Lukas consumes a bounded presentation policy; Emilia follows effective session speech/control settings. Add three same-topic preview fixtures, conflict/unauthorized/save-failure cases and apply-now stale-output checks before connecting all clients. No second local slider store, diagnosis field or automatic staging is introduced.

In Quiet companionship, completion of speech returns to capture-off `waiting`; never automatically open another listening turn. A participant’s explicit Speak now starts one turn and its response returns to waiting. Conversational/Guided may continue into listening after speech only under a current explicit server capture grant and valid local permissions/state. Firmware/browser clients never start capture merely because playback ended. Stop/pause/mute/camera/help override every preset; unmute alone never restores a capture grant.

## 9. Camera-first device extension — Anay ↔ Emilia ↔ Kylie ↔ Lukas

Adopt the shared schemas/state machine, `/v1` check-in routes and event names in [robot-capabilities-spec.md](robot-capabilities-spec.md) before freezing protocol v1. **F13 precedes F14**. Anay supplies `CheckInClient` (request, status/subscribe, end), mock/real implementations, authorization, relay and coordinated session pause. Emilia supplies hello capabilities, local consent nonce/Allow/decline, capture/stop/deadline enforcement and real frames. Kylie renders the same snapshots in caregiver viewer and participant panels. Camera state is independent of audio mute and ActivityView; no duplicate frontend authority.

Add fixtures for default disabled, unauthorized, awaiting Allow, declined, start timeout, active/fresh, stale, expiry, local Stop/help, revoked access, duplicate viewer, server/device reconnect and late start/frame. No mock fixture contains real photos. Media remains a separate bounded authenticated channel on the existing gateway; only access metadata is durable.

Lukas supplies `applyActivitySystemInput` pause/resume/end/eligibility/validated-receipt transitions for all activities; Anay invalidates pending effects and freezes progression during the check-in. Ending video does not auto-resume. Kylie renders paused state without advancing a question/track/photo. After F13 gates, Emilia adds local `pet_ack` rendering and validated `device.health` telemetry; Kylie supplies overlays and health views, Anay validates fields, Lukas confirms no pet changes activity state. Keep shared generation/revision conventions and update consumers/fixtures together.

## 10. Preference memory and matching extension (F15/F16)

[Personalization-and-matching-spec.md](personalization-and-matching-spec.md) defines canonical topic/object IDs, ProfilePreference/ItemPolicy/EligibilitySnapshot, memory permission, signal validation, scoped operations and retention. Add `policyRevision` to session/output/effect validity checks and a server-issued matching presentation ID/revision; no client/model can select another profile's policy or invent evidence. Keep current session generation and all existing privacy checks.

Anay supplies one Preferences client, runtime schemas and mocks before consumers; Lukas receives eligible reviewed content and returns pure matching transitions plus allowlisted signal proposals; Kylie renders matching and Interests & boundaries; Emilia cancels obsolete narration/views after a policy/profile revision. Only the server commits retirement/preferences. Positive pattern markers and uncertainty markers are bounded and idempotent, never append-only performance histories. Canonical retirement filters all activity/proactive topic selection, not just matching.

Freeze fixtures for Alex’s functional profile and rejected example/unassigned IDs, preferred versus avoid precedence, explicit refusal, first/later uncertainty, duplicate signal, retired alias/distractor, all-ineligible content, remembered/session-only modes, failed save, stale eligibility, explicit undo, forget/revocation/deletion while output is pending, and camera pause/resume. No raw utterances in durable fixtures/events. Journal summary sources remain unchanged; memory is a separately permitted category.

## 11. Confirmed whiteboard extension: teaching, scene packs and overview

F17 Teach Lemmi is a conversation mode, not a new ActivityId/reducer. Keep the four activity IDs; add `ConversationMode = 'open' | 'teach_lemmi'` and an authorized current-session `TeachingSnapshot` with topic/entity ID, optional approved asset ID, presentation ID/revision, policy revision and ready/listening/processing/paused/unavailable phase. Runtime-validated `teaching.start`, `teaching.next`, `teaching.not_sure`, `teaching.finish` commands use the existing session-command transport and idempotency/revision checks. Starting/next selects a permitted catalog topic; clients cannot smuggle arbitrary content. Finish returns to ready with capture off, not automatic open conversation. Mode changes invalidate pending speech/capture and require normal explicit continuation.

Anay owns selection/session authority/conversation execution; Lukas supplies reviewed teaching prompts/topic assets with canonical tags, no independent model service. Kylie owns a Teach Lemmi tile and the mode-specific panel in `/participant/conversation`; Emilia consumes the shared snapshot and emits supported actions. Reuse F15/F16 refusal/uncertainty policy and ensure camera pause/stop/help override teaching. Add fixtures for empty/sparse profile, explanation, change topic, Not sure, all-retired, stale response, failed model/policy save and explicit finish. Do not expose correctness flags or silently approve biography.

The November 14 user-authorized branch adds Like/Avoid commands and a fifteen-minute active-time limit. It excludes paused/disconnected/unavailable waiting, cancels delayed generation/output at expiry and returns to ready with capture off; no participant countdown. Current snapshot prompt/label and all exact source/mock/live limits are in the [teaching handoff](handoffs/lukas-teach-lemmi.md). Existing four-activity contracts remain unchanged.

Explore pictures is a photo pack variant (`collectionKind: 'album' | 'place_scenes'`) with existing approved captions/context/tags and navigation; it is not another game ID or a camera/map service. Content approval and shared eligibility remain mandatory.

Anay supplies protected `GET /v1/profiles/:id/overview` through the shared caregiver client: profile projection, readiness, recent activity references, open request references and permitted journal-highlight references. Kylie renders source-linked cards and explicit partial/error/no-summary states. Optional per-activity duration aggregates use known active intervals only, excluding known pauses/camera/disconnects; return unknown/gaps honestly. Do not sum overlapping intervals twice, infer engagement or create a parallel transcript/analytics store. Apply deletion/privacy changes and caregiver resource authorization to all aggregates/highlights. Charts remain optional after the core cards.

### Participant opening and teaching choice extension — November 14, local candidate

`TeachingSnapshot` adds optional `choices: {entityId, label}[]` (at most three) and `choosingTopic`. A menu has no selected `entityId`; its prompt contains the greeting and the server-filtered choices. Public `input.teaching.start` and spoken activity starts use `teaching.start {offerChoices:true}`. Direct legacy `teaching.start` without the optional flag retains first-topic selection for existing integrations. New `input.teaching.select {entityId}` maps to `teaching.select {entityId}` through the same scoped session command. Reject stale generations, paused/configuration-held sessions, hidden/unpermitted IDs and unreviewed topics. Selecting an eligible topic invalidates pending menu speech and supplies that topic’s reviewed invitation. Canonical refusals remain session-hidden.

After a successful new `input.start`, configured/negotiated speech reads a fixed English/German introduction through the existing bounded speech owner and receipts. It grants no capture. The browser’s explicit Start intent waits for consumed output, then requests its first fresh capture; raw Start/Resume/Unmute do not record. Reconnect and resume do not greet. Approved greeting/topic text is emitted only to the current authenticated output owner. Finish uses existing `input.teaching.finish` or `input.photo.action` with `activity.leave`; photo leave is permitted during pause and preserves that pause. No new HTTP route, firmware change, migration or provider is introduced. See [handoff](handoffs/participant-greetings-exit.md).
