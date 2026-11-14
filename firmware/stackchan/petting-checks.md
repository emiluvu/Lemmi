# Offline petting experiment

Requested explicitly by Emilia after the offline camera/audio checks, while live
backend contracts are pending. The repository normally gates integrated F14 behind
secure F13. This is a separate local touch-only experiment; neither acceptance
gate is declared complete. The existing foundation/feasibility sources, audio
packetizer and private full-flash backup are preserved on the firmware branch.

## What is implemented

`lemmi_petting/` (`lemmi-petting/0.2`) starts with reactions disabled and displays
**Camera / microphone off**. M5Unified microphone/speaker initialization is
disabled; no camera, network, motion, servo UART, RGB or NFC code is initialized.
A local **ENABLE PETTING** button initializes only the touch controller. A
three-zone stroke displays a static happy face and **Pet received :)** for 1.0
seconds. This is temporary test art, not a new avatar or Kylie's final pet_ack asset.

The touch adapter uses Si12T at documented address 0x68, on M5.In_I2C (SDA12,
SCL11), 100 kHz. It configures channel/reference controls, uses low sensitivity
level 3, hardware response-cycle configuration 0x22 and active scanning, then
checks register readbacks. It samples output register 0x10 at a proposed 20 ms
poll interval, mapping front/middle/back in the manufacturer's physical order.
Only this touch address is configured; the full StackChan BSP is not installed or
called because its begin path enables servo power and initializes motion.

The pure recognizer requires:

- 100 ms of released strip before arming, including after enable/Stop.
- Front→middle→back or reverse, allowing overlapping electrode readings. Total
  contact duration must be 60–1400 ms; per-zone minimum gaps are not imposed.
- A release before another stroke; held/all-zone contact cannot queue reactions.
- At least 1.2 seconds between acknowledgments. No reaction extension/queue.

These timing/sensitivity choices are experiments, not measured input thresholds.
Sensor intensity is not pressure, emotion, consent, a help acknowledgment or a
speech/camera command. Touch circles on the idle screen assist local diagnosis.

Stop is handled before polling/rendering, disables polling/reactions and clears
the visible reaction. Ready clears the stopped screen but leaves petting disabled;
a fresh Enable is required. A failed I²C read also disables reactions immediately,
with no cached touch interpretation or automatic retry. The sensor's own scan
configuration can remain active after application disable; **petting off** means
polling/reactions off, not a physical sensor power disconnect. M5's UI and the
strip adapter run on one task; no foreign bus driver is installed.

The reaction body uses one 320×96 RGB565 off-screen canvas in DRAM (61,440 pixel
bytes plus library overhead), explicitly with PSRAM disabled. It composes a complete
body before display; raw zone transitions update only the three small circles.
Header, controls and Stop are not redrawn on each touch sample. Allocation failure
keeps reactions disabled. Runtime memory and visible improvement need hardware checks.

Sensor failure diagnostics report only the initialization stage:
1 = bus pins, 2 = initial read, 3 = configuration write, 4 = readback verification,
5 = output read, 6 = display buffer allocation. No raw camera/audio samples are logged.

## Sources and boundary

Hardware facts and configuration were checked against official sources:

