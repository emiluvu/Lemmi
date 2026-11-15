# Emilia — Stackchan restart handoff

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


### Observed control 0.9 Start — November 15, 00:00:43 UTC

Emilia's fixed-status receipt shows ack applied=1, state phase=ready stopped=0,
and owner local=1 after explicit Start. Initial ended snapshot reported local=0;
the new active session is owned by Stackchan. Capture/camera remained off.
Connection remained present from ready at 00:00:01 through Start at 00:00:43.
Pause/Resume/Stop on 0.9 and sustained transport remain pending; no voice/media
acceptance. Next: local Pause while the same observer remains open.


### Observed control 0.9 connection — November 15, 00:00:01 UTC

Emilia reports upload PASS, then same-credential RAM provisioning and local
Connect. Fixed statuses: control_ready, control_ack applied=1, and control_state
phase=ended stopped=1; capture/camera off throughout. Ready compatibility is
hardware-observed. This establishes connection and safe stopped synchronization,
not sustained transport, Start/control acceptance on 0.9, voice or camera.
Next: explicit local Start with the same bounded observer open.


## Control 0.9 continuation — November 14, 23:56 UTC rejection

Emilia reports 0.8 upload PASS; local manifest confirms all four image hashes
and the uploaded application matches the prepared 0.8 build. New Connect still
rejected ready_fields after WSS 101, ready=0, capture/camera off.
Fetched backend-deploy advanced from 2b833ef to 01b6ffb: ready now also emits
optional boolean photoStory (false for robot). This is a second reproduced
source mismatch consistent with the live rejection; no raw live payload read.
Control 0.9 accepts only that boolean metadata; no photo execution or media
permission added. Both teaching/photoStory absent/false/true accepted;
malformed, duplicate and unknown keys rejected transactionally in real-cJSON
ASan/UBSan tests. Fixture/hello/handoff validate against fetched shared schemas.
Pinned compile passed: 1,346,047 program bytes / 53,060 static globals.
Backup/four-image/esptool upload dry-run, 12 helper/privacy tests and whitespace
check passed. No agent serial access. Hardware upload/Connect pending.


Updated November 14, 2026, after the final 19:29:53 UTC hardware receipt.
This document replaces the earlier chronological restart notes. Detailed evidence
remains in the checks documents linked below. No secrets are included here.

## Start here: workspace and preservation

- User: **Emilia**, Lemmi firmware/device owner. Guide hardware/Terminal work
  **one short actionable step at a time**; wait for her result before the next.
- Repository: `/Users/emiliavu/Documents/ChatGPT/VibeHacks`.
- Branch: **`emilia/firmware-foundation`**. Inspect working tree before changes.
  HEAD at handoff preparation: `4e8993f` (app data schema proposal); previous
  firmware implementation commit: `2795e3e`. Main `be1e096` was merged via
  `56ccfaa`. This does not establish that deployed backend source is current.
- **Latest firmware/helper/results/handoff changes are uncommitted and not pushed.**
  Do not reset, clean, discard, checkout over, or replace them with remote files.
  They are the tested continuation, not disposable leftovers. Inspect diff first.
- Read `AGENTS.md`, this document, `firmware/stackchan/README.md`,
  `firmware/stackchan/control-checks.md`, `firmware/stackchan/hardware-checks.md`,
  `docs/robot-capabilities-spec.md` and `docs/integration-contracts.md`.
- Anay owns backend/contracts, Kylie UI/art, Lukas activity logic/content.
  Stay in Emilia's firmware slice; no second backend/session authority. Secure
  F13 precedes integrated F14. Standalone offline petting was explicitly authorized.
- Preserve private original flash backup and private device credential file.
  Never print or commit credentials, Wi-Fi details, private logs or raw media.

## Current hardware checkpoint — 0.7 read failure after accepted ready

### Latest actual installed checkpoint — control 0.7 restored; ready rejected

