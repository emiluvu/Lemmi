# Lemmi — Product specification

**Status:** Draft for team review  
**Version:** 0.2  
**Scope:** Hackathon prototype

This document turns the direction in the [README](../README.md) into a proposed build scope and observable acceptance criteria. The defaults below are planning decisions, not evidence of clinical benefit or suitability for real-world care. Outstanding decisions are listed at the end.

## 1. Product purpose

Lemmi helps a person living with dementia participate in familiar conversation and enjoyable activities, using caregiver-provided context. It gives caregivers a factual journal of everyday interactions and preferences that they can review and correct.

Stackchan is the preferred participant interface when the hardware supports it. The goal is for conversation, expressions, and suitable activities to happen through the robot with minimal dependence on a separate screen. The app handles caregiver setup and journal review, supplies companion visuals or controls when needed, and retains a complete standalone participant experience.

This is a participant-experience goal, not a requirement for onboard AI computation. Speech recognition and synthesis run on the selected team server alongside the backend and PostgreSQL; language generation uses an external LLM API. Hardware feasibility must be checked early rather than postponing Stackchan until the app is finished.

### Problem to address

Personalized companionship takes context: the names someone uses, the activities they enjoy, and the topics that need care. Families need a manageable way to supply that context and understand what happened during an interaction. Lemmi explores bringing those pieces together without turning conversation or play into a cognitive assessment.

### Product goals

1. Make starting, participating in, and stopping an interaction straightforward.
2. Use approved personal context accurately and respond patiently to repetition or uncertainty.
3. Offer activities that remain welcoming when someone needs help or chooses not to answer.
4. Help caregivers review what happened without diagnostic interpretations.
5. Demonstrate a robot-centered participant experience where feasible, with clear app handoffs and a complete standalone app fallback.

## 2. Users and demonstration setting

| Role | Need | Prototype capability |
| --- | --- | --- |
| Participant | A comfortable, simple interaction with control over continuing or stopping. | Talk with Lemmi, choose an activity, pause, stop, or request help. |
| Caregiver | A way to personalize interactions and review observations. | Create and edit a profile, approve photo context, configure sensitive-topic guidance, and review the journal. |
| Team demonstrator | A repeatable way to show the complete experience. | Load a fictional profile, role-play the participant and caregiver, and reset demonstration data. |

The initial design audience is people with mild to moderate dementia using Lemmi with caregiver support, including sessions when the caregiver is remote rather than physically present. This is a design assumption, not a validated eligibility rule. The initial rehearsal uses fictional profiles and teammates. Lukas is planning an optional supervised live demo with Grandma; her health status is unspecified and must not be inferred. Use fictional biography/media unless separately authorized, privately rehearse first, explain local speech/external LLM processing, obtain her freely given agreement to participate, and provide immediate stop and a teammate fallback. No clinical testing or benefit claim is part of the demo. If participation involves dementia-specific care needs, complete the care-professional/person-centered review described in the safety specification before proceeding.

## 3. Scope and priorities

**P0** means required for the core demonstration. Stackchan feasibility work is P0; participant integration is a primary target, conditional on that check. **P1** means optional after the core flow and its failure cases work. **Deferred** means outside this hackathon build.