- [Manufacturer hardware/address reference](https://docs.m5stack.com/en/StackChan).
- [Official top-touch example](https://docs.m5stack.com/en/arduino/stackchan/touchsensor).
- [Si12T register driver](https://github.com/m5stack/StackChan-BSP/blob/main/src/drivers/Si12T/Si12T.cpp)
  and [header](https://github.com/m5stack/StackChan-BSP/blob/main/src/drivers/Si12T/Si12T.h).
- [Physical zone mapping](https://github.com/m5stack/StackChan-BSP/blob/main/src/utils/touch_sensor/touch_sensor.cpp).
- [BSP begin/body side effects](https://github.com/m5stack/StackChan-BSP/blob/main/src/M5StackChan.cpp).

No external package was installed. The small application adapter was implemented
from the register facts; full BSP code/dependencies were not vendored. Actual
sensor presence, readback behavior and responsiveness must be checked locally.

## Build and checks (repository root)

```sh
c++ -std=c++11 -Wall -Wextra -Werror -fsanitize=address,undefined firmware/stackchan/tests/pet_gesture.cpp -o /tmp/lemmi-pet-gesture-test
/tmp/lemmi-pet-gesture-test
python3 firmware/stackchan/tools/build.py --target petting
```

Host sanitizer assertions passed for both stroke directions, release-before-arm,
held-touch suppression, cooldown, simultaneous contacts, noisy/slow transitions,
suppression during a stroke and millisecond rollover. These are recognizer tests,
not proof that real touches reach it or that local Stop latency is bounded.

Recheck the port before uploading. Use `--dry-run` to validate without serial:

```sh
python firmware/stackchan/tools/upload.py \
  --target petting \
  --port /dev/cu.usbmodem2101 \
  --backup-dir firmware/stackchan/backups/20261114T021027Z
```

This replaces the running feasibility menu with the petting-only screen. Camera
and audio tests remain available in the preserved `--target feasibility` source.
The upload helper retains the original private backup/evidence and writes new
private diagnostics under `backups/runs/`. Do not run a monitor during upload.

For read-only status observation after upload:

```sh
python firmware/stackchan/tools/monitor.py --port /dev/cu.usbmodem2101 --seconds 120
```

## Local hardware procedure — pending

1. Verify the startup screen and camera/mic off notice; petting starts disabled.
2. Tap Enable with fingers clear of the TOP strip, then release it for a moment.
   Confirm the enabled state or report the unavailable event/stage honestly.
3. Stroke the TOP three-zone strip front→middle→back, then try the reverse. The
   side rows are LEDs. Confirm the zone circles respond and one happy face appears.
4. Hold a hand still on the strip; confirm there is no repeated reaction queue.
5. Start another reaction, then tap touchscreen Stop. Confirm it clears promptly.
   Pet while stopped: no reaction. Ready alone: still no reaction until Enable.
6. Re-enable, release and repeat; reboot and confirm reactions start disabled.

No sound or motion reaction is included. Local touch evidence does not establish
secure F13, integrated F14, all-avatar art, watchdog/network behavior or unattended
robot readiness. Record actual observations separately from expectations.

## Results so far

Pinned petting compile passed: 551,975 program bytes / 26,060 static globals
(compiler figures, not runtime measurements). Host gesture ASan/UBSan checks,
Python helper syntax, monitor allowlist checks and git whitespace checks passed.
Upload dry-run passed, including the original 16 MB backup SHA-256 integrity.
No serial access/upload was attempted by the agent. Hardware remains on the last
observed 0.5 firmware until Emilia performs the new local upload.

## 0.1 hardware observation and 0.2 correction

Emilia uploaded 0.1 locally with all four images hash-verified and enabled the
sensor. She observed the happy face on some strokes, inconsistent recognition on
others, and visible screen flicker while petting. This establishes some real
touch/reaction operation; reliability and Stop acceptance remain unverified.

Inspection found that raw zone changes redrew the whole screen. 0.2 confines
updates to the content region/circles and composes face changes off-screen. It
also accepts overlapping zone states and a 60–1400 ms overall stroke window,
retaining release and cooldown. Synthetic fast/overlap/suppression tests pass.
These address concrete code limitations; actual smoothness and recognition
improvement remain to be observed after local 0.2 upload.

0.2 pinned compile passed: 557,323 program bytes / 26,404 static globals. The
61,440-byte canvas allocation is runtime DRAM, not included in static globals.
Updated host gesture ASan/UBSan, helper syntax, whitespace and original-backup
integrity upload dry-run checks passed. 0.2 hardware upload remains pending.

## 0.2 local results

Emilia's local 0.2 upload passed all four image hash checks. Its private upload
manifest application hash matches the current compiled binary. After enabling,
she initially reported that only two dots responded and the back area did not.
Disable/re-enable with hands clear, followed by a two-second wait, made a back-only
touch light the third indicator. This supports checking baseline/setup first;
it does not establish a sensor defect or a specific calibration mechanism.

She then confirmed that a front→middle→back stroke showed the face and that the
earlier flicker was gone. After red Stop and another stroke, she confirmed it
stayed stopped with no reaction. Thus local stroke/reaction, smooth rendering in
that test, back-zone response and stopped-state suppression are observed. Ready/
reboot, sustained reliability and formal input latency remain hardware-pending.
The device is running petting 0.2, with media/motion disabled; this is still an
offline experiment, not secure F13/integrated F14 acceptance.
