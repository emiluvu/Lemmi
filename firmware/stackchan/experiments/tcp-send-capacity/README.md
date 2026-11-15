# Isolated TCP send-capacity feasibility experiment

## Current measured-bottleneck candidate: bounded-16k / 0.12

**Observed rehearsal passed this run, November15,10:30–10:32UTC.** User reports
no unexpected behavior and confirms the third-attempt Pause was their own tap.
Three completed captures (~9.97s,11.40s,9.17s) reached replies, with explicit
Pause/Resume/fresh Speak and Stop during the last reply; no send fault/auto-stop/
disconnect. First replies fully consumed424/424 and445/445 chunks; last Stop
left350 received/345 consumed without crediting the queued remainder. Buffer
waits4/3/2 remain. Internal minimum41340, largest31732, loop-worker1180/14376;
test limits maintained. Connection stayed up, media off after Stop. Preserve
this exact candidate/source; longer/venue/soak/loss behavior and physical
Stop latency remain unverified. This is a bounded rehearsal pass, not proof of
universal network reliability or independent-use/full-P0 readiness. Earlier
pending statuses below describe preparation before this result.

The user requested a fix after 0.11 measured free send space=711 bytes, queue=4,
open peer window and no ACK-byte advance during a stalled capture. The new
candidate raises byte capacity while bounding backing-buffer allocation and
avoiding the earlier half-buffer writable threshold. This is a **combined TCP
configuration candidate**, not a single-variable capacity experiment or proof
that a fixed buffer can tolerate arbitrary network stalls.

| Resolved value | Rebuilt baseline | New candidate | Original rejected 16KB |
| --- | ---: | ---: | ---: |
| TCP_SND_BUF | 5744 | 16384 | 16384 |
| TCP_SNDLOWAT | 2873 | 2873 | 8192 |
| TCP_SND_QUEUELEN | 16 | 23 | 46 |
| TCP_SNDQUEUELOWAT | 8 | 11 | 23 |

The 23-buffer cap satisfies the documented ceil(2*16384/1436) minimum and the
actual lwIP compile-time sanity checks. Checks remain enabled. The original
rejected image is still rejected; the new candidate has a different library,
configuration, version and identity. No application capture queue, 240 ms age
bound, PCM/wire format, playback window, TLS/auth, Stop/mute or backend change.
All 93 lwIP units are rebuilt from matching pinned sources with the existing
compiler; other SDK libraries and installed SDK remain unchanged. Only the
candidate overlay config changes send capacity, defines the queue cap and byte
low-water, and sets an identifying LEMMI_TCP_BOUNDED16 flag. Derived queue
low-water is 11. App/library macros, unchanged ABI, all three diagnostic edges,
intended archive and normalized paired compiler inputs are verified.

Full-queue bound remains the same **36984 bytes** as the earlier 23-slot 8192
candidate, including pbuf/MSS backing, segment records, canaries, alignment and
allocator slack. Add 3216 transient bytes and retain 32768 runtime reserve:
total **72968**. The lowest earlier connected-idle sample was 73156, leaving
**188 bytes beyond that reserve**; this is a narrow reference-model margin,
not a guaranteed runtime minimum. Both new builds have 152804 static global
bytes, so the candidate adds no static RAM over its matching baseline. Check
actual connected current free >=72968 before a supervised speech trial; retain
the existing heap-minimum/largest-block/stack stop conditions. A lower current
sample requires reassessment, not silently reducing the reserve. No PSRAM or
second live TCP socket is budgeted.

Build/evidence (no USB/network):

```sh
python3 firmware/stackchan/experiments/tcp-send-capacity/build_pair.py --policy bounded-16k
python3 firmware/stackchan/experiments/tcp-send-capacity/assess_pair.py --policy bounded-16k
```

Evidence is ignored `build/tcp-send-capacity-bounded-16k/`. The explicit protected
upload selector is `--target voice_diag --tcp-policy bounded-16k`, **not** the
old `--tcp-send-capacity-experiment 8192`. The uploader revalidates source/image/
library/configuration/RAM evidence, original private backup and actual device
identity/security before four-image writing; it records policy/resolved values.
The normal target still builds stock 0.11 and is preserved.

Installed November 15, upload manifest 10:26:48.286859 UTC, final candidate
SHA-256 `79f049512c3d87261e39b0a8012542ca372d074e68a9d02ab2fef0da7bca5384`.
Boot version `lemmi-voice/0.12-diag1-tcp16` and selftest passed at 10:27:23 UTC;
capture/camera off. Idle internal free/minimum/largest=177376/175844/126964,
loop=1180, worker=0 before connection. Both full builds, 29 Python tests, ten
existing sanitizer executables, exact archive/config/hook/stack checks and
protected upload dry-run/actual hash checks pass. An initial tooling probe
compile failed because init.c's local sanity-check default was not visible to
the probe; the probe now exposes the same default while preserving/rejecting
an explicit disable. The rebuilt actual init.c sanity checks always stayed on.

