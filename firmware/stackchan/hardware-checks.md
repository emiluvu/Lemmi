# Stackchan foundation — observed checks

## Display 0.2 hardware receipt and 0.3 diagnostics — November 15

Emilia reports top-strip hearts work. Lights appeared pink after explicit Resume;
no petting is required for the current steady active-display pink behavior.
Stopped menu displayed ARM SWAY (TABLE). Static mode initially prevented arming;
after setting static mode off, SWAY ARMED was observed. After Resume and one
stroke/release, Emilia observed no head movement and the menu showed MOTION FAULT.
Servo/power/movement acceptance FAILED in that attempt; leave motion disarmed.
The failed stage was unavailable in 0.2; do not infer torque, UART or pose cause.

Prepared 0.3 adds fixed servo failure-stage and transport-status diagnostics to
the stopped menu footer and allowlisted serial monitor. It retains explicit
arming, bounded pose checks, no automatic retry and power-off request on failure.
No broader travel, persistent writes, new dependencies or live integration.
Host sway/packet ASan/UBSan checks passed. Pinned compile passed (2,872,415
program bytes / 26,540 static globals); backup/image/esptool upload dry-run
passed without serial access. Hardware
upload and a separately supervised diagnostic attempt remain pending.


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

0.5 sequential reuse observed in one monitored run: camera Allow → local Stop
(6 valid frame copies, teardown 65 ms), then mic start → local Stop (4 ms cleanup),
then speaker starts → expiry (6 ms cleanup). Emilia confirms the speaker was
audible after the camera/mic changes. This verifies camera→mic→speaker reuse in
that run, not reverse audio→camera reuse, stress/peak-memory or live STT/TTS.

## Separate offline petting experiment — pending hardware

Emilia explicitly requested a touch/reaction prototype while backend handoff is
pending. Source uses only the Si12T strip and static visual response, with local
Enable/Stop and media/motion initialization disabled. Host recognizer sanitizer
checks passed; sensor presence, actual gesture detection, Stop and restart behavior
are unobserved. See [petting checks](petting-checks.md). Secure F13 and integrated
F14 acceptance remain pending. No change to the verified 0.5 source or private backup.

Petting 0.1 was uploaded/hash-verified by Emilia. She enabled it and observed the
happy face on some strokes, missed strokes and screen flicker while touching.
Thus touch/reaction operation exists, but reliable interaction is not passed.
0.2 source limits updates to the content region/circles, uses off-screen face
composition and tolerates overlap/timing variation. Updated gesture sanitizer
tests pass; actual rendering improvement and Stop/restart checks remain pending.

Petting 0.2 upload/hash verification passed; private application hash matches the
current build. Emilia confirms a stroke shows the happy face without the earlier
flicker, and Stop suppresses further pet reactions. A reported missing back zone
responded as the third dot after hands-clear disable/re-enable; baseline is a
possible explanation, not a proven diagnosis. Ready/reboot/repeated reliability
checks remain pending. Current petting-only firmware keeps camera/mic/motion off.

## Authenticated control source — hardware pending

Control 0.1 pinned compile (1,339,299 program bytes, 52,804 static globals), host
policy ASan/UBSan and three private-provisioning/status tests passed. The compiled
on-device protocol self-check and real Wi-Fi/HTTPS claim/WSS/watchdog/revocation
remain unobserved. No control upload has occurred yet; petting 0.2 remains the
last observed running firmware. See [control checks](control-checks.md).

Control 0.1 local upload passed all four hash checks after a USB reconnect fixed
initial preflight no-response. Serial at 08:13:32 UTC November 14 confirmed
selftest_passed, control_boot and firmware 0.1 at 320×240, capture/camera off.
Live Wi-Fi/claim/WSS remain pending; provisioning needs a fresh caregiver-created
pairing. The Mac helper now offers `--create-pairing` with a hidden local caregiver
token, never sent to firmware; six fixture tests pass, real request untested.

Control 0.2 final upload/hash verification passed. Emilia's explicit Wi-Fi-only
test showed association passed; saved control_wifi_ready at 17:52:31 UTC confirms
it with capture/camera off. No pairing/backend/DNS/TLS/WSS request is made in that
mode, and the radio is shut down after the test. Earlier failure cause remains
unknown. Backend pairing/control verification is next, without another upload.

Correct-network retry: Emilia identified a wrong SSID entry, corrected it locally
and confirmed pass. Saved control_wifi_ready at 18:39:46 UTC November 14 confirms
association/capture off. No SSID/password was logged. Backend claim/WSS remain
pending; normal provisioning now needs fresh pairing after the backend reset.

