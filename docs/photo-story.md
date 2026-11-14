# Photo Story: runnable local voice demo

Branch `codex/photo-story-voice` starts from main `be1e096`. It extends the existing
`photo_album` reducer and **the same SessionCoordinator**. The opt-in launcher
reuses the SvelteKit app, loopback gateway, private local-speech wrapper and
OpenRouter adapter. No second backend/session store or game implementation.

## Try it on this Windows machine

The app and speech wrapper were started during verification. Open:

http://127.0.0.1:5173/participant/photo-story

To start/restart after stopping the existing demo processes:

```powershell
.\.tools\bun-1.4.4\bun-windows-x64\bun.exe run photo-story
```

With Bun 1.4.4 on PATH, use `bun run photo-story`. The launcher detects an already
running Photo Story app and prints its URL. Otherwise it starts the existing dev
launcher and, if `services/local-speech/.env` exists, the existing speech launcher.
Port collisions fail explicitly; it never kills unrelated services. Ctrl+C stops
its children. Do not run two gateways or two speech wrappers on the same ports.

1. Choose **Start Photo Story**. A fictional garden illustration/caption and short
   opening appear; local Piper synthesizes the response and the browser plays it.
2. Choose **Unmute microphone**, then **Speak now** and allow this localhost page
   to use your microphone. Unmute alone never starts capture. The listening label
   is visible only during capture. Speak a short answer; choose **Done speaking**,
   or wait four seconds after speech. Initial silence returns to waiting after
   fifteen seconds. A capture is bounded to twenty seconds; no visible countdown.
3. Local Whisper recognizes transient PCM, then the selected responder produces a
   follow-up. Piper synthesizes it. Capture remains off during output and afterward;
   each further voice turn requires another explicit Speak now.
4. Try **Repeat response**, **Type instead** (e.g. `Roses`), **Next/Previous photo**,
   **Just look**, **Pause**, **Resume to ready**, and **Stop session**. Next/Just look/
   Pause/Stop cancel local capture/playback immediately and invalidate pending work.
   Resume produces no automatic speech or capture. Finish leaves the activity;
   Stop ends the session so a new Start is possible.

Microphone permissions/hardware and human recognition quality still require your
rehearsal. Permission denial or service failures stay explicit; typing remains
available when capture is off. Responses can be read when TTS is unavailable.
No browser/cloud speech-recognition service or browser speech-synthesis substitute
is silently selected.

## Responses: reviewed demo or OpenRouter

Default `LEMMI_PHOTO_STORY_CHAT=reviewed_demo` explicitly selects a small reviewed
offline responder. The page labels **no LLM**. It supports a generic opening,
the fictional Roses answer, a patient invitation to continue, and Quiet wording.
It is intentionally limited and cannot produce arbitrary personalized discussion.
This mode still uses **real local STT/TTS**, not fixture audio or invented transcripts.

To select the existing OpenRouter adapter, stop the current launcher first. Set
private root `.env` values for `OPENROUTER_API_KEY` and an explicit
`OPENROUTER_MODEL`, then:

```powershell
$env:LEMMI_PHOTO_STORY_CHAT = 'openrouter'
bun run photo-story
```

Never paste credentials into chat/source/browser code. OpenRouter failures remain
errors; they never fall back to reviewed demo replies. No model/key is configured
on this checkout and no real OpenRouter request was verified. The existing adapter
uses string-only messages, so **photos are not analyzed** even if the chosen model
independently supports vision. Only caption, reviewed discussion context, minimal
approved facts and transient conversation text may go to the model. Existing
provider routing/privacy settings and external retention limits still apply.

## Speech provisioning on another machine

Local models/config are deliberately ignored and are not part of the branch.
The [existing speech guide](../services/local-speech/README.md) documents engines,
permissions, pinned weights, setup and data lifetime. On this machine an isolated
Python **3.10.19** environment was created using uv; the existing hash lock worked
for Windows wheels without dependency/lockfile edits:

```powershell
uv venv --python 3.10 services/local-speech/.venv
uv pip sync --python services/local-speech/.venv/Scripts/python.exe --require-hashes services/local-speech/requirements.lock
.\services\local-speech\.venv\Scripts\python.exe services/local-speech/prepare_models.py --configure
```

This explicitly downloads roughly 201 MiB of pinned model/voice assets and writes
an ignored private speech env with an independent token. The launcher now selects
`.venv/Scripts/python.exe` on Windows and the existing `.venv/bin/python` elsewhere.
The speech service stays authenticated on loopback; the browser never receives
its bearer token or calls it directly. Without provisioning/configuration, the
page explicitly reports STT/TTS unavailable and offers text interactions.

## Content, privacy and architecture

The only functional profile remains fictional Alex. The existing caregiver-provided
gardening interest is reused. The bundled garden and park SVGs are original generic
illustrations authored for this demo; captions describe the pictures, not Alex's
past. No relatives, visits, locations or personal history are invented. SVGs are
bundled public fictional art, not private uploaded media; the existing restricted
PNG upload API was not weakened. Production uploaded-photo catalog integration
and authorized relevant biography selection remain Anay's/Kylie's follow-up.

`preparePhotoStoryTurn` filters canonical eligibility and provides scoped grounding.
The existing companion prompt and safety phrase routing remain in force. Photo
selection/Talk/Just look/Leave use existing ActivityAction/ActivityView contracts;
new `PhotoStoryCommandSchema` media/continuation operations use the same transport
and coordinator. The host checks session generation, activity revision, listening
grant, current reply, lease/profile/privacy/policy state, and cancels stale work.
Repeat synthesizes the current authorized reply without another model call.

The explicitly enabled `LEMMI_PHOTO_STORY_DEMO=1` path is **loopback-only fictional
rehearsal**. It uses the existing local RPC token/origin/peer protections and does
not expose or modify the authenticated production deployment. Normal `bun run dev`
stays mock-only; the demo never uses the database/private media or real contacts.
This cross-owner integration needs Anay's server/contracts and Kylie's UI review
before merging. It does not prove remote caregiver, camera or robot readiness.

Microphone PCM, synthesis buffers, recognized words and replies remain transient.
No MediaRecorder, audio files, full transcript persistence, journal utterances,
learned preferences or biography writes were added. The page uses an AudioWorklet,
bounded resampling to 16 kHz mono PCM, and a single Web Audio output endpoint.
State may hold the current reply/bounded dialogue only; Pause/Stop/photo changes
clear it. OS/engine/browser copies are not a secure-erasure guarantee. Reload
recovers a safe server snapshot and pauses interrupted media rather than restarting.

## Verification

```powershell
bun test tests/photo-story.test.ts tests/photo-story-voice.test.ts tests/reviewed-activities.test.ts tests/conversation.test.ts
bun run check
bun run build
bun run smoke:photo-story
```

The real smoke requires the demo and local speech running, with no open session.
It starts/stops its own fictional session and exercises SvelteKit → coordinator →
TTS → synthetic speech → STT → follow-up/Repeat without audio files/transcript logs.
It checks usable speech text and valid audio, not word-level recognition accuracy.

Observed: voice/coordinator tests, type/Svelte checks, build and the real Photo
Story smoke pass. Browser opening, typed Roses follow-up, Just look and navigation
were inspected. Full suite: 106 pass, 12 database tests skipped, one pre-existing
Unix file-mode assertion fails on Windows (0666 vs 0600). The original short-phrase
speech smoke also fails its exact `garden` recognition assertion on this machine;
near-matching transcription was observed. These failures remain visible; neither
storage-security nor human speech quality is marked passed. Real provider/model,
human microphone, hardware, remote deployment and counterpart review remain pending.
