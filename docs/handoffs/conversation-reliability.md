# Conversation reliability fixes

November 15, 2026. Local branch `fix/lemmi-conversation-reliability`, isolated
worktree `/tmp/lemmi-conversation-reliability`. Not deployed. The original shared
checkout and other dirty worktrees retain their work. Integration includes the
latest fetched backend release `8a08430`, including scalar photo asset tracking
and unsupported image-claim safeguards. No credentials, database
records, host configuration or firmware were changed.

## Behavior and causes

- Browser initial silence previously paused after 15 seconds. It now waits 30
  seconds, with no empty recognition/model request. Normal post-speech ending is
  separately configurable; the user selected a 1.5-second default (range 1–8
  seconds). Quiet still returns capture-off after a reply.
- A retired output's `response.cancel` could stop a fresh browser capture or
  Resume intent. Both browser controllers now require the current output's
  session/turn/stream identifiers. Actual current cancellation still stops it.
- Late canceled async errors could be emitted with a newer session envelope.
  Gateway delivery checks retain session/revision/lease/endpoint authority and
  track superseding endpoint operations, including same-generation Mute/Unmute.
  A real current mode-start synthesis failure remains explicit.
- Teach Lemmi's menu missed “I would like to talk about gardening.” Natural
  selection phrases use the reviewed topic helper and eligibility validation;
  a subsequent explanation reaches the existing conversation model.
- Deliberate next/previous/skip photo requests use existing activity reducers.
  Polite exit/switch phrases run before model generation. Quoted, negated and
  historical mentions do not execute commands. Global Stop keeps precedence.
- Photo openings and participant presentation omit detailed approved captions.
  Those captions remain server-side grounding; model instructions invite the
  participant to describe the picture without reciting the supplied narrative.

## Changed interfaces and rollout

The input capture bound is 40 seconds / 2,000 frames / 1,280,000 bytes at 16 kHz
mono PCM16. Shared constants drive buffer allocation, both audio.end schemas,
adapter validation and advertised `device.ready.audio.maxCaptureMs`. Browser
capture reserves half a second: 39.5 seconds / 1,975 frames. The Python wrapper
accepts the same 40-second byte bound. Post-capture inference still has its
20-second deadline; output duration, credit, frame ordering, transient buffer
clearing and cancellation remain bounded. New clients can still parse the old
20-second ready advertisement.

Deploy matching web, gateway and local speech wrapper together after review:
an older wrapper rejects input over 20 seconds. No dependency, migration or
provider change. Set existing `PUBLIC_LEMMI_END_SILENCE_MS` configuration to
`1500` at rollout: an explicit old `1000` overrides the new default.
Start/reconnect/Unmute do not independently authorize capture.
Firmware may retain an earlier local timeout; the legacy local
`/participant/voice` client also retains its 19.5-second limit. Current designed
conversation, teaching and Photo Story use the updated LiveParticipant path.

## Verification and next handoff

Pinned Bun 1.4.4 frozen install, type/Svelte check, production build, formatting
and whitespace checks passed. Final integrated suite: **451 passed / 46 skipped /
0 failed**, 12,391 expectations across 58 files. The 46 database-dependent checks
need configured PostgreSQL. Seven Python wrapper boundary checks passed. The
full gateway suite includes a 30-turn fixture conversation and checks real local
WSS routing with explicit synthetic speech/model adapters. No real provider call
or retained microphone media is involved. Detailed verification is also recorded
in the build plan and backend status.
Tests use explicit fictional adapters and local loopback gateways. They do not
establish real ASR/LLM quality or prove every reported intermittent stall fixed.
No hosting-machine, real microphone/speaker, physical K151 or live-provider
acceptance was performed here; PostgreSQL-dependent checks need that service.

Anay reviews contracts and async delivery; Kylie checks simple photo text and
Resume controls; Lukas checks topic/navigation/exit phrases; Emilia rehearses
actual local controls and endpoint timing. On the host, rehearse: Start → wait
20–29 seconds → speak; ordinary short response; Pause/Resume during recognition,
generation and playback; spoken photo next/back and exit; Teach menu selection
then several substantive replies; Mute, Stop, disconnection and Quiet. Do not
merge acceptance claims with the older deployed-release observations.
