# Emilia — Stackchan restart handoff

## Next decision — stop speculative firmware trials

Emilia accepted the flash audit and asked what next. Read
[send-stall investigation](stackchan-send-stall-investigation.md). Source review
found the pinned TCP send budget=5744 bytes and default writable low-water=2873;
SO_SNDBUF/SO_SNDLOWAT are unimplemented. This is a concrete constraint but not
proof of the actual network acknowledgment timing or sole failure cause.
The right next step is payload-free transport/Anay proxy timing evidence and
RAM/throughput budgeting before choosing a custom pinned TCP library build,
nearer TLS gateway, or jointly negotiated compact envelope. No new upload or
spoken trial in this investigation. Keep 0.9 stopped; do not promise another
queue/timeout patch fixes it, or ask Emilia to repeat the same conditions.

## Latest 0.9 failure and flash audit — do not repeat blind hardware trials

At 06:11:35 UTC, acknowledged Speak/listening/capture-on was followed by
`voice_send_failed reason=6 status=2 result=0 bytes=0 send_max_ms=112
capture_sent=4`. This is a bounded TLS-write timeout with zero bytes accepted
for the failing batch, after four successfully sent capture frames; not a mic
driver fault or a parser rejection. Capture-off/disconnect followed. User saw
the failure before speaking. New physical capture acceptance FAILED.

Emilia asked whether updates were actually flashed. Read only nonsensitive
fields from private upload manifests: 0.7/0.8/0.9 all exitCode=0 and distinct
application hashes. Latest application hash is
`b3ae04303afb1b166eefd35465e8c0b71b8faa082464caf2add464a9a3cc58df`,
matching the current build exactly (1,471,824 binary bytes). Earlier direct
receive-only observer confirmed firmware=lemmi-voice/0.9 at 06:09:23 UTC.
Thus stale flashing is not supported by the evidence. Do not confuse verified
transfer, host tests or idle boot with a successful live audio repair. No new
upload during this audit. Next investigate the persistent TLS send stall using
transport/socket scheduling evidence, rather than another speculative buffer
increase or another same-condition user speech trial.

## Voice 0.9 batch-send candidate after repeated overflow

0.8 actual ready/window=12, Resume/Unmute succeeded. Speak at 06:05:07 UTC
opened capture, then code=2 at 06:05:09: send_max_ms=72, capture_sent=76,
heap_free=81192. Local capture-off/disconnect followed. TLS retries did not
resolve sustained backlog; capture acceptance remains FAILED. Do not ask for
the same turn without a substantive sender change or call this a mic failure.

0.9 collects up to four complete individually masked WS messages into one
bounded 8,192-byte TLS batch. It allows 60ms collection or dispatches when four
messages accumulate; controls/reads continue between batch opportunities. Input
JSON schema, PCM framing, per-message sequence and 12-slot/240ms capture bound
are unchanged. A fresh random mask remains per frame. Each batch retains each
message's epoch/input-epoch/mute cancellation token and rechecks them before
every write attempt. Cancelled unsent batch is discarded; partially transmitted
cancelled batch closes the connection. Buffers/tokens are wiped after each flush.
Only actual successful batch completion increments the capture-sent counter.

Sustained host driver rehearsal passes >200 capture frames over ~4.4 seconds
with independent 16ms mic buffers and simulated 72ms network-write stalls,
preserving order, queue age under 240ms and Finished. Tests also verify byte-
exact concatenation, frame/byte caps, erasure, overflow shutdown, cancellation,
TLS transient/partial/error/deadline handling. These tests are synthetic, not
proof of venue throughput or smooth sound. Queue/network memory and physical
Stop/capture/playback need real-device verification. No scope change to camera,
petting, avatars, motion or backend. Preserve all earlier working targets.
0.9 native build: 1,471,671 program bytes /151,964 globals; known audio stack
path 1,568 plus 2,048 reserve passes. Schema fixtures/19 Python privacy+stack
checks pass; backup preflight and actual four-image upload verification pass.
Only verified repo helper PID 95122 was gracefully closed. Eight-second direct
observer saw 0.9 selftest/boot at 06:09:23 UTC, reset USB=11, heap_free=178216,
loop_min=1180, streams zero. Observer closes before private provisioning.
Fresh connected heap, capture, intelligible reply and under-load Stop remain
pending. No microphone/camera/motion was activated during the upload check.

## Voice 0.8 bounded-write candidate after 0.7 send-path exit

0.7 actual ready/window=12 at 05:58:21 UTC; connected free heap ~84KB.
Resume/Unmute applied. Speak at 05:59:17 opened capture; ~2.8s later the worker
exited stage=link and disconnected, capture-off, without a mic fault, local Stop
or parser rejection. Emilia confirms this happened WHILE speaking, before
Finished. The branch indicates sendVoice failure/abort, but 0.7 did not log the
underlying TLS result; do not claim a confirmed transient-error root cause.

Source inspection: installed TLS writer may return short positive writes,
zero-byte poll timeout or explicit WANT_READ/WANT_WRITE. 0.8 keeps the same
combined masked frame stable and retries ONLY zero/WANT statuses or remaining
bytes, bounded by 100ms and 128 iterations. Hard negative errors still close.
Each attempt rechecks local abort/epoch/Stop/mute/input cancellation. Cancelled
unsent work is discarded without breaking the connection; cancellation after
partial framing closes it. Numeric send_failed reason/status/result/bytes and
capture-send counters distinguish allocation, age and transport failures.

Host ASan/UBSan tests pass exact write ordering across partial/WANT/zero returns,
hard errors/no retry, timeouts/clock rollover and Stop cancellation. Voice driver
regression, exact schemas and all 19 Python privacy/stack tests pass. No buffer
or server grant enlargement. Physical capture, completed playback and Stop under
load remain unverified. Only the verified repo helper may be closed for upload;
private reprovisioning will be needed afterward.
Actual 0.8 build: 1,470,943 program bytes /143,708 globals; stack guard passes.
Backup preflight and actual four-image hash verification passed. Verified repo
helper PID 93455 was gracefully closed first. Receive-only observer confirmed
0.8 selftest/boot at 06:03:19 UTC (reset USB=11, heap free=186472,
loop_min=1180, capture/camera off). USB observation ends before provisioning;
do not mistake this boot-only result for a successful capture turn.

## Voice 0.7 — confirmed capture-queue overflow, transport candidate

0.6 authenticated at 05:52:29 UTC with audio=1/window=12/en, paused/owner=1.
Resume and Unmute applied. Speak at 05:54:17 UTC: grant accepted/listening,
capture-on, then `voice_fault code=2 send_max_ms=45 capture_sent=8
heap_free=83476`, followed by local Stop/capture-off/disconnect. **Outgoing
capture queue overflow is confirmed.** Mic begin/record failure was not the
first cause. The 12-chunk output window was not exercised by this failed turn.

0.7 preserves verified TLS/SDK HTTP upgrade but encodes each masked WS frame
into one fixed 4,104-byte worker buffer and ONE TLS write. The installed SDK's
old sender writes header and payload separately; avoiding two writes is a
latency candidate, not a measured fix. Fresh esp_fill_random mask per send;
partial write closes rather than retry/interleave corrupted frames. No private
payload prints. Buffer is wiped after each send, including failure.

Capture queue now allows at most twelve 20ms PCM frames plus one reserved
input-end slot, with a 240ms enqueue-age check before sending. No frames are
dropped/padded/replayed to conceal stalls; overflow/old current input fails
closed. Stop/mute/revision/owner invalidation still clears all queued work.
Network dispatch remains bounded per loop so control/heartbeat can progress.
The existing 12-frame OUTPUT bound remains separate from this input queue.

Checks pass: combined-frame boundary/mask/erasure ASan/UBSan; driver tests for
240ms stalled consumer, reserved Finished slot, continued overflow failure,
first-cause retention, full output-buffer Stop and cancellation; 19 Python
privacy/stack tests; exact fetched schemas. Native voice: 1,470,303 program bytes
/143,692 globals; known stack path 1,568+2,048 reserve passes. Connected heap,
actual send times and capture/playback/Stop need new physical checks. Verified
repo helper PID 91605 was gracefully closed before the backed-up upload.
No new live turn is started by the agent. Next: private helper/Connect, retain
the same observer, then actual grant/state → explicit Speak rehearsal.
Actual upload passed all four image hashes. Eight-second receive-only observer
confirmed 0.7 selftest/boot at 05:57:21 UTC and one unchanged idle memory sample:
heap_free=186488, loop_min=1180, worker unsampled, streams zero. Observer closed;
USB is free. Control-only native regression compile also passes (1,347,447
program bytes /53,300 globals). This is idle boot, not successful capture.

## Current voice 0.6 diagnostic — 0.5 capture fails locally

0.5 actual handshake at 05:45:38 UTC confirms audio=1, output_window=12,
language=en, TCP_NODELAY=1/Wi-Fi sleep=0. Connected heap ~98KB; Resume at
05:46:16 and Unmute at 05:46:30 applied. Speak at 05:46:44 was ACKED, listening
and actual capture-on. ~250ms later generic audio_error/local Stop/disconnect
occurred, capture-off. No server rejection, new boot, or output chunks observed.
This is FAILED capture acceptance, not a failed twelve-chunk negotiation.
The old generic fault cannot establish mic begin/record failure versus send
queue pressure. Do not claim a confirmed cause or just increase queues.

Prepared/uploaded diagnostic 0.6: preserve first failure as enum 1..12 and emit
fixed `voice_fault code/send_max_ms/capture_sent/heap_free`. Code 2=outgoing
queue full, 7=mic begin, 10=mic record. Other mapping is in VoiceBridge::Failure.
No queue limit/window expansion or protocol bypass. Local cancellation precedes
the diagnostic. Network counters reset per connection; sent counts successful
capture-frame sends, not dropped/stale data. Both observers strictly allow these
numeric diagnostics and reject appended private text. Host tests reproduce
stalled-consumer/full-queue and mic begin/record failure, preserving first cause.

