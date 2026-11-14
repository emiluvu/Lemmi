# Lemmi — Integration contracts and handoffs

**Status:** Draft implementation contract, pending kickoff confirmation  
**Version:** 0.1  
**Owners:** Anay (server/contracts), Emilia (device contract), Lukas (activity contract), Kylie (views/assets)

This is the small shared implementation reference for all four Codex workstreams. Read it with the [technical specification](technical-spec.md) and [build plan](build-and-demo-plan.md). The interfaces below are proposed, not existing exports. At kickoff, Anay scaffolds them with runtime validation and mocks, then the team freezes version 1. Change the contract and consumers together; do not invent a second protocol or backend when an interface is missing.

## 1. One system, four ownership areas

| Owner | Proposed files/modules | Consumes | Produces |
| --- | --- | --- | --- |
| Anay | `apps/web/src/routes/v1/`, `apps/web/src/lib/server/`, `apps/realtime/`, `apps/worker/`, `packages/server/`, `db/`, root tooling | Emilia's device events; Lukas's pure activity module | HTTP/WSS, session coordination, local STT/TTS, external LLM, auth/data/contact/journal services, typed mocks |
| Emilia | `firmware/stackchan/`, device test fixtures, robot asset conversion | Versioned device protocol; Kylie's mascot exports | Robot audio transport, capture indicator, local mute/unmute/stop, reconnect/watchdog behavior, compatible mascot rendering |
| Kylie | `apps/web/src/lib/features/`, page/layout components outside `/v1`, shared UI/assets | ActivityView and journal/profile/help clients | Participant and caregiver UI, art/tokens, browser audio client, accessible controls and all loading/error states |
| Lukas | `packages/activities/`, reviewed activity content, demo materials in the build plan | Shared activity schemas; approved asset metadata | Music/guessing/photo logic, tests, public view projection, factual event outputs, supervised live-demo plan |

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
  // Add validated discriminated per-activity fields at kickoff.
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

Effect types are an allowlist, initially `speak_approved_text`, `play_approved_track`, `stop_media`, `offer_photo_conversation`, and `request_listening`. Effects are proposals, not permission: Anay checks current session generation, privacy revision, asset access, and endpoint lease before execution. An LLM cannot invent effect types, asset URLs, contact destinations, or motor commands.

`photo.talk` requests Anay's existing conversation path with the approved current photo context. Guessing uses a small reviewed question tree/candidate set first; free-form LLM game generation is deferred. No private biography is needed for guessing. Only approved playlist IDs/files can be played; the model cannot choose an arbitrary external stream.

### Reducer and view contracts to scaffold first

Implement runtime-validated discriminated activity states and views rather than an arbitrary JSON blob. Minimum state fields: music = playlist/current track/playback phase; guessing = reviewed pack/current question/candidate IDs/asked count/round phase; photo = album/current photo/just-look-or-talk phase. Asset/pack references must be validated before state is created. Keep private state separate from participant-safe projection and from any LLM context.

Proposed pure interfaces:

```ts
createActivity(input: StartActivityInput, content: ApprovedPack): ActivityState;
reduceActivity(state: ActivityState, action: ActivityAction,
               content: ApprovedPack): ActivityTransition;
projectActivity(state: ActivityState, content: ApprovedPack): ActivityView;
```

`ActivityTransition` returns `nextState`, `events`, and `effects`, each validated against shared schemas. Instance/session/revision/command IDs come from the coordinator; reducers cannot mint authorization or declare playback succeeded. `ApprovedPack` is a discriminated pack: music tracks, album entries with caption/context, a bounded guessing tree/candidate set, or matching samples/choices with canonical entity tags. Resolve media bytes through the server asset adapter, not inside the reducer. Do not import server-only pack metadata into a participant bundle if it contains private captions/guidance.

Serialize per-instance actions. A first valid command increments revision once; a retry with the same ID returns its prior result, not a second transition. An old revision returns `REVISION_CONFLICT` with the current safe snapshot. Each effect has a stable ID associated with that committed transition, and the executor deduplicates it before playing audio. After pause/stop/handoff, invalidate the generation/lease before processing more effects. A client animation or network retry cannot count as an additional question, advance two photos, or play the same track twice.

Shared fixture set: music ready/playing/paused/failed; guessing yes/no/not-sure/skip/reveal/round end; album next/previous/just-look/talk/missing caption/image; duplicate action, stale revision, session stop during pending effect. Lukas owns pure transition checks; Anay owns orchestration/retry/privacy checks; Kylie and Emilia exercise the same fixtures in their clients.

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

The robot's WebSocket connects to Anay's realtime gateway, not to a second app-owned backend. The SvelteKit app subscribes to the same session and can use the browser endpoint as fallback. Firmware never knows LLM keys, caregiver destinations, database credentials, or private guidance.

