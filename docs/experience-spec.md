# Lemmi — Experience specification

November 14 profile increment: create and Edit profile open the same scrollable modal; only the name is required. Pictures/descriptions and conversation-summary memory are optional. Memory starts off, has visible unreviewed summaries and Forget, and does not enable journal excerpts. Failed loads cannot save over existing details; failed saves keep the draft. Context changes pause active conversation and require explicit continuation. Participant conversation keeps its existing controls. See [profile/memory handoff](handoffs/profile-context-memory-2026-11-14.md).

**Status:** Draft for team review  
**Version:** 0.2  
**Scope:** Hackathon prototype; fictional profiles, team rehearsal and optional supervised live demo

This document describes the screens, interaction states, and behavior needed to implement the [product specification](product-spec.md). Layouts, timing values, and example wording are proposed design defaults to test during rehearsal, not clinically validated settings. Detailed sensitive-topic policies and data rules are defined in the draft [safety and privacy specification](safety-and-privacy.md).

## 1. Experience goals

- Make the next action obvious, with one primary task per screen.
- Let the participant respond at their own pace and leave without explanation.
- Use familiar context without testing whether someone remembers it.
- Keep the companion predictable: stable appearance, calm motion, and consistent controls.
- Help caregivers distinguish what happened from what was inferred or summarized.

Use respectful, ordinary language. Avoid baby talk, exaggerated praise, pressure to continue, and statements that Lemmi feels lonely or abandoned. Identify Lemmi as an AI companion during introduction; do not imply that it is a relative, clinician, or person watching over the participant.

## 2. Interaction surfaces and navigation

Stackchan is the preferred participant surface. The screen map below describes the app fallback and companion views; it does not require the participant to navigate those screens while using the robot. Caregiver setup and journal review stay in the app. The same session state and conversation rules apply across both interfaces.

| Interaction | Preferred robot experience | App assistance or fallback |
| --- | --- | --- |
| Introduction and conversation | Lemmi speaks through the robot, shows the selected face and interaction state, and accepts voice turns. | Full conversation view when audio hardware is unavailable or unsuitable; visible text when needed. |
| Start, pause, stop, and help | Accessible, labeled local controls where hardware supports them. | Persistent app controls within reach until local controls are verified; do not claim independent robot use in this configuration. |
| Appearance selection | Preview the chosen expression on the robot. | Choose and preview appearances in the app; do not assume arbitrary avatars render on the robot. |
| Photo conversation | Robot introduces and discusses the approved photo if its display is usable for the image. | Larger photo and caption on a nearby screen, with the robot continuing to speak. |
| Gentle 20 questions | Lemmi asks short reviewed questions; simple answers through voice/touch where usable. | Large yes/no/not-sure/skip/reveal choices and a visible familiar-object picture if helpful. |
| Music playlist | Robot is the preferred speaker when supported; show track and playback state. | Larger playlist controls; explicit speaker handoff if the robot cannot play the format reliably. |
| Profile and journal | No private caregiver information on the participant display. | Caregiver app views. |

Keep essential controls and clear state feedback first. Among the added robot capabilities, prioritize F13 camera check-ins before F14 petting/reaction polish. Assess activity visuals separately: a display that can show a face may still be unsuitable for photos or labeled choices. Do not squeeze the app layout onto the robot.

Before transferring an activity to a larger screen, Lemmi explains the change, for example, “We can look at the photo on this screen.” Wait for an explicit continue action, preserve activity position, and use only one active microphone and speaker endpoint. Moving back to the robot also requires an explicit action.

### App screen map

| Area | Screens | Main actions |
| --- | --- | --- |
| Entry | Role selection | Open participant view or caregiver view. |
| Caregiver | Profile editor → preview | Save profile, approve photo context, choose communication preferences. |
| Participant | Home → appearance chooser | Keep or explicitly change the companion appearance. |
| Participant | Home → conversation | Start talking, pause, stop, or ask for help. |
| Participant | Home → activity chooser → music, gentle 20 questions, photo album talk, or matching; Teach Lemmi → conversation mode | Choose, participate, request a hint, or leave. |
| Participant | Paused / help panel / session ended | Resume explicitly, stop, or return home. |
| Caregiver | Journal list → session detail | Review events, edit a summary, add an observation. |
| Caregiver | Contact settings and request inbox | Verify contacts, configure escalation, inspect request status, and acknowledge requests. |
| Caregiver | Camera permission settings → Check-in | Request short local-approval viewing, inspect freshness/time remaining, end; no camera on page load. |
| Participant | Shared camera request/active overlay | Allow or decline locally; persistent Camera on/Stop camera; explicit activity resume afterward. |
| Caregiver | Demo settings | Inspect connection status, select isolated simulation mode, reset fictional data. |

