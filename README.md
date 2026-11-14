# Lemmi

A personalized companion for familiar conversation, enjoyable activities, and connection with family.

Lemmi is a Cal Poly Vibecode Club hackathon project exploring how an app and an optional Stackchan robot can support people living with dementia. Caregiver-provided context—such as preferred names, interests, familiar people, and communication preferences—helps the companion make interactions more personal.

Stackchan is the preferred participant interface: the goal is to let someone talk, see Lemmi respond, and take part in supported activities through the robot, with minimal need to operate a separate screen. The app supports caregiver setup and journal review, supplies larger visuals or controls when needed, and provides a complete standalone experience when no robot is available. A TurtleBot integration is a possible future extension.

An early hardware check will determine how much interaction can live on the available Stackchan. This preference does not require the language model or speech services to run on the robot itself.

## Project status

**Planning stage.** This repository contains this README, a draft [product specification](docs/product-spec.md), a draft [experience specification](docs/experience-spec.md), a draft [safety and privacy specification](docs/safety-and-privacy.md), a draft [technical specification](docs/technical-spec.md), and a [build and demo plan](docs/build-and-demo-plan.md). The scope below is a proposed starting point for the hackathon; implementation, technology choices, and the remaining specifications are still to be decided.

Lemmi is an experimental prototype. It has not been clinically evaluated and does not diagnose, treat, assess cognitive decline, or replace caregivers or medical professionals. Use fictional profiles and team rehearsal. Lukas is also planning an optional supervised live demo with Grandma after private rehearsal and her agreement; her health status is unspecified, and a teammate fallback is always available. Testing with people living with dementia requires further care-professional review and participant involvement in the design.

## Who we are designing for

- **People living with dementia:** an approachable companion for conversation and familiar activities, initially exploring mild to moderate dementia with caregiver support that may be remote.
- **Family members and caregivers:** tools to provide context, tailor interactions, and review factual observations from sessions.

The experience should respect the person's preferences, dignity, and choice to pause or stop.

## Proposed hackathon scope

| Feature | Intended behavior |
| --- | --- |
| Caregiver setup | Create a fictional profile with preferred name, interests, important people, communication needs, and sensitive-topic guidance. |
| Companion appearance | Choose a dog, cat, bunny, bird, or lemming; keep the selection stable between sessions. |
| Conversation support | Caregivers preview/select Conversational, Guided, or Quiet companionship; preferences do not assess dementia severity. |
| Growing per-profile preferences (F15) | With separate remembering permission, learn enjoyed/avoided topics over time; keep biography and clinical judgments separate. |
| Object matching (F16) | Optional visible picture pairs; move on at uncertainty and retire repeatedly unfamiliar objects from future prompts across activities. |
| Teach Lemmi | Lemmi offers a simple object/topic and invites the participant to explain it, with Different topic/Not sure/Finish; no quiz or grading. |
| Personalized conversation | Use approved context, short responses, one question at a time, and generous pauses. |
| Photo album talk | Browse approved photos/captions, including optional town/place exploration; talk or just look without recognition testing. |
| Music playlist | Enjoy approved tracks with explicit play/pause/next and one active speaker. |
| Gentle 20 questions | Lemmi asks yes/no about a visible familiar object/picture; not-sure/skip/reveal and stopping are always allowed. |
| Caregiver contact | Notify a verified caregiver even when no one is nearby; distinguish sending, delivery, acknowledgment, failure, and backup escalation. |
| Caregiver journal | Review activity events and clearly labeled statements, observations, and AI summaries. |
| Caregiver camera check-ins (F13) | Committed first addition: short, signed-in, locally accepted check-ins; visible camera state, local stop and expiry, no recording. |
| Local robot interactions (F14) | After F13: top-strip petting, gentle reactions/head motion, clear status cues and measured device health. Side panels are LEDs, not touch inputs. |
| Stackchan participant experience | Prioritize conversation, expressions, and supported activity interactions on the robot; verify audio, display, controls, and stop behavior early. |

Activities are intended for enjoyment and participation. They should avoid visible failure counts, countdowns, streak penalties, and claims of cognitive improvement.

### Stretch goals

- **TurtleBot:** deferred under the new team split; reconsider ownership and controlled movement safeguards only after the core experience works.
- **Reviewed activity library:** demonstrate extensibility through built-in activity packs. Public uploads and arbitrary executable plugins are deferred.
- **Solitaire — last stretch priority:** consider only after committed features/safeguards and all other optional work; not a current core deliverable.

## Interaction and data principles

- **Ground conversation in approved information.** Keep caregiver-confirmed facts separate from patient statements and AI-generated summaries. Conversation must not silently rewrite a person's biography.
- **Respond with patience.** Allow repeated questions, silence, and misunderstood speech without blame. Make listening, processing, and speaking states clear.
- **Handle sensitive topics deliberately.** Follow caregiver-reviewed guidance, acknowledge feelings, avoid arguing, and do not invent reassuring facts or impersonate relatives.
- **Make stopping easy.** Provide obvious pause and stop controls. Respect refusal and explain listening and sharing in accessible language.
- **Represent help requests honestly.** Do not assume someone is physically present. Distinguish provider acceptance, delivery, and caregiver acknowledgment; none guarantees arrival. The prototype is not an emergency response system.
- **Keep the journal descriptive.** Distinguish measured events, patient statements, caregiver observations, and AI summaries. Allow review and correction; avoid diagnostic scores and inferred decline charts.
- **Use fictional data for the demo.** Before handling real personal information, define consent, access, retention, deletion, and separate choices for audio storage and family sharing. Keep API keys and personal information out of the repository.

## Planned demo