19 Python tests, driver ASan/UBSan, fetched schema fixtures pass. Native 0.6
compile: 1,460,051 program bytes /129,636 globals; known audio stack path 1,568
plus 2,048 reserve passes. Backup preflight/four-image upload verification pass.
Gracefully stopped only verified repo helper PID 89393 before upload. New
provisioning is required; agent's bounded boot observer will close before user
runs the single one-hour private provisioning/observer. Next: Connect/actual
12-frame grant → Resume/Start → Unmute → Speak once, inspect first fault code.
No physical fix or smooth speech result is claimed by this diagnostic upload.
The post-upload ten-second receive-only observer returned ZERO recognized
events and closed normally. Boot is therefore unverified for 0.6; do not claim
idle acceptance. Next private helper's nonsecret probe must confirm the sketch
before sending any configuration. If it does not, inspect the physical screen
and safe boot diagnostics rather than repeatedly sending secrets or reflashing.

## Voice 0.5 — 240ms negotiation finished and uploaded

Resumed the pasted account handoff; preserved all existing uncommitted files.
Fetched backend-deploy `f3e3b41`: Anay's deployment notes record gateway
`264df22` granting robot 12-frame credit in negotiation and all speech-owner
paths, with 4-frame fallback. This is backend-owner evidence; the K151's new
live negotiated grant remains to be observed after private reprovisioning.

Finished firmware 0.5: request 12, honor strict 4|12 actual grant, fixed 12-slot
decoded ring/14-slot ingress queue, two stable driver blocks, short-tail-aware
prebuffer, consumed-only progress paced at 40ms plus final tail. Added numeric
link/ready diagnostics to both filtered observers with privacy tests. Local
server-muted state now affects the mute label/action and redraw. Wi-Fi modem
sleep disabled and TCP_NODELAY set/read back on the TLS socket; these are
latency mitigations, not a measured root-cause or smoothness claim.

Checks passed: 19 Python tests, ASan/UBSan playback bounds (12th accepted/13th
rejected), negotiation/fallback/malformed window, full-buffer Stop/revision/owner
cancellation, 49-chunk ring-wrap/odd-tail/receipt pacing rehearsal, control policy,
voice driver and exact fetched Zod fixtures. Synthetic 100ms replacement delay
has no waits with 12 slots; four-slot rehearsal still shows waits. Voice native
compile 1,459,819 program bytes /129,612 static globals; known audio path 1,568
plus 2,048 reserve fits the 8,192-byte loop stack. Control-only compile
1,347,447 /53,300. Static RAM grew 34,496 bytes; actual connected heap remains
to be checked. Backup/image/esptool preflight passed.

After verifying PID 83580 was only the repo's provisioning observer, gracefully
interrupted it to free USB. Direct 0.5 upload PASS, all four hashes verified.
Twelve-second receive-only observation confirmed selftest/voice 0.5 boot at
05:43:24 UTC, reset=11; two idle samples were unchanged: loop low-water free
1,180 bytes and heap free 200,568 bytes, worker unsampled/streams zero. Observer
closed normally. No live speech/camera/motion started by agent.
Next: one private provisioning helper/Connect, keep it open. Inspect
`voice_ready audio=1 output_window=12 language=...` and connected memory before
Start/Resume → Unmute → Speak. Physical smoothness and full-buffer Stop are
still REQUIRED; prior choppy playback remains a failed acceptance result.

## Keep one USB connection open — observation expiry interrupted next attempt

After Emilia reported another Start, the prior provisioning observer had reached
its 600-second limit; the file stopped at 05:18:29 UTC and no process held USB.
No new Start could be verified from that stale file. The agent attached the
existing receive-only monitor to recover observation, but a fresh 0.4 boot was
observed immediately at 05:20:47, reset=11 (USB), clearing RAM provisioning.
Treat that attachment as an interruption, not a successful session continuation.
Do not repeatedly close/reopen USB during a live test or assume RAM survives it.

The provisioning helper now defaults to a bounded one-hour observer (1–3600s),
keeping the SAME port handle after the private Wi-Fi prompts. All 19 existing
Python regressions pass. No firmware change/upload is needed. The agent closed
only its verified monitor process; USB is free for one fresh private provisioning.
Next: user runs the helper and Connects, LEAVES IT OPEN, and agent reads only
the filtered file. Avoid direct USB observation while it owns the port. The
separate receive-only monitor's 10-minute maximum remains unchanged.

## 0.4 connection accepted; shared session ended before Unmute

Filtered log confirms 0.4 ready/ack at 05:09:45 UTC, then no active session.
Start applied at 05:11:59 → ready/owner=1. A physical local Stop was recorded
05:12:15 and ended the session. New Start at 05:13:17 → ready/owner=1. At
05:15:06 the server sent ended/stopped while the connection remained up, without
a corresponding local Stop or command ack in this log. Local mic_unmuted at
05:15:07 occurred AFTER that end, so it did not unmute an active server session.
No capture/stream occurred. The ending actor/cause is unknown: other authorized
participant clients can Stop this shared profile; do not invent an idle timeout
or blame the user's touch for an event with no local Stop receipt.

Known intermediate UI issue found by source inspection: server session.start
defaults micMuted=true, while firmware's local micMuted setting may carry over
from the ended session. After restarting from this condition, an explicit
Mute → Unmute pair can resynchronize, with capture still off. A future firmware
increment should reconcile local mute on a NEW session before final avatar UI;
do not pretend the local button alone proves the server is unmuted. Prioritize
getting a physical playback result without another unnecessary reflash first.
Keep competing Alex participant views inactive during the focused robot test;
the log alone does not establish that a browser caused this end.

## Current installed — voice 0.4, ready-language compatibility; reconnect next

After Emilia returned and provisioned 0.3, Connect failed with
`voice_reject stage=ready_fields` at 05:00:25 UTC, upgrade=101/ready=0. Freshly
fetched backend-deploy `5ef554a` now emits `device.ready.language` (en/de), which
the prior strict ready allowlist omitted. This source change matches the observed
rejection; no raw live message, credentials or text were printed.

0.4 accepts only that optional enum, defaults legacy absent language to en,
stores it in the safe mirror and uses it for Speak's label/payload. Malformed,
duplicate and unknown fields remain rejected transactionally. An owned capture
grant must match the negotiated language; changing profile language on an
existing connection may require an explicit stopped reconnect. No automatic
capture or camera permission is added. Invalidation now precedes diagnostic
printing and transport cleanup on rejected input/disconnect, so the UI task can
stop local audio before either blocks.

Real-cJSON voice and default-control sanitizer tests, driver sanitizer tests,
19 Python checks and exact `5ef554a` schemas pass. Voice native build:
1,424,111 program bytes / 95,116 globals; known audio stack path 1,552 plus 2,048
reserve passes. Control-only compile: 1,347,327 / 53,300. Original backup/image
preflight and final direct upload both pass with four image hashes verified.
The agent gracefully interrupted only the verified repo provisioning observer
holding USB, then closed its own bounded receive-only observer after upload.

Direct 0.4 boot observed at 05:04:43 UTC; two idle samples through 05:04:53:
loop_min=1260, heap_free=235064, worker_min=0 (unsampled), no stream activity.
No repeated boot or capture/output observed in that interval. Authentication,
new handshake acceptance, full speech quality and German hardware speech remain
pending. Next: Emilia privately reprovisions Wi-Fi using the same credential
file and taps Connect; inspect the filtered file before Start/Speak. No new
pairing, credential rotation or backend edit is needed for this compatibility fix.

## First speech heard, playback failed — 0.3 uploaded idle while Emilia is away

**Current installed checkpoint:** direct voice 0.3 upload passed all four image
hash checks, then a receive-only 20-second observer saw selftest/boot/version
0.3 at 04:38:40 UTC. Three idle samples through 04:38:54 were unchanged:
loop_min=1276, heap_free=235064, worker_min=0 (unsampled), and stream received/
consumed/buffer_waits all zero. No camera, speech, mic or motion was activated.
The observer exited and released USB. Wi-Fi/provisioning remains RAM-only and
was cleared by upload; private reprovisioning/Connect and the next physical
speech/Stop test await Emilia's return. No request for input was left pending.

0.3 validation actually passed: 19 Python tests; C++ ASan/UBSan incremental
frame decoder, playback window, two-slot voice driver and latency rehearsal;
schema fixtures against freshly fetched backend-deploy `ddecdc9`; pinned voice
compile (1,423,915 program bytes / 95,116 globals) and unchanged 1,552-byte known
audio stack path plus 2,048 reserve; control-only compile (1,347,183 / 53,300),
backup/image dry-run and actual upload. Default control target retains its
SDK read path; only the opt-in voice target uses the incremental reader.

Latest physical turn on 0.2: authenticated reconnect 04:24:25 UTC; no active
session then. Start at 04:24:54 → ready/owner=1; Unmute at 04:25:15 → ready.
Speak at 04:25:32 → listening and actual capture-on. Finished at 04:25:36 →
capture-off/processing, followed by playback-on at 04:25:38. Emilia heard the
beginning of a real reply, very choppy, then connection failed at 04:25:42:
SDK WS read -1/opcode NONE=256, upgrade=101, Wi-Fi associated/errno=0. Playback
went off locally. This is a FAILED voice/playback test, not completed speech.
No new boot or reduced watermarks were logged during the turn.

Emilia is away and explicitly asks to work without further input. No new spoken
turn/camera/motion is authorized by her absence. Continue independent code and
verification, keeping the robot capture-off/stopped. Prepared 0.3 replaces the
voice target's ambiguous SDK WS read with bounded incremental frame assembly
over the same verified TLS transport. It adds two stable speaker slots,
four-chunk prebuffer/rebuffer, coalesced consumed-progress receipts and numeric
stream counters. Default control target keeps its SDK reader. Current protocol
fixtures validate against freshly fetched backend-deploy `ddecdc9`.

