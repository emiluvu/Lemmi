# Stackchan microphone uplink: backend evidence and Emilia handoff

Investigated November 15, 2026 on `mobrob-Precision-3680`, checkout
`backend-deploy` at `f3e3b41`. Gateway runtime remains `264df22`; web/speech
remain `a779c70`. **The diagnostic candidate below is not deployed or enabled.**
No service, private configuration, credential, profile, protocol, buffer limit,
timeout, TLS check or firmware was changed during this investigation.

## Report under investigation

User supplied Emilia's report for `stackchan-alex` / `profile-alex`, voice 0.9:
at **2026-11-15 06:11:35 UTC**, `voice_send_failed reason=6 status=2 result=0
bytes=0`, `send_max_ms=112 capture_sent=4`; capture stopped before Finished and
the device disconnected. Playback's negotiated 12-frame/240 ms window is
separate from this microphone uplink.

`docs/handoffs/stackchan-send-stall-investigation.md` was absent from this
checkout and from the fetched `emilia/firmware-foundation` head `e4c4cb6`.
The backend findings therefore use the pasted report; the exact voice 0.9 source
and SDK meaning of reason/status codes have not been reviewed here.

## Answers from the deployed host

1. **Were capture frames arriving and being read normally? Unknown for this
   attempt.** Current gateway code validates accepted frames synchronously and
   returns without sending per-frame responses, broadcasting or checkpointing.
   STT/model/TTS work begins only on explicit `audio.end`. Neither capture
   reception/acceptance counts nor WebSocket closes are logged in this runtime.
   Existing speech timing logs cannot reconstruct an unfinished capture.
   `capture_sent=4` is firmware evidence, not proof that four frames arrived here.
2. **Close, rate limit, restart or proxy backpressure?** The four services'
   journals have **zero entries from 06:09:00 through 06:14:00 UTC**. This does
   not rule out a close or rate rejection, since those paths do not currently
   log. Gateway started **05:39:31 UTC**, web/speech **04:48:05 UTC** that day;
   tunnel started **November 14 06:43:36 UTC**. All were active with
   `NRestarts=0` when inspected. Nginx was running since **November 14
   06:30:07.777803283 UTC**, restart count zero. No observed local restart
   explains the incident. Historical gateway startup records corroborate the
   05:39:31 start; automatic restart counters alone cannot exclude every form
   of infrastructure interruption.
3. **Can ACK/retransmission timing be measured without payload capture? Yes,
   prospectively, at the appropriate observation point.** See the plan below.
   No TCP timing or packet capture was running for this failed attempt, so no
   historical ACK/retransmission measurement is available.

Installed Nginx configuration agrees with the tracked device-stream proxy:
buffering off, `proxy_read_timeout 30s`, no configured `limit_req`/`limit_conn`.
That read timeout concerns upstream reads; it is not a 30-second microphone
write budget. Nginx access logging is off and its Docker logging driver is
`none`; no retained proxy output is available here. Cloudflare edge/WAF logs
were not available through this local inspection. Do not treat local log
silence as evidence against an edge/network stall.

Gateway limits remain 4,096 bytes/message, 60 capture chunks/s, 30 non-chunk
messages/s, 90 total messages/s in a connection's one-second counter window;
64 KiB outbound backpressure and a six-second application heartbeat deadline
also remain. At 50 chunks/s, capture alone is within these limits. A backlog
sent in a burst can exceed them; this is a reason to measure close causes, not
to relax them without evidence. The 64 KiB limit is outgoing server data and
is separate from the robot's reported 5,744-byte TCP send buffer.

## Diagnostic candidate for a coordinated attempt

`apps/realtime/src/transport-diagnostics.ts` adds an optional constant-size
accumulator for **one exact enrolled endpoint**, selected only by trusted server
configuration `LEMMI_TRANSPORT_DIAGNOSTICS_DEVICE=stackchan-alex`. Empty/unset
keeps it off. It creates no public route and changes no wire event or schema.

The gateway writes `Lemmi transport diagnostic` records for open, a new capture
grant, receipt of capture-end, close and at most one periodic sample/second.
Journald supplies UTC timestamps. Records contain a random connection ID,
received message/byte totals, current capture number/accepted-frame count,
maximum accepted-frame gap, time since last accepted frame, maximum synchronous
handler duration, sample spacing, error count/last error code, last validated
event type, close code and an allowlisted local close cause. Capture-end means
the end event reached its handling path; it does not prove STT or reply success.
Counters other than frame count/gaps are cumulative for the connection. Frame
count/gaps reset on each new grant. Sample spacing can include event-loop or
process scheduling delay; it is not network RTT.

No audio, base64, utterances, headers, tokens, raw errors, firmware strings,
profile/device/session/stream/lease IDs or peer-supplied close reason are emitted.
The stream ID is used internally only to avoid treating a duplicate grant as
a new capture. Observer exceptions cannot interrupt control handling. Close
causes retain the first application-requested cause; native/peer/transport
closes may have no local cause. A close code alone cannot identify which
intermediary initiated a network failure. Abrupt process death may produce
no final close record.

