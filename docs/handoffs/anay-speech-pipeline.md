# Anay → Emilia / Kylie: bounded speech turns

Feature branch: **anay/speech-pipeline**, based on main after backend deployment PR #2. This increment is not deployed. Keep main/backend-deploy unchanged until counterpart review and an explicit deployment step. The older shared checkout remains intact.

The existing SessionCoordinator owns one optional media-work helper, not another session backend. A negotiated paired endpoint can explicitly capture, upload PCM, finish the turn, invoke local STT → existing OpenRouter chat policy → local TTS, and receive bounded output with playback receipts. Text-only clients keep their current behavior. Default mock startup never calls providers; live speech is opt-in.

**Implementation versus target:** the engine processes a complete bounded utterance after audio.end. The technical specification's incremental recognition target is still pending; this branch does not stream recognition or infer end-of-turn silence. The transport is chunked. Explicit turn end and a hard 20-second capture limit are required. No automatic provider/model fallback is introduced.

## Configure and rehearse

Provision the Python environment/models using [local speech setup](../../services/local-speech/README.md). Keep the listener/token private; root gateway settings need the same token and selected endpoints. Never publish port 8765.

~~~dotenv
# Private configuration; preserve existing domain/auth/database/provider settings.
LEMMI_SPEECH_ENABLED=1
LEMMI_STT_BACKEND=local-http
LEMMI_TTS_BACKEND=local-http
LEMMI_STT_URL=http://127.0.0.1:8765
LEMMI_TTS_URL=http://127.0.0.1:8765
LEMMI_SPEECH_TOKEN=
LEMMI_SPEECH_TIMEOUT_MS=20000
# Explicit GLM 5.3 Flash rehearsal choice, not a universal provider setting:
LEMMI_LLM_REASONING_EFFORT=low
LEMMI_LLM_MAX_TOKENS=512
~~~

Startup requires valid independent adapters and OpenRouter configuration. Negotiation reports configuration, not engine or hardware readiness; verify private engine health and a turn separately. Missing engines/unsupported voice/rate return unavailable. Change model/voice/device/endpoint between runs. The optional pinned multilingual small profile uses: python3 services/local-speech/prepare_models.py --stt-profile small. Existing private configuration is preserved; explicitly select its absolute .models/stt-small path and restart. Default remains base.

GLM's default mandatory reasoning exhausted 160 tokens in a real rehearsal. Low effort and 512 tokens passed. Consult [OpenRouter reasoning controls](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens) and the chosen model's supported efforts. Reasoning text is excluded and never forwarded; budget exhaustion fails without retry. Checked conversational text remains ≤600 characters with the existing question policy.

~~~sh
# Isolated TLS/WSS with fixture engines/model and simulated playback:
bun scripts/speech-gateway-smoke.ts
# Fixed fictional input, actual configured providers, new isolated gateway (not deployment):
bun --env-file=.env --env-file=services/local-speech/.env scripts/speech-gateway-smoke.ts --live-llm --live-speech
# Optional repeated-input endurance run, at most 20 turns:
bun --env-file=.env --env-file=services/local-speech/.env scripts/speech-gateway-smoke.ts --live-llm --live-speech --turns 20
# Keyword probes; a failure is quality evidence, never hidden:
bun --env-file=services/local-speech/.env scripts/speech-quality.ts
bun --env-file=services/local-speech/.env scripts/speech-quality.ts --fixture garden --repeat 3
~~~

Live flags are explicit and incur normal provider usage. The harness sends one text greeting then the chosen number of identical synthetic voice turns, with pause/resume every five turns. Playback is simulated consumption, not proof of speaker output. Input is generated/resampled only in RAM; reports contain numeric timings and bounded metadata, not dialogue/audio/credentials/reasoning. Optional private LEMMI_COMPARISON_STT_URL enables a same-waveform comparison. No production pairing/session/database is touched.

## Capability and wire sequence

Use existing WSS domain-key + paired Bearer authentication. Never put caregiver/LLM/private-speech credentials on a device or in browser source. Existing protocol v1 envelope still requires fresh event_id and increasing sequence in each direction. Non-media commands use turn_id:null; media/receipts use the granted turn. Reconnect never restores capture/output or uploads a backlog.

Hello payload:

~~~json
{"firmwareVersion":"your-version","cameraSupported":false,"pettingSupported":false,"audio":{"encoding":"pcm_s16le","sampleRate":16000,"channels":1,"frameMs":20},"playback":{"encoding":"pcm_s16le","channels":1,"sampleRates":[22050]}}
~~~

