# Stackchan uplink send stall — evidence before another flash

**Latest targeted candidate result: bounded16KB/0.12 repeated-turn rehearsal
passed this run at10:30–10:32UTC.** Three completed9–11s capture/reply turns,
user-confirmed accidental Pause/Resume, and Stop during final playback occurred
without unexpected auto-stop/disconnect or send faults. Memory test limits held
(minimum41340). Residual playback buffering4/3/2 waits remains. User reports no
unexpected behavior. Preserve exact image/source and stopped session. This is
evidence of the combined capped-capacity/writable-policy candidate working in
this rehearsal, not isolation of a single setting/physical network cause or
proof of longer/venue/soak/loss behavior. No more speculative tuning/flashes or
backend diagnostics after this pass; review before integrated merge remains.

**Latest measured failure, November 15, 10:15 UTC:** later 0.11 capture expired
a batch at 240 ms and stopped locally while the user spoke. New real TCP
snapshot: free/minimum=711, queue=4, peer window=65535, cwnd=49477,
ACK advance=0, max nrtx=0, unacked=true, unsent=false (33 samples).
32 zero polls/no TLS calls. This is consistent with stock lwIP suppressing
writability because free bytes are <=2873, rather than the queue >=8 or a zero
peer window. It narrows the issue to actual outstanding-unacknowledged data/
send-space pressure, without identifying Wi-Fi/AP/WAN/TLS-peer cause. No ACK
advance does not imply no ACK packets/duplicate ACKs, and 240 ms is too short
to rule out later RTO. No memory/stack limit breach. Stop then received an
applied acknowledgment/ended snapshot at 10:15:38.555 and connection stayed up.
Thus failed-turn connection recovery is observed, but multi-turn speech is
FAILED. Preserve exact 0.11 artifact and numeric evidence, keep stopped; no
further blind firmware/timeout/buffer retest or backend diagnostics. Full
timestamps are in [Emilia's handoff](emilia-resume.md).

**Latest observed turn — short 0.11 success, November 15, 10:12 UTC:** user
reports "went pretty well"; ~6.71s capture, reply playback, 322 received/consumed
chunks and applied Stop/ended reconciliation without a send fault/disconnect.
Two playback buffer waits, heap minimum=48816, largest sampled=31732,
loop/worker=1180/14376. No failing-write TCP record emitted in this turn, so the
prior stall's cause is still unresolved. A single favorable observation cannot
attribute success solely to the firmware change or exclude network variation/
instrumentation timing. Preserve exact installed 0.11 artifact/source and leave
stopped; no more speculative changes, blind trials or backend diagnostics.
Longer/multi-turn reliability and physical Stop timing remain unrun.

**Latest failed trial and measurement follow-up:** 0.10 captured from
10:00:14.264500 to 10:00:16.436316 UTC, completed 92 input-frame writes, then
stopped on 240 ms capture age. Its subsequent Stop write saw 16 zero polls/no
TLS call and disconnected at 10:00:16.639780. Heap minimum=50656; no observed
memory/stack limit breach. Both the larger-buffer and resumable-worker builds
have therefore failed physical voice acceptance; host tests did not settle TCP
behavior. No further blind retest or backend diagnostic window was requested.

Current installed 0.11-diag1 adds core-locked robot-side send-space/queue/window/
ACK-progress/retry snapshots and bounded six-second nonblocking Stop delivery
after local media is off; capture remains 240 ms. Final app SHA-256
`4d56d3d5ccf5cb84d5a7edd1ed849368fe452446b2128b44502f29d147cb29f7`.
Native/host/link checks, protected upload and 10:10 UTC idle boot pass. Real TCP
evidence/speech/Stop acceptance remains pending private provisioning/local
Connect. See [measurement design and interpretation](../../firmware/stackchan/lemmi_voice_diag/README.md).
The following 0.10 and earlier preparation records are historical.

**Current follow-up — firmware 0.10 installed, November 15, 09:57 UTC:** user
authorized continuing the implementation. Replaced the blocking batch loop
with one immutable resumable nonblocking writer, continued inbound parsing and
per-attempt scope checks. Reverted to unchanged stock send-capacity SDK; retained
240 ms capture age and queue limits. Unentered-TLS expiry cancels the whole turn
through existing input.stop; dirty/partial cancellation still closes. Host/native
checks and protected upload/idle boot pass; real connected speech/Stop/mute
acceptance is pending. No backend diagnostics/server/protocol change. Exact
identity, behavior and tests are in the [0.10 voice notes](../../firmware/stackchan/lemmi_voice/README.md).
Older failed-candidate/offline-only statuses below are historical.

## Offline send-path review after failed 8192 trial

Reviewed the unchanged installed sketch's `voiceTransportWrite`,
`flushVoiceBatch`, worker failure branch, and exact pinned IDF/lwIP sources.
No firmware behavior change, build, upload, USB connection or backend operation
was performed. Existing `bounded_write.cpp` passed C++11 warnings-as-errors with
AddressSanitizer/UndefinedBehaviorSanitizer; this is helper evidence, not a
network reproduction or a passing physical test.

Findings:

- `BoundedWrite.h` retries zero poll returns within 100 ms, in up-to-20 ms
  transport calls. Five approximately 20 ms polls plus scheduler/yield overhead
  explain the observed 110 ms maximum; there was no positive accepted byte
  count or TLS writer call in this failed batch.
- `flushVoiceBatch` reports reason 6 for timeout. The worker then latches Stop,
  invalidates the local epoch, sets `abortConnect`, breaks and calls cleanup,
  which closes/destroys the transports and disables Wi-Fi. The source therefore
  accounts for the **firmware-initiated disconnect following this timeout**.
  It does not identify why the underlying socket stopped being writable.
- Pinned lwIP `api_msg.c` emits SENDMINUS when free send bytes are <= low-water
  or queue count >= queue low-water; SENDPLUS recovery requires both strictly
  more free bytes and strictly fewer queued pbufs. Selected 8192 build uses
  byte low-water 4096 and queue low-water 11. Thus poll timeout does not mean
  zero free bytes, and increasing capacity also changes recovery conditions.
  These are source rules, not measured failing-socket occupancy.
- Fictional envelope sizing, using the exact `sendVoice` field set and a
  23-character `voice-00000000-00000000` event ID: 36-character session/turn/
  lease/stream IDs with generation=1, sequence=100 and chunkIndex=24 give
  1227 JSON bytes / 1235 masked WS bytes per 640-byte PCM frame; four-message
  batch=4940 bytes and 50 frames/s=61750 WS bytes/s. With 100-character IDs,
  figures are 1483/1491/5964/74550. These are illustrative synthetic lengths,
  not the user's captured identifiers, measured throughput or TCP/TLS record
  layout. TLS/TCP/IP/Wi-Fi overhead is additional. A capacity increase cannot
  establish that the entire network path can sustain this rate.
- The SDK synchronous connect config sets timeout_ms=4000 and does not request
  nonblocking mode. Exact `esp_tls.c` applies that value to SO_SNDTIMEO and
  restores a blocking socket after connection; `transport_ssl.c:ssl_write`
  uses its passed timeout for select, then calls the TLS writer without a new
  per-call timeout. Consequently the outer 100 ms budget is cooperative, not
  a hard bound on a TLS write once entered. **That write was not entered in
  this failure**, so this is a separate cancellation-review finding, not the
  observed cause. Do not bypass select or directly call TLS as a casual fix.

Conclusion: the 8192 trial failed; no simple byte-order, pointer-advance or
WebSocket-batch bug was established by this review. No evidence supports a new
buffer size or a longer blocking deadline. A future transport change should
make progress/backpressure explicit and preserve bounded Stop/mute/epoch
cancellation, with host rehearsals of zero progress, partial progress, stalled
queues and stale work **before** any new hardware test. If it changes how an
incomplete capture is ended while retaining control transport, it must use an
existing agreed cancellation action and truthfully fail that turn; no fabricated
audio.end, missing-frame concealment or new unilateral media event. This is a
design target requiring implementation/evidence, not a ready fix. Robot stays
stopped and no new backend diagnostic window or repeated Speak is requested.

**November 15 local preparation update:** the stopped installed image remains
`lemmi-voice/0.9-diag1`; older installed-version statements below are historical.
Both initial 5744/16384 builds completed, but the 16384 candidate fails full-queue
RAM accounting. A separate 5744/8192 pair is built and verified with an explicit
32768-byte runtime reserve and 3020-byte remaining model margin. Hardware memory
and audio acceptance remain unrun. The selected pair adds numeric-only local
internal-heap readings, retaining transport/control/protocol bounds. Exact budget,
hash identity, verification and protected upload selection are in the
[experiment README](../../firmware/stackchan/experiments/tcp-send-capacity/README.md).
Emilia has requested no more special backend diagnostic runs; that supersedes
older instructions below to retain diagnostics or agree another diagnostic
window. No backend change, flash, serial open or new capture occurred here.

Current installed firmware: voice 0.9. Keep stopped/disconnected. No successful
new voice acceptance; do not ask Emilia to repeat the same speech sequence.

## What is verified

- Actual distinct application hashes and device boot versions confirm that
  firmware 0.7, 0.8 and 0.9 were flashed. 0.9 matches its current binary exactly;
  stale firmware is not supported by evidence. See the restart handoff for hash.
- 0.6 and 0.8 physically filled the microphone send queue, first-fault code 2.
  0.8 sent 76 frames, longest send 72ms, then stopped. 0.9 sent four frames and
  failed a subsequent batch with `reason=6 status=2 result=0 bytes=0`: the
  100ms bounded write expired without accepting bytes from that batch.
- Capture grant and endpoint ownership were accepted before these failures.
  The negotiated twelve-frame OUTPUT window is separate from the failing
  microphone INPUT. Increasing playback capacity does not fix uplink backpressure.
- The pinned precompiled SDK config is
  `firmware/stackchan/.arduino/data/packages/m5stack/tools/esp32s3-libs/3.3.10/qio_qspi/include/sdkconfig.h`:
  TCP MSS=1436, TCP send buffer=5744, receive window=5760. The other build variant
  selected by the board should be checked before a future custom library build.
- Inspected local ESP-IDF v5.5.1 `components/tcp_transport/transport_ssl.c`:
  `ssl_write` polls socket writability before calling the TLS writer. Zero means
  the socket poll timed out, or the TLS operation returned zero; existing logging
  does not distinguish these two sites.
- Inspected `components/lwip/lwip/src/include/lwip/opt.h`: default send low-water
  threshold is max(send buffer/2,2*MSS+1), here 2873 bytes. Socket `select` may
  therefore wait even when some smaller free space exists. Checked
  `lwip/sockets.h`: SO_SNDBUF and SO_SNDLOWAT are explicitly unimplemented;
  a casual setsockopt increase is not a fix on this stack.

These are source/configuration facts. They do NOT establish the actual RTT,
packet loss, Wi-Fi scheduling, server/proxy backpressure or sole cause of the
observed stalls. Host sanitizer tests cover state/serialization/cancellation,
not the real SDK TCP scheduler; passing them did not establish capture readiness.

## Required measurement and decision

Before another patch, obtain payload-free timing for the device-to-TLS-peer
path: TCP acknowledgment delay, retransmissions, Wi-Fi/link stalls, actual send
availability, and whether Cloudflare/gateway reads are keeping up. Coordinate
Anay's sanitized gateway/proxy logs around 06:11:35 UTC with the robot failure.
Do not request headers, credentials, audio, transcripts or full packet payloads.

Calculate actual serialized bytes per 640-byte input frame, including JSON,
base64 and TLS/WS overhead. At 50 frames/s, the required byte rate is materially
higher than the raw PCM 32KB/s. Compare measured acknowledgment delay with the
5744-byte sender budget; do not use Mac-only RTT as device measurement or
assume the remote TLS peer is the backend machine.

If sustained capacity is insufficient, jointly select one justified change:

- Isolated, pinned firmware library rebuild with a larger TCP send buffer and
  reviewed RAM budget. Application-only macros cannot change the precompiled
  lwIP library. Preserve the current supported target and verified flash backup.
- A measured nearer/private gateway path, maintaining scoped identity and TLS
  validation. This is Anay's deployment boundary, not permission to expose the
  loopback mock or disable certificate checks.
- A negotiated compact/batched media envelope with Anay if serialization is the
  limiting factor. Update canonical schemas/fixtures and both consumers first;
  no unilateral format change or falsely early playback/capture receipts.

Keep local Stop/mute/watchdog/epoch cancellation regardless of the chosen path.
Do not increase timeouts/queues indefinitely, drop samples, retain recordings,
hide failure with mock replies or claim that 0.9 solved the hardware path.

No new upload, network session or capture was performed for this investigation.

## Backend counterpart review — November 15

Reviewed Anay's diagnostic candidate at `9a7173e` on
`anay/stackchan-uplink-diagnostics`, including the gateway instrumentation and
`docs/handoffs/stackchan-uplink-backend-investigation.md`. That candidate is
**not deployed or enabled**. Its observations cannot retrospectively establish
what reached the origin during the failure.

The firmware source in this review snapshot is voice 0.9: `lemmi_voice` includes
`lemmi_control` with `LEMMI_VOICE` defined. In `lemmi_control.ino`, send failure
reason 6 denotes the bounded WebSocket write path, not an ESP-IDF error code.
`audio/BoundedWrite.h` defines status 2 as `TimedOut`. Thus the observed
`reason=6 status=2 result=0 bytes=0` means that batch exhausted the bounded write
without accepted bytes; it does not distinguish socket writability from TLS
retry behavior. `capture_sent=4` counts previously completed firmware writes,
not frames acknowledged or accepted by the gateway.

The installed application binary was 1,471,824 bytes, SHA-256
`b3ae04303afb1b166eefd35465e8c0b71b8faa082464caf2add464a9a3cc58df`.
Voice 0.9 boot was observed at 06:09:23 UTC; failure was 06:11:35 UTC.
Generated binaries, flash backups, credentials and monitor logs are excluded
from the source review snapshot. The ordinary branch working tree remains
preserved; this publication is a review snapshot, not a merge or deployment.

Static counterpart review found the proposed diagnostics compatible with the
firmware wire contract: accepted-frame counts are recorded after coordinator
acceptance; the sink excludes media/credentials; existing close codes and
reasons are retained. The observer sink is exception-isolated. This does not
constitute physical acceptance or independent repetition of Anay's 78 tests.

Next handoff: Anay reviews this exact source, then owns coordinated diagnostic
rollout and origin-side logs. Emilia retains stopped voice 0.9. Agree the UTC
window and robot-side payload-free measurement method before a bounded local
Speak attempt; local Start/Speak remain explicit. No more speculative buffer,
timeout, format or firmware changes for this evidence pass. A gateway-only
attempt could narrow origin behavior but cannot by itself establish robot TCP
ACK/retransmission timing. End the attempt with local Stop, disable diagnostics
and coordinate any restart. Smooth voice acceptance remains pending.

## Controlled origin-diagnostic attempt — November 15, 07:00 UTC

Filtered USB observer records (host receipt timestamps, UTC):

- 06:59:32.340: earlier Wi-Fi attempt failed after 15,031 ms, status 0,
  reason 200 (SDK beacon timeout), before WSS. Separate from the capture below.
- 07:00:06.098: WSS ready, audio=1, output_window=12, language=en;
  TCP_NODELAY=1 and Wi-Fi sleep=0. Endpoint owner=1; initially stopped.
- 07:00:15.044: ready, stopped=0, owner=1.
- 07:00:26.423: local mic unmuted; capture did not start on unmute.
- 07:00:30.899777: listening and capture=on, playback=off.
- 07:00:34.314905: capture=off, playback=off, about 3.415 s after capture-on.
- 07:00:34.315012: `voice_send_failed reason=6 status=2 result=0 bytes=0
  send_max_ms=109 capture_sent=167 camera=off`.
- 07:00:34.518539: `voice_transport_exit stage=control_send result=0 opcode=1
  upgrade=101 errno=0 wifi=3 reason=0 ready=1 age_ms=34509 camera=off`.
- 07:00:34.518665: disconnected.
- 07:00:38.369567, 07:00:40.813735, 07:00:41.626299: local Stop logged.
- Latest stream counters through 07:01:05: received=0, consumed=0,
  buffer_waits=0. No output playback observed by these counters.

Result: same bounded send timeout after 167 completed input-frame writes,
not proof of 167 gateway accepts or TCP acknowledgments. Local Stop events
followed disconnection; this does not measure Stop-during-capture latency.
Camera remained off. No new flash, protocol, buffer or deadline change.
No payload, speech text or credentials included. User reports the one attempt
completed; do not repeat it. Keep stopped. No robot/AP ACK measurement was
collected by this observer: this remains an origin-only diagnostic attempt.

Anay: correlate gateway accepted counts/gaps/local close cause and local socket
metadata for 07:00:06–07:00:42 UTC, especially 07:00:30.899–07:00:34.519.
Then collect the bounded evidence and disable diagnostics using the protected
host helper described in `2032fa6`; coordinate its gateway restart. Root cause
and smooth physical speech acceptance remain pending that correlation.

## Origin correlation received — backend commit 67188b3

Anay reports 164 accepted capture frames (104,960 PCM bytes, 3.28 seconds),
maximum accepted gap 121.281 ms, maximum synchronous handler 2.283 ms,
zero rejected events, and no capture-end. Last accepted frame approximately
07:00:34.170 UTC. Gateway heartbeat close 07:00:38.371 UTC followed the
firmware send failure; it cannot explain that earlier failure. The 167-versus-164
frame difference is unlocalized, not a count of lost packets. Sampled origin
queues showed no sustained growing backlog; 500 ms sampling cannot exclude
shorter stalls or measure the separate robot-facing Cloudflare connection.
Diagnostics remain enabled per Anay's handoff; no identical retest requested.

Additional local source inspection, without firmware changes: the pinned
SDK lwIP sockets header has no TCP_INFO API and marks SO_SNDBUF unimplemented.
The selected qio_qspi sdkconfig fixes CONFIG_LOG_MAXIMUM_LEVEL=1 (error).
ESP-IDF transport_ssl.c distinguishes poll failure at warning/debug verbosity,
which is unavailable in that precompiled configuration; a runtime log-level
change alone cannot recover compiled-out messages. The transport wrapper's
zero return still does not distinguish poll timeout from TLS zero return.
Supported AP/router metadata or a separately reviewed diagnostic build is
needed to narrow that distinction. No build, flash or capture performed here.

## Prepared diagnostic variant — counterpart review requested

`firmware/stackchan/lemmi_voice_diag` is a separate `voice_diag` target,
advertising `lemmi-voice/0.9-diag1`. It observes the exact precompiled SDK calls
via linker `--wrap=esp_transport_poll_write` and `--wrap=esp_tls_conn_write`.
This avoids private SDK struct casts, a network-library rebuild, and disabling
security checks. Both hooks forward unchanged arguments once and return the
original result. Atomically selected worker-task ownership excludes unrelated
network tasks from counters. No payload bytes are examined by the hooks.

Per-bounded-write counters record poll zero/error/max duration, TLS
zero/WANT/error/max duration, and call totals. They are emitted after a
send-path failure, after the stop latch is set, using only fixed labels and
numbers. The existing filtered observers now accept this record. No printing
occurs inside a hook. The linker map cross-reference verifies that both
`transport_ssl.c.obj` call sites target the wrappers; the build fails if a
wrapper or SDK edge is missing. Existing audio stack-budget check also runs.

No playback window, capture queue deadline, batch collection threshold,
write budget, PCM format, TLS/auth, endpoint authority, cancellation or local
control behavior was intentionally changed. Instrumentation adds overhead and
may affect timing. This separates the actual SDK poll return from TLS return;
it does not establish ACK progress, RTT, packet loss or the eventual fix.

Checks: both `voice` and `voice_diag` compile against the pinned ESP32 toolchain;
22 Python tests pass (including rejecting missing/wrong linker hook edges and
strict observer content exclusion); five C++ programs pass with AddressSanitizer
and UndefinedBehaviorSanitizer (`transport_probe`, `bounded_write`,
`control_policy`, `ws_frame_writer`, `ws_frame_reader`). The actual link map
passes both hook-edge checks. Existing audio stack path remains 1568 bytes plus
2048 reserve under the 8192-byte loop stack; hardware watermarks remain required.
Diagnostic upload dry run passes backup integrity, build target, four images,
and pinned esptool checks without opening serial. Whitespace checks pass.

Anay: please review the wrapper forwarding/interception seam and numeric
interpretation in `firmware/stackchan/lemmi_voice_diag/README.md`, then agree
a new bounded origin diagnostic window. This is not an audio fix. The original
installed voice 0.9 remains stopped; no flash, provisioning, new connection,
mic capture, speaker playback or camera/motion operation occurred for this work.
After counterpart review, installation needs the current USB monitor released,
then the same protected backup/device checks and explicit local provisioning /
Connect / Start / Unmute / Speak. No automatic capture is authorized by rollout.

Prepared diagnostic application (not installed): 1472512 bytes,
SHA-256 `d3ef9dfc3faf1dbcc61c3ac5eedc0805dd52dc036279df1061847832751c717b`.
Final diagnostic compile: program 1,472,359 bytes; globals 152,012 bytes,
48 bytes above the normal voice build. Both exact SDK edges and the diagnostic
ELF stack-budget check passed. This is a build artifact identity, not flash evidence.

## Subsequent isolated diagnostic installation

Following the user's instruction to proceed, the tested diagnostic image was
installed on the matching backed-up device. The USB port was present and free;
no monitor process was terminated. The existing upload helper rechecked backup
integrity, device identity/security and all four image hashes; upload passed
and hard reset was requested. No backend code was merged/deployed. Counterpart
review remains pending before integrated merge, but does not prevent this
isolated firmware preparation/check.

An eight-second filtered read-only monitor observed at 07:17:08 UTC:
selftest_passed, firmware=lemmi-voice/0.9-diag1, display=320x240,
capture=off, camera=off; reset=11, heap_free=178168, loop_min=1180.
Opening the serial monitor caused a USB reset as observed in earlier sessions;
RAM provisioning is cleared. No secrets, credentials, media or raw SDK logs
were printed. No connection, capture, speaker test or conversation was started.
The prior statements that voice 0.9 was still installed describe preparation
before this explicit installation. Next required local step is private USB
provisioning using the existing helper, then explicit local Connect. Coordinate
one capture attempt and retain the new voice_transport_probe record on failure.

## Diagnostic hardware result — 07:20 UTC

One explicit local attempt on installed `lemmi-voice/0.9-diag1`; user reports
disconnection immediately after Speak. Filtered observer receipt times UTC:

- 07:18:58.643 ready: audio=1, output_window=12, language=en, owner=1,
  phase=paused, stopped=1; TCP_NODELAY=1 and Wi-Fi sleep=0.
- 07:20:03.969: phase=ready, stopped=0, owner=1.
- 07:20:20.662: local mic unmuted, acknowledged.
- 07:20:21.679905: phase=listening, capture=on, playback=off.
- 07:20:22.601708: `voice_send_failed reason=6 status=2 result=0 bytes=0
  send_max_ms=113 capture_sent=33 camera=off`.
- 07:20:22.602068: `voice_transport_probe polls=5 poll_zero=5 poll_error=0
  poll_max_us=21090 writes=0 write_zero=0 write_want=0 write_error=0
  write_max_us=0 camera=off`.
- 07:20:22.803319: transport exit stage=control_send, result=0, opcode=1,
  upgrade=101, errno=0, wifi=3, reason=0, ready=1, connection age=94549 ms.
- 07:20:22.803644: capture=off, playback=off.
- 07:20:23.208735: disconnected.

**New measured distinction:** in the failed bounded write, all five actual SDK
socket-writability polls returned zero; there were zero TLS write calls.
Maximum individual poll duration was 21,090 us. Thus the zero return in this
failure came from poll timeout, not a TLS writer zero/WANT return. This does
not identify whether ACK delay, loss, peer window, SDK writable low-water
threshold or another scheduling/network condition caused non-writability.
No socket error was reported by these polls. Wi-Fi status at exit does not
exclude earlier link stalls. The 33 completed writes are not TCP ACKs or gateway
accepts. Observer receipt timestamps do not establish physical Stop latency.
The installed target is instrumentation, not a successful voice fix.

Anay: correlate the existing endpoint diagnostics and bounded local socket
sampler for 07:20:21.679–07:20:23.209 UTC (connection began 07:18:58.643),
especially accepted-frame counts/gaps, close cause and origin queue progress.
Do not repeat the identical user attempt. Next network evidence should target
robot-facing ACK/window behavior. If choosing a pinned TCP-library/send-buffer
experiment, jointly review feasibility/RAM and baseline first; this result
alone does not establish the buffer size needed or justify a longer blocking
write timeout. Keep the speaker window unchanged for an isolated comparison.
No further flash, capture or buffer/protocol change followed this observation.

## Correlation 85c3198 and isolated send-capacity feasibility

Anay correlated the instrumented attempt: 29 accepted frames/580 ms,
maximum accepted-frame gap 192.007 ms, max handler 0.888 ms, zero rejections;
gateway heartbeat close at 07:20:26.847 followed the robot failure. Sampled
origin queues were zero; no sustained origin backlog observed. The four-frame
write/accept difference remains unlocalized. The local sampler has ended.

Prepared `firmware/stackchan/experiments/tcp-send-capacity/` with the baseline
SDK/config/archive hashes, a proposed single 5744-to-16384-byte send-capacity
change, nominal per-socket payload delta 10640 bytes, observed connected heap
75988–76188 bytes, and explicit isolation/acceptance gates. This is an **unbuilt
feasibility candidate**, not a new working firmware target or a demonstrated
fix. It changes no running robot/backend or playback settings.

Provenance correction: installed SDK metadata/header report ESP-IDF v5.5.4,
commit 735507283d, builder 43a8f6d. Earlier inspected local v5.5.1 sources are
not the installed SDK's exact revision. Reviewed official v5.5.4 transport and
lwIP Kconfig; writability polling before TLS and the configurable send-capacity
setting are present there too. Actual diagnostic hook results remain valid.
Matched SDK build requires an isolated environment; local GNU build prerequisites
and matching IDF sources are not set up. No packages installed, SDK rebuild,
new flash or further capture performed during this feasibility pass. Next work
is a matched isolated build/provenance check and RAM review, not another user
test of unchanged firmware or a promise that a larger capacity will fix it.
