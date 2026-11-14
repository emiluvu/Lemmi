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
  volume 64/255 in 0.5 (24/255 in 0.2–0.4). Camera, mic and tone are mutually exclusive. Stop flushes audio.
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
  screen still said **Camera / microphone off**. Subsequent local Allow attempts
  are recorded below; no usable preview is established yet.
- Camera/mic/tone activation, decline/request timeout, runtime memory, active expiry,
  Stop latency and repeated peripheral transitions remain pending.

## First activated camera result and correction

Emilia locally activated Allow on 0.2. The screen showed **CAMERA ON - local only**
with a black preview, then **Camera test failed**. A monitored repeat reported:

- Local Allow at 2026-11-14 03:51:23.598728 UTC.
- `code=260 frames=0 max_wait_ms=49 heap_before=281252 heap_after=281220`.
- Stop handler after camera completion: `reason=camera_done cleanup_ms=1 camera_pending=0`.

260 is ESP_ERR_INVALID_SIZE (0x104), not a frame timeout. The 0.2 code received a
HAL frame but rejected its metadata: cam_take does not populate width/height/format.
The public esp_camera_fb_get wrapper normally fills those from the initialized
sensor. This was confirmed in upstream source and the pinned SDK disassembly.
`frames=0` counts accepted preview copies, not total sensor frames received.
The heap readings are before initialization and after teardown, not peak runtime
usage or proof of a leak. The 1 ms handler ran after teardown; it does not prove
Stop interruption latency.

A 0.3 source correction restores the SDK metadata step using the initialized
sensor configuration, retains exact 38,400-byte payload validation, and adds an
allowlisted metadata-only frame diagnostic. A host regression checks that an
unannotated HAL frame is accepted after finalization while wrong lengths, null
payloads and mismatched sensor settings still fail. No frame pixels are logged.
0.3 compile passed: 635,223 program bytes / 74,140 static-global bytes. The
SCCB linker check and backup-integrity upload dry-run passed. Hardware upload/
preview verification remains pending.

Run the additional regression with:

```sh
c++ -std=c++11 -Wall -Wextra -Werror firmware/stackchan/tests/camera_frame.cpp -o /tmp/lemmi-camera-frame-test
/tmp/lemmi-camera-frame-test
```

## 0.3 observed preview and expiry; 0.4 color experiment

Emilia's local 0.3 upload passed all four image hash checks. The receive-only
monitor reported 0.3, 320×240, capture/camera off at 03:56:47 UTC on November 14.
On local Allow at 03:58:03, Emilia saw a picture, with extremely incorrect colors.
The first accepted frame reported width 160, height 120, format 0 (RGB565),
38400 bytes, valid=1. Final result: code=0, accepted copies=49, max wait=49 ms,
heap before=281252 / after=279784 bytes. This is approximately 3.3 accepted copies
per second over the 15-second Allow interval; displayed freshness/FPS and peak
runtime memory were not independently measured. The heap delta needs repeated
cycles before drawing a leak conclusion.

At 03:58:18 the log reported **reason=expired**, handler cleanup 1 ms, camera
pending=1, followed by camera closed with stop-to-closed=64 ms and maximum loop
gap=99 ms. Emilia confirmed return to the off screen. Although local Stop was
instructed, there is no local Stop event in this run: record automatic expiry
with local Stop interruption still pending. These figures describe this one run,
not worst-case physical input latency or general watchdog acceptance.

0.4 removes the explicit display byte swap, matching the manufacturer's uint16_t
RGB565 pushImage example and the pinned M5GFX default swap=false. It restores the
previous display setting after each push. Byte-order mismatch is the likely
color cause, not an established hardware diagnosis; actual 0.4 colors remain to
be observed. Camera and microphone remain off until the usual local actions.

0.4 compile passed: 635,067 program bytes / 74,140 static globals. Application
SCCB linker and backup-integrity upload dry-run passed. No 0.4 upload/preview
result has been observed yet.

## 0.4 observed correct preview, expiry and local Stop

Emilia uploaded 0.4 with all four image hashes verified. Serial at 04:01:49 UTC
reported 0.4, 320×240, capture/camera off. Emilia confirms correct picture colors.
On November 14 UTC (November 13 local), the monitor captured:

| Cycle | Accepted frame copies | End reason | Handler cleanup | Camera closed | Max loop gap | Heap before / after |
| --- | --- | --- | --- | --- | --- | --- |
| Allow 04:02:35 → end 04:02:50 | 49 | expired | 1 ms | 64 ms | 100 ms | 281252 / 281220 bytes |
| Allow 04:02:58 → end 04:03:01 | 6 | local | 1 ms | 65 ms | 108 ms | 281220 / 281220 bytes |

