# Anay → Emilia / Kylie: text chat and local speech engines

This increment adds **optional authenticated text chat** through the existing session authority, plus **real local STT/TTS engine adapters**. The engines are tested independently of robot media. The connected microphone → LLM → generated-speech playback path, actual OpenRouter model/key test, final language/safety review and counterpart acceptance remain pending.

Use the [local speech guide](../../services/local-speech/README.md) for Ubuntu setup/configuration/privacy/format details and [control handoff](anay-control-foundation.md) for authenticated pairing/WSS. The earlier control-only handoff describes the preceding baseline; this file adds `input.text`/`response.text` without granting microphone capture. Activity A01–A04 compatibility remains intact; no new game rules or session store were added.

## What is runnable

| Path | Implementation / limit |
| --- | --- |
| `packages/server/src/adapters/openrouter.ts` | Explicit server-only model/key, fixed HTTPS text-completions endpoint, bounded context/response/timeouts, aborts, sanitized failures. No tools/retries/mock fallback |
| `packages/server/src/adapters/{types,local-speech}.ts` | Independent STT/TTS adapter selection and endpoints; bounded PCM/text, language/format validation, cancel UUIDs and late-result rejection |
| `services/local-speech/` | Loopback authenticated wrapper: faster-whisper multilingual base + Piper English voice, local model provisioning and Python 3.10 hash lock. CPU English synthetic TTS→STT observed |
| `SessionCoordinator.submitText` | Same authority as control/activity state; transient bounded history, current generation/revisions/lease, turn deduplication and cancellation. No transcript journal/persistence |
| Device contracts/gateway | Authorized `input.text`, participant-safe `response.text`, optional `device.ready.textChat`; async generation does not block heartbeat/Stop/help |
| `scripts/control-device.ts` | Computer test client supports `chat <text>` and visible text replies. No microphone/speaker/network audio is added |

Only `faster-whisper` and `piper` are concrete speech engines today. Engine/device/model/voice/endpoint settings can be changed separately between runs; adding another backend uses the interfaces, not a new coordinator. No online speech fallback, GPU speed claim or ChatGPT sign-in is implemented. English is first; German text/language codes exist, but German TTS voice/wording/quality checks remain A41.

## Configure OpenRouter text chat

Root `.env.example` lists the settings. Put real values in private root `.env` or protected server environment, never chat/source/browser `PUBLIC_*` variables/firmware:

```dotenv
OPENROUTER_API_KEY=
OPENROUTER_MODEL=
LEMMI_LLM_TIMEOUT_MS=20000
LEMMI_LLM_MAX_TOKENS=160
LEMMI_CHAT_LANGUAGE=en
```

Use a concrete `provider/model` ID. Both key/model must be present and valid before live chat is enabled; `openrouter/auto` and client-selected models are rejected. No default model is invented. The root `.env` copy command can be `cp -n .env.example .env` to preserve an existing file; edit it privately. The user has not yet supplied a model/key in this session, so real OpenRouter availability, language response quality, cost and model-specific behavior are unverified.

Live gateway startup uses the existing authenticated pairing/TLS settings. With that path configured, run `LEMMI_MODE=live bun run start:gateway`; the paired computer client uses `LEMMI_MODE=live bun run fake-device`, then `start` and `chat Hello`. The client reports replies in its terminal; don't redirect private conversation into logs. The mock UI/RPC never makes LLM calls. Caregiver sign-in/public-origin/LAN provisioning are still their own tasks; this change does not bypass them. Standalone local model smoke needs neither identity provider nor OpenRouter.

OpenRouter requests contain a bounded application prompt, approved minimal context, current participant text and at most six transient prior messages. The current coordinator supplies Alex's preferred name; it does not send the full caregiver profile, sensitive-topic text, journal, contacts, policy store or credentials. No biography edits or retained summaries are generated. The prompt asks for short adult-respectful replies, factual uncertainty, no clinical/treatment claims and the effective communication preset. Runtime checks reject tool calls, incomplete/oversized/unsupported replies, wrong language metadata and excessive question marks; these bounds are **not proof of semantic safety, factual grounding or language fluency**. Rehearse the selected model before live use.

The adapter requests `provider.data_collection:'deny'`, `zdr:true`, `allow_fallbacks:false`, disables tools/streaming and makes one attempt. Provider/account settings can still affect eligible endpoints, so unavailable routing is explicit. OpenRouter's [routing documentation](https://openrouter.ai/docs/guides/routing/provider-selection) and [ZDR policy](https://openrouter.ai/docs/guides/features/zdr) describe separate account/guardrail Safety Retention choices, implicit in-memory caching and legal/safety retention exceptions. Configure/review the account and selected endpoint, disable optional prompt/output logging, and document those external limits; application deletion cannot undo completed provider processing. No universal deletion/compliance promise is made.

## Device text protocol addition

`@lemmi/contracts` now exports `ConversationTextCommandSchema`, `ConversationReplySchema`, `ConversationTextResultSchema` and inferred types. Shared command shape:

```ts
{ commandId, sessionId, expectedGeneration, text, language: 'en' | 'de' }
```

`text` is trimmed, 1–1,000 characters; provider history is bounded separately. This command is accepted through the authenticated device event path, not arbitrary `/v1/live` RPC. A browser-specific participant transport/client integration remains Kylie's/Anay's next handoff; do not use a caregiver token or create another backend to bypass the missing browser seam.