The production-shaped web flow has separate participant and protected caregiver areas. Participants do not sign in; the caregiver sets up the device/app assignment. Caregivers use a simple sign-in to access profile, contact, and journal controls. Role selection in mock-only rehearsal is a convenience, not an authentication boundary. Real test contact settings and remote acknowledgment require authentication independent of this role switch. Never suggest that it protects real personal information. Switching the shared participant device into caregiver view first pauses capture and output. Opening caregiver view on a separate remote device does not itself pause or take over the participant session. Returning requires an explicit resume action.

### Dashboard example profiles

The authorized November 14 multi-profile increment supports independently created fictional participant profiles, with Alex as the initial profile. Each profile has separate approved context, assets, authorization, session state and transient conversation. Browser and robot endpoints assigned to the same profile share one session and one active audio endpoint; different profiles may run concurrently. New frontend setup selects an authorized fictional profile or creates a distinct fictional profile. Preview cards remain labeled **Example profile — preview only** and never become live records or reuse Alex’s context. Easy enrollment is explicitly enabled for fictional demo profiles only; caregiver/private-data permissions remain separate. Profile changes stop/cancel prior endpoint work, and all APIs enforce resource scope. See [multi-profile handoff](handoffs/anay-multi-profile-endpoints.md) for implementation and verification limits.

### Persistent participant controls

In app mode or app-assisted robot mode, keep a fixed control area with **Pause**, **Stop**, and **Get help**. Show text labels alongside icons. Paused screens keep **Resume**, **Stop**, and **Get help** available. Help panels preserve stop and do not automatically resume the session when closed.

Activity screens also expose **Choose another activity**. This ends the current activity and returns to the chooser without ending the overall session. **Stop** ends the session from every active screen. Do not ask for confirmation before pausing or stopping.

## 3. Caregiver setup

### Profile editor

Use short sections with plain-language labels. Only preferred name is required. Allow the caregiver to save without completing optional sections.

| Section | Fields and behavior |
| --- | --- |
| About the person | Preferred name, pronunciation note, language preference. Show supported languages explicitly; saving a language does not imply the app supports it. |
| Interests and approved life context | Optional caregiver-entered hobbies, music, places, familiar topics and relevant life context/history. Preview/source-label approved facts; no required biography upload or inferred medical history. |
| Important people | Name, relationship, and optional approved context. Do not infer a relationship from a photo or surname. |
| Communication | Conversation support (Conversational / Guided / Quiet companionship) with same-topic previews and explicit next-session/apply-now scope; separate text size, speech pace, volume, hearing/vision preferences. |
| Comfort and sensitive topics | Topics to avoid, caregiver guidance, and familiar comfort strategies. Label these as interaction guidance, not unconditional instructions that override product boundaries. |
| Photo activity | Select a fictional or appropriately licensed demonstration photo, add a caption, and enter approved discussion context. Preview image and wording before approving. |

Show **Caregiver-provided** next to saved personal facts, with the last edit time. Display optional fields as empty rather than generating filler. Saving produces an explicit success state; failure preserves entered values and offers retry.

### Preview and start

Preview the name, interests, appearance, and photo introduction. Keep sensitive-topic guidance and contact destinations in caregiver view. Configure and verify a primary contact and an optional backup, notification channel, and escalation plan; show whether contact routing is ready before participant handoff. Do not infer caregiver presence from device activity or a past acknowledgment. Explain the demo data flow before handing over the device: microphone audio is processed by local STT on the selected team server when listening; permitted text goes to the external LLM, and local TTS generates the response audio. The app journal may retain permitted attributed excerpts and AI summaries in local PostgreSQL. Audio retention is off, including speech-engine temporary files/logs. Complete engine- and provider-specific disclosure after configuration is verified.

Use fictional information throughout. Before the session, offer **Save statement excerpts for the demo journal**, off by default. When off, summaries use retained activity events and caregiver observations only; they must not retain utterance text or paraphrases. Respect later revocation and removal requests as defined in the safety and privacy specification.

The handoff includes: “This is Lemmi, an AI companion. You can talk, try an activity, or stop whenever you like.”

### Editing and deletion

Editing a profile does not rewrite historical session records. After saving, subsequent responses must use the updated facts. If a response is already being generated, discard it before resuming with updated context.

Keep **Delete profile and journal** in caregiver settings. Ask for confirmation here because deletion removes saved work. The confirmation names what will be deleted and any documented external-service limits. Report success only after the prototype's stored records are deleted.

## 4. Participant home and appearance

The app home shows the selected companion, a brief greeting using the preferred name, and two large actions: **Talk with Lemmi** and **Choose an activity**. Keep **Get help** visible. The microphone is off on home; a greeting, if spoken, does not activate it.