Emilia chose server reconnect and reports control upload PASS; original credential
unchanged. Two helper probes timed out without sending secrets. A deliberate RST
disconnected USB (monitor Errno 6); port returned, reopened monitor observed
selftest_passed/boot/control 0.7 at 23:39:59 UTC. After stopping monitor, private
RAM provisioning succeeded. Connect at 23:41:20 UTC upgraded WSS 101 but failed
protocol ready_fields, ready=0, attempt age 3776 ms. No further Connect requested.

Found fetched backend `2b833ef` emits optional boolean device.ready.teaching,
missing from 0.7's strict allowed keys. Preparing 0.8 narrow compatibility fix,
with real-cJSON malformed/duplicate/unknown-field tests, boot check and exact
backend-schema validation passing, plus all 12 helper/privacy tests. Source-
fixture mismatch is consistent with live rejection; no raw live payload captured.
This does not enable teaching/audio/camera. New compile/upload checks pending.
Installed display/petting art is currently replaced by control, all preserved.
No report of display 0.2 upload; pink/head-motion hardware still untested.

0.8 compile now passed (1,346,007 program / 53,060 globals), as did upload dry-run
and whitespace check. Hardware pending. Open helper must be stopped before local
upload; then same private credential-file provisioning, Connect once and inspect
fixed statuses. No agent serial access or key changes.

### Latest preparation — pink LEDs / physical head sway, 0.2 awaits upload

Emilia explicitly requested physical head sway after petting and pink lights.
Prepared display 0.2 using narrow official register/protocol adapters; no full
BSP, dependency changes, EEPROM/calibration or pitch goals. Steady dim pink on
active display, lights/VM off on Stop. Physical motion OFF at boot: stopped menu
ARM SWAY (TABLE), then Resume; one release-delayed measured-position ±6-tick
yaw sweep and return, Stop/new touch/static override, no reaction queue.
Placement/holding cannot be sensed; first powered tests require secure table,
clearance and supervision. Servo power-up response/twitch, real power-off and
Stop latency remain unverified. Do not imply hardware motion acceptance.
Installed 0.1 remains unchanged; preserve `build/display-0.1-preserved/` plus
original private backup. 0.2 sanitizer policy/packet tests, pinned compile
(2,871,551 program / 26,532 globals), upload dry-run and whitespace check passed.
No agent serial access or upload. Next one local upload step, then inspect pink
with motion still off; arm only during the subsequent explicit table rehearsal.
Exact commands/limits/sources: `firmware/stackchan/motion/README.md`.

### Latest requested screen direction — display target awaiting upload

Latest follow-up: Emilia confirms tap-anywhere Stop suppresses reactions and
opens stopped controls. Explicit RESUME DISPLAY on release returns the avatar
and restores petting without immediately re-stopping. These checks pass by user
observation on installed display/0.1; all-five layout, physical latency, sustained
load and sensor-failure recovery remain unverified. App sync/live voice pending.

Subsequent hardware receipt: Emilia reports upload PASS and confirms the large
centered character on black plus top-strip hearts without a prior Enable action
("yes perfect"). `lemmi-display/0.1` is now installed. New display-target
tap-anywhere Stop/Resume, all-five rendering and latency/load remain pending.

Emilia requests a centered largest-fit character on black with no ordinary menu
and petting always enabled. Added separate `lemmi-display/0.1`, `--target display`;
installed `avatars/0.1` and its source/build are preserved. Petting auto-enables
on boot and explicit Resume; TAP ANYWHERE is local Stop, which opens the stopped
control view and suppresses reactions until explicit Resume on release. Failure
stays stopped/unavailable. No audio/camera/network/live app selection added.
Compile passes: 2,860,287 program / 26,404 globals, plus 153,600 runtime canvas;
90% partition means integrated TLS/audio needs a separate flash/memory plan.
Rendered exact RGB565 idle/hearts preview inspected; existing gesture executable
and backup/image/tool upload dry-run pass. Hardware upload/behavior pending.
Next guide one local `upload.py --target display` step after observers stopped.
See `firmware/stackchan/lemmi_display/README.md`. All work local/uncommitted.

### App-avatar/voice preparation after offline acceptance

