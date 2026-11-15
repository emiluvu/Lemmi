# Conversation/activity routing repair — November 14, 2026

Local candidate `fix/conversation-activity-routing`, based on current main/backend-deploy `0f299c4`, in `/tmp/lemmi-conversation-routing`. Not deployed; shared checkout and protected runtime configuration unchanged.

## Findings

The original handoff recorded aggregate evaluation counts only, so its exact three historical mismatches and unavailable-call cause cannot be reconstructed. An instrumented rerun of the unchanged classifier produced 18/21 matches, three mismatches, no unavailable requests (p50/p95 176/191 ms):

- `redirect-direct`: topic probability 0.99 was vetoed by decline probability 0.18 exceeding the 0.15 suppression ceiling, despite no prior redirect offer.
- `recap-indirect`: both recap and decline were true despite no redirect offer.
- `teaching-request`: teaching was the winning choice but confidence/probability 0.57/0.64 abstained under 0.85.

Separately, activity classification was explicitly advisory: it only changed the chat prompt and never executed a mode switch. The reviewed command parser accepted bare “Teach Lemmi” and “Start Teach Lemmi” but missed “I want to teach Lemmi” and “Can we teach Lemmi?”. Enabling the old adapter alone would not repair that execution gap. Some other games remain unavailable independently of recognition.

## Changed behavior

- Complete reviewed requests now include natural teach/look-at-picture invitations. Matching stays anchored; negative, quoted and conditional mentions do not extract commands. These work with decisions disabled.
- Clarified teaching offers and refusal criteria; a decline cannot veto a topic unless the application has offered a redirect. No thresholds were lowered.
- Optional `LEMMI_DECISIONS_SCOPE=activities` asks only the activity question, omits caregiver topic labels, and preserves existing phrase-based recap/redirect behavior. Omitted scope retains the previous full `conversation` scope; the feature still defaults disabled.
- A confident semantic teaching/photo request produces an application-owned “Would you like to start …?” reply. Immediate explicit agreement uses the existing coordinator transition and fresh speech authority. It does not pass arbitrary model commands/URLs through or duplicate game rules. Teaching still selects a reviewed eligible topic, not an arbitrary requested topic.
- Only the immediate next turn can accept the offer. Other turns, Pause/Stop/mute/disconnect/profile changes, failed question playback and canceled/late decisions clear it. The offer is transient and absent from checkpoints. No automatic capture grant is added. Quiet still waits after output.
- Unavailable activities receive a fixed truthful response; this does not implement music/guessing/matching execution. Semantic activity confirmations currently support English open conversation; teaching/photo specialized flows retain their current handling and exact reviewed mode switches.
- Evaluator diagnostics contain fixed case IDs, validated enums/booleans/probabilities and failure categories/HTTP status only. No utterances, provider bodies, keys, contact details or reasoning are printed. Successful-request percentiles exclude unavailable calls. Default dry run makes no requests.

## Actual provider checks

All calls used committed fictional text only, Jev 1.14, threshold 0.85, deadline 1,500 ms and unchanged `data_collection:deny`, `zdr:true`, `allow_fallbacks:false`. No provider/model fallback, private configuration change or gateway restart.

| Configuration | Cases | Matched / mismatched / unavailable | p50 / p95 |
| --- | --- | --- | --- |
| First prompt/context repair, full conversation | Original 21 | 21 / 0 / 0 | 192 / 251 ms |
| First repair, fresh expanded corpus | 30 | 29 / 1 / 0 | 175 / 278 ms |
| Final full conversation configuration | Original + expanded 51 | 49 / 2 / 0 | 158 / 230 ms |
| Final activity-only, fresh verification corpus | 20 | 20 / 0 / 0 | 156 / 270 ms |
| Final activity-only, complete corpus | 71 | 71 / 0 / 0 | 169 / 248 ms |

The final full-conversation misses were an indirect recap (0.84) and explicit redirect refusal (0.82); the full-conversation gate still fails. Expanded examples informed prompt changes, so only the final 20 were unseen verification at evaluation time. Zero unexpected activity classifications in the complete activity-only run; this is bounded engineering evidence, not universal language accuracy. Activity-only does not evaluate semantic recap/redirect quality: those fields are deliberately inert. Luna and the historical unavailability cause were not re-investigated.

## Review and enablement handoff