Both returned code=0, max wait=49 ms; metadata was 160×120, RGB565 (format 0),
38400 bytes. These establish working local preview, correct colors, one automatic
expiry and one early local Stop. They do not establish worst-case touch latency,
long-duration memory stability, network coexistence or secure F13 integration.
Emilia now requests local mic/speaker validation for the speech handoff.

## First local audio observations (0.4)

Emilia tapped Unmute, then explicitly started the 5-second mic test and spoke.
She confirmed that the green level bar moved with her voice. This establishes a
local sound response only: it does not establish intelligible speech, measured
sample-clock accuracy, signal quality or live backend STT. The sketch requests
256 int16 mono samples at 16 kHz, discards/zeros them and does not transmit them.

After returning to Ready, Emilia tapped Speaker tone (1s) and reported no audible
sound. Speaker playback is unverified; collect `audio_start kind=tone ok=...` and
Stop/expiry logs before changing the volume or attributing it to hardware. The
current requested volume is 24/255 and the tone is 440 Hz. No TTS readiness is
implied. Camera and microphone tests remain separate from playback.

## Silent speaker diagnostics; 0.5 volume experiment

On 0.4, Emilia repeated the speaker test twice while monitored. At 04:11:50 and
04:11:55 UTC, `audio_start kind=tone ok=1` was followed by `reason=expired`,
cleanup_ms=6, camera_pending=0. Emilia heard neither tone. Library acceptance
therefore did not establish audible output; no initialization error was reported.

The pinned Speaker_Class.inl squares the master volume in its mixing gain. The
24/255 request is especially quiet, so 0.5 requests 64/255 as a moderate test.
Camera/mic activation and the 1-second tone bound are unchanged. Low volume is
a hypothesis, not the demonstrated cause of silence. No 0.5 audible result has
been observed, and speaker/TTS output remains unverified.

0.5 compile and SCCB linker checks passed (635,067 program bytes, 74,140 static
globals), as did the backup-integrity upload dry-run. Local upload and audible
result remain pending.

## 0.5 audible speaker confirmed

Emilia uploaded 0.5 from local Terminal; the helper reported all four image hashes
verified. She explicitly tapped Speaker tone (1s) and confirmed the tone was
audible at the revised 64/255 setting. The previous 24/255 retries were inaudible.
This establishes audible generated-tone output at 64/255 in this setup; it does
not establish speech intelligibility, PCM network playback or calibrated loudness.
Together with the earlier voice-responsive mic bar, basic local audio input/output
are observed. Active mic mute/Stop, active output Stop, repeated audio↔camera
transitions and the authenticated STT/TTS round trip remain pending.

## 0.5 active microphone mute observed

Receive-only serial at 2026-11-14 04:16:28 UTC confirmed 0.5, display 320×240,
capture/camera off. Emilia confirmed that Unmute left the off notice unchanged.
At 04:18:13.047 UTC, `audio_start kind=mic ok=1` was followed at 04:18:13.660
by `test_stop reason=mute cleanup_ms=4 camera_pending=0`, after the instructed
local MUTE action during capture. This verifies that the active local test reached
its mute cleanup path in that run. The 4 ms figure starts after touch detection;
it is not a measured physical-touch-to-I²S latency guarantee. No raw samples or
waveforms were logged. Global Stop during mic capture, Stop during audible output,
repeat audio↔camera transitions and live STT/TTS still need separate checks.

## 0.5 active microphone/global Stop and speaker Stop observed

Emilia's monitor confirmed 0.5 startup with capture/camera off at 04:20:25 UTC.
At 04:21:27.480, `audio_start kind=mic ok=1` was followed at 04:21:28.090 by
`test_stop reason=local cleanup_ms=4 camera_pending=0`, after the instructed red
Stop action during the mic test.

At 04:22:02.476, `audio_start kind=tone ok=1` was followed at 04:22:02.679 by
`test_stop reason=local cleanup_ms=5 camera_pending=0`. Emilia confirms the audible
tone cut off early. This establishes the local Stop cleanup path for active mic
and audible speaker output in these runs. Handler figures start after touch
detection; physical input latency and server-side cancellation remain unmeasured.

### Current offline evidence and remaining boundary

Observed: camera off at boot, explicit permission prompt, correct-color 160×120
RGB565 preview, automatic 15-second camera expiry, early local camera Stop,
Unmute leaves capture off, voice-responsive mic bar, active mic mute and global
Stop, audible generated speaker tone at 64/255, early audible-output Stop.

Not established: speech intelligibility, calibrated rate/volume, microphone signal
quality, sustained/repeated audio→camera→audio reuse, Wi-Fi/TLS load, PSRAM modes,
long-run heap stability, remote authorization or live STT/TTS/audio transport.
Anay can implement speech adapters against the proposed shared 16 kHz mono
pcm_s16le / 20 ms / 640-byte frame contract. Firmware still needs bounded
256→320-sample packetization, explicit live grants/receipts and the agreed
authenticated WSS transport. No microphone/generated-speech recording was added.
