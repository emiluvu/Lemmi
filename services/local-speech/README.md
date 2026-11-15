# Local speech — CPU baseline and configurable worker pools

This private engine wrapper runs alongside Lemmi. It has no participant session, profile, journal or contact authority. The existing Bun coordinator owns conversation. STT/TTS adapters call the wrapper over authenticated loopback HTTP; the robot must never connect to it directly.

Implemented engines: **faster-whisper 1.2.1** with multilingual Whisper `base` (CPU/int8 initially) and **Piper 1.8.0** with the English `en_US-hfc_female-medium` voice (CPU by default; CUDA selectable), selected by the user for both browser and Stackchan backend-generated output. The prior voice was `en_US-ljspeech-medium`; the engine and 22,050 Hz format are unchanged. English synthesis/transcription has been checked with a synthetic phrase on Framework WSL Ubuntu 22.04.5/Python 3.10.12. Human microphone quality, German voice quality, hardware transport and NVIDIA/Mac performance remain unverified.

## Setup on another Ubuntu machine

Use Python **3.10** for this lock. Do not replace the Bun workspace or install packages into system Python. From the repository root:

```sh
python3.10 -m venv services/local-speech/.venv
services/local-speech/.venv/bin/python -m pip install --require-hashes -r services/local-speech/requirements.lock
python3 services/local-speech/prepare_models.py --configure
```

If your system already has `uv`, the equivalent tested installation path is:

```sh
uv venv --python /usr/bin/python3.10 services/local-speech/.venv
uv pip sync --python services/local-speech/.venv/bin/python --require-hashes services/local-speech/requirements.lock
python3 services/local-speech/prepare_models.py --configure
```

Model provisioning explicitly downloads roughly 201 MiB (base STT plus HFC voice) of weights plus support files into ignored `.models/`. Exact revisions/sizes and weight hashes live in `assets.json`; a local hash inventory is generated. Inference never downloads models. Model weights/support files are assets, not recordings. Review their source/permissions before redistribution. The provisioner creates `services/local-speech/.env` with mode 0600, local paths and a random independent token, only if absent. It preserves existing settings and does not print the token. Never commit `.env`, `.models`, `.venv` or raw audio.

This workspace already has the virtual environment, models and private service `.env`; rerun provisioning only when needed. Requirements are separate from `bun.lock`; no npm/yarn lockfile or Bun dependency change is needed. Direct Python pins are in `requirements.in`; `requirements.lock` includes hashes/transitive pins for Python 3.10.

## Run and check

Use pinned **Bun 1.4.4**. From the repository root, in one terminal:

```sh
bun --env-file=services/local-speech/.env scripts/local-speech.ts
```

Expected status: `Lemmi private speech ready on 127.0.0.1:8765`. The launcher passes only speech/runtime environment variables to Python, excluding OpenRouter/auth/provider secrets. It does not print configuration values. Ctrl+C stops the service and inference child. Never bind or proxy this listener onto the LAN/public origin. Use the protected app/gateway for participant input.

In a second terminal:

```sh
bun --env-file=services/local-speech/.env scripts/speech-smoke.ts
python3 -m unittest discover -s services/local-speech -p 'test_*.py' -v
```

The smoke synthesizes a fixed fictional English phrase, resamples in memory to the STT input format, and checks recognition without printing its transcript or writing audio. It reports only pass/timing/format metadata. It plays no sound and opens no microphone. The Python tests use fake inference workers and temporary listeners, so they test boundaries rather than recognition quality. A sandbox that blocks loopback sockets needs the normal tool escalation, not disabled authentication/TLS.

## Independent backend/configuration selection

Two layers of selection keep session code independent of engines:

