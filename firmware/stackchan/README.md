# Emilia’s Stackchan firmware

Switching accounts or resuming? Read [Emilia’s restart handoff](../../docs/handoffs/emilia-resume.md).

**Latest 0.12 result (10:30–10:32UTC): repeated-turn rehearsal passed this run.**
Three9–11s captures/replies, user-confirmed Pause/Resume and Stop during last
reply proceeded without unexpected auto-stop/disconnect. Memory limits held
(minimum41340); queued speech stopped without false consumption credit. Some
playback rebuffering remains (4/3/2 waits); longer/network-loss/venue and physical
latency acceptance remain unrun. Preserve this exact capped-policy build and
stopped session; no more speculative changes or backend diagnostics.

**Current installed: `0.12-diag1-tcp16`, November 15, 10:27 UTC.** A new
measured-bottleneck candidate uses 16KB TCP send capacity, 23-pbuf cap and the
original 2873-byte writable threshold. It differs from the original rejected
46-pbuf 16KB image. App capture queues/240ms age/security/controls unchanged.
Matching builds, 29 Python tests, ten sanitizer programs, exact SDK/ABI/link/
RAM checks and protected upload/idle selftest pass. Connected memory and real
multi-turn/Stop acceptance are pending; backend untouched. Explicit selection:
`--target voice_diag --tcp-policy bounded-16k`. See
[current policy and budget](experiments/tcp-send-capacity/README.md).

**Latest 0.11 result (10:15 UTC): multi-turn reliability failed.** Capture
stopped automatically during speech on a 240 ms send-age fault. Actual TCP
snapshot: 711 send bytes free, four queued pbufs, peer window open, unacked data
and zero ACK-byte advance over the sampled stalled window. No memory-limit
breach. The existing Stop was delivered and the session ended **without
disconnecting**; connection recovery is observed, voice reliability remains
unmet. Preserve current build/evidence and leave stopped; no blind retest,
buffer/timeout change or backend diagnostics. See restart handoff for details.

**Latest observed result (November 15, 10:12 UTC):** one short real conversation
on installed 0.11-diag1 went well by Emilia's report. About 6.71s capture, reply
playback, 322 received/consumed output chunks and applied Stop/ended snapshot;
no send fault/disconnect or memory-limit breach in this turn. Two playback
buffer waits remain. Preserve this exact image/source and stopped session;
longer/multi-turn, physical Stop latency and failure recovery remain unverified.
This is not full P0 acceptance or proof of the prior stall's cause. No backend
diagnostics or more experimental flashes. Earlier preparation statuses follow.

**Current installed: `lemmi-voice/0.11-diag1`, final idle boot 10:10 UTC.**
0.10's live turn failed (92 writes, capture age expired, Stop delivery also
blocked); voice remains unaccepted. 0.11 measures robot-side TCP queues/window/
ACK progress locally and permits bounded nonblocking Stop recovery after capture
is already off. No larger buffers, longer capture, new protocol or backend
diagnostics. Both builds, 28 Python tests, ten sanitizer executables, exact hook/
SDK checks and protected four-image upload/boot selftest pass. Private provision/
Connect, live TCP evidence and voice/physical Stop checks remain pending. See
[current 0.11 diagnostic notes](lemmi_voice_diag/README.md); older statuses below
are historical.

**Current installed: `lemmi-voice/0.10-diag1` (November 15, 09:57 UTC).**
Resumable nonblocking writes on the unchanged stock TCP SDK replace the failed
8192 buffer experiment. Both builds, 27 Python tests, nine sanitizer programs,
protected four-image upload and idle boot selftest pass. Microphone/camera off;
connected memory/nonblocking setup and physical voice/Stop/mute acceptance are
pending private provisioning/local Connect. No backend diagnostics or restart.
Use ordinary `--target voice_diag`, without the experiment flag. See
[0.10 behavior and bounds](lemmi_voice/README.md); earlier statuses are history.

**Latest voice result (November 15, 09:38 UTC): FAILED.** Selected 8192-byte
candidate disconnected about 0.6 seconds after Speak/capture-on. Probe again
shows five zero socket-writability polls and no TLS writer call in the failed
batch. No reply playback; no recorded memory/stack limit breach. Keep stopped/
disconnected and do not retry or reflash this experiment. See the restart
handoff for exact evidence. No backend diagnostic session was run.

