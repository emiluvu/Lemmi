# Browser noise endpointing

November 15, 2026. **Prepared source candidate; not deployed.** Current public
web/gateway/local speech remains `ea66280`. This handoff must be updated with the
actual tested source/release, service restart and acceptance before rollout is
called complete.

## Reproduced problem

The user reports a 20–30 second wait while the browser still shows Listening.
Current WebRTC normal-mode classification continually labels some steady noise
as voice and resets the silence timer. A real public Chromium synthetic probe
with 120 Hz hum (peak 0.03) still needed manual Finish eight seconds after the
utterance ended; response start then took 3,130 ms. A clean control submitted
1,425 ms after speech ended and received response start in 2,088 ms. One-at-a-time
local engine probes measured recognition 363 ms and synthesis 99 ms. This
reproduces an endpointing bottleneck, not the user's exact acoustic environment.

## Candidate behavior and boundaries

- Pin `@ricky0123/vad-web` 0.0.31 for the Silero v5 model and `onnxruntime-web`
  1.31.1 for browser-local single-threaded WASM inference. Lazy model/runtime
  assets are emitted under existing same-origin application asset paths. No CDN
  audio upload or additional speech service is introduced.
- Model input is 512 new 16 kHz mono samples plus 64 samples of context. Speech
  probability uses 0.5 onset/0.35 continuation hysteresis. A maximum of eight
  waiting model frames bounds queued PCM to 256 ms. Unknown/backlogged classifications do not advance endpointing; queue pressure
  cannot count as speech.
- Each turn owns its inference session, PCM, context and recurrent state. Destroy
  clears owned buffers and discards late results. Assets may be cached; user
  audio/transcripts are not persisted. Runtime/native copies are not a guarantee
  of secure RAM erasure.
- Request browser `noiseSuppression: true`. It is a browser capability request,
  not proof of device noise removal. Keep 1,500 ms post-speech silence and existing
  30-second no-speech/39.5-second browser capture bounds. Startup has a ten-second
  detector deadline before capture authorization; errors/overload retain explicit
  manual Finish speaking. Stop/mute/pause and grants retain authority.
- No backend speech API, database migration, external provider, notification,
  profile, credential or firmware change is required. Dependencies and Bun lockfile
  change; use Bun 1.4.4 and frozen installation for release verification.

## Observed checks

Candidate Chromium classified speech and ended the turn 1,278–1,298 ms after the
generated utterance ended in eight cases: hum peak 0.03/0.1, broadband peak
0.03/0.1, voice-band noise peak 0.03, clean speech at 0.1 scale, and speech at
0.25 scale with 0.01 hum/broadband noise. Inputs were generated in RAM. These
levels are not calibrated room measurements and do not establish every microphone,
accent, quiet voice or noisy venue. Host gate: 501 tests / 12,788 expectations passed without skips/failures on five
disposable databases; final buffer-clearing regression separately passed four
tests/22 assertions. Type/build/format and production HTTPS/WSS/private-media smoke
passed. Final candidate production Chromium with hum submitted automatically after
1,386 ms; cold Start-to-Listening was 869 ms. Model/runtime/WASM loaded same-origin
with 200 responses. Continuation, mute, Stop and zero overlap/runtime errors passed.
Public deployed acceptance remains pending.

The current manual workaround is tapping **Listening — tap to finish speaking**.
Nearby competing speech can still be detected as speech; this feature does not
identify or isolate a target speaker. Keep human/room rehearsal and actual K151
controls separate from software observations.

## Deployment handoff

After source review and applicable checks pass, use the host's protected backup
procedure, install the verified production build and restart web only if no server
changes are added. Preserve gateway, speech, tunnel, database, private configuration,
existing profile/asset records and credentials. Verify public same-origin model/
WASM loading, fresh-gesture capture, noise ending, quiet speech, manual Finish,
Pause/Resume, Mute, Stop and failed detector behavior on a test-owned fictional
profile. Record actual outcomes and clean only the probe's own fixture. Roll back
the coordinated source/dependency/build subset if the feature gate fails.

## Sources and licenses

[Silero VAD](https://github.com/snakers4/silero-vad) supplies the MIT-licensed model;
[ONNX Runtime](https://github.com/microsoft/onnxruntime) is MIT-licensed, with
[official browser deployment requirements](https://onnxruntime.ai/docs/tutorials/web/deploy.html).
The model distribution package [vad-web](https://github.com/ricky0123/vad) is
ISC-licensed. Preserve upstream notices and pinned package/model provenance. These
licenses and upstream noise claims do not establish clinical or venue validation.
