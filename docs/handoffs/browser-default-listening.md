# Browser conversation starts listening

User requested an active microphone by default, optional Mute, and fewer hidden
steps on November 14. The browser's explicit **Start conversation** now opts into
conversation listening, initializes browser sound, starts the session, unmutes
through the existing acknowledged command, and requests a fresh capture grant.
No separate Unmute/Speak sequence is required. Browser permission is still required.

After an ordinary reply is actually consumed, Conversational/Guided request the
next granted turn. No capture overlaps processing or approved playback. Interim
waiting snapshots during recognition/generation do not start another capture.
Quiet permits the initial explicit turn, then remains capture-off after playback.
Initial silence still pauses after 15 seconds without model submission. Explicit
Resume starts conversation listening again; it does not restore an old grant.

Mute microphone and Type instead are directly visible. Tapping the listening
indicator finishes the turn; the separately visible Stop ends the session.
Mute disables capture/pending input and continuation while preserving unrelated
approved playback. Plain Unmute in the auxiliary controls remains capture-off;
Start listening is a separate explicit request to continue. Typing cancels the
loop and returns an interrupted session to capture-off ready using existing
Pause/Resume acknowledgments. Reading/exit dialogs never acquire capture merely
through their Resume controls. Opening the exit keypad pauses input/output first.

`BrowserConversation` holds only transient listening intent. The existing
`ParticipantConnection`, authoritative session, revision/lease checks, server
capture grants and `BrowserAudio` remain in control. No new API, backend session
store, device event, database migration, retained speech or provider is added.
Raw server Start remains capture-off; the browser sequences existing commands
under the user's start gesture. Firmware is unchanged and must still explicitly
unmute/request grants under its local controls.

Pause/Stop/help, mute, disconnect, backgrounding, handoff, profile/privacy/policy
changes and permission/provider errors retire continuation. Late sound/permission
promises cannot restart it. Reconnect/reload starts with no listening intent;
the participant explicitly resumes. Old playback completion cannot reopen capture.
The current frontend tester's gateway does not need restarting for this change.

## Observed candidate checks

- Bun 1.4.4 frozen install; **345 tests passed / 5,427 expectations, zero
  failures/skips**, using isolated databases. Type/Svelte zero errors/warnings,
  production build, formatting and whitespace passed.
- New tests cover Start/unmute acknowledgment, one request per turn, interim
  waiting, consumed playback, spoken mode-generation changes, Quiet, stale
  profile/privacy/policy/lease/session/owner, mute/Pause/Stop, canceled preparation,
  observer rejection and explicit Resume without plain-unmute capture.
- Chromium on isolated HTTPS/WSS and disposable PostgreSQL used the real bundled
  WebRTC detector, Web Audio and in-memory fixed Piper phrase. Identity/model/
  recognition/output services were explicit fixtures. One Start reached capture
  and a consumed reply automatically requested the next turn. Mute/Pause/Resume,
  typing, Stop, denied and late permission passed with no live input tracks left.
  Quiet requested only one capture. No browser runtime errors or observed capture
  during output starts; no human mic, physical speaker or recordings.
- Production-build participant/profile/media/restart and verified TLS/WSS chat
  smokes passed. No live gateway, firmware, model/provider/speech configuration or
  existing session was changed by those candidate tests.

The isolated harness initially needed its own certificate trust on browser-native
requests and had a missing config version in its Quiet fixture; those harness
issues were corrected before the clean four-case browser run.

## Current service and Stackchan boundary

The running wrapper reports CPU faster-whisper `int8` with two STT workers and
CPU Piper with two TTS workers. Voice is `en_US-hfc_female-medium` at 22,050 Hz.
Different enrolled profiles/endpoints can run simultaneously; one profile retains
one active audio owner and explicit handoff. Admission remains bounded, not a
guarantee of arbitrary concurrency. CUDA is not enabled because clean driver
initialization returned 999. Jev remains disabled after the prior 21-case gate;
reviewed exact activity phrases, not semantic model actions, select live modes.

The backend supports scoped WSS control and negotiated PCM speech. The inspected
firmware branch `emilia/firmware-foundation/e42a6de` still advertises
`audio.supported:false` in `lemmi_control.ino`; its offline packetizer does not
implement connected capture/playback. Control/pairing integration can begin;
full robot speech needs Emilia's audio client, local stop/mute/watchdog, receipts,
buffer bounds and physical acceptance. Give each tester a separate enrollment.

On the server, the existing `bun run enroll-device PROFILE_ID PRIVATE_FILE`
creates/reuses an explicitly scoped robot identity without printing its secret.
Do not share the active `stackchan-alex` identity across simultaneous clients.
Use [the current backend API](../backend_api.md) for the exact hello, 16 kHz mono
PCM16/20 ms frames, grants, negotiated output rates, receipts and cancellation.
No STT/TTS inference runs on the ESP32. Actual hardware/human-room acceptance and
counterpart review remain pending.

## Observed deployment

Web `d6d2ff6` is installed; gateway `95bdcef` and speech were retained. Gateway PID/start timestamp byte-matched around the web-only restart. Rollback pointer `.data/default-listening-rollback-path`. Actual public Chromium, on a newly created fictional profile, used one Start and in-memory fixed speech through real browser capture/VAD, local STT, the configured external LLM and HFC TTS. One reply was consumed by Web Audio and two capture requests occurred without a second button click; Mute stopped input without restart, then Stop ended the session. Zero runtime errors; no human mic/physical-speaker claim. Only the rehearsal profile/endpoint was removed. Refresh and explicitly Start/Resume to load/use the new flow. The final late-old-request test raised the full clean count to 345/5,427; no deployed runtime change was needed for that test.