| ID | Capability | Priority | Boundary |
| --- | --- | --- | --- |
| F1 | Caregiver profile setup and editing | P0 | One active fictional participant profile; no multi-household management. |
| F2 | Companion appearance | P0 | Five avatars: dog, cat, bunny, bird, and lemming; selection stays stable across sessions and app/robot rendering. |
| F3 | Personalized conversation | P0 | Voice input and spoken output, with visible text and touch controls. Text input is a demonstration fallback. |
| F4 | Photo album talk | P0 | Small approved album with caption/context per photo, next/previous/just-look controls, and optional conversation. |
| F5 | Gentle 20 questions | P0 | Lemmi asks yes/no questions and guesses a chosen familiar object; visible object/picture, not-sure/skip/reveal, no pressure or recall score. |
| F11 | Music playlist | P0 | Small approved playlist with explicit play/pause/next and shared audio ownership; no paid streaming integration required. |
| F6 | Pause, stop, and caregiver contact | P0 | Always available during conversation and activities; real contact to a verified, opted-in team test recipient is the target. Simulation remains a labeled fallback, not completion of real delivery. |
| F7 | Caregiver journal | P0 | Session history, activity events, source labels, and reviewable AI summaries. |
| F8 | Stackchan participant interface | P0 feasibility; primary integration target if feasible | Check microphone, speaker, display, input controls, connectivity, and local stop first. Preserve essential controls/status; implement F13 before F14 petting/motion polish, alongside conversation and supported activities using the shared session. |
| F15 | Evolving per-profile preferences | P0 | Separate remembering permission; structured interests/avoidances, source labels and edit/forget; no inferred clinical state or automatic biography changes. |
| F16 | Object matching and item retirement | P0 | Fourth activity: visible picture pairs, Show me/Not sure/Next/Finish; retire repeatedly unfamiliar canonical objects across proactive prompts, no scoring/retests. |
| F13 | Short caregiver camera check-ins | P0; before F14 | Signed-in authorized viewer, explicit local Allow, visible notice/Stop camera, bounded session, no recording or vision inference. |
| F14 | Local petting and robot feedback | P0; after F13 gate | Top-strip strokes, restrained expressions/motion, readable status cues and measured device telemetry; no side touch or participant-health inference. |
| F9 | Controlled TurtleBot demonstration | Deferred this iteration | Keep as a future add-on; assign software ownership again before starting. The new team plan prioritizes the robot/audio and four activities. |
| F12 | Caregiver-selected conversation support | P0 after first integrated slice | Three named presets with previews, explicit save/apply scope, no diagnosis/staging or automatic changes. See communication support spec. |
| F10 | Reviewed activity library | P1 | Built-in activity packs only; no public uploads or executable plugins. |
| F17 | Teach Lemmi | P0; reuse conversation path | Lemmi offers one simple eligible object/topic and invites the participant to explain it; optional response/change/finish, no test or biography auto-write. |
| F18 | Solitaire | Last stretch priority | Only after committed features and failure checks; no core dependency or implementation until capacity remains. |

Music, gentle 20 questions, and photo album talk replaced the earlier sorting plan. The November 13 requirement adds object matching as a fourth activity. Music remains first integration; the complete target now includes all four and F15 preference policy. Stable capability IDs are retained for other features; F11 is added without renumbering prior contracts.

F13 and F14 are committed additions: camera precedes petting/reaction polish after foundational access/local-control work. The [robot capability spec](robot-capabilities-spec.md) defines acceptance and responsibilities. Hardware feasibility is unverified; failure remains an unmet criterion, not a completed feature.

### Whiteboard refinements and final stretch priority

The confirmed whiteboard direction adds F17 Teach Lemmi as a guided conversation mode, not a fifth independent game engine. Four built-in activity reducers remain required; the chooser may also offer Teach Lemmi as an entry into conversation. F4 gains approved place/scene exploration (for example, a town), within photo album talk. Caregiver Overview gains factual recent-use/journal highlights; activity-duration charts are optional after the basic cards. Solitaire (F18) is **last on the stretch list**, after all committed work and any other optional work.

### Deferred capabilities

- Diagnosis, cognitive screening, decline scores, treatment recommendations, or clinical decision support.
- Medication management, emergency monitoring, and guaranteed detection of distress or urgent medical problems.
- Unsupervised household navigation or language-model control of robot motors.
- Always-on background listening/video monitoring, face recognition, automated video analysis, audio/video recording, relative impersonation, and cloned family voices. Short F13 live check-ins are explicitly in scope.
- Public plugin marketplace, third-party code execution, and unrestricted access to personal context.
- Real patient records, clinician integrations, production account management, and automatic emergency-service dispatch. Verified, opted-in team contact details are permitted solely to test caregiver notifications.

## 4. Core user journeys

### A. Prepare a personalized experience

The caregiver signs into a protected caregiver area. The participant uses a caregiver-established app/device assignment without a login screen. Caregiver-admin functions and participant activities share the same application but have separate navigation, permissions, and data projections; no separate global platform-admin product is in scope.

The caregiver creates a fictional profile, enters preferred name and interests, adds important people and an approved photo, and supplies communication preferences and sensitive-topic guidance. They preview and save the information before starting a participant session. Optional fields can be left blank.

### B. Start and hold a conversation

The participant sees the selected appearance on Stackchan where supported and starts using an accessible robot control or an explicit app-assisted start. After starting, listening, processing, and speaking states are visible at the active interface. Lemmi uses approved context, gives short responses, and asks at most one question at a time. The participant can speak, use the text fallback, pause, stop, or ask for help.

