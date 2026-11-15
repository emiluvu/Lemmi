# Lemmi backend status

## Photo Story and conversation fixes prepared — November 15, 2026

Undeployed candidate `fix/photo-story-conversation-stalls`: fixes missed Photo Story
voice requests, covered false model-display claims, clipped image layout and obsolete
async errors that can disable a newer listening attempt. Integrates current
`backend-deploy` through `435b73a`; greetings, teaching choices/Finish, startup
recovery, saved-photo scope and branding are retained. No new API/schema/migration,
configuration, dependency or provider change. Deploy web/gateway together after the
combined verification and boundary review. Existing runtime is unchanged by this work.

[Completion status, evidence and server rollout handoff](handoffs/photo-story-conversation-stalls.md).
Combined verification is in progress; earlier local 461-test/full database and
production fixture smoke results are recorded there separately. Human speech,
live-model and hardware acceptance remain pending.

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

## Temporary Stackchan transport diagnostics deployed — November 15, 2026

**Gateway `2501847`**, reviewed `88bb7c7` integrated via `a54661c`. Exact-device
diagnostics enabled for `stackchan-alex` with explicit live startup confirmation
at **06:53:25.055767 UTC**. Web/speech `a779c70`, tunnel PID/start times and served
web-build bytes retained. Two intentional gateway-only restarts (rollout, then
content-free activation marker); zero automatic restarts. All other private
configuration and existing profile/device/credential fingerprints preserved.
No migrations, provider/firmware/protocol/buffer/deadline changes. Pre-rollout
78 tests / 2,304 expectations, type/Svelte, formatting/whitespace and isolated
production build passed. Actual public own-profile concurrent WSS Start/Pause/Stop,
capture-off and existing-key checks passed; own test data alone removed.

