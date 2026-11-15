# Semantic conversation decisions

Branch: `codex/conversation-decisions`, based on `codex/general-chat-handsfree` (`e628faf`). Local implementation only; not deployed. No live decision-provider calls or changes to private configuration have been made.

## Implemented behavior

Optional server-only `ConversationDecisionAdapter` runs once per completed open-conversation turn before reply generation. It receives only current text/language, at most six recent messages, and at most twelve caregiver-configured away-topic labels with opaque per-request IDs and already-offered flags. It receives no profile ID/name, approved-fact collection, contact destinations, full sensitive guidance, database credentials, camera or audio bytes. As with the existing chat provider, transient participant text is external processing; the disclosure and endpoint data policy apply.

The adapter batches separate judgments for recap intent, declining a redirect, each configured subject, and one activity choice. The initial allowlist is `typesafe/jev-1.14` and `openai/gpt-6-luna-decisions`; either uses `POST https://openrouter.ai/api/alpha/decisions`. Typed answers are strictly checked for keys, types, probability bounds and a complete consistent activity distribution. Probabilities are not clinical scores or proven empirical accuracy.

With decisions enabled, open-mode redirect triggering and reminder recognition use model decisions; there is no automatic phrase-detector fallback after timeout, malformed data or provider failure. Failure ends the wait explicitly and requires a new turn. Legacy phrase behavior remains when the feature is disabled. Immediate controls and existing fixed sensitive/urgent/refusal routes retain priority; teaching and Photo Story keep their existing specialized flows. Both typed input and recognized speech reuse this coordinator path.

A confident topic decision adds gentle transition guidance to the conversational model. Only validated current-profile IDs can select rules; already-offered subjects and decline decisions suppress repeat offers. The main model still chooses words/neutral destinations; at most two configured candidates are sent per redirect. A literal output phrase guard and destination conflict filter remain supplementary safeguards, not semantic guarantees.

A semantic recap uses an attributed, bounded quote from transient recent participant speech/text, with English/German framing. Missing, cleared or redirected context receives a fresh-start offer. Recap queries do not replace the substantive thread, preventing repeated reminders from quoting the reminder request. No topic trend, excerpt or summary storage is added. Activity decisions only guide an honest response that controls are currently needed; they do not start games, grant permissions or create new action URLs.

The default provider deadline is 1,500 ms (configurable 100–2,500 ms), inside the existing 20-second conversation deadline. The coordinator independently bounds even injected adapters to 2,500 ms. The same abort/session generation/lease/profile/privacy/policy checks guard classification and generation. Duplicate pending/completed command IDs reuse the existing receipt rather than call either provider again. No classification result, utterance or prompt is written to checkpoints/logs.

## Configuration and evaluation

Server environment (keep the existing key private):

```dotenv
LEMMI_DECISIONS_ENABLED=1
LEMMI_DECISIONS_MODEL=typesafe/jev-1.14
LEMMI_DECISIONS_TIMEOUT_MS=1500
LEMMI_DECISIONS_THRESHOLD=0.85
```

The default is disabled. Unsupported enabled configuration fails gateway startup rather than quietly substituting another model. Both adapters share `OPENROUTER_API_KEY`. Provider requests require `data_collection:'deny'`, `zdr:true`, `allow_fallbacks:false`; no weaker-policy retry is implemented. Endpoint availability under these flags has not been established here. Missing-compatible-endpoint responses remain failures. Do not weaken flags to make the integration appear successful; provider handling/retention still requires inventory and counterpart review before deployment.

Threshold 0.85 is an initial rehearsal value. Redirects also abstain when decline probability exceeds 0.15. Activity selection requires both confidence and selected-option probability at the threshold. Retune separately for each model using representative examples; high confidence is not proof of correctness.

```sh
# Inspect readiness; no provider calls or credentials needed:
bun scripts/evaluate-conversation-decisions.ts

# Explicit fictional-only live comparison, with private OPENROUTER_API_KEY configured:
bun scripts/evaluate-conversation-decisions.ts --live --model=typesafe/jev-1.14
bun scripts/evaluate-conversation-decisions.ts --live --model=openai/gpt-6-luna-decisions
```

The 21-case corpus covers direct/indirect employment subjects, refusal, quoted/negated/third-person reminders, game requests versus past enjoyment, hypothetical requests, and an injection attempt. The evaluator emits aggregate matches, unavailable calls, false positives and p50/p95 latency. It logs no utterances, provider response bodies, credentials or reasoning. It exits nonzero for mismatches/unavailable calls. Unit tests use explicit fixture responses and do not establish either model's real classification accuracy. No vector database or durable conversation memory is required for this slice.

## Backend server testing and rollout checklist

**Owner: Anay / backend operator. This document is a handoff, not a record of deployment.** The feature branch includes the preceding general-chat commit `e628faf` and its additive `005_conversation_redirects.sql`. The decision adapter itself introduces no further migration. Do not cherry-pick only the decision adapter without its general-chat/schema dependency.

### 1. Tests that do not require deployment

On a development checkout of this branch, using pinned Bun 1.4.4:

```sh
bun install --frozen-lockfile
bun run check
bun test tests/conversation-decisions.test.ts tests/conversation-support.test.ts tests/conversation.test.ts tests/speech-pipeline.test.ts tests/teaching.test.ts tests/teaching-support-integration.test.ts tests/multi-endpoint.test.ts tests/speech-gateway.test.ts
bun run build
bun scripts/evaluate-conversation-decisions.ts
```

Expected: all tests/build/checks pass; evaluator reports 21 fictional cases with **no provider calls**. These test bounded parsing, wrong/foreign topic IDs, one-call deduplication, delayed-result cancellation, profile isolation and STT/decision/TTS routing using fixtures. They do not test semantic accuracy. On the Linux backend staging environment, also run `bun run test`, `bun run format:check`, and `bun scripts/smoke-control.ts --chat-fixture`, with OpenSSL available and an independently configured isolated test database. Never point `LEMMI_TEST_DATABASE_URL` at the live database. New migration/persistence tests in `tests/data.test.ts` must run rather than skip before live rollout.

### 2. Direct model comparison — no service restart needed

Run the two `--live` evaluator commands above from this branch on a trusted team machine with the existing key configured privately. They call only the committed fictional corpus and do not need the running web/gateway, participant enrollment or production database. The evaluator explicitly enables its own calls; it works even while the gateway feature switch remains off. Each command makes 21 paid requests at most; it does not print the key, prompts or provider bodies.

Record model ID, threshold, timeout, corpus revision, match/failure/unavailable counts, false-positive counts and p50/p95 latency in the build plan. Proposed initial gate: no unavailable responses, zero unexpected redirects/activity starts/recaps on negative examples, and all 21 cases match their reviewed labels. Investigate mismatches; do not simply lower thresholds to pass. Repeat on additional held-out fictional paraphrases before calling a setting reliable. Target p95 within the 1,500 ms default budget; the configured ceiling is 2,500 ms and the entire conversation turn still has 20 seconds. If a model cannot meet data-policy or latency requirements, keep the runtime disabled and document the failure. These are engineering rehearsal gates, not clinical validation or universal accuracy guarantees.

Both requests retain `provider: {data_collection:'deny', zdr:true, allow_fallbacks:false}`. Verify compatible routing with the actual account; being listed on OpenRouter does not establish it. Do not relax privacy flags, silently substitute another model or expose raw failure bodies. The two providers may need different tuned thresholds.

### 3. Integrate without switching the running deployment checkout

In a separate integration/development checkout, review this feature branch and merge it normally into `backend-deploy`; preserve newer backend/Teach Lemmi work and resolve shared coordinator changes substantively. Run the checks on the **merged** result and push the integration branch normally. Do not force-push. This handoff does not authorize replacing or discarding unpushed Teach Lemmi changes.

The actual server checkout `/home/anayn/project/Lemmi` must remain on `backend-deploy`, as required by AGENTS.md. Coordinate with active teammates first. In that checkout:

```sh
cd /home/anayn/project/Lemmi
git branch --show-current
git status --short
git rev-parse HEAD
```

Proceed only with a clean checkout on `backend-deploy`. Preserve any local/unpushed work with its owner before proceeding; do not auto-stash/reset or switch branches there. Privately record the old revision, and back up database, existing source/build and mode-0600 environment using the host's established release procedure. Preserve provider/auth/device keys and private media. Then:

```sh
git fetch origin
git pull --ff-only origin backend-deploy
.data/bin/bun-linux-x64/bun install --frozen-lockfile
.data/bin/bun-linux-x64/bun run check
# Run the Linux suite with a separate test database as described in gate 1.
.data/bin/bun-linux-x64/bun run test
.data/bin/bun-linux-x64/bun run build
```

Stop on any failure. In a coordinated maintenance window, stop the gateway/web before changing the live schema. Keep all decision settings disabled (`LEMMI_DECISIONS_ENABLED=0`) for the initial baseline deployment. Migration 005 must be applied even for that baseline because the new profile PATCH persists its column:

```sh
systemctl --user stop lemmi-gateway lemmi-web
.data/bin/bun-linux-x64/bun run db:migrate
systemctl --user restart lemmi-gateway lemmi-web
systemctl --user is-active lemmi-gateway lemmi-web lemmi-speech
```

Do not run `db:bootstrap`, reseed Alex, edit applied migrations, or replace `.env` from `.env.example`. No Nginx/tunnel change, new public endpoint, speech-model install or dependency/lockfile update is required. Gateway restart ends active sessions; reconnect requires explicit Start and must not resume microphone/output automatically. Verify the existing access gate, participant enrollment, ordinary chat, Teach Lemmi, Photo Story and Stop before enabling decisions.

### 4. Enable only for the agreed fictional rehearsal

The switch is **gateway-wide for open conversation**, not per-profile. Schedule a team-only rehearsal window or use a separate staging deployment; turning it on affects all open-chat profiles on that gateway. Configure the chosen model/threshold/deadline privately in the gateway's existing environment, using the settings above; leave the conversation model, key, speech and auth configuration unchanged. Keep `.env` protected. Restart only `lemmi-gateway` for a decision setting change, then check service health. Code/base UI changes were already installed in gate 3.