### C. Participate in an activity

The participant chooses music, gentle 20 questions, or photo album talk. Music can be enjoyed without responding. Photo captions supply context without testing recognition. In the guessing game, Lemmi asks one simple yes/no question at a time about a visible chosen object/picture; not sure, skip, reveal, and leaving are normal choices. “20” is a round bound, not a demand to complete twenty questions. The participant can leave at any point.

### D. Request human help

The participant selects Get help or makes a recognized request to contact a caregiver. Lemmi starts a request to the configured, verified primary contact without requiring a nearby person or a model approval. It distinguishes sending, provider acceptance, reported delivery, caregiver acknowledgment, failure, and no response. A backup contact is tried under the configured escalation plan. Lemmi never promises that help is coming. Recognized urgent concerns can trigger notification under an explicitly enabled, preauthorized policy; this is not guaranteed monitoring. The hackathon tests this with opted-in team recipients and fictional concern content, with labeled simulation available for rehearsal.

### E. Review and correct

The caregiver opens a session journal, distinguishes recorded events from statements and summaries, and reviews or corrects the summary. They can separately edit approved profile facts. Later conversations use the corrected profile; historical journal entries remain identifiable as historical records.

## 5. Functional acceptance criteria

These checks apply to the prototype demonstration. Passing them does not establish clinical safety or effectiveness.

### F1 — Profile setup

- The caregiver can create, save, reopen, and edit the active fictional profile.
- The only required personal field is a preferred name. Optional fields include language, interests, important people and relationships, communication preferences, sensitive topics, and comfort strategies.
- Approved profile facts show their source as caregiver-provided. Patient statements and generated summaries cannot automatically become approved facts.
- When a caregiver corrects a relationship, the next conversation turn using that relationship reflects the correction. Previously supplied context must not override it.
- The caregiver can delete the fictional profile and its associated journal from the prototype's storage. Limits involving any external service must be documented before integration.

### F2 — Appearance

- The participant can choose dog, cat, bunny, bird, or lemming, using stable IDs `dog`, `cat`, `bunny`, `bird`, `lemming`. No sixth neutral avatar is required; reduced motion is a setting for every avatar.
- All five share the same behavior and controls. Avatar selection is visual preference, not a different personality, voice, care level, or capability. Preview and confirm changes explicitly.
- The selected appearance persists across sessions and is consistent between robot and app where rendering is supported; unsupported appearances require an explicit preview of the available alternative.
- Appearance changes require an explicit choice; Lemmi does not unexpectedly switch characters.

### F12 — Conversation support

Use **Conversation support**, not a clinical “dementia scale”: Conversational, Guided, Quiet companionship. Guided is the proposed initial default. A caregiver selects/reverses a preference with the participant where possible, previews its effect, and saves for the next session or explicitly applies now with pause/cancellation and explicit continuation. No score, inferred stage, automatic change from game/speech performance, or change to stop/privacy/help rules. Full evidence boundaries, preset behavior, implementation order and checks are in the [communication support specification](communication-support-spec.md).

### F3 — Conversation

- A saved interest or approved family relationship can inform a relevant response without adding invented personal details.
- When a requested personal fact is absent, Lemmi acknowledges uncertainty instead of supplying a fabricated answer.
- Ordinary responses use a default of one to three short sentences and at most one question. This target will be refined in the experience specification.
- Repeating a question produces a patient response without criticism or a demand to remember the earlier answer.
- Unclear speech prompts a gentle retry or a touch/text alternative. Recognition failures are not presented as participant errors.
- Silence does not trigger repeated prompts in a loop. Listening timeouts and follow-up timing will be defined in the experience specification.
- Lemmi follows configured sensitive-topic guidance, does not introduce distressing biography unprompted, and does not affirm frightening beliefs as verified facts.
- Stopping cancels or suppresses pending speech and responses. A response arriving after stop cannot restart the interaction.

### F17 — Teach Lemmi

Lemmi selects a simple approved and currently eligible object/topic and invites the participant to teach it: “Here is a watering can. Would you like to tell me how someone uses it?” Keep the object/name visible if helpful; never require identification or a correct answer. Accept an optional explanation with a brief acknowledgment, at most one gentle follow-up, and Change topic / Not sure / Finish. No explanation is graded, challenged, stored as verified biography or used as evidence of ability. Refusal/uncertainty follows F15/F16 eligibility/retirement; move on without probing. Use existing conversation, privacy, help and cancellation services.