Local software verification: pinned Bun 1.4.4 frozen installation, type/Svelte checks (zero errors/warnings), production build, **358 tests passed / zero failures or skips / 5,515 expectations** across 48 files against five fresh isolated PostgreSQL 14.24 databases. The cluster was stopped after testing. Test log: `/tmp/lemmi-routing-check-s3egvfp9/tests.log`. Formatting and whitespace checks cover changed code. These checks do not establish microphone/speaker recognition or physical control behavior.

After backend/cancellation review and staging browser microphone/speaker rehearsal, use existing protected gateway environment settings:

```dotenv
LEMMI_DECISIONS_ENABLED=1
LEMMI_DECISIONS_SCOPE=activities
LEMMI_DECISIONS_MODEL=typesafe/jev-1.14
LEMMI_DECISIONS_THRESHOLD=0.85
LEMMI_DECISIONS_TIMEOUT_MS=1500
```

Deploy the reviewed source through the existing backend release procedure; changing environment alone on old code cannot work. No migration, dependency, HTTP/device wire schema, UI or speech-engine change is needed. Gateway restart ends active sessions; require a fresh explicit Start. Keep full `conversation` scope disabled pending further calibration/evaluation. Rollback: `LEMMI_DECISIONS_ENABLED=0` and restart the gateway; expanded reviewed phrases remain available. Do not replace private .env with the example.

```sh
bun scripts/evaluate-conversation-decisions.ts --scope=activities --suite=all
# Explicit fictional-only paid evaluation, with the existing key kept private:
bun scripts/evaluate-conversation-decisions.ts --live --model=typesafe/jev-1.14 --scope=activities --suite=all
```

Anay reviews provider handling, scope and session authority; Lukas reviews eligible topic/photo transitions; Emilia checks physical local controls and playback; Kylie reviews confirmation/recovery wording. Human microphone/speaker usability, physical K151, production enablement and counterpart acceptance remain unrun. Existing automated STT/TTS fixtures prove protocol behavior, not speech-recognition quality in a room.

[OpenRouter's decision tutorial](https://openrouter.ai/docs/guides/community/jev-tutorial) distinguishes choice confidence from probability and recommends task-specific calibration; the adapter retains both existing gates rather than treating confidence as an accuracy guarantee.


## Backend integration review — November 14, 2026

Merged source `c1b619f` in `/tmp/lemmi-jev-routing-repair` against deployed response/profile-entry baseline `b646e81`, preserving the feature branch. Resolved overlapping reviewed invitations/tests without dropping Lemmy/Lemme/Lemi aliases, polite `try` and trailing `game`, one-second browser silence, eight-second chat deadline or caregiver preselection. Three user-requested parallel reviewers covered routing, cancellation/privacy and provider/evaluation. They found a Quiet fixed-question policy violation; fixed using a declarative explicit-agreement cue and tested both teaching/photo speech. Verified external text and ASR remain bounded to 1,000 characters, so no input contract expansion was needed.

Actual activity-only Jev evaluator on this host passed **71/71**, zero mismatches/unavailable/false positives, **151 ms p50 / 204 ms p95**, threshold 0.85 and strict provider flags unchanged. Full conversation scope was not re-enabled; its source gate failures above remain. Final **370 tests / 5,858 expectations**, no failures/skips on five isolated PostgreSQL databases; pinned frozen Bun, type/Svelte zero errors/warnings, build, formatting/whitespace and production HTTP/verified TLS/WSS participant scope/restart smoke passed. Added regressions for Quiet explicit consent/consumed receipts/capture-off behavior, maximum accepted input/history/recovery, canceled late decisions (Stop/Mute/handoff/revoke/revisions), consent isolation and failed-playback clearing.

Isolated production Chromium using actual local STT/TTS and actual Jev recognized fixed in-memory “Can I teach you about gardening?”, asked confirmation, recognized “Yes please”, entered teaching UI with No eligible topics for its new empty fictional profile, and requested a new capture. Exactly one Jev classification, zero chat generations, 260 output frames, no observed capture/output-start overlap and zero runtime errors. Mute/Pause/Resume/typing/Stop passed. This proves the scoped protocol/UI path with synthetic input, not human room timing or physical audio. Actual rollout revision/public acceptance is recorded in backend status/API; no new migration/provider key or engine change.
