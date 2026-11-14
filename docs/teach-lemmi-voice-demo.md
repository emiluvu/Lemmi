# Teach Lemmi voice demo

The local browser is an audio endpoint for the existing backend, using Alex's paired device access and the same speech/session authority as Stackchan. It captures one explicit turn, sends 16 kHz mono PCM for backend STT, receives the existing AI/TTS output and plays it through the computer speaker. It never falls back to scripted AI or browser speech recognition/synthesis silently.

## Backend prerequisites

Anay must review/deploy `codex/teach-lemmi`, including the teaching handlers and the existing speech pipeline. The backend's `device.ready` must advertise `teaching:true` and negotiated audio. STT/TTS and OpenRouter configuration stay on the backend; this browser client does not need their keys, database access or administrator credentials.

Use a current device credential paired specifically to fictional Alex, the HTTPS backend origin and the private domain-gate access key. The backend currently allows one connected device. Coordinate with Emilia before connecting; a robot and this browser cannot independently own simultaneous speech sessions. A server restart invalidates old credentials, so pair after deployment. Pairing and credentials remain Anay's existing scoped flow.

## Private local setup

If Anay supplied an existing Alex access JSON bundle, point the local server at that file instead of copying its secrets:

```powershell
$env:LEMMI_VOICE_ACCESS_FILE = 'C:/path/to/private/stackchan-access.json'
bun run dev:web --port 5186
```

The file must contain Alex's `backendUrl`, matching `websocketUrl`, `deviceId`, `profileId`, `credential` and authorization/gate headers. The loader rejects another profile/device, HTTP destinations, mismatched WebSocket destinations and inconsistent authorization headers. Only the required connection fields enter the server proxy. A private `.env.voice.local` may hold just this file path; no secret needs to be copied. Explicit credential environment settings take precedence so isolated tests never read the real access file.

On Windows, enter the two secrets in hidden local prompts:

```powershell
./scripts/configure-voice-demo.ps1 -Origin https://lemmi.chaoswarrior.dev
```

The helper writes ignored `.env.voice.local` at the repository root and refuses to overwrite an existing file. Alternatively, set these three environment variables privately in the terminal that launches the web server:

```text
LEMMI_PUBLIC_ORIGIN
LEMMI_DEVICE_CREDENTIAL
LEMMI_ACCESS_KEY
```

Do not put real values in commands, screenshots, issue reports or chat. A credential file may be provided privately by path for local setup; only these connection settings are needed. `.env.voice.local` is read by the dev server, not shipped as browser configuration. The browser receives only the configured/not-configured flag. No credentials appear in URLs, localStorage or client WebSocket messages.

From the repository root, using Bun 1.4.4:

```powershell
bun install --frozen-lockfile
bun run dev:web --port 5185
```

Open <http://127.0.0.1:5185/participant/voice>. Start/restart the web server after changing private connection settings. Only this web process is required for live voice; it forwards to the existing remote backend, not the local mock gateway. The usual `bun run dev` and port 5173 also support the page when unused. Leave other running processes alone.

This forwarding is intentionally local and development-only. The Vite server accepts the voice WebSocket only from loopback with an exact matching browser Origin, uses a fixed HTTPS backend destination, replaces credential headers server-side, drops browser cookies and verifies the backend certificate. Do not publish this local credential-bearing dev server. A production caregiver/browser sign-in surface requires separate integration; the production build does not provide this dev proxy.

## Demo steps

1. Open the page and read the processing disclosure. Use fictional Alex content.
2. Choose **Connect microphone and speaker demo**. This enables browser audio playback and checks the backend capabilities; it does not open the microphone.
3. Choose **Start Alex session**, then **Start Teach Lemmi**. The reviewed topic invitation should play on the speaker with the microphone off.
4. Choose **Unmute microphone (stays off)**. Unmute alone must not open capture.
5. Choose **Speak now**, allow microphone access when the browser asks, and wait for **Listening — microphone active**.
6. Say a short fictional explanation, such as “I enjoy growing roses in a garden,” then pause. **Balanced** automatically sends after approximately two seconds of quiet following sustained speech; **Quick** uses 1.2 seconds and **Extra time** uses four seconds. Choose the pause setting before opening a turn. **Done speaking** still sends immediately. Initial silence or an isolated click does not trigger automatic send; a background noise/very quiet voice mismatch can still need Done or the existing twenty-second bound. The microphone stops before the backend response plays, and capture never restarts automatically.
7. Hear the AI follow-up, then choose Speak now again for another turn. Prompt/reply completion never restarts capture.
8. Try **Different topic**, **Not sure**, **Like this topic**, and **Don't ask about this**. These use the same backend teaching commands. The feedback remains session-only in this increment.
9. Choose **Pause**, then **Resume to ready**. Neither capture nor playback resumes automatically.
10. Choose **Stop** during listening and during speech. Local microphone tracks and queued speaker audio must stop immediately, independently of the backend round trip. No late response may restart sound. A recognized spoken Stop phrase uses the existing backend safety route; the visible button remains the immediate independent control.

The main **Lemmi** text is the latest reply/question from the backend, replacing the opening invitation when a new question arrives. It remains visible while the participant answers. **Selected topic** is the separately labeled backend catalog choice, not an inferred summary of a free-form explanation. Different topic replaces the selected topic and its invitation; stale replies from an earlier generation cannot overwrite it.