Added isolated `presentation/AvatarPresentation.h` and host cancellation/revision
tests plus compile-only `--target presentation`. Host ASan/UBSan and pinned ESP32
compile pass (309,780 program / 22,248 globals); not wired into control/avatars,
no upload and installed avatar preview unchanged. Fetched backend ref now resolves
to `2b833ef` (no merge/service request). Existing paired-device profile GET can
supply avatarId/revision; WSS snapshots lack avatarId. Speech schema exists but
control still negotiates unsupported audio. Detailed exact seam, scope/driver
responsibilities and owner handoff: `firmware/stackchan/presentation/README.md`.
Next work is bounded authorized profile read and real capture/output/cancellation
adapter, then bind avatar/frame rendering. Do not claim app sync or live voice yet.

### Latest continuation — offline avatar target prepared, not uploaded

Subsequent hardware receipt: Emilia reports `--target avatars` upload PASS and
confirms explicit STOP clears mouth/hearts and suppresses subsequent top petting.
Thus the avatar target is now installed, replacing control 0.7; control source/
build remain preserved, and control RAM enrollment must be restored when returning.
No measured Stop latency or individual mouth-duration/Ready/static-mode/all-avatar
acceptance yet. Next verify READY leaves effects off, then test features separately.

Follow-up observed: READY keeps petting disabled until explicit ENABLE PETTING;
then a top-strip stroke displays hearts briefly and they disappear. Emilia
confirmed both. Next separately verify mouth animation and bounded ending;
static mode and all-five rendering still pending. No integrated speech/app sync.

Further hardware receipts: Emilia confirms TEST MOUTH cycles open/closed and
returns closed after about six seconds; STATIC MODE ON keeps it closed during
TEST MOUTH. Observed passes for isolated mouth-test bounded ending and static
mode. All-five rendering, physical Stop latency and sustained load remain pending.
App-selected avatar sync and live speech-driven mouth control are unimplemented.

Latest visual receipt: Emilia confirms all five avatars have correct colors and
shapes on the uploaded offline target. Current observed checks: all-five rendering,
mouth cycle/automatic ending, static mode, explicit petting activation/brief hearts,
Stop suppression and Ready effects-off. No physical latency or sustained-load pass.
Next integration handoff: agree authoritative selected-avatar sync with Anay/Kylie,
then drive mouth frames from actual bounded playback/cancellation rather than the
preview timer. Keep F13/integrated F14 acceptance distinct. All work remains local.

Emilia reports Anay attributed the earlier failure to backend downtime. A new
November 14 21:17:13 UTC attempt (after fresh 0.7 boot and private reprovisioning)
returned upgrade=409, ready=0, stage=connect; fetched gateway maps duplicate
device reservation to 409. Anay reports clients share one device ID, so backend
testing is deferred rather than rotating keys or repeatedly connecting.

At Emilia's request, prepared separate `--target avatars` (lemmi-avatars/0.1):
five Kylie-derived avatar sprite strips, silent bounded mouth test, explicitly
enabled top-strip hearts, static mode and local Stop. No network/audio/camera/
motion/app selection sync. Compile passed (1,178,775 program / 26,412 globals),
existing gesture sanitizer tests and upload dry-run passed. Not uploaded yet;
guide one local step at a time. Source/build of control 0.7, credential and backup
preserved. See `firmware/stackchan/lemmi_avatars/README.md`. Avatar upload will
replace the control app and clear RAM enrollment. All changes remain local.

0.7 upload passed; private provisioning/Connect at November 14 20:50:30 UTC
produced ready/ack/phase=none stopped=1, then transport_exit:
stage=read result=-1 opcode=256 upgrade=101 errno=0 wifi=3 reason=0 ready=1
age_ms=10185. Camera/capture off. This confirms Wi-Fi association, verified WSS
upgrade and accepted application ready. No header decoded on the failing read;
reason is **not established**. Attempt age includes association/TLS, not just WSS.

