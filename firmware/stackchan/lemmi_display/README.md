# Avatar-only display — offline 0.1

Latest source uses the shared [light policy](../presentation/README.md): green
capture, blue speech, pink petting, off on Stop. This offline target has no audio
and preserves pink behavior. Compile/host sanitizer checks pass; no upload or
physical green/blue check. Live audio wiring remains pending.

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


**Latest prepared source/build: `lemmi-display/0.2`, not yet uploaded.** Adds
steady dim pink lights and explicitly armed, release-delayed physical sway.
Motion stays OFF at boot. Installed/observed 0.1 evidence below remains distinct.
See [motion implementation and checks](../motion/README.md) before first use.
The old 0.1 source/build is preserved under ignored `build/display-0.1-preserved/`.

Emilia's requested participant display direction: black background, only the
centered character in the ordinary view, largest common scale that preserves
the centered body and fits the hearts without cropping. The exporter uses one
fixed transform for all three frames of each identity; no state-dependent zoom.
The original menu-based `lemmi-avatars/0.1` remains intact as a separate target.

Petting is initialized on startup and enabled whenever the display is active.
A fresh released top-strip stroke triggers 1.2-second static hearts. A held
sensor at boot does not count as a fresh stroke. No Enable petting button.
Local Stop still suppresses all reactions: TAP ANYWHERE on the avatar screen
to Stop immediately and reveal the stopped control view. Resume display acts
on touch release, returning to the avatar with petting enabled. There is no
automatic resume from a top-strip touch. Sensor/memory failure stays explicitly
stopped/unavailable; Resume retries failed sensor initialization. No blind retry.

The stopped view includes Next avatar and static mode for offline review.
There is no mouth test in the normal display; real speech-driven animation and
app-selected identity sync remain unimplemented. Static mode is a future mouth-
animation setting; pet_ack itself is static in both modes. No mic, speaker,
camera, network, servos or media recording initialized. This is an offline
display implementation of the requested visual direction, not integrated
official app/voice/F13/F14 acceptance. A future live screen must retain truthful
capture/camera/help cues over the avatar whenever applicable.

## Build/checks actually run November 14

`python3 firmware/stackchan/tools/build.py --target display` passed with the
existing pinned toolchain: 2,860,287 program bytes / 26,404 static globals.
The 320×240 canvas adds 153,600 runtime bytes; peak heap and render/Stop latency
are unmeasured. Fifteen RGB565 frames occupy 2,304,000 flash bytes. Program uses
90% of the current app partition; this target is deliberately separate from
TLS/control/audio and cannot be assumed to fit those combined unchanged.
No tooling/dependencies/partition changes were made. Original PNGs and old
avatar/control build folders are preserved.

Exact exported RGB565 idle/hearts previews were rendered and visually inspected:
black background, centered lemming, full hearts within screen. Existing gesture
ASan/UBSan executable passed stroke/release/cooldown/suppression/noise/rollover
checks. Backup/image/tool upload dry-run and diff whitespace check passed with
no serial access. No display-target hardware upload or new behavior acceptance
has occurred yet. The earlier avatar-target hardware receipts remain separate.

Hardware next: upload with the existing wrapper `--target display`; inspect
centering/colors on all five, automatic enabled petting after boot/release,
tap-anywhere Stop under reaction, no petting while stopped, explicit Resume
on release and stopped-state sensor error. Check actual free heap and render/
touch latency before integrated use. Keep original private backup unchanged.

## Hardware receipt — November 14, 2026

Emilia reports upload PASS and confirms the character is large and centered on
black, with top-strip hearts working without first enabling petting. These are
user-observed passes for the new display target. Tap-anywhere Stop/Resume,
all-five rendering in this layout, sensor-failure handling, sustained memory and
physical latency remain unverified on this target; earlier menu-target checks
do not substitute for them. Installed firmware is now `lemmi-display/0.1`.

Follow-up: Emilia confirms tapping anywhere stops reactions and reveals stopped
controls. Explicit RESUME DISPLAY followed by touch release returns the avatar
and restores petting without immediately stopping again. These local Stop/Resume
checks now pass by user observation. Physical timing, sustained load, all-five
rendering in this layout and sensor-failure recovery remain unverified.