Anay's rollout step: preserve the current release/configuration, coordinate a
brief gateway restart with Emilia, deploy the reviewed candidate, enable only
this endpoint, and explicitly Start again after reconnect. Do not restart web,
speech or tunnel for this change. Stop the rehearsal and clear the setting
after collecting the bounded attempt; coordinate its gateway restart too.
This preparation does not authorize automatically starting the robot mic.

## Payload-free transport observation and Emilia's next step

Actual path: **robot → Cloudflare edge TLS → Cloudflare Tunnel → local Nginx
HTTP/WS → gateway**. Cloudflare forwards traffic through a separate tunnel;
the backend's TCP sockets are not the robot-to-edge connection. See
[Cloudflare Tunnel fundamentals](https://developers.cloudflare.com/tunnel/concepts/).
Consequently, backend `ss -tin` cannot measure robot-facing TLS ACK timing.

- On the backend, sample `ss -tin` for ports 3001/8080 during the same UTC
  window. This reads kernel queue/RTT/retransmission counters without packet or
  payload capture. It can identify local queues that stop draining, not
  Wi-Fi/robot ACK delay. A current inspection had no matching connected
  sockets; this says nothing about the earlier failure. `ss` RTT and
  retransmission fields are documented in the [ss manual](https://man7.org/linux/man-pages/man8/ss.8.html).
- For the **actual robot-facing path**, Emilia should use supported lwIP TCP
  counters, if exposed by the pinned SDK, or a managed router/AP observation
  point that sees both directions of that robot's TCP/443 flow. Export only
  UTC/monotonic times, direction, sequence/ACK numbers, TCP flags, advertised
  receive window, packet/header lengths and retransmission/gap counters. Use a
  header-reading eBPF/flow exporter or an equivalent tool whose payload
  exclusion is verified; this capability has not been provisioned or run.
  Neither a full pcap nor TLS session keys are needed. A fixed `tcpdump -s N`
  is not a general guarantee of header-only capture: varying header lengths
  can leave payload bytes within that snap length.
- A Linux synthetic sender can use `ss -tin`/`TCP_INFO` on **its own** verified
  TLS socket for RTT/retransmits/ACK progress without payload capture. It must
  have its own explicitly enrolled fictional profile and endpoint. It tests
  that sender's route/stack, not the ESP32's route, and must not take over Alex.

Emilia: retain voice 0.9 and supply its exact source revision/detailed handoff;
agree a short UTC-marked attempt with Anay after diagnostic deployment. Include
grant time, successful-send counts, bounded send duration/queue high-water
statistics, failure time and local Stop/mute outcome, with no payloads. Do not
raise buffer/time limits or change chunk format for this evidence pass.

Compare the observations:

| Observation | Next investigation |
| --- | --- |
| Application close cause reports capture/control rate | Check paced production versus queued burst and heartbeat/control volume with Emilia; retain guards |
| Accepted-frame count stops, no local close, local queues drain normally | Locate the gap before gateway; combine robot/AP ACK/window/retransmission evidence before assigning fault |
| Local queues grow or handler/sample gaps spike | Investigate proxy/origin scheduling or blocked event loop |
| Robot-side ACK stalls/retransmissions or zero receive window correlate with send failure | Separate Wi-Fi loss, peer flow control and client writable/TLS behavior using the same sequence/ACK timeline |

Reported arithmetic is compatible with a small send window being exhausted:
four representative 1,242-byte messages are 4,968 bytes, versus the reported
5,744-byte TCP send buffer; the total buffer represents roughly 92 ms at
62 KB/s. **This is a hypothesis, not measured ACK evidence**: TLS/framing,
partial writes and actual send-buffer accounting matter, and a 112 ms send
duration alone does not identify the cause. No interpretation of SDK reason 6
is asserted without the exact source.

Keep verified TLS/auth, immediate local Stop/mute, capture-only-while-listening,
fresh grants, revision/lease checks and stale-result cancellation throughout.
Reconnect must remain capture-off and require explicit continuation. Emilia
owns firmware instrumentation/local acceptance; Anay owns diagnostic rollout
and origin-side observations. Counterpart review and the paired hardware
attempt remain pending; there is no complete/smooth physical voice acceptance.

## Checks actually performed

- Read-only service/journal and Nginx lifecycle/config inspection as above.
- Pinned Bun 1.4.4: 25 gateway/TLS/proxy tests, 168 expectations, plus 53
  speech/adapters/scheduling/access/cancellation tests, 2,136 expectations:
  **78 passed, zero failed**. Isolated fictional adapters/credentials; no real
  provider or physical robot used. Initial sandbox execution was blocked at
  loopback listen (`EPERM`); rerun outside that restriction passed.
- New checks cover selected-endpoint privacy, peer close-text exclusion,
  capture-rate-limit cause, observer-failure isolation, mute/Stop cancellation
  and a 75-frame loopback upload paced at 20 ms/frame, with aggregate samples
  and no per-frame responses. This establishes software behavior, not Wi-Fi
  throughput or hardware acceptance.
- `bun run check` passed (Svelte zero errors/warnings and TypeScript), changed
  TypeScript files passed Prettier, and `git diff --check` passed. No dependency
  or lockfile changes; the existing pinned Bun installation was used.
- No production restart, deployment, packet/payload capture, memory opt-in,
  contact send or new live endpoint/profile was performed.
