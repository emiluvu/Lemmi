# Backend branch integration and rollout

Prepared on `anay/backend-integration-20261114` from deployed source `01b6ffb`; now installed as gateway/private speech `c594130` and web `12a1e47`.
Read the original handoffs on their respective branches before integration.

## Integrated source

1. `anay/natural-speech-turns` / `cb94309`: automatic open-conversation browser turn ending, numeric diagnostics, independent STT/TTS admission and native worker pools. Retained the newer twelve-frame browser credit, playback animation, live teaching UI, Photo Story and checkpoint recovery.
2. `codex/general-chat-handsfree` / `e628faf`: open conversation, bounded transient visible messages, private caregiver redirect configuration and thread reminders. Tested before adding decisions, with decisions disabled.
3. `codex/kylie-ui` / `43a6064`: caregiver appearance/settings and preview refinements. Retained the live route split, profile enrollment/creation, profile-safe panel, current navigation, controls and live conversation. Temporary images remain previews; no caregiver authentication or upload API was invented.
4. `codex/main-ui-alignment` / `a0a3797`: already an ancestor; no duplicate merge or presentation rollback.
5. `codex/conversation-decisions` / `f773cfa`: optional semantic adapter and evaluator. Runtime must remain disabled after the live evaluation below.

Applied migration checksums must remain unchanged. The only new migration is additive `005_conversation_redirects.sql`; apply without bootstrapping or reseeding. Rollback leaves its column and receipt intact.

## Observed isolated verification

- Pinned Bun 1.4.4 frozen installation passed. The lock adds only the branch's pinned local WebRTC WASM dependency.
- Speech/general-chat baseline: **298 tests, 5,085 expectations, zero failures/skips** across four dedicated disposable PostgreSQL databases. Type/Svelte and production build passed. Disabled-decisions production TLS/WSS chat smoke passed.
- Combined source: **311 tests, 5,189 expectations, zero failures/skips**; type/Svelte zero errors/warnings, production build, format and whitespace passed. Python speech tests: **13 passed**. The first sandbox Python run could not bind fixture sockets; the permitted rerun passed.
- Production participant/enrollment/concurrent endpoint/restart/scoped Photo Story, data/media/support, and TLS/WSS chat smokes passed with isolated databases and explicit providers/clients. Two long speech turns consumed 600 output chunks with simulated receipts.
- Native CPU STT and TTS cancellation each passed with real approved models: A's process stopped, B's distinct worker completed without replacement, and only a fresh explicit request reloaded A's slot. No audio files or transcript logging.
- Merging speech initially exposed one stale timing expectation. Corrected the test to the retained 80 ms scheduling lead (580 ms total and 100 ms gap); runtime buffering was preserved.

No human microphone, audible speaker, room-noise, K151 or complete accessibility acceptance follows from these tests. Counterpart visual/hardware review remains pending. Open conversation uses the new 1,500 ms WebRTC endpointing; the existing teaching voice surface retains its separate established amplitude endpointing and explicit listening lifecycle. Open-chat automatic next-turn listening and voice activity launch are not implemented.

## Actual host speech measurements

RTX 2000 Ada, **16,380 MiB VRAM**, driver **580.178.04**; Python 3.10, faster-whisper 1.2.1, CTranslate2 4.9.0, Piper 1.8.0 and CPU ONNX Runtime 1.23.2. Fixed fictional HFC synthesis/resampling/base-Whisper recognition stayed in memory. Each setting used two intra-op threads and three small warm rounds; these are engineering samples, not full participant capacity or stable tail-latency estimates.

| Setting | Two concurrent STT jobs | Two concurrent TTS jobs | Mixed four jobs (2+2) | Peak sampled service RSS |
| --- | --- | --- | --- | --- |
| CPU 1+1 | 3/6 succeed; configured excess rejected | 3/6 succeed; configured excess rejected | 6/12 succeed; configured excess rejected | 589 MiB |
| CPU 2+2 | 6/6, 4.9 jobs/s, p95 408 ms | 6/6, 19.4 jobs/s, p95 108 ms | 12/12, 9.3 jobs/s, p95 447 ms | 1,128 MiB |
| CUDA STT 2 + CPU TTS 2 | Initialization failed | Not benchmarked in this configuration | Not benchmarked | Not accepted |