| Setting | Values / purpose |
| --- | --- |
| `LEMMI_STT_BACKEND`, `LEMMI_TTS_BACKEND` | Bun adapter: independently `local-http` or `disabled`; default disabled when not configured |
| `LEMMI_STT_URL`, `LEMMI_TTS_URL` | Separate engine-wrapper origins, default `http://127.0.0.1:8765`; no paths/query credentials. Plain HTTP is loopback only. Remote/custom adapters require protected HTTPS and explicit implementation/deployment |
| `LEMMI_SPEECH_TOKEN` | Private bearer token, 32–512 printable ASCII characters; shared by service and trusted Bun caller, never the browser/robot |
| `LEMMI_SPEECH_TIMEOUT_MS` | Bun request bound, default/max 20,000 ms |
| `LEMMI_SPEECH_PORT` | Wrapper's loopback port, default 8765 |
| `LEMMI_SPEECH_STT_ENGINE` | `faster-whisper` or `disabled` |
| `LEMMI_SPEECH_STT_MODEL_PATH` | Pre-provisioned local model directory, never a runtime URL/model download |
| `LEMMI_SPEECH_STT_DEVICE` | Explicit `cpu` or `cuda`; failed CUDA does not silently choose CPU |
| `LEMMI_SPEECH_STT_COMPUTE` | Explicit `int8`, `float16`, `int8_float16` or `float32`, subject to the selected runtime/device |
| `LEMMI_SPEECH_THREADS` | 1–16 intra-op CPU threads **per worker**, initial 4; start with 2 when testing two workers per engine |
| `LEMMI_SPEECH_TTS_ENGINE` | `piper` or `disabled` |
| `LEMMI_SPEECH_TTS_DEVICE` | `cpu` (default) or explicit `cuda`; requires a working CUDA ONNX Runtime provider; no silent CPU fallback |
| `LEMMI_SPEECH_STT_WORKERS`, `LEMMI_SPEECH_TTS_WORKERS` | Independent pool sizes, each 1–4 (default 1); set the same counts in gateway and wrapper environments |
| `LEMMI_SPEECH_VOICE_EN` | Local English ONNX file; adjacent `.json` must identify English/eSpeak phonemization |
| `LEMMI_SPEECH_VOICE_DE` | Optional German ONNX file/config; absent means German synthesis unavailable, never English substitution |

To adopt HFC on an existing install, run the provisioner above, then change **only** `LEMMI_SPEECH_VOICE_EN` in the existing private speech environment to the absolute `.models/tts/en_US-hfc_female-medium.onnx` path and restart the speech wrapper between sessions. The adjacent `.onnx.json` must be kept beside it. The provisioner preserves existing private configuration and tokens; `--configure` does not overwrite an old voice setting. Browser and Stackchan receive the same selected backend voice; no model is installed on the ESP32. No shared deployment is changed by checking out this branch.

Change settings and restart the wrapper/caller between sessions. There is no automatic mid-turn engine switch. Only the two named engines are implemented; the common server-only `SttAdapter`, `TtsAdapter`, `ChatAdapter` interfaces in `packages/server/src/adapters/types.ts` allow another implementation later. Separate endpoints can be used for separate local wrappers with the same wire API. Keep identical scope/cancellation/retention rules when adding a cloud engine; do not silently forward failed local speech to it.

### Host matrix

| Host | Current status / next check |
| --- | --- |
| Framework WSL, Ubuntu 22.04.5, Python 3.10.12, x86_64 | CPU/int8 STT and CPU English Piper synthesis/transcription smoke observed; no AMD GPU/NPU test |
| NVIDIA server, Ubuntu 22.04.5, i9, 32 GB RAM, RTX 2000 Ada ~16 GB VRAM | User-reported hardware; not accessed here. Install the same CPU baseline first, then verify runtime CUDA libraries before choosing `cuda` + compatible compute type |
| Ubuntu VM | CPU path intended; OS/allocated CPU/RAM and measurements pending |
| MacBook Pro | CPU path intended, installation/architecture/RAM and measurements pending. Do not assume Apple GPU acceleration from this implementation |