**Live connected-memory, repeated speech and Stop acceptance are pending.**
No backend diagnostics, service restart or Anay message. User was given private
provisioning/local Connect instructions; wait for the existing filtered log,
not another serial owner, before Speak. Counterpart technical review remains
required before an integrated merge. Earlier derived-policy statuses below are
historical and do not describe the new capped/low-water configuration.

**Latest hardware result — FAILED, November 15, 09:38 UTC.** One authorized
Speak attempt on installed 8192 candidate reached capture-on, then failed
about 616 ms later: bounded write timeout, five socket polls all zero, no TLS
writer calls in the failed batch, 24 previously completed frame writes. Capture
off/disconnect followed; no output frames received/consumed. Minimum internal
heap=55020, loop/worker watermark=1180/14400, without a recorded test-limit
breach. This is the same pre-TLS writable-poll failure class, not a successful
audio repair. Keep stopped/disconnected; do not repeat this attempt, reflash
this candidate or increase buffers/timeouts from this result. No backend
diagnostics or origin correlation requested. Earlier local-preparation pass
and next-test instructions below describe the state before this failed trial.

**Latest installation receipt — November 15, 09:34 UTC:** user authorized flash
of the selected **8192** candidate. Protected upload passed matching backup,
device/security checks and all four image hashes. Application SHA-256 is
`564f068b4947ff24fd73da37e3ef2e267c9b117bc0a95b4d56e156c3f27658a8`.
Filtered boot confirms selftest passed, capture/camera off; idle internal free/
minimum/largest = 178168/176636/126964 bytes, loop watermark=1180, worker=0
(not connected). USB observer ended. RAM provisioning/local Connect and connected
memory/short conversation/Stop checks remain pending. No backend operation or
special diagnostics started. Preparation-only statuses below are historical.

**Built, not installed, not a verified fix.** The original 16384-byte candidate
fails the conservative RAM preparation gate and must not be flashed. The selected
8192-byte candidate passes local preparation for one supervised short test only.
Last documented installed firmware is `lemmi-voice/0.9-diag1`, stopped. No robot
or backend operation was performed for this preparation.

Emilia has withdrawn the earlier request to retain special backend diagnostics.
Do not start a diagnostic window or reserve/restart the shared backend for this
experiment. Use the normal backend for the eventual short test. Current remote
diagnostic enablement has not been verified here; Anay's documented disable
helper is separate backend housekeeping, not a prerequisite for local builds.

## Evidence and proposed comparison

Backend correlation `85c3198` records 29 accepted frames, zero rejected events,
no earlier application close, max handler 0.888 ms and no sampled origin queue
buildup. Firmware records 33 completed writes, then five actual SDK
socket-writability polls returning zero and no TLS write call in the failed
bounded write. This localizes that failure to socket writability, but does not
separate ACK delay/loss, peer flow control, writable thresholds or scheduling.
Origin 500 ms sampling misses shorter stalls. The receive gap is not TCP RTT.

A **single SDK configuration change** raises TCP send capacity from
5744 to 8192 bytes in the selected pair. The earlier 16384 pair is preserved
under its original build directory as rejected preparation evidence.
Keep the same diagnostic sketch, input/output formats,
12-chunk playback window, 100 ms write budget, capture queue deadline,
60 ms/four-message batching, TLS validation/auth and local Stop/mute behavior.
Keep the baseline SDK installation and installed firmware available. This is
an exploratory comparison of sensitivity to send capacity, not proof that
8192 is the correct buffer size. Do not promote a successful short attempt
to general network or conversation acceptance.

## Correct SDK provenance

