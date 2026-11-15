# Stackchan voice integration test — 0.9 candidate

0.8 still overflowed microphone sending: 76 frames sent, max write=72ms,
code=2; the TLS retry candidate did not fix capture acceptance. 0.9 amortizes
sending overhead: up to four complete masked WS frames share a bounded 8KiB
TLS write, with at most 60ms collection delay (or dispatch at four queued).
PCM stays 640 bytes/message, ordered schema/sequence unchanged. Main-thread
Stop/mute and input-epoch tokens are rechecked for EVERY message in a batch on
each bounded write attempt. No bytes from a cancelled unsent batch are sent;
cancel after partial frame closes. Encoded data and tokens are wiped on flush.
Actual capture-sent count advances only on completed batch transmission.

The host rehearsal sustains >200 frames with a synthetic 72ms write cost and
independent 16ms mic buffers without overflow; it validates order, bounded age
and Finished. Exact batch bytes/caps/erasure and cancellation/TLS tests pass.
This does not prove actual connected throughput, intelligible speech or physical
Stop latency. Prior capture attempts remain failed until new hardware evidence.

0.7 captured for ~2.8s then disconnected while Emilia was still speaking,
without a mic fault/parser rejection. Its send path did not preserve the TLS
failure result, so the exclusive cause is unresolved. 0.8 adds bounded handling
of TLS short writes/zero-byte polls/explicit WANT_READ/WANT_WRITE while keeping
the SAME frame stable. No other negative errors are retried. Total budget is
100ms with a fixed iteration bound; local cancellation is checked on every
attempt. Cancelled unsent data is discarded; cancellation after partial framing
requires closing. New fixed numeric send diagnostics expose failure reason,
status, TLS return and bytes accepted, never audio/text/credentials.

Host sanitizer tests cover ordered exact bytes, short writes, explicit transient
statuses, hard failures, deadline rollover and cancellation. Voice-driver and
19 Python observer/stack/privacy checks pass, as do exact fetched schemas.
Real capture/speech and Stop behavior still require physical acceptance.

Latest 0.6 fault identified **capture send-queue overflow**: code=2, eight capture
frames sent, longest send=45ms; microphone capture had started successfully.
This is failed capture acceptance, distinct from the negotiated 240ms output.

0.7 sends each freshly masked WS header+payload in one bounded TLS write after
the same verified SDK TLS/HTTP upgrade. The previous SDK sender made two TLS
writes; avoiding that overhead is a candidate improvement, not yet a measured
latency fix. Payload/frame bounds and mask entropy are retained; partial writes
fail/close. The worker's 4,104-byte encoded frame buffer is wiped after sending.
Capture buffering permits twelve full 20ms frames and a reserved Finished slot;
current input older than 240ms fails closed before send. Overflow still stops,
with no sample dropping/backlog replay. Existing input/output epoch/revision,
Stop/mute/disconnect cancellation applies across the whole queue.

Host ASan/UBSan passes frame-mask/length/erasure tests, 240ms consumer-stall and
Finished-slot tests, overflow/driver failure and all cancellation regressions.
19 Python privacy/stack checks and exact backend fixtures pass. Native voice:
1,470,303 program bytes /143,692 globals; known stack guard passes. New capture,
speech quality, connected heap and local Stop latency are still unverified.

0.5 actually negotiated 12 frames/English with the latency options enabled, but
failed locally ~250ms after an acknowledged Speak/listening/capture-on. No
server rejection/reset or output was observed. The generic error did not
identify the cause. 0.6 retains queue/window limits and adds first-fault numeric
diagnostics: outgoing queue full=2, Mic.begin=7, Mic.record=10; full mapping in
VoiceBridge::Failure. Longest send time/successful capture sends and free heap
help separate transport backlog from mic-driver failure. No private content is
printed. Tests reproduce stalled-consumer overflow and driver rejection without
continuing dropped audio. This is diagnostic work, not confirmed repair.

0.6 native compile 1,460,051 program bytes /129,636 globals, stack guard, 19
Python tests, driver sanitizer and schema checks pass. Four-image upload
verification passes; fresh physical capture/speech results remain pending.

