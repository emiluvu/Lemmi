# Lemmi — Kylie’s design and UI guide

**Status:** Draft design/implementation brief  
**Owner:** Kylie  
**Counterparts:** Lukas (activity logic), Anay (API/auth/data), Emilia (Stackchan rendering)  
**Scope:** Hackathon interfaces and source art; no billing, store, marketplace, or platform-admin build

This guide turns the [experience specification](experience-spec.md) into pages and design tasks. Read it alongside [integration contracts](integration-contracts.md) and Kylie's brief in the [build plan](build-and-demo-plan.md). Routes below are proposed UI paths, not existing pages. Confirm them with Anay during scaffolding and keep the guide updated if they change. `/v1` remains Anay's backend boundary.

## 1. What Kylie is designing

Lemmi has three interfaces, sharing one visual language and session:

| Interface | Audience and use | Design direction | Ownership boundary |
| --- | --- | --- | --- |
| Participant app | Person talking, listening, playing, stopping, or asking for help; standalone or beside the robot | Calm, readable, one task at a time, large labeled controls, minimal navigation | Kylie renders Lukas's activity views and Anay's session state; no duplicate rules/backend. |
| Caregiver app | Setup, approved content, contact readiness/requests, journal, device/preferences | Clear forms and descriptive status; factual labels rather than clinical scores | Kylie designs screens; Anay enforces authorization and persistence. |
| Stackchan display | Participant-facing avatar and actual interaction/capture status on K151 | Recognizable simple faces, restrained motion, minimal readable status | Kylie supplies art/state map; Emilia selects encoding, implements controls/rendering, and verifies device limits. |

Caregiver/admin means managing the assigned participant profile. There is no separate global admin console. Participants have no password flow. Do not put caregiver forms, private guidance, contacts, or journal text in participant page loads. Switching a shared device to caregiver mode requires the protected route and pauses participant capture; a remote caregiver opening their dashboard does not take over the robot.

## 2. Find inspiration with a purpose

Time-box the initial pass to about 30–45 minutes, then wireframe. The goal is a few concrete design decisions, not a huge collection or a finished visual brand before integration.

### Step A — search by the task, not just the brand mood

Use these as search prompts for screenshots, product walkthroughs, design galleries, or accessible-interface examples. They are search phrases, not validated designs or required vendors.

| Surface | Useful search phrases | Patterns to inspect |
| --- | --- | --- |
| Participant home/conversation | “accessible voice assistant interface large controls”, “simple tablet companion interface older adults” | Primary action, listening visibility, readable text, stop placement, absence of clutter. |
| Music | “accessible music player large buttons”, “simple playlist tablet interface” | Current track, play/pause, next, volume, active speaker, user-initiated playback. |
| Guessing and photo talk | “yes no choice interface accessibility”, “simple photo album caption viewer” | One question, uncertain/skip choices, photo/caption hierarchy, next/previous. |
| Caregiver setup | “caregiver profile setup form”, “accessible multi step onboarding preferences” | Short sections, optional fields, save feedback, private versus public information. |
| Contact/journal | “notification acknowledgment status interface”, “activity timeline source labels” | Pending versus delivered versus acknowledged, factual entries, no-summary/error presentation. |
| Mascots/robot | “simple animal face small screen character sheet”, “robot companion expression sheet minimal” | Distinct silhouette/features at small size, common expression vocabulary, static clarity. |

Do not copy a reference's clinical scores, pressure/streak mechanics, tiny controls, hidden stop, baby talk, excessive animation, or surveillance imagery just because its palette is attractive. Familiar consumer-app patterns are starting points, not evidence they suit this participant.

### Step B — annotate 6–9 references

Collect roughly two or three per interface. For each, record the source link/creator, the relevant screen, what works, what to avoid, and the one pattern to adapt. Keep inspiration screenshots in a private design board with source links unless redistribution is permitted. Do not commit copied artwork or imply a reference is our own design.

### Step C — choose one coherent direction

