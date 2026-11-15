# Participant greetings, teaching choices and activity exit

Review candidate, November 14, 2026. Not deployed.

## Workspace and scope

Fetched `origin/main` and created `codex/participant-greetings-exit` from `f3e3b41` in `/tmp/lemmi-participant-polish`. The original `/home/chaos/projects/Lemmi` checkout contains unrelated uncommitted backend work and was not switched, stashed or edited for this task. This handoff accompanies the review branch [`codex/participant-greetings-exit`](https://github.com/emiluvu/Lemmi/tree/codex/participant-greetings-exit). No merge or deployment was performed.

## Resulting behavior

- A successful new voice session plays “Hi, I’m Lemmi. We can take our time.” through the existing speech owner. Server-resolved German uses the reviewed German introduction. Browser Start intent waits for consumed greeting output before requesting its first fresh capture. Pause, resume, reconnect and duplicate Start do not add another introduction.
- Starting Teach Lemmi greets and names the activity, then offers up to three eligible reviewed topics aloud and as buttons. The current catalog contains Gardening, Beaches and Banking; only permitted, non-hidden topics are offered. A topic name or reviewed explicit selection phrase uses the coordinator’s typed selection action. Quiet gets the same choices with a declarative invitation. An empty catalog offers finishing, without inventing a topic or accruing active teaching time.
- Photo Story’s spoken activity opening greets and names Photo Story. Unsupported activities remain unavailable.
- A persistent, large **Finish activity** button ends teaching or Photo Story through existing commands, cancels local capture/output immediately and leaves capture off. Paused Photo Story can finish without releasing the pause. The caregiver dashboard retains its separate passcode gate.
- Captions stay in one mounted location during and after speech. Mobile avatar size and heading visibility no longer depend on momentary playback state. The talking face stays stable through gaps while the server still owns speech output. Short screens scroll without squeezing controls together; Finish stays visible.

## Affected interfaces and compatibility

`TeachingSnapshot` gains optional `choices` (at most three `{entityId,label}` entries) and `choosingTopic`. `input.teaching.select {entityId}` maps to `teaching.select {entityId}`. Public WSS and spoken teaching starts request `teaching.start {offerChoices:true}`. Direct legacy session commands without the flag retain their earlier first-topic behavior. No HTTP route, database migration, firmware edit or dependency change.

Selections use current session generation, endpoint/profile ownership and eligibility. Refused/hidden and unreviewed IDs are rejected; configuration changes and pauses block selection. An explicit refusal of an offered topic hides it without speaking its invitation. Mode changes and Finish invalidate pending speech. Delayed canceled prompt work cannot publish text/audio; canceled prompt errors do not interrupt a newer turn. No new recording, transcript storage or preference persistence is introduced.

Deploy matching web and gateway code together: an older gateway will reject the new selection command. Robot clients still use the existing speech protocol and receipts, but must rehearse the new opening-output timing before acceptance.

## Observed verification

Pinned Bun 1.4.4; `bun install --frozen-lockfile` succeeded without lockfile changes.

- `bun run check`: 0 Svelte errors, 0 warnings; workspace TypeScript passed.
- `bun run test`: **382 passed, 42 skipped, 0 failed**, 6,037 expectations across 56 files. The unchanged skipped database checks need configured PostgreSQL. Baseline before edits: 371 passed, 42 skipped, 0 failed.
- `bun run format:check` and `git diff --check` passed.
- `bun run build` passed. Sandbox worker restrictions required rerunning build/check and loopback integration tests with escalation. The build emits an existing terminal-color environment warning.
- Headless Chromium inspected the real participant component with explicit fictional transport/playback fixtures at 1280×900, 390×844 and 390×650. Caption bounds remained identical across five talking/idle cycles at each size. Topic choice and Finish worked with keyboard focus/Enter. Finish remained visible with a target at least 48 px high, no horizontal overflow, and no unintended capture command. Screenshots: `/tmp/lemmi-participant-1280x900.png`, `/tmp/lemmi-participant-390x844.png`, `/tmp/lemmi-participant-390x650.png`.
- New behavioral checks exercise menu synthesis and recognized-topic selection through STT → coordinator → TTS, hidden/stale/unreviewed rejection, refusal, Quiet wording, empty topics, greeting capture ordering, Finish during delayed synthesis/late PCM wiping, and paused photo exit.

These are local software/fixture checks. No external model/provider calls, actual microphone or speaker listening test, physical K151, live database, production rollout or full accessibility acceptance was performed.

## Next handoff

Anay reviews scoped startup output, schema compatibility and cancellation. Lukas reviews eligible-topic selection/content. Kylie reviews captions, menu and persistent Finish on actual devices. Emilia rehearses Start → greeting consumed → explicitly permitted capture, game greeting, topic choice, Pause/Finish/Stop and reconnect on K151. Do not describe this candidate as deployed or hardware-accepted.

## Backend integration review — November 15, 2026

Reviewed against deployed startup recovery and saved-photo Start/Resume. The
existing `speakSessionPrompt` now supplies the requested introduction; the
parallel new greeting method/job and superseded browser startup logic are
omitted to avoid duplicate/canceled greetings. Existing language/text fallback,
consumed-output ordering, profile recovery and Photo Story composition remain.
Direct and spoken Photo Story openings name the activity. Unselected menu
receipts retain the 256-turn bound, and mobile status height no longer shifts
captions. Final isolated checks: 462 tests / 6,784 expectations, zero failures or
skips with five disposable PostgreSQL databases; type/build/format/whitespace,
production HTTP/verified TLS/WSS and three-viewport Chromium checks passed.
See backend status for actual rollout and remaining human/firmware acceptance.

## Deployment acceptance — November 15, 2026

Integrated and deployed as web/gateway `5146030` on `backend-deploy`; original
branch and commit remain preserved. Both services restarted at 09:39:52 UTC,
with speech/tunnel, private configuration and original profile/credential
fingerprints retained. Public Chromium repeated the three-size fixture checks;
public WSS plus real local TTS verified greeting once, eligible spoken menu,
12-frame negotiation, Finish cancellation and stale-receipt denial. Receipts
were simulated; no microphone/physical K151/human audio acceptance. Test-only
profiles/enrollments removed. Protected rollback pointer:
`.data/participant-greetings-rollback-path`. Refresh/reconnect and explicitly
Start. Earlier unspecified user-reported bugs remain open; see backend status.