See [Anay audio handoff](anay-stackchan-audio-window.md): the gateway AND speech
owner currently restrict robot output to four 20ms chunks. Synthetic 40ms
feedback is covered without waits; 100ms exceeds that window and produces waits.
No robot-window expansion or backend edit was made; Anay/Emilia review is needed
before advertising a larger window. Transport/smoothness fixes need physical
verification when Emilia returns. No additional private credential entry is
requested while she is away.

## Voice 0.1 startup failure → 0.2 stack fix and access update

Follow-up filtered log: 0.2 reached authenticated ready at 04:20:29 UTC with
paused/stopped owner=0. Explicit robot handoff later produced applied ack and
paused/stopped owner=1 at 04:22:21 UTC: ownership transfer succeeded, without
capture. At 04:22:48 UTC transport exited `stage=read result=-1 opcode=256
upgrade=101 errno=0 wifi=3 reason=0 ready=1 age_ms=95092`, then connect_failed.
Thus current endpoint is disconnected; the handoff itself did not fail.
No confirmed disconnect cause; age includes setup, not time since ready.
Idle/connected samples kept loop_min=1276, worker_min=14432 with no new boot.
Next: one explicit Connect, inspect paused/owner state, then separate Resume.
No credential rotation, new pairing or blind flash is justified by this exit.

**Latest observed:** approved direct CLI upload of 0.2 PASS, matching device,
all four image hashes verified and reset requested. A subsequent approved
receive-only 20-second observer saw selftest/boot/version 0.2 at 04:18:35 UTC,
then three periodic samples through 04:18:49 with loop_min=1276 and
heap_free=237016 unchanged; worker_min=0 means not yet sampled (not connected).
Boot reset code was 11 (USB reset in the installed SDK). No additional boot or
panic was observed in this short interval. This verifies only upload/idle boot,
not provisioning, TLS, capture/playback or the old failure's exclusive cause.
The observer closed normally; port is available for Emilia's private Wi-Fi
provisioning. Next: run the existing credential helper, enter Wi-Fi privately,
then local Connect while its filtered observer stays open. Agent can inspect
the filtered file; direct CLI upload/observation is now available when the
user's helper releases the port.

Emilia provisioned 0.1 and tapped Connect, then reported Provision via USB again.
Filtered log contained only selftest/boot, no authenticated ready. Do not repeat
credential entry or mark voice connected. Native disassembly found a definite
stack-budget defect: loop 752 + tick 4,256 + cancelAll 3,536 = 8,544 bytes,
already exceeding the pinned core's 8,192-byte loop stack before other callees.
This is a source/binary defect consistent with a reset, not an observed reset
reason or confirmed exclusive cause of the failed connection.

Prepared voice 0.2 moves UI-owned temporary frames into static adapter storage
and worker temporary frames into single-worker storage, wiping after use.
Native frames now total 1,552 bytes on that path (752 + 768 + 32); a new build
guard requires an additional 2,048-byte callee reserve within the loop stack.
The guard is a known-path check, not whole-program stack proof. Numeric boot
reset/heap and periodic loop/worker stack watermarks are now allowlisted.
Pinned compile: 1,420,219 program bytes / 93,164 static globals. All 19 Python
checks (16 helper/privacy + 3 stack guards), host driver ASan/UBSan and private
backup/image upload preflight pass. Physical fix verification remains pending.

**Access update:** Emilia explicitly reports Full Access and requests direct
Terminal/USB operation. Native Terminal app access remains tool-blocked; do not
try an alternate UI automation route. After Emilia closed her serial helper,
default-shell USB open was denied but approved elevated shell execution of the
existing receive-only monitor succeeded at 04:16:49 UTC, reporting voice 0.1
boot. Thus the older blanket agent-serial restriction below is historical;
approved direct CLI upload/filtered observation is now available. Private Wi-Fi
entry still belongs in the user's interactive local helper. No secrets are read
into chat. Voice 0.2 direct upload is in progress; verify transfer/boot before
marking it installed or requesting provisioning.

## Next hardware step — voice 0.1 prepared, not uploaded

Latest user receipt: Emilia reports voice-target upload PASS, with all four
flash images written/hash-verified and hard reset requested. Installed target
is now voice 0.1 by this user-reported upload sequence; boot/screen, negotiation,
actual mic transmission and audible speech remain unverified. Next: existing
private credential provisioning, then explicit Connect. Do not Start/Speak until
the connection statuses are checked. This receipt supersedes the pre-upload
installed-control status in the preparation notes below.

Emilia authorized application/hardware integration. The restored control 0.9
checks below passed; installed target remains control, not voice. A separate
`--target voice` now opts into the same TLS/provisioning/control source plus
`SpeechWire.h`, `VoiceBridge.h`, `PlaybackWindow.h` and zeroing fixed queues.
Full details and source/test limits: [voice rehearsal](../../firmware/stackchan/lemmi_voice/README.md).

Goal of this increment: Start → Unmute → explicit Speak → granted mic capture →
Finished → actual STT/LLM/TTS reply on the speaker, with local Stop/mute and
no capture on reconnect/unmute alone. English first, fictional/generic content.
Camera/petting stay unsupported in this intermediate build. Emilia confirms
the final connected UI should use the existing avatars/petting; image-dependent
activities use the companion screen. Servo investigation remains stopped.

Checks actually passed: real-cJSON speech protocol and old control regression
ASan/UBSan; host mock-driver ASan/UBSan (capture/end, receipt ordering,
Stop/mute/scope/revision/disconnect cancellation); queue erasure and concurrent
ordering; voice fixtures against backend-deploy `9257de1`; 16 provisioning/log
privacy tests; pinned ESP32 voice compile (1,416,979 program bytes / 86,188 globals)
and original-backup/four-image/esptool 4.12.0 upload dry-run. Final playback uses
mixer consumption and a provisional 100 ms DMA drain guard, not observed audible
completion. No physical voice, runtime heap/latency, secure F13 or avatar-sync
result is claimed. No device serial access or upload by agent.

Next user step: close the helper if still running, upload `--target voice` with
the existing backup/tool environment, then report PASS/error. After that guide
the existing private credential provisioning and Connect, one short step at a
time. Inspect filtered voice events from `build/control-monitor.log`; do not
request pasted secrets, run a second same-identity WSS client or rotate keys.
If the service declines negotiation, UI explicitly shows VOICE OFFLINE.

## Integration resumed — control restoration prepared

At 03:33:29 UTC filtered log confirms local Stop/disconnected after explicit
Disconnect; at 03:34:37 UTC explicit Connect reached ready then
`phase=ended stopped=1`, owner local=1, capture/camera off. Reconnect does not
restart interaction. This closes the restored control subset; watchdog under
network failure and actual media cancellation remain pending.

Emilia confirms connected avatar/petting UI and picture-free robot activity
scope; recorded in integration-contracts section 6. Added firmware-only
`audio/PlaybackWindow.h`: four bounded decoded output chunks, native-rate sizes,
exact end/tails, actual-consumption counter and stale epoch/callback rejection.
Host ASan/UBSan passes and pinned compile-only playback probe passes (309,444
program bytes / 31,856 globals). No upload or audio capability change. Next:
integrate serialized transport/driver ownership, current grants/revisions and
speaker-consumed receipts; SDK queue/buffer-release flags alone do not prove
I2S drain. Preserve separate offline avatar/feasibility targets; servo work off.

At 03:33:06 UTC, filtered helper log records `control_mic_unmuted` with
capture/camera off after Stop. No ready/listening transition followed in the
inspected log. This verifies the control-only local unmute indication; actual
capture gating awaits the audio-enabled adapter. Next: explicit Disconnect,
then separate Connect and verify stopped reconciliation without Start.

Directly inspected filtered `build/control-monitor.log`: Pause at 03:30:01 UTC
was acknowledged/applied and projected paused; explicit Resume at 03:30:15 UTC
was acknowledged/applied and projected ready. At 03:32:20 UTC local Stop emitted
`control_local_stop`, followed by applied acknowledgment and
`phase=ended stopped=1`. Local ownership remained 1 and capture/camera stayed off.
Control-only Start/Pause/Resume/Stop now observed on restored 0.9 against the
current service. These host receipt times do not measure physical Stop latency
or actual media cancellation. Existing helper's filtered file can be read by the
agent; Emilia need only report when she has acted while that observer runs.

November 15, 2026, 03:29:40 UTC user-supplied fixed statuses confirm
`control_ready`, applied acknowledgment and safely ended/stopped initial state.
At 03:29:42 UTC, after explicit Start: applied acknowledgment,
`phase=ready stopped=0`, `owner local=1`. Thus restored control 0.9 connects and
starts a session owned by `stackchan-alex`; camera/capture remain off. The updated
probe helper was followed by successful provisioning/connection; this does not
prove the earlier USB failure's cause. Next: Pause in the same observer/session,
then explicit Resume and Stop separately. No speech/camera media acceptance.

After the successful upload, Emilia confirms the screen says Provision via USB.
Two provisioning attempts returned no probe confirmation, with no secrets sent.
Cause is unresolved; the screen establishes a running control UI, not USB RX/TX.
Helper now retries only `control.probe` once per second for up to 15 seconds,
preserving fragmented replies and refusing credentials without the exact ready
line. No reset/DTR/RTS change, firmware change or new upload. All 15 helper tests
pass, including late fragmented response, bounded silence/wrong response,
selftest failure and short-write rejection. Physical helper retry pending.

Emilia reports the control restoration upload PASS: all four flash images
written and hash-verified; hard reset requested. This is user-reported upload
evidence, not a new connection or screen/touch acceptance. Confirmed endpoint
is `stackchan-alex`, assigned to `profile-alex`. Next: private provisioning using
the existing credential file, then explicit local Connect and fixed-status review.