Allowed playback rates: 16000, 22050, 24000, 44100, 48000. Advertise only measured support. Piper currently outputs **22050 Hz**; there is no production output resampler. An unsupported native TTS rate fails. Legacy hello without playback, or disabled gateway speech, returns audio:false and cannot capture.

Enabled device.ready.audio is:

~~~json
{"encoding":"pcm_s16le","sampleRate":16000,"channels":1,"frameMs":20,"maxCaptureMs":20000,"playback":{"encoding":"pcm_s16le","channels":1,"sampleRates":[22050]},"outputWindowChunks":4}
~~~

1. Explicit input.start creates a muted/capture-off session. input.mute {muted:false} clears mute; it never opens capture.
2. input.speak {language:"en"} with current session/generation and null turn ID requests one turn. Only ready/waiting, unmuted, idle endpoints qualify. Current live activity/camera execution remains unavailable.
3. Wait for state.changed: phase listening and current captureGrant. Example shape (IDs/time illustrative):

~~~json
{"turnId":"server-turn","generation":0,"leaseId":"current-lease","streamId":"server-input-stream","language":"en","expiresAt":"2030-01-01T00:00:20.000Z"}
~~~

Capture requires that grant, current local permissions and the listening indicator. Independently enforce local Stop/mute/watchdog/deadline. Server acknowledgment never undoes local cancellation.

4. audio.chunk uses envelope turn_id from the grant; payload {leaseId,streamId,chunkIndex,encoding:"pcm_s16le",data}. Each frame is exactly **640 raw bytes / 320 samples / 16 kHz mono signed int16 little-endian / 20 ms**; canonical base64 length 856. chunkIndex begins at zero and is contiguous within a stream, separate from envelope sequence. It remains optional in older schema fixtures, but is required on the negotiated live audio path.
5. End using audio.end {leaseId,streamId,chunkCount} with the same turn. Count must equal accepted frames (1–1000). Do not use the older unimplemented session.command turn_end placeholder. Capture permission clears, state becomes processing, and at most 640,000 input bytes remain in RAM. Gaps/overflow/backlog/expiry cancel, without truncation or silent retry.
6. Checked response.text matches TTS input. response.start describes the output stream (illustrative two-frame response):

~~~json
{"turnId":"server-turn","leaseId":"current-lease","streamId":"server-output-stream","encoding":"pcm_s16le","channels":1,"sampleRate":22050,"chunkBytes":882,"chunkCount":2,"byteLength":1764}
~~~

Server audio.chunk carries {leaseId,streamId,chunkIndex,encoding,data} and the turn ID. Output chunks are approximately 20 ms, final chunk may be shorter and always has an even sample count. Metadata must agree; maximum output is 30 seconds. Server audio.end {leaseId,streamId,chunkCount} means sending finished, **not playback complete**.

7. Client audio.receipt {leaseId,streamId,status,playedChunks} is bound to output/current session/generation/turn. Status: started/progress/completed/failed. Started requires actual local start and count 0; progress is cumulative consumed chunks; completed requires all chunks and stream end. Do not report buffered bytes as played. Local failures use failed.

The server allows **four chunks ahead of consumed receipts**. Send progress at least every four chunks. If the final bytes finish playing before audio.end arrives, send completion once both conditions hold. Ordinary queued output remains processing; only its started receipt sets speaking. Fixed concern/refusal output stays paused as described below. Missing started expires after five seconds; playback expires after its duration plus five seconds. Ordinary completion/failure returns capture-off waiting; fixed concern/refusal completion/failure stays paused. Receipts do not grant another turn and are authenticated endpoint reports, not independent hardware proof.

## Fixed concern/refusal output after pause

The review found recognized urgent speech returned fixed text without TTS. The fix cancels the input turn, pauses/increments generation, then issues fresh output authority for the application-owned fixed reply. The gateway publishes the paused generation before synthesis finishes. `response.text.source` is `fixed`; its new turn ID matches `response.start` and the subsequent audio. Use the new generation/turn/stream for receipts, never the original capture IDs. No wire schema or endpoint was added.

**Emilia/Kylie:** the session stays `paused`, with capture off, during this one authorized fixed output. Allow playback only after matching the fixed text and output metadata at the current generation/lease, subject to local controls. A paused snapshot alone cannot authorize audio; ordinary speech must remain canceled. Represent actual fixed playback independently from the paused interaction state. Completion, failed receipts, timeout and mute during synthesis do not resume the session. New Pause/Stop/help, disconnect/revoke, profile/context changes, handoff and explicit Resume cancel fixed output. Pending-synthesis mute cancels; mute after output approval preserves its normal behavior. The original inference deadline remains in force.