CPU 1+1 single-engine STT was about 2.8 jobs/s; TTS about 10.5–10.9 jobs/s. Direct four-job pure-engine tests deliberately exceeded the two-worker setting and rejected 6/12 for each engine. No hidden queue/fallback was used. Sampled GPU baseline was 207 MiB and utilization 0% for CPU tests.

The separate GPU test venv preserves the original CPU environment. Installed `nvidia-cublas-cu12==12.8.4.1` from wheel SHA-256 `8ac4e771d5a348c551b2a426eda6193c19aa630236b418086020df5ba9667142`; host cuDNN is `libcudnn9-cuda-12 9.22.0.52-1`. CUDA device enumeration and float16 support queries pass, but even a clean-environment direct driver `cuInit(0)` returns **999 / CUDA_ERROR_UNKNOWN**. Device nodes/UVM modules and matching kernel/user driver versions are present. No driver reset, module unload, reboot or system installation was attempted. This prevents a CUDA inference claim; the GPU venv is not used by deployed speech. CUDA TTS and a GPU dependency lock remain pending.

Selected rollout: CPU `int8` base STT, **two STT and two TTS workers**, two threads each, HFC female medium English voice at 22,050 Hz. Match worker counts in gateway and speech environments. Keep diagnostics off. Retain original tokens, model-provider/auth/device keys, media and CPU venv. Wrapper must be upgraded before gateway admission is enabled.

Primary runtime references: [faster-whisper GPU requirements](https://github.com/SYSTRAN/faster-whisper#gpu), [CTranslate2 installation](https://opennmt.net/CTranslate2/installation.html), [ONNX Runtime CUDA compatibility](https://onnxruntime.ai/docs/execution-providers/CUDA-ExecutionProvider.html). Actual inference remains the deciding check.

## Actual decisions evaluation

Both committed 21-case fictional evaluations used threshold 0.85 and the 1,500 ms deadline with `data_collection:deny`, `zdr:true`, `allow_fallbacks:false`; no runtime feature enablement, privacy relaxation, provider substitution, participant data or raw provider logging.

| Model | Matched | Mismatched | Unavailable | Redirect/activity/recap false positives | p50 / p95 |
| --- | --- | --- | --- | --- | --- |
| `typesafe/jev-1.14` | 17 | 3 | 1 | 0 / 0 / 0 | 173 / 297 ms |
| `openai/gpt-6-luna-decisions` | 0 | 0 | 21 | Not evaluable | 91 / 110 ms |

Neither meets the handoff's all-cases/zero-unavailable gate. **Keep `LEMMI_DECISIONS_ENABLED=0`.** Provider errors are sanitized; the exact cause of unavailable results was not established. General chat uses its base phrase redirect/reminder behavior. Retuning/held-out evaluation and gateway-wide semantic rehearsal remain pending.

## Deployment and remaining handoffs

Actual installation, runtime revision, public acceptance and rollback pointer are recorded in [backend status](../backend-status.md), the [API reference](../backend_api.md), and the build plan after observed rollout. Historical feature-handoff “undeployed” statements describe their original work and are superseded by that release record.

Anay: investigate CUDA driver initialization in a maintenance window, then rerun actual isolated inference/throughput/cancellation before choosing GPU settings; investigate decision mismatches/unavailability without weakening data policy. Kylie: review settings and browser recovery/keyboard/zoom. Emilia: verify physical local controls, capture/output, firmware endpointing and room noise. Lukas: review retained teaching/Photo Story behavior and activity-launch handoffs. No completed P0, clinical validation or unattended-care readiness is claimed.

### Observed public/browser rollout

Migration 005 and CPU 2+2/HFC settings installed with backup retained at the host rollback pointer. Actual public STT→external LLM→TTS, capture-off waiting/Stop, persistent credential and scoped Photo Story checks passed. Chromium desktop/mobile caught a Type instead disclosure closing during input; web `12a1e47` binds its user-controlled state. It also makes hidden-tab Pause actually owner-only, correcting the inherited handoff's unimplemented claim. Repeated actual browser checks passed typed submit/Start/Stop, settings, game Escape, no overflow/runtime errors, and observer-hidden-no-Pause versus owner-hidden-Pause across two scoped endpoints. Full 311-test suite passed again after those fixes. No human microphone or audible speaker test was performed.