Propose two lightweight directions on the same participant-home and caregiver-summary wireframes, then pick one consistent set of type, spacing, colors, buttons and avatar style. Evaluate readability and control clarity first. Share the choice with Emilia (device assets) and Lukas (activity fields), then build. This counterpart review is not an extra user-approval gate for routine design choices.

### Step D — turn inspiration into a state-complete wireframe

For each page below, sketch a normal state plus its critical loading/empty/error/paused variant. Use fictional names/data. Do not spend time polishing a normal-state mockup that cannot represent a failed request. No image-generation or design-tool subscription is required: a labeled sketch or browser mock is sufficient initially.

Deliverables from the inspiration pass: annotated reference board, chosen direction, page inventory, basic tokens, one complete activity wireframe, and the first mascot test export. Store original source assets and notes in the team's agreed design location; record implementation-relevant decisions in this guide/build plan.

## 3. Participant app pages

Use a persistent shared participant shell. During active conversation/activities, keep Pause, Stop and Get help available without a menu. Do not create a new route for every connection or microphone state.

| Proposed route / page | Required content and primary actions | Important states / dependency |
| --- | --- | --- |
| `/participant` — Home | Selected avatar, brief greeting; Talk with Lemmi, Choose an activity, Get help; appearance/settings access | Profile missing/pairing not ready, robot absent, ready; microphone off. Anay supplies participant-safe profile/session. |
| `/participant/avatar` — Choose avatar | Five labeled static previews: Dog, Cat, Bunny, Bird, Lemming; preview and Use this avatar | Selected/saving/save failed/device unsupported. Confirm explicitly; no random switching. Anay persists avatarId; Emilia confirms robot support. |
| `/participant/conversation` — Talk | Avatar, matching response text, listening/processing/speaking state, Speak now/I'm finished/text fallback | Waiting, unclear speech, permission denied, paused, timeout/disconnected, ended. Use Anay's client and one audio endpoint. |
| `/participant/activities` — Choose activity | Listen to music, Let Lemmi guess, Look through photos, Match pictures; Teach Lemmi entry into conversation mode | Loading/no approved content/unavailable. Lukas supplies pack metadata; no inferred treatment recommendation. |
| `/participant/activities/music` — Music | Current track/title, approved playlist, Play/Pause/Next, volume and active speaker | Loading/playing/paused, denied autoplay, missing track/unsupported format/error, endpoint handoff. Render Lukas's music view; music pauses before talk. |
| `/participant/activities/guessing` — Gentle 20 questions | One short question, Yes/No/Not sure/Skip/Show me or Finish; chosen visible object/picture where used | Ready, next question, tentative guess, graceful round end, unavailable. Lukas owns transitions, candidate set and question count; UI has no score/countdown. |
| `/participant/activities/matching` — Match pictures | Visible sample + two candidates; Select, Show me, Not sure, Another picture, Finish; persistent Pause/Stop/Help | Ready/selected/reveal/paused, missing asset, item removed, no eligible items/error; no scores or repeated trials. Lukas owns matching; Anay supplies eligibility. |
| `/participant/activities/photos` — Photo album talk | One approved image/caption, Next/Previous, Just look, Talk about this photo | No album/missing photo/caption, just-look versus talk, pending old-photo response, handoff. Lukas supplies state, Anay supplies approved talk context. |

All four are distinct activity renderers on one common frame. Teach Lemmi reuses conversation with its own mode/panel, rather than adding another game app. Participant copy and visible activity labels do not need to expose protocol IDs or “20” as a completion target. All four activities allow leaving without failure messaging.

## 4. Caregiver app pages

Use a separate protected caregiver layout with a small navigation set. Forms and detail panels can use tabs/sections; avoid creating a separate page for every optional profile field. Normal access must not depend on knowing a secret URL.

