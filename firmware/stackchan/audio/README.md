# Offline PCM framing

**Integration update:** these helpers are now consumed by the opt-in
[`voice` firmware test target](../lemmi_voice/README.md), including strict wire
validation, explicit grant-driven capture, zeroing bounded queues and actual
speaker mixer callbacks. Earlier offline-only descriptions below describe the
helper preparation. Voice compiles/tests locally but has no physical acceptance
yet: 0.2 reached real capture and a physically heard but choppy reply, then
disconnected, so physical playback failed. Voice 0.3 is now uploaded with
incremental TLS-frame reads and two-slot/prebuffered playback; idle boot is
observed, but new authenticated transport/speech/Stop results remain pending.

## Bounded speech playback preparation

`PlaybackWindow.h` now provides the complementary four-chunk output window for
decoded mono PCM s16le. It validates the shared native output-rate/size rules,
including 882-byte frames at 22,050 Hz and a short final chunk. It accepts only
sequential chunks, never grows beyond the robot's four-chunk negotiated window,
and copies up to two requests into stable caller-owned speaker memory. It does not
count reception or submission as consumption. The adapter must call `consumed`
only on actual consumption, and require both explicit stream end and all consumed
chunks before sending completed. No automatic capture or playback restart.

All methods require one serialized owner and separately validated current
session/generation/turn/lease/stream/revisions/local restrictions. Strictly
increasing local epochs reject stale starts and callbacks; they are not server
authorization. Cancel wipes the window while preserving the last epoch. It
intentionally cannot wipe a Block that a driver may still reference: the owner
must invalidate first, stop/drain the driver, then clear its Block and pending
callback queue before reuse. Wrong/stale operations return false; the caller
must handle current-stream protocol errors explicitly rather than drop audio.

The installed SDK documents that `playRaw` success means queued, `isPlaying`
reflects software slots, and the buffer-release callback may precede I2S drain.
None alone is an audible-completion receipt. A real speaker adapter must resolve
that boundary and physical Stop behavior before advertising audio support. This
helper does not call those APIs, receive WSS, open the mic or play speech.

Host ASan/UBSan checks pass all five native rates, maximum 30-second outputs,
endianness/signed samples, exact final tails, window overflow/reordering,
submission versus consumption, end-before-drain, cancellation, driver-owned
memory preservation, duplicate/stale callbacks and epoch exhaustion. Run:

```sh
c++ -std=c++11 -Wall -Wextra -Werror -fsanitize=address,undefined firmware/stackchan/tests/playback_window.cpp -o /tmp/lemmi-playback-window
/tmp/lemmi-playback-window
python3 firmware/stackchan/tools/build.py --target playback
```

The new playback target is a compile-only probe with no upload target. Pinned
ESP32 compile passed: 309,444 program bytes / 31,856 static globals. Window size
is bounded to 7,800 host bytes plus a caller Block of at most 1,952 bytes;
SDK/DMA buffers and WSS/base64 memory are additional; the live test owns TWO
such Blocks. The separate control-only target remains 0.9 with audio unsupported.
Secure F13 remains required before integrating
petting polish; the accepted offline avatar/petting target stays preserved.

`PcmPacketizer.h` prepares the proposed microphone payload: mono signed 16-bit
little-endian PCM, 16 kHz, 320 samples / 20 ms / 640 bytes per frame. This is a
firmware helper, not a new wire protocol or session authority. It has no hardware,
network, clock, file, logging or dynamic-allocation dependency. No live microphone
samples were used in its tests. The uploaded 0.5 feasibility sketch is unchanged.

## Behavior and ownership

- One 640-byte slot stores partial input or one complete frame. `append` accepts
  arbitrary int16 input lengths and reports how many samples were consumed. In
  particular, 256-sample mic buffers can cross 320-sample frame boundaries without
  dropping/repeating samples. Each sample is explicitly encoded low byte first.
- On `FrameReady`, call `take` before appending the rest of the capture buffer.
  Five 256-sample inputs produce exactly four complete 320-sample frames.
- Appending more input to an undrained full slot cancels the packetizer and wipes
  its slot. The future transport must treat this as an interrupted input turn,
  rather than silently skip samples and keep recognizing a discontinuous stream.