The backend enforces the existing fifteen-minute active teaching limit without a countdown. Pauses do not count. See the [general tester manual](teach-lemmi-tester-manual.md) for injected-clock checks and the distinction between Finish teaching and global Stop.

The expandable text fallback sends typed text through the same live session; typed replies display text without TTS. The original [scripted local rehearsal](http://127.0.0.1:5173/participant) remains separate and clearly labeled. Neither fallback converts a failed live service request into pretend success.

## Failure and privacy checks

| Condition | Expected result |
| --- | --- |
| No private configuration | Connect disabled; explicit setup instructions; no microphone request |
| Teaching not deployed | Capability message says teaching is unavailable; teaching start disabled |
| Speech disabled | Explicit backend-speech-unavailable status; no pretend voice success |
| Microphone denied/unavailable | Capture closed and backend paused; retry explicitly or use text |
| Permission arrives after Stop | Any late microphone stream is closed; no samples sent |
| Silence/unclear STT | Explicit service/recognition failure or ordinary waiting; no inferred dislike or clinical label |
| Slow/lost connection, malformed audio or closed page | Capture/output stopped, bounded queues cleared, no automatic reconnect or audio resend |
| Muted microphone | Capture and its pending input canceled; unrelated approved speaker output can continue; unmute does not capture |
| Stale generation/policy/profile/lease or topic change | Old capture/output canceled; no obsolete audio resumes |
| Blocked speaker/autoplay | Explicit failure and stopped output; explicit browser interaction/retry needed |

Audio lives in bounded browser/backend processing buffers, not recordings or download files. The browser reports consumed playback frames from Web Audio completion callbacks rather than claiming playback on network receipt. Browser/native/OS memory copies and external-provider retention are not secure-erasure guarantees. No camera is requested. No teaching conversation text or preference is saved durably by this demo; existing session facts remain governed by backend retention.

## Verification scope

**Question and endpoint upgrade:** the previous working commit `16e263a` is preserved locally and on GitHub as `codex/teach-lemmi-voice-baseline-16e263a`. The new local amplitude detector retains only bounded numeric levels/durations for the current capture. It detects a pause, not a diagnosis, mood, preference or semantic sentence end. It performs no STT or recording and does not change the server's capture grant, active-time limit or privacy rules. These pause settings are prototype interaction choices, not clinical thresholds.

Observed upgrade rehearsal, November 14: one separately approved fictional spoken sentence auto-submitted without clicking Done, produced a live roses follow-up, and updated the main Lemmi text to that follow-up. Different topic then replaced it with the seaside invitation. Global Stop left the session ended with microphone/speaker off. Automated checks cover initial silence/noise/clicks, pauses inside an explanation, two-second ending, longer/shorter settings, per-turn reset, one-shot audio.end and hardware closure, question replacement and stale-reply rejection. Broader quiet-voice/noisy-room tuning remains unverified; use Done or Extra time when needed.

Upgrade checks: types/Svelte and build passed; 150 automated tests passed, 18 database checks skipped, and the existing Windows POSIX-permission assertion still fails. The eleven focused browser/endpoint tests passed. Live default-silence and question-display checks passed; shorter/longer settings have synthetic coverage.

Automated checks cover streaming PCM conversion at 16/22.05/44.1/48 kHz, the twenty-second bound, consumed-frame receipts, immediate local Stop, delayed microphone permissions, disconnect cleanup, private-header replacement, same-origin/loopback rejection and a real local WebSocket → Vite proxy → certificate-verified HTTPS fixture backend. Existing synthetic speech tests cover backend STT/model/TTS and teaching cancellation.

Human microphone and speaker check, November 14: after Anay completed teaching deployment, the configured Alex client advertised audio and teaching, played the reviewed topic invitation, accepted an explicitly authorized fictional spoken explanation, received a live roses follow-up and returned to capture-off waiting. The user confirmed hearing the spoken follow-up. Pause and keyboard Resume kept capture off; Stop during a fresh topic's pending speech ended the session with audio off. This is one English human/browser rehearsal, not physical Stackchan, diverse-speaker, noise, German or full acceptance evidence.

The live run exposed the deployed 30-control/sec budget; progress receipts now batch every two actually consumed PCM frames (25 progress receipts/sec), with separate start/completion receipts. No receipt claims unconsumed audio. This compatibility correction has a regression test. The microphone time bound automatically ended the approved turn before the manual Done click; no unbounded listening or recording occurred.

Type/Svelte checks, production build, changed-code formatting, diff whitespace and private-credential absence from browser output passed. The PowerShell setup helper parsed without syntax errors. The verified-proxy integration and receipt-budget tests are included in the final suite; the build plan records its totals and existing Windows/database limitations.

The supplied Alex access bundle first authenticated while teaching was still unavailable; a later capability check advertised both teaching and speech after Anay's deployment, enabling the human rehearsal above. Compatibility was aligned to the already deployed endpoint metadata from Anay's `origin/backend-deploy`: nullable credential expiry, nine allowlisted controls including handoff, and optional `activeEndpointId`. This does not change authentication or implement multi-profile behavior in this activity branch. Capability probes started no session or microphone; only the explicitly approved human rehearsal used capture. The local tested page is <http://127.0.0.1:5186/participant/voice>; its private configuration stores only the path to the existing access bundle.