| Proposed route / page | Required content and actions | Important states / dependency |
| --- | --- | --- |
| `/caregiver/sign-in` — Sign in | Minimal selected identity-provider sign-in; no participant login or custom registration system | Signing in, invalid/expired session, service failure. Anay supplies auth integration. |
| `/caregiver` — Overview | Profile summary, device/contact readiness, recent activities/sessions, open requests, source-linked permitted journal highlights; optional factual use-duration chart after cards | First-use empty state, unavailable backend, no active request. No cognition/mood/decline chart. |
| `/caregiver/check-in` — Short camera check-in (F13) | Request camera, configured device/viewer, local acceptance status, fresh live image, remaining time, End check-in | Disabled/unavailable/requested/starting/active/stale/declined/expired/ended; protected CheckInClient, no stream on page load, no recording/vision. |
| `/caregiver/profile` — Setup/edit profile | Short sections: preferred name/language/interests, important people, communication including a three-position Conversation support selector and same-topic preview, private sensitive-topic guidance, avatar preference; preview/save | New/edit/saving/failed/revision conflict. Only preferred name required; source labels and last edit visible. |
| `/caregiver/content` — Approved content | Photo albums/captions/context and playlist metadata/approval; tabs for photos/music | Empty, approved/not approved, missing/unsupported asset, upload/permission error. Anay owns upload/storage access; Lukas owns allowed pack/content shapes. |
| `/caregiver/contacts` — Contact setup | Primary/optional backup, display name/destination/channel, verification/test readiness, escalation/auto-alert settings | Unverified, ready, test pending/failed, no backup, save conflict. Mask destinations outside authorized detail; never fake a receipt. |
| `/caregiver/requests` — Help inbox | Open/recent requests, real versus simulated, timestamps, state, detail link | Empty/loading/failure/no response. Keep provider delivery separate from acknowledgment. |
| `/caregiver/requests/[id]` — Help request detail | Minimal reason, delivery/attempt status, explicit Acknowledge, Cancel further attempts, human-recorded Resolve | Accepted/delivery unknown/delivered/acknowledged/failed/expired/canceled/resolved, late update, authorization failure. GET/page load must not acknowledge. |
| `/caregiver/journal` — Session list | Date/time, activities, saved/interrupted status; select session | Empty/loading/failure; duration is descriptive, not success. |
| `/caregiver/journal/[id]` — Session detail | Distinct measured events, optional attributed excerpts, caregiver observations, AI summary; edit/review/remove actions | No excerpts/no summary/unreviewed/reviewed/edited, failed save, revision conflict. Preserve AI origin and avoid auto biography promotion. |
| `/caregiver/settings` — Device, preferences and data | Tabs/sections: pair/unpair/device state and measured telemetry freshness, separate camera permission/viewer setup, selected appearance, volume/pace/reduced motion/text size, excerpt permission, deletion/reset with specific confirmation | Pairing expired/disconnected/unsupported, destructive action pending/failed/completed. No public SSH/VNC, secret values, provider keys or global server admin controls. |

First-use setup can link through Profile → Approved content → Contacts → Device settings and back to Overview; it does not require a second onboarding application. Provider-hosted auth pages may supply the sign-in step. All private fields remain caregiver-only even when the participant screen is open on another device.

## 5. Shared panels and state variants — not extra pages

| Component | Where reused | Variants to design |
| --- | --- | --- |
| Session controls | Conversation and every activity | Ready/active/paused/ended; explicit resume; help remains available. |
| Microphone indicator/control | Participant shell and robot state mapping | Capture on/off/muted/unavailable; unmute alone does not begin recording. |
| Help panel/status | Participant home and active screens | Sending, provider accepted/delivery unknown, delivered, acknowledged, failed/no-response, not configured; isolated simulation label at every state. |
| Session-ended/save panel | After stop | Saving/saved/failed; does not block leaving or reactivate capture. Active help request status remains accessible. |
| Device/audio handoff | Conversation/music/photo/guessing | Robot/app target, explicit continue, connection failure, one output endpoint only. |
| Asset/empty/error panel | All activity and caregiver pages | Missing content, retry, alternate action, authorized empty state; no fabricated biography or success. |
| Form/save feedback | Caregiver pages | Editing/pending/saved/failed/conflict; preserve input and do not overwrite newer records. |
| Source/review badges | Profile and journal | Caregiver-provided, measured event, participant statement/recognition uncertainty, caregiver observation, AI unreviewed/reviewed/edited. |
| Confirm destructive action | Settings/summary removal | Specific affected records, cancellation, pending/failure/result; no blanket deletion claim for external providers. |