**Latest installed (November 15, 09:34 UTC):** selected isolated 8192-byte voice
candidate, exact application hash in the restart handoff. Protected four-image
upload and idle startup selftest pass; capture/camera off. Connected memory,
short conversation and physical Stop/mute checks remain pending after private
RAM provisioning. No backend diagnostic run or service change.

**Current local preparation (November 15):** selected isolated TCP send-capacity
candidate is **8192**, with a matching rebuilt 5744 baseline. The earlier 16384
candidate fails conservative RAM budgeting and must not be flashed. Both selected
pair builds/link checks pass; no flash or hardware test performed. See the
[experiment budget and exact upload selection](experiments/tcp-send-capacity/README.md).
Special backend diagnostic runs are no longer requested. Latest documented
installed firmware remains stopped `lemmi-voice/0.9-diag1`; older statuses below
are historical.

**Latest preparation: voice 0.7.** 0.6 diagnostic confirmed a full microphone
send queue (45ms longest send); that capture test failed. 0.7 combines each
masked WebSocket send into one TLS write and bounds input at 240ms plus a
reserved Finished slot. Host/native checks pass; fresh capture/smoothness/Stop
acceptance is pending. See [voice target](lemmi_voice/README.md).

**Latest installed: voice 0.5.** Coordinated 240ms (12 chunks) negotiation with
four-chunk fallback, bounded queues and paced consumption receipts passes host
checks/native build and four-image upload verification. Idle boot is observed;
actual negotiated 12-frame connection, connected heap, smooth speech and Stop
under playback remain pending. See [voice notes](lemmi_voice/README.md).

**Current integration checkpoint:** control 0.9 was restored to `stackchan-alex`;
Connect/Start/Pause/Resume/Stop, capture-off Unmute and stopped reconnect are
observed in the filtered helper log. New opt-in [voice 0.4 test target](lemmi_voice/README.md)
adds the real mic/PCM/playback wire adapter using the same session/control code.
Host protocol/driver/cancellation/privacy checks, ESP32 compile and private-backup
upload dry-run pass. After fixing a 0.1 stack defect, 0.2 reached real capture
and a physically heard but very choppy reply, then disconnected: playback
acceptance failed. The current build retains 0.3's incremental TLS-frame reads
and two-slot/prebuffered speech. 0.4 accepts the backend's new validated
English/German ready field; its upload/hash verification and idle boot are observed.
Authenticated transport/smoothness/Stop retests await Emilia's return. The existing
avatar/petting UI remains the final presentation direction; the intermediate
voice target keeps it disabled during media bring-up. Image activities require
a companion screen, camera relay remains unavailable, and servo work stays off.

**Latest accepted test:** Emilia reports feasibility 0.8 upload PASS and confirms
audible tone → blue lights → lights off. Speaker-blue regression is resolved in
this user-observed retest. Installed firmware remains the offline test menu;
pink petting is preserved in the separate display target. Backend deferred.

**Current candidate:** 0.7 tone is audible but blue is missing by user report.
Feasibility 0.8 uses a bounded local tone-test light window after successful
submission rather than the speaker polling flag. Host tests/compile/preflight
pass; hardware fix remains unverified. Next upload and retest speaker blue,
then camera yellow. This test window is not a live speech playback receipt.

**Latest local Stop receipt:** Emilia confirms feasibility 0.7 red Stop turns
off the active camera preview and yellow lights. Yellow/expiry and early Stop
now pass by user observation; latency unmeasured. Offline only.

**Latest hardware receipt:** Emilia reports feasibility 0.7 upload PASS, yellow
with the allowed local camera preview, and lights off at automatic expiry.
Early local Stop/yellow-off remains pending. No backend/motion enabled.

**Latest camera light:** prepared feasibility 0.7 adds yellow while the locally
allowed camera is initialized/active. Green mic/blue speaker and pink display
remain. Host tests, pinned compile/SCCB guard and upload preflight pass. No
upload; physical yellow/Stop/expiry pending. Emilia confirmed 0.6 mic green,
speaker blue and local camera preview. [Checks](feasibility-checks.md).