Emilia authorizes the next application/hardware integration work. Inspected
firmware `e4c4cb6` and freshly fetched backend-deploy `9257de1`; see
[current integration audit](emilia-hardware-integration-audit.md). Control 0.9
recompiled successfully: 1,346,047 program bytes / 53,060 static globals.
Real-cJSON parser ASan/UBSan and fetched-schema compatibility checks pass;
provisioning 12 tests, PCM/control-policy sanitizers also passed in this audit.
Fresh post-build upload dry-run verifies original backup, four images and
esptool 4.12.0. No serial access or upload by agent.

Next: Emilia runs one local upload of the preserved control target, then reports
the fixed result. After upload, privately provision the existing credential and
explicitly Connect; verify current service/control behavior before adding media.
This temporarily replaces offline feasibility; accepted offline targets remain
preserved. Audio/camera/petting still advertise unsupported in control 0.9.
Backend camera relay remains unavailable; bounded speech transport exists on the
backend and needs the firmware adapter. Servo work stays disabled.

## Latest accepted checkpoint — feasibility 0.8 speaker blue restored

Emilia reports 0.8 upload PASS, then confirms audible speaker tone, blue lights
and lights off afterward ("all work"). Speaker/blue/off retest passes by user
observation; regression resolved in that test, root cause/latency unmeasured.
Installed target is offline feasibility 0.8. Green mic was observed on 0.6,
yellow camera/expiry/local Stop on 0.7; no separate 0.8 mic/camera/early-audio-
Stop retest recorded. Pink petting remains accepted/preserved in separate display
0.7. Backend deferred, motion disabled; no new upload or serial access by agent.

## Latest candidate — 0.8 blue tone-test window

Emilia clarified tone plays but lights stay off on 0.7. Prepared feasibility
0.8: replace speaker polling flag with a bounded one-second test window after
successful local tone submission; initialize before starting its deadline.
Stop/errors cancel it; old/duplicate acceptances cannot reopen/extend. This is
an offline test indicator, not actual-consumption evidence for live speech.
Yellow camera and green mic are unchanged. Host gate/color/hardware sanitizer
checks pass. Hardware root cause remains unconfirmed; no upload yet. Next:
upload then speaker-blue first, camera-yellow afterward.

## Current issue — feasibility 0.7 speaker light regression

Emilia reports speaker no longer turns lights blue after yellow update. Mark
0.7 speaker/blue failed; 0.6 pass remains historical. Asked whether tone still
plays and lights stay off or yellow; awaiting result before firmware changes.
Inspected gate/policy/driver source; no confirmed cause. Do not claim yellow
priority itself causes this or request a blind flash. Camera yellow/expiry/
local Stop observations remain valid. Backend deferred; no motion work.

## Latest hardware receipt — local camera Stop passed

Emilia confirms red Stop during a fresh feasibility 0.7 camera preview turns
off both preview and yellow lights. User-observed local Stop/off and earlier
automatic expiry/off now pass; no measured latency. Installed target remains
feasibility 0.7. Green mic/blue speaker were observed on 0.6; pink petting is
preserved/previously accepted in the separate display target. No backend,
motion, remote camera or live speech acceptance. No further flash performed.

## Latest hardware receipt — feasibility 0.7 yellow/expiry

Emilia reports upload PASS, then confirms yellow with the locally allowed camera
preview and lights off at automatic expiry. Physical camera color/expiry pass
by user report. Earlier 0.6 mic green and speaker blue observations remain
separate. Early local Stop/yellow-off on 0.7 remains pending; next guide a fresh
Camera → Allow → early red Stop. No backend or motion; pink display preserved.

## Latest request — yellow camera on feasibility 0.7

Emilia confirms 0.6 local camera preview with green/blue off, then requests yellow
for camera activity. Prepared shared yellow policy plus initialized-camera wiring
in feasibility 0.7. Request/start waiting stay unlit; Stop/expiry cancel camera
and request lights off. Hardware light failure blocks camera start/stops active
test. Host yellow priority/Stop/register and local gate checks pass. No upload;
physical yellow/Stop/expiry remain pending. Guide one local upload then Camera →
Allow; keep backend deferred and motion disabled. Pink display preserved.

## Latest hardware receipt — feasibility 0.6 colors

Emilia reports upload PASS; mic test shows a moving green level bar and green
top light; speaker test shows blue. Physical color observations confirmed by
user, no agent serial observation. Automatic off, unlit Unmute, early Mute/Stop
and camera coexistence on 0.6 remain pending. Next guide local camera test one
step at a time, then remaining light-off/Stop checks. Offline only, no backend.

## Latest follow-up — reuse offline mic/speaker/camera menu

Emilia asked to test colors using the earlier actual peripheral tests. Prepared
feasibility 0.6: green for running mic port, blue for driver-playing test tone,
off on idle/camera/Stop, existing camera Allow/expiry preserved. No backend or
motion. Pinned compile passed (635,903 program bytes / 74,172 globals), including
the SCCB link guard; local-gate/light/hardware-adapter host sanitizer tests pass.
Original backup/four-image/esptool dry-run passed. No serial opened or upload.
Next: guide one local upload using `--target feasibility`, then hardware steps
one at a time. This temporarily replaces avatar/petting; restore display for
pink petting afterward. [Rehearsal](../../firmware/stackchan/feasibility-checks.md).

## Latest request — defer backend, prepare activity lights

User deferred control upload/backend reconnection. Leave installed offline
display in place. Prepared shared green capture / blue actual speech / pink
petting policy and LED adapter; Stop overrides all, audio overrides pink.
Offline display still has no audio. Host sanitizer checks and pinned display/
presentation compiles pass. No upload, serial access or backend request.
Live audio wiring and physical green/blue verification remain pending; see
[presentation notes](../../firmware/stackchan/presentation/README.md).

## Display 0.7 user acceptance — pink lights only when petted

Emilia confirms the requested pet-triggered pink-light behavior works after the
0.7 update instructions, then requests push. Avatar/hearts plus 1.2-second pink
lights are the accepted offline fallback. No servo/probe controls remain in
the display sketch; servo communication/motion remain failed and work is stopped.
No network, camera, microphone or app-avatar synchronization is enabled here.
Formal measured Stop latency, sustained load, sensor-failure and all-five layout
checks remain unrun unless separately recorded in prior receipts.

Pre-push verification: host ASan/UBSan body/LED adapter, control policy and real
cJSON parser checks pass; all 12 provisioning/privacy checks and fetched backend
schema fixture/hello/handoff validation pass. Display 0.7 pinned compile and
backup/image/esptool upload preflight passed during preparation. Whitespace check
passes. No real speech/provider/camera or independent-use acceptance is implied.


## Display 0.7 — pink only on petting, servo controls removed

Emilia clarified that pink must appear only when petted. This new lights-only
request authorizes the behavior update/upload; the explicit stop on servo
investigation remains in force. Prepared display 0.7 starts LED RAM off, keeps
lights off on Resume, turns dim pink on with recognized petting hearts, and
turns them off at the same 1,200 ms deadline. Tap-anywhere Stop/sensor failure
also clears hearts/lights. All five avatars and reduced-motion setting remain.

Removed diagnostic arming control and all power-up/probe/servo-action paths
from the display sketch. Stopped menu now says MOTION DISABLED; there is no
ARM PROBE button. Body startup retains only the VM-off request and LED setup;
no UART initialization or servo traffic is used by the display flow.

Host adapter ASan/UBSan checks pass initial LED RAM black, exact pink words,
clear-to-black and no UART/servo traffic in that LED path. Existing gesture
ASan/UBSan checks pass. Pinned compile passed: 2,860,847 program bytes /
26,444 static globals. Backup/four-image/esptool dry-run and whitespace checks
passed without serial access. Hardware verification
of off at boot/Resume, one-stroke pink+hearts, automatic off and immediate Stop
remains pending; no servo test is requested or authorized.


## Final servo attempt — stopped at Emilia's requested limit

November 15, 2026, 00:40:53 UTC allowlisted hardware receipt on display 0.6:
servo_probe battery_mv=4155 yaw=timeout_empty pitch=timeout_empty off=1,
followed by display_stop. Both servo read probes received zero bytes. Battery
monitor reports 4.155 V; off=1 confirms only VM latch readback, not measured rail
voltage or physical torque. Servo communication/movement acceptance FAILED.
Root cause remains unresolved; native UART/pull-up changes did not resolve it.

Emilia explicitly limited this to the final diagnostic attempt and requested
pink lights as fallback. Stop servo investigation: no further probe, power-up,
firmware upload, baud/ID scan or motion experiment is authorized by this task.
Installed 0.6 has no servo writes/goals in the display flow and remains unarmed
at boot; do not use its ARM PROBE control again. Explicit RESUME DISPLAY returns
to the offline avatar with petting hearts and steady pink lights, leaving probe
unarmed after completion. Tap-anywhere Stop suppresses effects. No new upload is
needed to use that fallback. Live backend work remains paused; no media enabled.
Future motion work requires a fresh user request. Pet-triggered color changes
were not implemented; do not claim lights currently react to petting.


## Display 0.6 diagnostic-only preparation — after native UART failure

Emilia reports 0.5 four-image hash-verified upload PASS; the supervised attempt
again showed yaw_probe / timeout_empty. Native UART did not resolve communication.
Movement remains FAILED and disabled in prepared 0.6; no new root cause claimed.

Official power-board schematic was visually inspected via a locally rendered
PDF: TX_EN is derived by board circuitry from Servo_TX, not a separately exposed
software direction control. INA226 monitors BAT_IN near the battery path, not
the switched VM output. A monitor voltage is not a VM voltage measurement.
Source: https://m5stack-doc.oss-cn-shenzhen.aliyuncs.com/1205/SCH_Power.pdf

0.6 replaces stopped ARM SWAY with ARM PROBE (TABLE). Motion is unarmed at boot.
Explicit arm/Resume/stroke/release powers the rail for the existing settle time,
reads INA226 register 2 (1.25 mV/LSB; existing pinned INA226_Class confirms scale),
and sends read-only torque-register probes to IDs 1 and 2. No torque writes,
servo goals, mode, ID, baud or calibration writes are in the diagnostic flow.
Power-up itself may twitch due to servo defaults; use only supervised clear table.
After both bounded reads it requests VM off and enters stopped PROBE COMPLETE,
with battery millivolts and Y/P result codes in the footer. No automatic rerun;
Stop still cancels pending power/probe. Off=1 logs only latch readback, not voltage.
The helper allowlists the fixed diagnostic line; no raw payload logging added.