Design controls from real contracts. If a status/action is missing, ask Anay/Lukas for the exact schema change instead of inferring it from prose or adding a client-side workaround.

## 6. Stackchan modes and five-avatar art

These are firmware modes, not SvelteKit pages. Emilia implements them and checks controls at the intended viewing distance.

| Mode | Avatar/state art | Additional communication |
| --- | --- | --- |
| Ready/idle/home | `idle` | Device readiness; microphone off. |
| Listening | `listening` | Actual capture indicator and usable local controls; not only an expressive face. |
| Processing | `processing` | Quiet waiting state, capture off, immediate stop remains available. |
| Speaking | `speaking` | Modest optional animation, capture off, local interruption. |
| Paused/muted/session ended | `paused` or static `idle` as mapped | Clear distinct text/icon for paused, mic muted, or ended. Art alone cannot distinguish microphone permission/state. |
| Disconnected/unavailable | `unavailable` | Capture/output off and explicit recovery; no automatic reconnect speech. |
| Activity/media | Current avatar plus minimal approved activity/track cue if readable | Use app visuals when necessary; no attempt to cram caregiver UI or a full playlist onto the robot. |

Exactly five identities: **dog, cat, bunny, bird, lemming**. All have the same behavior/capabilities. Avoid unrequested personality/voice systems. Reduced motion means a static version of the chosen identity, not a sixth avatar. Keep the selected identity stable across screens and sessions.

Work in this order: (1) five small static identity thumbnails to establish family resemblance; (2) one avatar's full six-state set, tested by Emilia; (3) the other four in the proven format; (4) optional animation only after audio/control performance is acceptable. The complete static target is **30 state frames plus five chooser previews**, with exact file dimensions/encoding/palette/size budget agreed with Emilia before final exports.

Handoff includes editable source, avatarId, expressionId, asset version, dimensions/format/size, background/transparency treatment, creator/source permission, and app/device export paths. App-friendly source art may require separate device exports. Keep tiny details out of small robot faces; text/capture indicators are separate UI elements. No copied copyrighted character designs, relative impersonation, or distressed faces designed to pressure continued use.

## 7. Build order and counterpart checkpoints

1. Read the relevant specs and inventory the actual scaffold. Confirm page routes/contracts with Anay, ActivityView fields with Lukas, and device art constraints with Emilia.
2. Complete the small inspiration pass, a home/caregiver overview wireframe, design tokens and five identity sketches. Do not delay implementation for a polished moodboard.
3. Build the shared participant/caregiver shells and controls, then music UI against the common mock. Export one tested mascot set in parallel.
4. Wire conversation state, avatar selection and contact status. Implement remaining caregiver screens progressively against typed mocks while Anay completes services.
5. Add photo/guessing renderers using Lukas's package. Verify pending/conflict/media-error states together, not only successful clicks.
6. Complete five-avatar exports and consistency with profile/device IDs. Replace mock clients through the existing service seam; keep simulation/mock labeling explicit.
7. Inspect keyboard, zoom, contrast, audio permission, mobile/tablet layouts, caregiver isolation, all four activities, and device handoff. Rehearse private-to-public screen transitions before Grandma's optional live segment.

Apply the experience spec's participant typography, target spacing, contrast, reduced-motion and 200% zoom targets. They are design/check targets, not a claim of clinical or accessibility certification. Figma or another design tool is optional; the working app remains the final UI evidence.

## 8. Codex prompt for Kylie’s design preparation