On first use, offer five labeled static previews: **Dog**, **Cat**, **Bunny**, **Bird**, and **Lemming**. Use readable cards without a fast carousel or automatic selection; show them in this stable order and allow scrolling on a small app screen. Use **Use this appearance** to confirm. Later changes are available through a labeled **Change appearance** action on home. Do not animate a character change without a choice or randomize it between sessions.

The selected avatar changes only its appearance; all five share the same controls and behavior. Reduced-motion/static rendering is available for each, replacing the previous neutral-avatar proposal. Kylie designs the source art and Emilia validates robot exports; the app chooser must show device support honestly.

An avatar may blink or make small, slow movements. Avoid flashing, sudden jumps, continuous attention-seeking motion, and celebratory sound effects. Provide a reduced-motion option. Facial expressions communicate interaction state, not an assessment of the participant's emotions.

## 5. Conversation

### Session and turn model

Starting conversation or an activity from home begins a session. Moving between conversation and activities keeps the session open. Stop ends it and triggers journal saving. Pause keeps it open without capture, speech, or advancing activity timers.

For the initial demo, use turn-based voice interaction: capture audio only in the visible listening state. Keep the microphone off during Lemmi's speech, processing, pause, home, and ended states. A clearly labeled **Speak now** control lets the participant interrupt Lemmi: cancel output before activating capture. Continuous listening and simultaneous speech are deferred.

| State | Visible wording | Microphone | Behavior |
| --- | --- | --- | --- |
| Ready | “Ready when you are” | Off | Start through an explicit action. |
| Listening | “I'm listening” with microphone indicator | On | Capture one turn; provide **I'm finished** and persistent controls. |
| Processing | “One moment” | Off | Show a quiet progress indicator; keep controls responsive. |
| Speaking | “Lemmi is speaking” plus response text | Off | Speak and display the same content; allow **Speak now**. |
| Waiting | “Take your time” | Off | Offer **Speak now**; do not loop prompts. |
| Paused | “Paused. Microphone off.” | Off | Resume requires a tap. |
| Unavailable | “Talking is unavailable right now” | Off | Offer retry, text input when applicable, and return home. |
| Ended | “We've stopped. Microphone off.” | Off | Save journal and offer home. Never restart automatically. |

After a completed spoken response, use the effective preset’s turn policy: Conversational/Guided may transition visibly into listening under a current server capture grant; Quiet transitions to capture-off waiting. If an existing voice session changes to an activity, announce the change and apply the activity's capture rules. Voice capture is off during music playback or just-look.

In Quiet companionship, completion of speech returns to capture-off `waiting`; never automatically open another listening turn. A participant’s explicit Speak now starts one turn and its response returns to waiting. Conversational/Guided may continue into listening after speech only under a current explicit server capture grant and valid local permissions/state. Firmware/browser clients never start capture merely because playback ended. Stop/pause/mute/camera/help override every preset; unmute alone never restores a capture grant.

### Proposed timing defaults

Undeployed implementation note: [browser turn ending](handoffs/natural-speech-turns.md) implements the user-selected 1500 ms browser post-speech default (following Lukas’s timing trials) with local WebRTC detection and retains **Finish speaking**. Initial silence uses the existing **paused** cancellation path and visible Resume invitation rather than the waiting target below. No silence is submitted to the model or automatic continuation added. Physical microphone/room acceptance remains pending.

- Allow 15 seconds of initial silence during a listening turn before moving to waiting. Show one gentle invitation to tap **Speak now**; do not repeat it automatically.
- After detected speech, use the selected 1.5-second (1500 ms) silence default before completing the turn. The user selected this following Lukas’s browser timing trials; Stackchan should use the same initial target when endpointing is integrated. **I'm finished** allows earlier submission. Tune this with the selected speech service during rehearsal; do not present it as a validated dementia setting.
- If no usable transcript is returned, offer one gentle retry. Repeated failure leaves **Try speaking again**, **Type instead**, and **Stop** available without repeatedly prompting aloud.
- If a response has not arrived after 20 seconds, end the wait with retry and exit options. Ignore late responses from that attempt.
- Do not impose a maximum activity duration or display a countdown. No automatic session restart, difficulty increase, or repeated inactivity reminder.

These timings must not cut off speech that the service reports as continuing. If the selected local STT engine cannot support the proposed end-of-turn behavior, document the limitation and use explicit **I'm finished** turn submission for the demo.

### Response style and examples

Use the caregiver-selected [conversation support preset](communication-support-spec.md): Conversational defaults to one or two short sentences and at most one question; Guided uses one short idea and yes/no or a limited choice; Quiet avoids unsolicited follow-up questions. A third sentence can be used when needed for accurate action/status explanation. Ask at most one question. Avoid compound choices that require remembering a long list.

