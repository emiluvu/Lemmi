# Emilia — resume Stackchan firmware work

Updated November 13, 2026. This is a restart handoff for a new ChatGPT/Codex account.

## Start here

- User is **Emilia**, the firmware/device owner. Repository: `/Users/emiliavu/Documents/ChatGPT/VibeHacks`; remote: `git@github.com:emiluvu/Lemmi.git`.
- Continue on **`emilia/firmware-foundation`**. Last implementation commit before this handoff: **`8fb3871`**, already pushed. The working tree was clean before this handoff was added.
- Read `AGENTS.md`, `firmware/stackchan/README.md`, `firmware/stackchan/hardware-checks.md`, `docs/robot-capabilities-spec.md` and `docs/integration-contracts.md`.
- Keep firmware implementation on this branch. Anay owns backend/contracts, Kylie UI/art, Lukas activity logic/content. Anay’s separate handoff is already on main: `docs/handoffs/anay-device-integration.md` (`236768d`). Do not recreate the scaffold or move firmware onto main as part of resuming.

## Current offline status — resume here

0.5 is uploaded and running; Emilia's local upload passed all four image hashes.
Serial confirms 0.5, 320×240, camera/capture off at boot. Final compile and SCCB
linker/dry-run checks passed: 635,067 program bytes, 74,140 static globals. No tools
were installed and the original private backup remains preserved.

Observed locally across 0.4/0.5:

- Explicit camera permission prompt, then correct-color 160×120 RGB565 preview
  (38400 bytes per frame), 15-second expiry and early local camera Stop.
  Camera teardown was 64 ms on expiry / 65 ms on local Stop in recorded runs.
- Unmute leaves capture off. Explicit 16 kHz mono int16 mic test produced a bar
  responsive to Emilia's voice. Active local Mute reported 4 ms handler cleanup.
- Global Stop during active mic reported `reason=local cleanup_ms=4` at
  04:21:28 UTC. A separate active tone Stop reported `reason=local cleanup_ms=5`
  at 04:22:02 UTC; Emilia confirms the sound cut off early.
- Tone at 64/255 is audible. Earlier 24/255 tones were inaudible despite library
  acceptance; the pinned library squares master volume.

Handler times begin after touch detection; they do not measure physical-input
latency. Audio/camera tests are offline and require separate local activation.
No raw audio/frame recording, payload logging, network or motion was added.

Anay can develop speech adapters against the proposed shared 16 kHz mono
pcm_s16le contract: 20 ms / 320 samples / 640 bytes, base64 in current JSON schema.
Actual firmware mic requests are 256 samples; bounded packetization and live
WSS/pairing/capture grants/output leases/receipts remain to implement together.
No intelligible speech or end-to-end STT/TTS is yet verified. Camera transport
encoding also remains unresolved: hardware preview is RGB565, shared schema JPEG.

Next hardware checks: sequential audio→camera→audio reuse, additional expiry/
request/decline/reboot edge cases and repeated/peak heap measurements. Next
integration handoff: agreed authenticated live control/media contracts from Anay.
No F13/F14 acceptance, general watchdog proof or network-load latency is claimed.
Guide Emilia through any further local tests one action at a time.

## Earlier experiment findings

0.2 rejected a received HAL frame with ESP_ERR_INVALID_SIZE (260), because the
short-timeout cam_take path does not initialize width/height/format. The pinned
SDK disassembly confirmed that esp_camera_fb_get normally fills these fields.
0.3 restored that metadata step and added a regression test; actual preview then
worked but colors were wrong. 0.4 removed the extra display byte swap to match
the vendor example, which Emilia verified fixed the colors. 0.5 raised tone
volume from 24/255 to 64/255, which Emilia verified was audible. See
[feasibility checks](../../firmware/stackchan/feasibility-checks.md) for the exact
per-run measurements and remaining gaps. All changes are on the firmware branch;
check git status/log before assuming the latest local work is pushed.

## Original foundation hardware evidence

Stackchan is connected to this Mac at **`/dev/cu.usbmodem2101`**; recheck the port before using it. It is an ESP32-S3 revision v0.2 with 16 MB flash. Secure Boot and flash encryption reported disabled; no eFuses were changed.

Before the successful 0.2 feasibility upload above, the device ran **`lemmi-foundation/0.1`** from `firmware/stackchan/lemmi_foundation/lemmi_foundation.ino`:

- A 320×240 local screen with Ready, Stop and a separate microphone mute setting.
- No camera/network/motion initialization; microphone/speaker initialization is disabled.
- Emilia physically confirmed the screen and **Stop → Unmute → Ready** behavior: Stop stays latched during Unmute, and Ready returns to capture off.
- Serial independently reported `local_stop`, `mic_unmuted` and `ready`, all with capture off. A separate controlled reboot reported the same firmware, 320×240, capture off and camera off.
- All four uploaded images passed hash verification. These observations do **not** prove active-audio interruption, camera, networking, watchdog or full F13/F14 acceptance. No serial monitor/transfer from the previous session remains running.

## Private backup — retain it

A full original **16,777,216-byte** flash backup was compared successfully against the device before the first upload. It remains local and Git-ignored:

`firmware/stackchan/backups/20261114T021027Z/`

Use `manifest.json` and its `backupFile` entry (`original-flash-16mb-verified.bin`) plus the saved SHA-256. Earlier failed/partial candidates in that directory are **not** valid restore images. Backup files/logs can contain network settings/device identifiers: never commit or upload them. Directory permissions are private. A restoration has not actually been rehearsed; vendor M5Burner recovery is documented in the firmware README.

## Working tools and commands