Host adapter sanitizer tests pass diagnostic read-only packet inspection, both
IDs, battery scaling/unavailable read, no/partial/valid replies and VM-off request,
as well as prior initialization/failure checks. Final pinned compile passed:
2,870,479 program bytes / 26,476 globals. Backup/four-image/esptool dry-run
and whitespace checks passed; no serial access.
No 0.6 hardware upload or probe observation yet. Pink-on-active and pet hearts
remain the fallback; requested pet-triggered color changes remain unimplemented.


## Display 0.5 candidate — checked native UART transport

Emilia confirms head movement worked with original factory firmware. That is
prior hardware evidence, not proof of current supply/wiring/servo configuration.
0.4 yaw_probe / timeout_empty remains the latest observed Lemmi result.

Prepared 0.5 replaces Arduino HardwareSerial in the body adapter with native
UART1 driver_install/param_config/set_pin/write/read calls matching upstream
SCSerial.cpp's transport choice. Pins/format remain TX6/RX7, 1 Mbps, 8N1.
Initialization now checks errors, rejects an occupied UART without deleting its
owner, cleans up only its own failed installation, and enables VM only after
successful UART setup. RX FIFO threshold is explicitly 1 byte, RX timeout 2
symbols, to make short replies observable. TX completion is checked before the
same 12 ms bounded reply window; wait is pdMS_TO_TICKS(2)+1 ticks, so actual
latency depends on scheduler tick period. Physical Stop latency is unmeasured.
No retry, baud/ID scan, EEPROM write, expanded motion or bypassed probe/ACK.
This is a transport compatibility candidate, not a confirmed root-cause fix.

Host adapter ASan/UBSan tests pass previous scenarios plus occupied UART,
installation/configuration failures and TX-completion failure. Existing valid
simulated servo path remains covered; no physical communication is simulated as
hardware acceptance. Pinned compile passed: 2,871,363 program bytes / 26,476
static globals; private-backup/four-image/esptool upload dry-run and whitespace
check passed without serial access. Hardware upload/attempt pending. Motion remains off at
boot and actual movement acceptance remains failed until observed.

Primary source rechecked November 15:
https://github.com/m5stack/StackChan-BSP/blob/main/src/drivers/FTServo_Arduino/src/SCSerial.cpp


## Display 0.4 candidate — VM pull-up and read-only servo probe

Emilia confirms the USB cable is in the base. Upstream M5StackChan.cpp explicitly
sets VM pin 0 pull-up; the local adapter omitted that configuration. 0.4 adds
read-checked pull-down disable/pull-up enable while holding the output low.
This is a source discrepancy, not a confirmed explanation of the timeout.
An operator-armed attempt now reads yaw torque register 40 before the existing
mandatory acknowledged torque-off writes. Probe timeout vs write timeout can
therefore be distinguished without bypassing any failed acknowledgment. Timeout
status distinguishes zero received bytes from an incomplete reply. No servo ID,
baud, movement limits, power dwell, persistent registers or retry policy changed.

Host BodyHardware simulation ASan/UBSan passes VM pull/unrelated-pin preservation,
no boot servo traffic, failed pull setup, no-reply/partial/read-only reply failures,
no goals after rejected prepare, successful simulated path and VM-off requests.
These are simulated registers/UART only, not measured rail/servo behavior.
Existing sway/packet ASan/UBSan passes. Pinned compile passes: 2,872,555 program
bytes / 26,540 static globals. Backup/image/esptool dry-run passes, no agent serial
access. Hardware upload/diagnostic retry pending; physical movement still FAILED.

Reproduce new adapter check:
```sh
c++ -std=c++11 -Wall -Wextra -Werror -fsanitize=address,undefined -I firmware/stackchan/tests/body_hardware firmware/stackchan/tests/body_hardware.cpp -o /tmp/lemmi-body-hardware-test
/tmp/lemmi-body-hardware-test
```
Sources reviewed November 15:
https://github.com/m5stack/StackChan-BSP/blob/main/src/M5StackChan.cpp
https://github.com/m5stack/StackChan-BSP/blob/main/src/drivers/PY32IOExpander/PY32IOExpander.cpp
https://github.com/m5stack/StackChan-BSP/blob/main/src/drivers/FTServo_Arduino/src/SCSCL.h

Pet-triggered color changes remain requested but unimplemented; current active
lights are steady pink, off while stopped. Preserve that distinction in hardware
reports. Backend testing remains paused at Emilia's request.


## Display 0.2 hardware receipt and 0.3 diagnostics — November 15

Emilia reports top-strip hearts work. Lights appeared pink after explicit Resume;
no petting is required for the current steady active-display pink behavior.
Stopped menu displayed ARM SWAY (TABLE). Static mode initially prevented arming;
after setting static mode off, SWAY ARMED was observed. After Resume and one
stroke/release, Emilia observed no head movement and the menu showed MOTION FAULT.
Servo/power/movement acceptance FAILED in that attempt; leave motion disarmed.
The failed stage was unavailable in 0.2; do not infer torque, UART or pose cause.

Prepared 0.3 adds fixed servo failure-stage and transport-status diagnostics to
the stopped menu footer and allowlisted serial monitor. It retains explicit
arming, bounded pose checks, no automatic retry and power-off request on failure.
No broader travel, persistent writes, new dependencies or live integration.
Host sway/packet ASan/UBSan checks passed. Pinned compile passed (2,872,415
program bytes / 26,540 static globals); backup/image/esptool upload dry-run
passed without serial access. Hardware
upload and a separately supervised diagnostic attempt remain pending.


### Observed control 0.9 Start — November 15, 00:00:43 UTC

Emilia's fixed-status receipt shows ack applied=1, state phase=ready stopped=0,
and owner local=1 after explicit Start. Initial ended snapshot reported local=0;
the new active session is owned by Stackchan. Capture/camera remained off.
Connection remained present from ready at 00:00:01 through Start at 00:00:43.
Pause/Resume/Stop on 0.9 and sustained transport remain pending; no voice/media
acceptance. Next: local Pause while the same observer remains open.


### Observed control 0.9 connection — November 15, 00:00:01 UTC

Emilia reports upload PASS, then same-credential RAM provisioning and local
Connect. Fixed statuses: control_ready, control_ack applied=1, and control_state
phase=ended stopped=1; capture/camera off throughout. Ready compatibility is
hardware-observed. This establishes connection and safe stopped synchronization,
not sustained transport, Start/control acceptance on 0.9, voice or camera.
Next: explicit local Start with the same bounded observer open.


## Control 0.9 continuation — November 14, 23:56 UTC rejection

Emilia reports 0.8 upload PASS; local manifest confirms all four image hashes
and the uploaded application matches the prepared 0.8 build. New Connect still
rejected ready_fields after WSS 101, ready=0, capture/camera off.
Fetched backend-deploy advanced from 2b833ef to 01b6ffb: ready now also emits
optional boolean photoStory (false for robot). This is a second reproduced
source mismatch consistent with the live rejection; no raw live payload read.
Control 0.9 accepts only that boolean metadata; no photo execution or media
permission added. Both teaching/photoStory absent/false/true accepted;
malformed, duplicate and unknown keys rejected transactionally in real-cJSON
ASan/UBSan tests. Fixture/hello/handoff validate against fetched shared schemas.
Pinned compile passed: 1,346,047 program bytes / 53,060 static globals.
Backup/four-image/esptool upload dry-run, 12 helper/privacy tests and whitespace
check passed. No agent serial access. Hardware upload/Connect pending.


Updated November 14, 2026, after the final 19:29:53 UTC hardware receipt.
This document replaces the earlier chronological restart notes. Detailed evidence
remains in the checks documents linked below. No secrets are included here.

## Start here: workspace and preservation

- User: **Emilia**, Lemmi firmware/device owner. Guide hardware/Terminal work
  **one short actionable step at a time**; wait for her result before the next.
- Repository: `/Users/emiliavu/Documents/ChatGPT/VibeHacks`.
- Branch: **`emilia/firmware-foundation`**. Inspect working tree before changes.
  HEAD at handoff preparation: `4e8993f` (app data schema proposal); previous
  firmware implementation commit: `2795e3e`. Main `be1e096` was merged via
  `56ccfaa`. This does not establish that deployed backend source is current.
- **Latest firmware/helper/results/handoff changes are uncommitted and not pushed.**
  Do not reset, clean, discard, checkout over, or replace them with remote files.
  They are the tested continuation, not disposable leftovers. Inspect diff first.
- Read `AGENTS.md`, this document, `firmware/stackchan/README.md`,
  `firmware/stackchan/control-checks.md`, `firmware/stackchan/hardware-checks.md`,
  `docs/robot-capabilities-spec.md` and `docs/integration-contracts.md`.
- Anay owns backend/contracts, Kylie UI/art, Lukas activity logic/content.
  Stay in Emilia's firmware slice; no second backend/session authority. Secure
  F13 precedes integrated F14. Standalone offline petting was explicitly authorized.
- Preserve private original flash backup and private device credential file.
  Never print or commit credentials, Wi-Fi details, private logs or raw media.

## Current hardware checkpoint — 0.7 read failure after accepted ready

### Latest actual installed checkpoint — control 0.7 restored; ready rejected

Emilia chose server reconnect and reports control upload PASS; original credential
unchanged. Two helper probes timed out without sending secrets. A deliberate RST
disconnected USB (monitor Errno 6); port returned, reopened monitor observed
selftest_passed/boot/control 0.7 at 23:39:59 UTC. After stopping monitor, private
RAM provisioning succeeded. Connect at 23:41:20 UTC upgraded WSS 101 but failed
protocol ready_fields, ready=0, attempt age 3776 ms. No further Connect requested.

