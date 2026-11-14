# Offline camera/audio feasibility — Emilia

This is a local hardware experiment, not F13 or a connected Lemmi client. The
verified foundation sketch is preserved. Use the same pinned toolchain with PSRAM
disabled; no dependencies were installed for this milestone.

## Implemented, compile-checked behavior

`lemmi_feasibility/lemmi_feasibility.ino` (`lemmi-feasibility/0.2`) starts with
camera and audio off. No Wi-Fi, network, storage, BSP/body or servo APIs are used.
M5.begin configures the pinned CoreS3 audio pins/callbacks, but Mic.begin/record and
Speaker.begin/tone are reached only after a local test action.

- Camera test first asks **ALLOW CAMERA** / **Not now**. No response expires after
  30 seconds. Allow authorizes at most 15 seconds including startup; startup has a
  2-second timeout. The notice and Stop remain outside the 160×120 preview.
- Proposed camera configuration: GC0308 PID 0x9b, RGB565, 160×120, one DRAM driver
  buffer and one 38,400-byte replaceable application preview buffer. Format and
  length are checked before copying. Preview blanks after 1.5 seconds without a
  newly displayed frame. Pacing targets at most about 3 fps; this is unmeasured.
- Stop invalidates the local generation before cleanup, blanks the preview and
  prevents Ready/new tests while camera teardown is pending. The screen continues
  to say **CAMERA stopping** until the worker finishes. Teardown taking 5 seconds
  triggers a reboot; reboot never restores a test. These bounds need hardware
  verification and are not a demonstrated worst-case latency guarantee.
- Unmute changes only a setting. A separate **Start mic test** action is required.
  The mic test uses one 256-sample int16 buffer at 16 kHz, displays a transient peak
  bar, zeroes consumed samples and expires at 5 seconds. Mute ends this test.
  Samples are never replayed, written to storage or sent over serial/network.
- The separate speaker test requests a generated 440 Hz tone for 1 second at
  volume 24/255. Camera, mic and tone are mutually exclusive. Stop flushes audio.
  Completion/expiry leaves Stop latched; explicit Ready returns to capture off.

## Bus and camera ownership

The official example releases M5's I²C bus. This experiment instead provides the
camera library's SCCB symbols in `CameraBus.cpp`, retaining M5Unified ownership
throughout. GC0308 8-bit register operations use M5.In_I2C at 100 kHz, under the
same application mutex as M5.update. Other sensor addresses and 16-bit register
operations fail. A camera transaction rechecks cancellation after obtaining the
mutex. The UI tries the mutex without waiting, then retries on the next loop.
No foreign IDF bus driver is installed. The build rejects maps containing the SDK
SCCB object and verifies the application adapter was linked.

A single worker owns camera init/frame access/deinit. It does not draw or change
the UI gate. It tags the replaceable preview with the current generation; Stop
invalidates acceptance before clearing buffers. Each consumed driver frame and
the application copy are wiped. Driver DMA/queued buffers are transient SDK-owned
memory freed at deinit; complete physical RAM erasure is not established.

The public esp_camera_fb_get API can wait about four seconds. This experiment
uses the internal `cam_take(TickType_t)` symbol from the pinned 3.3.10 SDK with a
50 ms timeout, matching the upstream cam_hal.h declaration. This is an explicitly
version-dependent ABI, not a stable public API: re-review on every SDK update.
Frame absence for two seconds fails the test. Pacing sleeps are interruptible in
10 ms intervals. Initialization and deinitialization remain SDK calls whose real
latency must be measured; Stop does not claim camera off before teardown finishes.

