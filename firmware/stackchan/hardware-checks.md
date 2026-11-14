# Stackchan foundation — observed checks

Date: November 13, 2026 (America/Los_Angeles). Work remains on `emilia/firmware-foundation`.

| Check | Observation | Status |
| --- | --- | --- |
| USB detection | Espressif native JTAG/serial interface detected | Observed |
| Chip/flash/security readout | ESP32-S3 revision v0.2, 16 MB flash; Secure Boot and flash encryption report disabled | Observed before upload; no eFuse changes |
| Original firmware backup | Complete 16,777,216-byte image saved privately; esptool verify_flash matched device flash; SHA-256 manifest saved locally | Passed; actual restore has not been attempted |
| Transfer compatibility | Bundled esptool 5.3.0 read failed partway. Existing esptool 4.12.0 successfully read matching slow/fast 1 MB samples, then read and verified all 16 MB | Fallback observed; no writes during backup attempts |
| Pinned compile | M5CoreS3, USB hardware CDC, PSRAM disabled, pinned Arduino platform/libraries | Passed; compile figures in README |
| Authorized upload | Same four image offsets as the board package recipe; every image reported hash verification, command exited successfully and requested hard reset | Passed with esptool 4.12.0; no erase-all |
| Firmware startup | Receive-only monitor observed `firmware=lemmi-foundation/0.1 display=320x240 capture=off camera=off` | Observed |
| Visible test screen | Emilia confirms the Lemmi screen and red Stop button are visible | Observed by Emilia |
| Readability/usability at intended distance | Not evaluated by the initial visibility confirmation | Pending |
| Local Stop / mute / Ready | Emilia confirms Stop stays latched during Unmute and explicit Ready returns to capture off. Serial independently reported local_stop, mic_unmuted and ready with capture off. No active audio queues exist in this tiny test | Observed by Emilia; active-audio cancellation remains pending |
| Reboot behavior | A separate controlled hard reset produced the expected foundation startup line reporting 320×240, capture off and camera off | Observed for this standalone test; integrated reconnect/watchdog behavior remains pending |
| Local control latency under load | Not measured; no camera/network/media load in foundation test | Pending |
| Microphone/speaker/camera/Wi-Fi/body peripherals | Not initialized/tested by this foundation firmware | Pending |
| Independent robot, F13/F14 acceptance | This test is not proof of integrated audio cancellation, watchdog, authorized camera or safe motion | Pending |

Private flash images and diagnostic/upload logs are under ignored `backups/`, protected by directory permissions. Do not commit them or include their contents in public logs; they may contain saved network settings. The local manifest identifies the valid full backup; earlier failed/partial reads are not restore images. No real participant data or provider credentials were added to the firmware.

Recovery uses the private manifest’s original image and the verified ESP32-S3/16 MB identity, with the tested device tooling. Retain that backup before any later firmware experiment. M5Burner factory restoration is the vendor-documented alternate route, not a rehearsed settings restore.

## Offline feasibility follow-up (0.2)

A separate sketch and test procedure are in [feasibility-checks.md](feasibility-checks.md).
Pinned compile and host control-gate checks passed; backup-integrity upload dry-run
passed. The agent's real upload attempt was denied at serial open (`Operation not
permitted`), before firmware writes. Emilia then uploaded in local Terminal:
all four images hash-verified, and the private manifest application hash matches
this build. Emilia confirms the startup screen shows **Lemmi offline test** and
**Camera / microphone off**, with control boxes. Receive-only serial confirmed
`firmware=lemmi-feasibility/0.2 display=320x240 capture=off camera=off` at
2026-11-14 03:39:50 UTC. Tapping Camera test displayed the permission prompt while
still showing camera/mic off; Allow has not been confirmed. Active camera/audio,
decline/expiry, runtime memory and Stop latency remain pending.
All hardware rows above remain scoped to the previously verified foundation test.

Emilia subsequently allowed the 0.2 camera test: the on notice appeared, preview
remained black and the test failed. A repeat's serial result was code 260
(ESP_ERR_INVALID_SIZE), accepted frames 0, max frame wait 49 ms, heap before
281252 / after 281220 bytes. Post-completion Stop cleanup was 1 ms, with no camera
teardown pending; this is not active Stop latency. Investigation found the
short-timeout HAL call omits the public wrapper's frame metadata initialization.
A 0.3 correction and regression test are prepared; actual preview and active Stop
remain unverified. See feasibility checks for exact observations and reproduction.

0.3 was then uploaded/hash-verified by Emilia. Serial confirmed off at startup.
Local Allow produced a visible picture with severely incorrect colors and 49
accepted 160×120 RGB565 / 38400-byte frame copies. Automatic 15-second expiry
reported teardown 64 ms, maximum loop gap 99 ms, max frame wait 49 ms, with
post-teardown heap 279784 versus 281252 before initialization. The log says
`reason=expired`, not local Stop; active local Stop and repeated-cycle memory
checks remain pending. 0.4 removes an extra display byte swap to match the vendor
example; color correction and all audio tests remain hardware-pending.

0.4 was uploaded/hash-verified; serial startup reported capture/camera off. Emilia
confirmed correct preview colors. One cycle expired after 15 seconds (49 accepted
frames, teardown 64 ms, max loop gap 100 ms); a second ended on local Stop after
6 frames (teardown 65 ms, max loop gap 108 ms). Both code=0 and max wait 49 ms;
second-cycle heap before/after was 281220/281220 bytes. This verifies local camera
Stop in that run, not worst-case physical latency or F13. Local audio tests are next.

0.4 local mic test: Emilia confirms the green level bar moved when she spoke after
explicit Unmute + Start mic test. This is a local signal-response observation, not
intelligibility/STT or sample-clock verification. Speaker tone at 24/255 was
reported inaudible; output remains unverified, with status diagnostics needed.

Monitored speaker retries on 0.4 both reported `audio_start kind=tone ok=1` and
expiry (6 ms cleanup), yet Emilia heard no tone. 0.5 source raises the requested
volume from 24/255 to 64/255; the pinned mixer squares master volume. This is an
experiment, not a proven diagnosis or audible-output acceptance.

0.5 was uploaded/hash-verified by Emilia. She tapped Speaker tone (1s) and
confirmed an audible tone at 64/255. Basic local mic response (0.4) and speaker
output (0.5) are observed; intelligible speech, active audio interruption and
authenticated STT/TTS transport remain unverified.

0.5 active mic mute: Emilia confirmed Unmute leaves capture off, then explicitly
started the mic test and pressed Mute during capture. Serial `audio_start
kind=mic ok=1` was followed by `reason=mute cleanup_ms=4 camera_pending=0` at
04:18:13 UTC. This measures handler cleanup after touch detection, not total
physical-input latency. Active global Stop/output cancellation remain pending.

0.5 global Stop during active mic: `audio_start kind=mic ok=1` at 04:21:27.480
→ `reason=local cleanup_ms=4 camera_pending=0` at 04:21:28.090 UTC. Speaker
Stop: `audio_start kind=tone ok=1` at 04:22:02.476 → `reason=local cleanup_ms=5
camera_pending=0` at 04:22:02.679; Emilia confirms the audible tone cut off early.
Both are local handler measurements after touch detection. Live transport, speech
intelligibility, full watchdog and network cancellation remain unverified.