### F4 — Photo album talk

- Select an approved album and move next/previous without inventing captions or relationships.
- Each photo has caregiver-approved caption and discussion context. Supply that context; never quiz family recognition.
- Just-look stops capture and prompts; talk requires an explicit action through the existing conversation service.
- Missing images/captions produce clear recovery, not generated personal facts. Handoff preserves photo/session position.
- Explore pictures is a variant using approved places/scenes and caption/context, such as a town. Offer Look, Talk, Next and Finish; no place-recognition quiz, inferred personal history, live street view or navigation service.

### F5 — Gentle 20 questions

- Default proposal: Lemmi asks and guesses; the participant chooses a familiar object or picture and may keep it visible throughout. No need to memorize or hide it.
- Offer yes, no, not sure, skip, reveal/finish, and stop. Use one short reviewed question at a time, supported by a bounded deterministic question tree/candidate set initially.
- Uncertain or conflicting answers do not produce blame, a score, or a trap. Offer a guess, another object, or another activity without insisting.
- A round ends by twenty questions at most and can end sooner. Do not display a failure counter, countdown, or clinical interpretation. The direction is a design choice to review with the participant, not a validated dementia intervention.

### F11 — Music playlist

- Use approved, legally usable demo tracks with IDs, titles, source/permission notes, and known supported formats. No streaming-service account is required.
- Explicit play/pause/next and bounded volume work; capture is off during music. Enter conversation by explicitly pausing music first.
- Session pause/stop/help silence music and invalidate queued playback. Resume is explicit; one robot/browser speaker endpoint at a time.
- Track unavailable, unsupported format, autoplay denial, and disconnect show recovery. Never claim playback from a selection alone; use endpoint receipts.
- Do not add song-recognition quizzes, inferred emotion/cognitive scores, or automatic listening-history recommendations. Static approved music files do not permit retention of microphone recordings.

### F6 — Session control and help

- Pause, stop, and help remain available during conversation and all four activities, without requiring a spoken command.
- Pause stops microphone capture and speech output. Resume requires an explicit action; stop ends the active interaction.
- The microphone is inactive before start and after stop. The visible listening indicator matches capture state.
- Caregiver setup captures a verified primary and optional verified backup contact destination, channel, notification permission, and escalation preferences. A test request confirms routing; contact details stay out of model context.
- A help request works without someone physically present and without waiting on a model or speech service. A recognized concern may also enter the same routing flow under a preauthorized policy.
- Real sends distinguish provider acceptance, provider-reported delivery where available, explicit caregiver acknowledgment, failure, and no acknowledgment. Unsupported receipts remain unknown.
- An acknowledgment requires an authenticated caregiver action tied to the request. It does not establish arrival or resolution.
- Bounded retries, backup escalation, expiry, and an unsuccessful-contact state are required. See the safety and experience specifications for draft defaults.
- A failed or unacknowledged request cannot display a success/arrival claim. Simulation is labeled at every state and cannot send real messages.
- Stopping conversation stops recording/output but does not silently cancel an already initiated help request; its status remains accessible. Contact-request cancellation is separate and cannot recall delivered messages.

### Caregiver overview and profile refinements

Provide readable cards for profile summary, device/contact readiness, recent activities, open requests and journal highlights with links to source records. Optional use-duration charts describe recorded activity time only, never cognitive ability, happiness, aggression or clinical progress. Empty/incomplete records are explicit. Setup supports optional caregiver-entered life context/history, interests, hobbies and approved media; preview/source-label before use. No automatic extraction of private facts from uploaded documents.

### F7 — Caregiver journal

- Ending a session creates an entry with start/end times, activities selected, activity events such as hint requests, and recorded technical interruptions.
- Each displayed item is identified as a measured event, patient statement, caregiver observation, or AI-generated summary.
- Statement-excerpt saving is off by default and can be enabled for a fictional demo session. When off, no utterance text or paraphrases are persisted, including in summaries. See the safety and privacy specification for revocation and deletion behavior.
- Stored patient statements are text excerpts with clear attribution; raw audio is not retained by the application in the proposed demo configuration. Local speech-engine temporary files/logs must be checked; external LLM handling remains an integration decision.
- AI summaries are labeled as unreviewed until a caregiver reviews them, and the caregiver can correct or remove them.
- If summary generation fails, factual events remain available and the app indicates that no summary was generated.
- No journal view presents cognition scores, diagnosed emotions, inferred deterioration, or claims that an activity improved cognition.