## Full control sequence observed — November 14, 19:19–19:20 UTC

On uploaded control 0.5, Emilia supplied these fixed status receipts:

- Pause at 19:19:01 UTC: ack applied=1; phase=paused stopped=0.
- Explicit Resume at 19:20:11 UTC: ack applied=1; phase=ready stopped=0.
- Local Stop from ready at 19:20:32 UTC: control_local_stop, ack applied=1;
  phase=ended stopped=1.

Together with Start at 19:15:01 UTC, this is actual hardware/backend evidence for
Start → Pause → Resume → local Stop, all capture=off camera=off. Timestamp spacing
is observed serial event spacing, not a physical touch latency measurement.
Display flashing improvement still awaits Emilia's explicit visual confirmation.
Credential restart/revocation, network loss/watchdog, sustained load, and real
mic/STT/TTS/camera streaming remain unverified in this connected control target.

Visual confirmation after the full 0.5 control sequence: Emilia confirms the
screen flashing has stopped. This is a user-observed hardware result, not only
a source/rendering assumption. Start behavior and flicker fixes are now both
confirmed on the uploaded firmware.

## Reboot/self-check and local Unmute — November 14, 19:23 UTC

After the bounded helper observer ended, Emilia opened the receive-only monitor.
It observed control_selftest_passed, control_boot and firmware=lemmi-control/0.5
320x240 at 19:23:04 UTC. This establishes a new boot occurred; its cause is not
established. Ending an observer alone is not proof of a reboot/disconnect.
The 0.5 expanded synthetic protocol self-check (including null expiry handling)
is now observed passed on-device. RAM-only provisioning must be restored for
further backend checks. A local Unmute at 19:23:25 UTC emitted control_mic_unmuted
capture=off camera=off. This verifies capture stayed off after a local Unmute on
the fresh boot; it is not a connected-session mute/unmute receipt. Next restore
local Mute, then deliberately reprovision/connect as needed.

## Local mute and explicit disconnect/reconnect — November 14

After the previously observed reboot, local Mute at 19:24:18 UTC emitted
control_mic_muted capture=off camera=off. Emilia privately reprovisioned the same
existing credential and explicitly connected; at 19:26:34 UTC device ready and
phase=ended stopped=1 were observed. Start at 19:27:39 UTC was acknowledged,
phase=ready stopped=0. On-screen DISCONNECT at 19:28:41 UTC emitted local_stop
then disconnected, capture/camera off. Explicit local CONNECT at 19:29:09 UTC
succeeded with ready/ack and phase=paused stopped=1. The existing session was
not automatically resumed, and local Stop stayed latched on reconnect. No new
pairing claim was needed; the same credential was accepted again.

This verifies deliberate disconnect/reconnect, not unplanned Wi-Fi loss, physical
watchdog timing or backend restart/revocation. A final explicit Stop is requested
to end the paused test session. No raw microphone, speaker or camera media was
enabled in this control-only test.

## Final test cleanup — November 14, 19:29:53 UTC

Emilia's final local Stop emitted control_local_stop, ack applied=1, and
phase=ended stopped=1, all camera/capture off. The paused reconnect test session
is ended. On 0.5, actual checks now include authenticated ready/state/ack,
Start/Pause/Resume/Stop, a stable screen after the redraw fix, local fresh-boot
Unmute remaining capture-off/Mute restored, and explicit disconnect/reconnect
remaining locally stopped with no automatic resume. Unexpected network loss/
watchdog timing, backend restart/revocation, peak/load memory and integrated
STT/TTS/camera media remain unverified. Original backup remains preserved.

## Backend deploy upgrade follow-up — 0.6 not yet uploaded

Emilia later reports installed control 0.5 shows “Invalid server state” with
camera/mic off. Fetched backend-deploy 7debf9a documents runtime 17a8522 and emits
handoff plus text controls (eight), which 0.5 rejects. Firmware 0.6 fixes this
reproduced contract incompatibility and adds ownership/explicit handoff handling
and safe parser-rejection stages. Actual rejected packet was not captured; do
not claim live resolution until uploaded and observed. Host real-cJSON/policy
sanitizers, 12 helper tests, exact fetched backend schema checks, pinned compile
and backup-integrity upload dry-run pass. No backend changes, installation,
private file changes or 0.6 hardware upload occurred. Control target remains
legacy Alex-bound and audio/camera unsupported; live robot speech stays pending.

