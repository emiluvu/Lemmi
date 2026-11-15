# Stackchan microphone uplink: backend evidence and Emilia handoff

## Send-capacity proposal review — 3c37f83

November15,2026, Anay backend counterpart review. **Proceed with isolated
paired build preparation. Hardware/RAM acceptance remains pending.** No
backend API, protocol, service, configuration or firmware changes were made by
this review. Installed diagnostic robot remains stopped; no new capture requested.
Gateway diagnostics remain enabled under the earlier user hold instruction.

The5744→16384-byte SDK experiment is a bounded comparison supported by the
measured pre-TLS writability stall. It is not a demonstrated fix or a selected
production buffer size. Keep playback12, capture framing, batching/queue bounds,
100ms write budget, TLS/auth and immediate local controls unchanged.

**Material review finding: record all derived writable thresholds.** Checked
ESP-IDF v5.5.4's lwIP submodule revision
`fd432e4ee2cfb7f7f1c7eb7227e0173412e7b84e`, its default macros and the send-space
callbacks. Assuming reported MSS1436 and no overrides, the expected values are:

| Resolved setting | Baseline | Candidate |
| --- | --- | --- |
| TCP_SND_BUF | 5744 | 16384 |
| TCP_SNDLOWAT | **2873** | **8192** |
| TCP_SND_QUEUELEN | **16** | **46** |
| TCP_SNDQUEUELOWAT | **8** | **23** |
| Free bytes needed for send-space callback | at least2874 | at least8193 |
| Queued pbuf count required by callback | below8 | below23 |

