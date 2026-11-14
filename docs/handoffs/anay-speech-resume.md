# Resume Anay's speech/chat work after account switch

**Resume checkpoint:** the account-switch pause was lifted and the remaining adapter/coordinator review, documentation and checks were completed locally. Use [the current speech/chat handoff](anay-speech-chat.md) and [Ubuntu setup guide](../../services/local-speech/README.md) for the implemented state. **Update:** the user has now authorized creating/pushing `backend-deploy` without switching the shared checkout. See [deployment guide](../backend-deploy.md); the original Git pause below is historical. Current observed results are 70 Bun tests, 7 Python boundary tests, type/Svelte check, production build, formatting, certificate-verified production text-chat smoke with a fixture OpenRouter response, and a repeated real CPU English TTS→STT smoke (187 ms / 507 ms in one synthetic run). Browser server-only symbol and no-audio-artifact checks passed. The owned local speech service was stopped after verification. Original pause notes below are historical and their “not run yet” items are superseded by this checkpoint/build-plan evidence. Next dependencies: privately configured OpenRouter model/key, approved microphone-turn/device transport and actual playback. No real LLM/robot/German/NVIDIA acceptance is claimed.

**User-requested pause, November 13, 2026.** Continue from the current working files; do not recreate the scaffold, reinstall everything or overwrite the other agent's activity changes. The user wants to switch ChatGPT/Codex accounts, then resume this implementation.

## Start here and current restrictions

1. Read `AGENTS.md`, `docs/team-start.md`, `docs/integration-contracts.md`, `docs/anay_tasks.md`, this file, and `docs/handoffs/anay-activity-contracts.md`.
2. **Historical pause, superseded for the authorized `backend-deploy` publication (do not switch the shared branch):** another agent is switching branches/pushing. Do not run `git status`, fetch/pull, branch/worktree commands, commits, pushes or any other Git command until the user lifts that restriction. No Git commands were used during this speech implementation after that request. The last known branch was `anay/device-control-foundation`; do not assume another agent has left it unchanged.
3. Another Anay agent handled **A01–A04**. Their activity schemas/fixtures/validation/consumer compatibility and handoff are already in this shared filesystem. Preserve them. Their latest task-board status says complete locally, 51 checks/tests/build/format/web smoke passed, uncommitted at that observation; they may since have switched/pushed.
4. This conversation owns speech/chat (**A09–A17, A39–A41**) and has new files plus changes to the coordinator, device protocol, gateway and harness. **The user explicitly approved taking ownership of `session-coordinator.ts` after the other agent finished its compatibility edits.** Their complete-local status was observed before our coordinator edits began. Do not revert the activity compatibility changes already in that file.
5. The local speech service started by this session was stopped with Ctrl+C at this pause. Its owned tool session was `10513`; it exited with code 0. Test processes have finished. Do not assume a speech service remains running.
6. Telegram is opt-in only. Earlier requested notifications were already sent for earlier completed tasks. This pause did not request another Telegram message. Do not notify by default.

## User decisions / hardware

- First target is **this Framework WSL Ubuntu 22.04.5 LTS, x86_64, Python 3.10.12**, CPU baseline. Framework CPU is AMD Ryzen AI 7 350 / Radeon 860M. GPU/NPU acceleration has not been tested here.
- Separate NVIDIA server reported by user: Ubuntu 22.04.5, x86_64, Python 3.10.12, Intel i9, 32 GB RAM, NVIDIA RTX 2000 Ada with **16,380 MiB VRAM**, driver **580.178.04**, `nvidia-smi` CUDA label **13.0**. No code has run on that server. The driver label is not proof of installed inference CUDA/cuDNN libraries. A VM is another later host; its details are pending.
- MacBook Pro portability is desired later; architecture/RAM are not supplied. Keep engine/host/device choices configurable and report untested platforms honestly.
- **English first. German second/later demo** (A41). Preserve language in interfaces; no silent English substitution. No German TTS voice is provisioned yet.
- Local STT/TTS first, replaceable with other backends/online services later. Independent STT and TTS selection, explicit errors, no silent cloud fallback or automatic mid-turn engine switch.
- External LLM starts with **OpenRouter**. `.env.example` has `OPENROUTER_API_KEY` and `OPENROUTER_MODEL`; the user still needs to supply the exact model and put the key privately in root `.env`/host configuration. **No live OpenRouter call has been made.** Root `.env` was absent when checked; never print keys to verify configuration.
- Future ChatGPT sign-in for LLM access is an investigation, not an implemented/assumed supported authentication flow.
- LAN testing first. Public DNS/domain can wait, while device pairing and TLS verification remain required.
- Emilia's proposed mic transport is `pcm_s16le`, 16 kHz mono, 20 ms = 320 samples / 640 raw bytes, base64 JSON `audio.chunk` with lease/stream IDs. **Not verified end to end.** Her offline mic experiment uses transient 256-sample buffers at 16 kHz and sends no network audio. This slice still grants no microphone capture and implements no robot audio ingestion/playback.