Begin with the technical specification's protocol v1 and negotiate actual firmware-supported audio capabilities. Share a sample `device.hello`, control event, audio chunk, and server state response before writing both ends. Agree frame format, sample rate, channel count, endianness, queue limits, heartbeat, and TLS/pairing. The initial PCM proposal must be benchmarked; changes require both Emilia and Anay to update fixtures.

Local mute immediately stops capture/transmission. Unmute clears the mute setting but does not itself start recording; capture additionally requires an explicit/current valid listening state. Local stop clears capture/playback queues. Network acknowledgments never override a local stopped/muted condition. Show actual capture state on the robot. Disconnect/reboot begins muted or capture-off, with explicit restart; no audio backlog uploads.

One endpoint owns output at a time, whether it is speech or music. Pause/stop/help/mute and handoff rules must be tested against pending music and speech jobs. During music playback, microphone capture is off. To talk, explicitly stop/pause music first. No simultaneous microphone capture, music, and TTS in the first build. Muting the microphone alone does not mute music; label controls separately. Session pause/stop/help silence music as well as speech. Preserve the track/position where supported and resume only explicitly.

If robot music playback is not feasible, use an explicit companion-screen audio handoff and indicate the active speaker. Do not play the same track on both. Browser autoplay restrictions must be handled by user-initiated playback and a visible recovery state.

## 6. Asset handoff: Kylie → Emilia/Lukas/Anay

The project/companion name is Lemmi. The exact avatar set is `dog`, `cat`, `bunny`, `bird`, `lemming` (labels Dog, Cat, Bunny, Bird, Lemming). Define `AvatarId` as this enum in shared contracts. Store `avatarId` with profile revision and expose it in participant-safe profile/device state; `expressionId` is a separate interaction-state enum. Do not use the animal name as an expression or activity ID. Validate both fields at the boundary. Avatar changes follow the same approved profile-update path and invalidate outdated render instructions; preserve the choice on app/device handoff.

All five use the same session rules, activity logic, controls and voice configuration. The minimum final asset target is five avatars × six static states = 30 frames, plus app chooser previews. First prove one complete avatar/state set with Emilia, then extend the approved format to the remaining four. Static/reduced-motion mode does not require a sixth neutral avatar. Missing device support is explicit; do not silently render another animal. Stop/microphone indicators remain independent of face art. See [Kylie’s guide](kylie-design-guide.md) for inspiration and exports.

Kylie owns source art, UI tokens, mascot expression IDs, and app layouts. Emilia owns conversion/rendering and reports actual display/firmware constraints first. Agree a small expression set: `idle`, `listening`, `processing`, `speaking`, `paused`, `unavailable`; actual microphone state also has a textual/icon indicator independent of the face. Export static frames first, simple animation only after audio/control works.

Create an asset manifest with ID/version, purpose, dimensions, encoding, file size, creator/source, permission/license note, and alt/caption text. Robot exports must fit its tested memory budget and 320 × 240 display; do not assume app graphics can be copied directly. Lukas references approved asset IDs; Anay resolves them through scoped storage. Commit only approved generic demo media, never private family photos or contact details. Licensed static music assets are distinct from forbidden recorded microphone/generated-speech files.

## 7. Contract freeze, integration, and done

Before feature parallel work, Anay creates validated shared types, a minimal running app/gateway, clients/mocks, and a contract fixture. Emilia and Lukas verify their seams; Kylie runs one screen against each mock. Missing scaffolding is a foundation task owned by Anay, not a reason for three independent projects.

First integration proves: app starts session → robot receives state → microphone turn reaches local speech/backend → response plays → music starts/stops through shared lease → activity event appears in journal → help bypasses the LLM. Then add photo and guessing through the same interfaces, not new paths.

Record checks and exact tested versions in the build plan. Every owner hands off changed files/contracts, run commands that actually exist, mock/live status, checks performed, and blockers. Anay reviews server/data changes; Emilia reviews device changes; Lukas reviews activity transitions; Kylie reviews UI/assets. Cross-boundary changes receive the counterpart's review, without blocking isolated feature work.

Open selections: exact firmware/engine/voice, accessible device controls, approved media, host/network, notification channel/auth library, and actual event timetable. The docs set interfaces and priorities; they do not establish untested performance or infrastructure.

## 8. Conversation support contract extension

Use the caregiver-configured `CommunicationSupport` enum/schema and session-snapshot/application rules in [communication-support-spec.md](communication-support-spec.md). Anay owns schema/authorization/config resolution; Kylie owns the single selector/preview component in caregiver profile; Lukas consumes a bounded presentation policy; Emilia follows effective session speech/control settings. Add three same-topic preview fixtures, conflict/unauthorized/save-failure cases and apply-now stale-output checks before connecting all clients. No second local slider store, diagnosis field or automatic staging is introduced.

## 9. Camera-first device extension — Anay ↔ Emilia ↔ Kylie ↔ Lukas

