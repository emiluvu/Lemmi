# Emilia’s Stackchan firmware

The `emilia/firmware-foundation` branch contains an initial standalone display/touch test. It is not a connected Lemmi client. It has not been flashed or hardware-verified yet. The pinned setup and compile scripts passed on the development Mac; the explicit target build reports 549,947 bytes of program storage and 26,036 bytes of static globals. These are compiler figures, not measured runtime memory or control latency.

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

Build writes ignored output under `build/foundation/` and never uploads firmware. There is deliberately no automatic upload step. Do not commit local tools, build products, flash backups or credentials. Any future setup/core/library version change should update `toolchain.json` and be compile-checked.

## Connected hardware observations

- macOS exposes `/dev/cu.usbmodem2101`; the USB descriptor identifies an Espressif JTAG/serial interface. Port names may change after reboot/flashing.
- Emilia reports the normal existing face is running. Its exact firmware version and configuration are not known.
- USB detection does not establish audio/camera/touch or motion capabilities. No serial reset, flash write, camera capture or device motion has been requested by the setup/build scripts.

Before replacing firmware, establish the recovery route and, where readable, keep any flash backup private under ignored `backups/`. A flash backup can contain network credentials. M5Stack documents factory restoration using M5Burner; restoration/settings recovery has not been rehearsed on this device. Uploading the test replaces the running application and will not retain the factory face/agent experience while the test runs.

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