References: [M5Stack camera example](https://docs.m5stack.com/en/arduino/stackchan/camera),
[Espressif camera HAL declaration](https://github.com/espressif/esp32-camera/blob/master/driver/private_include/cam_hal.h),
[Espressif SCCB declarations](https://github.com/espressif/esp32-camera/blob/master/driver/private_include/sccb.h).
The installed pinned headers, library symbols and final linker map were also
inspected. Upstream master is research context, not an installed dependency pin.

## Commands (repository root)

Compile only, no serial access:

```sh
python3 firmware/stackchan/tools/build.py --target feasibility
c++ -std=c++11 -Wall -Wextra -Werror firmware/stackchan/tests/local_gate.cpp -o /tmp/lemmi-local-gate-test
/tmp/lemmi-local-gate-test
```

The host gate test checks default mute, explicit Allow, request/active expiry,
Stop latching across unmute, delayed Allow/frame rejection, mutual exclusion,
explicit Ready and millisecond rollover. It does not emulate camera/I²C/I²S.

Recheck the device port. Validate backup/build/tooling without opening serial by
adding `--dry-run` to this explicit upload command:

```sh
python3 firmware/stackchan/tools/upload.py --target feasibility --port /dev/cu.usbmodem2101 --backup-dir firmware/stackchan/backups/20261114T021027Z --esptool-python /Users/emiliavu/.espressif/python_env/idf5.5_py3.14_env/bin/python
```

Actual upload replaces the running app. The helper retains the original private
backup/evidence and creates a new private `backups/runs/<timestamp>-feasibility/`
for diagnostics, transfer log and upload manifest. It still verifies the original
backup integrity, device identity/capacity/security and all four image hashes.
For the foundation sketch, build/upload omit `--target` or use `--target foundation`.

Receive-only status monitoring (never concurrent with a transfer):

```sh
/Users/emiliavu/.espressif/python_env/idf5.5_py3.14_env/bin/python firmware/stackchan/tools/monitor.py --port /dev/cu.usbmodem2101 --seconds 60
```

Only fixed status events and bounded numeric diagnostic fields are printed. No
raw camera/audio payloads are accepted by the monitor. `cleanup_ms` measures the
Stop handler after touch detection, not physical-touch latency. The separate
`stop_to_closed_ms` measures asynchronous camera teardown. `max_loop_gap_ms` is
the largest loop gap since boot, not a complete input-to-hardware latency proof.

## Local hardware procedure — results pending

Use a private, non-sensitive scene and no bystanders. Do not activate tests via
serial commands; this firmware has no serial command handler.

1. After upload, verify the boot status and visible screen: camera/mic off, no
   tone or motion. Wait without touching controls and confirm nothing activates.
2. Camera test → Not now; then request again and let the 30-second request expire.
   Both must leave camera off. Stop then Unmute must stay stopped/capture off.
3. Ready → Camera test → Allow. Confirm a real changing preview, persistent notice
   and working touch Stop during startup and during frames. Record numeric results,
   Stop handler time, teardown time, frame waits and heap values. A zero-frame
   result or lost touch is a failure, not camera feasibility success.
4. Repeat with automatic 15-second expiry. Confirm preview blanks, no delayed
   frame returns, explicit Ready is required, and a second cycle works.
5. Ready → Speaker tone. Confirm audible low volume, Stop interruption and expiry.
   Do not infer audible sound from `ok=1` (it only reports library acceptance).
6. Ready → Unmute. Confirm no level/capture starts. Start mic test explicitly;
   confirm a changing bar with local sound, Mute/Stop interruption, expiry and a
   cleared display. No speech recording/replay is needed or permitted.
7. Repeat tone → camera → Stop → mic → Stop → camera. Never run concurrently.
   Reboot after active tests and verify all paths return to off.

Failure leaves the feature unavailable for F13. No WSS, JPEG conversion/transport,
Wi-Fi/TLS load, caregiver consent/authorization, remote viewer, full watchdog or
F13/F14 acceptance is established by this experiment.

## Results recorded this session

- Final pinned feasibility compile passed: **635,075 bytes program**, **74,140
  bytes static globals**. Runtime camera/DMA/I²S heap has not been measured.
- Host gate assertions passed; Python helpers parsed; git diff whitespace check
  passed. Linker map confirmed application SCCB and no SDK SCCB driver object.
- Upload dry-run passed, including original 16 MB backup SHA-256 integrity.
- Agent upload attempt stopped at serial preflight with macOS **Operation not
  permitted**. Port existed and lsof showed no holder. **No firmware write was
  attempted.** Emilia then ran the helper successfully in local Terminal.
- Local upload completed at 2026-11-14 02:43:58 UTC (November 13 local time): all
  four images hash-verified. The saved private manifest's application hash matches
  the current feasibility build. No erase-all or eFuse changes were requested.
- Emilia confirms the visible startup screen says **Lemmi offline test** and
  **Camera / microphone off**, with control boxes. This confirms the displayed
  default state; active camera/audio and interruption remain untested.
- Emilia's receive-only monitor reported at 2026-11-14 03:39:50 UTC:
  `firmware=lemmi-feasibility/0.2 display=320x240 capture=off camera=off`.
- Emilia tapped Camera test and confirmed **Preview on this screen**, while the
  screen still said **Camera / microphone off**. Allow has not been confirmed;
  no active preview is established. Not now was the next instructed action, but
  its result has not been reported. A new request may be needed after timeout.
- Camera/mic/tone activation, decline/request timeout, runtime memory, active expiry,
  Stop latency and repeated peripheral transitions remain pending.
