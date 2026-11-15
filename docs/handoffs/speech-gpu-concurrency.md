# Server agent: CUDA speech and concurrent-user tuning

Continue from `anay/natural-speech-turns`. The user asked for GPU acceleration and removal of the one-at-a-time speech bottleneck, then explicitly requested that a testing-server agent handle the actual NVIDIA/CUDA migration. No connection to, driver installation on, configuration change on, or restart of the testing server was performed by the local implementation task.

Read AGENTS.md, team-start, safety/privacy, integration contracts, backend-status and the local speech guide. Preserve the shared deployment checkout at `/home/anayn/project/Lemmi` on `backend-deploy`; prepare and test in an isolated worktree/environment. This branch contains undeployed frontend integration plus speech changes. Do not deploy the whole branch implicitly. Integrate reviewed backend changes through the existing deployment workflow; preserve credentials, applied migrations, sessions and teammates’ work. Never print private env, token, conversation, process environment or provider bodies.

## Implemented locally

- `packages/server/src/speech-scheduler.ts`: independent STT/TTS admission slots; one bounded eight-waiter queue shared across sessions. FIFO within each engine, with no blocking of a free engine behind a saturated other engine. Counts are 1–4 per engine, default 1 each. Queue wait counts toward the existing caller deadline. A canceled running call keeps its slot until the underlying adapter settles; late PCM is wiped. Queue overflow fails explicitly, no retry/provider fallback.
- `services/local-speech/server.py`: separate STT/TTS process pools, 1–4 each, default 1 each. A process owns only its selected engine/model. Cancellation routes by request UUID to its exact worker, killing only that native inference. Early-cancel tombstones and duplicate active UUID rejection prevent delayed work from starting elsewhere. No Python inference queue: if every worker of the requested kind is reserved, return sanitized 503. Sixteen HTTP request threads leave room above eight maximum inference slots for cancellation/health; thread capacity itself is bounded, not unlimited control availability under abuse.
- Worker replicas intentionally duplicate model weights in RAM/VRAM to retain independent hard cancellation. Increasing faster-whisper `num_workers` alone would not fix the prior gateway/process serialization, and killing a shared multithreaded engine would cancel other participants. There is still one session authority/active audio owner per profile, no extra model API or storage.
- STT supports existing `LEMMI_SPEECH_STT_DEVICE=cuda` and explicit compute choice. A CUDA compute support check occurs before model load. TTS adds `LEMMI_SPEECH_TTS_DEVICE=cpu|cuda`. Explicit CUDA TTS requires the CUDA provider, verifies the created session kept it, and disables ONNX Runtime's runtime EP fallback. Some graph operations may still execute on CPU as part of the CUDA graph; no claim that every operation uses GPU. ORT intra-op threads are bounded per worker; inter-op is 1. Default Piper voice remains user-selected `en_US-hfc_female-medium`, 22,050 Hz, recommended model JSON inference values.
- Private `/health` retains ready/languages and adds safe engine `device`/STT `compute` plus `workers`/`readyWorkers`. Ready means at least one warm worker per enabled engine; a canceled slot can reload on a later explicit request. Model load health does not prove successful CUDA inference. No paths/secrets appear. Public resource/WSS schemas and authorization do not change.
- `scripts/speech-load.ts`: fixed fictional TTS→in-memory resampling→STT warm-up, then direct private STT/TTS/mixed load at selected concurrency levels; content-free success/failure counts, wall time, p50/p95 and successful jobs/sec. No recordings, external LLM, mic, robot or transcript logs. SIGINT aborts outstanding adapters. This bypasses gateway admission to expose service saturation; rejection at excessive load is expected and reported as failure counts. Exit 0 alone is not acceptance: examine every failed count. At concurrency 1 the mixed probe is a TTS job; meaningful STT/TTS overlap begins at 2. Small synthetic samples do not establish real-user capacity or accurate tail latency.

## Inspect the target before changing it