## Implemented in this slice (working files; not committed/pushed by this session)

### Local service and adapters

New `services/local-speech/`:

- `server.py`: private `127.0.0.1:8765` authenticated HTTP engine wrapper, not another session backend. `/health`, `POST /v1/stt` (raw bounded 16 kHz mono PCM + language/request-ID headers), `POST /v1/tts` (bounded text/language JSON → PCM + format headers), `/v1/cancel` by UUID.
- One active inference job; max 8 request threads; 20-second job bound; warm engines in a separate spawn worker. Cancellation kills in-flight worker and a later explicit request can reload. No queued replay or runtime model download. Origin/query requests are rejected; token required. Request/model/audio/transcript logs are suppressed and errors are sanitized.
- STT engine: **faster-whisper 1.2.1**, multilingual `base` weights, CPU `int8`, four threads. Engine/device/compute settings explicit; no automatic CPU fallback if CUDA is requested and fails.
- TTS engine: **Piper 1.8.0**, `en_US-ljspeech-medium`, CPU, native output **22,050 Hz mono int16**. STT consumes **16,000 Hz**. Do not pretend these output/input formats are equal; the smoke resamples only in memory as a diagnostic. Actual device output format/streaming is still to agree.
- STT/TTS engines can independently be selected or `disabled`. **Only faster-whisper and Piper are currently concrete engine implementations.** The interfaces/endpoint selection support adding others; do not claim alternative STT/TTS engines were implemented or benchmarked.
- `requirements.in` pins direct dependencies; `requirements.lock` is hash-pinned Python 3.10 resolution (31 packages). Not a Bun lockfile change. Local `.venv/` is already installed and ignored.
- `assets.json` pins exact model/voice revisions, sizes, weight SHA-256 and source/permission notes. `prepare_models.py --configure` explicitly downloads model assets, verifies them, and creates private service `.env` only if absent. No automatic download during inference. The initial STT list needed `vocabulary.txt`; that was added and downloaded successfully.
- Model assets are already in ignored `.models/` (~201 MiB plus support files), not microphone recordings or generated speech files. STT revision `ebe41f70d5b6dfa9166e2c581c45c9c0cfc57b66`; voice repo revision `6b9cfaacb4fb2e02a9621227e3c1a48bec9710c3`.
- `.env.example` is public template; **`services/local-speech/.env` is ignored, mode 0600, contains a generated independent token and absolute local model paths. Never print/copy its token into the handoff, logs or Git.**
- `test_server.py`: six stdlib unittest boundary tests with an explicitly fake engine.
- Nested `.gitignore` excludes `.venv`, `.models`, `.env`, Python caches.
- **`services/local-speech/README.md` is not written yet.** Root `.env.example` already links to that future path; finish the documentation before completion.

New server-only `packages/server/src/adapters/`:

- `types.ts`: STT/TTS/chat interfaces, `en | de`, bounded I/O/read helpers. STT max 20 seconds / 640,000 PCM bytes; TTS max 30 seconds at allowed sample rate; cancellation is explicit.
- `local-speech.ts`: independently configurable `local-http | disabled` STT/TTS adapters, separate URLs, shared private speech token, bounded response validation, best-effort `/v1/cancel` on abort and rejection of late results. Plain HTTP allowed only for loopback, otherwise HTTPS; redirects forbidden.
- `openrouter.ts`: explicit model/key config; fixed OpenRouter HTTPS chat-completions endpoint; one attempt, no retry/mock fallback/tools; bounded history/response/token/timeouts; `provider: {data_collection:'deny', zdr:true, allow_fallbacks:false}`; sanitizes provider failures and rejects late/partial/tool/oversized/unsupported responses.
- `companion-prompt.ts`: minimum approved context, requested English/German, adult respectful responses, support preset instructions, grounding/sensitive/clinical/help boundaries. No contacts/private guidance/journal/credentials sent to model.
- `input-routing.ts`: small exact English/German fixed phrase router for Stop/pause/help, incomplete need, nonspecific unwell/urgent examples and most recently topic refusal. Not reliable emergency detection or complete multilingual coverage. German clinical/control wording still needs review.

New scripts:

- `scripts/local-speech.ts`: Bun loads selected `.env`; launches service Python with only speech/runtime environment variables, **not OpenRouter credentials**.
- `scripts/speech-smoke.ts`: a fixed English synthetic TTS → in-memory linear resampling → STT check. Prints timing/format/pass metadata only, no transcript/audio. No mic, robot, LLM or audio files.