Backend fixtures cover urgent/unwell/refusal output, obsolete capture IDs, pending and approved output interruption, late adapter results, failures and receipt expiry. Gateway tests cover the paused-generation notification, fixed PCM/receipt completion, Stop while synthesis is pending and Pause during approved output. Physical device/UI behavior still requires counterpart review and hardware testing. Contact is still unconfigured; the fixed urgent text states that limitation and never claims a notification was sent.

## Cancellation, limits and privacy

- Mic mute cancels pending capture/STT/model/TTS while preserving already-approved queued/playing output. Repeated unmute during capture cancels that capture. Unmute never restarts capture/output.
- Pause/Stop/help/disconnect/revoke/context changes cancel. state.changed is authoritative; response.cancel {leaseId,streamId,reason:"interrupted"} also flushes a specific output stream. Local Stop/pause/watchdog must flush before server acknowledgment. Late input/receipts/results cannot resume interrupted work.
- A single 20-second inference bound covers STT + model + TTS after end; adapters also bound their work. Late results are rejected even when an adapter ignores abort. Native-worker cancellation is best effort. Capture/output deadlines are separate.
- Gateway rate windows/watchdogs and speech duration deadlines use monotonic elapsed time; a UTC clock correction must not extend a rate window or falsely expire a turn. Credential/provider expiry still uses UTC.
- Messages remain ≤4 KiB. Capture/control limits are separate: 60 capture frames and 30 other messages per one-second window, 90 total. A frame-time bound allows at most one second ahead of elapsed capture time. One active turn/output; no inference queue.
- Owned PCM is wiped after recognition/cancellation and output completion/cancellation/failure. Python/native/IPC/JS transient copies are not a secure-erasure guarantee. PCM, dialogue and generated audio never enter files/private media/jobs/journal. Existing factual/checkpoint storage stays separate.
- Exact reviewed Stop/help/refusal routes precede generation; polite Stop/Pause and curly apostrophes are handled. Phrase recognition can miss/misinterpret speech. Clinical/bereavement/uncertainty safeguards remain prompt-guided, not semantic guarantees. Manual help bypasses models and honestly reports unconfigured contact.

Shared fixtures from @lemmi/contracts/fixtures: speechCaptureSessionFixture, speechDeviceEventFixtures, speechServerEventFixtures. They contain generated silence, fictional IDs and no credential. Import runtime schemas; update both consumers together.

## Morning handoff

**Emilia:** review native sample rate/window/end/receipt shapes; accumulate mic buffers into exact 320-sample frames; enforce local capture indicator, independent Stop/mute/watchdog and bounded speaker queue. Measure PCM byte order/rate, honest receipts, underruns, flush on cancel/disconnect and no auto-capture after playback/reconnect.

**Kylie:** browser-specific authenticated transport/UI, permissions and autoplay remain pending. Reuse this coordinator/protocol after that seam exists; no embedded device/admin/provider secrets or second session store. Show listening/processing/speaking/waiting/error and matching text; physical playback requires user activation and truthful receipts.

**Anay:** target-host/network/human quality and cancellation rehearsal, then explicit review/merge/deploy. German, incremental STT/silence end, complete activities/contact/camera/policy and counterpart acceptance remain separate. See [build-plan observations](../build-and-demo-plan.md) for measured evidence and failures.

## Verification checkpoint

109 Bun tests / 2,107 expectations and seven Python tests passed, with type/Svelte, build, formatting, control/chat and PostgreSQL production smokes. A real 20-turn synthetic WSS endurance run passed after fixing a reproduced backward-wall-clock rate-limit bug; native input/speaker were not used. Median warm stages were STT 421.5 ms / LLM 879.5 ms / TTS 184.5 ms. GLM used low reasoning/512 tokens. [Full observations and failures](../build-and-demo-plan.md#observed-speech-pipeline-feature--november-14-2026), [numeric timing artifact](../verification/speech-pipeline-2026-11-14.json). Final actual idle-worker shutdown exited 0 without a semaphore warning; this task's local speech/database services are stopped.

### Concern-response fix verification

The follow-up on this branch passes **116 Bun tests / 2,438 expectations**, seven Python boundary tests, type/Svelte check, build, formatting and production data/control/chat fixture smokes. Combined with the reviewed media-schema branch, **122 tests / 2,480 expectations** pass on isolated PostgreSQL 17. A six-second fixture PCM output and three synthetic real-local-engine CPU turns passed verified WSS with simulated playback; the LLM was a fixture. The urgent output/cancellation cases themselves are covered by coordinator and gateway fixtures, not physical hardware. No production services/configuration, microphone, speaker, real notification or external LLM request was used. Counterpart review and physical acceptance remain pending before enabling deployed voice.