Found fetched backend `2b833ef` emits optional boolean device.ready.teaching,
missing from 0.7's strict allowed keys. Preparing 0.8 narrow compatibility fix,
with real-cJSON malformed/duplicate/unknown-field tests, boot check and exact
backend-schema validation passing, plus all 12 helper/privacy tests. Source-
fixture mismatch is consistent with live rejection; no raw live payload captured.
This does not enable teaching/audio/camera. New compile/upload checks pending.
Installed display/petting art is currently replaced by control, all preserved.
No report of display 0.2 upload; pink/head-motion hardware still untested.

0.8 compile now passed (1,346,007 program / 53,060 globals), as did upload dry-run
and whitespace check. Hardware pending. Open helper must be stopped before local
upload; then same private credential-file provisioning, Connect once and inspect
fixed statuses. No agent serial access or key changes.

### Latest preparation — pink LEDs / physical head sway, 0.2 awaits upload

Emilia explicitly requested physical head sway after petting and pink lights.
Prepared display 0.2 using narrow official register/protocol adapters; no full
BSP, dependency changes, EEPROM/calibration or pitch goals. Steady dim pink on
active display, lights/VM off on Stop. Physical motion OFF at boot: stopped menu
ARM SWAY (TABLE), then Resume; one release-delayed measured-position ±6-tick
yaw sweep and return, Stop/new touch/static override, no reaction queue.
Placement/holding cannot be sensed; first powered tests require secure table,
clearance and supervision. Servo power-up response/twitch, real power-off and
Stop latency remain unverified. Do not imply hardware motion acceptance.
Installed 0.1 remains unchanged; preserve `build/display-0.1-preserved/` plus
original private backup. 0.2 sanitizer policy/packet tests, pinned compile
(2,871,551 program / 26,532 globals), upload dry-run and whitespace check passed.
No agent serial access or upload. Next one local upload step, then inspect pink
with motion still off; arm only during the subsequent explicit table rehearsal.
Exact commands/limits/sources: `firmware/stackchan/motion/README.md`.

### Latest requested screen direction — display target awaiting upload

Latest follow-up: Emilia confirms tap-anywhere Stop suppresses reactions and
opens stopped controls. Explicit RESUME DISPLAY on release returns the avatar
and restores petting without immediately re-stopping. These checks pass by user
observation on installed display/0.1; all-five layout, physical latency, sustained
load and sensor-failure recovery remain unverified. App sync/live voice pending.

Subsequent hardware receipt: Emilia reports upload PASS and confirms the large
centered character on black plus top-strip hearts without a prior Enable action
("yes perfect"). `lemmi-display/0.1` is now installed. New display-target
tap-anywhere Stop/Resume, all-five rendering and latency/load remain pending.

Emilia requests a centered largest-fit character on black with no ordinary menu
and petting always enabled. Added separate `lemmi-display/0.1`, `--target display`;
installed `avatars/0.1` and its source/build are preserved. Petting auto-enables
on boot and explicit Resume; TAP ANYWHERE is local Stop, which opens the stopped
control view and suppresses reactions until explicit Resume on release. Failure
stays stopped/unavailable. No audio/camera/network/live app selection added.
Compile passes: 2,860,287 program / 26,404 globals, plus 153,600 runtime canvas;
90% partition means integrated TLS/audio needs a separate flash/memory plan.
Rendered exact RGB565 idle/hearts preview inspected; existing gesture executable
and backup/image/tool upload dry-run pass. Hardware upload/behavior pending.
Next guide one local `upload.py --target display` step after observers stopped.
See `firmware/stackchan/lemmi_display/README.md`. All work local/uncommitted.

### App-avatar/voice preparation after offline acceptance

Added isolated `presentation/AvatarPresentation.h` and host cancellation/revision
tests plus compile-only `--target presentation`. Host ASan/UBSan and pinned ESP32
compile pass (309,780 program / 22,248 globals); not wired into control/avatars,
no upload and installed avatar preview unchanged. Fetched backend ref now resolves
to `2b833ef` (no merge/service request). Existing paired-device profile GET can
supply avatarId/revision; WSS snapshots lack avatarId. Speech schema exists but
control still negotiates unsupported audio. Detailed exact seam, scope/driver
responsibilities and owner handoff: `firmware/stackchan/presentation/README.md`.
Next work is bounded authorized profile read and real capture/output/cancellation
adapter, then bind avatar/frame rendering. Do not claim app sync or live voice yet.

### Latest continuation — offline avatar target prepared, not uploaded

Subsequent hardware receipt: Emilia reports `--target avatars` upload PASS and
confirms explicit STOP clears mouth/hearts and suppresses subsequent top petting.
Thus the avatar target is now installed, replacing control 0.7; control source/
build remain preserved, and control RAM enrollment must be restored when returning.
No measured Stop latency or individual mouth-duration/Ready/static-mode/all-avatar
acceptance yet. Next verify READY leaves effects off, then test features separately.

Follow-up observed: READY keeps petting disabled until explicit ENABLE PETTING;
then a top-strip stroke displays hearts briefly and they disappear. Emilia
confirmed both. Next separately verify mouth animation and bounded ending;
static mode and all-five rendering still pending. No integrated speech/app sync.

Further hardware receipts: Emilia confirms TEST MOUTH cycles open/closed and
returns closed after about six seconds; STATIC MODE ON keeps it closed during
TEST MOUTH. Observed passes for isolated mouth-test bounded ending and static
mode. All-five rendering, physical Stop latency and sustained load remain pending.
App-selected avatar sync and live speech-driven mouth control are unimplemented.

Latest visual receipt: Emilia confirms all five avatars have correct colors and
shapes on the uploaded offline target. Current observed checks: all-five rendering,
mouth cycle/automatic ending, static mode, explicit petting activation/brief hearts,
Stop suppression and Ready effects-off. No physical latency or sustained-load pass.
Next integration handoff: agree authoritative selected-avatar sync with Anay/Kylie,
then drive mouth frames from actual bounded playback/cancellation rather than the
preview timer. Keep F13/integrated F14 acceptance distinct. All work remains local.

Emilia reports Anay attributed the earlier failure to backend downtime. A new
November 14 21:17:13 UTC attempt (after fresh 0.7 boot and private reprovisioning)
returned upgrade=409, ready=0, stage=connect; fetched gateway maps duplicate
device reservation to 409. Anay reports clients share one device ID, so backend
testing is deferred rather than rotating keys or repeatedly connecting.

At Emilia's request, prepared separate `--target avatars` (lemmi-avatars/0.1):
five Kylie-derived avatar sprite strips, silent bounded mouth test, explicitly
enabled top-strip hearts, static mode and local Stop. No network/audio/camera/
motion/app selection sync. Compile passed (1,178,775 program / 26,412 globals),
existing gesture sanitizer tests and upload dry-run passed. Not uploaded yet;
guide one local step at a time. Source/build of control 0.7, credential and backup
preserved. See `firmware/stackchan/lemmi_avatars/README.md`. Avatar upload will
replace the control app and clear RAM enrollment. All changes remain local.

0.7 upload passed; private provisioning/Connect at November 14 20:50:30 UTC
produced ready/ack/phase=none stopped=1, then transport_exit:
stage=read result=-1 opcode=256 upgrade=101 errno=0 wifi=3 reason=0 ready=1
age_ms=10185. Camera/capture off. This confirms Wi-Fi association, verified WSS
upgrade and accepted application ready. No header decoded on the failing read;
reason is **not established**. Attempt age includes association/TLS, not just WSS.

Inspected SDK: WS exact header read converts a zero-byte timeout to -1, while
underlying TLS peer FIN also returns -1. Do not claim server close, ignore all
negative reads, change keys or keep blindly reflashing. Next ask Anay to check
sanitized gateway/proxy close/restart/auth/heartbeat cause near 20:50:30 UTC;
coordinate while frontend/voice changes are in progress. If no cause is visible,
add numeric TLS/underlying-read diagnostics. Latest code remains local/unpushed.
No media activation or voice completion. Private backup and credential preserved.

## Current continuation — repeated post-ready exit; 0.7 diagnostics prepared

Uploaded 0.6 accepted ready/ack/empty session then emitted connect_failed twice:
November 14 20:44:15 UTC and explicit reconnect 20:45:39 UTC. No parser rejection,
Start or media. Camera/capture off. The old capability mismatch is resolved for
these ready events; the cause of the subsequent disconnect is **unknown**.

0.7 adds a bounded fixed/numeric transport-exit event BEFORE cleanup, separating
setup/hello/send/poll/read/close/link/watchdog and parser exits with native Wi-Fi
status/reason, socket errno, opcode, upgrade status, ready flag and monotonic
attempt age. No payload/header/ID/close reason text logging, SDK behavior or TLS
bypass. 12 observer/privacy tests and exact backend-schema checks pass. Compile
and dry-run evidence is at the end of control-checks.md. 0.7 upload/hardware pending.

Next: stop observer, upload diagnostic --target control, re-provision same private
--credential-file (no new pair/key), Connect once with helper open, inspect
control_transport_exit. Do not keep blindly retrying identical failures or claim
the backend/network/credential is at fault before transport evidence. Guide one
short local action at a time. Preserve all local work/private files.

## Latest hardware checkpoint — 0.6 ready accepted, connection ended

Emilia uploaded control 0.6 (all four hashes verified) and privately reprovisioned
via the existing credential file. At 2026-11-14 20:44:15 UTC Connect yielded ready,
ack applied=1, phase=none stopped=1, followed immediately by connect_failed.
No parser-rejection event was reported. New ready/handoff descriptors and empty
session are now accepted on hardware; persistent connectivity is NOT yet passed.
No Start or media requested. Camera/capture off. Current transport exit cause is
unknown: generic event covers poll/read/close, Wi-Fi loss and send failures.
Next one explicit Connect retry on retained RAM enrollment, same observer; if it
repeats, add fixed/numeric transport/close diagnostics before further uploads.
No new pairing code/key needed. Backend voice/integration work is concurrent;
do not attribute the close to server or network without evidence.

