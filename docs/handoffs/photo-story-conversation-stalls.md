# Photo Story and conversation stall fixes

November 15, 2026. Source branch: `fix/photo-story-conversation-stalls`.
**Completion status: implementation complete; combined verification in progress.**
This is a source handoff for the backend-server agent. This session has not deployed,
restarted or reconfigured the backend host.

## Source and integration

Implementation commit: `5d1cece`. Integration commit: `0bcc44d`, merging
`backend-deploy` through `435b73a`. Keep the newer short greetings, eligible teaching
choices, Finish controls, profile-setup recovery, saved Alex album and branding.
The only merge conflict was the teaching-output callback: retained the newer
successful text delivery and added the obsolete-failure authority check.

The original shared checkout has preexisting uncommitted work and was not switched,
reset, stashed or committed. Its Git metadata became read-only, so publication uses
an independent clone at `/tmp/lemmi-backend-issues-publish`. That clone is the
canonical completed source; `/tmp/lemmi-backend-issues` is the earlier review copy.

## Confirmed defects and fixes

1. **Photo Story requests could fall through to ordinary model chat.** Before the fix,
   `Can we play the Photo Story game?`, `Show me a photo`, and `Can you show me my photos?`
   selected no activity. The model could narrate a picture without the application
   ever opening one. Whole-request routing now recognizes those reviewed variations,
   including `a`/`the` and optional `game`. Negated, quoted, hypothetical/future and
   mixed requests remain ordinary conversation; no substring-based dispatch.
2. **Ordinary model text could claim to display a picture.** Per-turn instructions now
   distinguish an active host-selected photo from ordinary chat. A bounded English
   display-claim guard converts covered claims such as `Here's a photo` into an honest
   Photo Story offer, or an unavailable response. It opens nothing automatically;
   an immediate explicit confirmation uses the existing coordinator. Quiet receives
   declarative wording. Replaced invented text does not enter dialogue history or
   optional summary generation. This mechanical guard is not universal semantic
   detection and does not prove the browser painted an image.
3. **The photo grid clipped oversized images.** Chromium reproduced a 336.6px-high
   image in a 252px-high desktop frame. Explicit shrinkable grid tracks and image
   minimum dimensions now keep landscape/portrait images inside the frame while
   retaining `object-fit: contain`.
4. **Canceled asynchronous work could stop a newer listening attempt.** Old recognition,
   model, synthesis, Photo Story or opening jobs could emit an error using the newest
   session envelope. The browser cancels capture/continuation on errors. Gateway
   callbacks now drop obsolete revision-conflict failures and obsolete successful
   output; catches are bound to the initiating session/generation/lease/profile/
   privacy/policy/endpoint and current credentials. Current failures remain visible;
   client safety cancellation is unchanged.

The user's original testing session was not captured here. These are reproduced
software defects, not proof that every reported disappearance or stop has one cause.

## Interfaces and runtime scope

No new HTTP route, WSS event, schema, database migration, dependency or lockfile.
Existing `input.text`, captured speech, `input.photo.*`, Start/Resume and teaching
commands remain compatible. Participant rendering and gateway behavior both change;
**deploy web and gateway together**. The Python speech service, LLM/model selection,
worker counts, German mapping, credentials, saved photos, memory permissions and
notification behavior require no changes. Retain existing Nginx UUID-photo and
branding allowlists; this branch adds no proxy requirement beyond its merged base.

## Verification status

Before the latest upstream integration: pinned Bun 1.4.4 frozen install; **461 tests,
6,787 expectations, zero failures/skips**, using five disposable PostgreSQL databases.
The suite includes a 30-turn paced gateway/browser-controller fixture crossing spoken
Photo Story entry and exit, canceled recognition/model/synthesis, honest model-photo
offers, Quiet/unavailable boundaries, and current-failure visibility. Production
HTTP/certificate-verified TLS/WSS/private-PNG participant smoke passed on a separate
sixth disposable database. Type/Svelte, build, formatting and whitespace passed.
Python speech boundaries: **15 passed**, with fake engines.

Chromium rendered landscape/portrait fixtures at 1280×900, 390×844 and 390×650;
image containment, failed image → Pause, and keyboard retry without Resume/capture
passed, with no runtime errors. The reusable fixture harness is
`scripts/smoke-photo-ui.mjs`. These are real browser layout checks with fake transport
and images. The endurance test uses the real gateway/controller with fixture speech
and consumed receipts; it does not exercise a physical microphone/speaker.

