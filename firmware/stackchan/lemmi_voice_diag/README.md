# Robot-side voice diagnostics

**Latest0.12 rehearsal passed this run:** three9–11s capture/reply turns plus
user-confirmed Pause/Resume and Stop during last reply; no send fault or
disconnect, heap/stack limits maintained. User reports no unexpected behavior.
Playback buffer waits remain; longer/venue/loss/physical-latency evidence is
pending. Preserve exact current capped-policy image/source and stopped session.
See [current results](../experiments/tcp-send-capacity/README.md).

**Current installed `0.12-diag1-tcp16`** retains these exact numeric probes and
nonblocking cancellation rules, while using a new isolated 16KB send buffer /
23-pbuf cap / 2873-byte writable threshold. Stock0.11 remains preserved.
Build/source/ABI/library/RAM checks, protected upload and idle boot pass;
connected memory meets test limits. Live three-turn speech/Stop rehearsal is
pending. See [current policy/evidence](../experiments/tcp-send-capacity/README.md).
No backend diagnostics; earlier0.11 reports below describe the preceding work.


**Latest rehearsal, 10:15 UTC: repeatability failed; first useful TCP evidence.**
During a later capture, batch age expired at 240 ms and the firmware stopped
the turn. Probe: samples=33, snd_free/snd_min=711, queued=4,
peer_wnd=65535, cwnd=49477, ack_bytes=0, retransmits=0, unacked=1,
unsent=0; transport polls=32/all zero, writes=0. This is below the stock
free-byte writable threshold, with an open peer window and queue below its
low-water limit. It indicates actual send-space pressure awaiting ACK advance;
it does not locate link loss/delay, establish RTT, or rule out duplicate ACKs/
future RTO. Crucially Stop was subsequently acknowledged and the session ended
without disconnecting. Heap/stack limits held. Keep stopped and preserve the
evidence; reliable multi-turn speech remains unmet despite earlier short success.

**Latest result, 10:12 UTC:** one short real conversation went well by the user's
report. Captured ~6.71s, played a reply, received/consumed 322/322 output chunks
with two buffer waits, then applied Stop and ended while remaining connected.
No send fault/TCP probe failure record in this turn. Heap minimum=48816,
sampled largest=31732, loop/worker=1180/14376, above test limits. This is a
single-turn observation, not root-cause isolation, natural-completion/physical
Stop-latency proof or general reliability acceptance. Preserve this exact build
and stopped session; longer/failure rehearsals remain pending. No backend work.

## Current 0.11: robot-only TCP evidence, not a verified audio fix

Installed November 15, final upload manifest 10:09:54.848962 UTC. Application
SHA-256 `4d56d3d5ccf5cb84d5a7edd1ed849368fe452446b2128b44502f29d147cb29f7`.
Four-image verification and final idle boot/selftest at 10:10:03 pass; capture/
camera off. **No backend diagnostic window, origin sampler, gateway restart,
Anay message or protocol change is needed or authorized by this measurement.**
The older coordinated-origin instructions below are historical and superseded.

0.10 failed its one physical turn: capture-on at 10:00:14.264500 UTC, then
capture-age stop at 10:00:16.436316 after 92 completed frame writes. The following
Stop control also timed out before TLS entry (16 zero polls/no TLS write), and
disconnection followed at 10:00:16.639780. Minimum internal heap=50656, without
a recorded memory/stack test-limit breach. Successful writes are not TCP ACKs
or gateway accepts. Resumable host tests did not establish physical readiness.

0.11 keeps the stock TCP buffer and 240 ms capture-age bound. It adds one exact
linker edge: `liblwip.a(sockets.c.obj)` -> `__wrap_netconn_write_partly`. The hook
forwards unchanged arguments once and returns the original result; it never
reads `data` or alters `written`. Only the already-selected transport worker
binds that API's typed `netconn*`; other tasks are excluded. The worker owns
socket teardown and clears the binding before transport destruction. TCP state
is copied through the matching SDK's public typed headers under
`LOCK_TCPIP_CORE`/`UNLOCK_TCPIP_CORE`, required at compile time. No private
socket lookup, structure cast, address/port logging, packet payload inspection,
TCP mutation or library replacement. This lock/snapshot instrumentation adds
overhead and can affect timing; local Stop remains on the independent UI task.

Per-write-window samples capture free send bytes/minimum, queued pbuf count,
peer send window, congestion window, TCP ACK-byte advance, maximum observed
`pcb->nrtx`, and whether unacked/unsent lists are nonempty (no traversal).
Raw sequence values stay transient in RAM; only ACK differences are emitted.
Binding survives window resets on the same live connection, but is invalidated
before deletion. No samples means unavailable metadata, not a zero-window fact.
Snapshots occur at API send edges and wrapped polls, not continuously.

```
event=voice_tcp_probe samples=5 snd_free=1000 snd_min=800 queued=10 peer_wnd=65535 cwnd=2872 ack_bytes=2048 retransmits=1 unacked=1 unsent=0 camera=off
```

Illustrative only. Interpret against the stock writable rules (free >2873 and
queued <8): a snapshot above/below those thresholds can distinguish actual
send-space pressure from a suspect writable notification. Peer window zero
shows peer flow control at that sample. ACK advance/retry state narrows network
progress, but `nrtx=0` during 240 ms does not exclude loss or a later RTO, and
none of these fields identifies whether an origin server caused a stall.

Probe records are printed at safe unsent expiry/cancellation and hard failure;
Stop/epoch/fault invalidation precedes diagnostic printing on failure. They stay
within the numeric-only USB allowlist. No audio/transcript/header/credential or
network destination is retained. Existing helpers must be restarted after flash
to load the expanded strict allowlist; never open two serial owners.

Separately, `input.stop` now gets one existing six-second watchdog interval of
**nonblocking** progress after local capture/output have stopped. All other
control writes keep 100 ms; capture still expires at its original 240 ms age.
The worker continues inbound processing while Stop waits; watchdog, hard error
or possibly buffered/partial TLS cancellation still close. This is bounded
failed-turn cancellation, not permission to keep recording or promise delivery.

Checks: 28 Python tests, ten C++ ASan/UBSan executables (including TCP gauge/
ACK-wrap/reset and stopped-control recovery), both normal/diagnostic builds,
unchanged stock SDK/archive hashes, all three required wrapper edges, stack
guard, protected upload dry run and actual four-image upload. Diagnostic build
program/globals=1474999/152804 bytes; normal=1473683/152716. Final idle internal
free/minimum/largest=177376/175844/126964, loop=1180, worker=0 before connection.
This does not prove live TCP measurements, successful speech or physical Stop.
Private provisioning/local Connect and connected memory review precede one
explicit local Speak attempt; no automatic retry. Preserve the resulting
`voice_tcp_probe` before deciding on any further firmware/network change.


## Historical 0.9 diagnostic variant

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
