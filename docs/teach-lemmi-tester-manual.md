# Teach Lemmi tester manual

Branch: `codex/teach-lemmi`. Fictional Alex only. This branch supplies a playable local text demo and backend teaching handlers for Anay to review and deploy. It does not change the shared deployment.

**Voice follow-up:** the [microphone and speaker demo](teach-lemmi-voice-demo.md) adds a separate local browser audio endpoint using the existing live backend. It requires the teaching/speech deployment and a fresh scoped Alex pairing. The scripted text instructions below remain valid; no live-service failure automatically becomes scripted success.

## Launch the local demo

Use Bun **1.4.4** from the repository root:

```powershell
bun install --frozen-lockfile
bun run dev
```

Open <http://127.0.0.1:5173/participant>. Choose **Start mock session**, then **Start Teach Lemmi**. No credentials, database, OpenRouter account, microphone permission or speech models are needed.

If Windows cannot find the installed Bun, update this terminal session:

```powershell
$env:Path = "$env:USERPROFILE\.bun\bin;" + $env:Path
```

If the usual ports are occupied, leave those processes alone. Run these in two separate terminals, choosing unused ports:

```powershell
$env:GATEWAY_PORT = '3011'
bun run dev:gateway
```

```powershell
$env:GATEWAY_PORT = '3011'
bun run dev:web --port 5183
```

Then open <http://127.0.0.1:5183/participant>. Stop both processes with Ctrl+C after testing. Restarting the mock gateway clears its in-memory state; refresh the page afterward.

## Which components are real

| Component | Local browser demo | Backend integration on this branch |
| --- | --- | --- |
| Session, teaching commands, revisions, topic selection and active-time limit | Actual shared coordinator | Same coordinator behind existing scoped device access |
| Opening prompts | Reviewed English text | Same text; negotiated speech endpoints can receive it through existing TTS/output receipts |
| Follow-ups | Explicit scripted text, including a roses example | Existing OpenRouter adapter when privately configured; no automatic mock fallback |
| Speech recognition and synthesis | Off; text input only | Existing STT/TTS adapters; exercised with synthetic PCM and simulated playback receipts |
| Robot microphone, speaker and local controls | Not used | Requires Emilia's firmware integration and physical acceptance |
| Memory and caregiver teaching observations | No durable writes, excerpts or summaries | Durable preference/uncertainty storage and teaching journal observations remain unavailable |

The browser demo never sends text to OpenRouter. Live mode requires the existing private gateway, pairing and speech configuration documented in [the speech handoff](handoffs/anay-speech-pipeline.md) and [backend API reference](backend_api.md). Do not put server credentials in the browser or fixtures. This task did not call real providers or access a physical robot.

## Participant checks

Use fictional responses. Start a fresh session for each independent test unless the steps say otherwise. There is no correctness score, failure tally or participant countdown.

| Check | Steps | Expected result |
| --- | --- | --- |
| Start | Start Alex's mock session, then teaching | Gardening, one Guided invitation, microphone off; clear scripted-demo label |
| Relevant follow-up | Send `I enjoy growing roses in a garden.` | One reviewed roses follow-up; scripted reply label; submitted text clears |
| Short answer | Send `yes` | Brief acknowledgment, no negative inference, repeated question or preference write |
| Silence | Leave the form empty and wait | Send is disabled; no nagging, automatic topic change or negative label |
| Different topic | Choose Different topic | Beaches, then Banking, without returning automatically to earlier topics |
| Explicit preference | Choose Like this topic, or send `I like this topic` | Current topic stays available; session-only notice remains; no claim of a durable save |
| Current-topic binding | While on Gardening, send `I like talking about banking` | Must not record a Gardening preference from a Banking statement; ordinary transient conversation only |
| Not sure | On Gardening choose Not sure, then Finish teaching and Start Teach Lemmi again | Gardening stays hidden for this session; no deliberate retest or grade |
| Refusal | Choose Don't ask about this, or send `Don't ask about that.` | Button hides the topic and moves on; spoken/text refusal pauses and clears the old prompt. Resume then Different topic selects another eligible topic |
| Pause | Choose Pause; try the reply form | Reply form and topic changes disabled; no active-time accrual |
| Resume | Use keyboard to activate Resume to ready | Same eligible topic; no speech, capture or replay starts automatically |
| Finish | Choose Finish teaching | Returns to ready with capture off; a separate explicit start is required |
| Stop | Choose Stop or send `I don't want to play anymore` | Entire session ends; teaching disappears; no late reply resumes it |
| Exhaustion | Keep choosing Different topic | Clear no-eligible-topics message; no repeat loop or unrestricted fallback; Finish remains available |
| Keyboard and readability | Tab through controls and submit/activate with keyboard; inspect a narrow window | Labeled reply field, visible focus, readable wrapping and reachable Pause/Stop |
| Lost connection | Stop only the mock gateway while the page is open | Explicit connection/request failure, no pretend reply or automatic resend; reconnect does not resume capture |