## Control 0.6 first hardware connection — November 14, 20:44 UTC

Emilia uploaded 0.6: all four flash images hash-verified, then privately
reprovisioned the existing credential file and tapped Connect. At 20:44:15.928
UTC: control_ready, then ack applied=1, phase=none stopped=1. Thus the new ready
control descriptors and empty session were accepted on hardware. At .931440 UTC,
control_connect_failed followed immediately. No protocol_reject or protocol_error
was reported. The generic event does not distinguish socket poll/read/close,
Wi-Fi link loss or a send failure. This is NOT a rejected ready payload, expired
pairing proof or confirmed backend failure. No Start/media was requested; camera/
capture stayed off. Next: one explicit Connect retry on retained RAM enrollment,
keeping the same observer open; if repeated, add bounded numeric transport-stage/
close-code diagnostics and coordinate deployment status with Anay. No new key or
re-upload is justified merely by this generic status. TLS validation stays on.

## Diagnostic 0.7 hardware result — November 14, 20:50:30 UTC

Emilia uploaded 0.7 (PASS), privately reprovisioned and explicitly tapped Connect.
Observed ready, ack applied=1, phase=none stopped=1, then:
`stage=read result=-1 opcode=256 upgrade=101 errno=0 wifi=3 reason=0 ready=1 age_ms=10185`.
Camera/capture stayed off. Wi-Fi remained associated and HTTPS/WSS upgrade plus
application ready had succeeded. No new WS header was decoded for the failing
read (opcode NONE=256); no close reason/code was captured. age_ms includes Wi-Fi/
TLS/setup, NOT time since ready. Do not identify the whole 10.185s as session time.

Inspected installed esp-idf-v5.5.1 transport source: TLS read maps a clean peer FIN
to -1, while WS read_exact_size also turns an underlying zero-byte timeout into
-1 before a header is complete. Therefore this diagnostic alone cannot prove a
server-initiated close or firmware timeout. Do not ignore/retry all negative
reads (a partial header might have been consumed) or disable verification.
Next obtain Anay's sanitized gateway/proxy disconnect/restart/access/heartbeat
cause near 20:50:30 UTC before another blind flash or credential change. If no
server cause is available, richer numeric TLS error/underlying-read diagnostics
may be required. Existing credential/backup remain preserved. Live voice pending.

### Display 0.3 observed failure — first yaw torque-off reply

Emilia reports 0.3 upload PASS, then one armed supervised stroke produced no
movement and menu diagnostic yaw_torque_off / timeout. The first yaw torque-off
write did not receive a complete validated status reply within 12 ms. No goal
or torque-enable command was reached by this path; failure requests VM off and
latches motion fault. This does not prove physical rail cutoff or torque state.
Official upstream M5StackChan.cpp and SCSerial.cpp rechecked November 15:
UART1 at 1 Mbps, TX6/RX7 and yaw ID1 agree with the Arduino adapter's RX7/TX6.
Write acknowledgments are expected by the official default Level=1 driver.
Root cause remains unresolved (power/UART/reply configuration not measured).
Next inspect USB power connection before changing protocol or bypassing replies.
Official sources: https://github.com/m5stack/StackChan-BSP/blob/main/src/M5StackChan.cpp
and https://github.com/m5stack/StackChan-BSP/blob/main/src/drivers/FTServo_Arduino/src/SCSerial.cpp

### Display 0.4 hardware receipt — yaw probe receives zero bytes

Emilia reports four-image hash-verified upload PASS. An armed stroke then showed
yaw_probe / timeout_empty. The added read-only torque read received zero bytes
within 12 ms, so no torque-off write, goal or torque-enable was reached in that
attempt. VM-off was requested on failure; electrical cutoff remains unmeasured.
VM pull-up setup did not resolve the observed communication failure. Motor
movement still fails hardware acceptance. Leave motion unarmed; avatar/hearts
and observed steady pink remain the offline fallback. Backend work stays paused.

Official power-board schematic reviewed for supply/UART topology:
https://m5stack-doc.oss-cn-shenzhen.aliyuncs.com/1205/SCH_Power.pdf
No confirmed new firmware correction yet. Next establish whether these servos
moved under original firmware; do not overwrite calibration or bypass probe/ACK
checks to force motion.

## Display 0.6 diagnostic-only preparation — after native UART failure

Emilia reports 0.5 four-image hash-verified upload PASS; the supervised attempt
again showed yaw_probe / timeout_empty. Native UART did not resolve communication.
Movement remains FAILED and disabled in prepared 0.6; no new root cause claimed.