### Coordinator/gateway text conversation

- New `packages/contracts/src/conversation.ts`: `ConversationTextCommandSchema`, reply/result schemas/types. Exported by shared contract index. Text is bound to session/current generation, command ID and `en | de`; no client model/tools.
- `packages/contracts/src/device.ts`: adds `input.text`, `response.text`, optional ready `textChat` flag and recognized `text` control. Existing `audio:false`, camera unavailable and capture-off behavior remain; no microphone grant/stream ingestion is enabled.
- `packages/server/src/session-coordinator.ts`: constructor can take `ChatAdapter`, async `submitText` under the **existing** authority; processing → capture-off waiting after response. Bounded transient dialogue (last 6 messages), command fingerprints/receipts, one pending turn, duplicate provider-call prevention and last-turn replay. Raw text does not enter generic persistent command cache/journal. Stop/pause/mute/disconnect/handoff/revoke abort pending turn, clear transient dialogue/results and reject late completion even if provider ignores abort. Fixed help/control/concern handling bypasses LLM; real help remains explicitly unconfigured, no fake sends.
- `apps/realtime/src/control.ts`: injects chat adapter, handles async text without awaiting in control loop; heartbeat/Stop stay responsive; deduplicates per-socket reply emission and checks scope/current generation/revisions/lease before emitting model text. Fixed concern text may accompany the corresponding paused snapshot, but obsolete/end-session replies are rejected.
- `apps/realtime/src/index.ts`: configures OpenRouter only when server key/model config is valid. Mock mode never calls the provider. Existing live startup still requires its scoped pairing/TLS control config.
- `packages/server/src/index.ts`: exports adapter factories/config/types (server-only).
- `scripts/control-device.ts`: `chat <text>` in authenticated computer harness, `LEMMI_CHAT_LANGUAGE=en|de`, renders `response.text` as interactive participant output. This is intentionally visible output, not server/debug logs; use fictional text and do not redirect conversations to log files.
- Root `.env.example`: actual OpenRouter text-chat settings plus language/timeout/token bounds and pointer to service config. Backend text input is separate from mic mute, but muting cancels a pending input-derived response; no unrelated approved playback implementation is added.

## Observed checks so far

- Pinned Bun executable available at:

  `/home/chaos/.npm/_npx/9ec17c29a94a501f/node_modules/@oven/bun-linux-x64/bin/bun`

  It reports **1.4.4**. Global Bun was 1.3.11 earlier; use the pinned binary/PATH. Dependencies are installed. Inspect, don't recreate lockfiles.
- Python local `.venv` is **3.10.12**. `uv` initially selected 3.14 when passed the ambiguous `python3`; it was corrected using `/usr/bin/python3.10`. Installed: faster-whisper 1.2.1, Piper 1.8.0, numpy 2.2.6, CTranslate2 4.9.0, onnxruntime 1.23.2 and pinned transitive dependencies. Hash-locked installation succeeded.
- Model files downloaded/verified; direct CPU loading of both engines succeeded.
- Real local-model synthetic English smoke **passed**. First observed single warm-ish result: **130 ms TTS**, **443 ms STT**, source 22,050 Hz, STT input 69,844 bytes after resampling. Phrase was recognized (garden keyword); transcript wasn't printed, audio wasn't saved. This is one synthetic run, **not** human/microphone/quality validation, cold-start measurement or the required 20-turn benchmark.
- `python3 -m unittest discover -s services/local-speech -p 'test_*.py' -v`: **6 passed**, fixture engine, including credential/origin/query rejection, PCM bounds, no implicit German fallback, request logs absent, cancellation killing worker and no inference queue.
- Type/Svelte check passed after fixing adapter fetch types (`Fetcher`, not `typeof fetch`), explicit `ArrayBuffer` HTTP body, and adding `export {}` to the launcher. This was before the last WebSocket integration test / most recent small routing edits; rerun final check.
- Full Bun suite most recently **67 passed, 0 failed, 647 expectations across 9 files**, including the other agent's activity changes, nine adapter tests, six conversation tests and a new authenticated WebSocket text/dedup/heartbeat/Stop test. **Immediately after that full pass**, a small change added exact topic-refusal routing and a structured-clone return; that final change has not been rechecked yet.
- **No final build, formatting pass, updated production control smoke, browser bundle inspection, real OpenRouter test, microphone/Stackchan test or final documentation/handoff acceptance has been run for this complete slice. Do not claim them passed.**

## Commands to resume (no Git)

From `/home/chaos/projects/Lemmi`, use the pinned Bun above (or put its containing directory first in PATH).