Inspected SDK: WS exact header read converts a zero-byte timeout to -1, while
underlying TLS peer FIN also returns -1. Do not claim server close, ignore all
negative reads, change keys or keep blindly reflashing. Next ask Anay to check
sanitized gateway/proxy close/restart/auth/heartbeat cause near 20:50:30 UTC;
coordinate while frontend/voice changes are in progress. If no cause is visible,
add numeric TLS/underlying-read diagnostics. Latest code remains local/unpushed.
No media activation or voice completion. Private backup and credential preserved.

## Current continuation — repeated post-ready exit; 0.7 diagnostics prepared

Uploaded 0.6 accepted ready/ack/empty session then emitted connect_failed twice:
November 14 20:44:15 UTC and explicit reconnect 20:45:39 UTC. No parser rejection,
Start or media. Camera/capture off. The old capability mismatch is resolved for
these ready events; the cause of the subsequent disconnect is **unknown**.

0.7 adds a bounded fixed/numeric transport-exit event BEFORE cleanup, separating
setup/hello/send/poll/read/close/link/watchdog and parser exits with native Wi-Fi
status/reason, socket errno, opcode, upgrade status, ready flag and monotonic
attempt age. No payload/header/ID/close reason text logging, SDK behavior or TLS
bypass. 12 observer/privacy tests and exact backend-schema checks pass. Compile
and dry-run evidence is at the end of control-checks.md. 0.7 upload/hardware pending.

Next: stop observer, upload diagnostic --target control, re-provision same private
--credential-file (no new pair/key), Connect once with helper open, inspect
control_transport_exit. Do not keep blindly retrying identical failures or claim
the backend/network/credential is at fault before transport evidence. Guide one
short local action at a time. Preserve all local work/private files.

## Latest hardware checkpoint — 0.6 ready accepted, connection ended

Emilia uploaded control 0.6 (all four hashes verified) and privately reprovisioned
via the existing credential file. At 2026-11-14 20:44:15 UTC Connect yielded ready,
ack applied=1, phase=none stopped=1, followed immediately by connect_failed.
No parser-rejection event was reported. New ready/handoff descriptors and empty
session are now accepted on hardware; persistent connectivity is NOT yet passed.
No Start or media requested. Camera/capture off. Current transport exit cause is
unknown: generic event covers poll/read/close, Wi-Fi loss and send failures.
Next one explicit Connect retry on retained RAM enrollment, same observer; if it
repeats, add fixed/numeric transport/close diagnostics before further uploads.
No new pairing code/key needed. Backend voice/integration work is concurrent;
do not attribute the close to server or network without evidence.

## Implementation background — backend compatibility 0.6 (now uploaded)

Emilia now reports installed 0.5 says “Invalid server state”, camera/mic off.
Do not assume the earlier accepted connection remains current. Agent fetch
failed DNS; Emilia fetched locally. Compared **origin/backend-deploy 7debf9a**,
backend-status/API, actual schemas and gateway. Documented runtime **17a8522**
adds multi-endpoint ownership and handoff. The ready list now contains handoff
and text (eight controls); 0.5 rejects handoff and >7 controls. This incompatibility
is reproduced in fixtures; no raw live rejected payload was captured.

0.6 source/build fixes ready compatibility, mirrors activeEndpointId/ownership,
adds explicit USE ROBOT (pauses) → await owned/paused snapshot → separate Resume,
and ignores validated foreign-owner listening grants as metadata only. No grant
to this audio-disabled target is accepted. Ownership loss stays stopped/muted,
queued work invalidates, TLS/Stop/watchdog stay enabled. Protocol rejection now
logs a fixed safe stage; both observers filter it. No media activation or transport
was added. Target still binds the existing Alex credential (new arbitrary device/
profile enrollment files not supported). No backend/shared contract edits/merge.

Passed: real-cJSON host parser + policy ASan/UBSan, 12 helper/privacy tests,
exact fetched backend schema check, pinned compile (1,345,115 program bytes /
53,060 static globals). 0.6 hardware/upload still pending. Same private credential
file/backup preserved. Next guide upload --target control, then private helper
--credential-file, Connect once, inspect saved ready/state/owner events. One
short local action at a time. No new pairing codes. Browser frontend should use
its own cookie/identity, not concurrently reuse this robot key. Handoff/Stop
can pause/end the other endpoint's session; coordinate during integration.

