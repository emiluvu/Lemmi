# Voice 0.9 diagnostic variant

This is an opt-in measurement build, **not an audio fix**. Normal `voice`
remains voice 0.9. `voice_diag` advertises `lemmi-voice/0.9-diag1` and includes
the same shared sketch with linker wrappers around the SDK's
`esp_transport_poll_write` and `esp_tls_conn_write`. Each wrapper forwards the
original arguments once and returns the original result. No private SDK
structures, certificate bypass, TLS key access or payload logging are used.
The observer is restricted to the worker task during its bounded writes;
other tasks forward without touching the counters. Poll and TLS counters reset
before each bounded write. Counters are printed only after an audio-send failure,
following the existing local stop latch. No serial output occurs inside a hook.

The 12-frame speaker window, 240 ms capture queue age limit, four-message/60 ms
batch collection, 100 ms bounded-write budget, retry behavior, sample format,
TLS/auth and local cancellation rules are unchanged. The timing observer adds
small overhead, so a physical result is diagnostic evidence, not an identical
baseline or ACK measurement. There is no new automatic capture or reconnect.
Camera, petting and motion remain disabled in this integrated voice target.

## Build and verify

From repository root:

```sh
python3 firmware/stackchan/tools/build.py --target voice_diag
```

The target adds only `--cref`, `--wrap=esp_transport_poll_write` and
`--wrap=esp_tls_conn_write` to the pinned linker command. Inspect the final link
map to ensure both wrappers are referenced by `libtcp_transport.a`'s
`transport_ssl.c.obj`; a missing interception must fail the build. The existing
Xtensa audio stack-budget guard also runs. Keep the normal voice build and
original private flash backup intact. The upload helper accepts `voice_diag`
with the existing backup/device identity and image integrity checks.

Use the updated `provision-control.py` or `monitor.py` so its fixed numeric
allowlist retains `voice_transport_probe`. An already running older helper must
be restarted before a diagnostic session. Do not run two port owners. A flash
or new serial attachment can reset the device and clear RAM provisioning.

## One bounded attempt after coordinated installation

Anay reviews the diagnostic seam; agree a fresh origin-log/sampler UTC window.
Install only after build/link checks, recording application SHA-256 and boot
version. Reprovision using the existing protected credential file, then locally
Connect, Start/Resume, Unmute, and Speak once. Unmute alone stays capture-off.
If capture succeeds, use Finished. End with local Stop; on failure keep stopped.
Do not repeat automatically. Retain only filtered numeric status and timestamps.

After `voice_send_failed`, the additional record is:

```
event=voice_transport_probe polls=5 poll_zero=5 poll_error=0 poll_max_us=20000 writes=0 write_zero=0 write_want=0 write_error=0 write_max_us=0 camera=off
```

That example is illustrative, not measured hardware data.

- `poll_zero > 0`, especially `writes=0`: actual SDK socket-writability polling
  timed out before reaching TLS in those calls. It does not identify Wi-Fi loss,
  TCP ACK delay or the peer's flow-control cause.
- `write_zero > 0` or `write_want > 0` with successful polls: the actual TLS
  writer returned zero or a retry status. The counts separate this from poll
  timeout, without inspecting TLS internals or claiming those statuses are bugs.
- Error counters show negative non-WANT results. Max durations are microseconds
  for each individual call, not RTT or the entire batch duration.
- Mixed counters can occur in one bounded write; interpret together with
  `voice_send_failed`, accepted gateway frames and existing cancellation events.

A completed firmware write still does not prove TCP ACK or gateway acceptance.
No supported TCP_INFO interface was found in the pinned SDK. This build does
not replace AP/router metadata if actual RTT/retransmission evidence is needed.