After paired hello, `device.ready.payload.textChat` reports whether a model adapter is configured. `controls` may include `text`. This configuration signal is not proof of real provider readiness. `audio` remains **false** and `camera` remains **false**.

Send a current-session event:

```json
{"protocol_version":1,"event_id":"unique-text-turn","session_id":"current-session-id","turn_id":null,"generation":0,"sequence":2,"type":"input.text","payload":{"text":"Hello","language":"en"}}
```

The gateway publishes `state.changed` with phase `processing`, capture grant null. On success it sends a correlated `command.ack`, then:

```json
{"protocol_version":1,"event_id":"server-event-id","session_id":"current-session-id","turn_id":"unique-text-turn","generation":0,"sequence":3,"type":"response.text","payload":{"turnId":"unique-text-turn","text":"Hello. We can take our time.","language":"en","source":"model"}}
```

The example envelope sequence is illustrative; use the server's actual sequence. Reply `source` is `model` or `fixed`. The next authoritative state is capture-off `waiting`. Failed model/config calls produce explicit errors; the app must not synthesize/play an invented successful response. There is no audio grant or implicit restart after text reply.

Each new input has a unique command/event ID and increasing per-connection sequence. Exact current-turn duplicates share generation work and do not emit the reply twice on the socket. Completed output authorization ends on interruption or a new turn; stale/changed/older-turn retries fail without a second provider request. The coordinator bounds command fingerprints at 256 per session, stores only the last reply receipt and six dialogue messages, and clears dialogue/results on pause, Stop, mute, handoff, disconnect or revoke. Explicit new session clears text receipts; raw turns never enter durable/generic command history or journal.

Stop/pause/help remain application commands. Mic mute cancels the affected pending model response while preserving unrelated approved output validity. A resolved-but-not-yet-emitted reply loses authorization immediately on mute too, even though mute does not increment the output generation. Capture stays off. Text input is independent of the mic setting, so a deliberate typed message can be used while the microphone is muted. No actual speaker/output execution is introduced in this increment.

Exact reviewed example phrases route Stop/refusal/pause/help before generation. A topic-refusal example clears dialogue and pauses, requiring explicit continuation. Incomplete-need, nonspecific-unwell and urgent example phrases get fixed text; this narrow recognition is not complete safety/clinical/emergency detection. Help remains unconfigured and says no request was created or sent; fixed urgent wording does not pretend contact was attempted. Broad intent recognition, F15 canonical topic policy, full multilingual safety review and durable contact remain separate work.

## Emilia and Kylie next

- **Emilia:** review the new text events before consuming them. Audio still needs explicit capture grant/turn/stream end and playback receipt contracts. The proposed 16 kHz/20 ms input is not hardware-tested. Current TTS is 22,050 Hz; negotiate conversion/output support with Anay rather than treating input and output formats as identical. Keep local Stop/mute/watchdog/camera rules independent of text generation.
- **Kylie:** render validated participant text with waiting/processing/error states and normal controls through the existing session transport when the browser seam is provided. Never bundle server provider keys or private caregiver context. No semantic safety/readiness guarantee follows from a valid schema; prototype demo states must remain clear.
- **Anay:** configure the exact OpenRouter model/key for fictional live tests, verify its routing/response behavior, add the authorized browser text seam and mic grants/ingestion (A12), connect STT→chat (A13), then TTS/actual playback receipts (A15). Local engine wrappers alone do not complete a robot voice turn. German, other engine implementations, NVIDIA/Mac/VM benchmarks and the 20-turn rehearsal remain pending.

## Verification scope

The resumed review added completed-reply/mute freshness, early speech-cancel tombstones and safety controls at bounded-command capacity. The full current Bun suite passed **70 tests**; seven Python boundary tests passed. Type/Svelte checks, production build and formatting passed, as did `bun scripts/smoke-control.ts --chat-fixture` using verified HTTPS/WSS and a fixture OpenRouter response. Browser output contained none of the inspected server-only provider/auth symbols; no speech audio artifacts were found and the private service env was mode 0600. The resumed real CPU synthetic English smoke passed at 187 ms TTS / 507 ms STT in one run (earlier 130/443 ms); it is not a quality or 20-turn benchmark. Exact observations and the sandbox build retry are recorded in the build plan. The owned speech listener was stopped after verification. No real provider credentials, microphone recordings, audio files, real messages or camera frames were used by automated tests. Human/robot/browser/audio quality and counterpart review remain pending. The user subsequently authorized publishing an isolated snapshot on `backend-deploy` without switching the shared checkout; see [deployment guide](../backend-deploy.md). Earlier Git-pause notes describe the preceding checkpoint.

Reproduce the production wiring test after `bun run build` with `bun scripts/smoke-control.ts --chat-fixture`. The explicit test-only preloader replaces the fixed OpenRouter URL inside the spawned gateway and supplies fixture key/model values. Ordinary startup has no fixture-provider switch or failed-live fallback. The smoke never inherits a real API key. Use `bun run smoke:control` for the same control-only test without the chat fixture. Both create/remove their own temporary CA/proxy/identity/processes; neither establishes a working real provider account or K151.

Final service cleanup review found/fixed duplicate terminal/launcher SIGINT delivery during worker join. Real engine startup followed by Ctrl+C then exited cleanly with code 0; the seven Python tests passed again. No speech listener is intentionally left running by this session.
