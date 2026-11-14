# Lemmi

Local UI/browser integration preparation: [combined frontend/backend handoff](docs/handoffs/frontend-backend-integration.md) — includes the copied uncommitted UI, Teach Lemmi/Alex content, browser client wiring, observed checks and remaining deployment gates.

Backend checklist: [Anay's tasks](docs/anay_tasks.md) — teammate blockers, backend work and agent claims.

Current deployment: [backend status](docs/backend-status.md) — running services, verified live paths and remaining limitations.

Backend integration reference: [backend_api.md](docs/backend_api.md) — current routes, clients, events, auth, speech interfaces, limits and pending handoffs; maintained with backend changes.

Undeployed database increment (`anay/app-data-schema`): [Emilia schema review](docs/handoffs/anay-app-data-schema-review.md) and [migration setup](db/README.md) cover the corrected album/playlist storage migration. No new collection API or journal/notification workflow is enabled.

A personalized companion for familiar conversation, enjoyable activities, and connection with family.

Lemmi is a Cal Poly Vibecode Club hackathon project exploring how an app and an optional Stackchan robot can support people living with dementia. Caregiver-provided context—such as preferred names, interests, familiar people, and communication preferences—helps the companion make interactions more personal.

Stackchan is the preferred participant interface: the goal is to let someone talk, see Lemmi respond, and take part in supported activities through the robot, with minimal need to operate a separate screen. The app supports caregiver setup and journal review, supplies larger visuals or controls when needed, and provides a complete standalone experience when no robot is available. A TurtleBot integration is a possible future extension.

An early hardware check will determine how much interaction can live on the available Stackchan. This preference does not require the language model or speech services to run on the robot itself.

## Project status

**Teach Lemmi source increment (`codex/teach-lemmi`):** a playable scripted Alex text demo is available in the existing Participant page. Backend teaching handlers reuse the shared coordinator, OpenRouter and speech seams, with reviewed topics, session-only feedback and a fifteen-minute active-time limit. [Tester manual](docs/teach-lemmi-tester-manual.md) and [Anay/Kylie/Emilia handoff](docs/handoffs/lukas-teach-lemmi.md) cover launch and checks. This increment is not deployed; browser voice, physical robot acceptance and durable teaching memory/journal observations remain pending.

Alex's updated fictional profile and supplied-media preparation are on `codex/alex-profile-assets`; see [content, private derivatives and integration limits](docs/handoffs/lukas-alex-profile.md). The deployed profile and supplied-media playback are not updated by these content changes.

To sign in as the assigned caregiver and upload the approved song privately, use
[the local music uploader](docs/upload-alex-music.md) (`bun run upload:alex-music --help`).

**Shared mock starter implemented; product features remain in development.** The repository includes a pinned Bun/SvelteKit workspace, runtime-validated contracts, typed HTTP/fixture clients, a loopback mock session gateway, participant/caregiver development shells, a small pure music example and a fake-device connector. Optional authenticated controls, text-chat integration and local speech adapters are described below. See [Team start guide](docs/team-start.md) for clone/run commands, implemented seams, limitations and each person’s first task. Integrated firmware/media playback, caregiver sign-in UI, real notifications and camera streaming remain pending. Deployment/provider observations and remaining limits are recorded in the backend status; the new voice branch still needs counterpart and hardware review. The broader specifications remain the target, not a claim of completed P0 behavior.

Lemmi is an experimental prototype. It has not been clinically evaluated and does not diagnose, treat, assess cognitive decline, or replace caregivers or medical professionals. Use fictional profiles and team rehearsal. Lukas is also planning an optional supervised live demo with Grandma after private rehearsal and her agreement; her health status is unspecified, and a teammate fallback is always available. Testing with people living with dementia requires further care-professional review and participant involvement in the design.

Current device/backend coordination: [Anay’s handoff from Emilia](docs/handoffs/anay-device-integration.md). The firmware test is compile-checked on its own branch; hardware upload and K151 live transport verification remain pending.

Activity contracts A01–A04 now provide separate states for all four activities, a bounded reviewed-tree schema, matching presentation evidence, and validated factual events/transitions. [Lukas/Kylie handoff](docs/handoffs/anay-activity-contracts.md) lists exact fields, shared UI fixtures and compatibility changes. The runnable host still supports only the mock music example; new reducers, reviewed live content, catalog hosting and counterpart review remain pending.

An optional **authenticated control foundation** now adds scoped device pairing/revocation, a managed-provider token verification adapter, and control-only WebSockets through the existing session coordinator. See [Anay’s control handoff](docs/handoffs/anay-control-foundation.md) for contracts, private configuration and TLS/provisioning requirements. Default startup remains the local mock. Actual identity-provider setup, public TLS/network deployment, caregiver sign-in UI, hardware, media and real notifications remain unverified or unavailable; this is not completed product authentication or robot readiness.

**Speech feature branch:** `anay/speech-pipeline` adds optional authenticated PCM capture → local STT → OpenRouter → local TTS → bounded output/receipts through the existing coordinator. Real synthetic English TLS/WSS turns passed; browser text/PCM transport is implemented by the multi-profile increment; physical microphone/speaker and browser acceptance remain pending. Input is a bounded complete utterance with explicit end, not incremental recognition. English keyword quality remains imperfect; German/hardware acceptance is not claimed. See [pipeline handoff](docs/handoffs/anay-speech-pipeline.md) and [Ubuntu setup](services/local-speech/README.md). This feature branch is not deployed; default mock stays provider-free.

Optional **PostgreSQL/profile/private-media mode** now persists fictional Alex's approved profile/facts, device credential hashes and session checkpoints, with protected resource APIs and private PNG/PCM-WAV storage. See [database setup](db/README.md) and [A18/A19 handoff](docs/handoffs/anay-database-profile-assets.md). Default mock startup still needs no database. Full journal/summary, notification, preference and deletion workflows remain pending; real identity-provider/host/hardware readiness is not established by local fixture checks.

## Demo profile scope

The authorized November 14 multi-profile increment supports independently created fictional participant profiles, with Alex as the initial profile. Each profile has separate approved context, assets, authorization, session state and transient conversation. Browser and robot endpoints assigned to the same profile share one session and one active audio endpoint; different profiles may run concurrently. New frontend setup selects an authorized fictional profile or creates a distinct fictional profile. Preview cards remain labeled **Example profile — preview only** and never become live records or reuse Alex’s context. Easy enrollment is explicitly enabled for fictional demo profiles only; caregiver/private-data permissions remain separate. Profile changes stop/cancel prior endpoint work, and all APIs enforce resource scope. See [multi-profile handoff](docs/handoffs/anay-multi-profile-endpoints.md) for implementation and verification limits.

Backend deployment uses the `backend-deploy` integration branch; see the [new-machine and Cloudflare deployment guide](docs/backend-deploy.md). The [current Ubuntu host setup](docs/host-setup.md) records running local services and observed checks; the public tunnel/gate, actual VoidAuth caregiver setup, PostgreSQL bootstrap and public computer-device text-chat path have been verified. Host DNS and speech-quality limitations remain documented there.

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
| Lukas | Music/20-questions/photo/matching logic, teaching prompts and approved content; demo planning with Grandma and teammate fallback. |

The rough business idea is a subscription service plus optional robot sales, retaining app-only use. A later reviewed marketplace may involve suitable activity/content partners. Pricing, customers and partners are unvalidated; billing, public plugins and marketplace integrations are outside the hackathon build.

## Getting started

The selected stack direction is SvelteKit/Svelte with TypeScript, Bun for tooling/runtime, SvelteKit backend HTTP routes, a native Bun realtime gateway, and a Bun background worker. Caregiver tools and participant views are separate areas of the same app; caregivers sign in, while participants use a paired/setup device without a login screen.

The backend, PostgreSQL, and local speech-to-text/text-to-speech models will run on a team-managed server: a lab desktop, one of our laptops, or a teammate's homelab. The lab desktop is the first candidate to evaluate because the team reports Ethernet and a GPU; actual speed and demo-network reachability still need testing. The LLM remains an external API. Local hosting does not make the complete system offline.

For the live demo, test from the actual venue network, prepare a laptop fallback, and keep the server powered and awake. Authorized SSH/VNC can administer the server; participants and caregivers use the robot/app. Hosting and speech processing are not performed on the ESP32.

The shared starter is ready to clone. Install [Bun 1.4.4](https://bun.sh/docs/installation) (the version in `.bun-version`), then:

```sh
git clone https://github.com/emiluvu/Lemmi.git
cd Lemmi
bun install --frozen-lockfile
bun run dev
```

Open **http://127.0.0.1:5173/**. The same command starts the mock gateway at `127.0.0.1:3001`. No API keys, database or `.env` file are needed for this local starter. Each teammate runs their own local copy. Keep it loopback-only; these caregiver pages are mock UI, not authenticated live services.

If Bun is not installed but Node/npm is available, use `npx --yes bun@1.4.4 install --frozen-lockfile` and `npx --yes bun@1.4.4 run dev`. This downloads Bun to npm’s cache without a global installation. Do not run `npm install` or generate a second lockfile.

In a second terminal:

```sh
bun run check
bun run test
bun run build
bun run fake-device
```

`fake-device` needs the running gateway and opens no mic/camera. Disconnecting it pauses the shared mock session. `check`, `test` and `build` run independently of the dev server. See the [team start guide](docs/team-start.md) before beginning a feature; use your named brief and preserve the existing scaffold.

Before extending a shared interface, agree the change with its owner and update schemas, fixtures, tests and consumers together. The starter is a baseline for parallel work, not a full v1 protocol freeze.

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