### F8 — Stackchan participant interface

- Before committing to the robot demo, record the available audio input/output, display readability, physical controls, connectivity, and local stop/disconnect behavior. Record each participant action as robot-native, app-assisted, or unavailable.
- When feasible, the participant can start, converse, observe interaction state, pause, stop, and request caregiver help through Stackchan without navigating the app. Any action needing app assistance must be identified before handoff.
- Robot-native stop and microphone state must be verified before claiming that the robot works independently of participant app controls. Voice commands alone are insufficient for stop.
- Activities use the robot alone only when their visuals and controls are usable. Otherwise Lemmi explicitly offers the larger app view, retaining the same activity and session.
- The complete participant experience remains available in the app when Stackchan is absent or unsuitable.
- A connected robot uses the same active profile and session as the app; it does not maintain a conflicting personal history.
- Disconnecting the robot stops its interaction and leaves the app in a clear state with an explicit way to continue.
- Stop applies to both app and connected robot output. Exact controls and disconnect behavior must be specified before hardware integration.

### F15/F16 — Growing preferences and matching

Follow [personalization-and-matching-spec.md](personalization-and-matching-spec.md). Keep profile-specific preferred/avoided topics and retired objects across sessions only with separate remembering permission; no raw dialogue or biography inference. Explicit refusal stops immediately. Draft default: first explicit uncertainty hides the canonical object this session; a second distinct later occasion retires it across games and proactive conversation without deliberate retesting. Silence, wrong taps, Skip and Show me do not establish unfamiliarity. Participant-initiated mention and urgent/help responses remain possible.

Matching is an optional visible sample plus two image choices, with Show me/Not sure/Another picture/Finish, no naming requirement, timer, wrong-answer tally or difficulty escalation. Eligible content is filtered before selection; no eligible items offers another activity/finish. Policy changes cancel stale prompts; forget/revocation/deletion cannot be undone by delayed work. Caregivers can inspect source-labeled preferences and explicitly undo retirement, respecting present refusal.

### F13 — Camera check-ins, first added robot priority

Use the flow and gates in [robot-capabilities-spec.md](robot-capabilities-spec.md). A permitted caregiver requests; the participant locally Allows or declines; no response leaves capture off. Start pauses activities and audio, shows who is viewing and Stop camera, and auto-ends after a bounded duration. Local stop/help, lost connection, expiry or revoked access ends capture and blanks stale frames. No automatic restart, recording, face identification, model vision or camera opening from alerts. Unauthorized viewers cannot access frames.

### F14 — Local robot interactions, after F13

Top-strip strokes yield a debounced local gentle response; status/stop/help remain authoritative. Motion is bounded, optional and disabled while touch/holding is detected; use static reactions until hardware behavior is verified. Reduced motion works for all five avatars. Show measured robot battery/link data with freshness, not participant health judgments or invented battery/runtime estimates. All gates in the robot capability spec require observed hardware results.

## 6. Failure behavior

| Situation | Required product behavior |
| --- | --- |
| Microphone permission denied | Explain the issue briefly and offer touch/text interaction. |
| Speech is not understood | Offer a gentle retry or alternative input; do not guess personal facts. |
| Internet or model service unavailable | Stop waiting visibly, explain that conversation is unavailable, and keep stop/help controls usable. Offline conversation is not required. |
| Robot disconnects | Show the connection state and allow explicit continuation in the app. |
| Journal save fails | Indicate that the session was not saved; do not show a misleading success state. |
| Contact fails or goes unanswered | Show accurate status, apply bounded retry/backup routing, and offer retry or another configured contact. Do not assume someone is nearby or that help is coming. |
| Participant refuses or asks to stop | End the current interaction without persuasion or automatic restart. |
| Sensitive or urgent concern is expressed | Use the reviewed human-help response defined in the safety specification; make no diagnosis or assurance of automated protection. |

## 7. Demonstration success criteria

