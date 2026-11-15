# Offline pink lights and supervised head-sway experiment

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


## Display 0.7 — pink only on petting, servo controls removed

Emilia clarified that pink must appear only when petted. This new lights-only
request authorizes the behavior update/upload; the explicit stop on servo
investigation remains in force. Prepared display 0.7 starts LED RAM off, keeps
lights off on Resume, turns dim pink on with recognized petting hearts, and
turns them off at the same 1,200 ms deadline. Tap-anywhere Stop/sensor failure
also clears hearts/lights. All five avatars and reduced-motion setting remain.

Removed diagnostic arming control and all power-up/probe/servo-action paths
from the display sketch. Stopped menu now says MOTION DISABLED; there is no
ARM PROBE button. Body startup retains only the VM-off request and LED setup;
no UART initialization or servo traffic is used by the display flow.

Host adapter ASan/UBSan checks pass initial LED RAM black, exact pink words,
clear-to-black and no UART/servo traffic in that LED path. Existing gesture
ASan/UBSan checks pass. Pinned compile passed: 2,860,847 program bytes /
26,444 static globals. Backup/four-image/esptool dry-run and whitespace checks
passed without serial access. Hardware verification
of off at boot/Resume, one-stroke pink+hearts, automatic off and immediate Stop
remains pending; no servo test is requested or authorized.


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


## Display 0.5 candidate — checked native UART transport

Emilia confirms head movement worked with original factory firmware. That is
prior hardware evidence, not proof of current supply/wiring/servo configuration.
0.4 yaw_probe / timeout_empty remains the latest observed Lemmi result.

Prepared 0.5 replaces Arduino HardwareSerial in the body adapter with native
UART1 driver_install/param_config/set_pin/write/read calls matching upstream
SCSerial.cpp's transport choice. Pins/format remain TX6/RX7, 1 Mbps, 8N1.
Initialization now checks errors, rejects an occupied UART without deleting its
owner, cleans up only its own failed installation, and enables VM only after
successful UART setup. RX FIFO threshold is explicitly 1 byte, RX timeout 2
symbols, to make short replies observable. TX completion is checked before the
same 12 ms bounded reply window; wait is pdMS_TO_TICKS(2)+1 ticks, so actual
latency depends on scheduler tick period. Physical Stop latency is unmeasured.
No retry, baud/ID scan, EEPROM write, expanded motion or bypassed probe/ACK.
This is a transport compatibility candidate, not a confirmed root-cause fix.

Host adapter ASan/UBSan tests pass previous scenarios plus occupied UART,
installation/configuration failures and TX-completion failure. Existing valid
simulated servo path remains covered; no physical communication is simulated as
hardware acceptance. Pinned compile passed: 2,871,363 program bytes / 26,476
static globals; private-backup/four-image/esptool upload dry-run and whitespace
check passed without serial access. Hardware upload/attempt pending. Motion remains off at
boot and actual movement acceptance remains failed until observed.

Primary source rechecked November 15:
https://github.com/m5stack/StackChan-BSP/blob/main/src/drivers/FTServo_Arduino/src/SCSerial.cpp


## Display 0.4 candidate — VM pull-up and read-only servo probe

Emilia confirms the USB cable is in the base. Upstream M5StackChan.cpp explicitly
sets VM pin 0 pull-up; the local adapter omitted that configuration. 0.4 adds
read-checked pull-down disable/pull-up enable while holding the output low.
This is a source discrepancy, not a confirmed explanation of the timeout.
An operator-armed attempt now reads yaw torque register 40 before the existing
mandatory acknowledged torque-off writes. Probe timeout vs write timeout can
therefore be distinguished without bypassing any failed acknowledgment. Timeout
status distinguishes zero received bytes from an incomplete reply. No servo ID,
baud, movement limits, power dwell, persistent registers or retry policy changed.

Host BodyHardware simulation ASan/UBSan passes VM pull/unrelated-pin preservation,
no boot servo traffic, failed pull setup, no-reply/partial/read-only reply failures,
no goals after rejected prepare, successful simulated path and VM-off requests.
These are simulated registers/UART only, not measured rail/servo behavior.
Existing sway/packet ASan/UBSan passes. Pinned compile passes: 2,872,555 program
bytes / 26,540 static globals. Backup/image/esptool dry-run passes, no agent serial
access. Hardware upload/diagnostic retry pending; physical movement still FAILED.

Reproduce new adapter check:
```sh
c++ -std=c++11 -Wall -Wextra -Werror -fsanitize=address,undefined -I firmware/stackchan/tests/body_hardware firmware/stackchan/tests/body_hardware.cpp -o /tmp/lemmi-body-hardware-test
/tmp/lemmi-body-hardware-test
```
Sources reviewed November 15:
https://github.com/m5stack/StackChan-BSP/blob/main/src/M5StackChan.cpp
https://github.com/m5stack/StackChan-BSP/blob/main/src/drivers/PY32IOExpander/PY32IOExpander.cpp
https://github.com/m5stack/StackChan-BSP/blob/main/src/drivers/FTServo_Arduino/src/SCSCL.h

Pet-triggered color changes remain requested but unimplemented; current active
lights are steady pink, off while stopped. Preserve that distinction in hardware
reports. Backend testing remains paused at Emilia's request.


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


November 14, 2026: Emilia explicitly requested physical head movement after
petting and pink lights. `lemmi-display/0.2` adds narrow local body adapters to
the existing offline display. Original private backup is unchanged; display
0.1 source/build were preserved under ignored `build/display-0.1-preserved/`.
No credential, network, audio, camera, EEPROM, calibration, RGB animation,
new dependency, full BSP initialization or public command interface added.