Adopt the shared schemas/state machine, `/v1` check-in routes and event names in [robot-capabilities-spec.md](robot-capabilities-spec.md) before freezing protocol v1. **F13 precedes F14**. Anay supplies `CheckInClient` (request, status/subscribe, end), mock/real implementations, authorization, relay and coordinated session pause. Emilia supplies hello capabilities, local consent nonce/Allow/decline, capture/stop/deadline enforcement and real frames. Kylie renders the same snapshots in caregiver viewer and participant panels. Camera state is independent of audio mute and ActivityView; no duplicate frontend authority.

Add fixtures for default disabled, unauthorized, awaiting Allow, declined, start timeout, active/fresh, stale, expiry, local Stop/help, revoked access, duplicate viewer, server/device reconnect and late start/frame. No mock fixture contains real photos. Media remains a separate bounded authenticated channel on the existing gateway; only access metadata is durable.

Lukas supplies externally imposed pause/resume transitions for all activities; Anay invalidates pending effects and freezes progression during the check-in. Ending video does not auto-resume. Kylie renders paused state without advancing a question/track/photo. After F13 gates, Emilia adds local `pet_ack` rendering and validated `device.health` telemetry; Kylie supplies overlays and health views, Anay validates fields, Lukas confirms no pet changes activity state. Keep shared generation/revision conventions and update consumers/fixtures together.

## 10. Preference memory and matching extension (F15/F16)

[Personalization-and-matching-spec.md](personalization-and-matching-spec.md) defines canonical topic/object IDs, ProfilePreference/ItemPolicy/EligibilitySnapshot, memory permission, signal validation, scoped operations and retention. Add `policyRevision` to session/output/effect validity checks and a server-issued matching presentation ID/revision; no client/model can select another profile's policy or invent evidence. Keep current session generation and all existing privacy checks.

Anay supplies one Preferences client, runtime schemas and mocks before consumers; Lukas receives eligible reviewed content and returns pure matching transitions plus allowlisted signal proposals; Kylie renders matching and Interests & boundaries; Emilia cancels obsolete narration/views after a policy/profile revision. Only the server commits retirement/preferences. Positive pattern markers and uncertainty markers are bounded and idempotent, never append-only performance histories. Canonical retirement filters all activity/proactive topic selection, not just matching.

Freeze fixtures for two separate profiles, preferred versus avoid precedence, explicit refusal, first/later uncertainty, duplicate signal, retired alias/distractor, all-ineligible content, remembered/session-only modes, failed save, stale eligibility, explicit undo, forget/revocation/deletion while output is pending, and camera pause/resume. No raw utterances in durable fixtures/events. Journal summary sources remain unchanged; memory is a separately permitted category.

## 11. Confirmed whiteboard extension: teaching, scene packs and overview

F17 Teach Lemmi is a conversation mode, not a new ActivityId/reducer. Keep the four activity IDs; add `ConversationMode = 'open' | 'teach_lemmi'` and an authorized current-session `TeachingSnapshot` with topic/entity ID, optional approved asset ID, presentation ID/revision, policy revision and ready/listening/processing/paused/unavailable phase. Runtime-validated `teaching.start`, `teaching.next`, `teaching.not_sure`, `teaching.finish` commands use the existing session-command transport and idempotency/revision checks. Starting/next selects a permitted catalog topic; clients cannot smuggle arbitrary content. Finish returns to ready with capture off, not automatic open conversation. Mode changes invalidate pending speech/capture and require normal explicit continuation.

Anay owns selection/session authority/conversation execution; Lukas supplies reviewed teaching prompts/topic assets with canonical tags, no independent model service. Kylie owns a Teach Lemmi tile and the mode-specific panel in `/participant/conversation`; Emilia consumes the shared snapshot and emits supported actions. Reuse F15/F16 refusal/uncertainty policy and ensure camera pause/stop/help override teaching. Add fixtures for empty/sparse profile, explanation, change topic, Not sure, all-retired, stale response, failed model/policy save and explicit finish. Do not expose correctness flags or silently approve biography.

Explore pictures is a photo pack variant (`collectionKind: 'album' | 'place_scenes'`) with existing approved captions/context/tags and navigation; it is not another game ID or a camera/map service. Content approval and shared eligibility remain mandatory.

Anay supplies protected `GET /v1/profiles/:id/overview` through the shared caregiver client: profile projection, readiness, recent activity references, open request references and permitted journal-highlight references. Kylie renders source-linked cards and explicit partial/error/no-summary states. Optional per-activity duration aggregates use known active intervals only, excluding known pauses/camera/disconnects; return unknown/gaps honestly. Do not sum overlapping intervals twice, infer engagement or create a parallel transcript/analytics store. Apply deletion/privacy changes and caregiver resource authorization to all aggregates/highlights. Charts remain optional after the core cards.