`nvidia-smi`'s CUDA label describes driver support, not proof of installed cuBLAS/cuDNN for CTranslate2. Follow the selected runtime's [GPU requirements](https://github.com/SYSTRAN/faster-whisper#gpu) and [CTranslate2 installation reference](https://opennmt.net/CTranslate2/installation.html), then test the pinned installed version. Those references may differ in their cuDNN guidance; actual library linkage/inference on the target host decides readiness. This slice installs no NVIDIA drivers/CUDA libraries. Unsupported CUDA/AMD/Apple execution stays unavailable.

## Private wire API

All endpoints require `Authorization: Bearer <private-speech-token>`. Browser `Origin`, URL queries, missing credentials and non-loopback peers are rejected. Responses are `Cache-Control: no-store`; the service prints no request bodies, transcripts, phonemes or engine tracebacks.

| Endpoint | Input | Output |
| --- | --- | --- |
| `GET /health` | No body | Engine readiness and supported language sets; no secrets/paths |
| `POST /v1/stt` | `application/octet-stream`, signed 16-bit **little-endian**, **16 kHz mono** PCM, positive even byte length ≤1,280,000 (40 seconds). `X-Lemmi-Language: en`, `de` or `auto`; `X-Lemmi-Request-Id: <UUID>` | `{ok:true,data:{text,language}}`, text ≤2,000 characters, detected language must be `en` or `de` |
| `POST /v1/tts` | JSON `{text,language}`, text 1–600 characters, language `en` or `de`; UUID header | Mono int16 little-endian PCM, `X-Lemmi-Encoding: pcm_s16le`, `X-Lemmi-Sample-Rate`, `X-Lemmi-Language`. ≤30 seconds and ≤48 kHz |
| `POST /v1/cancel` | JSON `{requestId:<UUID>}` | Whether that job was active; bounded 30-second early-cancel tombstones also prevent overtaken jobs from starting |

Missing/invalid input returns 400; auth/origin failures return 401/403; unavailable/busy/canceled inference returns sanitized 503. No output format or provider fallback is invented. Unsupported German voice returns unavailable. Independent STT/TTS pools each run up to their configured worker count. Each worker loads only its own engine/model; model copies multiply RAM/VRAM use. Saturated engine calls return 503 rather than entering a second inference queue. The gateway admits matching per-engine concurrency and retains one shared bounded eight-waiter queue, FIFO within each engine; queued cancellation/deadlines stay participant-scoped. Even the default one-worker-per-engine setup permits STT and TTS overlap. Counts above one permit multiple participants within an engine. The service caps request threads at sixteen and connection/body waits at five seconds. HTTP audio is a bounded whole-turn baseline, not streaming recognition or the robot wire format.

The current English voice produces **22,050 Hz**, while STT consumes **16,000 Hz**. The smoke's linear resampler is test-only. A12/A15 must negotiate real output format/resampling, 20 ms input framing, bounded transport and endpoint receipts before robot/browser speech can be called functional.

## Cancellation and data lifetime

Bun passes an abort signal/UUID, attempts a bounded cancel request, and independently discards every late result. The parent service terminates only the assigned inference subprocess for cancellation/timeout; another participant’s worker continues. The next explicit inference reloads that worker. Health includes configured/ready worker counts; it remains ready while at least one worker of every enabled engine is ready, and may report unavailable if a whole engine pool is down. If a cancel request cannot reach the service, work can continue until its own 20-second bound, but the caller still rejects it. A disconnected HTTP client alone does not prove instantaneous engine cancellation.

Audio/text move through bounded request buffers, a private process pipe, NumPy arrays, engine buffers and bounded response buffers in RAM. No audio/transcript/temp-file/job persistence is implemented. STT NumPy input and consumed TTS arrays are wiped where owned; transient Python strings, IPC/engine/native/OS copies are not a secure-erasure guarantee. Each engine process suppresses Python logging and third-party stdout/stderr, loads local files in offline mode and disables Hugging Face telemetry. Model/voice files, Python bytecode and dependency caches may persist; these are not conversation recordings. Retaining a service credential in a private env is deliberate. OS paging/crash dumps and host-level logging are separate deployment settings to inspect; no universal RAM/provider deletion claim follows from local hosting.

## Sources and permission notes

`assets.json` identifies exact pinned repositories/revisions, weight hashes and the English voice's source/model card. The pinned [HFC female model card](https://huggingface.co/rhasspy/piper-voices/blob/6b9cfaacb4fb2e02a9621227e3c1a48bec9710c3/en/en_US/hfc_female/medium/MODEL_CARD) links the Hi-Fi-Captain dataset under **CC BY-NC-SA 4.0** and names its hifi_tts_92 fine-tuning provenance. This is the selected noncommercial demo voice; preserve attribution/share-alike/source records and review permissions before any commercial deployment or redistribution. It is not the previous public-domain LJ Speech dataset. Piper reads the voice config’s recommended inference values (`noise_scale=0.5`, `noise_w=0.333`, `length_scale=1.0`); no custom speed/noise override is added. Piper is GPL-3.0; faster-whisper/Whisper have their own model/engine terms. Retain the source/license records and review packaging before redistribution. Downloaded weights are ignored, not committed. German voice quality review remains a separate acceptance gate.

Primary engine references: [faster-whisper](https://github.com/SYSTRAN/faster-whisper), [Piper Python API](https://github.com/OHF-Voice/piper1-gpl/blob/main/docs/API_PYTHON.md). The service uses NumPy input to STT and Piper's in-memory `synthesize` chunks rather than file-oriented recording examples. It does not implement camera/vision, voice cloning, online speech or a second conversation backend.

## Optional speech pipeline and English quality probes

The [speech pipeline handoff](../../docs/handoffs/anay-speech-pipeline.md) connects these private adapters to the existing authenticated gateway on `anay/speech-pipeline`. It is opt-in, not deployed by this branch, and accepts explicit bounded whole turns rather than incremental recognition. Physical microphone/speaker/browser checks remain pending.

`python3 services/local-speech/prepare_models.py --stt-profile small` explicitly provisions pinned multilingual small (~461 MiB weights) in `.models/stt-small` without changing an existing `.env`. Select that absolute path privately and restart to compare; base remains the default and no fallback occurs. Both profiles use the same locked CPU runtime. Small is slower and has not eliminated every synthetic keyword error.

Use `bun --env-file=services/local-speech/.env scripts/speech-quality.ts` for five fixed English keyword probes with/without 250 ms padding. `--fixture garden --repeat 3` repeats the difficult phrase; optional private `LEMMI_COMPARISON_STT_URL` compares exactly the same waveforms against another endpoint. Only numeric results are printed, never audio/transcripts. A failing exit is expected quality evidence when a keyword is wrong; do not convert it to success. Model/voice stochastic variation, human quality and hardware performance need separate evaluation.

The wrapper tries a one-second graceful idle-worker shutdown before terminate/kill escalation, so Python/native finalizers can release resources. In-flight cancellation remains bounded and hard-stops the worker. Ignored model/dependency caches persist; no audio/transcript files are created.


## GPU and concurrent-user testing

See the [server-agent handoff](../../docs/handoffs/speech-gpu-concurrency.md) for the unrun NVIDIA/CUDA setup, proposed two-STT/two-TTS configuration, cancellation gates and repeatable load commands. CUDA STT selection already existed; this increment adds independent configurable processes and CUDA TTS provider checks. The CPU Python lock is preserved; no GPU libraries, driver or target-host settings have been installed here. Keep all service URLs private and existing secrets unchanged. The new `bun --env-file=services/local-speech/.env scripts/speech-load.ts` probe emits only synthetic success/failure counts and timings for STT, TTS and mixed loads. It calls the private adapters directly, so overload deliberately fails at the engine capacity; it does not measure gateway queueing or maximum supported user count.


## German pilot provisioning

The German candidate is **de_DE-thorsten-medium**, 22,050 Hz, pinned to
`6b9cfaacb4fb2e02a9621227e3c1a48bec9710c3`. The pinned
[model card](https://huggingface.co/rhasspy/piper-voices/blob/6b9cfaacb4fb2e02a9621227e3c1a48bec9710c3/de/de_DE/thorsten/medium/MODEL_CARD)
identifies the Thorsten-Voice dataset and rdh base as CC0. Its model card,
configuration and ONNX model sizes/SHA-256 hashes are recorded in `assets.json`.
Piper's engine license remains separate. This is a provisionable candidate;
listening samples and fluent-speaker review have **not** been performed here.

```sh
python3 services/local-speech/prepare_models.py --german
```

This explicitly provisions the candidate alongside the existing English voice
and multilingual Whisper base. It never changes an existing private environment;
even `--configure` leaves German disabled. After listening review, the deployment
owner sets `LEMMI_SPEECH_VOICE_DE` to the absolute
`.models/tts-de/de_DE-thorsten-medium.onnx` path in private configuration and
restarts the wrapper between sessions. Keep the adjacent `.onnx.json` and model
card. Check authenticated private `/health`: every ready TTS worker must advertise
both `en` and `de`; keep gateway/wrapper worker counts aligned. Do not use an
English-only Whisper `.en` model. No request downloads assets and absent German
voice returns unavailable without English synthesis.

A source checkout/provisioned model does not establish human German STT/TTS,
fluent wording, room-noise, latency, browser speaker or K151 acceptance. Run those
checks separately without storing microphone audio or transcripts, including
`Gärten`, `schön`, `Frühstück` and `Straße`. Preserve the English voice and existing
profile enrollment/configuration for rollback.