**Latest test preparation:** feasibility 0.6 reuses the offline mic/speaker-tone/
camera menu with green running-mic and blue playing-tone lights. Pinned compile,
SCCB link guard, host checks and upload preflight pass. No upload or hardware
color result yet; display/pink petting is preserved separately. See
[rehearsal notes](feasibility-checks.md).

**Latest light request:** backend reconnection deferred. Shared light policy and
adapter support green for actual microphone capture, blue for actual speech,
pink for petting, and off on Stop. Audio indicators override pink. Host sanitizer
tests and display/presentation compiles pass. No upload; live audio wiring and
physical green/blue verification remain pending. See [light preparation](presentation/README.md).

**Latest control continuation (0.9):** 0.8 upload verified; 23:56 UTC ready_fields
rejection persists. Latest fetched backend adds optional boolean photoStory;
0.9 compatibility preparation and results are in [control checks](control-checks.md).
Hardware pending; camera/mic remain off.

**Previous control continuation:** control 0.7 restored on hardware, but November
14 23:41 UTC Connect rejected ready_fields after WSS upgrade. Prepared control
0.8 accepts the gateway's known optional boolean teaching capability; all parser/
schema/helper checks, pinned compile and upload dry-run pass. Hardware pending.
No teaching/media behavior enabled; see latest [control checks](control-checks.md).

**Current installed lights-only fallback:** Emilia confirms display 0.7 works: pink only during the
1.2-second petting hearts, off at boot/Resume/expiry/Stop. Servo/probe controls
and power-up paths removed from display. Compile, host sanitizer checks and
upload preflight pass; requested pet-light behavior is user-confirmed. Servo work remains stopped.
See [current display instructions](lemmi_display/README.md).

**Latest screen direction:** [separate `--target display`](lemmi_display/README.md)
implements avatar-only black/centered presentation and petting enabled while
active. Tap anywhere stops/reveals controls; Resume explicitly restores display
and petting. Pinned compile/dry-run passed; upload/hardware acceptance pending.
Existing `avatars` test-menu and `control` targets remain preserved.

**Offline avatar preview (November 14):** new separate `--target avatars` compiles
Kylie's five identities with silent mouth-animation and explicitly enabled local
top-strip hearts. Compile/gesture tests/upload dry-run passed; hardware pending.
See [avatar target instructions](lemmi_avatars/README.md). It does not connect to
the app/backend or implement voice, and temporarily replaces the control app.

[App-avatar/voice preparation](presentation/README.md) documents the existing
scoped profile and speech seams. A tested firmware presentation helper and
compile-only `--target presentation` now reject stale playback callbacks and
gate mouth frames on actual playback; live adapters remain pending.

The `emilia/firmware-foundation` branch contains an initial standalone display/touch test. It is not a connected Lemmi client. It has now been uploaded and hash-verified on the connected device after a complete verified private backup. Serial output confirms the foundation firmware boots and reports a 320×240 display, including after a separate controlled reboot. Emilia confirms the visible screen and Stop → Unmute → Ready behavior; readability at intended distance, controls under load and audio/camera/network failure checks remain pending; see `hardware-checks.md`. The pinned setup and compile scripts passed on the development Mac; the explicit target build reports 549,947 bytes of program storage and 26,036 bytes of static globals. These are compiler figures, not measured runtime memory or control latency.

## Offline feasibility milestone

A separate `lemmi_feasibility/` sketch now implements local Allow/Stop/expiry camera
preview and separate tone/mic tests. It is compile-checked and locally uploaded
with all four image hashes verified. Emilia confirms the startup screen shows camera
and microphone off. A later 0.3 run produced a real preview with incorrect colors;
15-second automatic expiry and 64 ms teardown were observed. 0.4 source adjusts
byte order; 0.4 is now hardware-verified for correct colors, one automatic expiry
and one active local Stop (65 ms teardown in that run). Emilia observed a mic
level response to her voice on 0.4 and audible generated-tone output on 0.5 at
64/255. Local mic Mute/global Stop and early audible-output Stop were subsequently
observed on 0.5. The live STT/TTS path and sustained peripheral reuse remain pending. Read [feasibility checks](feasibility-checks.md) for architecture, exact
commands, measured-versus-proposed limits and the local test procedure. The agent's
upload attempt was blocked by macOS serial access before any firmware write;
Emilia subsequently completed the upload from local Terminal. The original foundation sketch and verified private backup are preserved.