The user reports an NVIDIA RTX 2000 Ada and 32 GB system RAM. Confirm exact GPU **VRAM**, driver and OS/runtime rather than treating system RAM as VRAM. `nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv` is safe metadata. Its CUDA label is driver capability, not proof that the needed runtime libraries are installed. Read only versions/provider lists and safe readiness metadata from the existing environment, never dump its env or secrets. Inspect current service manager, process count, configured engine devices and active sessions before a restart. Preserve the old environment and private configuration as a rollback target.

The CPU environment is Python 3.10, faster-whisper 1.2.1, CTranslate2 4.9.0, Piper 1.8.0 and ONNX Runtime 1.23.2, as pinned in `requirements.lock`. Do not alter the shared symlinked local virtual environment or system Python. Start a **separate GPU test venv** using the same model assets and private loopback-only service. Prefer private absolute paths to existing approved models; inference must never download a model or silently choose a new one.

For GPU dependencies, consult the exact pinned runtime's primary instructions and verify actual inference:

- [faster-whisper GPU requirements](https://github.com/SYSTRAN/faster-whisper#gpu): current CTranslate2 wheels need CUDA 12 cuBLAS and cuDNN 9. Verify installed versions/library discovery against the pinned 4.9.0 runtime; do not infer readiness from `nvidia-smi` alone or install drivers blindly.
- [CTranslate2 GPU installation](https://opennmt.net/CTranslate2/installation.html) and [parallelism](https://opennmt.net/CTranslate2/parallel.html): concurrent CUDA streams can help throughput but do not guarantee it. This implementation uses independent processes for cancellation isolation, not shared-weight thread workers.
- [ONNX Runtime CUDA compatibility table](https://onnxruntime.ai/docs/execution-providers/CUDA-ExecutionProvider.html) and [Piper Python CUDA](https://github.com/OHF-Voice/piper1-gpl/blob/main/docs/API_PYTHON.md): CUDA TTS needs compatible `onnxruntime-gpu`. The existing lock intentionally remains CPU-only. Do not install CPU `onnxruntime` and `onnxruntime-gpu` together into one venv; they expose the same Python namespace. Piper declares a CPU runtime dependency, so a deliberate, reproducible GPU environment/dependency override is required; simply rerunning the CPU sync can undo it. Resolve and record an exact GPU lock/install workflow on the target if CUDA TTS wins, preserving the CPU lock. No untested CUDA dependency pins are asserted here.

STT on GPU with Piper on CPU is the initial candidate. This avoids adding GPU TTS dependencies before a measurable benefit. Test CPU Piper against CUDA Piper later; for short replies, transfers/kernel startup or GPU contention may make CPU faster overall. GPU speech will not shorten external LLM time or the separately selected 1500 ms browser pause.

## Starting candidate settings

Set these in the **private speech wrapper** environment in the isolated test setup, retaining its independent token and model/voice paths:

```dotenv
LEMMI_SPEECH_STT_DEVICE=cuda
LEMMI_SPEECH_STT_COMPUTE=float16
LEMMI_SPEECH_STT_WORKERS=2
LEMMI_SPEECH_TTS_WORKERS=2
LEMMI_SPEECH_TTS_DEVICE=cpu
LEMMI_SPEECH_THREADS=2
```

Set **the same worker counts** in the gateway environment (these are read only when live speech is enabled):

```dotenv
LEMMI_SPEECH_STT_WORKERS=2
LEMMI_SPEECH_TTS_WORKERS=2
```

Keep gateway counts at or below corresponding available wrapper counts, with the same chosen endpoints. Mismatch can produce explicit busy 503s; no automatic discovery/resizing/retry is implemented. Upgrade/test the wrapper before enabling the new gateway scheduler: the old single-process wrapper cannot serve simultaneous STT and TTS even when each lane is limited to 1. One gateway is assumed. Other callers of the private wrapper also consume its finite slots; run direct load probes away from active participant tests. Dedicated STT/TTS URLs remain supported. Never expose the speech port. Tune 1, 2, then at most 4 replicas per engine; monitor RAM/VRAM, CPU threads and latency. More workers do not promise more speed. Keep one active endpoint per participant profile; use distinct explicitly enrolled fictional fixtures for simultaneous user tests.

## Reproducible checks

Use pinned Bun 1.4.4. Configure only an isolated listener and clients; the following commands use the normal private service `.env` of the test worktree and do not print its values:

```sh
bun --env-file=services/local-speech/.env scripts/local-speech.ts
# separate terminal
bun --env-file=services/local-speech/.env scripts/speech-smoke.ts
LEMMI_SPEECH_LOAD_CONCURRENCY=1,2,4 LEMMI_SPEECH_LOAD_ROUNDS=10 bun --env-file=services/local-speech/.env scripts/speech-load.ts
python3 -m unittest discover -s services/local-speech -p 'test_*.py' -v
bun test tests/speech-scheduler.test.ts tests/speech-pipeline.test.ts tests/speech-gateway.test.ts tests/multi-endpoint.test.ts
bun run check
bun run build
bun run format:check
```

Prepare `base` and optional pinned `small` STT comparison explicitly; default remains base. Keep exact same synthetic audio/voice, hardware and concurrency when comparing model/backend choices; do not claim imperfect real speech solved by synthetic recognition. For each candidate record startup/warm-up separately, successful/failed counts, p50/p95, jobs/sec, peak RAM/VRAM, actual GPU activity and selected devices. Run CPU 1+1, CPU 2+2, CUDA STT 2+CPU TTS 2, then CUDA TTS if appropriate. To compare configurations without deliberate overload, limit the pure-engine probe to that engine's configured count; mixed concurrency 4 is two STT plus two TTS jobs.

Then verify the real gateway path with two fictional profiles, its queue, visible capture grants and output receipts. Pause/Stop/mute/disconnect/profile/privacy changes on A while B runs must not cancel, deliver or leak B's speech; cancel A during both STT and TTS, verify A's native process stops and can reload for a new explicit turn, and B continues. Verify missing CUDA fails explicitly, queue overflow stays bounded, no late output/reconnect backlog, no response body/transcript/audio persistence, and all listeners remain private. The browser pause and Stackchan firmware integration are separate from server throughput. Hardware and subjective quality checks stay labeled unrun until observed.

## Local observations, not NVIDIA claims

The local fixture tests verify separate in-flight STT owners, free TTS while STT is saturated, duplicate/early-cancel handling, cancellation leaving another subprocess alive, reload of only the canceled slot, health/cancel requests during busy inference, private-pipe TTS result separation and shutdown races. Gateway tests force simultaneous recognition for two scoped profile owners and retain output isolation. No GPU is available locally. Explicit CUDA TTS selection on the CPU-only runtime failed initialization with sanitized error and exit 1; it did not silently run CPU TTS.

Real local CPU 2-STT/2-TTS, two threads per worker, base Whisper + HFC: one-job STT ~1.4 successful jobs/sec, two parallel STT ~2.3/sec; one-job TTS ~5.3/sec, two parallel TTS ~9.4/sec. Mixed four-job batches (2+2) completed 8/8 across two rounds at ~4.7 successful jobs/sec. Direct four-STT/four-TTS batches each rejected 4/8 at the configured two-worker limit as intended. These are tiny warm synthetic observations on the development host, not stable benchmarks, concurrent full-user capacity, human recognition or GPU results. Final local checks: **192 Bun tests passed / 33 database skips / 4,109 expectations** with the occupied-port PKCE case excluded; **13 Python speech tests passed**; type/Svelte/format/whitespace/production build passed. Existing verified TLS/WSS speech fixture smoke passed two turns, with simulated consumption. Exact scope is also recorded in the build plan.

Before shared deployment, keep backend-status/API/docs consistent with actual source/config and run the assigned counterpart review. Report the measured winning settings and remaining limits rather than a speculative speedup. The server agent is responsible for CUDA dependency resolution and actual target measurements; the local task leaves those deliberately pending.