The core demonstration is ready when a teammate can complete this sequence using fictional data, with Stackchan as the preferred participant interface and app assistance only where the feasibility check calls for it. Repeat the participant flow in standalone app mode:

1. Create a profile and choose an appearance.
2. Hold a conversation that accurately uses an approved interest and relationship.
3. Complete or voluntarily leave all four activities, including skipping an uncertain answer and choosing just-look.
4. Pause, resume, stop, and send a fictional help request to a verified team recipient. Demonstrate explicit acknowledgment, failure, no response, and backup escalation. Exercise labeled simulation separately.
5. Review the journal and correct a summary and a profile relationship.
6. Start another interaction and observe the corrected relationship being used.

Also role-play repetition, silence, unclear speech, an unknown personal fact, a sensitive-topic question, refusal, and a service outage. Confirm that each produces the behavior described above. If Stackchan cannot support the intended flow, document the tested limitations and demonstrate the app fallback. Describe that result as a fallback demonstration, without claiming that the robot-centered target was achieved.

These are product behavior checks. No success criterion depends on cognitive improvement, mood diagnosis, longer engagement, or replacing human contact.

## 8. Decisions to resolve before implementation

| Decision | Proposed default or next step |
| --- | --- |
| App platform and devices | Bun + SvelteKit/TypeScript web app and HTTP backend, native Bun realtime gateway, Bun worker, local PostgreSQL, and local STT/TTS; confirm the primary demo device, browser, and pinned versions. |
| Speech and LLM processing | Select and benchmark local STT/TTS engines/models on the chosen host. The LLM remains external; record its API handling and total response latency. |
| Server location and local data | Evaluate the Ethernet/GPU lab desktop first, with laptop and homelab alternatives; verify demo-network reachability, local PostgreSQL/private photo storage, remote access, and laptop fallback. |
| Profile and journal storage | Select storage and a demo-data reset mechanism; document what persists and how deletion works. |
| Caregiver view and contact access | Keep fictional demo role switching separate from authenticated contact setup and acknowledgment. Protect real test destinations even when biography is fictional. |
| Caregiver contact channel | Choose a provider and channel with a verified team test recipient; implement authenticated acknowledgment, bounded retry/escalation, and minimal alert content. See the safety specification for draft timing and retention. |
| Interaction timing and layout | Define silence thresholds, readable controls, contrast, audio settings, and activity item counts in the experience specification. |
| Sensitive-topic and urgent-concern scripts | Write example inputs and expected behavior in the safety and privacy specification before connecting conversation to the model. |
| Stackchan feasibility and ownership | First validate audio round-trip, readable state display, accessible start/pause/stop/help inputs, connection loss, and local stop. Assign an owner and record which flows are robot-native versus app-assisted before committing to the demo route. |
| Stretch-goal cutoff | Schedule stretch work only after the complete P0 flow and failure checks pass. |

## 9. Business direction — hypotheses to validate later

Proposed commercial model: a companion-service subscription plus optional robot sales. Preserve the full app experience for users without hardware. Hardware procurement/support, service costs, willingness to pay, accessibility, and what continues if service ends remain business questions; do not invent prices, customer validation, or treatment claims.

A future reviewed activity marketplace may include suitable third-party activity/content companies. Start with reviewed, declarative built-in packs sharing one activity contract. Later evaluate partner content quality, permissions, accessibility, privacy/data needs, support, and commercial terms. No public uploads, executable third-party code, billing, payment collection, revenue sharing, partner API integration, or license enforcement enters the hackathon P0 build. Core stop/help/privacy controls must not be gated by upsells. Partners/vendors have not been selected or contacted.

## 10. Related documents

- [README](../README.md): project overview and research starting points.
- [Safety and privacy specification](safety-and-privacy.md): detailed response boundaries and data rules.
- [Experience specification](experience-spec.md): screens, interaction details, accessibility, and example flows.
- [Technical specification](technical-spec.md): data contracts, architecture, service integration, and device control.
- [Build and demo plan](build-and-demo-plan.md): ownership, milestones, Codex briefs, checks, and presentation script.
- Planned `research.md`: evidence and sources separated from design assumptions.

- [Integration contracts](integration-contracts.md): named ownership, activity engine/UI seam, typed commands, mocks, audio/assets, and handoffs.

- [Kylie design and UI guide](kylie-design-guide.md): interface/page inventory, inspiration workflow, avatar deliverables and frontend order.