The installed SDK's `versions.txt` reports library-builder `43a8f6d`,
ESP-IDF **v5.5.4 / 735507283d**, Arduino `6cb835025`, TinyUSB `5004a24b2`.
`baseline.json` records local configuration/archive hashes and board selection.
Earlier analysis inspected local ESP-IDF v5.5.1 source; it must not be used as
an exact source identity for the installed precompiled SDK. The diagnostic
hooks observe the actual installed library and remain valid measurements.
The version-matched [v5.5.4 transport source](https://github.com/espressif/esp-idf/blob/v5.5.4/components/tcp_transport/transport_ssl.c)
also polls writability before calling the TLS writer. The
[v5.5.4 lwIP configuration](https://github.com/espressif/esp-idf/blob/v5.5.4/components/lwip/Kconfig)
provides the send-buffer setting.

## Build isolation and limits

Both pairs use a full **lwIP component** rebuild from pinned IDF
`735507283d5b2f9fb363a1901172dbd9e847945d` and lwIP
`fd432e4ee2cfb7f7f1c7eb7227e0173412e7b84e`, with the installed
Xtensa GCC 14.2.0 / esp-14.2.0_20260121 compiler. Shipped archive debug metadata
identifies all 93 component source units, preserving archive member order and
both same-named SNTP members. Other SDK libraries remain shared and unchanged.
This is not a full official SDK-builder reproduction or a byte-identical rebuild
of the shipped lwIP archive; comparison uses a rebuilt baseline too.

Do not run the builder's default update against the existing ESP-IDF or Arduino
installation. Pin/reproduce its component versions and start from the shipped
sdkconfig before applying `sdkconfig.defaults`. Select only ESP32-S3 and the
board's qio_qspi/no-PSRAM variant, checking the resolved board flags. Builder
command defaults can build many targets; do not use an unbounded default run.
Do not overwrite the supported `.arduino` SDK in place. Link a candidate from
an isolated copy with explicit library paths. Record tool versions, source
revisions, full final config diff and archive/application hashes.

The variant must differ in only the reviewed send-capacity setting and its
necessary derived lwIP queue accounting. A changed header alone does not change
the precompiled library. Do not replace a single arbitrary object from another
IDF version, cast private TCP structures or claim SO_SNDBUF works here.
Before any compile/upload tooling supports this variant, add checks that prove
the experimental library, rather than the stock archive, was actually linked.
The ordinary build/upload targets continue to use the supported SDK. The
explicit upload flag below selects only the assessed 8192 experiment.

From the repository root, build and assess without USB/network:

```sh
python3 firmware/stackchan/experiments/tcp-send-capacity/build_pair.py --candidate-capacity 8192
python3 firmware/stackchan/experiments/tcp-send-capacity/assess_pair.py --candidate-capacity 8192
```

Evidence is under ignored `firmware/stackchan/build/tcp-send-capacity-8192/`:
`paired-build.json`, `assessment.json`, each variant's `resolved*.json`, full
compiler command lists, SDK overlays, link maps and four upload images. Checks
cover hashes of all 93 lwIP sources, compiler, firmware/M5 library inputs and
shared SDK archives; pinned FQBN and M5Unified/M5GFX 0.3.0; identical normalized
component and sketch/library compiler commands; a single sdkconfig difference;
matching application/library ABI/macros; intended lwIP archive and both exact
transport-hook link edges. Source changes after assessment block experimental
upload until rebuilt/reassessed.

| Resolved value | Baseline | Selected candidate | Rejected candidate |
| --- | ---: | ---: | ---: |
| TCP send capacity | 5744 | 8192 | 16384 |
| Writable free-byte threshold | 2873 | 4096 | 8192 |
| Pbuf queue limit | 16 | 23 | 46 |
| Writable queue low-water | 8 | 11 | 23 |

These are compiled macro results, not measured socket occupancy. Raising send
capacity also raises both writable thresholds; success cannot isolate payload
capacity from those derived changes. Both new sketches have 152012 static global
bytes; checked audio stack path is 1584 plus 2048 reserve under the 8192 loop
stack. This is not whole-program stack proof.

## RAM budget and acceptance gate

Payload increase is 2448 bytes for the selected candidate, versus 10640 for the
rejected one. Neither is its RAM budget. The resolved `LWIP_NETIF_TX_SINGLE_PBUF=1`
branch of pinned `tcp_out.c:tcp_pbuf_prealloc` allocates a full local MSS per
copied segment, even when a write uses only part of it. Payload length limits
therefore do not tightly bound allocated backing storage. Pbuf/segment entries
are allocated on demand (`MEM_LIBC_MALLOC=1`, `MEMP_MEM_MALLOC=1`), not all
preallocated at connect.

Pinned source and compiler-derived layout give this conservative allocation
model for **one active media socket**:

- Pbuf request: 16-byte pbuf + aligned 74-byte transport headroom (76) +
  1436-byte MSS = **1528 bytes**, including unused oversize capacity.
- Each allocation adds 12 bytes of light heap-poison canaries, 4 bytes of
  TLSF used-block header, 4-byte alignment, and a conservative 16-byte
  unsplittable TLSF tail allowance. Pbuf bound = **1560 bytes**.
- Separate 16-byte `tcp_seg` with the same allocator allowances = **48 bytes**.
  Total bound = **1608 bytes per queued segment**. `MEMP_OVERHEAD=0` avoids
  adding nonexistent lwIP pool guards; heap canaries are still counted.
- Two additional full-segment equivalents (**3216 bytes**) allow transient
  provisional/control/split work. This is an engineering allowance, not a
  proof of every global network allocation path.
- Keep a further **32768-byte runtime reserve**: 16384 for audio task/DMA/driver
  lifetimes, 8192 for receive/network transients, 8192 for JSON/control and
  fragmentation. These are explicit allowances, not measured peak bounds.
  Existing connected TLS state, worker/loop stacks and static queues are
  already charged to the reference free heap. Handshake peaks occur in a
  different phase and still require observation; don't add another live TLS
  session, concurrent camera or count disabled PSRAM as available memory.

| Conservative accounting (bytes) | Baseline | Selected 8192 | Rejected 16384 |
| --- | ---: | ---: | ---: |
| Full queued-segment allocation | 25728 | 36984 | 73968 |
| Additional transient allowance | 3216 | 3216 | 3216 |
| Runtime reserve | 32768 | 32768 | 32768 |
| Margin from historical 75988 free bytes | 14276 | **3020** | **-33964** |

The reference is the lowest earlier **connected** free-heap sample, not a proven
future minimum. No credit is taken for baseline TCP allocations potentially
already included in that sample: the model subtracts the candidate's entire
queue. Incremental full-queue cost is 11256 bytes for 8192 versus 48240 for
16384, including backing capacity/metadata/allocator allowances. The full
candidate queue plus transients leaves 35788 bytes before the 32768 reserve.
The small remaining margin supports only a bounded hardware trial, not a
readiness or worst-case memory guarantee. Largest-block fragmentation and
allocator/driver peaks remain physical acceptance items.

Both new variants report `internal_free`, `internal_min`, `internal_largest`
using `MALLOC_CAP_INTERNAL|MALLOC_CAP_8BIT`, plus existing loop/worker watermarks.
The five-second numeric-only USB status event records no media or credentials
and changes no backend contract. Minimum heap reflects per-region historical
minima since boot; largest-block readings are sampled, so short fragmentation
peaks can be missed. Existing fail-closed allocation/transport failures remain.

## Selected artifact and next hardware step

Select only `build/tcp-send-capacity-8192/candidate/voice/lemmi_voice_diag.ino.bin`.
Exact application and all four image hashes are in that pair's `assessment.json`.
Boot version remains `lemmi-voice/0.9-diag1`; version alone does not distinguish
these experiments. Selection flag, source checks, image hashes and private upload
manifest establish identity; the upload manifest records the 8192 experiment.

The existing protected upload helper supports the selected pair explicitly:

```sh
/Users/emiliavu/.espressif/python_env/idf5.5_py3.14_env/bin/python firmware/stackchan/tools/upload.py --target voice_diag --tcp-send-capacity-experiment 8192 --port /dev/cu.usbmodem2101 --backup-dir firmware/stackchan/backups/20261114T021027Z --dry-run
```

Dry run opens no serial port. Actual flash is a separate hardware step; omit
`--dry-run` only when doing that step. Keep the robot stopped, release any serial
observer first, preserve original backup/device identity/security checks, then
privately provision as usual. Nothing here starts or reconfigures the backend.
No spoken test or flash was performed for local preparation.

Observed local checks: both selected pair builds and full artifact assessments
pass; **26 Python tests pass**, including changed allocator/low-heap gate
rejection, altered image checksum rejection, required SDK hook/stack checks and
strict memory-status payload exclusion. Protected upload dry run passes original
backup integrity, pinned board/tool, assessed source/image identity and all four
image checks without opening serial. Python compilation and `git diff --check`
pass. These checks do not establish real heap minima or physical cancellation.

For one supervised short test on the normal backend, explicitly Connect/Start/
Unmute/Speak, say a short fictional sentence, Finish, hear one reply, then Stop.
Capture must remain visibly off after Stop and unmute alone must not capture.
If the ordinary backend is unavailable, stop; do not launch a special backend.
Use an observer kept open throughout, since a new serial open may reset the robot.
Do not start another attempt after a fault/disconnect. Stop on any allocation
error, audio overlap, stale restart, watchdog or failed local Stop/mute. Also
stop and reassess if connected available internal heap is already below the
historical 75988 reference before the trial, or if sampled free/minimum internal
heap falls below 32768, largest internal block below 16384, or loop/worker stack
watermark below 1024/4096. These are conservative test stop conditions, not new
automatic firmware limits. A failed connect-phase minimum requires review before
speaking even if the current heap has recovered. No repeated buffer changes or
retests are authorized by a failed result.

Anay's substantive boundary review still applies before an integrated merge;
it does not require another diagnostic reservation for this isolated local
preparation. Even a better short result establishes at most capacity sensitivity,
not the underlying ACK/window/loss cause or independent-use acceptance.
