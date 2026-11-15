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