Create/select an explicitly fictional test profile using existing authorized setup. Save test redirects through the authenticated caregiver profile PATCH (not the shared access cookie alone), with a fresh profile revision and command ID:

```json
{
  "profileId": "ACTUAL_FICTIONAL_PROFILE_ID",
  "expectedRevision": 0,
  "commandId": "NEW_COMMAND_ID",
  "patch": {
    "conversationRedirects": {
      "awayFrom": ["previous employment"],
      "toward": ["flowers", "seaside"]
    }
  }
}
```

Replace every placeholder and revision from the current authorized profile. Never paste a bearer token into source/screenshots/chat. Saving pauses an existing session and requires explicit continuation. The live caregiver editor remains unavailable; use the existing private profile API/setup procedure. No shared domain key grants caregiver write authority.

### 5. End-to-end acceptance matrix

Use `/access` → `/participant/conversation`, the fictional profile and explicit Start. Test typed input first, then browser microphone and real audible output. Record actual observations for each:

| Case | Expected result |
| --- | --- |
| Ordinary subject: knitting, then astronomy | Follows subject changes without forcing a redirect or teaching mode. |
| Indirect work reference: “I need to get to the office before my old shift” | One gentle optional transition, no invented work schedule or personal facts. |
| Decline: “No thanks, I want to stay with this” | Respects continued interest without repeatedly steering away. |
| Empty/all-conflicting `toward` list | Neutral optional transition; no assertion that the person likes it. |
| “Help me pick up that thread again” after knitting | Attributed reminder of actual recent words, not invented history; repeated requests still refer to the substantive thread. |
| Reminder after a redirect, Stop/new session, or disconnect | Does not replay redirected or cleared context; offers a fresh start. |
| “Play some music” versus “I enjoyed music yesterday” / “Don't play music” | Recognizes explicit request versus mention/refusal. No activity auto-start; truthful control guidance only. |
| Pause/Stop/mute/help while a decision or reply is pending | No late reply/capture restart; help status stays truthful. Test using fixture delay for deterministic races as well as a live rehearsal. |
| Save redirect rules while a decision is pending | Old result is discarded; changed profile stays paused until explicit continuation. |
| Second fictional profile / observing endpoint | No borrowed history/rules and no output routed to another profile/endpoint. |
| Quiet preset | No unsolicited questions or automatic listening after output. |
| Invalid model/blocked provider/unavailable network | Explicit failure and retry path; no fake success, phrase fallback or automatic retry. Rehearse via staging/fixtures, not by disrupting others' shared network. |
| Teach Lemmi and Photo Story | Existing specialized topic/context, controls and playback still work. |

Inspect only aggregate/non-content diagnostics: no raw audio, utterances, prompt bodies or classification payloads in logs/database checkpoints. Verify no browser/firmware key exposure. Mark actual microphone/speaker or K151 checks unrun if hardware isn't used. A synthetic fixture does not pass a human/audio check.

### 6. Rollback and release record

For detection errors, slow responses or unavailable privacy-compatible routing: privately set `LEMMI_DECISIONS_ENABLED=0`, restart `lemmi-gateway`, and repeat ordinary chat, Stop, teaching/photo regression checks. This restores the base branch's phrase-based redirect/reminder behavior. All active sessions end on restart; do not claim automatic continuation.

For broader regressions, restore the retained source/build and prior protected environment through the established release process while keeping the checkout on `backend-deploy`. Migration 005 is additive: leave its column and migration receipt in place when rolling code back; do not drop data, edit checksums or restore the database merely to disable this feature. Use a reviewed database restore only if separately necessary. Keep the prior and new revision IDs, backed-up release path (private), applied migration name, model/threshold/deadline, exact checks, failures and rollback observations in `backend-status.md` and the build plan. Do not label this deployed until that record exists.

## References and next handoff

Observed local checks: `bun run check` passed with zero Svelte/type errors or warnings; 95 tests across conversation/decisions/support/speech/teaching/multi-endpoint/gateway suites passed (2,578 expectations); `bun run build` and `git diff --check` passed. Dry evaluation reported 21 fictional cases without calls. The full suite/database/hardware/live-provider checks were not rerun for this slice; earlier Windows OpenSSL/POSIX and unconfigured test-database limits remain documented separately. No live semantic accuracy result is implied.

- [OpenRouter Decisions request schema](https://openrouter.ai/docs/api/api-reference/alphadecisions/submit-a-decisions-request) (alpha API; request/response shape may change).
- [Jev tutorial](https://openrouter.ai/docs/guides/community/jev-tutorial).
- [OpenAI model through OpenRouter](https://openrouter.ai/openai/gpt-6-luna-decisions).

Anay reviews provider configuration, internal contracts and cancellation before live enablement. Run fictional live evaluation to choose/calibrate a model and verify privacy-compatible routing, then rehearse microphone permission, latency, actual playback, Stop and network failures. Kylie reviews participant recovery wording. Activity execution requires a subsequent typed coordinator integration with Lukas/Emilia; classification alone must never be presented as a completed game launch.