1. A caregiver creates a fictional profile, including interests and a sensitive-topic rule.
2. The participant chooses an appearance and starts a short personalized conversation through Stackchan when the hardware supports it.
3. The participant chooses music, photo album talk, gentle 20 questions, or object matching; the full team rehearsal covers all four. Matching is a new requirement; the earlier sorting design stays superseded.
4. The participant pauses or requests caregiver help; an opted-in team contact receives a fictional alert and acknowledges it. The team also shows failed or unanswered requests and backup routing.
5. The caregiver reviews the session journal and corrects profile information.
6. The team shows an explicit handoff to the app for any interaction the robot cannot support, and demonstrates standalone app use when no robot is available.

The demo should show that a participant can take part comfortably, stop easily, and receive responses grounded in approved information. It should also exercise silence, repeated questions, speech-recognition errors, sensitive topics, lost internet, and device disconnection.

## Team and business direction

| Person | Ownership |
| --- | --- |
| Anay | Backend API/realtime server, local speech, external LLM integration, local database, auth/contact/journal and deployment. |
| Emilia | Stackchan audio/local controls/mascot/WSS; camera check-ins first, then top-strip petting, restrained reactions/motion, status cues and device health. Anay supplies access/relay; Kylie supplies viewer/art; Lukas integrates activity pausing. |
| Kylie | Art, UI design and all frontend, including views on top of Lukas's activity logic and caregiver screens. |
| Lukas | Music/20-questions/photo activity implementations and approved content; demo planning with Grandma and teammate fallback. |

The rough business idea is a subscription service plus optional robot sales, retaining app-only use. A later reviewed marketplace may involve suitable activity/content partners. Pricing, customers and partners are unvalidated; billing, public plugins and marketplace integrations are outside the hackathon build.

## Getting started

The selected stack direction is SvelteKit/Svelte with TypeScript, Bun for tooling/runtime, SvelteKit backend HTTP routes, a native Bun realtime gateway, and a Bun background worker. Caregiver tools and participant views are separate areas of the same app; caregivers sign in, while participants use a paired/setup device without a login screen.

The backend, PostgreSQL, and local speech-to-text/text-to-speech models will run on a team-managed server: a lab desktop, one of our laptops, or a teammate's homelab. The lab desktop is the first candidate to evaluate because the team reports Ethernet and a GPU; actual speed and demo-network reachability still need testing. The LLM remains an external API. Local hosting does not make the complete system offline.

For the live demo, test from the actual venue network, prepare a laptop fallback, and keep the server powered and awake. Authorized SSH/VNC can administer the server; participants and caregivers use the robot/app. Hosting and speech processing are not performed on the ESP32.

There is no runnable application yet. Installation commands, environment variables, supported hardware, and local development instructions will be added after the stack and integrations are selected.

Before implementation, agree on the demo scope, safety behavior, and shared data and interface contracts using the documents below.

## Planned documentation

New: [Growing preferences and matching specification](docs/personalization-and-matching-spec.md), covering memory permission, topic boundaries, item retirement, shared types and team handoffs.

Camera and local-interaction details: [Robot capability specification](docs/robot-capabilities-spec.md) (F13 before F14; firmware, server, UI and activity handoffs).

The product, experience, safety and privacy, technical specifications, build and demo plan, and integration contracts are available as drafts. The research document remains planned.

| Planned file | Purpose |
| --- | --- |
| [Product specification](docs/product-spec.md) | Draft target users, scope, priorities, and acceptance criteria. |
| [Safety and privacy specification](docs/safety-and-privacy.md) | Sensitive-topic responses, human-help behavior, consent, data handling, and prohibited claims. |
| [Experience specification](docs/experience-spec.md) | Patient and caregiver flows, accessibility, companion behavior, and failure states. |
| [Technical specification](docs/technical-spec.md) | Components, data model, API contracts, model context, and device integration. |
| [Build and demo plan](docs/build-and-demo-plan.md) | Team ownership, milestones, dependencies, checks, and demonstration script. |
| [Integration contracts](docs/integration-contracts.md) | Named ownership, shared activity/device/API contracts, mock fixtures, assets and handoffs. |
| [Kylie design and UI guide](docs/kylie-design-guide.md) | Interfaces/pages, inspiration workflow, five-avatar asset handoff, frontend build order. |
| [Conversation support specification](docs/communication-support-spec.md) | Research-informed caregiver presets, evidence limits, requirements, ownership and checks. |
| `docs/research.md` | Sources and evidence, kept separate from product assumptions and proposed design choices. |

## Research starting points

The project draws on person-centered care and dementia communication guidance. These resources inform design exploration; they do not establish the safety or effectiveness of Lemmi.

- [Alzheimer's Society: This is me](https://www.alzheimers.org.uk/get-support/publications-and-factsheets/dementia-together/tool-personalised-care-dementia)
- [Alzheimer's Association: Communication and Alzheimer's](https://www.alz.org/help-support/caregiving/daily-care/communications)
- [NICE: Dementia recommendations](https://www.nice.org.uk/guidance/ng97/chapter/recommendations)
- [National Institute on Aging: Adapting activities for people with Alzheimer's disease](https://www.nia.nih.gov/health/alzheimers-caregiving/adapting-activities-people-alzheimers-disease)

Product inspiration includes PARO, Joy for All, ElliQ, Memory Lane Games, and Tovertafel. Their features and research findings should not be treated as evidence for Lemmi.

See [camera and robot implementation scope](docs/robot-capabilities-spec.md) for priority, hardware experiments, teammate handoffs and pending acceptance checks. Both additions are planned, not implemented; camera pauses conversation/activities in the first version.
