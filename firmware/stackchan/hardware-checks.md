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