Current build requests 12 ×20ms =240ms and honors the actual 4|12 server grant.
The fixed decoded ring stores at most 12 chunks (up to 23,040 PCM bytes at the
largest supported rate); ingress has 14 slots for start/12 chunks/end, plus two
stable speaker blocks. Native 22,050Hz uses 10,584 PCM bytes for 12 chunks.
Short outputs start at their actual chunk count. Consumption receipts are
coalesced/paced every 40ms plus a final tail, without acknowledging received or
queued audio. TCP_NODELAY and disabled Wi-Fi modem sleep are checked mitigations.
`voice_ready` reports the actual grant; four-chunk fallback remains supported.

Both observer allowlists accept only fixed link/window/language diagnostics.
Server mute now updates the effective mute control and its redraw. 0.5 native
compile: 1,459,819 program bytes /129,612 globals; known audio stack path
1,568 bytes plus 2,048 reserve passes. 19 Python checks and host sanitizer tests
cover negotiated bounds, tails, ring wrap, rate pacing and full-buffer local
cancellation; current backend `f3e3b41` schemas validate fixtures. Synthetic
100ms refill latency completes without waits at 12 slots. These results are not
physical sound quality or Stop acceptance. Uploaded with four-image verification;
live negotiation/connected heap/speech retest follows private provisioning.

Keep the provisioning helper open during the entire interactive test. It now
defaults to a bounded one-hour observer (`--observe-seconds 1..3600`). The same
USB handle carries provisioning and filtered observation. A new USB attachment
was followed by reset=11 and loss of RAM provisioning during rehearsal; do not
start a second monitor or close/reopen USB between controls. The agent reads
`build/control-monitor.log` while the user's helper owns the port.

Current installed: 0.4 adds strict compatibility for the new backend
`device.ready.language` enum (en/de; absent legacy field defaults en). Speak's
label/payload follow that negotiated value. Own capture grants with a different
language fail closed; language changes during an existing connection may need
a stopped reconnect. No microphone/camera permission change. This follows 0.3's
`ready_fields` rejection and a fresh schema review at backend-deploy `5ef554a`.
Malformed/duplicate/unknown fields remain rejected. Invalidation also now occurs
before diagnostic printing or network cleanup can delay local driver shutdown.

0.4 schema/host sanitizer checks, 19 Python checks, native voice/control compiles
and stack guard passed. Voice: 1,424,111 program bytes / 95,116 globals. Actual
four-image upload verification and a 12-second idle boot observer passed at
05:04:43 UTC (loop low-water free 1,260 bytes, heap free 235,064 bytes, no streams).
New authenticated connection, smoothness, Stop under playback and German speech
quality remain pending. The earlier 0.2 physical speech attempt still counts as
failed; no idle/compile result overrides it.

Earlier checkpoint: 0.3 was uploaded and hash-verified. A receive-only 20-second observer saw
0.3 selftest/boot at 04:38:40 UTC, then three stable idle samples: loop stack
low-water free 1,276 bytes and heap free 235,064 bytes. Stream counters stayed
zero; worker watermark 0 means not sampled before connecting. No capture,
playback, camera or motion was started. Emilia is away; reconnect and physical
speech/Stop acceptance await her return. No claim of smooth speech yet.