| Situation | Example response or action |
| --- | --- |
| Approved gardening interest | “You enjoy gardening. Would you like to talk about flowers?” |
| Repeated question about Lemmi | “I'm Lemmi, an AI companion. We can talk or try an activity.” |
| Missing personal information | “I don't have that information. Would you like me to contact your caregiver?” |
| Unclear speech | “I didn't catch that. Would you like to try again?” |
| Silence | Show “Take your time” and **Speak now**; no repeated spoken question. |
| “No” to an invitation | “That's okay.” Leave choices available without another immediate invitation. |
| “Stop” or “I don't want to do this” | Stop capture and output; return to the ended state without persuasion. |

Voice stop depends on recognition and is an additional convenience. An accessible non-voice stop control remains available at all times: verified local control on the robot, or the persistent app control in app-assisted mode. Do not describe the device as able to hear a stop command while its microphone is off.

Use the safety and privacy specification’s sensitive-topic examples and urgent-concern scripts during model integration. The experience must allow a brief compassionate response and human-help action without making up biographical facts, validating frightening beliefs as facts, or claiming a contact status that has not been verified.

### Text fallback

Optional local semantic-decision mode (`codex/conversation-decisions`) recognizes reminder/redirect intent through a bounded external decision call before an open-chat reply. Ordinary phrasing need not match a fixed phrase. The response still uses only transient available context; uncertainty does not imply confusion/diagnosis. Decision timeout/failure ends visibly with explicit retry, and Stop/help retain independent controls. This mode is disabled until configured and live-tested; activity recognition does not yet launch activities. See `handoffs/conversation-decisions.md`.

General-chat branch addition (local, undeployed): a participant can say “What was I talking about?” or “I lost my train of thought.” Give a brief, explicitly attributed reminder from recent transient participant speech/text. Do not guess a missing memory or describe confusion/ability. If context was cleared, absent or caregiver-marked for redirection, offer time or a fresh subject without replaying it. English phrase fixtures are implemented; broader phrasing/languages need rehearsal. Caregiver-configured away/toward phrases may offer one optional subject transition in open conversation; respect continued participant interest and prioritize safety/help/refusal. Empty alternative lists permit a neutral model suggestion without invented personal context. Settings are caregiver-provided, not learned preferences.

Offer **Type instead** when voice is unavailable or the participant chooses it. Display a labeled field and **Send** button. Touch controls remain usable without a keyboard. Do not require typing to pause, stop, choose an activity, or request help.

## 6. Activities

### Activity chooser and implementation split

Show four cards: **Listen to music**, **Let Lemmi guess**, **Look through photos**, and **Match pictures**. Kylie owns the layout/art/buttons; Lukas owns activity state, legal actions, approved content, and progression. Render the shared ActivityView and submit typed actions from the [integration contracts](integration-contracts.md); do not duplicate game rules in components. No score, daily target, or “recommended for your condition” labels.

### Music playlist

Show a small approved playlist, current track/title, clear play/pause/next, volume, and active speaker. First play requires an explicit action. Listening without answering is a complete experience. Microphone capture stays off during music; **Talk with Lemmi** pauses music before requesting a voice turn. Session pause/stop/help silence both music and TTS. Mic mute controls capture only; music controls are separately labeled.

Do not overlap robot/app speakers, music, and spoken narration. An explicit handoff to app audio may be needed if K151 playback is unsupported. Handle missing track, denied autoplay, format/network failure, and disconnect with retry/another track/exit. Do not infer listening from track selection; display playback state from actual endpoint receipts. A proposed starter pack is three approved demo tracks with source/permission metadata, selected before the live rehearsal.

### Gentle 20 questions

Proposed default: the participant chooses a familiar object or visible picture and Lemmi asks yes/no questions to guess it. Keeping it visible is encouraged; hiding or remembering a target is not required. Use a small reviewed candidate set/question tree first. A helper may explain the task without answering for the participant.

Show one question, large **Yes**, **No**, **Not sure**, **Skip**, and **Show me / Finish** controls. For example, “Is it something used in the garden?” Explicit next/start actions and ready state let the person set the pace. An uncertain answer is ordinary: offer a simpler question, a tentative guess, or a graceful exit without error sounds or pressure. At twenty questions at most, finish with a friendly guess/offer to change activities; do not call the participant wrong or display a failure count. No automatic difficulty increase.

