# Stackchan twelve-frame playback credit

November14,2026. Backend branch `anay/stackchan-twelve-frame-playback`, based on deployed `5ef554a`. Requested by Anay with Emilia's firmware handoff:12×20ms=240ms output capacity, four-frame fallback. Actual deployment revision/checks are recorded in backend status/API.

## Backend change

The existing protocol already accepts `device.hello.playback.outputWindowChunks:4|12`. Removed the browser-only gates in both gateway negotiation and all three speech-owner constructors (captured reply, approved prompt, typed speech). An authenticated robot explicitly requesting12 now receives `device.ready.audio.outputWindowChunks:12`; omitted or explicit4 stays4. No protocol version, auth, migration, provider, microphone, speech model or firmware change. Existing browser behavior remains. `SPEECH_EXTENDED_OUTPUT_WINDOW` names the shared12-frame limit; the old browser constant remains a compatibility alias.

Credit is pinned per stream owner. Server sends at most negotiated frames ahead of **consumed** receipts: started0/zero progress adds no credit; consumed progress2 permits exactly two more frames. Receiving/queueing bytes does not count as playback. Existing input/chunk/stream bounds, deadlines, current generation/lease/profile/privacy/policy guards and backpressure cap remain. Stop aborts the owner and wipes its queued PCM, sends cancellation, and rejects late receipts without emitting additional frames or granting capture.

This is permission to queue up to240ms, not a server-side240ms sleep or a proven jitter fix. Firmware owns its prebuffer/playback scheduling. Short output can end before12frames; handle `audio.end` by playing the available tail rather than waiting forever for12. Four frames remains80ms. At22,050Hz mono PCM16 each20ms frame is882bytes, so12frames hold10,584PCMbytes before JSON/base64/queue overhead; size and bound the actual device buffers independently.

## Emilia handoff

1. Send `playback.outputWindowChunks:12` alongside the existing encoding/channel/sample-rate capabilities, and honor the actual ready response (12 or4).
2. Bound the device ring/DMA/playback queues to the negotiated capacity. Send progress for consumed samples only; two-frame batching works with existing rate bounds. Do not refill credit merely on network receipt.
3. Local Stop must immediately mute output and discard the entire local queue independently of the server. Retire the stream/generation; discard late old chunks, audio-end and callbacks. Backend Stop also clears its owner, but cannot recall bytes already delivered over TCP.
4. Test short replies, repeated buffer underruns, Wi-Fi jitter, Stop with a full12-frame queue, pause/disconnect/handoff and old receipts. Record audible/hardware results separately; fixture/public protocol checks do not establish K151 behavior.

## Verification and rollout

Real gateway WebSocket fixtures verify browser+robot12 credit, both omitted/explicit4 fallback, no credit from started/zero progress, over-credit rejection, exact consumed refill, queued/playing Stop with PCM wipe/stale completion rejection, approved teaching prompt credit, and short reply completion without padding/capture. **413 tests /6,281 expectations** passed without failures/skips using isolated PostgreSQL databases; pinned frozen Bun1.4.4, type/Svelte zero errors/warnings, formatting and whitespace passed. No engine or dependency change requires a speech restart.

Use protected source/build/config/database/private-media backup pointer `.data/stackchan-window-rollback-path`, then restart gateway only. Web and speech should retain PID/start timestamps. Actual public robot protocol acceptance should use its own fictional profile, verified WSS, real speech and simulated receipts: initial12→consume2→14total→Stop→late receipt rejected; omitted field advertises4. Do not take over Alex's endpoint for the probe. User/Emilia still perform hardware/audio acceptance. Existing Jev/profile/German manual test reminder remains applicable.


## Actual deployment acceptance

Gateway **264df22** deployed, web/speech **a779c70** retained with identical PID/start timestamps. No configuration/migration/data/provider/endpoint key change. Protected backup pointer `.data/stackchan-window-rollback-path`; four services active, zero gateway automatic restarts. Final413tests/6281expectations passed, no failures/skips, zero-error/warning type/Svelte and format/whitespace.

Actual authenticated public robot WSS, independently created fictional profile: ready12, initial12chunks, started0 grants none, consumed2→14total, Stop→ended/no more chunks, stale progress rejected. A separate omitted-field robot handshake returned4. Used actual local speech/configured external chat and simulated consumed receipts; no audio/transcript logged/saved and no K151/speaker/jitter acceptance implied. Probe released/deleted only its own enrollments/profile; existing Alex/Stackchan untouched. Backend status/API/build plan updated together. Emilia must still verify local full-buffer Stop flush, short tail, underruns and actual negotiated device buffers.