Voice is being enabled by teammates per Emilia. Fetched docs still record public
speech disabled, so actual new live config is unverified. Backend speech contract
has been reviewed, but this control target deliberately sends audio unsupported.
Actual robot Speak/capture/playback/receipts/cancellation remain the next separate
integration. See the final 0.6 section of control-checks.md for evidence/commands.
Latest 0.6 source and all earlier changes remain local, uncommitted/unpushed.

## Current device and actual hardware acceptance

Installed firmware: **`lemmi-control/0.5`**, 320×240. Emilia uploaded it locally;
all four images were hash-verified. Latest boot/selftest was actually observed at
19:23:04 UTC. The device later reconnected and completed controls below.

**Last confirmed state: session ended, local Stop active, camera/capture off.**
Final 19:29:53 UTC receipt: local_stop → ack applied=1 → phase=ended stopped=1.
Do not assume connectivity is still live after time passes or a reboot.

Actual checks on the connected robot:

| Check | Observed result (November 14 UTC) |
| --- | --- |
| Authenticated WSS using existing credential | device.ready, acknowledgments and session snapshots received |
| Explicit Start | 19:15:01 ready stopped=0; repeated 19:27:39 |
| Pause | 19:19:01 paused stopped=0, ack applied=1 |
| Explicit Resume | 19:20:11 ready stopped=0, ack applied=1 |
| Local Stop from ready | 19:20:32 ended stopped=1, local_stop and accepted ack |
| Screen stability | Emilia explicitly confirmed flashing is gone |
| Fresh boot Unmute / Mute | 19:23:25 unmuted capture=off; 19:24:18 muted capture=off |
| Explicit Disconnect | 19:28:41 local_stop then disconnected |
| Explicit Reconnect | 19:29:09 paused stopped=1; no automatic resume |
| End paused test session | 19:29:53 ended stopped=1, accepted ack |

Camera/capture were off throughout. Local Unmute was tested after a fresh boot,
not as an authenticated active-session mute receipt. Serial event spacing is not
physical touch-to-stop latency. Explicit Disconnect is not an unexpected Wi-Fi
loss/watchdog test. The reason for the 19:23 reboot was not established; do not
claim that a monitor timer expiring caused a reset.

Still **unverified**: unexpected network-loss/watchdog behavior/timing, backend
restart/revocation and persistent credential lifetime, sustained load/peak heap,
active connected mute semantics, live mic/STT/TTS/playback and secure camera relay.
No F13/F14 integrated acceptance or unattended-use claim.

## Existing credential: no new pairing codes for this flow

Emilia/Anay changed the live setup from temporary pairing to an existing device
credential in **`data/stackchan-access.json`**. It is owner-only (0600) and the
exact path is excluded through **local `.git/info/exclude`**. This exclusion is
not portable to a new clone: verify exclusion before staging anything. Never
print the file or use `git add .` without checking for private data.

Its structure was validated without displaying values: fixed backend/WSS URL,
Alex device/profile, credential, explicit null expiresAt, and matching Bearer and
domain-key headers. The same credential was accepted for multiple reconnects.
Backend durability across a restart/revocation is **not** yet verified. Older
local backend docs describe temporary one-hour credentials; do not mistake them
for current deployed behavior without checking with Anay/current source.

The helper reads the file privately, then prompts only for local Wi-Fi name and
password. No caregiver token is sent to the robot. The robot stores config and
credential in **RAM only**; reboot/upload loses provisioning. The file persists
on the Mac. No NVS credential persistence was added.

Provisioning does not start networking. A separate **CONNECT (stays stopped)**
robot tap connects. A separate Start tap is required afterward. If an existing
session is paused, new Start is intentionally blocked: Stop ends it first.
No automatic start, resume or reconnect. Keep camera/mic off unless separately
and explicitly locally activated in a later authorized feature.