0.2 reached real capture → server processing → a physically heard reply beginning,
but Emilia reported very choppy playback then a read failure. **That physical
voice test failed.** 0.3 preserves partial headers/payloads on zero-byte TLS
timeouts using a bounded incremental reader after the existing SDK TLS/HTTP
upgrade. Negative TLS reads still close; ping/pong/close are handled separately.
It retains the 4,096-byte/frame and one-second partial-frame bounds. See
[RFC 6455](https://www.rfc-editor.org/rfc/rfc6455.html#section-5.2) and the inspected
local ESP-IDF v5.5.1 `transport_ws.c` exact-size read behavior. No auth/TLS bypass.

Playback now prebuffers up to the negotiated four chunks, queues two stable
speaker blocks, and coalesces simultaneous consumed-progress receipts. A fixed
numeric stream diagnostic reports received/consumed counts and buffer waits;
these are device buffer states, not participant/clinical metrics or proof of
audible gaps. Repeated identical state and positive media-ack logs are suppressed
while every frame/state/ack is still validated. The host rehearsal completes
24 chunks with no wait at 40ms synthetic receipt→replacement delay, and with
waits at 100ms. Four 20ms chunks cannot cover feedback exceeding 80ms; firmware
cannot enlarge the server grant. [Anay handoff](../../../docs/handoffs/anay-stackchan-audio-window.md).

0.3 checks: decoder, playback window, two-slot driver/cancellation, queue privacy
and latency-rehearsal ASan/UBSan checks; exact backend-deploy `ddecdc9` fixtures;
19 Python helper/stack checks; voice and control-only native compiles. Voice:
1,423,915 program bytes / 95,116 static globals. Known audio call path 1,552 bytes
plus 2,048 bytes reserved fits the unchanged 8,192-byte loop stack. Backup/image
preflight and four-image actual upload verification passed. These checks do not
upgrade the failed physical playback acceptance.

0.1 did not reach an observed authenticated connection after local provisioning;
Emilia reported a return to Provision via USB. Native frame inspection exposed
an 8,544-byte known loop/tick/cancel call path against an 8,192-byte loop stack.
0.2 moves scratch frames into owned static storage (still wiped), reducing that
path to 1,552 bytes. The build now rejects the original frame budget and requires
2,048 extra bytes of callee reserve. Reset/heap/stack-watermark diagnostics are
fixed numeric values only. This is a compiled fix candidate, not yet a physical
connection or speech result; the original reset reason was not recorded.

Latest observed hardware: direct 0.2 upload hash-verified all four images, then
a 20-second receive-only observer saw 0.2 selftest/boot and three unchanged idle
samples: loop stack low-water free=1,276 bytes and heap free=237,016 bytes.
Worker watermark 0 means unsampled before connection. Boot reset code 11 is USB
reset in the installed SDK; no further boot occurred within this short observer.
This is an idle boot result, not authenticated media or measured Stop acceptance.

Experimental intermediate target for **stackchan-alex / profile-alex**, sharing
the existing control sketch, private USB provisioning, certificate-verified WSS,
heartbeat, local controls and authoritative Lemmi session. Separate from the
accepted control/display/feasibility targets. No new backend, credentials, camera
relay or activity rules. The avatar/petting composition remains subsequent work;
image-dependent activities stay on an explicit companion-screen path.

## Implemented firmware path

- Device hello negotiates 16 kHz mono pcm_s16le input, all five shared native
  PCM output rates, and the four-chunk robot output window. Camera/petting stay
  unsupported. If the service declines audio, **VOICE OFFLINE** is explicit.
- Start creates the session, without capture. Unmute only clears local mute.
  Explicit **SPEAK (EN)** sends the existing `input.speak` event; capture starts
  only with this endpoint's current, unexpired grant and valid local permission.
  Test language follows the validated server ready descriptor (English/German);
  the controls remain an English intermediate test UI. No wake word or continuous listening.
  While processing/speaking, **PAUSE TO TALK** cancels local audio and sends
  Pause; use explicit Resume, then Speak. The current server accepts capture
  requests only from ready/waiting, so this target does not pretend a direct
  Speak-during-output command can open a new turn.
- Asynchronous 256-sample mic reads feed the tested 320-sample/640-byte packetizer.
  **FINISHED** stops the mic and sends full frames plus `audio.end`; it discards
  any incomplete tail, never pads it. Capture has a 19.5-second local bound and
  the grant's earlier expiry. Empty input fails closed rather than fake success.
  There is no local VAD. A processing wait over 20 seconds stops the test.
- `response.start`, `audio.chunk`, `audio.end` and `response.cancel` are validated
  before bounded queue dispatch. Native 22,050 Hz frames are 882 bytes. One
  pair of caller-owned stable blocks feeds `playRaw`; received/submitted data is not
  acknowledged as played. On actual mixer buffer release, send started(0) then
  progress with consumed chunks. A final 100 ms drain guard precedes completed.
- The final guard uses the configured 48 kHz / 128-word / four-descriptor output
  setup. It is conservative software timing, **not observed DMA/audible completion**.
  Validate it with real speech and Stop before upgrading hardware acceptance.
  The installed M5Unified 0.3.0 exposes `setBufferReleaseCallback`; compilation
  checks that dependency. Callback is buffer consumption, not acoustic feedback.
- All driver and PCM-helper operations run on the UI task. The WSS worker only
  copies bounded messages and sends wire events. Fixed queues zero consumed
  slots under short locks; no driver/network operation occurs under those locks.
  Capture and output never run together. Green follows actual capture; blue
  follows known mixer consumption/drain, never just server phase or enqueue.
- Local Stop/Pause/help/ownership/revision changes invalidate work and stop local
  drivers before acknowledgment. Mic mute cancels capture/pending input while
  unrelated approved output can continue. Unmute/reconnect never starts capture.
  Network sends recheck epoch, scope, revisions, grants and input cancellation.
  An already-in-flight TLS write cannot be recalled; the next control/grant
  invalidation rejects late results. Full queues/errors stop instead of silently
  dropping audio and continuing recognition. A light failure disables this test.

The app clears its PCM buffers, JSON/base64 copies and queue slots. M5Unified,
I2S/DMA, TLS and FreeRTOS retain their own transient RAM allocations; teardown
does not prove those allocations were securely erased. No firmware microphone,
generated-speech or transcript file/log write exists. This audit does not repeat
server/provider retention verification. Only fixed state/boolean/numeric events
are printed; observers reject appended text/credentials/transcripts.

## Checks and limitations

Observed before upload: real-cJSON voice parser tests and old control parser
regression tests pass with ASan/UBSan; mock-driver tests pass explicit capture,
framing/end, started/progress/completed ordering, Stop callbacks, unmute staying
off, unrelated output under mic mute, scope/revision/disconnect cancellation,
queue slot erasure and concurrent queue ordering. Exact voice fixtures validate
against fetched `origin/backend-deploy` at `9257de1`. All 16 helper/privacy tests
pass, plus three stack-guard tests (19 Python checks total). Native ESP32 0.2
compile passed (1,420,219 program bytes / 93,164 static globals);
original backup/four-image/esptool 4.12.0 upload dry-run passed without serial.

No real K151 voice turn, intelligible PCM playback, final drain timing, sustained
TLS/peripheral load, runtime heap or physical Stop/mute latency has been checked
on this target. Camera remains disabled pending Anay's authorized F13 relay;
this does not satisfy F13/F14 or independent robot acceptance. Servo work remains
disabled. If live voice fails, keep the robot stopped and use the existing app
endpoint through explicit ownership handoff, or restore the accepted control
target; do not convert a failed live turn to a fixture reply.

## Build / local upload / one-turn rehearsal

From the repository root:

```sh
python3 firmware/stackchan/tools/build.py --target voice
python3 firmware/stackchan/tools/upload.py --target voice --port /dev/cu.usbmodem2101 --backup-dir firmware/stackchan/backups/20261114T021027Z --esptool-python /Users/emiliavu/.espressif/python_env/idf5.5_py3.14_env/bin/python --dry-run
```

The user performs the authorized local upload by removing `--dry-run`, after
closing any serial observer. Then use the existing private credential file with
`tools/provision-control.py`; its filtered `build/control-monitor.log` also
accepts voice state/audio events. Do not open another connection using the same
device identity. Connect stays stopped; Start → Unmute → Speak are separate
local actions. Use fictional/generic content for the rehearsal, then Finished.
Listening audio goes to the team speech server; text goes to the external LLM.
The robot does not run STT/TTS/LLM locally. Verify the actual reply and local
Stop/mute/disconnect before proceeding to avatar composition. Record hardware
receipts separately in the build plan; mocks/compile do not establish them.

Host reproduction commands (existing SDK cJSON object built with sanitizers):

```sh
c++ -std=c++11 -Wall -Wextra -Werror -fsanitize=address,undefined firmware/stackchan/tests/ws_frame_reader.cpp -o /tmp/lemmi-ws-reader
/tmp/lemmi-ws-reader
c++ -std=c++11 -Wall -Wextra -Werror -fsanitize=address,undefined -I /Users/emiliavu/esp/esp-idf-v5.5.1/components/json/cJSON firmware/stackchan/tests/voice_protocol.cpp /private/tmp/lemmi-integration-cjson.o -o /tmp/lemmi-voice-protocol
/tmp/lemmi-voice-protocol
c++ -std=c++11 -Wall -Wextra -Werror -fsanitize=address,undefined -I firmware/stackchan/tests/voice_driver -I /Users/emiliavu/esp/esp-idf-v5.5.1/components/json/cJSON firmware/stackchan/tests/voice_bridge.cpp /private/tmp/lemmi-integration-cjson.o -o /tmp/lemmi-voice-bridge
/tmp/lemmi-voice-bridge
```