Combined verification after `0bcc44d`: **in progress; update this section before release**.

## Backend-server agent instructions

1. Read `AGENTS.md`, this handoff, `docs/backend-status.md`, `docs/backend_api.md`,
   `docs/host-setup.md`, and `docs/backend-deploy.md`. Inspect actual service checkout,
   running revisions and private configuration without printing secrets. Fetch this
   feature branch and current `backend-deploy`; compare newer commits before merging.
   Keep the deployment checkout on `backend-deploy`; never force-push or replace it
   with an older snapshot. Review cancellation/access boundaries before integration.
2. Integrate normally, preserving any newer server changes. In an isolated checkout,
   use Bun 1.4.4 and run `bun install --frozen-lockfile`, `bun run check`, `bun run test`,
   `bun run build`, `bun run format:check`, `git diff --check`, and
   `python3 -m unittest discover -s services/local-speech -p 'test*.py'`.
   Enable all five `LEMMI_*_TEST_DATABASE_URL` variables with **disposable** databases
   and repository-required private PostgreSQL logging. Run `bun run smoke:participant`
   against a separate disposable `LEMMI_TEST_DATABASE_URL` ending in `_test`; it
   deliberately clears its selected database. Never use the live database for tests.
3. Optional browser fixture reproduction: start
   `LEMMI_UI_PREVIEW=1 bun run --filter @lemmi/web dev --port 5195` in the isolated
   checkout. With reviewer-supplied Playwright installed outside runtime dependencies,
   run `node scripts/smoke-photo-ui.mjs`. Set `LEMMI_PLAYWRIGHT_MODULE` to its absolute
   module path and `LEMMI_CHROMIUM_EXECUTABLE` if needed. The harness supports
   `LEMMI_UI_REVIEW_ORIGIN` for a different **local** port. Do not expose preview mode
   publicly or run this harness against the production origin.
4. Before the authorized rollout, retain protected current source/build/configuration
   and database/media backup records using the host's existing release procedure.
   No migration, bootstrap/reseed, profile edit, credential rotation, model download,
   speech restart or diagnostic enablement is needed. Coordinate the interruption,
   install the verified build and restart **only** web/gateway through the existing
   supervisors (`lemmi-web` and `lemmi-gateway` on the documented host). Keep speech,
   tunnel and database running. A restart ends active sessions; refresh/reconnect
   participant tabs and explicitly Start afterward.
5. On an isolated fictional enrollment, check a short greeting once, then speak
   `Can we play the Photo Story game?` and `Show me a photo`. Confirm an actual
   protected current-scene request and decoded visible image, not only a caption or
   model claim. Check portrait/landscape, desktop/mobile, image failure/retry, Pause,
   Resume same scene/question, Finish and Stop. For Alex, verify the existing saved
   album without modifying photos/context. A missing/denied asset remains an error;
   never restore generic garden images as an Alex fallback.
6. Rehearse Pause → Resume and Stop → Start during pending recognition, model output,
   and synthesis. An obsolete job must produce neither speech nor an error that
   disables the new turn. A genuinely current provider failure must remain visible
   and leave capture off. Test 30 human turns including photo entry/exit on the
   actual browser/network. Check Quiet, German Start/Resume and teaching choices/
   Finish remain correct. Hardware Stop/mute and the unresolved K151 uplink require
   Emilia's separate device verification.
7. Record actual deployed web/gateway revisions, service start state, private-data/
   credential preservation and public acceptance in **both** backend status and API
   reference plus the build plan. Release only the test's own fixtures. If the gate
   fails, restore the coordinated previous web/gateway source/build using the host
   procedure, keeping current permissions, deletions and database/media intact.

## Remaining limits

Initial silence still pauses after 15 seconds; Quiet and explicit errors stop
continuation intentionally. Session/turn/queue deadlines and capacities remain
bounded. Live provider faults, speech recognition quality, browser suspension,
network/heartbeat loss and physical device issues can still interrupt a conversation.
The mechanical photo-claim guard covers reviewed forms only. No new logging of
prompts, transcripts, photo bytes/descriptions, contact details or credentials.
No public-host, live-model, human microphone/speaker or K151 test was run here.
The final server-side rollout and real-world reproduction remain the next handoff.