> Read docs/kylie-design-guide.md, experience-spec.md, integration-contracts.md and my brief in build-and-demo-plan.md. Help me prepare Lemmi's participant app, protected caregiver app and Stackchan art handoff. The five avatars are dog, cat, bunny, bird and lemming. First inspect the existing project; do not replace its framework or create a backend. Guide me through a short inspiration search using the task-specific phrases in the guide. When browsing, provide actual source links, explain which pattern we can adapt and which conflicts with our requirements, and keep copied references separate from our original assets. Do not treat inspiration as medical validation. Map the required pages and reusable state panels, then help me choose a consistent readable direction, make simple wireframes/tokens and one music view using Anay's mocks and Lukas's ActivityView. Agree device export constraints with Emilia before final mascot assets. Build in small runnable steps with normal/loading/empty/error/paused cases, not just static happy-path screens. Report missing interfaces by name, preserve private caregiver data boundaries, and explain what changed and how I can preview/check it.

Actual inspiration links, chosen visual direction and final exports have not yet been collected or approved. This document guides that work; it does not claim a completed design.

## 9. Caregiver conversation-support control

Add the F12 component to `/caregiver/profile` per [communication-support-spec.md](communication-support-spec.md): Conversational, Guided, Quiet companionship. Use three labeled stops/cards with keyboard access and a text explanation, not a clinical scale, red/green risk gradient or patient-facing severity label. Preview the same approved fictional topic at each position, visibly state next-session versus explicit apply-now, and render pending/error/conflict states. The component has one saved source of truth; settings links may open it, not duplicate its state. Coordinate enum/profile/session changes with Anay and presentation with Lukas. Hearing/volume/pace/language/motion remain separately understandable preferences.

## 10. Camera first, then petting and device feedback

F13 and F14 are committed additions in [robot-capabilities-spec.md](robot-capabilities-spec.md). Build camera controls/viewer before petting/LED/motion polish. Start camera wireframes after minimal readable shared controls, beside the music UI; do not wait for all 30 finished mascot frames.

Required designs, using one CheckInClient from Anay:

- **Caregiver Settings section:** camera off by default, permitted viewer/device, plain-language viewing/expiry/no-recording explanation. Camera permission is separate from speech, excerpts and public-demo permission. No advanced surveillance dashboard or face library.
- **Caregiver Overview card:** device readiness/freshness and link to Check-in. A notification may link here but never automatically start video; being a contact does not confer viewing permission.
- **Caregiver `/caregiver/check-in` page:** request button, waiting for local Allow, unavailable/declined/expired/error states; active viewer with named device, freshness and remaining time, End check-in. Blank stale frames. Page load is read-only. No screenshot/save/record button or two-way call UI.
- **Participant shared overlay:** named caregiver request with Allow camera/Not now; starting; Camera on with Stop camera; ended plus explicit Resume for the paused activity. Reuse across participant routes rather than adding many pages. Respect refusal; do not prompt repeatedly.
- **Robot handoff sheet to Emilia:** the same request/active/ended states with large local targets, persistent text/icon camera notice and distinct mic status. Reuse the selected avatar but let truthful camera/stop cues take priority. Do not rely on LEDs or sound alone.
- **After the camera gate:** `pet_ack` overlays consistent across all five avatars; distinct LED/text/icon status mappings; Overview/Settings device-health values with measured/stale/unavailable states. Top strip is the petting input; side rows are LEDs. Keep six interaction states/30 base frames; budget any new overlay exports with Emilia.

For inspiration, search for “camera permission request local approval,” “video viewer connection lost state,” and “accessible device privacy indicator.” Annotate clarity of who can see, actual capture, local refusal/stop and stale-frame treatment. Choose explicit consent/short viewing patterns; avoid copying hidden surveillance, continuous monitoring or facial recognition interfaces. These references guide layout, not clinical or privacy validation.

