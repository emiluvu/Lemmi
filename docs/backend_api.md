# Lemmi backend integration reference

## Conversation reliability deployed — November 15, 2026

**Web/gateway/local speech `ea66280`**, integrating reliability source `48686bf`;
coordinated rollout at 16:27:42–44 UTC. Private post-speech setting now `1500` ms;
other configuration, models, workers, proxy, tunnel and database retained. No new
route/event, migration or dependency. Existing audio schemas now accept up to
2,000 frames/1,280,000 bytes; `device.ready.audio.maxCaptureMs` advertises 40,000.
New parsers also accept the old 20,000 advertisement. Deploy/roll back matching
web/gateway/speech: old wrappers reject input over 20 seconds. Firmware and legacy
local `/participant/voice` may still stop earlier.

Designed browser initial silence pauses after 30 seconds without inference;
post-speech silence is 1.5 seconds (range 1–8), capture max 39.5 seconds/1,975
frames, inference deadline still 20 seconds. Retired stream cancellations and
obsolete async errors cannot cancel newer listening/Resume or Mute/Unmute work.
Natural eligible teaching topics, photo next/previous/skip and polite exits reuse
existing commands and reducers. Participant photo presentation omits detailed
captions, which remain in approved context/existing activity metadata.

Host gate: **497 tests / 12,767 expectations, no skips/failures**, 15 Python checks,
production TLS/WSS/private-photo smoke and Chromium checks passed. Svelte reports
zero errors and three generic-alt wording warnings, recorded for UI review. Actual public
synthetic speech accepted 1,280 frames after a 22.1-second initial pause through
real STT/model/TTS; teaching completed two substantive model replies. Silence,
continuation, mute/Stop, photo navigation, keyboard/recovery and public denials
passed. Physical microphone/speaker/K151 and human endurance remain unrun.
[Full evidence and coordinated rollback](backend-status.md#conversation-reliability-deployed--november-15-2026),
[handoff](handoffs/conversation-reliability.md).


## Photo Story and conversation fixes deployed — November 15, 2026

Current **web `d4e99d9`, gateway `1f1c2c4`** integrate
`fix/photo-story-conversation-stalls/15851e1`. Web/gateway restarted together at
12:10:50 UTC; a reviewed web-only image reload correction followed at 12:15:17 UTC.
No new HTTP route, WSS event, contract, migration, dependency or configuration.
Speech `a779c70`, tunnel/proxy/database and provider settings retained.

Existing `input.text` and captured-speech routes recognize reviewed explicit
Photo Story phrases. English ungrounded display claims become a fixed offer;
confirmation still uses the authoritative activity transition. Obsolete async
results/errors cannot cancel a newer generation/lease/profile/privacy/policy/
endpoint scope. Current failures remain visible. Scoped image layout contains
both orientations, and identical activity snapshots retain the decoded blob;
existing authority revisions still remount and reauthorize it.

Server checks passed: **473 tests / 6,867 expectations**, five disposable databases,
15 Python fixture tests, frozen install/type/build/format and production verified
HTTPS/WSS/private-PNG smoke. Final UI correction repeated relevant build/browser/
production checks. Public Chromium confirmed decoded scoped photo entry,
setup/image error recovery, keyboard teaching/Finish and safe retry/Stop;
synthetic public speech confirmed real local STT → external model → local TTS
photo entry/discussion and continuation with one protected image read.
Public robot-protocol TTS/receipts passed on rerun after one undiagnosed initial
greeting-probe failure. No physical microphone/speaker or K151 acceptance.

[Deployment evidence, limitations and protected rollback pointer](backend-status.md#photo-story-and-conversation-fixes-deployed--november-15-2026),
[source and server handoff](handoffs/photo-story-conversation-stalls.md).

## Lemmi branding deployed — November 15, 2026

**Web runtime `f3f5199`**, gateway `5146030`, speech/tunnel retained.
Integrated `e1a5bf9` with the current participant release while retaining scoped
saved-photo smoke checks. Changes are supplied logo/favicon, route titles and
metadata, plus exactly `/favicon.svg` and `/images/brand/lemmi.png` in the static
proxy allowlist. PNG SHA-256 and embedded favicon bytes match the documented
source; no artwork regeneration, avatar, gateway, schema or dependency change.

Bun 1.4.4 frozen install, type/Svelte, build, formatting and whitespace passed.
Existing page/access/exit/presentation tests: **16 passed / 159 expectations**.
Production HTTP/verified TLS/WSS/private-photo and branding-asset MIME smoke
passed on one disposable PostgreSQL database, removed afterward. The preceding
backend release's 462-test suite was not rerun for this UI/static-only slice.
Chromium with the candidate production build passed desktop/mobile logo bounds,
route titles/metadata, menu keyboard/Escape, no overflow or runtime errors, and
32px favicon decode with 626 opaque pixels. These used a separate mock browser;
its navigation lock was isolated between page inspections. No profile/session
writes, microphone, screenshots or hardware tests.

Web-only rollout at **10:05:17 UTC**; Nginx `-t` passed and the installed proxy
reloaded with only the two exact static additions. Gateway/speech/tunnel PID and
start state and private `.env` hash were unchanged. All four services active,
zero automatic restarts. Protected prior source/build/proxy/runtime record:
`.data/branding-rollback-path`. No database migration or profile/credential write.

Actual public HTTPS Chromium at desktop/mobile passed byte-exact PNG, expected
PNG/SVG MIME, a painted 32px favicon (626 opaque pixels), caregiver/settings
titles and global metadata, keyboard menu/Escape and no overflow/runtime errors.
The unassigned participant entry correctly redirected to caregiver setup; no
profile was enrolled to bypass that behavior. Tests waited for hydration and
isolated only their disposable browser's navigation cookie between pages.
Unlisted brand files/README, favicon suffixes, `.env`, internal and mock paths
remained 404. No public screenshots, microphone, profile/session writes or
hardware acceptance. Reload/reopen the tab if the favicon is cached.

The reviewed source and this acceptance record are synchronized to `main` and
`backend-deploy` by fast-forward; the deployment checkout stays `backend-deploy`.
Earlier unspecified bugs and physical K151/audio acceptance remain open.

## Participant greetings, teaching choices and Finish deployed — November 15, 2026

Reviewed handoff `1037fe1` against the newer deployed startup-recovery and
saved-photo releases. **Web/gateway runtime `5146030`**, integrating tested
source `ded171f` and the concurrent documentation-only handoff `8f1453e`.
Rolled out together at **09:39:52 UTC**; speech `a779c70` and tunnel retained.
The direct merge would launch two Start speech jobs. Retained the existing
revision-checked `speakSessionPrompt` path and browser opening/Resume state
machine, with the requested short fixed English/German introduction. Kept
failed-profile Retry, exact profile language, saved-photo scope and same-picture
Resume. Added typed eligible teaching choices, deliberate selection and visible
Finish; a paused Photo Story can finish without releasing its pause.

Review also bounded unselected-menu text receipts at the existing 256-turn limit
(Stop still bypasses capacity), and reserved mobile status space after Chromium
measured a five-pixel caption shift. No migration, dependency, provider/model,
private configuration, notification, firmware or credential replacement.

Pinned Bun 1.4.4 frozen install, type/Svelte, formatting/whitespace and isolated
production build passed. **462 tests / 6,784 expectations, zero failures/skips**
used five newly created disposable PostgreSQL databases, removed after testing.
Production HTTP/certificate-verified TLS/WSS participant/private-photo smoke
passed on another disposable database. Initial saved test URLs pointed to a
retired listener; rerun used the current database server with new test databases.
Sandbox socket/build-worker restrictions required escalation, not code fallback.

Actual Chromium with the candidate production build and isolated gateway/database
passed desktop 1280×900, mobile 390×844 and 390×650: mounted captions stable
through synthetic speaking/waiting changes, keyboard teaching selection/Finish,
visible 48px Finish, no horizontal overflow, paused photo Finish, failed startup
Retry without Start/capture, contained photos, image failure Pause and retry
without Resume/capture, and Stop. Fresh profiles correctly had no eligible topics;
only the test's own fictional profile received reviewed topic IDs. The harness's
initial injected sequence zero correctly closed its connection; corrected the
fixture to preserve monotonic sequences. Zero browser runtime errors; capture
and playback disabled, no screenshots, microphone or recordings. Real human
speech/speaker quality and physical K151 controls remain unrun.

Actual public HTTPS Chromium repeated the same three-viewport checks on its
own newly created/enrolled fictional profile: keyboard topic choice and Finish,
paused Photo Story Finish, stable caption placement, initial 503 → Retry with
zero Start/capture, photo failure Pause/retry and Stop passed. Zero runtime
errors; no screenshots/audio retained. Actual public robot-protocol WSS with
real local TTS passed short fixed Start greeting **once** despite duplicate Start,
simulated consumed receipts, negotiated 12-frame output, eligible spoken topic
menu, Finish cancellation and late-receipt denial. No microphone capture,
external-model quality or physical K151 acceptance is implied.

Source/build/private-configuration/database backup is recorded by protected
`.data/participant-greetings-rollback-path`. No migration/proxy/configuration or
provider change. Restarted only web/gateway; all four services active with zero
automatic restarts. Speech/tunnel PID/start state and private configuration
matched the baseline. After release/deletion of only the probes' own fixtures,
all original profile rows, endpoint assignments and credential fingerprints
matched the predeployment baseline; Alex's five saved photos remain intact.
Retain current permissions/deletions/data during rollback; do not blindly restore
the database snapshot. Transport diagnostics remain off; robot uplink remains
unresolved. Refresh/reconnect and explicitly Start before participant testing.
Prior unspecified user-reported bugs remain open; these checks do not establish
complete user acceptance. Kylie/Lukas/Emilia still own actual-device UI/content,
human audio and hardware rehearsal at their respective boundaries.

## Earlier handoff — additional bugs unresolved

November 15, 2026: user reports that bugs still remain after the conversation
startup recovery rollout. Exact remaining symptoms/reproduction are not yet
specified; defer investigation to the user's next debugging session. Do not
treat the successful fixture/browser checks below as complete user acceptance
or claim the original incident is fully resolved.

Current deployed revisions: **web `9b218b9`, gateway `c44f092`, speech `a779c70`**.
Recovery source and earlier deployment records were pushed in `2d15004`.
Stackchan transport diagnostics are off; evidence and rollback pointers remain
saved. No further code change, deployment, restart or test was performed for
this final handoff. Next session should reproduce the user's remaining bugs
against these exact revisions before choosing another fix.

## Conversation startup recovery deployed — November 15, 2026

**Web runtime `9b218b9`**, gateway `c44f092` and speech/tunnel retained.
User reported missing avatar and Tilde/Tilda stuck on “Loading your companion”.
Refresh restored the avatar/German controls. Public checks confirmed200 PNG
avatar assets, visible SVG artwork on desktop/mobile and caregiver navigation,
and intact exact-ID German mapping with `device.ready.language=de` and German
conversation controls. No profile, language mapping or avatar asset repair was
needed; the original tab's failed request was not captured, so its exact trigger
is unproven. Earlier acceptance used fresh sessions and missed failed startup.

Fixed the confirmed recovery defect: failed initial setup now ends in an
explicit unavailable state with **Retry profile connection**, rather than an
indefinite loading placeholder. Retry performs bounded existing reads, validates
assigned browser/requested profile, resolves optional safe profile metadata and
connects capture-off. It never enrolls, Starts, unmutes or restores listening
intent. Epoch/disposal guards reject late results and changed-profile setup.
Preview and Photo Story composition are retained. No backend API/configuration,
German mapping, credentials, photo content or speech change.

Actual public Chromium on its own disposable fixture passed forced setup503 →
visible unavailable/Retry → connected visible SVG avatar, with zero Start/capture
requests from Retry. Desktop/mobile photo containment, keyboard controls,
image failure→Pause, image retry without Resume/capture, and Stop also passed;
zero runtime errors, no screenshots/audio retained. Type/Svelte zero errors/
warnings, production build, formatting/whitespace and17 targeted tests/90
expectations passed. Full450-test suite belongs to the preceding Photo Story
release and was not rerun for this frontend-only change. Web-only rollout
retained gateway/speech/tunnel PID/start state. Protected prior web build/source
pointer `.data/profile-recovery-rollback-path` is available.

Debug cleanup: automatic approval review initially rejected removal of an
uncertain browser enrollment because ownership was not conclusively proven.
It was left intact until the user explicitly approved removal and accepted a
possible disconnect. The exact recorded row was then revoked/removed with ID,
credential, profile and unchanged-row guards; Tilde profile/photos/language and
original endpoints were not changed. Reopen Conversation from the caregiver
workspace if a browser credential needs recovery. All other owned debug fixture
profiles/endpoints were cleaned. Transport diagnostics remain off/evidence saved.

Refresh before continuing testing. Human speech/K151 acceptance remains separate.

## Alex saved-photo Photo Story deployed — November 15, 2026

**Web/gateway runtime `c44f092`**, integrating requested `978a0b6` and its
Start/Resume prerequisites into `backend-deploy`. Alex uses five existing saved
non-portrait caregiver photos/descriptions; no generic garden fallback for Alex.
Other fictional profiles keep neutral scenes. No migration, photo/context edit,
memory opt-in, credential replacement or speech-model change. Speech/tunnel
PID/start state retained; web/gateway active with zero automatic restarts after
coordinated rollout at **08:01:06 UTC**. Nginx validated and reloaded the narrow
UUID photo-asset rule. Existing profile/device/credential fingerprints preserved.

Substantive review fixed an actual stale-context bug: profile updates and lost
COMMIT reconciliation now pass through the registry, refreshing saved-photo
packs immediately. Real PostgreSQL regressions cover edits/removal, late model
suppression, stale profile/privacy/policy revisions, gateway-epoch replacement
and byte wiping after interrupted private reads. Browser review found no blocker.

Pinned frozen Bun1.4.4 install, type/Svelte zero errors/warnings, formatting and
whitespace passed. **450 tests /6,704 expectations**, zero failures/skips, using
five dedicated disposable PostgreSQL databases. Isolated production build and
HTTP/verified-TLS/WSS smoke passed against a sixth disposable database, including
real fixture PNG media and gate-only/noncurrent/ended denials. Initial smoke
still expected Alex's old garden fixture; corrected it to seed approved private
PNGs and the rerun passed. This was a test-harness assumption, not a restored
product fallback.

Actual public Chromium on an isolated fictional profile passed desktop/mobile
image containment, visible safety controls, keyboard focus, forced image failure
→Pause, image retry without capture/Resume, and Stop; zero runtime errors.
Capture/playback were disabled and fixed text used; no microphone, screenshots,
recorded audio, live model-quality or physical K151 acceptance is claimed.

Actual public Alex acceptance also passed: all five saved UUID PNGs loaded
with protected no-store/nosniff headers and valid PNG signatures; complete
navigation, Pause/Resume same picture/question, Stop denial and cross-profile
denial passed with capture off. No private bytes/descriptions were logged or
saved. Successful probes were cleaned. One earlier harness expected a JSON
credential instead of its HttpOnly cookie and left an unused enrollment; it was
uniquely identified by comparison with the predeployment device dump plus
profile/type/issuance-time guards, revoked and removed. Final existing
profile/device/credential fingerprints match the predeployment baseline.

**Stackchan diagnostics are off**, per user's request. All allowlisted evidence,
source/config backups and bounded socket records are saved; resume later via
[the preserved diagnostic handoff](handoffs/stackchan-uplink-backend-investigation.md).
Only gateway restarted for disablement; subsequent web/gateway restart was the
Photo Story rollout. The robot itself remains stopped; its uplink failure is
unresolved. Protected deployment rollback pointer `.data/alex-photo-story-rollback-path`
contains previous source, private configuration/proxy/build and a database/media
backup refreshed with web/gateway writers stopped. Routine rollback must retain
current deletions/permissions/data; do not restore old DB/media indiscriminately.

Refresh/reconnect the participant browser, select Alex and explicitly Start.
Open Photo Story to use the saved album. Human microphone/speaker, spoken
acknowledgment/tone and hardware Stop acceptance remain pending. [Photo Story
handoff](handoffs/alex-photo-story-pack.md).

Reviewed Emilia's send-capacity feasibility proposal `3c37f83`. Isolated
5744/16384 paired build preparation is reasonable; hardware readiness remains
pending exact linked artifacts and full overhead/reserve budget. Matched lwIP
defaults also change writable byte threshold2873→8192, queue limit16→46 and
queue threshold8→23 (MSS1436, absent overrides). These derived values must be
recorded in both builds; capacity alone is not the entire writable comparison.
10640-byte payload delta and nominal65348-byte remainder are correct arithmetic,
not a worst-case RAM guarantee. Correct installed SDK identity is reported as
IDFv5.5.4/735507283d, builder43a8f6d; earlier v5.5.1 source inspection was not an
exact binary provenance check. No backend/protocol/configuration/service change,
SDK build, flash or capture performed. Diagnostics remain enabled; robot stopped.
[Counterpart review and Emilia's next build handoff](handoffs/stackchan-uplink-backend-investigation.md#send-capacity-proposal-review--3c37f83).

Instrumented Stackchan attempt correlated, November15 07:20:21–07:20:24UTC:
Emilia's `b678916` reports installed voice0.9-diag1, five zero socket-writability
polls and zero TLS writer calls in the failed batch;33 completed earlier writes.
Gateway accepted **29 frames / zero rejections**, max gap192.007ms,
max synchronous handler0.888ms. Last accepted approximately07:20:22.446;
only gateway close1001/Heartbeat timeout at07:20:26.847 followed device failure.
Sampled local proxy/gateway queues were0; no growing origin backlog observed.
Four-frame discrepancy is unlocalized; robot-facing ACK/window/loss remain
unmeasured and playback-window causation is not established. No repeat needed.
Diagnostics remain enabled, robot stopped; no backend change/restart/disablement.
Bounded local metadata sampler ended automatically at07:23:54UTC.
[Exact correlation and next handoff](handoffs/stackchan-uplink-backend-investigation.md#instrumented-diagnostic-result--0720-utc).

Controlled Stackchan attempt correlated, November15 07:00:06–07:00:42UTC:
gateway accepted164 frames with zero rejected events, max frame gap121.281ms,
max synchronous handler2.283ms. Firmware reported167 completed writes and109ms
bounded-write timeout; the difference is unlocalized, not proof of packet loss.
Only gateway close was1001/Heartbeat timeout at07:00:38.371UTC, after device
failure/disconnect. No capture-end or reply. Sampled local receive queues were
empty; small forwarding queues drained while ACK counters advanced. No growing
origin backlog observed, but500ms samples cannot exclude short stalls or measure
robot-facing TLS ACKs. Four services active, gateway zero automatic restarts.
**User explicitly requested diagnostics stay enabled**; no disable, restart,
reflash or further capture. Do not repeat the same test without new robot/AP
TCP/TLS evidence. [Exact correlation and next diagnostic decision](handoffs/stackchan-uplink-backend-investigation.md#controlled-retest-results).

**Temporary diagnostic deployment — November 15, 2026:** gateway `2501847`
has `LEMMI_TRANSPORT_DIAGNOSTICS_DEVICE=stackchan-alex` enabled, confirmed by the
content-free startup marker at 06:53:25 UTC. All other endpoints remain excluded.
Reviewed diagnostic record fields below are unchanged; no API/schema/auth/media
or rate/deadline/buffer changes. Web/speech/tunnel retained; actual public
capture-off control checks and existing credential retention passed.
Physical retest remains pending. Unset the selector and restart only gateway
to return to normal logging; protected helper/previous release are ready.
[Deployment, retest and rollback](handoffs/stackchan-uplink-backend-investigation.md#diagnostic-deployment--november-15-2026).

**Stackchan uplink diagnostic candidate — November 15, 2026; not deployed:**
Optional server-only `LEMMI_TRANSPORT_DIAGNOSTICS_DEVICE=<exact enrolled device ID>`
selects one endpoint for content-free gateway receive/close diagnostics. Empty/unset
disables it; changing it requires a coordinated gateway restart and fresh explicit
participant Start. No route, wire schema, media format, auth or rate/buffer/deadline
change. Records use `Lemmi transport diagnostic`, a random connection ID, cumulative
message/byte/error counters, per-capture accepted-frame counts/gaps, handler/sample
timing, last validated event type/error code and close code/allowlisted local cause.
At most one periodic sample/second plus open/capture/close events. No payloads,
headers, private identifiers or peer close text; observer failure cannot alter
control processing. Native/peer closes may have no local cause, and capture-end
receipt does not assert processing success. Uses the existing host journal; disable
after the coordinated rehearsal and apply existing technical-log cleanup policy.
Current runtime `264df22` lacks these receive/close records; the 06:11:35 UTC incident
cannot be reconstructed from its empty incident-window journals. Origin socket
statistics do not measure robot-to-Cloudflare ACK timing. [Evidence, safe observation
points, exact diagnostics and Emilia handoff](handoffs/stackchan-uplink-backend-investigation.md).

Emilia's exact firmware/handoff `d246217` is now source-reviewed, and she reviewed
diagnostic candidate `9a7173e` as compatible. No additional wire change or fix was
established. Diagnostics remain undeployed/off pending coordinated rollout and
a UTC-marked instrumented attempt; source publication alone does not repair uplink.

## Alex private photo album candidate — not deployed

On `codex/alex-photo-story-pack`, existing `/v1/demo/photo-assets/:assetId` also accepts validated media UUIDs for Alex’s currently selected, saved non-portrait photo. It returns bounded private `image/png` (maximum5MiB); the original fixed generic IDs remain SVG for other existing fictional demo profiles. Gate, browser credential, same-origin, assignment, approval, attachment, active session/photo, profile/privacy/policy revision, gateway epoch and media policy checks remain mandatory. No caller-selected path/URL, new WSS operation, schema or migration. Host registry builds `profile-alex-photos` from approved saved caregiver descriptions; no image inference. Album changes invalidate old work, empty albums do not fall back to garden. Web/gateway plus nginx UUID allowlist must deploy together. [Status, evidence and rollout](handoffs/alex-photo-story-pack.md).

## Photo Story Start/Resume source candidate — not deployed

Branch `codex/photo-story-start-resume`, updated against main `f3e3b41`, changes existing WSS behavior without new schemas/routes. Successful new `input.start` and explicit `input.resume` initiate one approved opening/reorientation in the server-resolved profile language (`en`/`de`). The gateway enters processing before its acknowledgment/state; the browser waits for opening playback consumption plus current waiting state, then explicitly unmutes/requests a new grant for Conversational/Guided. Quiet stays capture-off after the prompt. Raw Start/Resume/Unmute never grant capture. Missing adapters/playback or current failed synthesis returns the approved prompt as `response.text` and capture-off `waiting`; it emits no fake playback receipt. Text fallback ends the browser listening attempt. German games remain unavailable; no English voice fallback. Robot/browser 12-frame negotiation and four-frame fallback remain unchanged.

`input.photo.start` applies existing `photo.talk` and introduces the approved caption plus an optional question (Quiet: caption only), also with text fallback. Resume retains the same photo/current bounded question, open conversation reply or teaching prompt. Reminders survive participant Pause/Resume and mic mute only; other authority/context changes clear them. They never enter checkpoints/journals/memory summaries. The approved-output ceiling is 600 characters. Protected images keep scope/revision checks, one 409 retry and an eight-second deadline; retry never resumes capture/output. [Source acceptance and deploy-agent handoff](handoffs/photo-story-start-resume-2026-11-14.md). This candidate is **not deployed**; deployed references below describe the earlier runtime.

**Deployed Stackchan output credit — gateway `264df22`, web/speech retained:** existing hello `playback.outputWindowChunks:12` is now honored for authenticated robots as well as browsers; actual ready response advertises12, omitted/explicit4 stays4. Gateway negotiation and captured/approved/typed speech owners share that bound. Credit counts consumed frames only; Stop cancels/wipes queued output and rejects stale receipts. No wire schema or migration change. [Firmware handshake, limits and hardware test handoff](handoffs/stackchan-playback-window.md). Public own-profile robot WSS12→consumed2→14→Stop/stale-receipt denial and omitted-field4 fallback passed with real speech/simulated receipts. Firmware/speaker/jitter acceptance remains Emilia’s hardware check. No migration/configuration/credential change.

**Deployed profile-context/German update — web/gateway/speech `a779c70`:** additive migration006; six private-gate/demo-only/context/image operations from `cd68663`, with participant lock and transactional scope checks. Separate default-off summary memory uses bounded revision-fenced background work and unreviewed AI records, never transcript/audio retention. Participant profile and `device.ready` add server-resolved `language` with English compatibility default; exact-ID German rejects mismatched text/capture, has no activities and skips Jev classification. English Jev activities remains enabled. Proxy image-upload1500k/other demo32k. [Detailed contracts, security fixes, observed checks and rollout](handoffs/profile-german-backend-integration.md). Migration006 applied, all eight migration checksums match. Public rich profile/images/scope/deletion/permission controls, opted-in background summary persistence, Tilda German, concurrent English/German and retained Jev spoken confirmation passed synthetically. One initial German start timed out; two later runs passed, cause unresolved; human voice/startup/room/hardware review pending. Private speech2STT/2TTS supports en/de with shared total capacity. Existing data/keys retained; no bulk backfill or existing memory opt-in.

**Deployed Jev activity routing — gateway `07e66b7`, web `3c5033e` retained:** `LEMMI_DECISIONS_ENABLED=1`, `LEMMI_DECISIONS_SCOPE=activities`, `typesafe/jev-1.14`, threshold 0.85/deadline 1500 ms restrict semantic classification to activity requests. Phrase-based recap/redirects remain; full conversation scope is off. A confident teaching/photo request asks confirmation; immediate agreement uses existing coordinator/speech authority. Quiet uses declarative confirmation with no question. Offers clear on the immediate next turn or cancellation and are never checkpointed; only explicit immediate agreement uses the existing mode transition. Actual 71-case activity-only gate passed; full conversation scope remains off. No new API/schema/migration. [Source handoff and measured gate](handoffs/conversation-routing-repair.md). Public actual synthetic browser request → semantic offer → spoken yes → teaching completed two replies/three captures, no switch before confirmation; ordinary real STT/Jev/chat/TTS also passed, with Mute/Stop and no runtime errors. Restarted gateway only after backup; web/speech preserved. No physical audio acceptance. [Actual deployment and limits](backend-status.md#jev-activity-routing-deployed--november-14-2026).

**Previous response/profile-entry update: web/gateway `3c5033e` at that rollout (web retained).** no new wire command, route, schema or migration. Caregiver cards use existing current/enroll before navigation; initial unselected/mismatched conversation URLs return to caregiver setup before locking. Participant screen has no selector. Browser silence defaults to 1,000 ms (range 1,000–8,000); selected provider deadline is 8,000 ms with explicit failure/no retry. Whole invitations recognize reviewed Teach Lemmi ASR spellings and trailing `game`, while controls/fixed concerns retain priority and Jev stays disabled. Family replies acknowledge feelings without invented relative/contact facts; model claimed-contact guard includes talked/spoke. [Tests, observed latency and limits](handoffs/voice-response-and-profile-entry.md). Public synthetic browser acceptance measured ordinary response-start delay 3,193 → 2,555 ms across individual before/after observations; spoken Teach Lemmi selected teaching and started scheduled output after 1,513 ms. Both verified card profile handoff, consumed playback, another granted capture, Mute and Stop. Speech service retained (CPU 2+2/HFC); no human microphone/physical speaker/K151 acceptance. [Actual deployment record](backend-status.md#response-and-profile-entry-fixes-deployed--november-14-2026).

**Previous one-action-listening release: web `d6d2ff6`; gateway `95bdcef` retained at that rollout.** Browser Start conversation now performs the existing `input.start` → acknowledged current owner → `input.mute {muted:false}` → acknowledged unmute → `input.speak` sequence under one explicit user gesture. Permission is required; the client transmits only after the existing current capture grant. After consumed reply completion, Conversational/Guided request another turn only at the matching waiting snapshot; Quiet stays capture-off. No API/schema/device/database change. Raw Start/Unmute/Resume semantics stay capture-off; the browser's explicit Start listening/Resume conversation action separately requests a new grant. Reconnect/background/Stop/mute/profile/lease/privacy changes never restore intent. [Actual acceptance and limits](backend-status.md#one-action-browser-listening-deployed--november-14-2026), [implementation and Stackchan boundary](handoffs/browser-default-listening.md).

**Backend/previous UI deployment: web/gateway `95bdcef`.** UI branch `integration/frontend-backend/a664e7e` is merged and preserved. Private speech remains on its existing CPU 2+2/HFC setup; decisions remain off. All seven migrations are unchanged. [Observed review and public acceptance](backend-status.md#conversation-ui-and-spoken-modes-deployed--november-14-2026).

## German browser conversation candidate — not deployed

Authorized participant profile responses and `device.ready.payload` add
`language: 'en' | 'de'` (English compatibility default). The protected server
configuration `LEMMI_GERMAN_PROFILE_IDS` selects exact created IDs, never display
names or client mappings. `input.text` and `input.speak` must use that resolved
language. German activity/teaching capability is unavailable and requests are
rejected with German wording. No new route/migration or public language setter.
Existing profile scope, ownership, revisions and cancellation apply. Deployment
and acceptance steps: [German release candidate](handoffs/tilda-german-release.md).

**Current deployment: web/gateway `95bdcef`.** UI branch `integration/frontend-backend/a664e7e` is merged and preserved. Private speech remains on its existing CPU 2+2/HFC setup; decisions remain off. All seven migrations are unchanged. [Observed review and public acceptance](backend-status.md#conversation-ui-and-spoken-modes-deployed--november-14-2026).

New exact live demo HTTP operations (existing private gate, explicit demo enablement and same-origin checks; no generic live RPC):

| Operation | Contract / boundary |
| --- | --- |
| `POST /v1/demo/profile-update` | `{profileId,expectedRevision,commandId,patch:{preferredName,avatarId}}`; only current assigned fictional profiles, rechecked inside the locked write transaction. Reuses profile update cancellation/revisions/durable receipts. Result is the five-field participant projection. Private fields are rejected; active affected profile pauses. |
| `POST /v1/demo/conversation-lock` | Establishes this browser's HttpOnly/SameSite navigation cookie; does not grant identity or a session. |
| `POST /v1/demo/conversation-exit` | Exactly `{password:string}`; transient verification against server-only four-digit configuration; wrong/malformed/missing-config/rate-limit errors are explicit. Correct POST clears only the navigation lock. |

Typed `input.text` and granted recognized speech accept reviewed Teach Lemmi/Photo Story/Explore pictures and return-to-conversation commands before ordinary model generation. Commands reuse the existing reducer/coordinator and fresh generation-bound output; no new device event, active endpoint, capture authority or model-generated action. Photo Story needs a confirmed enabled browser. No-topic teaching and Just look allow explicit bounded capture for mode selection; ordinary ineligible discussion remains rejected. Unsupported games return unavailable. Exact command execution is independent of optional decisions; semantic classification is advisory only, and decision failure does not fall back to phrase detection.

The single-screen UI preserves direct labeled safety controls, with controls also present inside typing/reply/exit dialogs. Browser mic capture still requires explicit Speak now and a current grant; unmute never captures. The separate navigation passcode is configured privately, has no live default, and does not replace caregiver/device authorization. See [review](handoffs/ui-voice-backend-review-2026-11-14.md) for transaction checks, 100-character command-ID fix, exact source preservation and remaining hardware/clinical limits.

**Previous deployment:** gateway/private speech `c594130`, web `12a1e47`; migration `005_conversation_redirects.sql` is applied. Speech/general chat/Kylie UI are installed. CPU STT/TTS have two independent workers each; HFC female medium is the shared server voice. Existing twelve/four-frame browser/robot credit and public Photo Story/teaching/access contracts remain intact. Open conversation browser endpointing defaults to 1,500 ms; the separate teaching client keeps its existing endpointing. Semantic decisions are compiled but **disabled** after failed live evaluation; CUDA is disabled after driver initialization failure. [Actual checks, limitations and rollback](backend-status.md#integrated-backend-release--november-14-2026), [detailed integration record](handoffs/backend-integration-2026-11-14.md).

Web `12a1e47` keeps Type instead open while typing and makes automatic hidden-tab Pause owner-only; explicit observer Pause/Stop remain available. Two actual browser contexts verified observer/owner background behavior. Existing Start conflict still has legacy mock wording, while enforcement is per profile. No new route or wire schema was introduced by these UI fixes.

**Integrated optional semantic decisions (runtime disabled):** optional `ConversationDecisionAdapter` runs before open-mode reply generation with current text/language, bounded transient history and scoped away-topic IDs/labels. `LEMMI_DECISIONS_ENABLED=1` selects the OpenRouter Decisions API; `LEMMI_DECISIONS_MODEL` allows `typesafe/jev-1.14` (default) or `openai/gpt-6-luna-decisions`. Default deadline 1,500 ms, independent coordinator ceiling 2,500 ms, within the existing 20-second turn. Enabled mode uses semantic redirect/recap decisions; disabled mode retains the phrase behavior below. Failure is explicit with no failed-live phrase/model fallback. Immediate controls and fixed sensitive/urgent routes bypass classification; teaching/photo flows remain specialized. No HTTP/device wire command or database migration is added beyond the base branch's migration 005. Activity classification does not execute an activity. [Configuration, probability validation, privacy flags, evaluator and limitations](handoffs/conversation-decisions.md).

**Deployed conversation redirects and reminders:** authenticated caregiver `PATCH /v1/profiles/:profileId` accepts `patch.conversationRedirects: {awayFrom: string[], toward: string[]}` in the existing `{profileId, expectedRevision, commandId, patch}` body. Each list allows up to 12 trimmed phrases (2–80 characters); empty arrays clear the setting. Private caregiver detail reads include this optional field; participant profiles, sessions, device events and journals do not. Migration `005_conversation_redirects.sql` is applied on the host and required for new PostgreSQL installations. Configuration updates use existing scoped/revision-checked transactions and pause/cancel current work before commit; Resume stays explicit.

In open chat only, whole-phrase matches (case/punctuation normalized; aliases entered explicitly) request one gentle transition per matched phrase within an uninterrupted interaction. Conflicting destinations are excluded. Empty destinations allow a neutral AI subject; this is model guidance, not guaranteed semantic detection. A reply repeating a configured away phrase during the redirect is replaced with a neutral fixed response. Explicit continued interest is respected after the offer; help/urgent/sensitive/refusal routes run first. Guidance does not start activities or infer biography, preferences or emotion. Caregiver web editing remains unconnected; use the existing authenticated profile API for live configuration.

English phrases including “What was I talking about?”, “Where was I?” and “I lost my train of thought” use the existing text/speech path and produce a fixed, bounded reminder from the most recent ordinary participant message in transient session context. Quoted text is labeled “Just now, you said”; long text is truncated. A repeated reminder does not quote the prior reminder. Absent/cleared/redirect-marked context offers a fresh start. No recall query calls the LLM, changes presets or saves an excerpt. Other phrasing/languages use existing conversation handling. This is an explicit-request feature, not automatic detection of confusion.

Integrated `codex/general-chat-handsfree` refines existing open-mode `input.text` / speech conversation behavior without wire/API changes. Any everyday topic is accepted without topic selection; non-interrupting fixed identity/unclear replies preserve bounded transient dialogue. Interrupt/refusal/privacy rules remain authoritative. No voice-to-activity routing or automatic capture grant is added. See [local status](backend-status.md#general-chat-branch--local-undeployed); this is not deployed acceptance.

**Earlier browser-only audio deployment (`da731c8`), superseded by robot opt-in above:** optional `device.hello.playback.outputWindowChunks` accepts 4 or 12. Only an authenticated browser requesting 12 gets twelve 20 ms output frames (240 ms); robot/default clients remain four (80 ms). `device.ready.audio.outputWindowChunks` advertises actual negotiated credit. The value is pinned per speech owner; progress still credits only consumed frames, with two-frame progress batching (25/sec). Both browser players bound queues to negotiated credit and Stop wipes all queued nodes. Gateway outgoing backpressure ceiling is now 64 KiB; frame/input/control limits otherwise unchanged. Existing live voice, teaching, Photo Story and private access are retained. Public twelve-frame negotiation passed; audible human retry remains pending. [Actual checks and limits](backend-status.md#smoother-browser-speech--november-14-2026).

**Current public deployment: web/gateway `9ad7446`.** Browser Photo Story (`photo_album`) is available on confirmed fictional demo profiles with existing gate/enrollment; production mock operations remain blocked. `/participant/photo-story` uses the same live participant controller as conversation. The teaching voice continuity fix from `4690bf6` is included. This supersedes local-only/missing-photo statements below. [Current status and acceptance](backend-status.md#public-photo-story-deployed--november-14-2026).

Teach Lemmi voice UI from frontend integration `b27980a` is now deployed on `/participant/conversation`: select/enroll a fictional profile, Start conversation, Play Teach Lemmi, then explicitly Start Teach Lemmi. It reuses the current HttpOnly browser enrollment and same-origin `/v1/device-stream`, with `device.hello.endpoint:'browser'`; no public `/voice-config` or `/voice-stream`, embedded credential, new API or separate session authority. The selected profile/avatar is preserved; session Stop is confirmed before changing surfaces. Guided/Conversational listening is an explicit start opt-in and each turn still requires the server's current grant; Quiet/Pause/mute/Stop/background/reconnect do not automatically capture. AudioWorklet code is bundled; exact five `*-strip.png` avatar files are permitted by the proxy.

Deleted-profile recovery: a checkpoint for an absent database profile returns internal `NOT_FOUND`, retires only that profile's cached authority/work, and closes only its sockets. It never recreates deleted records. Existing changed-revision/epoch/storage failures still stop interaction; no browser receives database exception bodies. This corrects the global 1011 checkpoint failure observed after host-admin rehearsal cleanup. [Current deployment and acceptance](backend-status.md#teach-lemmi-voice-ui-and-checkpoint-recovery--november-14-2026) supersedes earlier local-only voice-loop notes below.

Public photo additions (protocol version 1, browser capability only):

- `device.ready.photoStory?:boolean`; robots receive false and no new activity event stream.
- Owner-only `input.photo.start {}` requires a current ready/waiting session and no teaching/other activity; it displays a reviewed scene without capture or automatic speech.
- Owner-only `input.photo.action {instanceId,expectedRevision,action}` accepts existing typed `photo.*` or `activity.leave`; commands remain session/generation-bound and deduplicated by event ID. `photo.talk` explicitly requests a caption-grounded opening through the shared model/speech path; `photo.skip` emits factual `photo_skipped` plus `photo_selected`. Typed/voice follow-ups reuse existing conversation/audio events. Nothing is inferred as approved biography.
- Owner-only `input.photo.repeat {}` repeats the current retained transient reply through shared speech or text. No durable dialogue retention.
- `activity.changed {activity:ActivityView|null}` broadcasts current safe views only to authenticated browsers in that profile, after its session snapshot; private discussion context is never projected. Starts/actions advance generation and cancel stale local/server output.
- `GET /v1/demo/photo-assets/photo-story-garden|photo-story-park` requires gate + current browser enrollment cookie, current selected scene and matching DB profile/device/epoch/revisions. Other IDs/noncurrent/ended scenes are rejected; fixed SVG map, 64 KiB maximum, SVG content type/no-store/nosniff/sandbox CSP. 401/403 for missing/ended authorization, 404 for unknown/unavailable scene, 409 for changed context, 503 for disabled/unavailable service. No URL credentials, arbitrary file paths, private family photos or public raw SVG/worklet alias.

Public enablement is host-owned and gated by `LEMMI_DEMO_ENROLLMENT=1` plus DB `is_demo`; local rehearsal's private profile/journal operation allowance remains `localOnly` only. Scene policy becomes unavailable when retained preference policy cannot be safely established. Manual controls, unmute-without-capture and Quiet capture-off behavior are unchanged. Public camera/journal/other activities remain unavailable or labeled previews. Actual browser/robot audio acceptance remains separate from automated fixture and actual text/model checks.

**Current prioritized deployment: web/gateway `d3d4337`.** Spoken teaching Next/Not sure/Like/Avoid responses acquire fresh server-owned turn/stream/generation authority after validated transitions, preserving cancellation/deadlines/lease/privacy guards. No new route/schema or firmware command. Source is the narrow server fix from `4690bf6`, not its separate local voice demo/automatic listening client. Existing clients must consume current-generation output; capture still requires explicit Speak now. Sixty-four targeted checks plus type/build passed; public persistent-key/WSS teaching topic switch/Stop passed without microphone/model. [Observed acceptance](backend-status.md#teaching-voice-continuity-deployed--november-14-2026).

**Live presentation update:** `codex/main-ui-alignment` / `a0a3797` is installed in web runtime `eab2c35`. Live profile/dialog and conversation styling now match the reference UI; no new API, proxy allowlist, auth, transport or firmware change. Private profile/journal/excerpt data remain unavailable in the shared fictional setup view. The Photo Story source reconciliation is included but its loopback rehearsal operations/assets are not public and the gateway remains `f5724a0`. Source is published to main and backend-deploy. [Deployment checks](backend-status.md#live-ui-alignment-deployed--november-14-2026).

**Photo Story source integration (local rehearsal only):** `codex/photo-story-conversation` / `9dfc4b6` contributes pure `photo_album` transitions, participant action `photo.skip` and measured event `photo_skipped`. Optional `ConversationTextCommand.purpose` is `photo_opening|photo_repeat`. New typed operations `photoStory.status`, `conversation.text`, `speech.speak/start/chunk/end/receipt/output` are served only by explicitly opted-in loopback `/v1/mock/<operation>`; they are not new public/live APIs. Existing `conversation.submit` and its client remain supported. Rehearsal speech output uses existing queue/receipt schemas with at most four drained chunks; text/speak/end client requests use a 65-second timeout and the opted-in loopback HTTP hop matches it. Local coordinator injection requires `localOnly:true`, Alex profile binding and the reviewed pack/explicit local asset IDs; defaults never enable private operations in a production coordinator. Actual production gateway remains `f5724a0` without those operations. Public `/participant/photo-story`, worklet/SVG assets and mock operations remain blocked; no proxy/API credential change is implied. See [observed source checks and remaining production work](backend-status.md#photo-story-integration-source--november-14-2026).

**Current designed UI deployment (`eab2c35`, gateway `f5724a0` unchanged):** unlocked `GET /` redirects 303 to `/caregiver`. Exact gate-protected HTML routes: `/caregiver`, `/caregiver/settings`, `/caregiver/check-in`, `/caregiver/sign-in`, `/participant`, `/participant/conversation`. Locked page requests redirect 303 to `/access`; these demo pages require `LEMMI_DEMO_ENROLLMENT=1` or return 404. `/caregiver#profiles` uses the designed dashboard and existing typed `/v1/demo/profiles` list/create; `/participant/conversation?profile=PROFILE_ID` uses the designed scene and existing cookie enrollment/WSS/live speech/teaching. The optional profile query contains no credential and does not enroll/start on its own. Private APIs still require independent caregiver authorization. No mock operations were exposed: live profile failures remain failures, camera is unavailable and games are labeled previews. Read-only demo profile panels use only ParticipantProfile, with no private guidance/contact/journal data. Generic banner/game-picture PNGs were added to the explicit static allowlist. See [actual acceptance and remaining limits](backend-status.md#designed-public-ui-integration--november-14-2026). This supersedes earlier current-UI/local-only/root-404 statements below.

**Earlier UI publication merge:** web `733fb1c` merges requested `d8a6fe4`; gateway remains `f5724a0`. UI source/styles/artwork were already included in the preceding integration, so the resolved merge adds publication history/license whitespace without changing runtime interfaces or visuals. Live participant enrollment/transport/Teach Lemmi, access-form repair and local-only caregiver/mock previews are preserved. Web-only build installation/restart and public unlock/participant/profile-list/twenty JS/CSS bundle checks passed; gateway tests in progress were not restarted. [Exact acceptance and limits](backend-status.md#kylie-ui-publication-merge--november-14-2026).

**November 14 browser unlock repair:** web runtime `7ad2de1` now sends `Referrer-Policy: same-origin` on `/access` and `/access/logout` responses. The previous `no-referrer` policy suppressed the Origin of native browser form POSTs to `null`, which the existing strict configured-Origin check rejects. That check remains unchanged: missing/null/foreign origins are denied. Use the same private key; reload `/access` before retrying Unlock, then follow Open participant. Public header/unlock/cookie/participant/profile-list/logout checks passed; the user subsequently confirmed Emilia's Chrome unlock worked. Gateway remains `f5724a0`; no route, credential, profile or device contract changed. See [deployment observations](backend-status.md#browser-unlock-repair--november-14-2026).

**Observed shared-identity WSS conflict:** while the user reported Lukas testing with the shared JSON and Emilia using `stackchan-alex`, a live incomplete upgrade probe for that saved identity returned 409 / `REVISION_CONFLICT` / `Device already connected`; one gateway socket remained established. This is expected duplicate-identity protection, not an expired key. Let the existing client close before reconnecting that identity; use separate enrollment files for concurrent endpoints, with explicit audio handoff on a shared profile. No gateway restart, credential replacement or successful robot connection was part of this check.
**Deployed speech concurrency:** independent gateway STT/TTS admission and native worker pools use matching `LEMMI_SPEECH_STT_WORKERS=2` / `LEMMI_SPEECH_TTS_WORKERS=2`. Private authenticated `/health` reports device/compute/configured/ready workers. No public protocol or ownership expansion. CUDA remains off; see the current release record.

**Selected browser speech:** response/profile-entry update selects 1,000 ms browser silence; earlier release used 1,500 ms. The private service uses `en_US-hfc_female-medium` at 22,050 Hz for all negotiated endpoint playback; firmware endpointing remains a separate integration target. Existing credentials and CPU venv were retained.
**Deployed optional diagnostics (off):** `anay/natural-speech-turns` adds optional `LEMMI_SPEECH_DIAGNOSTICS=1` gateway stage/duration records without content/identifiers. Internal `SpeechAdapters.onTiming` survives scheduling. Browser ending sends existing authorized `audio.end`; no-speech uses existing `input.pause`. HTTP/WSS schemas, access rules and deployed endpoints are unchanged. [Browser configuration, timing definitions and limitations](handoffs/natural-speech-turns.md).

This is the current implementation reference for **Kylie's frontend, Emilia's firmware, Lukas's activities and Anay's speech/services**. Update it whenever a backend-facing route, schema, event, authorization rule, configuration key or availability changes. Runtime schemas/source remain authoritative; a proposed interface is not permission to invent a parallel backend.

**Runtime scope:** the speech pipeline and fixed concern-response correction are deployed in `f5724a0`, including persistent-key and chat/support squash commits `c402edc`/`430269f`. The host now explicitly enables public speech for fictional team testing. The post-install synthetic public turn passed actual local STT → OpenRouter → local TTS (138 input frames / 276 output chunks), with simulated playback receipts; actual browser/physical microphone and speaker acceptance remains pending. See [backend status](backend-status.md).

**Scope:** the user authorized full fictional multi-profile support on November 14. The endpoint integration keeps Alex (`profile-alex`) as the initial profile, permits explicitly created fictional profiles with isolated context/access/sessions, and permits separately enrolled browser/robot endpoints. Existing preview cards remain presentation-only and cannot enroll or borrow live data. The full fictional scope is deployed; actual browser/hardware acceptance remains separate. API examples below use fictional IDs/placeholders and contain no usable credentials. All paths are relative to their stated origin; do not substitute a robot's `127.0.0.1` for the backend host.

**Deployed runtime baseline:** `f5724a0` on `https://lemmi.chaoswarrior.dev`. Host observations, verification scope and remaining limitations are maintained in [backend status](backend-status.md); service commands and private setup are in [host setup](host-setup.md). API implementation and deployment acceptance are tracked separately.

## Frontend/backend integration — deployed

`anay/frontend-backend-integration` reconciles Emilia's published `integration/frontend-backend` at `437f065` with deployed-source checkpoint `7debf9a`. Runtime `f5724a0` now supplies the live participant UI, reviewed Teach Lemmi and browser cancellation fixes. Its source/build and exact generic static asset allowlist are installed, with public speech enabled for fictional team testing. See [Emilia integration handoff and completed backend gate](handoffs/frontend-backend-integration.md#backend-integration-follow-up--november-14-2026).

- `device.ready.teaching:true` advertises executable teaching on this deployed runtime. Owner-only protocol-v1 commands `input.teaching.start|next|not_sure|finish|prefer|avoid` carry `{}` and the current session/generation. Observers may still use authorized Stop/Pause/Help/handoff; they cannot progress another endpoint's teaching. Commands use the existing coordinator, lease, speech scheduler and per-profile deadline sweep.
- `TeachingSnapshot` now includes nullable `topicLabel` and `prompt` (≤80/300 characters), plus its existing entity/presentation/policy fields. Only reviewed eligible topics are shown. Empty/sparse/unknown policy has no unrestricted fallback. The user explicitly approved the three reviewed demo topics Gardening, Beaches and general Banking for live fictional Alex. Other new profiles require their own approved interests. Alex's local mock uses its reviewed demo context; a live database profile is never silently replaced by that mock biography or interest list.
- Reviewed openings are displayed through the current snapshot; negotiated prompt audio uses the existing bounded speech output/receipt path and never opens capture. Explanations reuse `input.text` or granted voice through the existing model adapter. Local mock `conversation.submit` is explicitly asynchronous/scripted (`ConversationReply.source:'scripted'`); it does not make `/v1/live/*` RPC available. Live replies remain `model|fixed`.
- Next/Not sure/Avoid cancel the old prompt/turn. Like/avoidance are session-only, never durable remembered preferences or ability assessment. Teaching has a fifteen-minute server active-time limit, excluding pauses/unavailable waiting; it is swept for every profile. Finish/expiry return capture-off ready when active; finishing while paused preserves pause until explicit Resume. Stop ends the session. No countdown is shown.
- Saving only future conversation support preserves active teaching presentation, authoritative eligibility and approved fixed/prompt output. Explicit apply-now pauses/cancels and refreshes the current teaching invitation using the new effective preset; participant Resume remains explicit. Context-changing writes fence teaching progression/prompt synthesis until reconciliation. Existing Stop/help remain available during SQL waits.
- Browser playback while paused requires matching current `source:'fixed'` text, new turn/lease/generation and unchanged profile/privacy/policy/owner authority. Repeated paused receipt snapshots preserve only that output; local Pause/Stop/background teardown and authority changes cancel it. A paused snapshot alone never grants output. Background pause now suppresses queued text/PCM locally before transport.
- The live entry remains `/access` → `/participant`. `/participant/conversation` and caregiver UI remain local/mock; this work adds no caregiver browser login session or role-switch authorization. Native cookie WSS uses existing `createParticipantSetup` / `ParticipantConnection`; no bearer/admin/provider key enters JS.
- Candidate Nginx adds an explicit allowlist for reviewed generic avatar PNGs, two surface textures and the bundled Nunito TTF; these contain no private participant media. It adds no broad static/private directory alias. Protected uploaded assets keep their existing authorized routes. Proxy configuration must be installed separately at deployment.

All six candidate migrations match the deployed SQL byte-for-byte, including `004_endpoint_revocations.sql`; the obsolete branch `003_device_revocation_receipts.sql` is excluded. No new migration or provider change is needed. Verified on this candidate: 212 Bun tests / 3,991 expectations with all database checks enabled, ten helper/seven speech Python tests, type/build/format and production participant/data/control/speech fixture smokes. No actual browser microphone/autoplay/keyboard recovery, K151, external provider or deployment is claimed.

## Deployed endpoints — frontend and robot contracts

**Deployed:** runtime `17a8522` reconciles `anay/multi-profile-endpoints` (`284dcb7`) with current persistent-key/chat-support code. `LEMMI_DEMO_ENROLLMENT=1`, compatibility migrations and the scoped proxy allowlist are installed. Public fictional setup/concurrent-profile WSS isolation and preservation of the current shared key were verified; full browser interaction/hardware remains unrun. See [backend status](backend-status.md).

The gateway uses one `SessionRegistry` inside the existing gateway, with an existing coordinator per authorized profile. A profile has one active session/audio owner, not a parallel model/session backend. Different profiles can interact independently. Multiple endpoints for one profile can connect, but only the owner submits conversation/media/resume/microphone controls; other assigned endpoints can observe safe state, Stop/Pause/Help, or explicitly request handoff. Session/output state never transfers automatically.

### Fictional demo setup HTTP

These are explicitly enabled **fictional demo** routes, protected by the independent outer access key/cookie and current configured caregiver assignment. They do not turn a participant key into a caregiver credential. Caregiver biography/support/asset edits still require verified caregiver Bearer identity and database membership. The demo selector cannot access contacts, private guidance, journals or camera consent.

| Method / path | Body / transport | Safe result |
| --- | --- | --- |
| `GET /v1/demo/profiles` | Private gate | Participant-safe profiles assigned to the configured caregiver and marked `is_demo` |
| `POST /v1/demo/profiles` | `{preferredName,avatarId?}` | New fictional `ParticipantProfile`, distinct generated ID and empty context |
| `POST /v1/demo/enroll` | `{profileId,endpoint:'browser'|'robot'}` | Browser: safe endpoint metadata and HttpOnly cookie. Robot: scoped credential returned once with metadata |
| `GET /v1/demo/current` | Browser endpoint cookie | Current safe endpoint/profile metadata |
| `POST /v1/demo/release` | `{}` and browser endpoint cookie | `{released:true}` and cookie removal/revocation |

All use the existing Result envelope and `Cache-Control: no-store`. Mutation requests require the exact configured Origin; native provisioning may use the private access-key header. Reject query credentials, caller-supplied actors, preview IDs, foreign profiles and unsupported endpoint kinds. Browser `__Host-lemmi_endpoint` cookies are Secure/HttpOnly/SameSite=Strict; enrollment lasts 30 days. No browser JavaScript bearer token is returned. The separately signed `/access` cookie remains the outer gate. `POST /internal/demo` is the independently authenticated SvelteKit → gateway seam and must never be proxied publicly.

### Frontend quickstart

Open `/access`, unlock, then `/participant`. Import `createParticipantSetup` and `ParticipantConnection` from `@lemmi/contracts`. Use `profiles()`/`create(name)`/`current()`/`enroll(profileId)`/`release()` for setup; use `ParticipantConnection` for existing validated protocol-v1 WSS events and controls. The client uses same-origin cookies, maintains sequence/heartbeat and one transient current snapshot, rejects stale connection events and exposes `close()` for local teardown. Do not add a second session store or embed device/admin/provider secrets in browser code.

One cookie context identifies one browser endpoint. Independent test participants need separate browser profiles/contexts, not extra tabs sharing a cookie. Before changing profile, cancel local capture/playback, close the old socket, release the enrollment and clear the old projection. New profiles must not copy Alex's biography/context. Handle 401 by unlocking/re-enrolling explicitly; handle 403 as scope/origin rejection, 409 as connection/state conflict and 503 as unavailable/disabled/busy, never as permission to fall back to mock success.

### Robot quickstart and existing persistent keys

Native fictional setup can run `bun run enroll-device profile-alex .data/alex-robot.json` (or the new profile ID and a different private file). This returns a **separate** robot identity with finite 30-day expiry and reuses the saved file later. Each physical robot/test endpoint needs its own enrollment/device ID for independent concurrent connections. Provision/save it privately, including the selected origin/profile, and reconnect with `X-Lemmi-Access-Key` plus `Authorization: Bearer <credential>`; TLS verification stays enabled. Browser endpoint cookies and robot tokens are not interchangeable.

The existing `pair-stackchan.py` flow remains available for the assigned legacy `stackchan-alex` endpoint and its indefinite persistent key. Persistent claim/ready expiry is `null`; do not interpret it as expired. Finite timestamps retain their meaning. An existing shared key represents one endpoint, so sharing that key does **not** create multiple independent WSS reservations. The upgrade preserved the current persistent hash/revocation history without rotating or shortening it. Endpoint enrollment adds no raw-key recovery endpoint.

### Handoff and ownership

`SessionSnapshot.activeEndpointId` identifies the owner; `endpoint` remains browser/robot. `device.hello.payload.endpoint` is optional for legacy robot clients and must match authenticated enrollment if supplied. Send `input.handoff` with `{}` plus the current session/generation; it cancels old work, pauses, rotates the lease and assigns the caller as owner. Wait for the authoritative new state, then require explicit participant Resume to capture-off ready. Handoff/Resume never grants capture. Only the submitting/owning endpoint receives its text/PCM output. Observer disconnect/revoke must not pause the owner; owner disconnect/watchdog pauses that profile and owner revocation ends its session.

Each device has one atomic connection reservation; duplicate connections for the same identity conflict. Existing frame/control/rate/deadline/receipt and generation/lease/revision rules below continue to apply per endpoint/profile. Shared private STT/TTS adapters use a bounded FIFO with eight waiting jobs; cancellation removes queued work for that participant only, and overload fails explicitly without a provider fallback.

### Migration and acceptance boundary

Retain applied `001_foundation.sql`, `002_media_collections.sql`, `003_communication_support.sql` and `003_persistent_device_credentials.sql` unchanged. Add `002_multi_profile_endpoints.sql` for demo flags/device kinds/gateway epoch and the reconciled `004_endpoint_revocations.sql` to preserve the existing revoke history while adding device scope. Do **not** apply the branch's conflicting `003_device_revocation_receipts.sql` over the existing table. Apply only the tested normal migration set after backup; no full SQL proposal or profile reseed is required for the upgrade.

The runtime bounds profile/endpoint/session work and supplies fixtures, but hardware audio, browser permission/autoplay, keyboard/zoom/error recovery, human speech quality, firmware storage and venue/reboot acceptance remain separate checks. Public voice is explicitly enabled on this host; clients must still negotiate audio and obtain a fresh capture grant. See the [remote voice test](handoffs/remote-voice-test.md). Teach Lemmi is integrated in the candidate described above but **not yet deployed**; send teaching commands only when the running gateway advertises `device.ready.teaching:true`. See the [endpoint handoff](handoffs/anay-multi-profile-endpoints.md) and [backend status](backend-status.md) for actual acceptance.

## 1. Availability and ownership

**Deployed chat/support increment:** `anay/chat-support-hardening` added the caregiver support GET/apply routes below and English chat hardening on top of speech `151ebc3`, now including fix `3fb561d` and main `a6f7ff9`. It is included in the deployed runtime recorded above. See [integration/hardening handoff](handoffs/anay-chat-support-hardening.md).

| Surface | Current availability | Integration consumer |
| --- | --- | --- |
| Local mock HTTP RPC | Implemented; loopback-only, bounded in-memory state, no actual media/contact | Kylie/Lukas development, computer smoke tests |
| Scoped device pairing/claim/revoke HTTP | Implemented; real VoidAuth setup/introspection and public claim verified on deployed host. Public caregiver-bearer pairing/revoke requests have not been exercised in the live rehearsal | Kylie caregiver setup; Emilia provisioning |
| Authenticated device WSS | Controls/text plus opt-in capture/audio output implemented in deployed code; public speech enabled for fictional team testing; physical K151 integration pending | Emilia; computer control harness |
| OpenRouter chat | Deployed text greeting/public WSS passed; the original feature branch also passed a real isolated 20-turn synthetic voice rehearsal (not repeated as deployment acceptance). Broader conversational/human quality remains unverified | Anay server only |
| Local STT/TTS | Private wrapper/adapters implemented; English CPU synthetic checks including a repeated voice run passed locally, but host/human quality remains imperfect | Anay server only |
| Robot/browser microphone → STT → chat → TTS → playback | Backend capture/STT/chat/TTS/PCM output implemented opt-in and tested with synthetic input/simulated receipts; actual hardware/browser flow pending | Anay + Emilia + Kylie |
| Photos/guessing/matching | State/pack/action/view/context/event contracts and fixtures exist; three reducers/catalog hosting remain unavailable | Lukas logic; Kylie rendering; Anay host |
| Camera/health/teaching/preferences | Deployed teaching remains unavailable; candidate teaching is implemented as above. Camera/health/preferences remain preliminary/unavailable | All four owners at their assigned boundaries |
| Production profile/assets REST | PostgreSQL mode enabled on deployed host; scoped participant profile verified live. Caregiver edit/media checks used production fixture smokes; exact routes/limits below | Kylie; Anay data backend |
| Journal/contact/overview REST | Still planned; no complete review/notification workflow | Kylie; Anay implements |
| Database / durable jobs / real notifications | PostgreSQL/profile/media/device/session checkpoints implemented optionally; durable jobs and real notifications remain unimplemented | Anay |

Anay edits canonical backend/contracts. Kylie renders safe projections and submits typed actions; Lukas supplies pure reducers/content; Emilia enforces local controls and consumes the shared wire protocol. The app, gateway, worker and speech wrappers do not create independent session authorities. Relevant details: [integration contracts](integration-contracts.md), [activity handoff](handoffs/anay-activity-contracts.md), [control handoff](handoffs/anay-control-foundation.md), [speech/chat handoff](handoffs/anay-speech-chat.md).

### A18/A19 profile/private-media increment

**Deployed media schema:** migration `002_media_collections.sql` is applied on the host. It adds stable, scoped album/photo and playlist/track metadata only. No new HTTP/client/catalog authorization surface is enabled; collection CRUD and reviewed-pack hosting remain A05. Journal/consent/contact/jobs/deletion/camera portions of the full draft remain inactive proposals. See [review](handoffs/anay-app-data-schema-review.md), [database setup](../db/README.md) and [deployment acceptance](backend-status.md).

[Database/profile/assets handoff](handoffs/anay-database-profile-assets.md) and [database setup](../db/README.md) define the current exact fields, permissions, format limits and restart behavior. PostgreSQL is opt-in via private `LEMMI_DATABASE_URL`/`LEMMI_PRIVATE_MEDIA_DIR` plus the configured caregiver subject. `bun run db:migrate` / `db:bootstrap` prepare only fictional Alex. One gateway owns the database; boot checks reject stale writes. Credential hashes and bounded session/factual-event checkpoints are persisted; restart ends old sessions and pairing codes; credential retention follows the explicit lifetime/persistence rules below. Full contact/policy/journal/deletion workflows remain pending despite schema foundations.

Public additions: caregiver GET/PATCH `/v1/profiles/:id`, POST `/v1/profiles/:id/photos` or `/assets`, GET `/v1/profiles/:id/assets/:assetId`; paired-device GET `/v1/participant/profiles/:id`, `/v1/assets/:assetId`, `/v1/assets/:assetId/metadata`. All reject example/unassigned scope, verify credentials server-side and disable caching. Device tokens never go to managed-identity introspection. Private `POST /internal/data` is solely the authenticated SvelteKit → existing gateway adapter, never a public route. Proxy only the new explicit resource paths and keep internal routes/services private.

Set production `BODY_SIZE_LIMIT=29M` and upload-proxy limits; handlers still bound profile JSON to 32 KiB, device control to 4 KiB and asset JSON to 28 MiB. Supported media is plain RGB/RGBA PNG (5 MiB/4096 dimensions/8 million pixels) or metadata-free PCM16 WAV (20 MiB/5 minutes); JPEG/SVG/MP3/range support is unavailable. Upload only approved static assets, not microphone/camera/generated-speech data. Authorized byte reads return actual media; metadata excludes storage paths and private discussion context. Caregiver context-changing edits cancel/pause the current session before COMMIT; support-only saves preserve its effective preset. Approved biography facts remain caregiver-provided; remembering/excerpt enablement is rejected pending its own workflows.

### Communication support — preserved implementation

Caregiver-only routes require the same outer private gate plus verified assigned caregiver Bearer token as profile edits. Responses use `Result<T>`, `Cache-Control: no-store`, same-origin checks and assigned profile scope. The deployed handlers use each assigned profile ID and preserve caregiver membership and revision checks. Device credentials grant no caregiver access.

| Method/path | Client / input | Result data |
| --- | --- | --- |
| `GET /v1/profiles/:profileId/communication-support` | `clients.profile.support({profileId})` | `CommunicationSupportState`: `{profileId,profileRevision,saved,session}`; active session is null after end/restart |
| Existing `PATCH /v1/profiles/:profileId` | `clients.profile.update` with `patch.communicationSupport: {preset,configVersion:1}` | Updated profile default; current session remains on its effective preset |
| `POST /v1/profiles/:profileId/communication-support/apply` | `clients.profile.applySupport({profileId,expectedProfileRevision,sessionId,expectedGeneration,commandId})` | Paused `SessionSnapshot` using the saved preset; explicit participant Resume required |

Read the saved/default and active effective values from the GET; use its profile revision and session generation for apply. The apply request cannot supply a preset/actor, revive an ended session or silently resume. Retries are idempotent only while the same paused generation is current; after Resume/new generation they conflict rather than pausing again. Old capture/model/TTS/queued playback is canceled immediately, including before a slow checkpoint completes. Profile configuration operations are serialized with at most 32 pending requests; overflow fails explicitly. Failed writes keep interaction paused. Unknown profile COMMIT outcomes are reconciled through an authorized read; if reconciliation fails, continuation stays disabled until gateway restart after database recovery. These configuration changes cannot alter privacy, avatar, language/voice or help rules. Static `communicationSupportPreviews` and `resolveCommunicationSupport` are exported from `@lemmi/contracts`; samples never invoke model/audio work.

Conversational/Guided/Quiet model reply bounds are 600/360/240 characters and 1/1/0 questions. Fixed safety/help wording can exceed ordinary style limits. Reviewed English sensitive/unclear routes bypass the model; other semantic grounding remains model-dependent. Failures/malformed replies remain explicit, sanitized, and are not automatically retried. The final bounded live English GLM check passed 15 turns; human semantic, German and hardware acceptance remain incomplete. Migrate `003_communication_support.sql` and update the host proxy allowlist before exposing these feature routes; full details and provenance are in the [handoff](handoffs/anay-chat-support-hardening.md).

### Profile/media HTTP route inventory

These routes are enabled on the current deployment and require the outer access key/cookie **and** the stated Bearer credential. Profile paths accept an explicitly assigned `:profileId` with the same asset authorization; asset IDs are UUIDs scoped and authorized by the backend. `assets`/`photos` accept validated JSON with bounded base64 data, not multipart uploads. Use the shared schemas for exact bodies.

| Method / URL | Bearer identity | Result |
| --- | --- | --- |
| `GET /v1/profiles/:profileId` | Assigned caregiver | `ProfileDetail` |
| `PATCH /v1/profiles/:profileId` | Assigned caregiver | Revision/command-checked update → `ProfileDetail` |
| `POST /v1/profiles/:profileId/photos` | Assigned caregiver | Approved PNG upload → `AssetMetadata` |
| `POST /v1/profiles/:profileId/assets` | Assigned caregiver | Approved PNG/PCM WAV upload → `AssetMetadata` |
| `GET /v1/profiles/:profileId/assets/:assetId` | Assigned caregiver | Authorized media bytes |
| `GET /v1/participant/profiles/:profileId` | Paired device | Safe `ParticipantProfile` |
| `GET /v1/assets/:assetId` | Paired device | Authorized media bytes |
| `GET /v1/assets/:assetId/metadata` | Paired device | Safe `AssetMetadata` |

Profile/metadata/upload successes use the common `Result<T>` envelope; successful media reads return binary bytes. Do not parse binary media responses as JSON. No photo list, arbitrary storage path, external asset URL or profile creation/deletion route follows from this table.

## 2. Origins, processes and credentials

Deployment tracking branch: `backend-deploy`. See [new-machine deployment and Cloudflare routing](backend-deploy.md) for setup, exposed paths, restart behavior and host acceptance checks. The current host has a configured, supervised Cloudflare Tunnel and loopback proxy. Templates are tracked under `deploy/`; private tunnel credentials/configuration remain host-local and are not provisioned automatically by a checkout.

| Process/origin | Default / exposure | Credential |
| --- | --- | --- |
| Mock SvelteKit development app | `http://127.0.0.1:5173`; local only | Explicit mock convention; no caregiver security boundary |
| Gateway, either mock or live mode | `127.0.0.1:3001`, configurable `GATEWAY_PORT` | Mock token **or** live internal/device credential, selected by startup mode |
| Built SvelteKit app | Run `HOST=127.0.0.1 PORT=3000 bun run start:web` after build | Live resource handlers independently verify authorization |
| Live public/LAN origin | Current `https://lemmi.chaoswarrior.dev`; other hosts explicitly set `LEMMI_PUBLIC_ORIGIN`; proxy only supported routes | Outer access key/cookie plus caregiver Bearer for pair/revoke/profile edits, or scoped device Bearer for claim-following participant resources/WSS; claim itself uses its pairing code |
| Local speech wrapper | `http://127.0.0.1:8765`; **never expose to robot/browser** | Independent `LEMMI_SPEECH_TOKEN` |
| OpenRouter | Fixed `https://openrouter.ai/api/v1/chat/completions` outbound server request | Private `OPENROUTER_API_KEY`, never sent to a client/model context |

`LEMMI_MODE` defaults to `mock`. `bun run dev` deliberately launches the local mock. For configured live mode, start web/gateway separately using the existing scripts; see [deployment instructions](handoffs/anay-control-foundation.md#runconfigure). The live gateway does not also run a mock coordinator.

The trusted same-host HTTPS/WSS proxy must overwrite Host to the configured public host and `X-Forwarded-Proto: https`; backend ports stay loopback-only. The web adapter uses explicit `ORIGIN` matching `LEMMI_PUBLIC_ORIGIN`; leave forwarded-address overrides unset for the current trusted-peer checks. Proxy `/v1/device-stream` to the gateway and the implemented access, device and profile/asset resource routes to SvelteKit; see the allowlist in `deploy/nginx.conf.template`. Reject `/internal/*`, mock RPC/pages and other unfinished routes externally. Certificate chain, hostname/IP and validity verification remain enabled on clients; the deployed host now resolves its public hostname normally (the initial DNS failure has cleared). A plain LAN WebSocket with the development mock token is not the live interface.

Credentials are **not interchangeable**:

- Caregiver: externally verified short-lived Bearer access token with assigned subject. Current verifier uses configured HTTPS token introspection, issuer/configured audience-or-client binding/Bearer/expiry checks and the single `LEMMI_CAREGIVER_SUBJECT` assignment. Actual VoidAuth issuance/introspection passed the one-time setup; production browser login UI remains pending.
- Device: random expiring bearer credential returned once after pairing and local confirmation. Scope is derived server-side; no caller-selected profile/role grants access.
- Internal control: separate `LEMMI_CONTROL_TOKEN`, at least 32 characters and not the mock token. Only SvelteKit→gateway; never firmware/browser.
- Speech: independent service credential shared only by trusted backend/engine wrapper.
- Mock: `LEMMI_MOCK_TOKEN` defaults to `local-mock-only`; development convention, not pairing/authentication for real users/data.

No tokens, pairing codes, private media, provider errors, prompts or contact destinations belong in query strings/logs/source/fixtures. Pairing codes and active authority remain transient. With database mode, credential hashes and factual/session checkpoints persist, and startup ends interrupted sessions. Explicit persistent keys retain their lifetime across restart; the endpoint candidate also retains unexpired 30-day demo enrollment. Reconnect still requires a fresh hello and explicit Start, never restored capture/output. Complete journal/deletion workflows remain pending.

### Explicit VoidAuth token binding

`LEMMI_AUTH_TOKEN_BINDING` defaults to `audience`, preserving the required `LEMMI_AUTH_AUDIENCE` check. For VoidAuth non-resource access tokens, explicitly select `client_id`; `client_id` must then equal the dedicated configured `LEMMI_AUTH_CLIENT_ID`. Missing/foreign clients are rejected. A present `aud` still must match `LEMMI_AUTH_AUDIENCE`; it is never ignored. Issuer, active status, Bearer type, one-hour expiry bound and configured caregiver subject checks remain enforced in both modes. This is a provider-specific integration choice, not automatic fallback or JWT-only verification. The loopback-only `scripts/setup-caregiver.ts --assign-alex` helper obtains the actual subject using an explicitly authorized one-time code/PKCE login; see [host setup](host-setup.md). Production browser login UI remains pending.

### Private gateway routes — never proxy externally

| Route | Credential / input | Availability |
| --- | --- | --- |
| `POST /internal/mock/<operation>` | Loopback peer/Host/Origin plus mock bearer token; operation's JSON input | Mock gateway only; delegates to the same mock authority |
| `GET /health` on mock gateway | Same loopback/mock-token checks | `{mode:'mock',speech:false,camera:false,notifications:false}`; no live readiness implication |
| `POST /internal/control/pair` | Loopback plus independent internal token; `{actor,input:PairDeviceInput}` | Live control gateway only; SvelteKit derives actor from the verified caregiver, never trusts a browser-supplied actor |
| `POST /internal/control/claim` | Same internal token; `ClaimDeviceInput` | Live control gateway only |
| `POST /internal/control/revoke` | Same internal token; `{actor,input:RevokeDeviceInput}` | Live control gateway only |
| `POST /internal/data` | Loopback plus independent internal token; operation and server-derived caregiver actor or scoped device credential | Live PostgreSQL-backed data adapter; never a client-facing URL |

The current live gateway has no equivalent public health/readiness HTTP route. Missing/unconfigured services must be reported honestly; do not use mock health as production readiness or put an internal token into a device/browser to inspect it.

### Private domain access gate (deployment branch)

Set `LEMMI_ACCESS_KEY` (independent 32–256 visible characters) on web/gateway. Live process configuration requires the key and fails closed if it is missing, invalid or reused; local mock mode needs no key. With it enabled, all implemented live public API/WSS paths require either `X-Lemmi-Access-Key` or a signed browser cookie. Existing caregiver introspection, paired device Bearer authorization and internal server token checks remain separate; the key alone grants no role/resource authority. The current mock pages remain loopback-only.

| Route / credential | Behavior |
| --- | --- |
| `GET /access` | Public HTML unlock form; no private data or key in response; no-store/CSP/referrer protections |
| `POST /access` | Same-origin `application/x-www-form-urlencoded` body `{key}` ≤4 KiB; success sets eight-hour `__Host-lemmi_access` signed Secure/HttpOnly/SameSite=Strict cookie; wrong key 401, bad origin/query 403, malformed body 400, wrong type 415, global 20/minute limit 429 |
| `POST /access/logout` | Same-origin only, clears current browser cookie; does not revoke other browser cookies |
| Device/provisioning header | `X-Lemmi-Access-Key: <private key>`; WSS still requires `Authorization: Bearer <paired credential>` |

Browser same-origin clients carry cookies; never bundle the shared key. The computer harness reads private `LEMMI_ACCESS_KEY`. Public domain/gate cookie exchange/logout and computer WSS checks passed. Actual firmware header support and full production browser sign-in remain pending. Rotate the key and restart both processes to revoke gate cookies and active connections. No key is accepted in query strings. Cloudflare Access is optional and not required by this chosen gate. Self-hosted OIDC caregiver integration still requires compatible RFC 7662 introspection; a generic OIDC/JWKS adapter or sign-in UI is not implemented here.

## 3. Common contracts and error handling

Import environment-neutral schemas/types from `@lemmi/contracts`; fixtures from `@lemmi/contracts/fixtures`. Do not import `@lemmi/server` into frontend components or firmware. Most object schemas are strict: injected/unknown fields fail validation. IDs are 1–100 characters; revisions/generations are nonnegative integers. Server scope checks apply in addition to shape validation.

HTTP service operations use:

```ts
type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ErrorCode; message: string } };
```

| Error code | Meaning / caller behavior | Live resource HTTP status |
| --- | --- | --- |
| `UNAUTHORIZED` | Missing/invalid/expired credential; authenticate/re-pair explicitly | 401 |
| `FORBIDDEN` | Wrong profile/device/subject/origin/scope; do not retry with invented IDs | 403 |
| `REVISION_CONFLICT` | Stale snapshot or command-ID/body reuse; refresh and reconcile | 409 |
| `UNAVAILABLE` | Unconfigured/down/unsupported/canceled/busy service; no silent mock/provider fallback | 503 |
| `NOT_FOUND` | Unknown assigned resource/operation | 404 |
| `VALIDATION_ERROR` | Invalid shape/limits/state | 400 |
| `SAVE_FAILED` | Typed seam for failed durable save; not evidence that persistence exists | 400 in current control-response helper; final domain mapping pending |

Resource handlers can also return 405 (unsupported HTTP method) and WSS upgrade checks 426. Hooks/proxy/upgrade failures may have plain or empty bodies; handle non-JSON responses as transport failure. Mock gateway RPC maps `NOT_FOUND` and most other failures to 400, unlike the live resource helper; request-size middleware may return 413. Prefer parsed stable Result/error codes where present over assuming every transport uses identical status mapping. No `REVISION_CONFLICT` error currently contains a full snapshot: fetch/consume the next safe snapshot; richer conflict responses remain planned.

Retry identity is currently **body `commandId`**, scoped by operation, not an implemented `Idempotency-Key` header. Same ID/different body conflicts. This differs from the planned production REST specification. Copying a failed live call into a mock call is never an accepted retry.

## 4. Frontend client and current HTTP operation catalog

```ts
import { createClients, createHttpTransport } from '@lemmi/contracts';
const clients = createClients(createHttpTransport('mock'));
```

Mock clients POST JSON to `/v1/mock/<operation>` on SvelteKit, which authenticates its loopback gateway proxy. Both processes must run. The mock app checks actual loopback peer/Host and same Origin when present; it supplies no real caregiver permissions. The proxy and gateway bound request bodies to 32 KiB; client request timeout is five seconds, proxy gateway timeout three seconds. Default mock clients never contact providers.

`createHttpTransport('live', authenticatedFetcher)` maps `device.pair/claim/revoke`, safe paired `profile.load`, caregiver `profile.detail/update`, and `assets.create/metadata` to implemented resource URLs. The fetcher must attach the correct caregiver token for pair/revoke; there is no built-in login/cookie token store. Other operations POST `/v1/live/<operation>` and are explicitly unavailable, even if their input/output types exist.

The following table covers every current `operations` entry in [services.ts](../packages/contracts/src/services.ts). The input notation is field names, not an additional schema; use inferred `OperationInput<K>`/`OperationOutput<K>` for exact types.

| Operation | Input fields | Output | Mock behavior / live availability |
| --- | --- | --- | --- |
| `device.pair` | `deviceId, profileId, commandId` | Pairing ID/code/expiry | Mock unavailable; live resource below |
| `device.claim` | `pairingId, code, localConfirmed:true` | Assigned IDs/credential/expiry | Mock unavailable; live resource below |
| `device.revoke` | `deviceId, commandId` | `{revoked:true}` | Mock unavailable; live resource below |
| `profile.load` | `profileId` | `ParticipantProfile` | Safe mock projection; live paired-device GET `/v1/participant/profiles/:id` |
| `profile.detail` | `profileId` | `ProfileDetail` | Mock unavailable; live managed-caregiver GET `/v1/profiles/:id` |
| `profile.update` | `profileId,commandId,expectedRevision,patch` | `ProfileDetail` | Mock unavailable; live managed-caregiver PATCH `/v1/profiles/:id` |
| `assets.create` | `AssetCreate` (bounded base64/approved provenance/tags) | `AssetMetadata` | Mock unavailable; caregiver POST `/v1/profiles/:id/assets` (PNG/PCM WAV only) |
| `assets.metadata` | `assetId` (UUID) | `AssetMetadata` | Mock unavailable; paired-device GET `/v1/assets/:id/metadata` |
| `profile.loadCaregiver` | `profileId` | `CaregiverProfile` | Private fictional mock projection; live auth/API pending |
| `profile.save` | `profile, expectedRevision` | `CaregiverProfile` | Mock revision-checked update; cannot enable remembering/excerpts |
| `profile.previews` | `{}` | Preview profile array | Static `Example profile — preview only` cards; no live operations |
| `session.start` | `profileId, commandId, endpoint` | `SessionSnapshot` | Starts mock session; live start currently WSS only |
| `session.get` | `sessionId` | `SessionSnapshot` | Reads current mock session; live browser read seam pending |
| `session.command` | `SessionCommand` below | `SessionSnapshot` | Mock controls/handoff; speak/turn_end/teaching unavailable; live controls WSS below |
| `activities.list` | `profileId` | `{activityId,packId,packVersion,implemented}[]` | Four mock catalog entries; only music implemented; live catalog pending |
| `activities.start` | `sessionId,commandId,activityId,packId,packVersion` | `ActivityView` | Only `music_playlist` / `music-demo` / version 1; no real playback |
| `activities.view` | `sessionId,instanceId` | `ActivityView` | Current mock music view; other reducers/live host pending |
| `activities.submit` | `ActivityCommand` below | `ActivityView` | Revision/dedup checked music transition; no media effect execution |
| `help.create` | `profileId,commandId,mode:'simulation'|'real'` | `HelpSnapshot` | Simulation only; pauses session. Real contact explicitly unavailable |
| `help.status` | `requestId` | `HelpSnapshot` | Current simulated request only |
| `help.acknowledge` | `requestId` | `HelpSnapshot` | Simulated acknowledgment only; no provider/human arrival evidence |
| `help.cancel` | `requestId` | `HelpSnapshot` | Cancels simulation; session Stop alone does not cancel it |
| `preferences.load` | `profileId` | `PreferencesSnapshot` | Empty mock policy, remembering off |
| `preferences.update` | `profileId,expectedRevision,rememberingEnabled` | `PreferencesSnapshot` | Unavailable |
| `preferences.forget` | `profileId` | `{applied:boolean}` | Unavailable |
| `preferences.signal` | `PreferenceSignal` | `{applied:boolean}` | Unavailable; presentation-bound live policy validation/persistence pending |
| `journal.load` | `profileId` | `Journal` | Bounded measured mock events; `summary:null` |
| `journal.observe` | `sessionId,text` | `{applied:boolean}` | Unavailable; no observation write occurs |
| `journal.editSummary` | `summaryId,expectedRevision,text` | `{applied:boolean}` | Unavailable |
| `journal.removeSummary` | `summaryId,expectedRevision` | `{applied:boolean}` | Unavailable |
| `journal.reviewSummary` | `summaryId,expectedRevision` | `{applied:boolean}` | Unavailable |
| `assets.resolve` | `profileId,assetId` | `AssetManifest` | Unavailable; no scoped asset bytes/stream implemented |
| `checkIn.status` | `profileId` | `CheckInSnapshot` | Default-off fictional snapshot only |
| `checkIn.request` | `profileId,deviceId,commandId` | `CheckInSnapshot` | Unavailable |
| `checkIn.end` | `checkInId,commandId` | `CheckInSnapshot` | Unavailable |
| `overview.load` | `profileId` | `{profile,previews,mode:'mock',readiness:'not_configured'}` | Mock cards only; production source highlights/intervals pending |

`clients.session.subscribe`, `clients.activities.subscribe`, `clients.checkIn.subscribe` return an unsubscribe function. They currently **poll the same operation**, initially immediately then about every second, without overlapping requests. They are not a production event stream; expose failure states and unsubscribe on teardown. `createFixtureTransport` requires explicit configured scenarios and validates success shapes; missing fixtures return UNAVAILABLE, not fabricated success. Fictional packs and `approved:true` discriminator examples are not reviewed media readiness.

## 5. Live enrollment, claim and revocation HTTP

**Deployed persistent enrollment:** migration `003_persistent_device_credentials.sql` is installed on this host. PostgreSQL-backed persistent keys are available through the existing routes below; see [persistent-key handoff](handoffs/anay-persistent-device-credentials.md) and [current acceptance](backend-status.md).

All are SvelteKit handlers on the configured HTTPS origin; JSON requests/responses ≤4 KiB and `Cache-Control:no-store`. Same Origin is checked when supplied; no URL query credentials. Mutations require POST; GET/link previews do not perform them. All three routes also require `X-Lemmi-Access-Key` or the signed access cookie. Include `Content-Type: application/json`; any supplied `Origin` must exactly match the configured public origin.

| Method / URL | Authorization | Request body | Success `data` |
| --- | --- | --- | --- |
| `POST /v1/devices/stackchan-alex/pairings` | Assigned caregiver managed access token | `{deviceId:'stackchan-alex',profileId:'profile-alex',commandId,credentialMode?:'persistent'}` | `{pairingId,deviceId,profileId,code,expiresAt}` |
| `POST /v1/device-pairings/claim` | Possession of pending secret pairing code, plus firmware local confirmation | `{pairingId,code,localConfirmed:true}` | `{deviceId,profileId,credential,expiresAt}` |
| `POST /v1/devices/stackchan-alex/revoke` | Assigned caregiver managed access token | `{deviceId:'stackchan-alex',commandId}` | `{revoked:true}` |

Actual route pattern is `/v1/devices/[deviceId]/[action]`, but only Alex's configured device is assigned. Route/body device IDs must match. Unknown example/unassigned profile/device IDs fail scope checks. Use the separate fictional demo enrollment routes above for independently assigned additional profiles/endpoints; this legacy pairing flow is not a profile-creation bypass.

The 24-character random code lasts five minutes and is single-use. Repeat pair ID/body returns the same still-pending code; after expiry/claim/revoke use a fresh command ID. Only one pending pairing/device credential is allowed; revoke before replacement. Claim returns the random device credential **once**. By default it is valid for one hour. With caregiver-selected `credentialMode:'persistent'` in the pairing request, a database-backed gateway issues a key valid until revoked and returns `expiresAt:null`. Non-database gateways reject persistent enrollment with UNAVAILABLE; claim cannot select or upgrade its mode. Existing credentials are never silently upgraded. A lost successful response cannot retrieve it again: revoke/re-pair explicitly. Claims are globally limited to 20/minute for this demo. `localConfirmed:true` is a firmware contract, not cryptographic proof of a physical button press or consent to microphone/camera access.

Revocation clears pending enrollment/current credential, ends the session and closes an existing socket. Replaying an old revoke command cannot revoke a new pairing. In-memory pairing/revoke command history is bounded to 256. Database revocation receipts also persist across restart (at most 256/profile), so an old revoke retry cannot revoke a replacement key after reboot. New pairings fail at receipt capacity while revocation stays available; restart does not clear durable receipts. Profile deletion cascades these receipts. A storage failure is explicit and does not claim durable revocation. Gateway restart clears pending codes and short-lived credentials, ends sessions and invalidates capture/output. It retains only explicitly persistent credential hashes and restores them under the new gateway boot owner. Device reconnect never authorizes capture, playback or session continuation. `device.ready.credentialExpiresAt` is nullable for persistent keys; all existing timestamp responses remain valid.

**Database ownership fence (`04d050e`):** pairing checks that the device row belongs to the current gateway boot; a stale authority returns `UNAVAILABLE`. Claim writes only when the row still has that same boot marker and never assigns/replaces ownership itself. If persistence/ownership checks fail, no usable credential is returned; explicitly re-pair against the current gateway. Regression coverage verifies stale claim/pair/revoke rejection, preservation of the replacement marker/key, and successful authentication by the current authority. Enrollment/revocation lock current profile membership and boot ownership; claim rechecks the enrolling caregiver assignment before committing.

**Path difference from the draft:** technical-spec's `/v1/devices/pair` and `DELETE /v1/devices/:id/pairing` are proposed older route names, not implemented aliases. Use the three POST routes above until the shared specs/consumers are deliberately migrated.

### Python pairing helper and team access file

Run `python3 scripts/pair-stackchan.py` (Python 3.10+, standard library only). It reads the private root `.env` plus environment overrides, performs caregiver VoidAuth code/PKCE login through the registered loopback callback, requests persistent enrollment by default, and **claims it on this computer**. It saves one mode-0600 file at ignored `.data/stackchan-access.json`. The helper's local claim creates a computer/team-test device credential; it does not prove physical robot confirmation or authorize mic/camera capture.

Send that file privately to authorized teammates. It contains `backendUrl`, `websocketUrl`, `deviceId`, `profileId`, reusable `credential`, `expiresAt`, and ready-to-use `headers` (`Authorization: Bearer ...` and `X-Lemmi-Access-Key`). It deliberately excludes caregiver tokens, OIDC secrets, provider credentials, internal control tokens and consumed pairing codes. Clients attach the supplied headers to device HTTPS requests and the WSS upgrade. This is Alex-scoped device access, not caregiver/admin authorization. The file identifies one endpoint; with these endpoints, two simultaneous connections reusing that same identity conflict. Enroll separate identities for independently connected clients.

The output file is reserved exclusively before sign-in/enrollment; existing files are never overwritten. If it already exists, reuse it rather than enrolling again. `--output PATH` selects a different protected destination. `--pair-only` preserves the original robot-side workflow by printing an unclaimed five-minute pairing ID/code instead of claiming/saving a credential. `--short-lived` requests the original one-hour key; `--persistent` is an explicit alias for the default. `--token` prompts privately for an existing caregiver token; `--env-file PATH` selects another settings file. No automatic revocation, provider retry or key recovery is performed. If a successful claim response is lost, explicitly revoke/re-enroll. Never commit or paste the access file into logs/chat.

The browser's callback message confirms only authorization-code receipt; terminal success confirms credential creation. A browser on another machine needs SSH forwarding of local port 3333 to the helper's loopback port. Safe diagnostics distinguish token exchange and pairing/claim HTTP errors without printing provider bodies. Basic literal/quoted dotenv values are supported without variable expansion.

Ten Python fixture tests pass, including state/PKCE, mode flags, HTTP redaction, scoped claim headers, mode-0600 bundle storage, exclusion of caregiver/provider data, overwrite refusal before login, and failed-enrollment cleanup. Run `python3 -m unittest discover -s tests -p test_pair_stackchan.py -v`. A replacement persistent computer credential was also claimed through public HTTPS and verified against the scoped participant profile; enrollment creation for that one host-admin action used the authenticated private server authority. No physical robot or new caregiver browser login was used for that verification.

## 6. Firmware / authenticated WebSocket protocol

Connect `wss://<configured-host-or-IP>[:port]/v1/device-stream` using `Authorization: Bearer <paired-device-credential>` in the upgrade request. Same gateway/session as HTTP controls; no dependency on an open browser tab. The deployed gateway reserves one connection per device identity, permitting other separately enrolled devices concurrently with one active audio owner per profile. No URL tokens, insecure certificate bypass or caregiver/provider credentials on the device.

Protocol envelope, validated by `DeviceEventSchema` / `ServerEventSchema`:

```ts
{
  protocol_version: 1,
  event_id: string,       // unique command/event ID
  session_id: string | null,
  turn_id: string | null,
  generation: number,
  sequence: number,       // strictly increasing within this connection/direction
  type: string,
  payload: object
}
```

### Connection and controls

First message is `device.hello`, for example:

```json
{"protocol_version":1,"event_id":"hello-1","session_id":null,"turn_id":null,"generation":0,"sequence":0,"type":"device.hello","payload":{"firmwareVersion":"your-version","cameraSupported":false,"pettingSupported":false,"audio":{"supported":false}}}
```

An alternative audio capability shape permits `{encoding:'pcm_s16le',sampleRate:16000,channels:1,frameMs:20}`; it does **not** authorize capture/ingestion or prove actual hardware support. Server responds `device.ready`, hello `command.ack`, then `state.changed` with the current safe session/null.

`device.ready.payload` is `{mode:'live',deviceId,profileId,credentialExpiresAt:string|null,audio:false,camera:false,textChat?:boolean,controls:[...]}`. `textChat`/`text` control indicates configured adapter only, not a successful provider call. Camera remains unavailable. Audio stays false unless the gateway enables speech and the client supplies the playback capability described below.

| Incoming type | Payload | Session/behavior |
| --- | --- | --- |
| `heartbeat` | `{}` | About every 2 seconds; works without session; refreshes heartbeat deadline |
| `input.handoff` | `{}` | Current session/generation; cancels/pauses and assigns the caller as active endpoint, then requires explicit participant Resume |
| `input.start` | `{}` | `session_id:null`, `generation:0`, `turn_id:null`; explicit participant start, never automatic hello/reconnect behavior |
| `input.pause` | `{}` | Current session/generation; cancels pending response and pauses |
| `input.resume` | `{}` | Current paused session/generation; explicit return to ready, no capture/playback |
| `input.stop` | `{}` | Current session/generation; ends, cancels output/turn work; local stop precedes transport |
| `input.mute` | `{muted:boolean}` | Current session/generation; mute clears capture/pending turn, unmute never records; unrelated approved output has separate validity |
| `input.help` | `{}` | Recognized without conversation; fixed application contact seam. Current real contact is UNAVAILABLE, no request/send; pauses an active session |
| `input.text` | `{text,language:'en'|'de'}` | Current session/generation and null `turn_id`; text 1–1,000 chars, explicit chat turn below |

Session-bound controls require the latest generation and assigned active session. A stale sequence conflicts; an accepted/rejected valid session packet consumes its wire sequence. Pre-hello events close the socket. New connection resets sequence and requires fresh hello/snapshot. Help is independent of model generation/journal saving; its unavailable error must remain visible.

| Outgoing type | Payload |
| --- | --- |
| `device.ready` | Negotiated implemented capabilities/assignment/credential deadline above |
| `state.changed` | `{mode:'mock'|'live',session:SessionSnapshot|null}` |
| `command.ack` | `{mode:'mock'|'live',commandId,applied:boolean}`; receipt of an applied control, **not** proof audio played/contact arrived |
| `heartbeat` | `{mode:'mock'|'live'}` |
| `error` | `{code,message,commandId?}`; sanitized stable error |
| `response.text` | `{turnId,text,language:'en'|'de',source:'model'|'fixed'}`; envelope `turn_id` matches reply turn |

Socket maximum payload 4,096 bytes; maximum 60 capture frames plus 30 other messages/second (90 total); output backpressure limit 16 KiB. Heartbeat timeout is six seconds, checked every 500 ms (other controls do not substitute for heartbeat). Disconnect/watchdog pauses and clears pending turns; reconnect never resumes capture/media. Credential expiry/revoke closes that endpoint access. Only owner expiry/revocation ends its profile session; observer expiry/revocation does not interrupt the owner. Firmware must independently stop capture/playback/camera/motion under local Stop/watchdog even when no server acknowledgment can arrive; that hardware behavior is not established by a fake-device test.

### Text turn behavior

Example after explicit start, using the actual snapshot's ID/generation:

```json
{"protocol_version":1,"event_id":"text-1","session_id":"session-from-server","turn_id":null,"generation":0,"sequence":2,"type":"input.text","payload":{"text":"Hello","language":"en"}}
```

The coordinator sets `processing` with capture off; generation runs asynchronously so heartbeat/Stop/help remain usable. On success: correlated ack → `response.text` → safe `waiting` snapshot. All presets stay capture-off on this implementation path. Typed text is independent of mic mute; a deliberate text turn can start while the microphone setting is muted.

Stop/pause/mute/handoff/disconnect/revoke cancels pending generation and clears transient dialogue/reply receipts. Session/profile/privacy/policy revisions, lease and current reply ownership are checked before socket output. A resolved response still queued for emission loses permission immediately on mute, even though mute preserves unrelated output generation. Late/stale results cannot restart interaction.

An exact pending/current-turn duplicate avoids a second model request and duplicate socket output. Same ID/different content conflicts. Older/interrupted turns are not replayable. History is at most six dialogue messages; text command fingerprints are capped at 256 per session and last-reply cache is transient. Raw utterances do not enter generic command cache, journals, durable jobs or summaries. Explicit recognized Stop/help/refusal/concern examples bypass the model; these narrow phrase fixtures are not reliable intent/emergency detection. Contact remains unconfigured and never becomes a simulated send on a live call.

### Opt-in voice turns and playback

Exact examples, configuration, cancellation semantics and morning handoff: [speech pipeline protocol](handoffs/anay-speech-pipeline.md). Shared schemas are in `packages/contracts/src/speech.ts`; silence fixtures export from `@lemmi/contracts/fixtures`.

| Direction/type | Payload / boundary |
| --- | --- |
| Client `device.hello` addition | Optional `playback:{encoding:'pcm_s16le',channels:1,sampleRates:[22050]}` alongside 16 kHz/20 ms input capability |
| Server `device.ready.audio` | False by default; enabled object reports input format, `maxCaptureMs:40000` (candidate; legacy 20000 remains parseable), negotiated `playback`, `outputWindowChunks:4` |
| Client `input.speak` | `{language:'en'\|'de'}`, null envelope turn; explicit fresh ready/waiting unmuted action |
| Server `state.changed` captureGrant | `{turnId,generation,leaseId,streamId,language,expiresAt}` only in current unmuted listening state |
| Client `audio.chunk` | `{leaseId,streamId,chunkIndex,encoding:'pcm_s16le',data}` with granted envelope turn; exactly 640 bytes, canonical 856-char base64; contiguous zero-based chunk index |
| Client `audio.end` | `{leaseId,streamId,chunkCount}` and current turn; count 1–1000, exactly accepted frames |
| Server `response.start` | `{turnId,leaseId,streamId,encoding:'pcm_s16le',channels:1,sampleRate,chunkBytes,chunkCount,byteLength}`; at most 30 seconds, metadata internally consistent |
| Server `audio.chunk` | `{leaseId,streamId,chunkIndex,encoding,data}` and matching turn; about 20 ms, even-sized final partial allowed |
| Server `audio.end` | `{leaseId,streamId,chunkCount}`; sending finished, not playback complete |
| Client `audio.receipt` | `{leaseId,streamId,status:'started'\|'progress'\|'completed'\|'failed',playedChunks}`; authenticated cumulative consumed count, not buffered count |
| Server `response.cancel` | `{leaseId,streamId,reason:'interrupted'}`; flush local output in addition to authoritative state cancellation |

Speech requires `LEMMI_SPEECH_ENABLED=1`, valid private independent STT/TTS settings and configured OpenRouter. No output resampling: advertise an actual supported native rate (16/22.05/24/44.1/48 kHz); current Piper is 22.05 kHz. Legacy clients and default startup stay audio-disabled. No new public HTTP audio or raw inference endpoints are added.

One bounded 40-second/1,280,000-byte capture, one turn/output, no inference queue. Current engine seam buffers the bounded complete utterance then recognizes after explicit end; browser end-of-speech detection is implemented; incremental STT remains pending against the technical-spec target. Frame-time checks allow at most a one-second lead. Rate/watchdog/media durations use monotonic elapsed time; credential expiry uses UTC. A single 20-second deadline covers STT→model→TTS. Four output chunks ahead of consumed receipts; started deadline five seconds and playback deadline duration plus five seconds. For ordinary replies, only a started receipt sets speaking; completion returns capture-off waiting. Fixed concern/refusal replies follow the paused-session behavior below. Completion never grants capture.

Mic mute cancels pending input work but preserves approved output. Repeated unmute during capture cancels it; unmute alone never opens capture. Pause/Stop/help/disconnect/revoke/context change cancel; late results/receipts cannot restore state. There is no raw audio/transcript/journal persistence. Endpoint receipts remain reports, not independent proof of hardware output. Unsupported rate/language/engine, malformed/expired/gapped frames and backpressure fail explicitly.

#### Fixed voice replies while paused

Recognized urgent/unwell/topic-refusal phrases bypass the model and pause the session. The chat-hardening branch applies the same guarded fixed-output path to its frightening/navigation/privacy-refusal routes. The canceled input turn remains canceled. The coordinator synchronously creates fresh fixed-output authority with a new turn ID, a new stream and the current paused generation; the gateway publishes that paused snapshot before TTS finishes so Stop can use the current generation. Only that server-owned fixed reply may produce audio while paused. Ordinary model output never acquires this exception.

The existing wire schemas are unchanged: `response.text` has `source:'fixed'`; its turn ID matches `response.start` and audio events. Clients bind the new output to that fixed text, current generation/lease and local permission. A paused snapshot alone never grants playback. Use the new generation/turn/stream for receipts; capture-turn IDs are obsolete. Session phase remains `paused` through synthesis, started/progress/completed receipts, failure and expiry; capture stays off. Firmware/UI must represent fixed playback independently from session phase and continue to honor local Stop/pause/watchdog before server acknowledgments.

The original 20-second post-capture inference deadline also bounds fixed TTS; fresh authorization does not extend it. Later Pause/Stop/help, disconnect/revoke, profile/context change, handoff or explicit Resume cancels fixed work. Mic mute cancels pending synthesis without unpausing; already approved output retains the usual mute semantics. Failed TTS/unsupported formats are explicit errors, and no playback success is fabricated. Real caregiver contact remains unavailable. Hardware enforcement of this wire behavior is pending counterpart review.

### Defined but not executable device events

Camera allow/decline/started/ended and device.health schemas remain preliminary; the gateway does not execute them. Production activity event streaming and expression rendering remain pending. Teaching commands are candidate functionality and require negotiated `device.ready.teaching:true`. Never infer camera or activity permission from negotiated audio.

## 7. Session, activity and data projections

### Session contract

`SessionSnapshot` includes `id,profileId,generation,profileRevision,privacyRevision,policyRevision,phase,endpoint,activeEndpointId,leaseId,micMuted,captureGrant,communicationSupport,conversationMode,teaching,mode`. Endpoint is `browser|robot`; phase enum is `ready|listening|processing|speaking|waiting|paused|unavailable|ended`. Not all schema phases are reachable in the current transport. A nonnull capture grant is legal only while current/unmuted/listening with matching generation/lease; this feature branch grants one only through explicit negotiated `input.speak`; deployment/hardware acceptance remains separate.

`SessionCommand = {commandId,sessionId,expectedGeneration,action}`. Runtime actions: `pause`, `resume`, `stop`, `{type:'mute',muted}`, `{type:'handoff',endpoint}`. The legacy generic control action seam is distinct from live WSS events: live voice uses `input.speak` plus granted PCM frames and `audio.end`, live endpoint transfer uses `input.handoff`, and candidate teaching uses the negotiated events listed above. Do not assume a schema-defined generic action is executable by every transport. Resume is explicit and capture-off, Stop is terminal, and initiated help requests have their own lifecycle.

### Activity integration: Lukas → coordinator → Kylie

The four stable IDs are `music_playlist`, `twenty_questions`, `photo_album`, `object_matching`. Pure exports in `@lemmi/activities` are `createActivity`, `reduceActivity`, `projectActivity`, `applyActivitySystemInput`. They take validated approved content and required context and return state/view or `{nextState,events,effects}`; no I/O/network/model/database/timer authority inside reducers. Pure music and photo reducers exist; public Photo Story hosting is described above. Guessing/matching remain unavailable; music playback hosting is still incomplete.

`ActivityCommand` is `{commandId,sessionId,instanceId,expectedRevision,action,presentation?}`. Matching actions require the current coordinator-issued `presentation`; do not generate a token/entity ID in UI. Session Stop/help/mute/pause are not activity actions; only the coordinator dispatches system interrupts/receipts/policy updates.

| Activity | Participant action family | State/view notes |
| --- | --- | --- |
| Music | `track.select {trackId}`, `track.play`, `track.pause`, `track.next` | Current track/playback; `requested` differs from endpoint receipt-backed `playing` |
| Guessing | `guess.answer {answer:'yes'|'no'|'not_sure'}`, `guess.skip`, `guess.reveal`, `guess.new_round` | Reviewed bounded acyclic tree/candidates/rounds; safe view exposes question/roundPhase/offeredGuess, not hidden candidate tables/counts |
| Photos | `photo.select {photoId}`, `photo.next`, `photo.previous`, `photo.skip`, `photo.just_look`, `photo.talk` | Stable entry ID, position and just-look/talk state; private discussion context never enters participant view; scene exploration uses the same activity |
| Matching | `match.select {choiceId}`, `match.show`, `match.not_sure`, `match.next`, `match.finish` | Visible sample/two candidates; nullable nested presentation; no correctness/ability field |
| Any | `activity.leave` | Exit without matching evidence; empty/unavailable matching views use Leave rather than forged match actions |

`ActivityContext = {eligibility,presentationPolicy,matchingPresentation}`; matching context is explicitly null for nonmatching/unavailable presentations. Token shape: `{instanceId,presentationId,presentationRevision,policyRevision}`, bound to current eligibility revision. Context is required for create/reduce/project, not only progression, so excluded prompts/assets cannot leak through view refresh.

`validateActivityCommandContext` checks state/context freshness and displayed actions; `validateMatchingSignalContext` binds effect/sample/eligible displayed content to **input** context. These helpers validate shape/state, not sender authorization, consent, durable deduplication or retirement. Host checks session/resource scope/generation/lease/privacy/policy before execution/writes. Matching preference signals are proposals; only the server can commit policy.

State/pack/view/event/transition field details and breaking placeholder changes are in [A01–A04 handoff](handoffs/anay-activity-contracts.md). Runtime `ActivityEventSchema`/`ActivityTransitionSchema` reject private/free text; factual playback events require consistent receipt shape, which is still not authenticated proof on its own. `offer_photo_conversation` includes exact photo/asset IDs and must reuse/cancel the existing conversation path. Pending effect execution/receipt validation/catalog hosting is A05; no direct reducer-selected URLs/model tools.

### Other shared projections

| Shape | Fields / boundary |
| --- | --- |
| `ParticipantProfile` | `id,preferredName,avatarId,revision,communicationSupport` only; no caregiver guidance/contact/journal |
| `CaregiverProfile` | Adds `source:'caregiver_provided',interests,sensitiveTopicGuidance,rememberingEnabled,excerptSavingEnabled`; caregiver-only; live `ProfileDetail` extends this shape |
| `AvatarId` / expression | Exactly `dog,cat,bunny,bird,lemming`; separate expression enum `idle,listening,processing,speaking,paused,unavailable`. Reduced motion is not another avatar |
| `CommunicationSupport` | `preset:'conversational'|'guided'|'quiet',configVersion:1`; not clinical stage, and not automatic language/privacy/help settings |
| `PreferencesSnapshot` | Profile/policy revision, remembering flag, structured preferences/items; mock is empty/off. No raw utterance history |
| `PreferenceSignal` | Command/session/presentation IDs and revisions, policy revision, canonical entity ID, `prefer|avoid|uncertain`. Current writes unavailable; do not bypass policy/evidence checks |
| `HelpSnapshot` | ID/profile, mode simulation/real, manual/urgent concern reason, templated message/status. Schema statuses include created/sending/accepted/delivery_unknown/delivered/acknowledged/failed/no_response/canceled/expired/resolved; mock only demonstrates a small simulated subset |
| `Journal` | Profile/mode and ≤100 session records with ≤100 source-labeled measured events/session; `summary:null` currently. No dialogue text/AI summary storage implemented |
| `CheckInSnapshot` | Assigned IDs, revision/privacy revision, state `off|requested|starting|active|ended|unavailable`, viewer name/times/reason/frame freshness fields; mock default off only |
| `TeachingSnapshot` | Conversation-mode/presentation/topic/asset/policy/phase scaffold; execution unavailable. Teach Lemmi is not a fifth activity |

## 8. Private speech and LLM adapters

Use [Ubuntu speech setup/configuration/API/privacy guide](../services/local-speech/README.md). The wrapper is not a participant endpoint, stores no session and accepts no credentials from firmware/browser. It is safe to test local engine readiness independently of caregiver sign-in, but that does not authorize production participant capture.

| Private endpoint on loopback speech origin | Request | Response |
| --- | --- | --- |
| `GET /health` | Speech bearer token | Readiness and engine/language capabilities, not paths/secrets |
| `POST /v1/stt` | Token, UUID `X-Lemmi-Request-Id`, `X-Lemmi-Language:en|de|auto`, binary content type and PCM | `{ok:true,data:{text,language}}`, text ≤2,000 chars |
| `POST /v1/tts` | Token, UUID header, JSON `{text,language:'en'|'de'}` | Raw mono signed int16 little-endian PCM + `X-Lemmi-Sample-Rate`, `X-Lemmi-Encoding`, `X-Lemmi-Language` |
| `POST /v1/cancel` | Token, JSON `{requestId:<UUID>}` | `{ok:true,data:{applied:boolean}}`; also remembers bounded early-cancel IDs |

STT input: **16 kHz mono**, positive even byte count ≤1,280,000 (40 seconds); this bounded whole-turn wrapper receives the assembled, validated 640-byte device frames after explicit end. TTS text ≤600 chars; output ≤30 seconds at 8–48 kHz. Current English Piper voice outputs **22,050 Hz**. Live output negotiates native playback rates; test-only resampling is only for synthetic input fixtures. Unsupported German voice is unavailable, never silently English.

One inference job per worker, no wrapper inference queue; configurable 1–4 STT and 1–4 TTS workers (this host retains two of each), sixteen request-thread cap, five-second connection/body bounds and 20-second inference bound. Best-effort cancel can terminate/reload the engine worker; callers independently reject late results. A client disconnect alone is not proof of immediate native inference cancellation. Speech errors are bounded/sanitized; no engine prompt/audio/transcript tracebacks are returned. Host RAM/IPC/native buffers remain transient without a secure-erasure claim; model/dependency caches persist, raw audio/transcripts do not intentionally persist.

Server adapter interfaces (`@lemmi/server` exports type-only speech/chat types and adapter factories):

```ts
stt.transcribe({ pcm: Uint8Array, language: 'en' | 'de' | 'auto' }, signal)
  // Promise<Result<{ text, language: 'en' | 'de' }>>
tts.synthesize({ text, language: 'en' | 'de' }, signal)
  // Promise<Result<{ pcm, sampleRate, encoding:'pcm_s16le', channels:1, language }>>
chat.complete({ system, history, text, language }, signal)
  // Promise<Result<{ text, language }>>
```

Independently select STT/TTS `local-http|disabled`, URL, engine/model/device/voice settings at startup. Concrete engines currently faster-whisper 1.2.1/base CPU-int8 and Piper 1.8.0/English LJ Speech medium CPU. Another backend requires an explicit adapter implementation/configuration, not a silent fallback. NVIDIA/VM/Mac/AMD acceleration and German speech quality remain untested.

OpenRouter is server-only: fixed HTTPS endpoint; explicit model; one attempt; no tools or client-selected provider URL; timeout ≤20 seconds, max tokens default 160 (32–512). `LEMMI_LLM_REASONING_EFFORT=default|none|minimal|low|medium|high|xhigh|max` is explicit; model support must be verified. Reasoning is excluded; truncation fails without retry. GLM 5.3 Flash synthetic rehearsal used low/512 because default reasoning exhausted 160 tokens. Text response must be complete/plain/bounded and meet support question limits. Prompt/runtime validation is not proof of semantic safety or approved facts; selected-model rehearsal remains required. Routing/retention/account configuration and external data-handling limits are documented in [speech handoff](handoffs/anay-speech-chat.md#configure-openrouter-text-chat); no universal deletion guarantee.

## 9. Configuration and running integration checks

Templates: [root .env.example](../.env.example), [private speech template](../services/local-speech/.env.example). Keep real values in ignored private `.env`/host configuration. A configured variable is not the same as a live-tested provider. Do not print settings to debug credentials.

| Group | Keys |
| --- | --- |
| Mode/gateway | `LEMMI_MODE`, `GATEWAY_PORT`, mock-only `LEMMI_MOCK_TOKEN` |
| Authenticated origin/internal seam | `LEMMI_PUBLIC_ORIGIN`, `LEMMI_CONTROL_TOKEN`, `LEMMI_ACCESS_KEY`; web `HOST`, `PORT`, explicit `ORIGIN` |
| Caregiver verifier | `LEMMI_AUTH_INTROSPECTION_URL`, `LEMMI_AUTH_ISSUER`, `LEMMI_AUTH_AUDIENCE`, `LEMMI_AUTH_TOKEN_BINDING`, `LEMMI_AUTH_CLIENT_ID`, `LEMMI_AUTH_CLIENT_SECRET`, `LEMMI_CAREGIVER_SUBJECT` |
| Persistence/media | `LEMMI_DATABASE_URL`, `LEMMI_PRIVATE_MEDIA_DIR`, `BODY_SIZE_LIMIT`; setup uses `LEMMI_CAREGIVER_SUBJECT` and private PostgreSQL configuration |
| Paired computer harness | `LEMMI_DEVICE_CREDENTIAL`, optional `LEMMI_DEVICE_CA_FILE`; these are not server admin credentials |
| OpenRouter | `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `LEMMI_LLM_TIMEOUT_MS`, `LEMMI_LLM_MAX_TOKENS`, `LEMMI_LLM_REASONING_EFFORT`, client `LEMMI_CHAT_LANGUAGE` |
| Speech adapters | `LEMMI_SPEECH_ENABLED`, `LEMMI_STT_BACKEND`, `LEMMI_TTS_BACKEND`, `LEMMI_STT_URL`, `LEMMI_TTS_URL`, `LEMMI_SPEECH_TOKEN`, `LEMMI_SPEECH_TIMEOUT_MS` |
| Local engine process | `LEMMI_SPEECH_PORT`, `LEMMI_SPEECH_STT_ENGINE`, `LEMMI_SPEECH_STT_MODEL_PATH`, `LEMMI_SPEECH_STT_DEVICE`, `LEMMI_SPEECH_STT_COMPUTE`, `LEMMI_SPEECH_THREADS`, `LEMMI_SPEECH_TTS_ENGINE`, `LEMMI_SPEECH_VOICE_EN`, `LEMMI_SPEECH_VOICE_DE` |

Use pinned Bun 1.4.4 and `bun install --frozen-lockfile`. Existing checks: `bun run check`, `bun run test`, `bun run build`, `bun run format:check`. With mock dev running/no active session: `bun run smoke:web`. After build: `bun run smoke:control`; optional `bun scripts/smoke-control.ts --chat-fixture` validates chat through a test-only provider fixture with real TLS verification, never a real key/model call.

Private local engine check (requires installed environment/assets; see speech guide):

```sh
# terminal 1
bun --env-file=services/local-speech/.env scripts/local-speech.ts
# terminal 2
bun --env-file=services/local-speech/.env scripts/speech-smoke.ts
```

Neither test plays sound/opens the microphone. Automated fixture tests validate contracts/cancellation/bounds; actual provider, browser usability, target-host performance and local robot controls require separate observations. Record evidence in [build plan](build-and-demo-plan.md#7-acceptance-tracker), not just a checked schema/test name.

## 10. Planned REST and unresolved handoffs — do not call yet

The following come from the technical/integration/robot/personalization specs and **do not exist as production routes in this baseline**. Their final request/response bodies, authorization and consumer changes must ship together. Use mocks/fixtures with explicit unavailable/error states until the owner publishes a working contract.

| Planned surface | Target routes / missing integration | Owner / task |
| --- | --- | --- |
| Profile privacy/deletion and non-demo creation | The endpoint APIs add fictional-only creation through `/v1/demo/profiles`; caregiver-managed non-demo creation, privacy and deletion jobs remain pending. Authorized read/PATCH/media already exist | Anay A25; Kylie views |
| Alternate browser REST transport | The endpoint APIs use authenticated cookie WSS for browser sessions/text/controls and optional bounded audio. `/v1/sessions/:id/commands` REST aliases and full browser/hardware acceptance remain pending | Anay A12/A13; Kylie/Emilia consumers; do not reuse caregiver/device credentials across roles |
| Activities/playback | `/v1/activity-packs`, `/v1/sessions/:id/activities`, instance view/actions, pack catalog and effects/receipt executor; authorized `/v1/assets/:id` byte reads already exist (A19 above) | Anay A05 + Lukas logic + Kylie view |
| Journal/summary/overview | Profile/session journal, observation and summary review/edit/delete, `/v1/profiles/:id/overview` | Anay A23/A27; Kylie |
| Contacts/help/jobs | Verified contacts/test, `/v1/help-requests` plus status/acknowledge/cancel/resolve, signed notification callbacks and durable jobs | Anay A21/A22; real opted-in team tests |
| Preferences | Profile preference load/edit/forget/remembering and presentation-bound signals | Anay A24/A25; Lukas eligibility/effects; Kylie controls |
| Camera | Device check-in request, `/v1/check-ins/:id` status/end, nonce-bound control and separate bounded media relay | Anay A28–A32; Emilia/Kylie; F13 before F14 |
| Teaching/scene/overview refinements | `codex/teach-lemmi` reviewed but not integrated/deployed here; session teaching, approved scene packs and source-linked highlights still require explicit integration | Anay A26/A27; reuse conversation/four-activity seams |
| Device health | Freshness/validated measured telemetry after secure F13 gate | Anay A33 + Emilia/Kylie |

Camera is default-off and requires current local Allow for each request; request/relay/state/expiry are not made functional by preliminary headers. End video leaves activities paused; mic mute is not camera-off. Raw frame data never enters models/journal/jobs. Matching retirement and remembered preferences need separate consent/storage/late-write protection; schemas alone do not implement policy. No automatic biography/support-preset writes, clinical scoring or model-chosen actions/contact destinations are part of the API.

## 11. Keeping this reference current

For each backend integration increment:

1. Update the actual shared runtime schema, typed client, authority and counterpart consumers together.
2. Update this reference's availability row, route/event/field/limit/config/error and compatibility notes. Update [backend status](backend-status.md) in the same change with the deployed revision, services, actual observations, failures and remaining limits; distinguish code-ready from deployed and fixture from live. Explicitly identify renamed/replaced shapes and current versus planned paths.
3. Add/reuse nonsecret fixtures and meaningful scope/revision/retry/cancellation/privacy checks; record actual commands/results and untested hardware/provider cases in the build plan.
4. Link the focused handoff and next owner in [Anay's tasks](anay_tasks.md). A task/schema/fixture marked ready never implies hardware or real delivery acceptance.

No OpenAPI document is generated yet. The `operations` registry covers the typed client seam, not every private/public route and not an implemented production REST catalog. Treat this file as the navigable integration inventory and import source schemas for exact executable validation.

### Deployment checkpoint — persistent credentials and support

Historical runtime `d067ac0` first deployed both features and both new migrations. The live proxy allows `GET /v1/profiles/profile-alex/communication-support` and `POST /v1/profiles/profile-alex/communication-support/apply`, retaining the 4 KiB body ceiling and caregiver/domain gates. No new client-side permission bypass or public inference endpoint was added. API `credentialMode` omission still means one-hour credentials; the Python helper explicitly requests persistent mode by default. Null expiry is valid and must not be treated as an expired key. Live same-key reconnect after a real gateway restart passed; explicit Start remains required and the test key was revoked. See [backend status](backend-status.md) for fixture versus live verification and failures observed before GLM configuration was aligned with the handoff.

### Current endpoint deployment checkpoint

`17a8522` is deployed with normal migrations `002_multi_profile_endpoints.sql` and `004_endpoint_revocations.sql` alongside the unchanged four previously applied files. The runtime preserves existing indefinite persistent keys, scopes current profile support reads/applies to their profile coordinator, and uses transactionally checked membership/gateway ownership for credential issuance. Existing shared credentials require no replacement. Ordinary demo browser/robot enrollment lasts 30 days; the legacy Python pairing helper still explicitly requests indefinite persistent keys by default. Finite enrollment now also survives normal restart until its expiry; all sessions/grants/output end. The combined suite passed 169 tests / 3,585 expectations; public new-profile/enrollment/concurrent-WSS tests passed with test-only cleanup. Frontend authentication/interaction, real-device local controls, browser voice permissions and Teach Lemmi integration remain distinct acceptance tasks.

## Deployed fictional profile editing and spoken activity choice (`95bdcef`)

Based on main `01b6ffb`; not a deployed API claim.

`createParticipantSetup().update(input)` posts `/v1/demo/profile-update` with
`DemoProfileUpdateSchema`: `{profileId, expectedRevision, commandId,
patch:{preferredName, avatarId}}`. Both patch fields are required. Success returns
only `ParticipantProfile`; private caregiver fields and unexpected keys are
rejected. Same-origin/private domain gate, explicit `LEMMI_DEMO_ENROLLMENT=1`,
current gateway epoch, assigned fictional profile, existing revision/deduplication
and profile-update cancellation all apply. A paired endpoint cookie alone is not
setup authority. Existing private caregiver routes are unchanged. Add this exact
operation to the deployed Nginx demo allowlist before enabling the UI release.

`createParticipantSetup().create(name, avatarId?)` consumes the existing profile
creation schema, with lemming as the default avatar. It does not copy Alex's
interests, biography, media or credentials to newly created profiles.

Existing `input.text` and speech recognition now recognize explicit English
“Start Teach Lemmi”, “Start Photo Story” and “Explore pictures” requests before
ordinary model generation. Photo selection requires an enabled browser endpoint.
Selection uses the existing activity/session transitions and generation-bound
speech replacement; no new device event or capture permission is added.
Stop/help/privacy routes retain priority. Incidental or negated mentions do not
select activities. Music/guessing/matching requests explicitly report unavailable.

### Voice-mode phrase refinements — deployed (`95bdcef`)

The existing `input.text` / STT path also accepts reviewed English invitation
prefixes such as “Let's play”, “Let us play”, “I'd like to play”, “Can we play” and
“Switch to”. Curly apostrophes and terminal punctuation are normalized. Supported
mode names remain Teach Lemmi, Photo Story/photo album and Explore pictures.
“Back to conversation”, “Finish teaching” and “Finish Photo Story” explicitly end
the active mode, rotate generation, invalidate pending work and return a bounded
fixed reply through fresh speech output authority. They do not restart capture.
Safety routes still precede ordinary mode selection; neither models nor clients
choose arbitrary game IDs, assets or URLs.

Explicit capture for mode-selection commands is permitted from a photo Just look
state and when no teaching topic is eligible, using the same endpoint/grant and
configuration fences. Ordinary unavailable/ineligible activity discussion is still
rejected after mode-control routing. This prevents an empty topic list from
trapping someone in a mode; it is not permission to ignore content policy.
Music, guessing and matching hosting is still unavailable and requests report that
fact instead of entering an invented game. No new device schema; deployment is recorded above.

### Conversation exit passcode — deployed (`95bdcef`)

The conversation uses the restored four-digit number pad. `POST
/v1/demo/conversation-lock` establishes an HttpOnly, SameSite=Strict session lock
(Secure on HTTPS), including on client-only page transitions. `POST
/v1/demo/conversation-exit` accepts exactly `{password: string}` and verifies a
four-digit code on the server. Both require a same-origin POST and the existing
live private-domain gate. GET never verifies or unlocks. While locked, caregiver
page navigation (including Back/direct URLs) returns to conversation; demo profile
creation/edit mutations are rejected. The independent caregiver/resource
credentials remain required for protected APIs. This is an application navigation
gate, not OS kiosk confinement or a replacement for caregiver identity.

Local mock uses fictional code `1234`. Live mode requires server-only
`LEMMI_CAREGIVER_EXIT_PASSWORD` containing exactly four digits; it has no default.
Missing/invalid live configuration fails closed. Password data is transient and
not echoed/logged. Five failed attempts per lock in a one-minute window block
further attempts until expiry; bookkeeping is bounded. A successful POST expires
only the conversation lock cookie, not endpoint credentials or the domain gate.
The production proxy allowlist includes both exact operations.
No database migration. Cookie removal/browser administration is outside this
navigation barrier; private caregiver authorization remains separate.

## Participant greeting/topic-choice contract — deployed in `5146030`

The shared device contract adds `input.teaching.select` with `{entityId}`. Teaching snapshots optionally include up to three server-filtered `choices` and `choosingTopic`; public teaching starts first offer a spoken/visible menu. Existing session generations, owner/profile scope, policy checks and cancellation apply. New voice sessions play an application-owned greeting before browser capture; pause/resume/reconnect do not replay it. No route or migration changes. `activity.leave` can close a paused Photo Story while preserving the pause. [Exact behavior, compatibility and validation](handoffs/participant-greetings-exit.md).
