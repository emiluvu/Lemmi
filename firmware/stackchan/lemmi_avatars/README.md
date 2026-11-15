# Offline avatar target — 0.1

User-authorized local visual/petting experiment, separate from `lemmi_control`.
No Wi-Fi/backend, microphone, speaker, camera, servos or app profile sync.
This does not establish integrated F13/F14 or live voice acceptance.

Build from repository root: `python3 firmware/stackchan/tools/build.py --target avatars`.
The exporter uses the already installed Pillow 12.2.0, produces fifteen 144×144
RGB565 frames in an ignored header (622,080 flash bytes), composites transparency
onto cream and copies the existing offline petting headers without forking them.
Original and generated PNG source assets remain unchanged. No packages installed.

The sketch starts with the lemming; NEXT AVATAR cycles dog/cat/bunny/bird/lemming
locally for review, not as a substitute for app-selected avatar synchronization.
TEST MOUTH runs a silent six-second open/closed cycle. ENABLE PETTING initializes
the same previously tested strip adapter; a recognized top-strip stroke shows
hearts for 1.2 seconds and ends the mouth test. STATIC MODE suppresses mouth
cycling and still permits a static hearts reaction. Stop suppresses both effects
and disables petting; READY clears Stop with effects still off. A later explicit
Enable/Test is required. No sensor data or media is persisted.

November 14 build passed with pinned M5Stack toolchain: 1,178,775 program bytes,
26,412 static global bytes; the 41,472-byte canvas is additional runtime memory.
Existing stroke/release/cooldown/suppression/noise/rollover ASan/UBSan tests passed.
Upload dry-run passed private backup integrity, target, four images and esptool
4.12.0 without serial access. Hardware upload, colors, smoothness, memory under
load, actual petting and physical Stop timing remain pending for this target.

Uploading replaces the running control app and clears its RAM enrollment. Its
source/build, existing private credential and original flash backup are preserved.
Use the existing upload wrapper with `--target avatars`; restore `--target control`
and privately reprovision the same access file when returning to backend work.
The current receive-only monitor does not recognize this target's boot/status;
use visual screen evidence initially. Do not use provision-control on this target.

## Hardware receipt — November 14, 2026

Emilia reports upload PASS via the existing wrapper. After exploring the controls,
she explicitly pressed STOP and confirmed that mouth animation/hearts disappear
and stay off when petting the top. This is user-observed Stop suppression on the
uploaded avatar target; physical latency was not measured. Individual mouth-test
duration, all five colors/identity frames, Ready remaining effects-off, deliberate
petting activation and static-mode behavior still require separate observations.

Follow-up: Emilia confirms READY leaves petting inactive until ENABLE PETTING is
pressed. After explicitly enabling it and stroking the top strip, hearts appear
briefly and disappear. Ready effects-off and enabled top-strip hearts are now
user-observed passes. Exact reaction duration, physical latency, mouth timing,
static mode and all-five rendering remain unverified.

Further observations: Emilia separately confirms TEST MOUTH opens/closes the
mouth and returns closed after about six seconds without petting. With STATIC
MODE ON, TEST MOUTH leaves it closed. These are user-observed checks, not timed
instrumentation. All-five rendering, sustained load and physical Stop latency
remain unverified. App-selected identity and actual speech-driven mouth control
are not implemented by this offline target.

Emilia additionally confirms that all five avatars render with correct colors
and shapes on Stackchan. The isolated offline visual checks now cover all-five
rendering, mouth cycle/automatic ending, static mode, explicit petting activation,
brief hearts, Stop suppression and Ready remaining effects-off. No physical
latency, sustained-load or integrated app/speech acceptance is implied.