Add to Kylie's Codex tasks: use robot-capabilities-spec.md and build F13 settings/viewer/participant panels against the shared mock, then integrate with Anay/Emilia and inspect real termination/freshness before F14 art polish. Keep permission authority on the server/device, separate from UI state and microphone mute. Lukas supplies externally paused ActivityViews; never resume games because the camera panel closed.

## 11. Growing preferences and matching pages (F15/F16)

Follow [personalization-and-matching-spec.md](personalization-and-matching-spec.md). Add these runnable UI increments after shared controls, without changing the F13-before-F14 camera priority:

1. **Profile → Interests & boundaries section:** preferred/avoided topics, retired objects, source labels, tentative pattern versus explicit preference, edit/remove/undo. Separate Remember preferences between visits from journal excerpts. Explain session-only behavior while off, disable versus Forget, deletion confirmation and failed save/conflict states. No cognitive scores, miss counts or hidden biography edits.
2. **Conversation feedback panel:** Like this topic, Different topic, Don't ask about this. Keep optional; don't force a feedback question every turn. A spoken refusal is equivalent. Show saving/session-only/save-failed honestly and never repeat the refused topic in a toast.
3. **Activity chooser:** fourth card Match pictures. **Matching page:** one persistent sample plus two large candidates, optional shown pair, Not sure/Another picture/Finish; keep Pause/Stop/Get help. Include no eligible items with another-activity/finish choices, missing-image/loading/offline/paused states. No red wrong-answer state, recognition drill, naming requirement or automatic retry.
4. **Robot handoff:** verify image-choice readability with Emilia. If not usable, propose the larger app screen explicitly; keep robot narration and shared session. Do not shrink the full game layout onto K151 or require camera object recognition.

Inspiration phrases: “visible picture matching accessible large targets,” “interest preferences edit undo,” and “topic feedback conversation interface.” Annotate choice size, optionality, reveal and graceful exit; avoid memory-test scores and hidden-card mechanics. Preferences use Anay's client; matching renders Lukas's ActivityView and eligibility, not frontend game/retirement rules. Retired objects disappear from alternatives and prompts as well as target cards. Keep private source/reason metadata out of participant page loads.

## 12. Confirmed whiteboard design details

- **Teach Lemmi entry and conversation panel:** Lemmi supplies a simple approved object/topic, optional image/name and one invitation to explain it. Design ready/listening/processing, Different topic/Not sure/Finish, empty eligible topics, paused/stale/unavailable states. Reuse shared controls and actual capture indicator; no object-naming requirement, score, correction or “you must help me” copy. It opens `/participant/conversation` in `teach_lemmi` mode using Anay's snapshot; Lukas supplies prompts and Emilia device constraints. The mode is a required conversation feature, not a fifth game reducer.
- **Explore pictures:** add an approved places/scenes collection choice to the existing photo page/content editor. Include captions/context and Look/Talk/Next/Previous/Finish; no recognition test or implied personal connection. Use existing approved-content/eligibility clients.
- **Caregiver Overview:** use the whiteboard's card layout to prioritize profile, readiness, recent activities, open contacts and source-linked journal highlights. Include first-use/partial/error/no-summary states. Optional date/activity duration charts follow core cards: label Recorded activity time, show gaps/unknown periods, exclude known pause/camera/disconnect time and avoid engagement/mood/cognition ratings. No new analytics page is needed.
- **Profile/context entry:** optional caregiver-entered life context, hobbies/interests and approved media with preview/source labels. Reuse Profile and Approved content; uploading a photo does not approve a biography or enable automatic document extraction.
- **Participant first visit:** short neutral choices for sparse context; later offers use permitted interests. No long intake interview or invented facts. UI allows graceful topic changes without inferring frustration from silence.
- **Solitaire:** last/bottom stretch priority, after committed work and other optional features. Do not add a working navigation card or spend core design time on it now.

Add teaching-invitation, image-exploration and caregiver-card examples to the existing time-boxed inspiration board. Explain the adapted layout pattern and source; visual references do not establish clinical benefit or alert accuracy.