- `cancel` wipes partial/complete pending data and disables accumulation. Future
  Stop/mute/pause/camera/disconnect/revision handlers must call it; those live
  integrations are not implemented by this helper.
- `start` requires a strictly increasing, nonzero local epoch. Late starts and
  stale append/take/finish calls cannot reopen a cancelled epoch. This local
  epoch is NOT a server generation, authentication token or capture grant. Epoch
  exhaustion fails closed instead of wrapping. Constructing a fresh helper does
  not authorize capture; the future adapter must reconcile after reboot.
- `Frame` is a noncopyable caller-owned 640-byte payload plus epoch. Its destructor
  and `clear` wipe its bytes; failed `take` also clears the output. Once taken, a
  frame belongs to the caller and cannot be erased by packetizer cancellation.
  On every cancellation, the adapter must clear its frame/send queue too, and
  recheck `isCurrent(frame.epoch)` AND current server grant/revisions immediately
  before enqueue/send. Do not infer transport authorization from isCurrent.
- All methods require one serialized owner. The helper is not thread-safe; no
  claim of cross-task Stop/send race protection follows from these unit tests.
- `finish` provisionally discards all unsent data, including a final partial tail
  (up to 319 samples, just under 20 ms). No padding or replay is invented. If a
  complete frame is eligible to send, take/send it before finishing. Anay and
  Emilia must agree final partial-frame/end semantics before live integration.
- Fixed helper size is checked at <=672 bytes on the host. A caller-owned Frame
  uses another 640 payload bytes plus metadata/alignment, and mic SDK buffers are
  separate. This is not a measured whole-device memory/latency budget.

## Checks actually performed

Using existing local c++ and the pinned Arduino CLI/core, with no installations:

```sh
c++ -std=c++11 -Wall -Wextra -Werror -fsanitize=address,undefined -g firmware/stackchan/tests/pcm_packetizer.cpp -o /tmp/lemmi-pcm-packetizer-test
/tmp/lemmi-pcm-packetizer-test
python3 firmware/stackchan/tools/build.py --target packetizer
```

Host assertions and AddressSanitizer/UndefinedBehaviorSanitizer passed: signed
edge samples/endianness, exact five-by-256 framing, input boundaries from 1 to
4096 samples, cancellation at every partial/full position, rejection of stale
starts/producers/consumers, already-taken-frame invalidation, overflow cancellation,
non-padded tails and epoch exhaustion. Synthetic test arrays are not recordings.

The pinned ESP32-S3 compile-only probe passed: 309,748 program bytes / 23,504 static
global bytes for the probe, not the running Lemmi firmware. The probe initializes
no peripherals. `upload.py` has no packetizer target; no upload or serial access
was performed. Header compilation does not establish live capture/STT quality.

## Anay handoff required before live use

Anay owns the canonical schemas/gateway; extend `packages/contracts/src/device.ts`
and `session.ts`, with fixtures for both consumers. No shared schema was changed
in this increment. Please provide:

1. Reachable WSS origin/path, scoped device pairing/provisioning and revocation,
   certificate trust configuration and private credential delivery instructions.
   Keep real credentials out of source, docs, chat and diagnostic output.
2. Sample validated hello/capability, server state, explicit capture grant,
   cancellation/ack/error, stream-end and playback-receipt messages. Existing
   `CaptureGrantSchema` has turnId/generation/leaseId; agree expiry and effective
   profile/privacy/policy revision checks with the session snapshot. Keep input
   cancellation separate from unrelated approved playback.
3. Confirmation of the existing proposed 16 kHz mono pcm_s16le, 20 ms / 640-byte
   microphone payload. Confirm JSON base64 (856 characters per current schema)
   versus a jointly updated binary envelope, final partial-tail handling, stream
   bounds and TTS PCM format/rate/channel/endianness and output framing.
4. Heartbeat/deadline/reconnect rules, bounded queues/backpressure policy,
   one active endpoint and no audio backlog upload/restart after disconnect.
5. A scoped test endpoint/fixture sequence that exercises these events without
   writing microphone audio, generated speech or transcripts to files/logs.
   Provide actual speech-engine buffering/temp-file behavior, not an assumption.

The loopback mock token/gateway is not a live connection. JPEG versus RGB565
camera transport also remains unresolved. Secure F13 integration remains ahead of
F14 polish; this offline audio helper does not satisfy that gate.
