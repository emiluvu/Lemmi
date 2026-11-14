# Emilia’s Stackchan firmware

Switching accounts or resuming? Read [Emilia’s restart handoff](../../docs/handoffs/emilia-resume.md).

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

`packages/contracts/src/device.ts` and `scripts/fake-device.ts` are starting transport examples only. The shared gateway is still loopback mock-only; its development token and `ws://` URL are not production pairing/TLS or a usable K151 deployment. Anay supplies scoped reachable WSS and agrees audio/camera/control schemas with Emilia before real device transport is enabled. Kylie supplies art after measured display/export limits.

Sources: [M5Stack Arduino setup](https://docs.m5stack.com/en/arduino/stackchan/program), [display example/build requirements](https://docs.m5stack.com/en/arduino/stackchan/display), [StackChan BSP](https://github.com/m5stack/StackChan-BSP), [factory recovery](https://docs.m5stack.com/en/StackChan#restore-factory-firmware).