## Offline microphone packetizer

[audio/PcmPacketizer.h](audio/PcmPacketizer.h) now provides bounded synthetic-tested
256-to-320-sample PCM framing, explicit little-endian encoding and local-epoch
cancellation. Host sanitizer tests and the pinned ESP32 compile-only probe passed.
It is not connected to the microphone or network; the running 0.5 sketch is unchanged.
See [audio handoff and checks](audio/README.md) for exact commands, integration
requirements and provisional final-tail handling. No hardware upload is needed.

## Offline petting experiment

At Emilia's explicit request, a separate `lemmi_petting/` sketch adds a locally
enabled three-zone stroke test and short static face reaction. Camera, mic,
speaker and motion initialization stay disabled. It preserves the verified 0.5
camera/audio sketch; uploading petting temporarily replaces that menu. Read
[petting checks](petting-checks.md) for exact commands and recorded hardware checks.
Emilia verified a face reaction, improved smoothness and stopped-state suppression
on petting 0.2. Back-zone response recovered after hands-clear re-enabling.
This separate experiment does not establish the secure F13/integrated F14 gate.

## Authenticated control target

Latest checkpoint: **0.6 uploaded** and accepts the new backend ready descriptors,
then exits the connection for an unknown reason. **0.7 diagnostic build awaits
upload**, adding only safe transport-exit stage/numeric status before cleanup.
See the final control-checks sections; no persistent connection or voice pass is
claimed for this retry.


`lemmi_control/` 0.5 has actual hardware evidence for authenticated WSS,
Start/Pause/Resume/Stop, local Unmute remaining capture-off, explicit reconnect
remaining stopped and a stable screen. 0.6 source/build updates compatibility
with backend-deploy `7debf9a` (documented runtime `17a8522`): handoff capability
recognition, active endpoint ownership, explicit local handoff then separate
Resume, and fixed safe rejection diagnostics. **0.6 upload/hardware are pending.**

Use private `tools/provision-control.py --credential-file data/stackchan-access.json`
with the existing Alex device access file; no fresh pairing code needed. The
file is owner-only/locally Git-excluded. Config/credential stay in device RAM,
then Connect and Start are separate local taps. This target remains bound to
Alex/stackchan-alex; other robot enrollment/profile IDs are not supported yet.
Camera, mic, speaker, petting and motion remain disabled, including when another
endpoint has a listening grant. It advertises audio unsupported; enabling the
server's voice option does not authorize capture. Live speech/media integration
is still pending. Read [control checks](control-checks.md) and the current restart
handoff for exact source/test/hardware evidence and one-step procedures. Never
paste credentials into source, chat or command arguments.

## First test

`lemmi_foundation/lemmi_foundation.ino` shows Ready, Stop and a separate microphone mute setting. Stop latches until an explicit Ready action. Both Ready and Unmute leave capture off. Microphone/speaker initialization is disabled, and camera/network/motion APIs are not initialized. This proves no actual capture/output cancellation until a later audio-enabled hardware test; a software setting is not a physical microphone disconnect.

Use the M5Stack guide’s M5CoreS3 board target. The exact compiler and library selections are recorded in `toolchain.json`; do not overwrite the backend’s Bun setup or your existing ESP-IDF installation. The minimal test explicitly disables PSRAM and selects hardware USB CDC; camera/media PSRAM settings remain to be verified on hardware. Only M5Unified/M5GFX are needed for this first display/touch milestone; the StackChan BSP is evaluated later for body peripherals.

## Local build, macOS

From `firmware/stackchan/`:

```sh
python3 tools/setup.py
python3 tools/build.py
```