```sh
# Dependencies/models already exist locally. On a different machine provision deliberately:
# uv venv --python /usr/bin/python3.10 services/local-speech/.venv
# uv pip sync --python services/local-speech/.venv/bin/python --require-hashes services/local-speech/requirements.lock
# python3 services/local-speech/prepare_models.py --configure

# Terminal 1: local service; model warmup then listens ONLY on loopback.
bun --env-file=services/local-speech/.env scripts/local-speech.ts

# Terminal 2: real synthetic English loopback (no OpenRouter needed).
bun --env-file=services/local-speech/.env scripts/speech-smoke.ts

python3 -m unittest discover -s services/local-speech -p 'test_*.py' -v
bun test tests/speech-adapters.test.ts tests/conversation.test.ts
bun run check
bun run test
bun run build
bun run smoke:control
```

Sandbox network access is restricted. HTTP/WebSocket/loopback socket creation fails with `PermissionError: Operation not permitted` inside the sandbox. Dependency/model downloads and tests/services needing sockets were run with **require_escalated** after observing the restrictions. Request the appropriate tool escalation; do not disable security or expose services to work around the sandbox. No system Python packages, driver or CUDA libraries were installed.

## Next work, in order

1. After the user resumes, confirm the other agent is finished with coordinator/device/server exports; preserve the combined working files. **Keep Git paused** unless explicitly released.
2. Review the last routing/coordinator edits; add/update tests for topic refusal and run targeted/full checks. Check untrusted-value validation, cancellation races, retry behavior, raw content lifetime and output freshness. In particular inspect the just-edited fixed-reply structuredClone return and whether concurrent asynchronous results can emit after Stop/pause.
3. Format **only owned new/changed files**, not the other agent's unrelated files. The new speech Python files have not gone through a formatter. Run type/check/build. `bun run format` would touch everyone's files; prefer targeted Prettier paths while collaboration is active.
4. Write `services/local-speech/README.md` with exact setup/run/config/API/cancellation/limits, privacy/buffer/temp/log inventory, source/license notes, CPU/NVIDIA instructions and realistic platform matrix. OpenRouter routing does **not** guarantee universal deletion: account/guardrail Safety Retention choices, implicit caching and provider/legal exceptions still apply. See official sources below. No raw audio/transcript logging.
5. Write the final speech/chat interface handoff for Emilia/Kylie, add accurate README/team-start/integration/build-plan notes and update Anay checklist progress without marking unfinished hardware/provider work done. These shared docs were also edited by the activity agent; preserve their text. Checklist currently still says this session is planning and has stale missing-hardware inputs; update on resume.
6. Repeat the real local smoke after restarting the service with the final code; inspect no generated-audio/transcript files were created. Do a meaningful small warm/cold timing check if needed; don't inflate one synthetic run into a quality/latency claim.
7. Run authenticated production control smoke and any new text-chat production smoke with fixture LLM only. Verify server-only model keys/modules stay out of browser output. Root `.env` must remain private; no real OpenRouter request until user configures a chosen model/key.
8. A12/A13/A15 remain later: actual mic grants/ingestion and STT→chat→TTS/playback through the device need agreed protocol and hardware measurements. Current service/adapters prove model readiness; don't add another session backend, bypass capture consent, or pretend standalone synthetic speech is a robot round trip.
9. Only when Git restriction is lifted: inspect actual current branch/worktree, stage **this slice only** without collecting the other agent's changes/secrets/model assets, and commit/push if still authorized. Do not do this during the account-switch pause.

## Helpful primary references already consulted

- OpenRouter chat API: https://openrouter.ai/docs/api/api-reference/chat/create-a-chat-completion
- OpenRouter provider routing: https://openrouter.ai/docs/guides/routing/provider-selection
- ZDR/retention/account Safety Retention choices: https://openrouter.ai/docs/guides/features/zdr
- faster-whisper: https://github.com/SYSTRAN/faster-whisper (numpy/in-memory transcription, CPU/CUDA setup)
- Piper Python API: https://github.com/OHF-Voice/piper1-gpl/blob/main/docs/API_PYTHON.md
- Piper in-memory `PiperVoice.synthesize` / AudioChunk: inspected installed 1.8.0 and https://github.com/OHF-Voice/piper1-gpl/blob/main/src/piper/voice.py
- Pinned voice model card is downloaded under ignored `.models/tts/MODEL_CARD`; it identifies LJ Speech dataset as public domain. Keep engine/voice licensing/source metadata; no claim of universal distribution/compliance approval.

Suggested first prompt after the account switch:

> Resume Anay's speech/chat implementation from docs/handoffs/anay-speech-resume.md. Keep all Git commands paused until I say otherwise, preserve the other agent's activity-contract work, finish the remaining review/docs/checks, and continue using Framework WSL CPU as the first test host. English first; OpenRouter model/key are still to be configured privately.