Tool versions are in `firmware/stackchan/toolchain.json`: Arduino CLI 1.6.0, M5Stack ESP32 core 3.3.10, M5Unified/M5GFX 0.3.0. Current target has **PSRAM disabled**, hardware USB CDC and a 16 MB flash setting. Camera PSRAM settings are not validated yet. Local compiler/SDKs already exist in ignored `.tools/` and `.arduino/`; inspect before downloading again.

From the repository root:

```sh
python3 firmware/stackchan/tools/build.py
```

This compiles only and never accesses the device. Current foundation build reports 549,947 bytes of program storage and 26,036 bytes of static globals, not measured runtime memory.

Device transfers work with the existing Python environment:

`/Users/emiliavu/.espressif/python_env/idf5.5_py3.14_env/bin/python`

It contains **esptool 4.12.0 / pyserial 3.5**. Bundled esptool **5.3.0 failed during the first full backup read**, so 4.12.0 was used successfully for verified backup and upload. Dependencies are pinned in `tools/requirements-device.txt`.

- `tools/upload.py` requires `--port`, `--backup-dir` and `--esptool-python`; `--dry-run` validates files without opening serial. It checks backup integrity, matching device identity/capacity/security, the compiled target, then uses the board package’s four image offsets. It writes real firmware when run without `--dry-run`; do not accidentally invoke it merely to inspect status.
- `tools/monitor.py --port PORT --seconds 30` uses pyserial, sends no commands and prints only allowlisted status lines. Do not run it concurrently with a transfer. Extend its allowlist deliberately for new diagnostics; never print raw image/audio data.
- Build artifacts, tools, backups and secrets stay ignored. Code and observed results are pushed on the firmware branch.

## Original next-milestone research (superseded by continuation above)

Emilia said **“continue with the next milestone.”** Agreed direction: an **offline, locally approved camera preview**, with persistent Camera on notice, local Stop and bounded expiry, followed by **separate** speaker and microphone checks. Camera and mic default off; local buttons explicitly activate each test. No recording, raw sample/frame logging, network transmission, vision inference, servo work or simultaneous audio/camera. This is hardware feasibility, not an authenticated caregiver check-in or proof F13 is complete. Secure F13 integration must precede F14 petting/motion polish.

**At restart commit a7ae270, no milestone code/build/upload existed.** The following was the research baseline; the continuation above records current implementation and check status:

1. The official Stackchan camera example identifies **GC0308**, uses **RGB565**, camera pins D0..D7 = 39,40,41,42,15,16,48,47; VSYNC 46, HREF 38, PCLK 45; SCCB SDA 12/SCL 11; XCLK/PWDN/RESET -1. Verify against the pinned headers and actual sensor. Do not assume native JPEG; Anay’s preliminary frame schema currently permits JPEG only. Any conversion/transport limits need measurement and a contract handoff.
2. The vendor example calls `M5.In_I2C.release()` before camera init. **Do not copy that blindly:** camera and touch share I²C, and losing touch would lose local Stop. The pinned camera SDK uses the new I²C driver, supports `pin_sccb_sda=-1` with `sccb_i2c_port` to reuse an existing bus, and GC0308 support is enabled. Validate ownership/arbitration and teardown, not just successful init.
3. Pinned M5GFX 0.3.0 source (`src/lgfx/v1/platforms/esp32/common.inl`) warns that sharing a foreign platform I²C bus does not serialize concurrent transactions. Do not assume a camera worker and `M5.update()` can touch the shared bus concurrently without coordination. No architecture was finalized; linker hooks, SDK edits or bus-release workarounds have **not** been implemented.
4. The upstream public `esp_camera_fb_get()` can wait up to four seconds. Don’t block the UI/control loop in it. Design cancellation, bounded queues, expiry and safe init/deinit ownership before calling the preview usable; measure real Stop latency. No delayed frame can reappear after Stop.
5. Start with a small bounded RGB565 frame, potentially 160×120 / one buffer in DRAM, if the pinned driver/hardware supports it; this is a proposed experiment, not a measured capability. If PSRAM is needed, verify its actual mode instead of guessing.
6. M5Unified audio config for CoreS3/StackChan uses I²S1: mic MCLK0/BCLK34/WS33/DIN14, speaker BCLK34/WS33/DOUT13. The pinned `M5.begin` audio setup configures callbacks/pins; explicit begin/record/play starts the relevant path. Verify startup stays off. Test a low-volume generated tone; microphone test should use tiny transient buffers only, display a local level if useful, zero/discard samples and never replay/store speech. Mic/speaker cannot run simultaneously here.
7. Avoid `M5StackChan.begin()` for now: BSP source initializes the body and enables servo power. The first milestone deliberately uses M5Unified only.

Useful official references: [camera](https://docs.m5stack.com/en/arduino/stackchan/camera), [mic](https://docs.m5stack.com/en/arduino/stackchan/mic), [speaker](https://docs.m5stack.com/en/arduino/stackchan/speaker), [ESP32 camera driver](https://github.com/espressif/esp32-camera), [StackChan BSP](https://github.com/m5stack/StackChan-BSP).

Anay still needs to supply scoped reachable WSS/pairing and complete audio/camera contracts. The starter gateway binds to 127.0.0.1 and is mock-only; changing its hostname or using its fixed mock token is not real device integration. No provider keys or caregiver/private data go into firmware.

## If the next chat cannot access local files

Provide the
[current branch handoff](https://github.com/emiluvu/Lemmi/blob/emilia/firmware-foundation/docs/handoffs/emilia-resume.md)
and [feasibility checks](https://github.com/emiluvu/Lemmi/blob/emilia/firmware-foundation/firmware/stackchan/feasibility-checks.md),
or paste their contents. The original restart baseline is
[emilia-resume.md at a7ae270](https://github.com/emiluvu/Lemmi/blob/a7ae270/docs/handoffs/emilia-resume.md);
that immutable link predates the offline feasibility implementation.