Public origin: `https://lemmi.chaoswarrior.dev`.
WSS: `wss://lemmi.chaoswarrior.dev/v1/device-stream`.
HTTP/WSS require X-Lemmi-Access-Key; WSS additionally uses scoped device Bearer.
TLS CA, hostname/SNI and time validation stay enabled. No insecure/IP bypass.
Original pairing/--create-pairing and Wi-Fi-only modes remain optional compatibility
paths, not the required current flow. Do not repeatedly request fresh codes.

## Implementation and recent fixes

Sources: `firmware/stackchan/lemmi_control/`:

- `ControlPolicy.h`: stopped/muted boot, ready+snapshot gate, explicit Start only
  from ended/empty state; session/generation/local-epoch guards; Stop intent survives
  an already-sent Start, matching rejection/revision retry, six-second watchdog.
- `Protocol.h`: bounded 4 KiB cJSON parse, nesting/duplicate/critical binding checks,
  safe control subset, audio=false/camera=false, non-null capture grants rejected.
  Explicit null expiry is accepted only for a locally provisioned null expiry;
  missing/malformed/mismatched ready expiry fails closed.
- `ProtocolCheck.h`: startup synthetic fixtures gate networking/provisioning.
  Expanded 0.5 self-check passed on the actual device.
- `.ino`: dedicated network task, bounded queue, SDK HTTP/TLS/WS; immediate local
  Stop/mute policy independent of backend/model. No mic/speaker/camera/motion
  initialization, petting, media transport or capture. Credentials/log bodies
  are never emitted. UTC comes from local provisioning. WSS text replies are
  bounded/discarded; this target does not request or display model output.
- 0.4 Start bug: an accepted Start ack arrived while mirror still said ended;
  handler re-latched local Stop from that old mirror. **0.5 fixes this by imposing
  server Stop only on a received ended snapshot**, preserving true local Stop.
  Duplicate queued Start is suppressed while a sent Start remains in flight.
- Flashing bug: every heartbeat marked the screen dirty and cleared/redrew it.
  **0.5 caches visible status/button labels and repaints changed regions only**;
  active status shows actual backend phase with capture off. Hardware-confirmed.
- Earlier claim failure displayed “Need new pairing code” for every HTTPS/HTTP/
  response failure, even with a brand-new code. 0.3+ changed that to “Claim failed
  - see USB” and added fixed stage/numeric diagnostics. That original failure's
  cause remains unknown; direct credential mode bypasses claim.
- Wi-Fi diagnostics status=1 reason=201 corresponded to no AP found. Emilia later
  identified the wrong network had been entered; corrected Wi-Fi passed.

`tools/provision-control.py`: nonsecret serial probe first; hidden secret prompts,
private file validator (permissions, URLs/Alex scope, auth match, expiry, duplicate
keys, 8 KiB bound); bounded fixed-status observer writes ignored owner-only
`firmware/stackchan/build/control-monitor.log`. Default observation 600 seconds.
Agent can read this sanitized file; never dump raw serial/private payloads.

## Commands and local access limits

No need to re-upload merely to resume. Inspect device/log/state first.
Serial port last used: `/dev/cu.usbmodem2101`; recheck if unavailable. Use only
one monitor/provision/upload process at a time. Ctrl+C ends an observer.

User's local Terminal already used this environment (activate if needed):

```sh
source ~/.espressif/python_env/idf5.5_py3.14_env/bin/activate
```

Private provisioning, from repository root:

```sh
python firmware/stackchan/tools/provision-control.py \
  --port /dev/cu.usbmodem2101 \
  --credential-file data/stackchan-access.json
```

Keep the SAME helper open through local Connect/control taps. It observes fixed
statuses for 600 seconds. If already stopped and provisioning is retained, use
local Connect; do not force a new upload/reset. After a reboot, reprovision RAM.

Receive-only monitor (stop other serial owner first; does not save a log itself):