These are derived expectations, **not measurements of a built candidate**.
Confirm the actual preprocessed macros in both builds. The callback requires
both enough free bytes and a low enough pbuf count. Increasing capacity also
changes when select becomes writable, so a better or worse outcome cannot be
attributed solely to extra payload storage. Do not independently tune these
thresholds within the first comparison; report their derived changes.
Sources: [matched lwIP option formulas](https://github.com/espressif/esp-lwip/blob/fd432e4ee2cfb7f7f1c7eb7227e0173412e7b84e/src/include/lwip/opt.h),
[send-space callbacks](https://github.com/espressif/esp-lwip/blob/fd432e4ee2cfb7f7f1c7eb7227e0173412e7b84e/src/api/api_msg.c).

**Memory finding:**16384−5744=10640 additional payload-capacity bytes per live
TCP socket;75988−10640=65348 is correct arithmetic. It is not proven minimum
free heap under load. Account for the actual concurrent TCP socket count,
pbuf/segment/allocator/oversize overhead, TLS/cJSON/audio lifetimes and
fragmentation. Queue limits are allocation limits, not proof that every slot is
preallocated. Establish an explicit allocation/reserve budget from the candidate
before a hardware comparison, then observe minimum free internal heap, largest
allocatable internal block and task stack watermarks across connection/capture/
output/Stop. Do not count disabled PSRAM or free heap from a different lifecycle
phase as guaranteed capacity. Allocation failure must remain fail-closed.

**Next handoff to Emilia:**

1. Build a5744 control and16384 candidate with the same isolated builder/toolchain,
   component revisions and full baseline config. Prove both link their intended
   SDK archives and retain both diagnostic hook edges. Preserve the installed
   normal SDK and flash backup. Record final full config diffs, expanded macro
   values, compiler/component revisions, maps and archive/application hashes.
   Differences beyond capacity/necessary derived accounting need explanation;
   comparing only a freshly rebuilt candidate against the shipped archive would
   otherwise confound the experiment with rebuild differences.
2. Complete the overhead/concurrent-socket/reserve budget and artifact checks.
   This review accepts the build direction; it does not certify that75.9KB of
   observed connected heap is sufficient. Return the evidence before treating a
   candidate as hardware-ready. No identical capture repetition is useful now.
3. A later jointly scheduled candidate comparison needs a new bounded origin
   sampler window: the old sampler ended. Keep the speaker window and all
   cancellation/security behavior fixed. Preserve baseline recovery; one short
   improvement establishes capacity sensitivity, not root cause, sustained
   speech readiness or physical Stop acceptance.

**SDK identity correction accepted:** the installed metadata reported by Emilia
is ESP-IDF **v5.5.4 /735507283d**, builder43a8f6d. Earlier localv5.5.1 inspection
was not the installed SDK's exact provenance. Actual linked diagnostic poll/TLS
measurements remain valid. The upstream matching transport still polls before
TLS writing. Baseline archive/config hashes in3c37f83 were reviewed as reported
provenance, not independently checked against Emilia's local files.
[Matching transport source](https://github.com/espressif/esp-idf/blob/v5.5.4/components/tcp_transport/transport_ssl.c),
[pinned builder](https://github.com/espressif/esp32-arduino-lib-builder/tree/43a8f6d).

Checks performed: exact proposal/config/baseline source review, official pinned
source inspection and arithmetic verification only. No packages installed,
SDK build, full-sketch/link-map acceptance, flash, serial, network session,
backend restart or hardware retest. No backend runtime change is needed to
prepare these paired builds.

## Instrumented diagnostic result — 07:20 UTC

November15,2026: correlated Emilia's published `b678916` on
`codex/stackchan-voice09-review` with the existing gateway and socket records.
Installed target for this attempt was **lemmi-voice/0.9-diag1**, not the original
uninstrumented voice0.9. No backend code/configuration/deployment change occurred.
**Diagnostics remain enabled; robot remains stopped; no repeat is requested.**

| Observation | UTC / result |
| --- | --- |
| Gateway connection opened | 07:18:58.400139 |
| Gateway grant | 07:20:21.616570 |
| Emilia's observed capture-on | 07:20:21.679905 |
| Gateway final accepted frames | **29**, 18,560 PCM bytes / 580ms |
| Last accepted frame | Approximately **07:20:22.445633**, inferred from monotonic frame age plus journal timestamp |
| Maximum accepted-frame gap | **192.007ms** |
| Maximum synchronous handler over connection | **0.888ms** |
| Rejected events / last error | **0 / null** |
| Complete application messages/bytes | 74 / 45,556 |
| Emilia's send failure | **07:20:22.601708**, bounded-write timeout,113ms maximum send,33 completed frame writes |
| Actual SDK poll/TLS probe | **5 polls,5 zero returns,0 poll errors; maximum21,090us;0 TLS writer calls** |
| Emilia's observed disconnected | 07:20:23.208735 |
| Only gateway close | **07:20:26.847291**, code1001, **Heartbeat timeout** |

No capture-end record or reply occurred. The four-frame difference between33
completed local writes and29 accepted messages is unlocalized, not evidence of
four lost packets. Gateway counters only see complete messages; completed writes
are not ACKs. Millisecond comparisons across machines remain qualified by
unmeasured clock/serial-observer timing.

The probe now distinguishes the failed batch's socket-writability polling from
TLS writing: no TLS writer call occurred during that bounded write. Backend
application rejection/close did not precede the failure in the available records.
The reason for non-writability remains unknown: ACK delay/loss, peer flow control,
SDK writable threshold and scheduling are not separated. **Nothing here proves
the twelve-frame playback window caused the stall.** No capture-end means no
reply generation was expected in this interrupted turn.

Local socket correlation used21 successful500ms snapshots over07:20:18–07:20:28;
the four relevant directions were present in17. All sampled Send-Q/Recv-Q values
on those four sockets were0. Both proxy and gateway receiver counters reached
46,839 TCP bytes by07:20:22.470 and stopped advancing; local forwarding ACK
counters covered those bytes. No retransmission field was reported in those
selected samples. No growing origin backlog is observed, but500ms samples can
miss a shorter stall and do not observe robot-facing Cloudflare TCP ACK/window
behavior. Web/speech/tunnel journals had no entries over07:20:15–07:20:30;
four services remain active, zero automatic restarts.

Static review of the published diagnostic wrappers confirms they forward each
selected call once, with unchanged arguments/return, count only in the selected
worker task, reset before the bounded write and print after failure. Hooks do
not examine payloads. This is source review, not an independent SDK link-map,
ESP32 build, flash or hardware acceptance. No new tests or robot operations were
run for this backend correlation.

**Next handoff:** retain the stopped diagnostic firmware and current guards.
Use these findings to plan actual robot-facing ACK/receive-window/loss evidence
or jointly review one isolated SDK/send-buffer feasibility experiment with a
measured RAM budget before choosing a fix. Do not repeat capture, raise blocking
timeouts, change media format or adjust playback capacity from this result alone.

Protected evidence: `.data/investigations/stackchan-uplink-20261115T072021Z/`.
The local metadata sampler completed its previously bounded run, last snapshot
**07:23:54.177778UTC**; it was not manually disabled. Gateway diagnostics remain
enabled under the user's earlier hold instruction. No restart/disable command
was executed during this correlation.

## Controlled retest results

November 15, 2026, **07:00:06–07:00:42 UTC**. Diagnostics remain enabled at
user request. No disable, restart, reflash or further capture was performed.
Robot remains stopped. **Do not repeat the identical attempt yet.**

| Observation | Result |
| --- | --- |
| Gateway capture grant | 07:00:30.757396 UTC |
| Emilia's capture interval | 07:00:30.899–07:00:34.315 UTC |
| Accepted frames at 07:00:31.364 / 32.365 / 33.365 / 34.366 | 24 / 73 / 120 / 164 |
| Final accepted frames | **164**, 104,960 PCM bytes / 3.28 seconds |
| Last accepted frame | Approximately 07:00:34.170 UTC, inferred from monotonic frame age and journal timestamp |
| Maximum accepted-frame gap | **121.281 ms** |
| Maximum synchronous handler duration over connection | **2.283 ms** |
| Rejected events / last error | **0 / null** |
| Final received complete application messages/bytes | 181 / 207,088 |
| Only gateway close | **07:00:38.371418 UTC**, code1001, **Heartbeat timeout** |

Emilia reported `reason=6 status=2 result=0 bytes=0 send_max_ms=109
capture_sent=167`, disconnect07:00:34.519, Wi-Fi status3/reason0,
local Stop07:00:38.370 and no reply frames. The later gateway heartbeat close
cannot explain the earlier reported device send failure. Its near coincidence
with local Stop does not prove Stop caused it; no input.stop reached the
connection. No rate-limit, validation, revision or application-backpressure
rejection was recorded. No capture-end arrived, so there was no accepted
Finished to start recognition/reply generation. Absence of replies is consistent
with the interrupted capture.

The **three-frame difference** between167 completed firmware writes and164
accepted frames is unlocalized. A completed write is not a TCP ACK; gateway
counts require complete WS messages. Unpropagated/incomplete TLS/WS/tunnel data
cannot be distinguished here. Do not call this three lost packets. Cross-host
clock synchronization/serial-observer latency was not independently measured.

Socket evidence:73 successful snapshots cover the window; the four correlated
socket directions appear in64 snapshots. Proxy/gateway receiving sockets had
Recv-Q0/Send-Q0 throughout their samples. Forwarding sockets briefly showed
Send-Q3,744/3,747 bytes around07:00:32.178/32.687 while ACK counters advanced,
then drained to0. Both receivers reached209,227 TCP bytes by07:00:34.221 and
stayed there until the later close. No retransmission field was reported in
these selected samples. **No growing local origin backlog was observed**;
500ms sampling can miss shorter stalls, including109ms, and these loopback
sockets do not measure robot-to-Cloudflare RTT/ACK delay/loss. Other
web/speech/tunnel journals had no entries in the attempt window. Four services
remained active; gateway zero automatic restarts.

**Next step:** first arrange payload-free observation of the actual robot-facing
flow at the router/AP, or supported device counters separating socket writability
from TLS retry behavior. Then agree one new UTC-marked attempt. Preserve TLS,
auth, immediate Stop/mute and revisions. Do not change buffer/time limits or
media format from this origin-only result. If that observation is unavailable,
a synthetic sender on Emilia's same network, using its own explicitly enrolled
fictional profile/endpoint, can provide a comparative baseline; it cannot prove
ESP32 behavior and must not take over Alex. No further test was initiated.

The local metadata sampler retains its original automatic end around07:23:55UTC;
gateway diagnostics remain enabled. Protected content-free evidence is under
`.data/investigations/stackchan-uplink-20261115T070006Z/` (allowlisted gateway
records, socket window and numeric summary). No packet/audio/header capture.
This correlation is not new software or successful physical voice acceptance.

## Diagnostic deployment — November 15, 2026

**Enabled on the shared backend for `stackchan-alex` only.** Gateway runtime
**`2501847`**, incorporating reviewed candidate `88bb7c7` via merge `a54661c`.
Content-free live startup journal confirmed activation at **06:53:25.055767 UTC**.
Web/speech remain `a779c70`; their PIDs/start times, tunnel PID/start time and
served web-build bytes match the pre-rollout fingerprints. Two intentional
gateway restarts were used: initial deployment, then an explicit content-free
startup marker to verify Bun's in-process dotenv setting without opening Alex's
socket. Zero automatic gateway restarts. Private configuration differs only by
`LEMMI_TRANSPORT_DIAGNOSTICS_DEVICE=stackchan-alex`; no schema/migration/provider,
firmware, media protocol, buffer or deadline change.

Pre-rollout rerun: **78 tests / 2,304 expectations passed**, zero failures;
type/Svelte zero errors/warnings, formatting/whitespace and an isolated production
build passed. The served web build was never replaced. Sandbox socket/build
worker restrictions required outside-sandbox runs; a `/proc` environment-only
activation check was inconclusive because Bun loads dotenv in-process, so the
explicit startup marker provides the observed activation evidence. Public
HTTPS/WSS checks using two disposable fictional profiles passed existing-key
retention, concurrent isolated Start/Pause/Stop and capture-off behavior. Only
those probes' profiles/endpoints were cleaned up. Existing profile rows/device
assignments/credential fingerprints matched before/after. No robot microphone,
physical speaker or live provider turn was initiated by this rollout.

**Emilia's one controlled attempt:** keep installed voice 0.9; no flash or
protocol change. Record UTC start and finish/failure times using her existing
filtered observer. Reconnect, explicitly Start/Resume and Unmute as required,
then explicitly Speak once with fictional/generic content. Use Finished if the
capture succeeds, and end with local Stop. If it fails, keep it stopped; do not
repeat. Return the UTC window and fixed numeric send/fault/close counters plus
observed Stop/mute outcome, without audio, text, headers or credentials. The
backend journal now records receive/acceptance counts and close causes.

A temporary **30-minute** sampler is also collecting only kernel TCP metadata
for local ports 3001/8080 at 500 ms intervals, under user service
`lemmi-uplink-socket-metadata`; output is protected at
`.data/stackchan-uplink-socket-metadata.jsonl`. It stops automatically. This does
not capture packets/payloads or measure the separate robot-to-Cloudflare TLS
connection. If a verified robot/AP-side metadata method is unavailable, the
attempt is explicitly an **origin-only diagnostic**, not an ACK/retransmission
measurement or proof of the eventual fix. Send the precise UTC window to Anay
for correlation; arrange a new bounded sampler window if the test happens later.

**Return to regular logging:** after collecting the one attempt and its logs,
Anay runs the protected host helper:

```sh
python3 .data/disable-stackchan-transport-diagnostics.py --apply
```

It removes only the diagnostic setting, preserves all other current private
configuration, restarts only the gateway and checks that it is active. Invoking
it without `--apply` is a dry run (already checked); actual disablement remains
pending the retest. The same code defaults to no transport diagnostics when
unset. Reconnect and explicitly Start afterward. Stop the local metadata sampler
early with `systemctl --user stop lemmi-uplink-socket-metadata` if it is still
running. Neither operation restores a database, credential, profile, permission
or media snapshot.

For full source rollback, the protected pointer
`.data/stackchan-uplink-rollback-path` identifies the pre-rollout source archive
at `f3e3b41` (gateway behavior `264df22`), original private configuration,
deployment metadata and served web-build archive. This is separate from the
normal one-setting disable path. Restore prior gateway source through a reviewed
commit on `backend-deploy` if necessary; preserve later configuration/data and
do not switch this checkout or restore old database/media state as routine
rollback. The deployment/retest record below is historical where it says the
candidate is undeployed.

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

At the initial inspection, `docs/handoffs/stackchan-send-stall-investigation.md` was absent from this
checkout and from the fetched `emilia/firmware-foundation` head `e4c4cb6`.
The backend findings therefore use the pasted report; the exact voice 0.9 source
and SDK meaning of reason/status codes have not been reviewed here.

**Subsequent source review:** Emilia published exact voice 0.9 at
[`d246217`](https://github.com/emiluvu/Lemmi/commit/d246217), branch
`codex/stackchan-voice09-review`. The source and detailed handoff are now reviewed
below. The initial missing-source limitation above describes the earlier pass.

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

## Exact voice 0.9 counterpart review — subsequent November 15 update

Reviewed `d246217` directly from Git without merging firmware into the deployment
checkout. `lemmi_voice.ino` defines `LEMMI_VOICE` and includes the shared control
sketch. The sketch advertises `lemmi-voice/0.9`, retains certificate verification,
scoped credentials, TCP_NODELAY and checked disabled Wi-Fi sleep. The detailed
[Emilia handoff](https://github.com/emiluvu/Lemmi/blob/d246217/docs/handoffs/stackchan-send-stall-investigation.md)
records her review of backend candidate `9a7173e` as compatible with the wire
contract; she did not independently repeat its tests or claim hardware acceptance.

Source-confirmed findings:

- `sendVoice` serializes each 640-byte PCM frame into the existing strict JSON
  event. `WsFrameWriter` emits a complete freshly masked WS message.
  `WsFrameBatch` concatenates up to four separate WS messages into at most
  8,192 bytes; it does not change the application media envelope. Collection
  opportunities occur at 60 ms or four queued messages, without waiting for
  playback credit. Earlier queue-age and grant/revision checks still apply.
- `flushVoiceBatch` gives `boundedWrite` a 100 ms budget. Each transport call
  receives at most 20 ms remaining budget; zero and the explicit TLS WANT
  statuses are retryable, with at most 128 attempts and cancellation checks
  before each attempt. Partial progress advances the byte pointer. A failed or
  partially cancelled batch closes the connection rather than continuing a
  damaged stream. A cancelled batch with zero reported accepted bytes is
  discarded so the control connection can deliver Stop/mute.
- **Reason 6 is the sketch's bounded WS write-failure label, not an ESP-IDF
  error code. Status 2 is `WriteResult::TimedOut`.** Thus `result=0 bytes=0`
  identifies zero reported accepted bytes for that failed batch. It cannot
  identify the SDK poll-versus-TLS zero-return site or prove no bytes were
  internally buffered by TLS. `capture_sent=4` increments only after complete
  successful writes; it proves neither gateway receipt nor TCP ACK progress.
  `send_max_ms` covers collection/serialization/flush work, not network RTT.
  The budget is cooperatively checked between calls; scheduling and transport
  return timing mean an observed 112 ms duration is not a precise 100 ms cutoff.
- The network worker performs writes and inbound reads sequentially. A bounded
  write can delay its next inbound state/control read; that fact alone does
  not establish the observed failure cause. UI-task local Stop immediately
  latches/increments the epoch and cancels audio. Mute changes input epoch;
  each batch retry checks the local epoch/input tokens. Remote revisions are
  checked from the worker's latest parsed state, with backend authority still
  rejecting stale work. In-flight TLS bytes cannot be recalled. Actual local
  latency and firmware/SDK concurrency remain hardware acceptance tasks.

No source finding establishes a new fix or warrants increasing queues, write
budgets, TCP buffers or changing protocol now. Publication itself changes no
running firmware or backend. Keep voice 0.9 stopped until the coordinated
diagnostic rollout/window and supported robot/AP measurement method are agreed;
do not repeat the same uninstrumented Speak sequence.

Independently ran five native test programs from the exact review snapshot:
`bounded_write`, `ws_frame_writer`, `ws_frame_reader`, `pcm_packetizer` and
`control_policy`, compiled with C++11, warnings-as-errors, AddressSanitizer and
UndefinedBehaviorSanitizer. All five passed outside the sandbox; initial
LeakSanitizer execution was blocked by the sandbox tracing restriction. No
ESP32 SDK/cJSON/driver/full-sketch build, hardware, flash, serial, network capture
or live speech test was performed. These helper tests do not reproduce the
precompiled SDK writable polling/TLS scheduler. Existing 78 backend tests remain
the prior candidate's checks, not a physical retest.

Next handoff remains Anay's reviewed gateway-only diagnostic rollout and Emilia's
explicit local action within an agreed UTC window. Specify the robot/AP metadata
method before capture. If only origin counters are available, label that attempt
origin-only: it can narrow gateway behavior but cannot settle robot TCP ACKs.
The eventual fix depends on that evidence and must be reviewed jointly before
firmware/protocol/path changes. No service was deployed or restarted for this
source review.