The robot has not been retested: this enables evidence collection, not a voice
repair. Bounded 30-minute local TCP metadata sampler additionally runs without
packet/payload capture; robot-facing TLS ACKs remain unmeasured. Protected
source/config/build rollback pointer `.data/stackchan-uplink-rollback-path`;
normal return uses `python3 .data/disable-stackchan-transport-diagnostics.py --apply`
to remove only the selector and restart only gateway. Helper dry run checked;
actual disablement awaits the controlled retest. No routine DB/media restore.
[Emilia's test instructions, limits and rollback](handoffs/stackchan-uplink-backend-investigation.md#diagnostic-deployment--november-15-2026).

## Stackchan uplink investigation — November 15, 2026; diagnostic candidate only

Investigated Emilia's voice 0.9 failure at **06:11:35 UTC** on the deployed host.
Gateway `264df22`, web/speech `a779c70` retained; source checkout `f3e3b41`.
No service, private configuration, credential, profile, protocol change or deployment.
Four-service journals contain zero entries for 06:09–06:14 UTC; existing runtime
does not log received capture counts or WS closes, so frame delivery, rate-limit
closes and backpressure cannot be reconstructed. Gateway started 05:39:31 UTC,
web/speech 04:48:05 UTC, tunnel November 14 06:43:36 UTC; all active, zero automatic
restarts. Nginx running since November 14 06:30:07 UTC with restart count 0,
buffering off/no configured rate limiter, access logs off/Docker logging `none`.
No observed local restart explains the incident; Cloudflare edge/network
behavior remains unmeasured. Origin TCP counters cannot observe the robot's
separate edge-TLS connection.

Prepared **undeployed/default-off** exact-device transport diagnostics for
received bytes/messages, accepted frames/gaps, handler timing, aggregate errors
and allowlisted local close causes/codes. One periodic sample/second plus
capture/open/close records; no media/text/headers/credentials/profile IDs or peer
close text. Existing TLS/auth/rate/backpressure/revision/cancellation behavior is
retained. **78 targeted fixture tests / 2,304 expectations passed** across gateway,
verified TLS proxy, speech/access/cancellation, including paced 50 fps upload,
diagnostic privacy/sink failure and rate-limit-close attribution. Type/Svelte
and formatting/whitespace checks passed. No physical robot/provider acceptance
or payload capture. Emilia's detailed handoff is absent from this checkout and
fetched firmware branch; paired retest and exact source/counterpart review are
pending. [Evidence, diagnostic rollout and payload-free observation plan](handoffs/stackchan-uplink-backend-investigation.md).

Subsequent exact-source review: Emilia published `d246217` on
`codex/stackchan-voice09-review`; the missing handoff is now available and reviewed.
Reason6 is firmware bounded-write failure, status2 is timeout; capture_sent counts
completed local writes, not gateway receipt/ACKs. No confirmed repair follows.
Emilia reviewed backend diagnostics `9a7173e` as wire-compatible. Five exact-source
native helper programs passed with ASan/UBSan; ESP32 SDK/full sketch/hardware
not independently built or tested here. Runtime/diagnostic deployment status
unchanged; paired UTC window and robot-side measurement method remain pending.

## Photo Story Start/Resume — local source candidate, November 14, 2026

Branch `codex/photo-story-start-resume` now includes main `f3e3b41`: opening/reorientation precedes browser capture, Start/Resume uses server-resolved English/German, and missing/failed playback returns current approved text with capture off. Same-photo/question reminders, existing picture/avatar recovery and main's German/memory/Jev/Stackchan behavior remain. No new schema, migration, dependency, provider or configuration change. [Deploy-agent handoff and exact acceptance](handoffs/photo-story-start-resume-2026-11-14.md).

Observed on Bun 1.4.4: **435 tests / 6,607 expectations, zero failures/skips**, five isolated PostgreSQL databases; type/Svelte, production build, full format/whitespace, 15 Python speech/provisioning fixtures and production HTTP/verified TLS/WSS participant/Photo Story smoke passed. Fixture services/clients only; merged browser visuals, human audio, public-network/provider and K151 rehearsal plus counterpart review remain pending. **No deployment performed; pushed source is for the server deploy agent to review.**

## Stackchan twelve-frame output deployed — November14,2026

**Gateway runtime `264df22`**, web/speech `a779c70` retained. Removed browser-only checks in gateway negotiation and all three speech-owner paths. Robot `playback.outputWindowChunks:12` can now negotiate12×20ms=240ms credit; omitted/explicit4 retains80ms fallback. Consumed-only refill and Stop owner cancellation/PCM wipe/late receipt rejection remain. No schema, migration, config/provider/model/UI/firmware change; gateway-only rollout. Final **413 tests /6,281 expectations**, no failures/skips on isolated databases; type/Svelte zero errors/warnings, pinned frozen Bun1.4.4, format/whitespace passed. Includes robot12/legacy4 credit and queued/playing Stop/short-tail tests. [Exact firmware handshake, short-reply behavior, Stop responsibilities and observed checks](handoffs/stackchan-playback-window.md).

Actual public authenticated robot WSS on its own fictional profile passed **12 frames initially → started0 adds no credit → consumed2 permits14 total → Stop ends/cancels without more chunks → late progress receipt rejected**. Separate robot enrollment with the field omitted advertised4. Real local speech plus configured external chat were used; consumed receipts were simulated, and no physical device/speaker/jitter result is claimed. Only the probe's own profile/enrollments were removed; Alex/Stackchan credentials and assignments were untouched.

Gateway-only restart after protected source/build/config/database/media backup at `.data/stackchan-window-rollback-path`. Web/speech PID/start timestamps byte-matched before/after; config, migrations/data and provider/endpoint credentials unchanged. Four services active, gateway zero automatic restarts. Firmware must request12, honor actual ready4/12, bound its own queue and immediately flush local ring/DMA audio on Stop, including late stream callbacks; short replies can end before12frames. Emilia's actual hardware/underrun/Stop checks remain pending.

## Profile context/memory and German deployed — November 14, 2026

**Web/gateway/speech runtime `a779c70`.** Merged source `cd68663` then German `2ca3fba`, preserving branches and deployed Jev/profile/microphone behavior. Rich context/private pictures, separate default-off summary permission and exact-ID German pilot are ready. Review fixed blocking summarization (now bounded background), stale-refusal/re-enable races, copied/contact-bearing summary retention, upload admission, prompt budgeting and German unused-Jev overhead. **407 tests /6,244 expectations**, zero failures/skips; type/Svelte zero errors/warnings, build/format, production participant TLS/WSS smoke, disposable Chromium profile/photo/permission checks and nine Python checks passed. Isolated actual German STT/TTS and external model→German voice passed with fixed synthetic input. Existing Tilda reused; no copied Alex context or bulk backfill. [Full review, actual staging evidence, migration/media backup and human test reminder](handoffs/profile-german-backend-integration.md).

Applied additive **migration006**, eight migration files/applied checksums match; all earlier data and credentials retained. Protected source/build/config/PostgreSQL/private-media rollback pointer `.data/profile-german-rollback-path`; refreshed the database/media pair with writers stopped before migration. Installed six exact demo proxy additions, image upload1500k/other demo32k, keeping private storage/internal/unlisted paths blocked. No reset/reseed/bulk fictional fill. Existing summary permissions default off; only a disposable acceptance profile explicitly opted in. Existing fictional Tilda reused and privately mapped by exact ID; English remains default elsewhere. Selected verified `de_DE-thorsten-medium` alongside current HFC English. Private health confirms CPU int8 STT **2/2** and Piper TTS **2/2**, both languages; two total TTS slots shared across languages. Jev activities1/.85/1500 and chat deadline8000ms/browser silence1000ms retained. All four services active, zero automatic web/gateway/speech restarts.

Actual PUBLIC Chromium passed rich profile create/edit/reload, default memory off, portrait+extra actual PNG upload/read/previews, deletion of removed image row/private bytes, cross-profile image403, explicit memory on/off, Forget/Fill on own fictional fixtures and all six locked-operation403 denials; zero runtime errors. Only those created profiles/assets were removed. Separate actual English speech with explicit own-profile memory opt-in passed local STT→Jev/configured external model→HFC TTS→next capture→Mute/Stop and confirmed one background summary persisted; zero runtime errors, individual synthetic response-start2917ms. Its profile/memory was then deleted; no other profile permission was enabled.

Actual public Tilda German speech passed, including first capture/real STT/external model/German TTS/another capture/Mute/no restart/Stop, zero runtime errors (3092ms individual synthetic response-start). One initial German start check timed out before its listening selector appeared; no content was logged and the cause was not established. An instrumented rerun and then a further concurrent English/German run passed without code/config changes. Concurrent observations: German2736ms and English2679ms response-start, each one consumed reply/two captures/Mute/Stop, no runtime errors. These individual synthetic measurements are not latency percentiles or human-room acceptance. Tilda's created test endpoint alone was released; her profile/context and other endpoints retained. The public Jev spoken-request→offer→spoken yes→teaching flow also passed after this merge (two replies/three captures/no early switch/Mute/Stop); its two-utterance timing counters are not accepted as a single-turn latency measure.

All audio inputs were fixed in-memory synthetic fixtures. No microphone recording/transcript/model-reply screenshots were saved. Client scan:59 text assets, zero private credential matches. Human/fluent-speaker voice/tone, startup/reconnect/room-noise, full accessibility and K151 acceptance remain pending. After maintenance, refresh/reconnect and explicitly Start/Resume. Reminder for the user's manual pass: **Jev activity routing; profile context/photos and opt-in memory/Forget; Tilda German with another profile English.** [Complete review and limits](handoffs/profile-german-backend-integration.md). Later documentation-only commits preserve runtimea779c70.

## Jev activity routing deployed — November 14, 2026

Merged source `fix/conversation-activity-routing/c1b619f` into the latest response/profile-entry baseline while preserving the source branch. Activity-only Jev gate rerun: **71/71 matched, zero mismatches/unavailable/false positives, p50 151 ms / p95 204 ms**, threshold 0.85 and strict deny/ZDR/no-fallback provider policy unchanged. Full conversation scope remains disabled: source handoff reports 49/51 and two misses. **Gateway runtime `07e66b7`**, `LEMMI_DECISIONS_ENABLED=1`, scope `activities`, model `typesafe/jev-1.14`, threshold `0.85`, deadline `1500 ms`. Phrase-based recap/redirects remain. Web runtime `3c5033e` and private speech were retained.

Three parallel code reviews covered routing, cancellation/privacy and provider/evaluator rollout. Fixed a discovered Quiet confirmation question: declarative “To start Teach Lemmi, say yes.” / Photo Story equivalent respects its no-question policy. Preserved deployed ASR name aliases alongside new natural invitations; no contract-size change was needed because both external text and recognized speech are already limited to 1,000 characters. Added maximum-input/history/recovery, Quiet consumed-output/confirmation, late decision after Stop/Mute/handoff/revoke/profile/privacy/policy changes, profile-isolated consent and failed-playback clearing checks. **370 tests / 5,858 expectations, no failures/skips**, type/Svelte zero errors/warnings, build, format/whitespace and production verified TLS/WSS participant/database smoke passed.

Isolated production Chromium with actual local STT/TTS and actual Jev heard fixed fictional “Can I teach you about gardening?” → fixed confirmation → spoken “Yes please” → teaching UI → next capture. One classification, zero chat-generation calls, 260 output frames, no observed capture/output-start overlap or runtime errors; Mute/Pause/Resume/typing/Stop passed. The new fictional profile correctly had No eligible topics instead of borrowing Alex’s interests. These are synthetic input/browser checks, not physical microphone/speaker/K151 or human tone acceptance. Public rollout and checks completed after the backup below. [Source findings, evaluations and ownership handoff](handoffs/conversation-routing-repair.md).


Actual public Chromium using its own new fictional profile passed natural spoken teaching request → fixed semantic confirmation → spoken “Yes please” → teaching UI, with **two completed replies / three capture requests**, no switch before the agreement, Mute/no restart, Stop and zero runtime errors. Empty-topic teaching remained truthful. No provider bodies, utterances or audio were saved. This two-utterance check establishes the flow, not a latency estimate. A separate actual public ordinary-conversation check with real STT/Jev/external chat/HFC TTS passed consumed output → another capture → Mute/Stop, zero runtime errors, **2,723 ms** synthetic voice-end to scheduled output (949 ms to submission / 1,694 ms to response metadata). This is an individual observation, not a percentile or human-room measurement. Only the rehearsal-created enrollments/profiles were removed.

Restarted **only gateway** after source/build/config/database backup at `.data/jev-routing-rollback-path`; web/speech PID and start timestamps byte-matched before/after. No migration/reset/reseed, provider/endpoint credential or speech-model change. Four services active, gateway zero automatic restarts. Current one-second browser silence and eight-second chat-provider deadline retained. Current source branches `backend-deploy` and `main` include this integration; source feature branch remains `c1b619f`. Physical microphone/speaker/K151, full assistive-technology checks and named teammate review remain pending. Rollback: set `LEMMI_DECISIONS_ENABLED=0` in protected configuration and restart gateway; reviewed literal requests remain available.

## Response and profile-entry fixes deployed — November 14, 2026

**Web/gateway runtime `3c5033e`**, based on `0f299c4`: browser silence default 1,000 ms; reviewed ASR spellings/polite invitations select Teach Lemmi; caregiver cards enroll the selected profile before conversation, with no participant dropdown and a guarded initial entry; warmer grounded fixed family replies and model guidance. Selected an 8-second external model deadline after observing a 20-second stall. No migration/new public route; current speech CPU 2+2/HFC, CUDA/Jev off. **350 tests / 5,644 expectations**, no failures/skips; type/Svelte, build, formatting and isolated production/browser checks passed. Live family follow-ups: 5/6 accepted, one Quiet reply explicitly rejected/unavailable; human semantic review pending. [Measurements, failures, bounded coverage and rollout](handoffs/voice-response-and-profile-entry.md).

Observed actual public Chromium after rollout: synthetic ordinary conversation improved from **3,193 to 2,555 ms** voice-end → scheduled output (638 ms / approximately 20% in these two individual observations). Voice-end → submission fell from **1,444 to 955 ms**, consistent with reducing the configured silence by 500 ms; submission → response metadata was 1,669 before and 1,532 ms after. Real local STT, configured external LLM and HFC TTS were used. Actual spoken **“Let's play Teach Lemmi”** then switched the public UI to teaching, with **1,513 ms** voice-end → scheduled output (949 ms to submission, 483 ms to metadata). Its new fictional profile correctly showed **No eligible topics**, without borrowing Alex's interests. Each rehearsal completed one reply, requested a second capture, then passed Mute/no restart and Stop, with zero browser runtime errors. Input was fixed synthetic audio held in memory, not a human microphone or physical speaker check. Only each rehearsal's own enrollment/profile was removed.

Caregiver card selection and absence of the participant dropdown were verified in both public checks. Deployed web and gateway after protected source/build/config/database backup at `.data/voice-response-rollback-path`; no migration/reset/reseed or credential change. Speech PID/start timestamp matched before/after. Web/gateway/speech/tunnel active; web/gateway zero automatic restarts. Existing testers must refresh and explicitly Start/Resume after the gateway restart. Software code is deployed; physical room timing, full accessibility/K151 and counterpart review remain pending. Later documentation-only commits do not change runtime `3c5033e`.

## One-action browser listening deployed — November 14, 2026

**Web runtime `d6d2ff6`; gateway `95bdcef` and private speech retained.** User prioritized microphone usability while another frontend session was active. Restarted **only web**; recorded gateway PID/start timestamp byte-matched before/after, preserving the existing authority/connections. No API, schema, migration, provider/speech configuration or existing credential change. Protected rollback pointer `.data/default-listening-rollback-path`.

After selecting a profile, one explicit **Start conversation** initializes browser sound, starts the session, unmutes through the existing acknowledged command, and requests capture. Allow the browser's microphone permission. Conversational/Guided continue with a fresh grant after actual consumed reply playback and the current waiting snapshot; no repeated Unmute/Speak actions. Mic remains off during processing/playback. Quiet takes the initial explicit turn and stays capture-off afterward. Initial silence retains its 15-second pause, without a model submission; explicit Resume restarts listening. Raw server Start, plain Unmute, reconnect and handoff never grant recording on their own.

Mute microphone and Type instead are directly visible; the listening indicator finishes speaking, while the separate Stop ends the session. Mute cancels capture/pending input and automatic continuation, preserving unrelated approved playback. Typing disables continuation and uses existing acknowledged Pause/Resume to return to capture-off ready. Pause/Stop/help, exit/background/disconnect, ownership/profile/privacy/policy changes and errors retire listening intent; late permission/output callbacks cannot reopen it. Modal Resume stays capture-off. Existing profile/lease/generation authority and WebRTC timing/twelve-frame browser credit remain unchanged. [Implementation, controls and firmware handoff](handoffs/browser-default-listening.md).

Observed: final **345 tests / 5,427 expectations, zero failures/skips** with isolated databases; pinned Bun 1.4.4 frozen install, type/Svelte zero errors/warnings, production build, formatting/whitespace, production participant/profile/media/restart and verified TLS/WSS chat smokes passed. Isolated Chromium used real bundled WebRTC detection and Web Audio with in-memory fixed Piper input, explicit STT/chat/TTS fixtures and disposable PostgreSQL. Voice, permission denied, late permission after Stop and Quiet all passed: four requested captures across start/continuation/mute/resume/Pause/Resume/typing in the voice scenario; no active input tracks remained, no runtime errors or observed output-start overlap. Denial had one request/no automatic retry; late input was stopped; Quiet had exactly one request. The earlier 344-test run was followed by a late-old-request failure regression; final run passed 345. The initial browser harness needed native certificate trust/CSP-aware setup and a valid Quiet fixture config version; corrected before acceptance.

Actual public Chromium with its **own fictional profile** passed one Start → real browser capture/resampling/automatic ending → actual local STT → configured external LLM → actual HFC TTS consumed through Web Audio → **second capture request without another click** → Mute (no restart) → Stop. One completed reply, two capture requests, zero runtime errors. Input was a fixed synthetic phrase in memory; no human microphone or audible physical speaker is claimed, no utterances/audio were logged or saved. Only that rehearsal's enrollment/profile was removed. All four services active. The frontend tester must refresh to load the new controls, then explicitly Start/Resume; their gateway was not restarted.

Runtime speech readiness remains **CPU STT 2/2 and CPU TTS 2/2**, HFC female medium. Different assigned profiles/endpoints can run concurrently; one profile has one active audio owner. CUDA remains disabled after driver init 999; Jev remains disabled after the failed prior gate. Live activity selection still uses reviewed commands. The inspected firmware `emilia/firmware-foundation/e42a6de` advertises `audio.supported:false`: backend control/PCM integration is available, but full robot capture/playback/local watchdog/hardware proof remains Emilia's work. No physical K151, full human-room/accessibility or counterpart acceptance is implied.

## German integration candidate — not deployed

`codex/tilda-german-integration`, based on `79051d9`, adds exact-ID German profile
configuration, participant language propagation, German browser controls/routing
and opt-in pinned German voice provisioning. No shared host configuration,
profile/enrollment, data or service was changed. Backend SSH hostname resolution
failed from this development machine; real German model/speech, human browser and
K151 acceptance remain unrun. See [release steps and limits](handoffs/tilda-german-release.md).
The deployed revisions recorded below remain the last observed deployment.

## Conversation UI and spoken modes deployed — November 14, 2026

**Web/gateway runtime `95bdcef`** merges `integration/frontend-backend` **`a664e7e`**, leaving that source branch unchanged. The checkout remains on `backend-deploy`. The private speech service was not restarted: CPU 2-STT/2-TTS/HFC configuration, provider/auth/device keys, current seven migration files and existing data were preserved. No migration, reset or reseed. Rollback database/source/build/config/proxy backup pointer: `.data/ui-voice-rollback-path`.

The new conversation screen, updated five-avatar art, thinking/speech presentation, typing/reply dialogs, phrase list, caregiver name/avatar controls and exit keypad are installed. Exact reviewed English commands select Teach Lemmi or browser Photo Story; Explore pictures reuses Photo Story, and Back to conversation ends the mode. Real local STT on a fixed synthetic phrase selected the reviewed garden scene over actual public browser WSS, then local TTS completed with simulated receipts (**109 input frames / 235 output chunks**), capture-off waiting and Stop. This is synthetic acceptance, not a human microphone/speaker test. Music, guessing and matching remain unavailable. Optional semantic classifications remain advisory and runtime decisions remain disabled; no failed-model phrase fallback or arbitrary model action was added.

Backend review strengthened the fictional-only check **inside the locked identity-update transaction**, retaining scoped membership/boot/revision checks, durable retry receipts, pending-work cancellation and private-field denial. Existing redirect/private context survives name/avatar edits. Replaced caller-ID suffixing with a server UUID so valid 100-character command IDs can select modes. Retained current WebRTC timing/diagnostics, twelve/four-frame browser/robot playback credit, owner-only background Pause, cancellation/revisions and eight-message transient history. The source hid safety controls in a modal; the merge keeps labeled Pause/Stop/Get help visible and inside typing/reply/exit dialogs, following experience section 3. [Detailed review and test evidence](handoffs/ui-voice-backend-review-2026-11-14.md).

Observed: **336 tests / 5,382 expectations, zero skips/failures**, including five dedicated disposable PostgreSQL databases; pinned frozen Bun 1.4.4 install, zero-error/warning type/Svelte checks in isolated and deployment checkouts, production build, full formatting/whitespace. Production participant smoke now verifies wrong/correct configured exit, safe durable name/avatar writes, stale/private-field rejection and reviewed activity command transport, alongside the retained scope/restart/media checks. Persistent-data/media/support, TLS/WSS chat/control and two long speech fixture turns (600 consumed chunks) passed. No speech-engine Python code changed; earlier 13-test Python result remains historical rather than newly rerun.

Actual public Chromium checks passed caregiver creation with avatar selection, name/avatar edit and matching database revision, public-only result shape, typed mode switching, empty-profile teaching without borrowed context, unavailable music, Pause/Resume/Stop, visible mobile safety controls/no overflow, keypad wrong/correct behavior, locked-browser mutation denial and zero runtime errors. Local mock desktop/390×844 preview also passed keyboard Escape/keypad checks. Actual ordinary synthetic speech through local STT → configured external LLM → HFC TTS passed (**177 input frames / 388 output chunks**); scoped Photo Story real caption reply/Skip/Stop/noncurrent/ended denials passed. Existing persistent key still authorizes its profile without Start/handoff. Client output scan passed **54 text assets**. Internal/mock/preview/unlisted-static paths remain 404; exact new proxy routes were syntax-checked/reloaded. Web/gateway/speech are active with zero automatic restarts; all four services active. Temporary rehearsals cleaned up only their own profiles/endpoints. The first new browser-WSS voice harness omitted Origin and was rejected; the corrected required-Origin run passed.

A private independent four-digit `LEMMI_CAREGIVER_EXIT_PASSWORD` is configured in the protected root `.env`; its value is not logged or published. This keypad is a navigation aid, not caregiver identity or OS confinement. Private caregiver APIs still require their independent authorization. Missing live configuration fails closed; local mock `1234` is not the live code. Human microphone/speaker/room noise, full assistive-technology/zoom, physical K151 and assigned counterpart review remain pending. Earlier entries below retain their historical source/runtime status.

## Previous integrated backend release — November 14, 2026

**Deployed:** gateway/private speech source **`c594130`**; web **`12a1e47`**. The checkout remains on `backend-deploy`; subsequent documentation commits do not change these running revisions. Integrated speech `cb94309`, general chat `e628faf`, Kylie UI `43a6064` and decisions `f773cfa`; existing UI alignment `a0a3797`, public Photo Story, teaching, twelve-frame browser buffering, profile/credential isolation and checkpoint recovery were retained.

Migration **`005_conversation_redirects.sql` applied** after a private database/source/build/config backup. All six earlier checksums and existing keys were preserved; no bootstrap/reseed. Speech now uses verified base Whisper CPU `int8`, **two STT + two TTS workers**, two threads each, and **`en_US-hfc_female-medium`** at 22,050 Hz. Gateway/wrapper counts match; diagnostics are off. Open conversation uses local same-origin WebRTC ending after 1,500 ms post-speech silence, manual Finish remains, and initial silence pauses without model submission. Teaching retains its separate existing amplitude endpointing/listening lifecycle. Ordinary chat, private caregiver redirect settings, fixed thread reminders, transient display and caregiver preview refinements are installed; open-chat automatic next-turn listening and voice activity launch remain unfinished.

**Semantic decisions are integrated but disabled (`LEMMI_DECISIONS_ENABLED=0`).** Actual fictional evaluations with the required deny/ZDR/no-fallback flags: Jev matched 17/21, three mismatches, one unavailable, p50/p95 173/297 ms; Luna returned 21 unavailable. Neither passed the rollout gate. No privacy settings were relaxed. CUDA also stays off: RTX 2000 Ada/16,380 MiB/580.178.04 is visible, but clean driver `cuInit(0)` returns 999 / CUDA_ERROR_UNKNOWN, even with a separate pinned cuBLAS-12 test venv. No GPU inference, reset or reboot is claimed. Tested CPU 2+2 mixed load completed 12/12 at 9.3 synthetic jobs/s; real-native STT and TTS cancellation each left the other worker running and reloaded only on a fresh explicit request. [Exact settings, measurements, failures and handoffs](handoffs/backend-integration-2026-11-14.md).

Observed: frozen Bun 1.4.4 install; general-chat-before-decisions baseline **298 passed / 5,085 expectations**; combined and post-browser-fix suites **311 passed / 5,189 expectations, zero skips/failures**, including four isolated PostgreSQL databases; **13 Python speech tests**; type/Svelte zero errors/warnings; production build, format and whitespace. Production participant/endpoint/restart/scoped Photo Story, data/media/support and verified TLS/WSS chat smokes passed with fixtures. Long speech smoke consumed 600 chunks across two turns with simulated receipts. The old speech timing test was aligned to the retained 80 ms playback lead; initial sandbox-only socket/build failures passed with required permissions.

Actual public acceptance passed: access gate and private caregiver/internal/mock/WSS denials; unchanged persistent credential read without Start/handoff; independent fictional public Photo Story with real caption reply, scoped media, Skip/Stop and ended/noncurrent denials; public synthetic PCM → actual local STT → configured external LLM → local HFC TTS (177 input frames, 326 output chunks), capture-off waiting and Stop. Temporary test enrollments/profiles were released/removed without touching existing profiles. All four services are active, web/gateway/speech report zero automatic restarts, and HTTP/gateway/speech/database remain loopback-only. Rollback pointer: `.data/backend-integration-rollback-path`; additive migration 005 remains in place for a code rollback.

Actual Chromium desktop/390×844 checks passed: native unlock, settings/disabled account fields/password availability, Games dialog Escape, no mobile horizontal overflow, typed message submission and explicit Start/Stop with capture off and zero runtime errors. Browser testing found Type instead closing after input; web `12a1e47` preserves its user-controlled open state. The inherited handoff claimed an owner-only hidden-tab fix, but merged source still paused unconditionally; that handler is now actually owner-only. Two independently enrolled browser contexts confirmed observer background sends no Pause and owner background pauses. Existing live Start conflict wording remains legacy “One mock session is already open”; the status is REVISION_CONFLICT and the actual authority remains per profile.

Human microphone/speaker, room-noise/recognition quality, full keyboard/zoom/assistive-technology, physical K151 and counterpart review remain separate pending acceptance. No full P0, clinical or unattended-care readiness claim. The original branch preparation notes below are historical and superseded by this release record.

## Concurrent testing profiles and local observer fix — November 14, 2026

Created two user-requested fictional profiles through the existing live caregiver demo UI: Casey (Test), `profile-9880c382-6d3b-447b-9125-ce4f6bdc4aec`, and Robin (Test), `profile-29da8aaa-f9d9-4860-a788-a76d46ce2420`. Both remained visible after reload alongside unchanged Alex. These are live demo records with separate empty context and the default lemming avatar, not preview cards or copies of Alex. No biography, media, contacts, endpoint enrollment or session was added. Testers select/enroll their own browser endpoint; independent cookie contexts and different profiles are still required for independent simultaneous tests. No server restart or deployment was performed.

Local, undeployed changes restrict the browser's automatic hidden-tab Pause to its connected active owner; an observer no longer automatically pauses the robot. Explicit observer Pause/Stop remain available. The backend's existing-session conflict now explains per-profile scope and explicit handoff/another-profile options instead of calling a live session a mock session. No event/schema/auth/speech-scheduler change. Sixteen targeted endpoint/scheduler/presentation tests passed (214 expectations), including a second frontend's Start rejection without taking robot ownership; type/Svelte checks and production build passed. Actual hidden-tab/browser/robot and keyboard acceptance remain pending. Counterpart review: Anay for gateway/session boundary, Kylie for visibility behavior and Emilia for physical robot rehearsal.

## Semantic conversation decisions — original branch preparation

Server operator checklist: [testing, integration, migration 005 dependency, disabled-first rollout, fictional acceptance and rollback](handoffs/conversation-decisions.md#backend-server-testing-and-rollout-checklist). Direct live model evaluation requires no deployment/restart; public browser testing requires installing the reviewed code on a staging/team backend and explicitly enabling the gateway-wide switch. This handoff is not deployment evidence.

`codex/conversation-decisions` adds an opt-in server adapter for Jev 1.14 / OpenAI Luna Decisions, wired through the existing registry and text/STT→chat→TTS coordinator. It classifies open-chat redirects, recap requests, declined suggestions and activity requests; activities do not auto-launch. It batches typed questions with validated current-profile topic IDs/probabilities, a short deadline and existing cancellation/revision authority. No decision content is persisted. Default configuration remains disabled. Live provider/privacy compatibility, latency and classification accuracy are unverified; no private configuration or deployed services changed. [Full handoff and fictional evaluator](handoffs/conversation-decisions.md).

Observed locally: zero type/Svelte errors/warnings, 95 relevant tests / 2,578 expectations passed, production build/whitespace passed. Fictional evaluator dry run reports 21 cases and makes no provider calls. Fixtures prove software behavior, including semantic reminder routing into TTS, current-profile scope, probability/ID validation, and cancellation of late decisions. Real Jev/Luna classification quality, data-policy-compatible endpoint availability, microphone/speaker/hardware and deployment remain unrun.

## Redirects and thread reminders — original branch preparation

The general-chat branch adds optional private caregiver `conversationRedirects` configuration through the existing scoped profile PATCH, backed by migration 005. Open-mode whole-phrase matches offer a subject transition; configured alternative subjects are optional and conflicting ones are filtered. The model may choose a neutral subject when none remain. A local phrase guard replaces a redirect response that repeats the avoided phrase. Recognition is bounded phrase matching, not semantic/clinical detection. Participants may continue their subject after an offer. Existing urgent/help/sensitive/refusal routes take priority. Automatic learned preferences, live caregiver editing and voice activity launch are not added.

Verification on Windows: zero type/Svelte errors/warnings and successful production build. Full suite: 246 pass, 35 skipped, 3 fail (two missing-OpenSSL TLS fixtures and one POSIX-mode expectation on Windows). PostgreSQL/migration/persistence tests were not executed without a configured isolated database. New fixture tests cover redirect precedence, optional alternatives, current-session reminders and canceled late output. These results do not establish human voice/model quality.

Explicit English lost-thread requests now produce a fixed reminder quoting the latest ordinary participant message in bounded transient context. No suitable context produces a fresh-start offer; configured away subjects are not replayed. Reminders use no provider call, storage, cross-session memory, diagnosis or preset change. Both existing typed and recognized-speech turns share this coordinator path. Migration/database acceptance and real human voice/model quality must be verified separately; no deployment occurred.

## General chat branch — original branch preparation

`codex/general-chat-handsfree` adds explicit open-conversation instructions: participant-led everyday subjects, direct answers, free topic changes and optional follow-ups. Open mode does not require teaching/catalog selection. Non-interrupting fixed replies retain the bounded recent dialogue (six messages) so an identity question does not erase the preceding subject. Stop, pause, mute, disconnect and revision cancellation continue clearing transient context. No new route, protocol, provider configuration, persistence or deployment change. Participant UI shows conversation state and up to eight transient visible messages; spoken input is not transcribed into this display. Voice activity launching and automatic open-chat turn continuation remain unfinished. Teaching and Photo Story remain accessible in a collapsed activities section.

Updated November 14, 2026 (America/Los_Angeles). Branch: `backend-deploy`.

Current runtime: gateway/private speech **`c594130`**, web **`12a1e47`**. Historical deployment entries below retain their original revisions.

## Smoother browser speech — November 14, 2026

User reported choppy voice. The transport allowed only four 20 ms frames (80 ms) outstanding, replenished after consumed-frame receipts; this can underflow when round trips exceed the remaining playback lead. Added explicit browser negotiation `playback.outputWindowChunks:12` (240 ms). Ready advertises actual 4 or 12; old/default clients and robot identities retain four. Each speech owner pins its negotiated window, including teaching/fixed replacement owners. Browser players bound queues to negotiated credit, preserve consumed-only receipts (progress every two actual frames), and cancel/wipe scheduled nodes on Stop/revision change. Generic BrowserAudio now has the same 80 ms initial scheduling lead as VoiceClient. The server's outgoing backpressure ceiling is bounded at 64 KiB for a twelve-frame burst; input frame and request limits are unchanged. No voice/model/provider/data setting changed.

Observed: 241 tests passed / 4,357 expectations, 34 database tests skipped (no isolated database was configured for this audio-only fix), no failures; type/Svelte zero errors/warnings/build/whitespace passed. New scheduling/credit tests prove contiguous 20 ms browser scheduling, no credit before consumption, twelve-frame bounds/overflow cleanup, exact refill, robot/default four and Stop/stale-receipt rejection. The initial full run's two old timing/cadence expectations were updated to the actual 80 ms lead/two-frame receipt cadence and the final run passed. Source/build/manifest rollback: `.data/smoother-audio-rollback-path`. Restarted gateway/web, all four services active. Actual public browser negotiation returned twelve using a temporary Alex browser endpoint; no session Start/handoff/model/microphone was sent and the test endpoint was released. Actual audible improvement/human voice retry remains unverified; no hardware/audio-quality acceptance is claimed.

## Teach Lemmi voice UI and checkpoint recovery — November 14, 2026

Merged the requested `b27980a` integration into `backend-deploy`, preserving deployed Photo Story, fixed-response cancellation and the original local scripted teaching panel. Public entry: `/participant/conversation` → select/enroll the fictional profile → Start conversation → Play Teach Lemmi → Start Teach Lemmi. VoiceTeaching uses the selected profile/avatar and its existing scoped HttpOnly browser enrollment at `/v1/device-stream`; it never borrows Stackchan's key or publishes the local development voice proxy. The previous session must confirm Stop before switching; Return confirms Stop before reconnecting. Explicit Start enables question/reply listening, with fresh capture grants; Pause/mute/Stop/background/disconnect disable it, and Quiet stays capture-off. The capture worklet is embedded in the bundled client. The proxy permits only the five exact reviewed avatar sprite identities in addition to existing artwork.

Reproduced the reported persistence failure mechanism in an isolated real database: a deleted rehearsal profile's cached session caused `saveSession` to reject and the global checkpoint handler to close unrelated sockets with 1011 `Persistent data unavailable`. Absent-profile checkpoints now retire that profile's in-memory work and close only its sockets; no deleted rows are recreated. Existing revision/epoch/storage failures retain their fail-closed behavior. This matches the host's earlier temporary-profile cleanup, although no private exception trace from the original reporter was retained.

Observed before restart: frozen Bun 1.4.4 install (no dependency changes), 268 tests / 4,558 expectations, no failures/skips, Svelte/TypeScript zero errors/warnings, production build and whitespace checks passed. The new regression deletes a started profile then proves another profile's live socket and durable Pause checkpoint continue. Browser transport coverage verifies the cookie socket/hello and rejects another endpoint's output/capture. Retained private source/config/database backup via `.data/voice-ui-rollback-path`; no migration/reseed/key/provider change. Validated/reloaded proxy and restarted web/gateway; all four services active, zero automatic gateway restarts. Actual human microphone, audible playback, keyboard/zoom and K151 acceptance remain separate; prior remote human voice results do not prove this deployed UI.

## Public Photo Story deployed — November 14, 2026

User explicitly requested public team testing. Runtime `dafdf4e` enables browser Photo Story on database-confirmed fictional profiles under existing `LEMMI_DEMO_ENROLLMENT=1` and the private domain gate. Open `/participant/photo-story` or a profile card's Photo Story link, select/enroll a profile, explicitly Start conversation, then Start Photo Story and Talk about this photo. The existing live controller/WSS/BrowserAudio provides typed or bounded speech replies; no local mock transport is public. Reviewed garden/park illustrations are generic captions only, with no Alex biography/context borrowed into other profiles, no runtime image analysis, and no private-photo upload. Other games remain previews/unavailable.

New browser-only owner commands are `input.photo.start`, `input.photo.action` (current activity instance/revision plus typed photo action) and `input.photo.repeat`; `device.ready.photoStory` negotiates availability and `activity.changed` carries only the safe view. Existing session/generation/lease checks and one audio owner apply. Start/navigation cancel prior output; Stop/Pause/handoff/disconnect/configuration changes invalidate delayed work. Private caregiver/profile/journal operations remain unavailable to this public coordinator. New `GET /v1/demo/photo-assets/:assetId` requires the gate and current HttpOnly browser endpoint cookie, current selected fixed scene, fictional profile, live DB device/epoch and matching revisions; exact two SVG IDs only, bounded read with locks/recheck, no-store/nosniff/sandbox headers. Standalone SVG/worklet paths remain blocked. No migration, key/provider change or worker service added.

Observed: 240 tests / 4,387 expectations with every database suite enabled and no skips; type/Svelte zero errors/warnings, production build and whitespace passed. Substantive independent review of public auth/cancellation/media/browser boundaries found no blocker. Verified real WSS owner/observer/robot denial, stale photo revisions, cross-profile caption isolation, and Stop during delayed opening. Isolated production participant/media smoke passed gate-only/noncurrent/ended denials, actual scoped SVG bytes, Talk and Stop; control/chat smoke passed. The initial broader test run exposed generation invalidation applied to mock music starts; scoped to photo starts and all tests then passed. Initial extended media smoke required updating its own explicit fixture-proxy allowlist; final end-to-end smoke passed. UI control typing errors were fixed before final clean type/build checks.

Retained private database/source/build/proxy/manifest backup through `.data/public-photo-rollback-path`; validated/reloaded exact proxy allowlist and restarted gateway/web, ending sessions without restoring capture/output. Actual public HTTPS/WSS acceptance with a separately created fictional profile passed page/enrollment/capability/Start/garden/scoped read/Talk with a real model reply/Skip/park/Stop; noncurrent and ended scene reads returned 404. Only that temporary profile/endpoint was removed. No raw audio/transcript/model text was logged or saved by the acceptance harness. No microphone/speaker/hardware or full browser keyboard/zoom test was performed; these remain counterpart acceptance work. All four services active. The teaching `4690bf6` narrow continuity fix remains included; its separate automatic-listening local demo remains unintegrated. This supersedes earlier local-only Photo Story availability statements.

## Teaching voice continuity deployed — November 14, 2026

Prioritized user request: integrated the narrow server/tests changes from Lukas `4690bf6` as `d3d4337`. Recognized teaching Next/Not sure/Like/Avoid now mint fresh server-owned speech output after the validated topic transition, keeping current session/lease/profile/privacy/policy checks, original deadline and Stop/Pause/mute cancellation. The newly selected reviewed prompt is returned. Existing UI buttons/enrollment/audio paths retained. The broader local voice-client automatic-listening loop from that branch is not deployed by this narrow fix.

Independent read-only technical review found no blocker and confirmed the missing spoken-reply path already existed in original teaching `c006d26`, before recent UI integration: topic buttons had a separate approved-prompt path, explaining different behavior. Sixty-four targeted speech/teaching/browser tests / 2,228 expectations, type/Svelte zero errors/warnings and production build passed. Tests cover consecutive spoken transitions and Stop/Pause during replacement synthesis with late-buffer wiping. Retained previous source/build/manifest via `.data/teaching-continuity-rollback-path`; restarted gateway/web once, ending sessions without restoring capture/output or changing persistent keys. Actual public HTTPS/WSS verified the existing saved persistent key, explicit Start → teaching → typed Different topic → changed topic/reply → Stop; no model/microphone call in this production probe. Actual human spoken-control quality/robot playback remain separate acceptance. All four services active, zero automatic gateway restarts.

## Live UI alignment deployed — November 14, 2026

User requested the newer UI branch; `codex/kylie-ui-refinements` was unchanged at `d8a6fe4`, while `codex/main-ui-alignment` had new checkpoint `a0a3797`. Integrated that checkpoint as `eab2c35` on top of the tested Photo Story source reconciliation. The live profile dialog now uses the reference sage portrait/five avatar cards/basic information/paper summary/empty trends design; private data/editing/upload/excerpt settings stay unavailable. Conversation uses the reference 440px maximum avatar, scene spacing, state-aware heading and responsive control bar. Connection/enrollment/speech/teaching handlers and authorization are unchanged by this UI checkpoint.

Final combined type/Svelte check passed with zero errors/warnings and production build passed. The prior full 227-test database-enabled suite and participant/data/control/long speech fixture smokes cover the reconciled backend; subsequent changes are presentation only. Installed the combined web build and restarted only web, with prior build/manifest at `.data/live-ui-alignment-rollback-path`. Gateway PID/start time remained unchanged. Public HTTPS unlock, caregiver/conversation/profile-list and root redirect passed; fetched updated profile UI bundle byte-matched the installed file. Private profile read without caregiver token stayed 401; local Photo Story page/worklet stayed 404. No new actual browser/hardware acceptance or live session/model turn was performed. Source is published to both main and backend-deploy; gateway still runs `f5724a0` and Photo Story is not a live-site activity.

## Photo Story integration source — November 14, 2026

Integrated Lukas's `codex/photo-story-conversation` checkpoint `9dfc4b6` with the current designed UI, per-profile authority and Teach Lemmi. This is an explicitly local rehearsal, not a new production activity. The running gateway remains `f5724a0`; its sessions, credentials, private data and provider settings were not changed. Public Photo Story hosting/media and production activity transport are still unavailable.

Preserved existing `conversation.submit`, teaching approved-output/cancellation and current caregiver/conversation designs while adding the pure photo reducer/context/skip/event recap and opt-in local speech operations. Rehearsal configuration requires `localOnly:true` and explicit Alex profile binding; ordinary live coordinators cannot gain activity/private caregiver operations from this merge. Removed inferred hard-coded biography from gardening interest, validated photo system inputs before dispatch, and labeled selection events without claiming actual viewing. The launcher now forces mock mode/port 3011 and resolves Vite from the actual web workspace; it cannot inherit the shared host's live gateway mode/port. Caption-only reviewed garden/park illustrations remain local; no pixels or participant utterances are persisted or sent as images.

Observed in an isolated installed Bun 1.4.4 worktree/PostgreSQL17: 227 tests / 4,163 expectations, no skips; type/Svelte zero errors/warnings and production build passed. Production participant, persistent profile/media/support and control/chat TLS smokes passed; six-second speech fixture smoke passed with 300 simulated consumed chunks. Actual local launcher/HTTP page/status/Start/photo opening/typed turn/Skip/factual journal/Stop passed with speech disabled and explicit reviewed-demo chat. The initial test had an adapter-entry synchronization race, fixed before the final full pass; the actual launcher smoke exposed and fixed an incorrect root Vite path. No new actual STT/TTS/OpenRouter, browser microphone/keyboard or K151 acceptance was run. Production integration of scoped approved pack/media availability, activity WSS and counterpart UI/firmware review remains the handoff.

## Designed public UI integration — November 14, 2026

User clarified that the intended public UI is the published branch's `/caregiver` (Profiles/Games/Ecosystem folders) and `/participant/conversation` scene, with caregiver as the landing page. The previous merge preserved its source but left these routes blocked/local and retained the separate live shell; that did not fulfill the requested experience. Web `cb64621` now serves the exact designed routes behind the existing domain gate and explicit fictional-demo switch; unlocked `/` redirects to `/caregiver`. The unlock page links to the caregiver workspace and designed conversation. Proxy allowlist adds only these exact pages and generic banner/game-picture artwork.

Dashboard profile listing/explicit creation uses existing typed live fictional setup, with independent profiles and inert labeled example cards. Conversation reuses the existing live controller, cookie enrollment, WSS, BrowserAudio and teaching controls inside the published illustrated scene. Returning to caregiver cancels local audio and pauses an owned session; opening the dashboard remotely creates no connection and sends no session command. Start/teaching text is admitted only through existing current-session/revision reply guards. No new gateway, API resource, migration, provider setting or credential was introduced. Read-only profile panels show only the safe participant projection. Private profile editing/journals remain unavailable pending separate caregiver sign-in; no private guidance/contacts/journals are exposed by the shared demo key. Games stay explicit previews and camera controls are disabled/unavailable. There is no fallback from failed live profile loading to mock success.

Observed: type/Svelte zero errors/warnings, isolated production build, 43 focused tests / 452 expectations (including new page-gate/proxy/demo-switch checks), formatting and whitespace passed. Initial type check found a nullable callback reference/declaration order; corrected before final checks. Proxy syntax validated and gracefully reloaded; only web restarted, gateway PID/start time preserved. Actual public HTTPS verified locked-page redirects, root → caregiver, caregiver/settings/check-in/sign-in and designed conversation 200, live profile-list 200, generic artwork, private profile read without caregiver token 401, mock/internal paths 404. No live session commands/model calls were sent during this acceptance; actual browser microphone/playback, keyboard/zoom and counterpart UI review remain pending. Backup build/proxy/manifest pointer: `.data/designed-routes-rollback-path`. This entry supersedes earlier claims that caregiver/conversation must stay local or root returns 404.

## Kylie UI publication merge — November 14, 2026

Merged requested `codex/kylie-ui-refinements` commit `d8a6fe4` as `733fb1c` into `backend-deploy`. Its designed components, CSS and binary artwork were already present via the earlier local-UI integration. Reconciled conflicts by preserving live/mock route separation, live enrollment/transport, scripted Teach Lemmi and approved Alex context; retained both teams' documentation. The resulting diff from prior deployment source contains only the UI publication record and whitespace in the font license: there is no new visual/behavior change. Caregiver/mock previews remain local, not newly public routes.

Built in an isolated worktree and installed that build, retaining the previous build/manifest under `.data/releases` with pointer `.data/kylie-ui-rollback-path`. Restarted only web; gateway PID/start time and active test connections were preserved. Thirty-eight focused access/browser/teaching tests / 392 expectations passed, production build passed, and the actual workspace type/Svelte check passed with zero errors/warnings. Isolated symlinked-worktree checking could not resolve generated route types; the unchanged source passed in the actual workspace. Public verified HTTPS unlock, participant/profile-list and twenty JS/CSS bundles passed; all twenty bundles and the three checked font/surface assets byte-match installed files. No session commands or real model calls were sent. No new visual browser/hardware acceptance was performed.

## Browser unlock repair — November 14, 2026

**Robot WSS conflict observation:** Emilia reported upgrade 409 at 21:17:13 UTC. Subsequent read-only checks found one established gateway socket, an Alex session in waiting/robot mode, and a deliberately incomplete upgrade probe using the existing saved `stackchan-alex` identity returned 409 / `REVISION_CONFLICT` / `Device already connected`. No valid handshake, session command, restart or credential change was sent. The user reports Lukas is testing Teach Lemmi using the shared JSON and Emilia also uses `stackchan-alex`; this is consistent with the enforced one-connection-per-identity rule. The exact historical request/remote holder cannot be reconstructed from disabled request logs. Leave the active test alone; after its client closes, retry the robot connection. Separate concurrent endpoints require separate enrollment identities and explicit audio handoff for the same profile. No robot acceptance is implied.

Emilia reported Chrome failing after Unlock. The access page sent `Referrer-Policy: no-referrer`, which makes native browser form navigations serialize Origin as `null`; the required same-origin POST check then rejected them. The earlier manually supplied-Origin HTTP check missed this browser behavior. Changed the page policy to `same-origin`, retaining rejection of missing/null/foreign origins and suppressing cross-origin referrers. Existing keys/cookies, API authorization, database and gateway are unchanged.

Deployed the isolated production build from `7ad2de1` and restarted only `lemmi-web`; all four services remain active. Previous web build/manifest retained privately under `.data/releases`, with pointer `.data/access-fix-rollback-path`. Five access security tests / 39 expectations, type/Svelte checks, focused formatting and production build passed. Initial sandbox-only attempts could not open the test socket/build worker; reruns with those permissions passed. Public HTTPS verified the new header, unlock/cookie, participant and profile-list 200, logout/cookie clearing, and null-Origin rejection 403. The user subsequently confirmed Emilia's Chrome unlock worked after this deployment. Broader counterpart review remains pending; no hardware/provider/session test was implied.

The implemented backend is deployed on `mobrob-Precision-3680`. This is a fictional multi-profile integration deployment, not completed P0 scope or readiness for unattended care.

Maintain this deployment/acceptance record alongside the [backend API reference](backend_api.md) whenever backend behavior, configuration, availability or observed checks change. Do not promote unrun checks to passed or treat a new source commit as deployed.

**Media collections deployed:** migration `002_media_collections.sql` has been applied to the existing host database after a private backup. It adds corrected album/playlist metadata only; collection APIs, reviewed-pack hosting and deferred consent/journal/help/jobs/deletion/camera workflows remain unavailable. See [schema review](handoffs/anay-app-data-schema-review.md).

## Frontend and Teach Lemmi — deployed

`anay/frontend-backend-integration` combines Emilia's `integration/frontend-backend` (`437f065`) with deployed-source `7debf9a`, retaining the deployed migrations, persistent keys, per-profile authority and chat/support hardening. It adds reviewed Teach Lemmi to the cookie-enrolled live participant shell and preserves the local caregiver/mock conversation UI. The tested build and exact generic artwork/font proxy allowlist are now installed; existing keys and all six migration files were preserved. Firmware was not flashed.

Completed Emilia's requested backend gate on an isolated worktree/PostgreSQL 17: **212 Bun tests / 3,991 expectations**, with all database suites enabled; **ten pairing-helper and seven speech Python tests**; type/Svelte, production build, formatting and whitespace passed. Dedicated migration/credential compatibility checks passed **10 tests / 74 expectations**; all six SQL files byte-match deployed source, and the conflicting old receipt migration is excluded. Production participant cookie/enrollment/concurrent-WSS/restart/release (including UI assets), persistent profile/media/support, TLS control/chat and six-second speech-output fixture smokes passed. These use fictional data, fixture providers/clients and simulated consumption; they do not establish physical browser/robot acceptance.

Fixed integration defects include preserving authoritative teaching policy on support-only saves, updating invitations on explicit support apply, fencing teaching while context saves are pending, preserving broader recognized Stop phrases, allowing only authorized fixed browser PCM while paused, suppressing late output on background pause, and exposing only the generic static art/font paths needed by the live shell. The build and explicit proxy allowlist are deployed; public voice remains explicitly enabled for fictional team testing. [Exact handoff and remaining gates](handoffs/frontend-backend-integration.md#backend-integration-follow-up--november-14-2026).

## Multi-profile endpoints — deployed

The user explicitly authorized full fictional multi-profile support on November 14. The deployed release integrates `anay/multi-profile-endpoints` (`284dcb7`) with the later persistent-key and chat/support implementation. It permits separately created fictional profiles, scoped browser/robot enrollments and independent per-profile session coordinators inside the same gateway. Existing preview cards remain static; no profile may borrow Alex's context or credentials.

| Deployed surface | Integration contract / acceptance status |
| --- | --- |
| Frontend setup | `/access` → `/participant`; explicitly enabled `LEMMI_DEMO_ENROLLMENT=1`; safe list/create/enroll/current/release routes. Public gating, participant HTML and native setup/isolation checks passed. |
| Browser client | `createParticipantSetup` and `ParticipantConnection`; 30-day HttpOnly endpoint cookie, same-origin WSS, explicit Start and local teardown. Actual browser permission/autoplay/keyboard/zoom recovery still unrun here. |
| Robot setup | `bun run enroll-device PROFILE_ID PRIVATE_FILE`; separate device identity/file for each endpoint, 30-day demo enrollment. Firmware storage/flash acceptance remains Emilia's work. |
| Existing shared key | Indefinite persistent legacy key remains valid until revoked, with null expiry; it was preserved and verified after the actual upgrade. Sharing one identity still permits one simultaneous connection for that identity. |
| Session ownership | Multiple authorized endpoints may connect; each profile retains one active audio owner. `activeEndpointId` plus explicit handoff/Resume guards conversation/media. Different profiles remain isolated. |
| Caregiver support | Existing hardening, profile membership, save/apply cancellation and revision behavior is preserved and regression-tested independently for each profile. |
| Speech | Public speech is now explicitly enabled; a synthetic public local-STT → actual-OpenRouter → local-TTS turn passed (141 input frames / 421 output chunks), with simulated playback receipts. Actual browser microphone/speaker and K151 acceptance remain unrun. |
| Teach Lemmi | Deployed through `anay/frontend-backend-integration`; owner-only reviewed topics, model replies and Pause/Finish/Resume passed an actual public fictional rehearsal. |

The deployed migration set retains all existing checksummed migrations and includes `002_multi_profile_endpoints.sql` and replaces the branch's incompatible receipt-table creation with `004_endpoint_revocations.sql`. The latter preserves legacy revoke history while introducing per-device receipts; no checksum edit/rename of an already applied migration is permitted. The upgrade and unchanged-key acceptance are recorded in the deployment section below. The frontend/Teach candidate adds no new migration; its six SQL files byte-match this deployed set.

Frontend/robot integration entry point: [endpoint contract and quickstart](backend_api.md#deployed-endpoints--frontend-and-robot-contracts), [endpoint handoff](handoffs/anay-multi-profile-endpoints.md). The current running deployment is `f5724a0`; earlier candidate observations in this section are historical.

## Persistent credentials and chat support — deployed

Persistent enrollment and chat/support hardening are deployed together. Migrations `003_communication_support.sql` and `003_persistent_device_credentials.sql` have been applied in addition to existing `001`/`002`. Both full filenames are independently tracked/checksummed; no applied migration was renamed or edited. The proxy now allows the protected communication-support read/apply paths.

Run `python3 scripts/pair-stackchan.py` for a fresh persistent enrollment by default (`--short-lived` opts out). Stackchan must accept null claim/ready expiry and store its returned key privately. Existing short-lived keys are not upgraded. Persistent keys survive gateway restart; sessions, pending codes, capture and output do not. Successful revocation remains durable, and a lost claim response still requires revoke/re-enrollment. Firmware storage and real hardware acceptance remain Emilia's handoff. [Persistent contract](handoffs/anay-persistent-device-credentials.md), [chat/support handoff](handoffs/anay-chat-support-hardening.md).


## Deployment

**Historical branch evidence, before deployment:** `anay/chat-support-hardening` adds English chat hardening and caregiver support read/save/apply with central policy, immediate cancellation, explicit continuation and private PostgreSQL configuration provenance. It includes speech fix `3fb561d` and main `a6f7ff9`; neither existing feature branch nor the deployed host was modified by this work. Final live text regression passed 15/15 after a Quiet prompt mismatch was found and fixed. No microphone/speaker/K151 acceptance follows. See [handoff and test scope](handoffs/anay-chat-support-hardening.md); current host acceptance is recorded in the deployment follow-up below.

Public origin: **https://lemmi.chaoswarrior.dev**. Open **[/access](https://lemmi.chaoswarrior.dev/access)** to unlock the outer domain gate. `/` opens the gate-protected `/caregiver` landing page; `/participant/conversation` is the designed live companion screen. The shared access key is stored privately in the host's root `.env`; it does not replace caregiver authentication or device pairing.

Traffic follows Cloudflare → `cloudflared` → loopback Nginx → SvelteKit HTTP API / Bun realtime gateway. Database, private media and speech are not public services.

| Component | Running configuration |
| --- | --- |
| HTTP API | `lemmi-web` user service, `127.0.0.1:3000` |
| Session/realtime authority | `lemmi-gateway` user service, `127.0.0.1:3001` |
| Reverse proxy | Docker Compose project `lemmi-proxy`, Nginx 1.28 Alpine, `127.0.0.1:8080` |
| Public tunnel | `lemmi-tunnel` user service, named tunnel `lemmi-backend`, four observed edge connections |
| PostgreSQL | Docker Compose project `lemmi`, PostgreSQL 17, healthy on `127.0.0.1:5432`, persistent volume |
| Private speech | `lemmi-speech` user service, `127.0.0.1:8765`, CPU Whisper/Piper; quality gate incomplete |
| Worker | Placeholder only; not deployed |

User lingering is enabled. Application/tunnel/speech services are enabled; containers use restart policies. Bun 1.4.4 and cloudflared 2026.11.0 are installed under ignored `.data/bin`. Reboot recovery has not been rehearsed. No automatic Git pull, build or deployment updater is installed.

## Authentication and persistence

- The missing live access-key wiring in `controlConfig` was repaired. Live configuration now requires an independent outer key, passed to both HTTP and WSS gate checks.
- Actual VoidAuth discovery, authorization-code login with state/PKCE and authenticated introspection passed. Issuer: `https://auth.chaoswarrior.dev/oidc`.
- This host explicitly selects `LEMMI_AUTH_TOKEN_BINDING=client_id` for VoidAuth non-resource tokens. Client identity, issuer, active status, Bearer type, expiry and assigned caregiver subject remain required. Any present audience must match the configured audience. Other deployments default to strict audience binding; there is no automatic fallback.
- The loopback-only `scripts/setup-caregiver.ts --assign-alex` helper saved the verified subject/database configuration without retaining tokens. It is setup tooling, not production browser sign-in.
- Migrations and fictional Alex bootstrap completed. The running gateway uses PostgreSQL for the implemented profile, credential-hash and bounded factual/session-checkpoint storage. Private approved media uses protected local storage.
- Revision `04d050e` fences pairing/claim writes to the current database boot owner. Stale authorities cannot overwrite a replacement gateway’s ownership or issue usable credentials.
- Gateway restart retains explicitly persistent active keys in PostgreSQL mode, clears short-lived keys/pending codes and ends sessions. Persistent devices reconnect with a fresh hello/sequence and explicit Start; no listening/playback/conversation is restored. Short-lived devices re-pair.
- Root and speech environment files are mode 0600. Provider credentials, identity identifiers, tunnel credential JSON, certificates, models, databases and private media are excluded from source control.

## Observed verification

| Check | Result and scope |
| --- | --- |
| Pinned frozen-lockfile install | Passed; Bun lockfile unchanged |
| Type/Svelte, production build, formatting, diff whitespace | Passed |
| Bun automated suite | **169 tests passed, 3,585 expectations**, including real isolated `lemmi_test` PostgreSQL |
| Production control/chat smoke | Passed with certificate-verified HTTPS/WSS and explicit identity/model fixtures |
| Production data smoke | Passed with real isolated PostgreSQL/private media and fixture identity |
| Python speech boundary suite | **7 tests passed**; fixture inference worker |
| Python pairing helper | **10 fixture tests passed** in latest endpoint acceptance; later private provisioning is recorded separately below |
| Speech WSS fixtures | Six-second output/window/receipt smoke passed; playback simulated |
| Actual private speech engines | Earlier isolated CPU turns used a fixture LLM; later public synthetic speech used actual local STT, actual OpenRouter and local TTS (141 input frames / 421 output chunks), with simulated playback receipts. Neither is a human recognition-accuracy or hardware check |
| Public access boundary | Verified HTTPS unlock, secure cookie exchange/logout, missing-key/device rejection and internal/mock route denial |
| Hostname resolution | Earlier DNS issue cleared; normal system lookup and hostname-only verified HTTPS unlock passed during redeployment |
| Actual identity provider | VoidAuth code/PKCE login and introspection passed; tokens discarded |
| Actual model provider | OpenRouter fictional greeting passed; standalone request approximately 3.6 seconds; reply/credentials not logged |
| Public computer-device path | Persistent public claim with null expiry → actual gateway restart → same-key HTTPS profile/WSS, no restored active session → Start/model greeting/Pause/Resume/Stop passed; rehearsal credential revoked |

The live computer rehearsal created its pairing through the private authenticated server authority. It did **not** exercise a public caregiver-bearer pairing request; real caregiver verification was tested separately. No physical robot, microphone, camera, real contact or notification was used. Fixture tests remain distinct from these live observations.

## Remaining limits and next handoff

**Public speech enabled for fictional team testing:** the host now explicitly sets `LEMMI_SPEECH_ENABLED=1`. The deployed bounded capture/STT→chat→TTS/output path passed a synthetic public verified-WSS turn using the actual local engines and OpenRouter, with simulated consumption receipts. This configuration change does not deploy Teach Lemmi or prove browser/physical playback. Use the [remote voice test](handoffs/remote-voice-test.md); capture always requires explicit participant action. The fixed concern/refusal path keeps capture off and the session paused, with cancellation preserved.

1. **Speech:** synthetic English recognition has been intermittent. Human English quality, actual browser permissions/microphone/speaker, counterpart review and K151 local controls remain acceptance work. Music execution remains incomplete. No unattended-use or robot voice-readiness claim follows from the public synthetic test.
2. **Product work:** production caregiver browser OIDC sign-in/dashboard, full journal/summary, notification/outbox, preferences/deletion workflows, completed activities, camera and physical K151 acceptance remain pending as described in the [API inventory](backend_api.md) and team plan.
3. **Review:** Anay reviews access/storage/deployment changes; Emilia verifies real firmware headers, pairing and independent local controls. The remote merge-verification handoff reviewed this credential fix with a regression test. Actual firmware compatibility, broader shared-boundary counterpart review and reboot/network-failure rehearsal remain outstanding.

Operations, private provisioning and service commands: [host setup](host-setup.md). General deployment topology and acceptance checklist: [backend deployment](backend-deploy.md). Observed team acceptance record: [build and demo plan](build-and-demo-plan.md).

## Redeployment of `04d050e`

The handoff was inspected and the branch fast-forwarded from `51ede5e` after isolated verification on this host. The release fixes stale database gateway pairing/credential issuance: an old authority cannot replace the current boot marker when claiming credentials. No dependency or schema migration changes were required.

A fresh frozen-lockfile install, type/Svelte checks, 91 Bun tests / 833 expectations against isolated PostgreSQL 17, seven Python boundary tests, production build, formatting, and both production fixture smokes passed before the running services were changed. The verified build was installed, gateway/web restarted, and prior source/build retained privately under `.data/releases` for rollback. No database reset, caregiver reassignment or private-configuration replacement occurred.

After restart, public gate/cookie/logout/internal-route/device-denial checks passed. A fictional computer rehearsal passed real persistent pairing authority → public HTTPS claim/profile → verified WSS Start → actual OpenRouter greeting → Pause → Resume → Stop. Its temporary credential was revoked. As before, pairing creation used the private authenticated authority; this does not claim a public caregiver-bearer pairing request or hardware test. Web/gateway report active with zero automatic restarts; PostgreSQL remains healthy. The hostname now resolves normally and verified HTTPS `/access` returns 200 without an address override.

The default mock-web smoke, a new actual VoidAuth browser login, reboot recovery, speech recognition quality and physical hardware checks were not repeated during this redeployment. The fixture identity/model checks remain distinct from the actual tunnel/model observations. Restart invalidated earlier device credentials; re-pair before testing a physical client.

## Pairing helper — November 14, 2026

Added `scripts/pair-stackchan.py`, a Python 3.10+ standard-library client for interactive VoidAuth code/PKCE login and public caregiver pairing creation. It prints a fresh, unclaimed ID/code for Stackchan, never auto-revokes/claims, and saves no tokens or configuration. Run `python3 scripts/pair-stackchan.py` from the repo root; see the [API reference](backend_api.md#python-pairing-helper) for options. Four local fixture tests passed; no live pairing/provider login was performed with this helper. No API/server behavior or deployed runtime changed; the runtime was still `04d050e` when this helper was first added; the current runtime is recorded above.

## Main integration deployment — November 14, 2026

Integrated main `24e7fe2` into `backend-deploy` as runtime commit `275de72`, retaining the existing pairing helper and historical review. Only the appended build-plan verification records conflicted; both were preserved. Application code was not changed to resolve the merge.

An isolated checkout passed Bun 1.4.4 frozen install, type/Svelte checks, **122 Bun tests / 2,480 expectations** using separate PostgreSQL 17 runtime/schema-test databases, seven speech Python tests, four helper tests, production build, formatting, and control/data/speech fixture smokes. The schema tests exercised a populated foundation upgrade and atomic migration rollback before production migration.

A private custom-format PostgreSQL backup and previous source/build were retained under ignored `.data/releases`. Applied only the reviewed `002_media_collections.sql`; the historical full app-data proposal was not executed. Alex and private configuration were preserved, with no profile reseed or database reset. Restarted web/gateway/private speech; all report active and zero automatic restarts. Voice opt-in remains disabled; no model/voice/accelerator/provider setting was changed.

Public gate/cookie/logout/internal/mock/device-denial checks and normal hostname HTTPS unlock passed. The real persistent computer-client rehearsal passed public claim/profile → verified WSS → real OpenRouter greeting → Pause → Resume → Stop; temporary credential revoked. As before, pairing creation used private server authority and no real caregiver bearer request was repeated. Three additional synthetic CPU STT/TTS turns passed an isolated verified WSS gateway with a fixture LLM and simulated consumption; numeric STT totals 869 ms and TTS totals 242 ms across three turns. No audio/dialogue was saved or printed.

No physical microphone/speaker/camera, production voice session, human recognition-quality test, fresh VoidAuth browser login, notification, reboot or venue-network rehearsal was performed. Existing devices must explicitly pair again after restart.

## Persistent-key/chat deployment acceptance — November 14, 2026

Published separate squash commits to main: persistent credentials first (`c402edc`), then chat hardening/support (`430269f`). Integrated them into backend-deploy as runtime `d067ac0`. Resolved overlapping helper additions using the tested persistent-default version; the backend integration tree exactly matched the tested main candidate. Kept both branches' verification records; the production smoke message and migration ledger expectation were reconciled to cover both features.

Persistent-only preparation passed 130 Bun tests / 2,533 expectations, six helper tests, type/build checks and the persistent production data smoke. Combined release passed 151 Bun tests / 3,371 expectations with separate runtime/schema/support PostgreSQL 17 databases, six helper Python tests, seven speech Python tests, type/Svelte, build, format, default/persistent data/support smokes, control/chat fixture smoke and six-second speech fixture output. No dependencies changed.

Backed up private PostgreSQL/source/build/proxy state, applied both new discovered migrations, installed the verified build, and validated/reloaded the real Nginx allowlist. No reseed/reset, historical full SQL proposal, public voice enablement or physical device action occurred. Post-deployment public gate/cookie/logout/route denials passed. Support GET and same-origin JSON apply without a key returned 401; the initial bodyless POST probe hit SvelteKit's 403 form-origin protection. Full support save/apply/cancellation acceptance used fixture identity and real isolated PostgreSQL, not a fresh real caregiver login.

A temporary persistent computer credential returned null expiry and survived a real gateway restart. Public scoped profile and WSS authentication passed with no active session restored. Final Start → real model reply → Pause → Resume → Stop passed, then the test key was revoked. Two initial model turns returned sanitized provider-unavailable errors under the old GLM 160-token/default-reasoning settings. A separate fictional metadata-only diagnostic returned HTTP 200/stop, 100 completion tokens including 78 reasoning tokens. Following the handoff's documented GLM configuration, the host now uses low reasoning and 512 maximum tokens; the subsequent complete live rehearsal passed. This is not proof that every earlier failure was budget exhaustion or broad semantic acceptance. Previous private configuration is retained in the rollback directory. No prompt/reply/key was logged. One immediate test attempt raced startup and created no pairing; the readiness-delayed check passed.

Persistent-key downgrade warning: old gateway code is incompatible with an active new persistent marker. Revoke persistent keys with the new implementation before downgrade, or perform a separately reviewed migration/restore. No automatic downgrade is supplied. Hardware key storage/null-expiry handling, recognition quality, actual caregiver UI and reboot/venue tests remain open.

### Pairing-helper diagnostic follow-up — November 14, 2026

A reported helper failure after the browser callback was hidden behind its generic error. Added safe stage/HTTP reporting without provider bodies or token values; eight Python fixtures pass, including error-body redaction and CLI stage output. Read-only checks confirmed real OIDC discovery is accessible, caregiver-less profile access returns 401, no active device key exists and durable revoke count is 3 (below capacity). A pending in-memory pairing was not inspected, cleared or revoked. Exact live failure cause awaits the user's next helper error; this change does not claim a new successful enrollment or alter the deployed API/runtime. For remote login, forward laptop port 3333 to host loopback with SSH, then run the helper in that session and open its URL on the laptop.

### One-file team access — November 14, 2026

On explicit user instruction, durably revoked the previous device key/pending enrollment and created one replacement persistent team-test credential. Public HTTPS claim returned null expiry; participant profile access using the resulting headers passed. Creation used the authorized private server authority; no new caregiver browser login or physical robot action was performed. The replacement is intentionally left active for the user's teammates. Its raw credential and outer key are saved only in ignored `.data/stackchan-access.json`, mode 0600; their values were not logged. Distribute that single file privately. It grants device scope, not caregiver/admin access; one active connection per device identity remains the limit; distinct enrolled devices may now connect concurrently with one audio owner per profile.

The Python helper now performs claim and writes that same bundle by default, with `--pair-only` for the previous unclaimed-code flow. It refuses to overwrite an existing bundle before making any request. Ten local Python fixtures passed, including file/claim/redaction protections. This tooling/configuration action changes no server API or deployed runtime revision and requires no service restart. No automatic key rotation/revoke is added; a lost response still needs explicit revoke/re-enrollment.

## Multi-profile endpoint deployment acceptance — November 14, 2026

Deployed runtime `17a8522` after explicit full fictional multi-profile authorization. The original endpoint branch predates the later persistent-key/chat-support work; the integration preserved that work, nullable indefinite keys, current chat guards, and per-profile support/default-save/apply/context cancellation. Parallel technical reviews added transaction/epoch/membership fencing and four credential/migration regressions plus a cross-profile support regression. Teach Lemmi was reviewed only; it still requires registry/ownership/timer/live-shell adaptation and was not merged.

Before production restart, the isolated integrated tree passed frozen Bun 1.4.4 install, type/Svelte, **169 Bun tests / 3,585 expectations** with separate PostgreSQL 17 runtime/schema/support databases, ten helper and seven speech-boundary Python tests, production build/format, participant-cookie/concurrent-endpoint/restart/release smoke, persistent data/support smoke, TLS control/chat fixture and six-second speech fixture output. Existing applied migration contents were byte-checked unchanged. These fixture smokes use simulated clients/model/playback, not physical hardware.

Backed up private database/environment/proxy and previous source/build under ignored `.data/releases`. Applied `002_multi_profile_endpoints.sql` and reconciled `004_endpoint_revocations.sql` through the normal checksum runner; no previously applied migration changed, no existing profile was reseeded and no existing credential was rotated. The original conflicting branch receipt-creation migration was not applied. The old private revoke table is retained as `legacy_device_revocations` and command identities copied to the new device-scoped table. Enabled only fictional `LEMMI_DEMO_ENROLLMENT=1`, installed the validated scoped proxy allowlist, and restarted web/gateway. Voice settings/model/key remain unchanged.

Observed after deployment: the existing shared persistent file still authenticates public scoped profile reads; its values were neither printed nor changed. Public `/access` returns 200, locked `/participant` redirects to `/access`, unkeyed `/v1/demo/profiles` returns 401, internal/caregiver/root paths return 404, and unlocked participant HTML returns 200. Created two explicitly named fictional rehearsal profiles through public APIs, enrolled distinct robot identities and connected them simultaneously over verified public WSS. Start/Pause/Stop stayed isolated by profile and audio negotiated false as configured. Revoked only those rehearsal endpoints and removed only the newly created rehearsal profiles through host-admin cleanup. The user's shared key was preserved and left active. Web/gateway report active with zero automatic restarts. No physical browser interaction/microphone/speaker/camera, new real caregiver login, real-model multi-profile conversation, reboot or venue test was performed.

Frontend integration may use the same-origin participant clients and browser cookies now; robot integration may create a separate protected enrollment file/device ID per endpoint. Sharing one legacy key still identifies one device and does not create independent concurrent connections. See [current API quickstarts](backend_api.md#deployed-endpoints--frontend-and-robot-contracts) and [endpoint handoff](handoffs/anay-multi-profile-endpoints.md).


## Public speech enablement observation — November 14, 2026

On the existing `17a8522` runtime, the deployment owner enabled public speech in private host configuration. An actual synthetic public HTTPS/WSS rehearsal passed granted PCM capture → local STT → real OpenRouter → local TTS → bounded PCM output and simulated receipt consumption: **141 input frames / 421 output chunks**. This is an actual provider/transport observation, separate from candidate fixture checks. It does not establish human recognition quality, audible playback, microphone capture, browser permission/autoplay behavior, physical robot controls or a completed frontend/Teach deployment. No raw audio, transcript, generated reply or credential belongs in this record.


## Frontend/Teach deployment follow-up — November 14, 2026

Installed runtime **`f5724a0`**, containing both requested branches, on `backend-deploy`. Added a reviewed regression fix so finishing teaching while paused preserves pause until explicit Resume. Final isolated acceptance: **213 Bun tests / 4,045 expectations, zero skipped/failed**, type/Svelte, production build, formatting, ten helper and seven speech Python tests; built participant/assets/enrollment/concurrent-WSS/restart/release, persistent data/support, TLS control/chat and six-second bounded speech fixture smokes passed. The 49-file browser output secret scan passed. All six deployed migrations byte-match; no migration, reset or reseed was needed. A private database/source/build/config backup is retained in ignored `.data/releases`.

Actual public HTTPS/WSS checks passed existing shared persistent-key access, isolated fictional profile creation/enrollment, Start → Teach Gardening → actual model reply → Beaches → Pause → Finish remains paused → explicit Resume → Stop, with capture off and separate profile authority. Rehearsal enrollments and only their fictional profiles were removed. Host-admin SQL cleanup leaves in-memory rehearsal coordinators until restart; the gateway is restarted after cleanup before final availability checks. This is test cleanup, not an implemented participant deletion API. The shared key was preserved. Exact generic avatar/surface/font URLs return 200; caregiver/mock conversation/internal/README paths remain 404.

The user explicitly approved enabling `topic:gardening`, `topic:beaches` and `topic:banking` for fictional Alex; applied through the guarded profile update path, without biography facts or remembering permission. Newly created profiles still need their own approved interests; there is no unrestricted teaching fallback. Existing sessions affected by configuration require explicit Resume.

Remote team test: [voice and participant handoff](handoffs/remote-voice-test.md). Actual browser microphone/autoplay/speaker and K151 local controls remain unverified.

The post-install actual public voice recheck passed **138 input frames / 276 output chunks**, using local STT, the configured real OpenRouter model, local TTS and simulated consumed receipts, ending capture-off and stopped. Initial repeats closed with a persistence error because host-admin test cleanup had removed profiles while their coordinators were still resident; clearing those rehearsal coordinators by restarting the gateway resolved it. The final gateway restart after cleanup preserves keys and leaves sessions/capture/output stopped. All four user services are active with zero automatic restarts.

Public post-restart acceptance: gate-protected conversation page, all five actual sprite images, temporary fictional profile creation/browser-cookie enrollment, owner Start, teaching topic selection and actual local TTS prompt output passed with paced simulated consumption. No microphone capture or audible-playback claim. Initial harness receipts ran too quickly and hit the existing control budget; the corrected run passed prompt speech. Its later typed topic-change assertion incorrectly expected a spoken response from the text-only input path; that harness assertion is not evidence of a voice failure. Actual spoken teaching-control continuity is covered by the automated STT/TTS/WSS regression. Cleanup releases/removes only the temporary rehearsal endpoint/profile.

## Caregiver controls and spoken activity selection — local candidate, November 14

Based on fetched main `01b6ffb`; **not deployed**. Fictional demo setup adds a
strict name/avatar update through `/v1/demo/profile-update`, using the existing
serialized profile update, revision checks and session cancellation. It accepts
only assigned fictional demo profiles and returns the public participant shape.
Private biography, approved facts, guidance, contacts and privacy settings retain
independent caregiver authorization. No database migration or credential change.
The production proxy allowlist must include `profile-update` when this is deployed.

Explicit English requests for Teach Lemmi, Photo Story or Explore pictures now
select through the existing session authority from typed or recognized input.
Fresh speech output survives the authorized generation transition; Stop/Pause and
profile changes still cancel it. Photo selection requires an enabled browser;
other built-in games return a factual unavailable response. Explore pictures
reuses reviewed Photo Story scenes. No new game engine or model-selected action.
New profiles reuse existing PostgreSQL creation; the caregiver form now includes
avatar selection and opens the newly created profile. New profiles still need
separately authorized interests before eligible teaching topics are available.

Verification and remaining review are recorded in the build plan. Browser UI
inspection, human voice, PostgreSQL and deployed proxy acceptance remain pending.
Anay reviews setup/auth/cancellation; Kylie reviews UI/keyboard/responsive behavior.

Candidate verification: Bun 1.4.4 suite **250 pass, 34 database skips, zero fail**
using canonical `/private/tmp`; type/Svelte checks and production build passed.
HTTP preview returned 200. Browser visual QA and actual database writes were not
verified; no deployed version or provider/hardware acceptance changed.

### Local voice-only mode entry refinement

Replaced card-like/game-launch controls on the conversation views with one shared
plain-text phrase list. Existing explicit connection, microphone and safety
controls remain; connection details are collapsed. Broadened reviewed English
entry phrases and added return-to-conversation/finish-mode routing in the same
coordinator. No-topic teaching and Just look photos still permit an explicit
bounded capture for mode selection; grants, revisions, endpoint ownership,
Stop/Pause/mute and cancellation remain authoritative. The standalone voice panel
connects/starts a session without silently selecting a game. Main, default mock
conversation and voice-panel entry screens share the phrase list.

Observed: 255 Bun tests passed, 34 database tests skipped, zero failures; type/Svelte
and production build passed. Ten mode-selection tests include every displayed
entry phrase via synthetic STT/TTS and receipts, exit/switch behavior, no-topic and
Just look recovery, and Stop suppressing late output. Local preview returned 200.
Actual human microphone/venue/browser visual acceptance remains pending. Not
deployed. Music/guessing/matching live hosting is still unavailable.

### Restored exit number pad and single-screen conversation — local candidate

Conversation exit now uses the original four-digit number-pad interaction with
server verification. Local demo code is `1234`; live has no default and requires
an independently configured four-digit `LEMMI_CAREGIVER_EXIT_PASSWORD`. Added
same-origin lock/verify operations, bounded attempts, HttpOnly/SameSite cookie
locking and dashboard/profile-mutation guards. Client navigation also opens the
exit gate; active owned audio is canceled/paused before exit. Browser/profile
credentials are not replaced by this navigation gate. Two new proxy paths and
private live passcode configuration are needed before deployment.

The participant and local-preview routes reuse one centered conversation screen.
No app title/menu or preview navigation is rendered there. Removed the bottom
button bar per user correction; browser controls open from microphone status.
Tapping listening status stops local audio/capture immediately. The square avatar
is centered above spoken phrases; the main viewport does not scroll, while typing,
long replies and passcode entry use dialogs. Explicit capture remains required.

Observed: 259 tests passed, 34 database tests skipped, zero failures / 4,497
expectations; final type/Svelte check had zero errors/warnings and build passed.
Actual localhost HTTP check verified lock, dashboard redirect, wrong-code rejection
and successful four-digit demo unlock using a separate test cookie. Chrome's
accessibility tree confirmed the exit prompt and absent app menus before the
final keypad/centering adjustment. Full-window screenshot was automatically
rejected because unrelated browser tabs/metadata could be captured; no screenshot
was taken. Final mobile pixel layout and actual voice/hardware remain unverified.
No deployment or live credential/configuration change occurred.
# Alex private photo album candidate — not deployed

`codex/alex-photo-story-pack`, based on Anay’s `5efffcf`, selects saved Alex non-portrait photos instead of garden/park fixtures. Uploaded images remain private media; source contains no photos. The existing gated image route accepts UUIDs with locked profile/device/gateway/revision/policy checks and PNG-only bounded responses. Album edits cancel old work; an empty Alex album disables Photo Story. Other fictional profiles retain their existing neutral pack. No migration or new public command.

The five user-approved photos and descriptions were saved through the hosted caregiver editor and confirmed after reopening; cooking and My Way excluded, Bunny/Guided and memory-off retained. This is a data update, not deployment of this source. Focused 78 tests/848 assertions passed. Full local run:395 pass,42 skip,4 environmental failures (two missing OpenSSL, Windows POSIX permission assertion, missing VAD WASM dependency). Windows dependency installation also fails SvelteKit lifecycle; complete check/build and PostgreSQL/hardware acceptance remain unverified. [Exact review and rollout handoff](handoffs/alex-photo-story-pack.md).