```sh
python firmware/stackchan/tools/monitor.py \
  --port /dev/cu.usbmodem2101 \
  --seconds 600
```

Build only (agent can run this):

```sh
python3 firmware/stackchan/tools/build.py --target control
```

Upload ONLY after a source change/build, in Emilia's local Terminal:

```sh
python firmware/stackchan/tools/upload.py \
  --target control \
  --port /dev/cu.usbmodem2101 \
  --backup-dir firmware/stackchan/backups/20261114T021027Z
```

Upload --dry-run validates original backup, target/images and esptool without
opening serial. The wrapper checks device identity/capacity/security before
writing four board-defined images. No erase-all/eFuse changes. The upload
manifest's control version label was stale (0.2) during recent transfers; it is
now corrected to 0.5 for future runs. Existing private manifests were preserved;
image hashes and actual observed boot version establish what ran, not that label.
No firmware binary change or re-upload is needed for this metadata correction.

In this session the **agent shell cannot open USB serial** (sandbox Operation not
permitted), and computer-use cannot access Terminal. Do not retry escalation or
work around that restriction. Emilia runs local commands and pastes fixed results;
agent can inspect the helper's sanitized log. Shell git fetch/push also failed
DNS for github.com; user Terminal fetching worked. Inspect current capability,
but do not claim a push succeeded unless actually observed. The user prefers a
single short actionable step each turn, not a long checklist.

The robot has an internal battery: unplugging USB does **not** power it off.
If a reset is actually needed, briefly press/release labeled RST; do not hold.
One preflight no-response was resolved by USB reconnect; it is not proof of bad
firmware. New serial opens have sometimes coincided with a fresh boot; exact
cause not proven. Do not assume RAM provisioning survived a new boot.

## Installed tools and tests actually run

Pinned tooling already exists; inspect before installing anything:
Arduino CLI 1.6.0, m5stack ESP32 3.3.10, M5Unified/M5GFX 0.3.0, PSRAM disabled,
hardware USB CDC, 16 MB flash. Ignored firmware `.tools/` and `.arduino/` hold it.
Existing ESP Python: `/Users/emiliavu/.espressif/python_env/idf5.5_py3.14_env/bin/python`
with esptool **4.12.0**, pyserial **3.5**. Earlier esptool 5.3.0 backup read failed.
No packages installed during the latest control increment.

Latest 0.5 compile passed: **1,342,287 program bytes / 52,852 static globals**.
24 KiB worker stack and TLS runtime allocations are additional; peak heap unmeasured.
Host ASan/UBSan policy regressions passed; 11 helper/credential/privacy tests passed;
upload dry-run passed original backup and image/tool checks. Device self-check
passed. `git diff --check` passed. Commands:

```sh
c++ -std=c++11 -Wall -Wextra -Werror -fsanitize=address,undefined firmware/stackchan/tests/control_policy.cpp -o /tmp/lemmi-control-policy-test
/tmp/lemmi-control-policy-test
/Users/emiliavu/.espressif/python_env/idf5.5_py3.14_env/bin/python -m unittest discover -s firmware/stackchan/tests -p test_provision_control.py -v
```

Node 26/installed TS6 previously passed root tsc after main merge. Bun was not
found; no full Bun backend suite was rerun/installed. Anay's reported backend
checks are separate evidence, not local test runs.

## Private original backup — preserve

`firmware/stackchan/backups/20261114T021027Z/`

Valid original full image: `original-flash-16mb-verified.bin`, 16,777,216 bytes,
manifest SHA checked; verify_flash previously matched actual device before uploads.
Other partial/failed candidates are not valid restore images. Manifest/device
logs may contain identifiers/settings; do not print or commit. Restore has not
been rehearsed. New upload evidence is private under `backups/runs/`; preserve it.
No eFuses/security settings were changed.

## Preserved earlier experiments (not current installed app)