This direction is a product proposal based on reducing open-ended question generation, not a clinical efficacy claim. Communication guidance supports one question at a time, yes/no choices, and visual cues. [Alzheimer's Association](https://www.alz.org/help-support/caregiving/daily-care/communications)

### Object matching

Show one visible sample picture and two large candidate pictures, with optional pair reveal. Use Select, Show me, Not sure, Another picture and Finish; no object naming/recall requirement, countdown, error tone or score. First explicit uncertainty moves on and hides the object for the session; a second distinct later occasion retires it from proactive prompts across activities when remembering is permitted. No deliberate retest, disguised alias or automatic retry. A nonmatching tap/Skip/Show me does not establish unfamiliarity. With no eligible content, offer another activity or Finish. Kylie renders Lukas’s view; larger-screen assistance is preferable if K151 choices are unreadable. See [personalization and matching](personalization-and-matching-spec.md).

### Photo album talk

Show one large approved photo, its caption, **Next photo**, **Previous photo**, **Just look**, and **Talk about this photo**. Small starter album: three approved generic/fictional images with captions and discussion context. Supply context, for example, “This is a garden in spring,” then at most one optional question. Family pictures/relationships require separate approval and do not become a recognition quiz.

**Just look** leaves the photo visible with capture off and no repeated prompt. **Talk** enters Anay's conversation pipeline with the approved current photo context; Lukas does not build another LLM service. Moving photos invalidates pending responses tied to the previous photo. Image failure offers retry/next/exit without invented descriptions; album position survives explicit robot/app handoff.

## 7. Pause, stop, and help

Use the shared control table in [integration contracts section 5](integration-contracts.md#5-audio-and-device-seam-emilia--anay). Mic mute stops capture and its pending input-turn response, not unrelated approved music/speech or camera; unmute only clears mute and requires a fresh explicit speaking action. Pause silences output; global Stop ends camera and session; Stop camera leaves the activity paused. Keep these controls separately labeled.

### Pause and resume

Pause immediately halts capture, speech, queued model responses, and activity progression. Preserve the current activity position. Resume returns to a ready state with **Speak now** for conversation or the current activity in a ready state; do not replay queued speech or reopen the microphone automatically.

### Stop and session end

Stop immediately ends the interaction and invalidates pending output. Show “We've stopped. Microphone off.” Separately display journal save status: **Saving session**, **Session saved**, or **Session wasn't saved — Try again**. Save failure must not prevent leaving or reactivate interaction. Returning home requires no new recording.

### Caregiver contact panel

Selecting **Get help** pauses the interaction and immediately starts a request to the verified primary caregiver, using a fixed minimal message rather than waiting for model-generated text. On Stackchan, show and speak concise status; mirror details in the app. Do not require the participant to find a phone number, explain a reason, or confirm through a second menu. An optional reason can be added after sending without delaying the first notification.

| State | Participant wording |
| --- | --- |
| Sending | “I'm trying to contact Maya.” |
| Provider accepted; delivery unknown | “The message is being sent. I don't know if Maya has received it.” |
| Provider-reported delivery | “The message was delivered. Maya hasn't replied yet.” |
| Authenticated acknowledgment | “Maya acknowledged your request.” Use this only when that action is verified; do not say she is coming. |
| No acknowledgment; trying backup | “Maya hasn't replied. I'm trying Jordan.” |
| Failed / no connection | “I couldn't send the message.” Offer **Try again** and any available configured alternative. |
| Attempts exhausted | “I couldn't confirm a response.” Offer **Try again** or another configured contact; do not say help is on the way. |
| Contact not configured | “Caregiver contact isn't set up.” Show setup guidance in caregiver view and no success state. |

Use actual configured display names, not invented recipients. When delivery receipts are unavailable, retain delivery-unknown wording. Detailed status, last attempt time, and errors belong in caregiver view rather than a dense participant screen.

Draft timing: allow 15 seconds per send attempt, retry one transient failure, and try a configured backup after 60 seconds without acknowledgment or immediately after a terminal delivery failure. Escalation does not wait for a provider delivery receipt. After 120 seconds from initial request, mark no response if nobody acknowledged; no automatic sending loop. These are configurable rehearsal defaults, not clinically validated response times. Late acknowledgments update the original request without restarting conversation.

Caregiver notifications contain a request ID, fictional display name, time, and a simple reason such as “Help requested.” Open an authenticated request detail view for acknowledgment. Do not put transcripts, diagnoses, sensitive biography, or raw audio into SMS/push previews. Acknowledgment is separate from resolving the request; a human may explicitly record a follow-up outcome.

Closing the panel leaves the interaction paused. **Stop** ends conversation and capture but leaves an initiated request active; say “Conversation stopped. Your help request is still active.” Provide a separate **Cancel further attempts** action. Explain that already sent messages cannot be recalled, and record cancellation without marking the concern resolved. Pausing/stopping does not create a new alert.

For an immediate-danger report, use the safety specification's brief urgent-concern response and initiate the preauthorized contact flow without waiting on the model. Do not delay the emergency-help instruction while waiting for caregiver acknowledgment. No automatic emergency-service call is provided.

### Isolated simulation mode

Simulation is available for rehearsal and provider outages. It must be selected explicitly by the demonstrator and labeled **Demo help — no real message will be sent** on robot and app at every state. Simulated acceptance, delivery, and acknowledgment cannot generate real sends or be mistaken for verified receipts. Test real routing only with opted-in teammates and fictional concern content. A simulated flow does not satisfy the real-contact acceptance criterion.

## 8. Caregiver journal

### Session list and detail

List sessions by date and time with activity names and save status. Session duration describes elapsed time, not success. Avoid rankings, mood colors, decline arrows, and health-style scores.

Session detail presents these labeled groups:

- **Recorded events:** activity started/ended, hint requested, pause, and technical interruptions. Preserve activity version and assistance context where available.
- **Participant statements:** attributed text excerpts, labeled “Speech recognition may contain errors” when transcribed. Do not present paraphrases as direct quotes.
- **Caregiver observations:** manually entered notes with author and time.
- **AI summary — not reviewed:** a generated description linked to supporting events or excerpts. It can be absent without making the session unavailable.

Provide **Edit summary**, **Mark reviewed**, and **Remove summary**. Editing preserves its AI origin and adds a caregiver-edited label; review does not turn it into an approved biography fact. If no summary exists, show “No summary was generated” with an optional retry action.

Keep **Edit profile** separate from journal review. Never offer one-click automatic promotion of a statement into verified biography. Caregiver corrections to transcribed excerpts retain the original source label and show that they were edited. Historical records must not silently change when the current profile changes.

## 9. Accessibility and sensory defaults

These are implementation targets for app and companion-screen layouts, subject to device checks and later participant feedback. CSS sizes do not establish readability or usability on the robot. Check the actual robot at the intended viewing distance, including state visibility, labels, and physical control reach; move detailed visuals to the app if they are not usable.

- Use at least 24 CSS px for primary participant text, 20 px for supporting participant text, and 16 px in caregiver forms. Support browser zoom to 200% without hiding essential controls or overlapping text.
- Use touch targets at least 56 × 56 CSS px in participant view, with at least 12 px between adjacent targets. Caregiver controls should be at least 44 × 44 CSS px.
- Target text contrast of at least 4.5:1 and essential control/state boundaries of at least 3:1. Pair color with text or icons; never encode a state only in color.
- Use plain fonts, sentence case, short labels, and consistent placement. Avoid icon-only buttons, hover-only actions, double-tap requirements, and gesture-only navigation.
- Support keyboard navigation, visible focus, meaningful accessible names, and screen-reader announcements for state changes without reading an entire transcript after every turn.
- Display spoken content as text. Offer volume and speech-pace settings, a silent mode, and reduced motion. Do not assume that a saved hearing or vision note configures these automatically.
- Avoid background music, flashing, overlapping voices, auto-scrolling text that cannot be stopped, and unnecessary sound cues.
- On the primary demo device, keep the companion, current task, and persistent controls visible together. On smaller screens, let content scroll while controls remain accessible without obscuring it.

Confirm the primary device and supported language before implementing layouts. Do not claim broad accessibility compliance from these targets alone.

## 10. Failures and Stackchan behavior

| Event | Screen behavior and recovery |
| --- | --- |
| Microphone permission denied | “The microphone isn't available.” Offer text/touch use and an optional permission retry. |
| Local STT/TTS process failure | Stop the affected audio turn, explain speech is unavailable, and offer text/touch or retry. Do not silently send audio/text to external speech services. |
| Team server unavailable | Stop capture/output under the local watchdog; show unavailable status and offer explicit app continuation only if a working backend is reachable. App fallback alone cannot repair a shared backend outage. |
| Model timeout or lost connection | Stop progress after the timeout. Offer retry or home; keep help and stop usable. Do not replay late output. |
| Photo unavailable | Keep caption context clearly separate from the missing image; offer retry or another activity. |
| Journal save failure | Show unsaved status with retry in caregiver view and the session-ended screen. Do not claim durable storage. |
| App reload or restart | Start with microphone off. Do not resume a conversation or replay speech automatically; label any persisted interrupted session accurately. |
| Stackchan disconnect | Stop robot capture/output, pause the shared session, and show **Continue in app** or **Stop**. Reconnection does not resume automatically. |

For the preferred Stackchan experience, use one active audio endpoint at a time to avoid duplicate voices or recordings. The robot must communicate session state directly; the app mirrors that state and supplies companion controls as needed. A robot-native experience requires an accessible local stop and clear microphone indication. If those are unavailable, label the setup app-assisted and keep app controls within reach. Robot expressions mirror listening/processing/speaking states and never imply that it can detect feelings, check a room, or guarantee safety. Confirm local stop and disconnect behavior before enabling hardware; do not treat an app control as proof that an unreachable robot stopped.

TurtleBot navigation and activity-library browsing are outside this core screen flow. They require separate interaction details if selected as stretch work.

## 11. Experience review checklist

Rehearse with teammates using fictional data. Record confusing wording and control placement as design feedback, not clinical outcomes.

- Complete profile setup, preview, appearance choice, conversation, all four activities, and journal review without hidden controls.
- Repeat a question, leave a long pause, provide unclear speech, and decline an activity; verify patient wording and no prompt loops.
- Exercise music pause/next, guessing not-sure/skip/reveal, photo next/previous/just-look, and voluntary exit without failure labels.
- Pause and stop during listening, processing, and speaking. Verify microphone state and that delayed output cannot restart the session.
- Exercise text input, denied microphone access, service timeout, missing photo, save failure, and reload recovery.
- Demonstrate real contact with an opted-in teammate: sending, delivery unknown, delivery where supported, authenticated acknowledgment, failure, no response, and backup escalation. Rehearse with nobody beside the participant.
- Exercise stop and request cancellation separately; verify late acknowledgments update the same request without replaying speech or reopening capture.
- Confirm isolated simulation never sends real messages and labels every state.
- Correct a profile relationship and a journal summary separately; verify the next conversation uses the profile correction.
- Check keyboard use, 200% zoom, contrast, reduced motion, silent mode, and control visibility on the primary demo device.
- Test the preferred flow on Stackchan first: introduction, start, voice turns, pause, resume, stop, and caregiver contact. Record which actions require app assistance.
- Check robot visual readability and input usability separately for photo and guessing activities; rehearse explicit larger-screen handoffs where needed.
- Disconnect during robot interaction and confirm local capture/output behavior and an explicit app handoff without duplicate audio or automatic restart.
- Repeat the full participant flow in standalone app mode. If hardware is unsuitable, record the limitation and present the fallback honestly.

Before model integration, review the [safety and privacy specification](safety-and-privacy.md) and use its example conversations and expected responses as implementation checks. Before hardware integration, review and verify the device control and disconnect contracts in the draft [technical specification](technical-spec.md).

## 12. Supervised live-demo participation

Lukas coordinates an optional live demo with Grandma. Her health status is unspecified. Privately rehearse with the same fictional profile and approved generic media first; explain microphone/local speech/external LLM processing and obtain agreement to participate and separate permission for public projection or recording. Keep excerpt saving off; do not seed private family details without explicit permission. A familiar support person stays present, stop is immediate, participation is optional, and a teammate can take over without explanation to the audience. Do not surprise her with a distressing prompt or public ability test. See the safety specification and build plan for readiness and fallback checks.

## 13. Design implementation inventory

[Kylie’s design and UI guide](kylie-design-guide.md) maps the participant, caregiver and robot interfaces to specific pages/modes, reusable controls, state variants, inspiration prompts and ordered deliverables. It applies this experience specification; it does not create another admin product, backend, or activity engine.

## 14. Committed camera and robot-feedback flows

Implement **F13 camera check-ins before F14 petting/reaction polish**, following [robot-capabilities-spec.md](robot-capabilities-spec.md). Essential stop/capture controls remain first.

- Caregiver Settings gains separate camera permission/viewer setup; Overview links to protected `/caregiver/check-in`. That page handles disabled, unavailable, requesting, awaiting local Allow, starting, live, stale/lost, declined, expired and ended states. Include who/which device, duration, freshness and End check-in; do not autoplay a camera on page load.
- Robot and participant app show a request panel naming the configured caregiver, Allow camera and Not now. Only local acceptance can start; no response leaves capture off. Active video keeps a persistent Camera on notice and Stop camera available. Do not depend on color, sound, another open browser, or model understanding to indicate/stop capture.
- The initial camera mode pauses audio and all activities, clearing pending turns/talk effects. End leaves the prior activity paused at its position; explicit Resume is required. Camera does not provide a call or automatically summon/acknowledge help. Global Stop/Get help end video; mic mute alone does not.
- After the camera gate, add a restrained local top-strip petting response and optional bounded motion after release. No pet starts mic/camera or overrides pause/help. Reduced motion applies to every avatar. Preserve true listening/camera status during expression overlays.
- Caregiver Overview/Device settings show measured robot health/link freshness and unavailable values clearly. Side LEDs supplement readable state labels; they are not touch panels. Device telemetry is never presented as participant wellbeing.

All permissions, timeouts, data handling and failure gates are specified in the robot capability spec. These flows are planned; do not label them live until hardware and access checks pass.

## 15. Preferences that develop with the person

Use the flows in [personalization-and-matching-spec.md](personalization-and-matching-spec.md). Introduce a separate Remember preferences between visits setting with clear agreement; show session-only adaptation while off. Participant conversation offers Like this topic, Different topic and Don't ask about this; a clear spoken refusal also stops the topic without demanding feedback or a reason. Repeated positive choices can gently change suggested topics, never assert new biography or a clinical interpretation.

Caregiver Profile adds Interests & boundaries: preferred/avoided topics and retired objects with source labels, tentative versus explicit status, edit/remove/undo and Forget learned preferences. Show remembering off, saving, failed save, conflict and no learned preferences. Turning remembering off stops use/writes; forgetting separately deletes saved learned policy. Do not show miss counts or ability labels. A topic change/retirement cancels old prompts and queued audio; no auto-retest. Preserve participant-initiated conversation and all help/stop controls. These choices do not alter camera permission or communication-support presets.

## 16. Confirmed whiteboard flows

### Teach Lemmi — participant teaches a prompted object/topic

This is the user's clarified direction: **Lemmi gives a simple object or topic and asks the participant to teach it.** Offer Teach Lemmi from Home/activity chooser; it opens the existing conversation surface in `teach_lemmi` mode. It is not a fifth separate game/reducer or caregiver data-entry task.

Show one approved, policy-eligible object/topic, with optional image and supplied name/context. Example: “Here is a watering can. Would you like to tell me how someone uses it?” Start capture only through the normal explicit listening flow. Accept an explanation without marking it correct/incorrect; acknowledge briefly and offer at most one optional follow-up. Use an honest invitation to share, not a claim that the robot needs the person or will be upset if refused.

Persistent choices: Speak now, Different topic, Not sure, Finish and shared Pause/Stop/Get help. A refusal changes topic without persuasion; object-specific uncertainty uses the existing first-occasion/session-hide and later retirement policy. Generic silence/STT failure is not a negative preference or inability signal. No automatic rephrasing/retest loop. While policy saves, output cancels or service fails, show the actual pending/paused/unavailable state; never silently repeat an excluded topic. No eligible topics offers music, just look or finish. Camera/pause/stop/profile changes invalidate the prompt and pending answer.

The requested teaching limit is fifteen minutes of active conversation, including waiting, generation and output; pause/disconnect and no-eligible-topic waiting do not accrue time. Do not display a countdown. At the limit finish teaching, cancel pending capture/generation/output and return to ready with capture off. Different topic does not reset elapsed time. The current local text demo and source implementation limits are described in the [tester manual](teach-lemmi-tester-manual.md); durable observations and later-session retirement are still integration work.

### First visit and growing familiarity

Start with a short greeting and neutral approved choices when profile context is sparse. Ask one optional general interest question rather than a biography questionnaire. Later suggestions use permitted explicit/tentative preferences, rotate topics and honor avoid/retired policy. Never fill missing profile fields from model guesses or claim recall of an unretained conversation.

### Explore pictures

Within photo album talk, offer an approved place/scene collection (for example, town pictures), with supplied captions/context, Look/Talk/Next/Previous/Finish. It is a media-pack variation, not a live camera, map, navigation or location-tracking feature. Avoid asking whether the person recognizes a place or assuming they lived there.

### Caregiver overview and highlights

Design Overview around clear cards: profile summary, device/contact readiness, recent activities, open requests and permitted journal highlights. Each highlight links to its dated/source-labeled record; an AI highlight retains its review status. Missing summary/events is an ordinary empty/error state, not a reason to invent content. Sensitive journal details stay behind caregiver authorization and out of notification previews.

If time remains, add factual activity-use duration by date/activity. Call it Recorded activity time, not engagement/cognition/mood. Exclude known paused/camera/disconnected time, show gaps/unknown durations and avoid interpretation or comparison goals. Charts are optional after the core overview; no extra conversation retention is enabled.

### Final stretch entry

Solitaire is the bottom/last stretch item, after all committed work and other optional features. Do not render it as a working card until implemented; a planning item or clearly unavailable state cannot satisfy a demo criterion.


November 14 integration clarification: the user explicitly authorized full fictional multi-profile support. Alex remains the initial profile; separately created fictional participants have isolated authorized context/assets/sessions. Existing labeled example cards remain preview-only. Multiple endpoints may observe one profile, with explicit handoff and one active audio owner. This supersedes earlier Alex-only demo restrictions for fictional profiles only; it does not authorize real participant data or infer care readiness. See [backend API](backend_api.md) and [endpoint handoff](handoffs/anay-multi-profile-endpoints.md).
