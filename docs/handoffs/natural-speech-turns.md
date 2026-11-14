# Automatic browser turn ending and speech diagnostics

Feature branch `anay/natural-speech-turns`, based on frontend/backend integration `a7d5528`. Isolated worktree: `/tmp/lemmi-natural-speech-turns`. Undeployed; the shared checkout and running backend configuration are unchanged.

## Behavior

After explicit Speak now and the existing server grant, the browser feeds its 16 kHz mono PCM16 frames into a local WebRTC detector (`@echogarden/fvad-wasm` 0.2.0, normal mode). Vite bundles the pinned 20,560-byte WASM as a same-origin asset. No CDN, external speech API, transcript analysis, continuous listening or extra capture authority is introduced. The BSD license accompanies the artifact at `apps/web/static/licenses/webrtc-vad.txt`.

Five voiced 20 ms frames in a 200 ms window establish speech, rejecting isolated clicks while allowing short answers. Four seconds of subsequent non-speech completes the existing `audio.end` turn; any later voiced frame resets that pause. This does not establish that a thought is complete, identify a speaker or infer a condition. Background voices/music and very soft speech can produce mistakes. Rehearsal on the actual microphone/room remains necessary.

Finish speaking remains available. Detector loading failure/timeout (three seconds) or a runtime detection error shows a manual-finish message. Late initialization is disposed after timeout/cancellation. Automatic ending can be disabled. No automatic next turn is added.

Fifteen seconds without established speech closes capture and uses existing `input.pause`, with a visible invitation to Resume. Silence is not submitted for recognition/model generation. This candidate uses **paused**, rather than the specification's target **waiting**, to reuse the existing cancellation contract without a new wire action or automatic continuation. Resume and Speak now remain explicit. No spoken prompt loop is added. Whole-turn recognition and the server's 20-second capture cap remain; the client closes at 19.5 seconds/975 frames. Sustained speech at that cap still requires another explicit turn, as on the preceding baseline; long-utterance streaming remains pending.

Cancellation disposes detection, timers, tracks and owned sample/scratch buffers. Profile/privacy/policy/generation/stream/owner changes retire capture; old queued callbacks cannot transmit into a later turn. Stop/mute/pause/handoff/reconnect retain their existing rules. Capture remains off during playback; unmute never grants capture. Quiet retains capture-off waiting after playback. Firmware endpointing is unchanged and needs Emilia's implementation/review.

## Configuration and measurements

Set public values in the **web process environment** before startup. `apps/web/src/env.ts` declares/validates only these three public values using SvelteKit 3's `$app/env/public`; no private values are exported. Set gateway diagnostics in the gateway process environment. Editing `.env.example` does not configure a running service.

| Setting | Default | Meaning |
| --- | --- | --- |
| `PUBLIC_LEMMI_AUTO_TURN_END` | `1` | `0` retains manual Finish speaking only |
| `PUBLIC_LEMMI_END_SILENCE_MS` | `4000` | Integer 1500–8000 ms after speech; trial setting, not validated for dementia |
| `PUBLIC_LEMMI_SPEECH_DIAGNOSTICS` | `0` | Opt-in browser console timings |
| `LEMMI_SPEECH_DIAGNOSTICS` | `0` | Opt-in gateway console timings in live speech mode |

Browser records contain only `stage`, `durationMs` and optional enum `reason` (`manual`, `silence`, `limit`). Stages: `capture`, `turn_end_to_scheduled_playback`, `playback_gap`. Scheduled playback includes browser scheduling lead, **not physical speaker proof**. Gaps measure chunks arriving after scheduled audio runs out. The four-chunk playback window remains unchanged; measure before tuning it.

Backend records contain only `stage`/`durationMs`: `stt`, `reply`, `tts`, `turn_end_to_playback_receipt`. Reply includes existing routing/policy/model calls; speech durations include scheduler waits. The total starts at accepted `audio.end` and ends at an authenticated started receipt, excluding listening/silence. Receipts are endpoint reports, not hardware verification. Do not add stage durations to the total: they overlap. Approved prompts have TTS timing without an input-turn total. Fixed replies preserve original submission time across fresh output authority.

Internal optional `SpeechAdapters.onTiming` propagates through the shared scheduler; observer exceptions are contained. No HTTP/WSS event/schema, authorization or database change. Diagnostics default off; these observers log no text, PCM, transcript, profile/session/device/turn ID, path, prompt or credential. Enabled console/host logging may retain numeric records under host policy. Buffers/classifier state are transient; cleanup is not a secure-erasure guarantee for browser/WASM/native/OS copies.

The TTS engine/voice is unchanged. Next voice-quality work is listening to identical fictional phrases with alternative Piper voices/pacing, then trying another local engine if useful. This implementation improves turn timing; it does not establish improved voice timbre or clinical suitability.

## Verification and handoff

Tests cover thinking pauses/resumed speech, short/no speech, transient noise, exact chunk counts, manual controls, detector startup/runtime failure, late initialization, capture bounds, context/owner cancellation, stale callbacks, content-free durations and observer exceptions. A real WASM silence/lifecycle smoke is separate from injected classification fixtures.

Headless Chromium 141 loaded real Vite-served JS/WASM and exercised BrowserAudio through real Web Audio with an in-memory fixed Piper phrase and fixture session authority. Capture stayed disabled before the grant, ended once through silence with matching counts (309 frames in that run), and closed the track. No detection errors or external browser requests. Audio stayed in pipes/browser memory; no audio files or real microphone. This is synthetic browser acceptance, not physical microphone/speaker, room noise, live provider, full keyboard flow or subjective voice-quality acceptance.

Final pinned-Bun regression: **189 passed, 33 database checks skipped, 0 failed / 4,090 expectations** with the caregiver PKCE case excluded. The full attempt encountered its existing fixed-port dependency (127.0.0.1:3333 is occupied by an SSH tunnel); the tunnel was untouched. Database checks were not enabled for this speech-only change. Frozen install, type/Svelte check and production build passed. See the build plan for exact scope and retries.

Before merge: Kylie reviews actual listening/fallback/paused UX; Anay reviews timing/configuration/cancellation; Emilia reviews firmware and actual robot limits. Trial pauses with fictional voluntary team speech on the intended microphone. Do not infer support presets, preferences, diagnosis or ability from pauses. No deployment or merge is performed here.