Teaching topics are Gardening, Beaches and general Banking. The current profile interest allowlist controls which are eligible; sparse profiles can have no available teaching topic. Family identities and account details are not teaching prompts. Reviewed prompt style follows the session's Conversational, Guided or Quiet preset; Quiet uses no unsolicited question. This catalog is English only; a German teaching response returns unavailable rather than pretending the English content was reviewed in German.

## Timing and cancellation checks

The production limit is **900,000 ms of active teaching time**, including waiting for a response, provider work and output. Pause, disconnect, configuration interruptions and no-eligible-topic waiting do not accrue time. Topic changes do not reset the limit. At the limit, teaching ends, pending generation/capture/output is canceled, and the session returns to ready with capture off. The gateway sweep runs every 500 ms in live mode and every second in mock mode; command/result/output checks also enforce the limit.

Run the injected-clock tests instead of waiting fifteen minutes:

```powershell
bun test tests/teaching.test.ts tests/speech-pipeline.test.ts tests/speech-gateway.test.ts tests/gateway.test.ts
```

These cover five active minutes, a one-hour pause, then ten active minutes; expiry during generation; queued and late prompt audio; Stop/topic/policy/disconnect cancellation; duplicate/stale commands; and synthetic voice conversation. No accelerated timer is exposed to participants or accepted from clients. For a manual duration check, leave a live local teaching session active for fifteen minutes; do not mistake that manual check for a completed hardware check.

For speech integration, an authorized negotiated endpoint uses `input.teaching.start`, then completes the normal consumed-playback receipts before an explicit `input.speak`. It can submit `input.teaching.next`, `.not_sure`, `.prefer`, `.avoid` or `.finish`. Stop, Pause and mute retain their existing meanings. Prompt playback does not open capture. Test a clear recognized Stop phrase, missing/unclear STT, TTS failure, network loss and local Stop independently of the model. Voice topic-change commands cancel the current turn and publish the fresh prompt; that replacement prompt is text-only until an explicit topic button command requests playback. No automatic listening/retry follows an unclear recognition or a failed service.

## Caregiver and privacy checks

Alex starts with remembering and excerpt saving off. In this branch, the caregiver journal must **not** receive submitted statements, paraphrases, inferred interests, silence observations or AI teaching summaries. Existing session-stop events can still appear. A Like or Not sure is not proof of a durable policy save. Session-only hides clear at a new session when remembering is off.

Durable teaching observations, excerpt consent and learned-policy commits are not implemented here, even if a future profile carries permission. Do not enable retention to simulate success. When Anay integrates those services, separately verify authenticated caregiver review, source attribution, current privacy/policy revisions, consent revocation/deletion and failure handling. Only then may permitted structured choices or factual observations appear; utterance/paraphrase retention still requires its separate permission. The server-only eligibility hook is exercised with fixtures, not exposed as a client policy-edit route.

## Observed local results

November 14, 2026, Windows, Bun 1.4.4: type/Svelte checks and production build passed. The automated suite passed 132 tests, skipped 18 database-dependent tests, and retained one existing Windows POSIX-permission assertion failure in `tests/data.test.ts`. Adding the installed Git OpenSSL folder to the test session PATH resolved the earlier missing-OpenSSL failure. Browser checks covered start, roses follow-up, pause, keyboard resume, Not sure, topic rotation/exhaustion, Finish, session-only exclusion on restart and a typed Stop variant. Speech results use synthetic adapters and simulated consumed receipts. Full physical-device, live-provider, prolonged manual timing and full accessibility acceptance remain for counterpart review.

## Record an issue

Formatting verification passed for every changed code file. The repository-wide `bun run format:check` reports 83 unchanged files with existing formatting differences; those files were preserved.

Copy this into the team's normal issue workflow; do not include private statements, credentials or audio:

```text
Branch and commit:
Date / OS / Bun version:
Browser / endpoint (mock text, synthetic device, physical robot):
Starting topic and preset:
Steps using fictional input:
Expected result:
Actual result:
Did Pause / Stop remain available?
Reproduction frequency:
Sanitized screenshot or test name:
```