- **Feasibility 0.5**, separate `lemmi_feasibility/`: locally approved 15-second
  160×120 RGB565 camera preview, correct colors; frame 38,400 bytes. GC0308 HAL
  metadata and byte-order fixes verified. Custom SCCB adapter reuses existing M5
  bus; no SDK I²C bus release. Camera worker bounded ~50 ms waits; observed teardown
  64 ms expiry / 65 ms local Stop, not physical touch latency. Mic 16 kHz mono
  int16 level responds to voice, tiny transient buffers wiped/discarded. Local
  mic Stop/Mute handler cleanup 4 ms observed. Speaker 440 Hz tone audible at
  64/255; 24/255 was inaudible. Speaker local Stop cut sound early (5 ms handler).
  Camera→Stop→mic→Stop→speaker reuse passed; reverse/stress still pending.
  No recording/network/simultaneous media. See `feasibility-checks.md`.
- **Offline packetizer** `audio/PcmPacketizer.h`: arbitrary 256-sample input →
  320 samples/20 ms/640-byte pcm_s16le frames, single slot, increasing local epochs,
  cancellation/wipe/stale rejection/fail-closed overflow; partial tail discarded
  provisionally. Host sanitizer tests and compile-only ESP probe passed; not wired
  to live capture/network. Caller-owned frames need revalidation before send.
  See `audio/README.md`.
- **Petting 0.2**, separate `lemmi_petting/`: explicit local Enable, three Si12T
  zones, bounded stroke/release/cooldown, static happy face, no network/media/
  servos. Face and flicker fix confirmed; Stop suppresses reaction. Initially
  missing back zone recovered after hands-clear re-enable+2 seconds; cause not
  proven. Full BSP begin avoided because it enables servo power. Gesture host
  tests passed; Ready/reboot/stress pending. See `petting-checks.md`.
- Foundation 0.1: local Stop→Unmute→Ready stayed capture-off, boot 320×240 verified.

## Next work and counterpart handoff

1. Preserve/review the uncommitted tested control changes and this handoff on the
   firmware branch. Commit/push when requested; do not claim the GitHub handoff
   contains these latest changes until pushed. No new compile/upload is necessary
   solely to switch chats. Current test session is already ended/stopped.
2. Finish bounded unexpected network-loss/watchdog and backend restart/revocation
   checks with Emilia/Anay, without changing shared router state or disabling TLS.
   Existing manual Disconnect test is not a substitute. Do not enable capture.
3. Before live speech, inspect current backend/shared contracts with Anay; the
   locally merged backend still advertises audio=false/camera=false. Need agreed
   capture grants/cancel/end, output leases/receipts, stale epoch/revision rules,
   framing/backpressure/partial-tail handling and actual no-recording media path.
   Do not invent a second contract or assume private speech adapters imply robot
   media acceptance. Proposed mic: 16,000 Hz mono signed int16 little-endian,
   20 ms/320 samples/640 raw bytes, currently JSON base64 proposal. Backend TTS
   documented at 22,050 Hz mono int16; rates are different. No end-to-end robot
   intelligible speech/STT/TTS yet. No provider/caregiver token goes to firmware.
4. Secure F13 caregiver camera integration remains pending. RGB565 feasibility
   is not JPEG transport; encoding/permission/relay/cancellation need agreement.
   Integrated F14 petting/motion follows F13; preserve separate offline prototype.

Useful references: `docs/backend-status.md`, `docs/backend_api.md`,
`docs/handoffs/anay-control-foundation.md`, `anay-speech-chat.md`,
`anay-device-integration.md`, `anay-backend-deploy-verification.md` (same folder).
These may need updating from Anay; avoid treating old documentation as deployed
state. Original restart baseline `a7ae270` predates all feasibility code.

## Switching accounts without local file access

This latest handoff is **local and uncommitted**. The GitHub branch URL may be
older: https://github.com/emiluvu/Lemmi/blob/emilia/firmware-foundation/docs/handoffs/emilia-resume.md
Do not use that remote version as this checkpoint unless the update was pushed.
Paste this document's contents into the new chat if it cannot read this workspace.
Never include the private credential/backup file contents. Ask the new assistant
to distinguish facts above from new observations, inspect before changing tools,
and keep one-step local guidance.

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