## Implementation background — backend compatibility 0.6 (now uploaded)

Emilia now reports installed 0.5 says “Invalid server state”, camera/mic off.
Do not assume the earlier accepted connection remains current. Agent fetch
failed DNS; Emilia fetched locally. Compared **origin/backend-deploy 7debf9a**,
backend-status/API, actual schemas and gateway. Documented runtime **17a8522**
adds multi-endpoint ownership and handoff. The ready list now contains handoff
and text (eight controls); 0.5 rejects handoff and >7 controls. This incompatibility
is reproduced in fixtures; no raw live rejected payload was captured.

0.6 source/build fixes ready compatibility, mirrors activeEndpointId/ownership,
adds explicit USE ROBOT (pauses) → await owned/paused snapshot → separate Resume,
and ignores validated foreign-owner listening grants as metadata only. No grant
to this audio-disabled target is accepted. Ownership loss stays stopped/muted,
queued work invalidates, TLS/Stop/watchdog stay enabled. Protocol rejection now
logs a fixed safe stage; both observers filter it. No media activation or transport
was added. Target still binds the existing Alex credential (new arbitrary device/
profile enrollment files not supported). No backend/shared contract edits/merge.

Passed: real-cJSON host parser + policy ASan/UBSan, 12 helper/privacy tests,
exact fetched backend schema check, pinned compile (1,345,115 program bytes /
53,060 static globals). 0.6 hardware/upload still pending. Same private credential
file/backup preserved. Next guide upload --target control, then private helper
--credential-file, Connect once, inspect saved ready/state/owner events. One
short local action at a time. No new pairing codes. Browser frontend should use
its own cookie/identity, not concurrently reuse this robot key. Handoff/Stop
can pause/end the other endpoint's session; coordinate during integration.

Voice is being enabled by teammates per Emilia. Fetched docs still record public
speech disabled, so actual new live config is unverified. Backend speech contract
has been reviewed, but this control target deliberately sends audio unsupported.
Actual robot Speak/capture/playback/receipts/cancellation remain the next separate
integration. See the final 0.6 section of control-checks.md for evidence/commands.
Latest 0.6 source and all earlier changes remain local, uncommitted/unpushed.

## Current device and actual hardware acceptance

Installed firmware: **`lemmi-control/0.5`**, 320×240. Emilia uploaded it locally;
all four images were hash-verified. Latest boot/selftest was actually observed at
19:23:04 UTC. The device later reconnected and completed controls below.

**Last confirmed state: session ended, local Stop active, camera/capture off.**
Final 19:29:53 UTC receipt: local_stop → ack applied=1 → phase=ended stopped=1.
Do not assume connectivity is still live after time passes or a reboot.

Actual checks on the connected robot:

| Check | Observed result (November 14 UTC) |
| --- | --- |
| Authenticated WSS using existing credential | device.ready, acknowledgments and session snapshots received |
| Explicit Start | 19:15:01 ready stopped=0; repeated 19:27:39 |
| Pause | 19:19:01 paused stopped=0, ack applied=1 |
| Explicit Resume | 19:20:11 ready stopped=0, ack applied=1 |
| Local Stop from ready | 19:20:32 ended stopped=1, local_stop and accepted ack |
| Screen stability | Emilia explicitly confirmed flashing is gone |
| Fresh boot Unmute / Mute | 19:23:25 unmuted capture=off; 19:24:18 muted capture=off |
| Explicit Disconnect | 19:28:41 local_stop then disconnected |
| Explicit Reconnect | 19:29:09 paused stopped=1; no automatic resume |
| End paused test session | 19:29:53 ended stopped=1, accepted ack |

Camera/capture were off throughout. Local Unmute was tested after a fresh boot,
not as an authenticated active-session mute receipt. Serial event spacing is not
physical touch-to-stop latency. Explicit Disconnect is not an unexpected Wi-Fi
loss/watchdog test. The reason for the 19:23 reboot was not established; do not
claim that a monitor timer expiring caused a reset.

Still **unverified**: unexpected network-loss/watchdog behavior/timing, backend
restart/revocation and persistent credential lifetime, sustained load/peak heap,
active connected mute semantics, live mic/STT/TTS/playback and secure camera relay.
No F13/F14 integrated acceptance or unattended-use claim.

## Existing credential: no new pairing codes for this flow

Emilia/Anay changed the live setup from temporary pairing to an existing device
credential in **`data/stackchan-access.json`**. It is owner-only (0600) and the
exact path is excluded through **local `.git/info/exclude`**. This exclusion is
not portable to a new clone: verify exclusion before staging anything. Never
print the file or use `git add .` without checking for private data.

Its structure was validated without displaying values: fixed backend/WSS URL,
Alex device/profile, credential, explicit null expiresAt, and matching Bearer and
domain-key headers. The same credential was accepted for multiple reconnects.
Backend durability across a restart/revocation is **not** yet verified. Older
local backend docs describe temporary one-hour credentials; do not mistake them
for current deployed behavior without checking with Anay/current source.

The helper reads the file privately, then prompts only for local Wi-Fi name and
password. No caregiver token is sent to the robot. The robot stores config and
credential in **RAM only**; reboot/upload loses provisioning. The file persists
on the Mac. No NVS credential persistence was added.

Provisioning does not start networking. A separate **CONNECT (stays stopped)**
robot tap connects. A separate Start tap is required afterward. If an existing
session is paused, new Start is intentionally blocked: Stop ends it first.
No automatic start, resume or reconnect. Keep camera/mic off unless separately
and explicitly locally activated in a later authorized feature.

Public origin: `https://lemmi.chaoswarrior.dev`.
WSS: `wss://lemmi.chaoswarrior.dev/v1/device-stream`.
HTTP/WSS require X-Lemmi-Access-Key; WSS additionally uses scoped device Bearer.
TLS CA, hostname/SNI and time validation stay enabled. No insecure/IP bypass.
Original pairing/--create-pairing and Wi-Fi-only modes remain optional compatibility
paths, not the required current flow. Do not repeatedly request fresh codes.

## Implementation and recent fixes

Sources: `firmware/stackchan/lemmi_control/`:

- `ControlPolicy.h`: stopped/muted boot, ready+snapshot gate, explicit Start only
  from ended/empty state; session/generation/local-epoch guards; Stop intent survives
  an already-sent Start, matching rejection/revision retry, six-second watchdog.
- `Protocol.h`: bounded 4 KiB cJSON parse, nesting/duplicate/critical binding checks,
  safe control subset, audio=false/camera=false, non-null capture grants rejected.
  Explicit null expiry is accepted only for a locally provisioned null expiry;
  missing/malformed/mismatched ready expiry fails closed.
- `ProtocolCheck.h`: startup synthetic fixtures gate networking/provisioning.
  Expanded 0.5 self-check passed on the actual device.
- `.ino`: dedicated network task, bounded queue, SDK HTTP/TLS/WS; immediate local
  Stop/mute policy independent of backend/model. No mic/speaker/camera/motion
  initialization, petting, media transport or capture. Credentials/log bodies
  are never emitted. UTC comes from local provisioning. WSS text replies are
  bounded/discarded; this target does not request or display model output.
- 0.4 Start bug: an accepted Start ack arrived while mirror still said ended;
  handler re-latched local Stop from that old mirror. **0.5 fixes this by imposing
  server Stop only on a received ended snapshot**, preserving true local Stop.
  Duplicate queued Start is suppressed while a sent Start remains in flight.
- Flashing bug: every heartbeat marked the screen dirty and cleared/redrew it.
  **0.5 caches visible status/button labels and repaints changed regions only**;
  active status shows actual backend phase with capture off. Hardware-confirmed.
- Earlier claim failure displayed “Need new pairing code” for every HTTPS/HTTP/
  response failure, even with a brand-new code. 0.3+ changed that to “Claim failed
  - see USB” and added fixed stage/numeric diagnostics. That original failure's
  cause remains unknown; direct credential mode bypasses claim.
- Wi-Fi diagnostics status=1 reason=201 corresponded to no AP found. Emilia later
  identified the wrong network had been entered; corrected Wi-Fi passed.

`tools/provision-control.py`: nonsecret serial probe first; hidden secret prompts,
private file validator (permissions, URLs/Alex scope, auth match, expiry, duplicate
keys, 8 KiB bound); bounded fixed-status observer writes ignored owner-only
`firmware/stackchan/build/control-monitor.log`. Default observation 600 seconds.
Agent can read this sanitized file; never dump raw serial/private payloads.

## Commands and local access limits

No need to re-upload merely to resume. Inspect device/log/state first.
Serial port last used: `/dev/cu.usbmodem2101`; recheck if unavailable. Use only
one monitor/provision/upload process at a time. Ctrl+C ends an observer.

User's local Terminal already used this environment (activate if needed):

```sh
source ~/.espressif/python_env/idf5.5_py3.14_env/bin/activate
```

Private provisioning, from repository root:

```sh
python firmware/stackchan/tools/provision-control.py \
  --port /dev/cu.usbmodem2101 \
  --credential-file data/stackchan-access.json
```

Keep the SAME helper open through local Connect/control taps. It observes fixed
statuses for 600 seconds. If already stopped and provisioning is retained, use
local Connect; do not force a new upload/reset. After a reboot, reprovision RAM.

Receive-only monitor (stop other serial owner first; does not save a log itself):

```sh
python firmware/stackchan/tools/monitor.py \
  --port /dev/cu.usbmodem2101 \
  --seconds 600
```

Build only (agent can run this):

```sh
python3 firmware/stackchan/tools/build.py --target control
```

Upload ONLY after a source change/build, in Emilia's local Terminal:

```sh
python firmware/stackchan/tools/upload.py \
  --target control \
  --port /dev/cu.usbmodem2101 \
  --backup-dir firmware/stackchan/backups/20261114T021027Z
```

