# Stackchan uplink send stall — evidence before another flash

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
