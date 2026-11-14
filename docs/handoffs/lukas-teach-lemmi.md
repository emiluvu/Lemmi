# Teach Lemmi integration handoff

Branch: `codex/teach-lemmi`. November 14, 2026. User explicitly authorized backend handlers on this branch; Anay owns merge, integration and redeployment. The shared deployed revision remains `04d050e`.

## Implemented behavior

Teach Lemmi runs through `SessionCoordinator`'s existing conversation mode and speech adapters, without adding an ActivityId/reducer, server or database. `packages/activities/src/teaching.ts` exports reviewed Gardening, Beaches and general Banking invitations, deterministic eligibility/rotation helpers, current-topic context instructions and a bounded English catalog-output guard. Approved caregiver interests supply a narrow baseline only with remembering off and policy revision zero. No family facts or full profile/history are sent as teaching context. Model dialogue stays bounded and transient, and topic changes clear it.

The coordinator implements Start, Next, Not sure, Like, Avoid and Finish. Next exhausts the catalog rather than looping. Explicit refusal clears current topic output; Not sure/Avoid hide that topic for this session, including teaching restarts. Like changes session-only ordering; it cannot enable remembering. Sparse/unavailable/all-excluded context has no unrestricted fallback. The timer uses a monotonic duration clock, retains elapsed active time across topic changes, excludes pauses/unavailable waiting and finishes at fifteen active minutes. All existing stop/mute/lease/revision and stale-result gates remain in force. Finish returns to capture-off ready; a clear Stop request ends the whole session.

Live follow-ups call the existing `ChatAdapter`/OpenRouter integration. Openings are reviewed text. Negotiated device Start/Next/Not sure/Avoid also synthesize the current opening through `SpeechTurns.speakApproved`, with the normal bounded PCM queue and consumed receipts. No capture starts on prompt completion. Muting a microphone preserves unrelated approved prompt output; Pause/Stop/policy change/deadline cancel it. Physical playback remains unverified.

## Shared interface changes

- `TeachingSnapshotSchema` now requires nullable `topicLabel` and `prompt`, alongside existing entity/presentation/revision/policy/phase fields. There are still four ActivityIds. Images remain null; no media rights are assumed.
- `SessionActionSchema` adds `teaching.prefer` and `teaching.avoid` to existing teaching commands.
- `DeviceEventSchema` adds empty-payload `input.teaching.start`, `.next`, `.not_sure`, `.finish`, `.prefer`, `.avoid`. Same scoped session/generation/sequence validation and command deduplication apply. `device.ready` adds optional `teaching:boolean` (true here); no new connection or device credential.
- `ConversationReplySchema.source` adds `scripted`. Local mock teaching uses reviewed scripted replies; live replies remain `model` or `fixed`.
- `clients.conversation.submit(ConversationTextCommand)` adds `conversation.submit` only on the existing local mock RPC path. The gateway awaits `submitText` outside the generic command cache, so participant text is never cached there. `/v1/live/conversation.submit` remains unavailable. Live conversation still uses authenticated `input.text`/audio on the existing WebSocket.
- `SessionCoordinator.applyTeachingEligibility(snapshot)` is an internal orchestration hook, not a client API. It validates profile/session and current-initial or advancing policy revision, cancels current work, pauses and clears excluded prompts. Anay must supply authoritative policy snapshots when learned policy is enabled or policy revision is nonzero; without one, personalized teaching fails closed. Same-revision replacements are rejected after an initial policy has been supplied.
- `sweepTeaching()` is called by both gateway watchdogs and before relevant command/result/output boundaries. Time is injected in tests; clients cannot alter the limit.

No auth routes, credential scopes, database migrations, provider selection or deployment configuration changed. Existing loopback-only mock isolation remains in place. Backend reference and deployment status distinguish source implementation from the unchanged deployment.

## Remaining integration

Anay: review timing/cancellation and the new shared fields/events; merge deliberately with backend work; supply authoritative persisted policy and durable, consent-aware signal/observation handling when those services exist. This branch performs no durable teaching memory, retirement, excerpt, observation or summary writes, and it does not count silence/answer length as negative feedback. The catalog guard covers listed English topic aliases, not unrestricted semantic safety; extending topics/languages needs review and safeguards. Rehearse actual model output before deployment acceptance.

Kylie: review the minimal participant-shell text demo and adapt its teaching panel to the final conversation surface. It uses the shared typed clients and session snapshots, never a competing activity state. Browser STT/TTS remains outside this text demo.

Emilia: consume `teaching:true` and new snapshot fields, emit the new commands, enforce local Stop/mute/watchdog and verify real capture/output indicators. Voice Next/Not sure/Like currently invalidate the old voice turn and publish the new snapshot; replacement-topic narration is not automatically synthesized on that canceled voice turn. Use an explicit topic button command for narrated selection. English teaching only in this increment; no German-content acceptance claimed.

Camera remains unavailable in this checkout. The common external pause path freezes teaching and cancels pending output; connect and verify actual F13 camera orchestration before claiming camera acceptance. Ending a check-in must not resume teaching automatically.

## Verification and launch

Changed-code formatting and diff whitespace checks passed. Repository-wide `format:check` reports 83 unchanged files with existing formatting differences; no unrelated formatting rewrite was made.

See [the tester manual](../teach-lemmi-tester-manual.md) for launch, component status, step-by-step checks and issue recording. Local browser flow and synthetic device/speech checks passed. Type/Svelte and build passed. Full suite: 132 pass, 18 skipped without an isolated test database, one pre-existing Windows POSIX-permission assertion failure. Real OpenRouter/local inference, firmware, physical audio, deployed behavior and counterpart review are pending. Do not mark full F17/P0 acceptance complete from these results.
