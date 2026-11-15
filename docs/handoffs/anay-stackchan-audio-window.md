# Stackchan audio follow-up for Anay

## Coordinated 240ms update

Emilia authorized the 12-chunk change. Reviewed backend-deploy `f3e3b41` and
Anay's `stackchan-playback-window.md`: gateway `264df22` is recorded deployed
with robot negotiation and all stream owners honoring 4|12. Firmware 0.5 now
requests 12, validates the actual reply, bounds decoded storage at 12 and ingress
at 14 (metadata+chunks+end), with two stable driver blocks. Consumption receipts
are paced at 40ms plus final tail, preserving true mixer consumption; no early
receipt credit. Host full-buffer cancellation/ring-wrap/short-tail/latency checks
and exact fetched schemas pass. Actual upload is hash-verified; live K151 grant
and audible/Stop acceptance remain pending. The earlier four-only restriction
below is historical. No backend/shared-schema change was made in this checkout.

Firmware owner: Emilia. Source reviewed: freshly fetched backend-deploy
`ddecdc9`. No server/contracts/UI files changed in this increment.

## First physical voice turn — failed playback acceptance

On voice 0.2, `stackchan-alex` reached authenticated ready and eventually owned
Alex's session after an explicit handoff. A new session Start was applied at
04:24:54 UTC, and Unmute at 04:25:15 left it ready. Explicit Speak produced
listening/capture-on at 04:25:32; Finished produced capture-off/processing at
04:25:36. The first playback-on indication was 04:25:38. Emilia heard the
beginning of a real reply but described it as very choppy; no full intelligible
reply or successful playback completion is accepted.

At 04:25:42 the SDK WS read returned -1 with opcode NONE=256, HTTPS upgrade 101,
Wi-Fi associated and errno 0, followed by local playback-off and connect_failed.
This repeats an earlier idle read failure pattern. It does not establish a
server-initiated close; receipt timestamps are USB-host times, not RTT measures.
Loop/worker watermarks remained 1276/14432; no new boot was logged during the
turn. Raw audio, generated speech and reply text were not saved in this log.

## Firmware 0.3 — installed, idle only

Native build/stack guard, decoder/driver/window sanitizer checks, 19 Python
helper/stack checks and exact current schema fixtures passed. The device upload
hash-verified all four images; a subsequent 20-second receive-only observer
confirmed 0.3 boot and stable idle memory, with no capture/output activity.
Emilia is away; authenticated 0.3 speech/Stop/smoothness tests remain pending.

- Bounded incremental text/control-frame reader on the existing TLS parent,
  retaining partial headers/body across zero-byte TLS WANT_READ/timeouts. SDK
  still handles verified HTTP upgrade and masked writes. Negative TLS reads
  close the connection; partial-frame deadline remains one second. No retry of
  the SDK's ambiguous WS -1 and no change to auth/TLS/reconnect permissions.
- This follows inspection of the installed headers and local ESP-IDF v5.5.1
  `transport_ws.c`: its exact-size header helper maps a zero-byte timeout to -1
  and loses its local partial header. This is a confirmed implementation risk,
  not proof that it caused the observed exits. Framing reference:
  [RFC 6455 sections 5.2/5.5](https://www.rfc-editor.org/rfc/rfc6455.html#section-5.2).
- Two stable speaker buffers, initial/rebuffer fill within the existing
  four-chunk grant, and coalesced progress receipts for simultaneous mixer
  releases. Queued chunks never count as consumed, and Stop invalidates both
  slots before driver cleanup. Added fixed numeric received/consumed/buffer-wait
  diagnostics and suppression of duplicate state/positive media-ack log spam.

Physical 0.3 transport/smoothness and Stop checks remain separate; this document
does not mark them passed.

## Joint decision: robot output window

Current canonical types allow 4 or 12 chunks, but realtime `control.ts` grants
12 only to browser identities. `speech-turns.ts` independently limits a robot
to four when creating speech owners. Four 20 ms chunks cover at most 80 ms of
feedback delay. Firmware buffering cannot hide a sustained longer round trip
while preserving truthful consumption-based receipts.

The host driver rehearsal completes 24 chunks without a buffer wait at a
synthetic 40 ms receipt→replacement feedback delay. At 100 ms it still completes
with correct receipts, but buffer waits are unavoidable with a four-chunk window.
These synthetic results are not measured demo-network latency or audible quality.

Anay: review whether to grant an explicitly negotiated bounded 12-chunk window
to robot endpoints too, updating BOTH gateway negotiation and speech-owner
creation checks and their tests. Emilia must budget/test the corresponding
firmware queue/memory/cancellation bounds before advertising it. Do not bypass
assignment by advertising a browser identity, acknowledge merely received chunks,
buffer a whole utterance, or change only one consumer's window. Firmware 0.3
continues to advertise/accept four until that boundary is jointly implemented.

Also review sanitized gateway/proxy disconnect causes around the times above;
do not share headers, credentials, payloads or transcripts. Camera still reports
unavailable and remains a separate required F13 contract/relay handoff.
