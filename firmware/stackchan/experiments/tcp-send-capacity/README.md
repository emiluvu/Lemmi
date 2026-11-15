# Isolated TCP send-capacity feasibility experiment

**Unbuilt, not installed, not a verified fix.** User-facing capture remains
stopped on `lemmi-voice/0.9-diag1`. Do not repeat an identical capture attempt.

## Evidence and proposed comparison

Backend correlation `85c3198` records 29 accepted frames, zero rejected events,
no earlier application close, max handler 0.888 ms and no sampled origin queue
buildup. Firmware records 33 completed writes, then five actual SDK
socket-writability polls returning zero and no TLS write call in the failed
bounded write. This localizes that failure to socket writability, but does not
separate ACK delay/loss, peer flow control, writable thresholds or scheduling.
Origin 500 ms sampling misses shorter stalls. The receive gap is not TCP RTT.

A proposed **single SDK configuration change** raises TCP send capacity from
5744 to 16384 bytes. Keep the same diagnostic sketch, input/output formats,
12-chunk playback window, 100 ms write budget, capture queue deadline,
60 ms/four-message batching, TLS validation/auth and local Stop/mute behavior.
Keep the baseline SDK installation and installed firmware available. This is
an exploratory comparison of sensitivity to send capacity, not proof that
16384 is the correct buffer size. Do not promote a successful short attempt
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

Use the pinned [official builder](https://github.com/espressif/esp32-arduino-lib-builder/tree/43a8f6d)
in an ignored experimental build directory, with separate IDF source/tools and
Python environment. The official builder supports macOS and target selection;
its build/config scripts require additional host tools. Local preflight found
CMake, Ninja and jq, but no gsed, gawk, grealpath or ccache; matching IDF 5.5.4
is not the local 5.5.1 installation. No host packages were installed and no
builder setup or SDK compilation was run. A full matched rebuild is larger
work than an application macro or runtime socket-option tweak.

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
No normal build/upload target currently consumes this experiment directory.

## RAM budget and acceptance gate

Nominal extra maximum payload capacity is **10640 bytes per active TCP socket**.
The connected diagnostic observer showed 75988–76188 free heap bytes. Subtracting
the payload delta alone leaves at least 65348 bytes, but this is **not a worst-case
memory guarantee**: pbuf/segment/allocator overhead, multiple live TCP sockets,
TLS peak usage, fragmentation and audio lifetimes still need measurement.
No additional receive, TLS, playback, task-stack or PSRAM increase is proposed.
Review the SDK's derived queue sizing and document allocation behavior before
calling this budget sufficient. Track minimum/largest free heap and task stack
watermarks on the candidate; fail closed on allocation failures.

Anay reviews the experiment/protocol seam before any integrated merge. Once a
matched candidate is built and checked, agree one fresh UTC-marked observation
window (the prior origin socket sampler has ended). Use the private backup and
identity checks, verify boot version/config provenance, then perform one
explicit local Speak/Finished/Stop attempt. Observe mute/Stop cancellation too;
no automatic capture. On failure keep stopped and use the diagnostic counters;
do not repeatedly increase capacity or blocking time. Compare both capacity
variants with the same speaker window. Even an improvement would establish
capacity sensitivity, not distinguish the underlying network causes.
