# Anay — device/backend handoff from Emilia

**Updated:** November 13, 2026. Read with `AGENTS.md`, [team start](../team-start.md), [integration contracts](../integration-contracts.md) and [robot capabilities](../robot-capabilities-spec.md).

## Firmware continuation — November 13

The original foundation inventory below predates hardware uploads. Current evidence
is in [Emilia's resume handoff](emilia-resume.md) and
[offline feasibility checks](../../firmware/stackchan/feasibility-checks.md).
Foundation 0.1 was hardware-verified; offline feasibility 0.2 is now uploaded with
all four images hash-verified, and serial/screen confirm camera/mic off at startup.
The local camera permission prompt was observed, but active preview/audio and
Stop/expiry under capture remain untested. No network firmware is implemented.

Shared protocol v1 is a mock baseline to extend together, not a frozen live device
protocol. The missing live WSS/pairing, capability negotiation, grants/receipts and
camera control/media contracts below remain unresolved. The offline experiment
configures RGB565; the shared frame schema accepts JPEG only. Do not freeze that
encoding or claim hardware camera support before measuring and agreeing the path.

## Original foundation inventory

The shared mock starter is on main (`429225e`). Emilia’s first firmware source is on [emilia/firmware-foundation](https://github.com/emiluvu/Lemmi/tree/emilia/firmware-foundation), initially committed as [`a9b4ae7`](https://github.com/emiluvu/Lemmi/commit/a9b4ae7). It is not merged into main by this handoff.

- USB enumeration identifies an Espressif JTAG/serial interface. Emilia reports the normal existing face runs. The installed firmware version has not been identified.
- `firmware/stackchan/lemmi_foundation/lemmi_foundation.ino` is a standalone screen/touch test: Ready, latched Stop and a separate mute setting. All actions leave capture off; microphone/speaker initialization is disabled. No camera, network or servo-control path is initialized.
- The pinned macOS toolchain/setup/build passes: Arduino CLI 1.6.0, `m5stack:esp32@3.3.10`, M5Unified/M5GFX 0.3.0. Target: M5CoreS3, hardware USB CDC, 16 MB flash setting, PSRAM explicitly disabled for this small test.
- Compiler output: 549,947 bytes of program storage and 26,036 bytes of static globals. These are compiler figures, not measured free heap, hardware capacity or Stop latency. Camera PSRAM configuration is still unverified.
- **No flash write or serial reset has been performed.** The test has not run on hardware. Existing firmware backup/recovery, display/touch usability, audio formats, camera frames, TLS and control responsiveness are pending. Do not mark robot, F13 or F14 acceptance passed.

The tools, downloaded SDKs, build products and private backup directory are ignored in Git. Main’s Bun setup was not changed for this firmware work. The firmware branch README contains compile/setup instructions; Anay can keep working on the backend without installing the Arduino toolchain.

## What blocks a real robot connection today

`apps/realtime/src/index.ts` binds to 127.0.0.1 and rejects non-loopback peers. It uses a local mock token and the in-memory `MockCoordinator`. `scripts/fake-device.ts` is a computer-side simulator, not K151 firmware. A robot cannot connect by using its own 127.0.0.1, and changing only the hostname does not establish scoped device access or TLS. Do not expose the mock gateway or reuse its fixed development credential as production pairing.

The following runtime contracts are deliberately incomplete:

| Export/path | Current limitation | Required handoff |
| --- | --- | --- |
| `DeviceEventSchema` hello | Requires one fixed audio format even though real capabilities are unknown; no explicit unsupported-audio variant or negotiated limits | Agree a hello/capability response that can honestly report unsupported audio/camera and measured limits |
| `DeviceEventSchema` controls | Initial fake path handles stop/pause/resume/help/mute only; full start/speak/turn-end/activity/teaching actions are not implemented | Versioned bounded control schemas and sample request/ack/state/error messages; preserve help with no active conversation |
| `ServerEventSchema` | Only mock state/ack/heartbeat/error; modes are literal mock | Add live variants only alongside the actual authenticated path; add needed audio/expression/activity/camera events with consumers/fixtures |
| `SessionSnapshotSchema` / `CaptureGrantSchema` | Starter never grants capture; no live speech/output execution | Agree current generation, profile/privacy/policy revision, turn, capture grant and endpoint/output lease checks, including input-turn versus unrelated-output cancellation |
| `audio.chunk` / media path | Proposed 16 kHz mono signed little-endian PCM, 20 ms/640-byte frames; gateway rejects ingestion. Audio-end/output receipts are incomplete | Negotiate actual measured formats, explicit turn/stream end and playback receipts. These numbers are targets, not proven K151 output |
| `CheckInSnapshotSchema` / `CameraFrameHeaderSchema` | UI/header scaffolds only; proposed JPEG, <=320×240 and <=64 KiB frame bounds | Agree measured encoding/size/freshness, consent nonce, check-in generation/privacy revision/deadlines and local acceptance/start/end fixtures |
| Camera events / adapters | Partial incoming event shapes; outgoing request/start/end/state and authorized relay not implemented | Shared CheckInClient/live routes and bounded separate media channel on the same gateway; no raw public stream URL |
| `device.health` | Validator only, no measured device telemetry or ingestion | Keep unsupported/unavailable explicit; telemetry polish follows the secure F13 gate |

Do not simply change every mock literal to live, disable the loopback checks or widen frame limits. Extend the shared contracts and counterpart consumers together; keep the mock path isolated and useful for Kylie/Lukas.

## Anay’s next small increments

1. **Reachable authenticated control path:** supply the selected HTTPS/WSS origin and port/path, scoped pairing/revocation flow, device credential provisioning instructions, and certificate trust approach. Share no provider/admin keys with firmware. Use one authoritative session and a single assigned functional profile, Alex; dashboard examples remain preview-only.
2. **Freeze a small device fixture set with Emilia:** hello/capability negotiation, heartbeat, current state, local Stop/pause/mute, explicit resume, help without a session, invalid/stale/replayed event, disconnect and reconnect. Anay owns schema/gateway edits; Emilia implements the matching firmware. A plain control-only connection is useful before speech models are finished.
3. **Clarify cancellation before media:** local Stop/mute acts before acknowledgment. Reject stale outputs and never reopen capture on reconnect/unmute/playback completion alone. Mic mute cancels its input turn but must not invalidate unrelated approved music output; the mock’s simplified generation changes do not prove live token/lease behavior. Quiet returns to capture-off waiting. Manual help stays independent of the LLM and journal writes; simulation never becomes a real send.
4. **F13 camera, beside basic audio:** implement scoped request → await current local Allow/nonce → coordinate activity/audio pause → bounded stream → local/server expiry/end/revocation. Provide disabled, awaiting-Allow, declined, start-timeout, active/stale, expired, disconnect/restart and late-start/frame fixtures. Ending camera leaves activities paused until explicit Resume. No images enter LLM, logs, storage, notifications or journal.
5. **Speech integration in parallel:** provide negotiated local STT/TTS transport and output receipts after Emilia measures audio constraints. Enforce one endpoint and no simultaneous microphone/music/TTS/camera capture. Model/provider credentials stay server-side. F14 petting/motion/health polish waits for F13’s secure end-to-end hardware gate.

For each handoff, give exact export/event names, example messages, tested versus mocked status, run commands and the next firmware task. Keep incomplete interfaces explicit instead of inventing another backend/session store. Hardware or network findings may change proposed byte/timing limits; update fixtures/tests and ask Emilia to verify the device side before calling them frozen.

## Emilia continues on the firmware branch

Next: establish private backup/recovery before replacing the running application, then perform the first authorized upload and observe actual display/touch/Stop/mute behavior. After that, test camera/display/touch/Wi-Fi coexistence and sequential audio→camera→audio operation, record measured formats/memory/latency, and implement the agreed WSS/control path. Kylie receives measured asset constraints before full robot exports. No factory-cloud or provider integration is needed in this first hardware test.

This handoff asks for backend work; it does not authorize an upload, contain credentials, or establish that any hardware safeguard works yet.