## Source facts reviewed

Official M5Stack source, read November 14 (current upstream main; not an installed
or pinned dependency):

- [M5StackChan.cpp](https://github.com/m5stack/StackChan-BSP/blob/main/src/M5StackChan.cpp):
  VM on expander pin 0; yaw ID 1/pitch ID 2; UART1 TX6/RX7, 1 Mbps; position units.
- [PY32IOExpander.cpp](https://github.com/m5stack/StackChan-BSP/blob/main/src/drivers/PY32IOExpander/PY32IOExpander.cpp)
  and header: address 0x6f, pin 13 LED output, 12 LEDs, RGB565 RAM/config/refresh.
- [SCS.cpp](https://github.com/m5stack/StackChan-BSP/blob/main/src/drivers/FTServo_Arduino/src/SCS.cpp),
  [SCSCL.cpp](https://github.com/m5stack/StackChan-BSP/blob/main/src/drivers/FTServo_Arduino/src/SCSCL.cpp)
  and header: request/status packet structure, big-endian words, volatile torque/
  target registers and current position. New code uses these protocol/register
  facts; it does not import the upstream motion framework or settings writes.

## Behavior and constraints

Boot verifies expander version and requests/read-checks VM off before configuring
the LEDs. Active display uses steady dim RGB(48,8,24) pink. Stop requests VM off
and LEDs off; Resume restores pink. I2C is reused without reinitializing its bus.
No automatic retry on body failure. LED color/brightness is not yet observed.

Petting remains enabled in the active display. PHYSICAL MOTION IS OFF AT BOOT.
In the stopped control view, ARM SWAY (TABLE) is an explicit supervised-placement
setting; static mode blocks arming. Resume then returns to the avatar. Stop
disarms motion every time. Hearts alone work without arming physical motion.
There is no held/placement sensor: the operator must place it securely on a
stable table with clearance and supervise; top-strip release is not evidence
that nobody is holding the robot. Leave motion off outside that setup.

One recognized stroke may schedule one preset, with no repeat queue. Wait for
500 ms clear strip; cancellation/new touch/Stop/static mode overrides it. Power
settles 250 ms without blocking the UI loop, then both servo torques are requested
off with validated replies. Read yaw's existing mechanical limits and actual
position; reject bad/failed reads, wheel-mode limits, near-edge or implausible
positions. Set the current position as volatile goal before enabling yaw torque.
No pitch goals or persistent zero/calibration writes.

Preset: measured yaw +6 ticks / -6 ticks / original position, roughly ±1.875°,
with 800/1600/800 ms travel requests, speed value 20. Requests are separated by
travel time plus 100 ms. No catch-up command bursts. Total pending/active window
is six seconds. Read final pose, disable yaw torque and cut shared VM power.
Any protocol/move/position error cuts power and latches motion fault. New strip
contact during powered motion cancels it and disarms; global Stop is handled
before sensor/servo work. Static hearts are unaffected by motion being off.

Hardware power-up torque defaults and mechanical response are unverified; power
could act before the first successful torque-disable exchange. First power-up
and every initial movement check must therefore be explicitly operator-armed on
the stable, clear table. No claim of zero twitch, safe mechanical bounds or
physical stop latency follows from source tests. Power-off confirmation is an
expander register readback, not a voltage/physical motor-stop measurement. I2C
failure cannot guarantee rail cutoff; no independent electrical kill is claimed.
Servo transactions have a 12 ms response deadline each; prepare uses several
transactions. Stop latency/render/SDK I/O bounds still need measurement.

Tap-anywhere Stop remains active during motion. Because this offline view has
no audio/camera/help/network, there are no such live states to override; later
integration must connect those restrictions and the session watchdog. F13 and
integrated F14 readiness remain pending. This is not unattended-use firmware.

## Checks actually run

```sh
c++ -std=c++11 -Wall -Wextra -Werror -fsanitize=address,undefined firmware/stackchan/tests/sway_policy.cpp -o /tmp/lemmi-sway-policy-test
/tmp/lemmi-sway-policy-test
python3 firmware/stackchan/tools/build.py --target display
```

ASan/UBSan passed: release dwell, preset offsets/timing, cancellation in every
phase, touch/static/Stop gating, maximum age, wraparound, exact read request,
wrong-ID/status/size/checksum rejection. These test local policy and packet
validation; they do not emulate the actual servo, power rail, LED controller or
physical placement. Pinned compile passed: 2,871,551 program bytes / 26,532
static globals, plus 153,600 runtime canvas bytes and UART/runtime allocations.
First compile caught Arduino's `bit` macro colliding with a method name; renamed
the method, rebuilt successfully. No hardware upload by the agent.

Existing private-backup/four-image/esptool upload dry-run and diff whitespace
check passed. Hardware acceptance is pending for both lights and motion. First
upload checks pink with MOTION OFF; then separately test armed power-up on table,
release-delayed small sway/return, Stop during each phase, new-touch cancellation,
static mode and sensor/servo failure. If any safeguard fails, leave motion off
or restore preserved 0.1. Counterpart technical review precedes integrated merge.

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

### Display 0.6 first hardware probe receipt

Emilia reports all four flash images hash-verified, then screen BAT 4152mV,
Y:timeout_empty. P result was unreadable because the footer exceeds screen
width; this is a diagnostic UI defect, not a pitch test failure. Battery monitor
voltage is observed at 4.152 V; switched servo VM voltage remains unknown.
Yaw still receives no bytes. Pitch result is pending allowlisted serial receipt;
no further firmware upload required to retrieve it with a fresh monitored probe.
Diagnostic-only movement remains disabled. Do not mark servo power/communication
or motion accepted from the battery reading.