Official power-board schematic was visually inspected via a locally rendered
PDF: TX_EN is derived by board circuitry from Servo_TX, not a separately exposed
software direction control. INA226 monitors BAT_IN near the battery path, not
the switched VM output. A monitor voltage is not a VM voltage measurement.
Source: https://m5stack-doc.oss-cn-shenzhen.aliyuncs.com/1205/SCH_Power.pdf

0.6 replaces stopped ARM SWAY with ARM PROBE (TABLE). Motion is unarmed at boot.
Explicit arm/Resume/stroke/release powers the rail for the existing settle time,
reads INA226 register 2 (1.25 mV/LSB; existing pinned INA226_Class confirms scale),
and sends read-only torque-register probes to IDs 1 and 2. No torque writes,
servo goals, mode, ID, baud or calibration writes are in the diagnostic flow.
Power-up itself may twitch due to servo defaults; use only supervised clear table.
After both bounded reads it requests VM off and enters stopped PROBE COMPLETE,
with battery millivolts and Y/P result codes in the footer. No automatic rerun;
Stop still cancels pending power/probe. Off=1 logs only latch readback, not voltage.
The helper allowlists the fixed diagnostic line; no raw payload logging added.

Host adapter sanitizer tests pass diagnostic read-only packet inspection, both
IDs, battery scaling/unavailable read, no/partial/valid replies and VM-off request,
as well as prior initialization/failure checks. Final pinned compile passed:
2,870,479 program bytes / 26,476 globals. Backup/four-image/esptool dry-run
and whitespace checks passed; no serial access.
No 0.6 hardware upload or probe observation yet. Pink-on-active and pet hearts
remain the fallback; requested pet-triggered color changes remain unimplemented.

### Display 0.6 first hardware probe receipt

Emilia reports all four flash images hash-verified, then screen BAT 4152mV,
Y:timeout_empty. P result was unreadable because the footer exceeds screen
width; this is a diagnostic UI defect, not a pitch test failure. Battery monitor
voltage is observed at 4.152 V; switched servo VM voltage remains unknown.
Yaw still receives no bytes. Pitch result is pending allowlisted serial receipt;
no further firmware upload required to retrieve it with a fresh monitored probe.
Diagnostic-only movement remains disabled. Do not mark servo power/communication
or motion accepted from the battery reading.

## Final servo attempt — stopped at Emilia's requested limit

November 15, 2026, 00:40:53 UTC allowlisted hardware receipt on display 0.6:
servo_probe battery_mv=4155 yaw=timeout_empty pitch=timeout_empty off=1,
followed by display_stop. Both servo read probes received zero bytes. Battery
monitor reports 4.155 V; off=1 confirms only VM latch readback, not measured rail
voltage or physical torque. Servo communication/movement acceptance FAILED.
Root cause remains unresolved; native UART/pull-up changes did not resolve it.

Emilia explicitly limited this to the final diagnostic attempt and requested
pink lights as fallback. Stop servo investigation: no further probe, power-up,
firmware upload, baud/ID scan or motion experiment is authorized by this task.
Installed 0.6 has no servo writes/goals in the display flow and remains unarmed
at boot; do not use its ARM PROBE control again. Explicit RESUME DISPLAY returns
to the offline avatar with petting hearts and steady pink lights, leaving probe
unarmed after completion. Tap-anywhere Stop suppresses effects. No new upload is
needed to use that fallback. Live backend work remains paused; no media enabled.
Future motion work requires a fresh user request. Pet-triggered color changes
were not implemented; do not claim lights currently react to petting.

## Display 0.7 user acceptance — pink lights only when petted

Emilia confirms the requested pet-triggered pink-light behavior works after the
0.7 update instructions, then requests push. Avatar/hearts plus 1.2-second pink
lights are the accepted offline fallback. No servo/probe controls remain in
the display sketch; servo communication/motion remain failed and work is stopped.
No network, camera, microphone or app-avatar synchronization is enabled here.
Formal measured Stop latency, sustained load, sensor-failure and all-five layout
checks remain unrun unless separately recorded in prior receipts.

Pre-push verification: host ASan/UBSan body/LED adapter, control policy and real
cJSON parser checks pass; all 12 provisioning/privacy checks and fetched backend
schema fixture/hello/handoff validation pass. Display 0.7 pinned compile and
backup/image/esptool upload preflight passed during preparation. Whitespace check
passes. No real speech/provider/camera or independent-use acceptance is implied.