Upload --dry-run validates original backup, target/images and esptool without
opening serial. The wrapper checks device identity/capacity/security before
writing four board-defined images. No erase-all/eFuse changes. The upload
manifest's control version label was stale (0.2) during recent transfers; it is
now corrected to 0.5 for future runs. Existing private manifests were preserved;
image hashes and actual observed boot version establish what ran, not that label.
No firmware binary change or re-upload is needed for this metadata correction.

In this session the **agent shell cannot open USB serial** (sandbox Operation not
permitted), and computer-use cannot access Terminal. Do not retry escalation or
work around that restriction. Emilia runs local commands and pastes fixed results;
agent can inspect the helper's sanitized log. Shell git fetch/push also failed
DNS for github.com; user Terminal fetching worked. Inspect current capability,
but do not claim a push succeeded unless actually observed. The user prefers a
single short actionable step each turn, not a long checklist.

The robot has an internal battery: unplugging USB does **not** power it off.
If a reset is actually needed, briefly press/release labeled RST; do not hold.
One preflight no-response was resolved by USB reconnect; it is not proof of bad
firmware. New serial opens have sometimes coincided with a fresh boot; exact
cause not proven. Do not assume RAM provisioning survived a new boot.

## Installed tools and tests actually run

Pinned tooling already exists; inspect before installing anything:
Arduino CLI 1.6.0, m5stack ESP32 3.3.10, M5Unified/M5GFX 0.3.0, PSRAM disabled,
hardware USB CDC, 16 MB flash. Ignored firmware `.tools/` and `.arduino/` hold it.
Existing ESP Python: `/Users/emiliavu/.espressif/python_env/idf5.5_py3.14_env/bin/python`
with esptool **4.12.0**, pyserial **3.5**. Earlier esptool 5.3.0 backup read failed.
No packages installed during the latest control increment.

Latest 0.5 compile passed: **1,342,287 program bytes / 52,852 static globals**.
24 KiB worker stack and TLS runtime allocations are additional; peak heap unmeasured.
Host ASan/UBSan policy regressions passed; 11 helper/credential/privacy tests passed;
upload dry-run passed original backup and image/tool checks. Device self-check
passed. `git diff --check` passed. Commands:

```sh
c++ -std=c++11 -Wall -Wextra -Werror -fsanitize=address,undefined firmware/stackchan/tests/control_policy.cpp -o /tmp/lemmi-control-policy-test
/tmp/lemmi-control-policy-test
/Users/emiliavu/.espressif/python_env/idf5.5_py3.14_env/bin/python -m unittest discover -s firmware/stackchan/tests -p test_provision_control.py -v
```

Node 26/installed TS6 previously passed root tsc after main merge. Bun was not
found; no full Bun backend suite was rerun/installed. Anay's reported backend
checks are separate evidence, not local test runs.

## Private original backup — preserve

`firmware/stackchan/backups/20261114T021027Z/`

Valid original full image: `original-flash-16mb-verified.bin`, 16,777,216 bytes,
manifest SHA checked; verify_flash previously matched actual device before uploads.
Other partial/failed candidates are not valid restore images. Manifest/device
logs may contain identifiers/settings; do not print or commit. Restore has not
been rehearsed. New upload evidence is private under `backups/runs/`; preserve it.
No eFuses/security settings were changed.

## Preserved earlier experiments (not current installed app)

- **Feasibility 0.5**, separate `lemmi_feasibility/`: locally approved 15-second
  160×120 RGB565 camera preview, correct colors; frame 38,400 bytes. GC0308 HAL
  metadata and byte-order fixes verified. Custom SCCB adapter reuses existing M5
  bus; no SDK I²C bus release. Camera worker bounded ~50 ms waits; observed teardown
  64 ms expiry / 65 ms local Stop, not physical touch latency. Mic 16 kHz mono
  int16 level responds to voice, tiny transient buffers wiped/discarded. Local
  mic Stop/Mute handler cleanup 4 ms observed. Speaker 440 Hz tone audible at
  64/255; 24/255 was inaudible. Speaker local Stop cut sound early (5 ms handler).
  Camera→Stop→mic→Stop→speaker reuse passed; reverse/stress still pending.
  No recording/network/simultaneous media. See `feasibility-checks.md`.
- **Offline packetizer** `audio/PcmPacketizer.h`: arbitrary 256-sample input →
  320 samples/20 ms/640-byte pcm_s16le frames, single slot, increasing local epochs,
  cancellation/wipe/stale rejection/fail-closed overflow; partial tail discarded
  provisionally. Host sanitizer tests and compile-only ESP probe passed; not wired
  to live capture/network. Caller-owned frames need revalidation before send.
  See `audio/README.md`.
- **Petting 0.2**, separate `lemmi_petting/`: explicit local Enable, three Si12T
  zones, bounded stroke/release/cooldown, static happy face, no network/media/
  servos. Face and flicker fix confirmed; Stop suppresses reaction. Initially
  missing back zone recovered after hands-clear re-enable+2 seconds; cause not
  proven. Full BSP begin avoided because it enables servo power. Gesture host
  tests passed; Ready/reboot/stress pending. See `petting-checks.md`.
- Foundation 0.1: local Stop→Unmute→Ready stayed capture-off, boot 320×240 verified.

## Next work and counterpart handoff

1. Preserve/review the uncommitted tested control changes and this handoff on the
   firmware branch. Commit/push when requested; do not claim the GitHub handoff
   contains these latest changes until pushed. No new compile/upload is necessary
   solely to switch chats. Current test session is already ended/stopped.
2. Finish bounded unexpected network-loss/watchdog and backend restart/revocation
   checks with Emilia/Anay, without changing shared router state or disabling TLS.
   Existing manual Disconnect test is not a substitute. Do not enable capture.
3. Before live speech, inspect current backend/shared contracts with Anay; the
   locally merged backend still advertises audio=false/camera=false. Need agreed
   capture grants/cancel/end, output leases/receipts, stale epoch/revision rules,
   framing/backpressure/partial-tail handling and actual no-recording media path.
   Do not invent a second contract or assume private speech adapters imply robot
   media acceptance. Proposed mic: 16,000 Hz mono signed int16 little-endian,
   20 ms/320 samples/640 raw bytes, currently JSON base64 proposal. Backend TTS
   documented at 22,050 Hz mono int16; rates are different. No end-to-end robot
   intelligible speech/STT/TTS yet. No provider/caregiver token goes to firmware.
4. Secure F13 caregiver camera integration remains pending. RGB565 feasibility
   is not JPEG transport; encoding/permission/relay/cancellation need agreement.
   Integrated F14 petting/motion follows F13; preserve separate offline prototype.

Useful references: `docs/backend-status.md`, `docs/backend_api.md`,
`docs/handoffs/anay-control-foundation.md`, `anay-speech-chat.md`,
`anay-device-integration.md`, `anay-backend-deploy-verification.md` (same folder).
These may need updating from Anay; avoid treating old documentation as deployed
state. Original restart baseline `a7ae270` predates all feasibility code.

## Switching accounts without local file access

This latest handoff is **local and uncommitted**. The GitHub branch URL may be
older: https://github.com/emiluvu/Lemmi/blob/emilia/firmware-foundation/docs/handoffs/emilia-resume.md
Do not use that remote version as this checkpoint unless the update was pushed.
Paste this document's contents into the new chat if it cannot read this workspace.
Never include the private credential/backup file contents. Ask the new assistant
to distinguish facts above from new observations, inspect before changing tools,
and keep one-step local guidance.

### Display 0.3 observed failure — first yaw torque-off reply

Emilia reports 0.3 upload PASS, then one armed supervised stroke produced no
movement and menu diagnostic yaw_torque_off / timeout. The first yaw torque-off
write did not receive a complete validated status reply within 12 ms. No goal
or torque-enable command was reached by this path; failure requests VM off and
latches motion fault. This does not prove physical rail cutoff or torque state.
Official upstream M5StackChan.cpp and SCSerial.cpp rechecked November 15:
UART1 at 1 Mbps, TX6/RX7 and yaw ID1 agree with the Arduino adapter's RX7/TX6.
Write acknowledgments are expected by the official default Level=1 driver.
Root cause remains unresolved (power/UART/reply configuration not measured).
Next inspect USB power connection before changing protocol or bypassing replies.
Official sources: https://github.com/m5stack/StackChan-BSP/blob/main/src/M5StackChan.cpp
and https://github.com/m5stack/StackChan-BSP/blob/main/src/drivers/FTServo_Arduino/src/SCSerial.cpp

### Display 0.4 hardware receipt — yaw probe receives zero bytes

Emilia reports four-image hash-verified upload PASS. An armed stroke then showed
yaw_probe / timeout_empty. The added read-only torque read received zero bytes
within 12 ms, so no torque-off write, goal or torque-enable was reached in that
attempt. VM-off was requested on failure; electrical cutoff remains unmeasured.
VM pull-up setup did not resolve the observed communication failure. Motor
movement still fails hardware acceptance. Leave motion unarmed; avatar/hearts
and observed steady pink remain the offline fallback. Backend work stays paused.

Official power-board schematic reviewed for supply/UART topology:
https://m5stack-doc.oss-cn-shenzhen.aliyuncs.com/1205/SCH_Power.pdf
No confirmed new firmware correction yet. Next establish whether these servos
moved under original firmware; do not overwrite calibration or bypass probe/ACK
checks to force motion.

### Display 0.6 first hardware probe receipt

Emilia reports all four flash images hash-verified, then screen BAT 4152mV,
Y:timeout_empty. P result was unreadable because the footer exceeds screen
width; this is a diagnostic UI defect, not a pitch test failure. Battery monitor
voltage is observed at 4.152 V; switched servo VM voltage remains unknown.
Yaw still receives no bytes. Pitch result is pending allowlisted serial receipt;
no further firmware upload required to retrieve it with a fresh monitored probe.
Diagnostic-only movement remains disabled. Do not mark servo power/communication
or motion accepted from the battery reading.
