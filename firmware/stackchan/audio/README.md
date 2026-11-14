# Offline PCM framing

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
