# Lemmi — Camera check-ins and local robot interactions

**Status:** Committed implementation scope; hardware feasibility and all acceptance checks pending  
**Updated:** November 12, 2026  
**Owners:** Emilia (firmware), Anay (server/access/contracts), Kylie (UI/art), Lukas (activity integration/demo)

**Starter note:** Shared code now exists; see [team-start.md](team-start.md) for exports and current limitations. Reuse the starter. Requirements in this document remain unverified unless explicitly recorded as observed; typed snapshots do not establish working product/hardware behavior.

## 1. Scope and priority

Implement these additions in this order, using the existing backend and session authority:

1. **F13 — Short caregiver camera check-ins** (the earlier recommendation #2).
2. **F14 — Local petting reactions, restrained expressions/head motion, readable status cues, and device health** (the earlier recommendation #1).

Both are planned implementation work, not stretch ideas. Pairing, access checks, local stop, capture indicators and bounded transport are prerequisites. Prove a secure end-to-end camera path before spending time on petting, motion or LED polish. Existing basic audio/status/control work continues; this ordering does not defer essential stop controls or require activities to wait for finished firmware.

This spec supersedes earlier statements excluding camera from the initial build. Facial recognition, biometric templates, automated video analysis, always-on monitoring, recording, two-way video/audio calls, NFC and autonomous tracking remain excluded. No camera data goes to STT, the external LLM, summaries, activity logic or notification providers. A caregiver viewing an image does not establish that the participant is safe or that help has arrived.

## 2. Hardware evidence and early experiment

The [manufacturer's K151 documentation](https://docs.m5stack.com/en/StackChan) describes a factory Monitoring Camera feature in Avatar mode. It does not establish that this works alongside the AI Agent mode or in our custom firmware. Build Lemmi's controlled camera path; do not depend on a separate factory mobile app or expose a raw camera address.

Emilia first tests the [official camera example](https://docs.m5stack.com/en/arduino/stackchan/camera), then the display, touchscreen/stop input, Wi-Fi and camera together. Also exercise the audio path on the same firmware in sequence: voice → coordinated audio shutdown → camera → local Stop → explicit return to audio. Audio and camera need not run simultaneously. Verify bounded memory, peripheral initialization/resource reuse, TLS/network load, and worst-case Stop responsiveness while frames render/transmit. Report usable capabilities before Kylie exports the full avatar set or Anay freezes media formats. Record the exact board/firmware/library versions, initialization order, image encoding, memory use, frame size, latency, power and control responsiveness. The example's camera/I²C initialization must be checked against touch and other peripherals. Camera availability alone is not proof of integration.

Start with a proposed **320 × 240, 1–3 frames/second** stream of independent frames; select encoding and hard byte limits from measured hardware results before freezing the contract. These are experiment targets, not performance claims. Prefer fewer fresh frames over queued old frames. If the camera cannot coexist reliably with essential local controls, keep check-ins disabled and record the unmet F13 criterion; an app-only conversation fallback does not satisfy camera acceptance.

## 3. F13 — Minimal check-in flow

1. Caregiver setup explains who may view, the camera's field of view, session length, local refusal/stop, and that Lemmi does not record. Camera permission is separate from speech, excerpts, contacts and public-demo recording permission. Default is disabled. Configure only a permitted non-private location; exclude bathrooms, dressing and unintended bystanders.
2. A signed-in caregiver explicitly requests a check-in for their assigned participant/device. Being a notification recipient does not grant camera access. Only one viewer/check-in per device is allowed initially. The server checks resource authorization and current privacy revision; GET, link previews, alerts and model outputs cannot start a camera.
3. For this first version, the robot displays **“[Configured caregiver name] would like to see you”**, with **Allow camera** and **Not now**. A present demonstrator can assist in the supervised demo after explaining the choice. No response means no capture; expire the request after a proposed 30 seconds. Do not infer consent from silence, a diagnosis, petting or a communication-support preset. Unattended or pre-authorized opening is later work requiring a supported-decision policy and separate review.
4. Local Allow pauses the authoritative conversation/activity, invalidates pending audio/talk effects, and clears microphone/playback queues before capture. Await that coordinated pause; if it fails or times out, leave camera off. During the check-in, mic, TTS and music remain off. There is no remote audio or automatic answer to the caregiver.
5. Show a persistent, text/icon **Camera on — [name]** notice and a large **Stop camera** target on the robot; the participant app mirrors the state when open. LEDs may supplement this but cannot be the only indicator. The caregiver sees fresh frames, connection freshness, remaining time and **End check-in**. Do not describe a frozen image as live.
6. End automatically after a proposed **60 seconds from local Allow**, or earlier on local refusal/stop, caregiver End, loss of either connection, watchdog expiry, permission revocation, unpairing, profile deletion or server restart. The robot enforces its own deadline and heartbeat watchdog. No implicit extension; another check-in requires a new request and local Allow.
7. Stop capture locally before waiting for the network; discard frame buffers, stop forwarding, blank the viewer and invalidate credentials for that check-in. Do not resume on boot/reconnect. Conversation/activity remains paused until an explicit participant Resume; no automatic track, question or speech starts.

**Control distinction:** Mic mute affects audio capture only and must not be labeled as a camera-off control. Stop camera ends video; global Stop ends video and audio, cancels queued output and halts motion. Get help remains available and ends the check-in before using the existing contact path; already-created contact jobs keep their separate lifecycle. Ordinary activity pause does not authorize camera use. Reject late frames/commands even if the connection was restored.

## 4. F13 — Shared implementation contract

Anay publishes validated schemas, fake-device fixtures and a mock/real `CheckInClient`; Emilia and Kylie consume them. Use existing protocol envelope conventions, authenticated device identity, revision checks and stable error codes.

| Interface | Proposed contract / responsible owner |
| --- | --- |
| Capability hello | Emilia reports `cameraSupported`, supported encoding/resolution/byte limits, `pettingSupported` and supported health fields; Anay validates. Unsupported capability is explicit. |
| `CheckInSnapshot` | `checkInId`, device/profile binding, `revision`, `privacyRevision`, state, configured viewer display name, request/allow/expiry times, reason code, latest frame sequence/freshness. Never expose caregiver contact destinations. |
| State enum | `off`, `requested`, `starting`, `active`, `ended`, `unavailable`. Only local acceptance plus server validation may move requested → starting → active. A declined/timed-out request ends; retain reason codes rather than inventing success. |
| HTTP `/v1` | `POST /devices/:id/check-ins` creates an idempotent authorized request; `GET /check-ins/:id` reads scoped state; `POST /check-ins/:id/end` explicitly ends. Enforce CSRF/origin protections for cookie-authenticated mutations. No public stream URL. |
| Control events | Server → robot: `camera.request`, `camera.start`, `camera.end`; robot → server: `camera.allow`, `camera.decline`, `camera.started`, `camera.ended`. Server publishes `camera.state` to authorized views. Include check-in ID, generation, sequence/revision and expiry; reject stale/replayed starts. `camera.start` requires the still-valid local Allow and the shared paused state. |
| Media path | Separate bounded authenticated WSS media channel on the same gateway, isolated from audio/control queues. Bind both robot sender and signed-in viewer to this active check-in. Recheck authorization/expiry during streaming; at most one viewer, never anonymous access. A short-lived channel grant is not a permanent credential or a URL logged in query strings. |
| Frame envelope | Check-in ID, camera generation, sequence, negotiated dimensions/encoding, capture time and bounded byte length. Use monotonic device timing plus server receipt time for freshness; device time does not authorize access or extend deadlines. Queue at most one pending frame per hop; drop superseded frames, never replay after reconnect. |
| Viewer freshness | Blank expired/stale images and label connection lost. Initial target: blank after 3 seconds without a fresh frame; benchmark and document the chosen limit. Browser background/reconnect cannot retain a misleading live frame. |

Do not add a second backend, activity store or polling screenshot archive. HTTP state/control, gateway transport and firmware deadlines share one check-in authority. Stop is idempotent. Server restart terminates all active grants; device watchdog/deadline closes capture independently. Include a local consent nonce tied to check-in ID/generation so a delayed start cannot reopen capture after Stop. Bound request/start timeouts as well as active duration.

Persist only minimal access metadata where necessary: authorized actor/profile/device IDs, request/start/end times and fixed end reasons. Retain no images/thumbnails, recordings, face embeddings, raw frame payloads or scene descriptions. Proposed access-metadata retention: 7 days maximum or earlier profile deletion/demo reset; Anay implements bounded cleanup. Frame processing is memory-only; disable image/temp-file/body logging, disk caches and service-worker caching, and clear viewer object URLs/canvas/image state on end. Use `Cache-Control: no-store` for related HTTP responses. Document any unavoidable platform buffers; do not promise protection against a caregiver independently taking a screenshot.

## 5. F14 — Local petting, expression, motion and health

Implement after the F13 secure streaming/stop gate passes. The K151's **top three-zone touch strip** supports strokes; side rows are RGB LEDs, not side touch sensors. Use the [BSP touch interface](https://github.com/m5stack/StackChan-BSP/blob/main/src/utils/touch_sensor/touch_sensor.h) for measured swipe/debounce behavior. Capacitive intensity is not a validated force measurement.

- Emilia maps a deliberate top-strip stroke to a short local `pet_ack` reaction: a gentle visual response and, if tested safe, one restrained motion preset. Debounce/rate-limit reactions and let them finish without a repeat queue. No server/model round trip is required. Do not interpret touch as mood, consent, a help acknowledgment or a microphone/camera toggle.
- Keep touchscreen Stop/help controls unambiguous and higher priority. Suppress playful reactions during camera requests/streams, urgent-help states and local stopping. A pet cannot dismiss a notice or resume a paused activity. Preserve mute/listening indicators during any overlay.
- Use bounded, firmware-owned servo presets and reduced-motion/off settings; no raw angles or movement scripts from models or web clients. Test conservative mechanical bounds, no vigorous rotations, and no movement while being petted/held. Start with a static reaction when touch is active; only consider subsequent movement after release and hardware review. Global Stop and watchdog halt queued motion. Touch release alone cannot establish that the robot is no longer being held; if placement/holding safety cannot be established in the supervised setup, leave servo reactions off and use the static reaction.
- Kylie supplies a `pet_ack` overlay/state mapping consistent across dog, cat, bunny, bird and lemming. Keep the six authoritative interaction states and their 30 static frames; any additional reaction exports are a separately budgeted handoff, not a new avatar or a listening state.
- Emilia adds readable device-state cues, optionally using side RGB LEDs: actual mic capture, camera active, paused, connection lost and help status must remain distinct. Use text/icons as well as color. The display's camera notice takes priority over playful expressions.
- Report supported device telemetry through `device.health`: firmware version, link state, sample time and measured battery voltage/current where supported by the [BSP](https://github.com/m5stack/StackChan-BSP/blob/main/src/M5StackChan.h). Anay validates and Kylie shows freshness/unavailable states in Overview/Device settings. This describes the robot, not the participant; do not invent battery percentages, remaining runtime or health judgments from raw values.

## 6. Teammate tasks and integration sequence

| Owner | Small runnable increments | Handoff |
| --- | --- | --- |
| Emilia | Local stop/indicators + camera example; fake-gateway request/Allow/Stop; bounded real frames and expiry; hardware failure checks; only then petting/LED/motion/telemetry integration | Actual formats/budgets, device events, measured results and recovery steps to Anay/Kylie |
| Anay | Shared check-in schemas/mocks; ownership/consent state machine; gateway relay; scoped HTTP/viewer access; session pause/cancellation; expiry/revocation/metadata cleanup; then health ingestion | One client and authoritative snapshots for Kylie; paired fixtures for Emilia; pause/resume policy for Lukas |
| Kylie | Caregiver check-in page and permission settings using mocks; participant/robot request/active/ended panels; real viewer; then petting art and device-health views | Static readable camera notices/control layouts before reaction polish; no game or consent authority in UI |
| Lukas | Make all four activities preserve position/state on externally imposed pause; no advancement/effects during check-in; explicit resume only; draft teammate-only camera demo | Reducer fixtures and pause/resume checks to Anay/Kylie; voluntary separate camera-demo choice for Grandma |

Camera work may proceed beside the audio/music slice using shared mocks. Integrate camera before F14 polish; this is a prerequisite gate, not a reason to hold all frontend/activity development.

## 7. Acceptance gates — all pending

- **F13 hardware:** bounded fresh frames reach the authenticated caregiver through the real K151/gateway; local controls remain responsive under camera load. Record memory/latency/frame-rate measurements and exact versions.
- **F13 access:** unrelated caregiver/device, expired grant, duplicate viewer, forged IDs, GET/link preview, model command and notification-triggered open are rejected. Default-disabled and no local Allow produce no capture.
- **F13 termination:** local Stop camera/global Stop/help, caregiver End, timeout, stale start/frame, viewer/device disconnect, server restart, unpairing and privacy revocation all stop/blank without auto-reopening. Test with the browser closed and server unavailable; mock-only tests cannot prove local hardware behavior.
- **F13 integration/privacy:** camera pauses mic/TTS/music and pending photo talk; no effect resumes after end until explicit Resume. Check logs/temp files/browser caches/storage; no retained frames, recording or vision calls. Verify access-metadata expiry/deletion races.
- **F14:** top-strip strokes react locally once; stop/watchdog beat rendering/motion; motion disabled/reduced motion works; no pet toggles camera/mic or overrides help. All five avatars keep accurate state cues. Device health shows measured/stale/unavailable data honestly.

Use a consenting teammate and a neutral scene for initial checks. Grandma's supervised live participation does not imply camera permission; request it separately, allow refusal, and use a teammate fallback. Keep all acceptance results pending in the build plan until observed. Disable a failing capability and report the unmet scope rather than treating a factory feature or mock as completed Lemmi functionality.