Setup downloads the pinned official Arduino CLI, checks the archive against the official SHA-256 manifest, then installs the pinned board platform/libraries in ignored local `.tools/` and `.arduino/` directories. The first compiler download is large because the platform bundles toolchains for multiple chips. This bootstrap currently supports macOS; other platforms require an explicit addition. It does not open a serial port.

Build writes ignored output under `build/foundation/` and never uploads firmware. The setup/build scripts never upload. The explicit `tools/upload.py` helper is for a separately authorized upload: it requires the device-matching, verified 16 MB private backup and the tested esptool 4.12.0 Python environment; it uses the pinned board package’s four image offsets and does not erase all flash or change eFuses. Do not commit local tools, build products, flash backups or credentials. Any future setup/core/library version change should update `toolchain.json` and be compile-checked.

## Connected hardware observations

- macOS exposes `/dev/cu.usbmodem2101`; the USB descriptor identifies an Espressif JTAG/serial interface. Port names may change after reboot/flashing.
- Before upload, Emilia reported the normal existing face. A full private flash image was saved and verified against the device; the old application version was not identified. The foundation test now boots, per its allowlisted serial status.
- USB/boot status does not establish audio/camera/touch or motion capabilities. Setup/build scripts still do not access the serial port. The separately authorized upload performed the expected flash write/reset; no camera capture or motion command was issued.

Before replacing firmware, establish the recovery route and, where readable, keep any flash backup private under ignored `backups/`. A flash backup can contain network credentials. M5Stack documents factory restoration using M5Burner; restoration/settings recovery has not been rehearsed on this device. The pre-upload 16 MB image did pass device verification and has a private SHA-256 manifest. Uploading the test replaces the running application and will not retain the factory face/agent experience while the test runs.

For bounded, receive-only serial observation after upload, run `python3 tools/monitor.py --port PORT --seconds 30` using a Python environment with pyserial. It sets DTR/RTS inactive before opening, sends no commands and only prints allowlisted Lemmi status lines. It must not run concurrently with backup/upload. Device helper dependencies are pinned in `tools/requirements-device.txt`; the working device-transfer environment used esptool 4.12.0 and pyserial 3.5. The board package’s bundled esptool 5.3.0 failed during the initial backup read, so it was not used for the upload.

## Hardware checks after an authorized upload

1. Confirm dimensions/orientation/readability and that the UI responds.
2. Tap Stop: state changes immediately and stays stopped. Repeated taps remain harmless.
3. Tap Unmute: capture stays off and Stop remains latched; tap Ready to return to ready with capture still off.
4. Reboot: microphone stays off and no camera/network/motion action starts.
5. Record actual versions and observations; measure local Stop latency under load later. This tiny no-audio test alone does not satisfy the independent-robot or audio cancellation criteria.

Then test display/touch/Wi-Fi/camera together and audio→camera→audio transitions. Negotiate measured format/memory limits with Anay; camera permission/Allow/expiry/Stop must pass before petting/motion polish. Record hardware acceptance in the build tracker only when observed.

## Backend handoff

`packages/contracts/src/device.ts` and `scripts/fake-device.ts` are starting transport examples only. The documented deployed gateway supports scoped certificate-verified WSS controls and optional voice; the original loopback mock token and `ws://` URL are development-only. Backend-deploy documentation/source and control-checks distinguish current device compatibility from unverified voice/camera integration. Kylie supplies art after measured display/export limits.

Sources: [M5Stack Arduino setup](https://docs.m5stack.com/en/arduino/stackchan/program), [display example/build requirements](https://docs.m5stack.com/en/arduino/stackchan/display), [StackChan BSP](https://github.com/m5stack/StackChan-BSP), [factory recovery](https://docs.m5stack.com/en/StackChan#restore-factory-firmware).

### Uplink diagnostic variant

The separate [`voice_diag` target](lemmi_voice_diag/README.md) observes the exact
SDK socket-poll/TLS-write return paths using verified linker wrappers. It keeps
normal voice 0.9 and all audio limits intact. This is diagnostic preparation,
not a fix or physical voice acceptance. Diagnostic installation and capture-off
boot were checked; provisioning and one UTC-marked capture test remain pending.
Coordinate counterpart review before integrated merge.
