# Telegram caregiver contact

## Backend-server integration review — ready candidate, not deployed

November 15: source through `af7ef12` was merged with working checkpoint `a15e9cf`.
The `lemmi-working-conversation-2026-11-15` tag and browser noise behavior are
preserved. **545 tests / 13,380 expectations passed with zero skips/failures** on
seven dedicated disposable PostgreSQL databases. Frozen Bun1.4.4 install,
type/Svelte, build, formatting and whitespace passed; three preexisting photo-alt
warnings remain. Six live Jev classification cases passed without a Telegram send.

Review fixed no-session Get help, live HTTP hook coverage, neutral trusted-contact
copy for safe routing, stale contact-save error delivery, final pre-send authority
cancellation including backup, and safe release of known-unsent work when the
service stops. Conversation Stop retains already initiated contact requests.
Production Chromium/TLS/WSS and managed-auth HTTP fixtures passed keyboard help
before Start, deduplication, truthful sending/acceptance/failure, scoped actions,
GET non-acknowledgment and access denials with zero capture/browser errors.

The prepared Nginx configuration passes syntax validation but is not installed.
Migrations007/008 and the matching web/gateway rollout still need the protected
host release procedure. This server has no Telegram credentials yet; the user
chose secure configuration and confirmation of an opted-in teammate recipient.
Two fictional real-send checks remain required after that configuration. Earlier
real-send statements below describe the source workstation, not this server.
[Complete reviewed-candidate record](../backend-status.md#telegram-caregiver-contact-reviewed--candidate-ready-not-deployed).

Branch: `feat/telegram-caregiver-contact`. Persistent worktree:
`/home/chaos/projects/Lemmi/.worktrees/telegram-caregiver-contact`.
This is a source increment; it does not by itself update the running deployment.

Real rehearsal observed: manual help without a conversation and an actual Jev classification both created durable isolated requests and received Telegram acceptance. The user confirmed both fictional alerts arrived. Alerts distinguish human assistance from detected concerns and ask the recipient to check the caregiver portal. With `LEMMI_PUBLIC_ORIGIN`, the message links to `/caregiver`. This opens the existing dashboard; request-detail/acknowledgment UI remains a frontend handoff, so the alert also asks the recipient to contact the participant directly.

## Quick test setup

Use Bun 1.4.4 and `bun install --frozen-lockfile`. Keep all real values in private
server configuration. The gateway requires its existing live PostgreSQL,
caregiver identity, TLS/proxy and pairing configuration. Add:

```dotenv
LEMMI_TELEGRAM_ENABLED=1
LEMMI_TELEGRAM_RECIPIENTS_VERIFIED=1
LEMMI_TELEGRAM_AUTO_ALERTS=1
LEMMI_TELEGRAM_PROFILE_IDS=profile-alex
```

`RECIPIENTS_VERIFIED=1` is an operator attestation that **every configured recipient**
is an opted-in teammate and has already received a successful test. It is not
automatic identity verification. Only assigned fictional profiles are supported.
Use exact stable IDs for additional authorized fictional profiles; example cards
are rejected. The notification feature and automatic concern alerts default off.

The sender uses the same lookup as `~/.local/bin/tg-notify`: `TELEGRAM_BOT_TOKEN`
and `TELEGRAM_CHAT_ID` environment settings, then
`~/.config/telegram-notify/env`, then `~/.kiro/crew/.env`; the chat ID additionally
falls back to `telegram.allowed_user_ids[0]` in `~/.kiro/crew/config.json`.
The service process must run under the user owning that configuration, or receive
the two values through its private environment. It calls Telegram HTTPS directly;
it does not invoke a shell or read Telegram replies.

For semantic concern recognition, retain the deployed activity-only decision scope
if desired and enable the independent concern questions with:

```dotenv
LEMMI_DECISIONS_ENABLED=1
LEMMI_DECISIONS_MODEL=typesafe/jev-1.14
```

This shares the existing private `OPENROUTER_API_KEY`, deadline and probability
threshold. Manual help and reviewed explicit help/urgent phrases bypass Jev and
the conversational LLM. Jev's classifications remain unverified and can miss or
misclassify concerns; no monitoring/emergency-detection guarantee follows.

Optionally configure `LEMMI_TELEGRAM_BACKUP_CHAT_ID` for an independently verified
backup and `LEMMI_TELEGRAM_SAFE_CHAT_ID` for a distinct independently verified safe
alternate. A suspected caregiver/family-mistreatment report uses only the safe
alternate. Without one, safe contact is explicitly unavailable; the ordinary
caregiver is not notified about that report.

Apply `007_telegram_contact.sql` and additive `008_contact_followup_triggers.sql`
using `bun run db:migrate`, build/check the web
app, then coordinate gateway/web restart through the existing deployment process.
The existing database logging requirements still apply. The durable send loop runs
inside the gateway; a separate worker process is unnecessary for this increment.
Do not run migration/bootstrap commands against a test database mistaken for the
deployment. Never reseed a live profile during rollout.

## Rehearse

After rollout, refresh/reconnect the participant browser, select an allowed
fictional profile, and press **Get help**. This works without an active conversation.
The interaction pauses and a minimal fictional-demo Telegram alert is queued.
Repeat taps coalesce while that category's request is open. Then test a direct
request such as “I need assistance” and a separately rehearsed Jev concern.
Use fictional statements only. Actual microphone/speaker and Stackchan checks
remain separate from text/fixture transport checks.

An isolated real-send smoke is available; it requires a dedicated disposable
database ending in `_smoke_contact_test`, separate from every backend/contact test
and deployment database. Provision that database first with private logging enabled,
then supply the private configuration above and run:

```sh
LEMMI_CONTACT_SMOKE_DATABASE_URL=postgres://.../lemmi_smoke_contact_test \
LEMMI_TELEGRAM_SMOKE_SEND=1 bun run smoke:telegram-contact
```

It creates fictional Alex in that isolated database and exercises
`SessionCoordinator.requestHelp` → transactional durable request → real Telegram
sender. It sends at most one accepted manual alert, prints only the request ID and
status, and cancels future attempts for that rehearsal. It does not exercise the
deployed host or prove human reading. Set `LEMMI_CONTACT_SMOKE_TRIGGER=jev` for a
separate real Jev classification → contact smoke; this can send another alert and
requires `LEMMI_TELEGRAM_AUTO_ALERTS=1` plus the private decision settings.

## States, APIs and interfaces

`help.changed {help: HelpSnapshot}` is participant-safe and updates the browser's
visible status. Telegram API success means **accepted**, never delivered/read,
caregiver arrival, acknowledgment or resolution. No Telegram inbound callback or
chat-reply reader is installed.

Caregiver HTTP routes require the existing managed caregiver authentication and
profile authorization:

| Route                                              | Method | Body/action                                    |
| -------------------------------------------------- | ------ | ---------------------------------------------- |
| `/v1/profiles/:profileId/help-requests`            | POST   | `{ "commandId": "unique-stable-id" }`          |
| `/v1/profiles/:profileId/help-requests/:requestId` | GET    | Read status only                               |
| `.../:requestId/acknowledge`                       | POST   | Explicit authenticated acknowledgment          |
| `.../:requestId/cancel`                            | POST   | Cancel future attempts; cannot recall messages |
| `.../:requestId/resolve`                           | POST   | Human resolution, after acknowledgment         |

GET and link previews never acknowledge. Request IDs are not authorization tokens.
If the public reverse proxy uses an allowlist, add these exact resource paths to
the SvelteKit upstream before testing caregiver HTTP actions. The repository proxy template now includes them; its deployed copy still needs the normal reload. No acknowledgment UI
is introduced by this backend slice; Kylie consumes the published routes/events.

Primary and optional backup attempts commit with the request. The gateway polls
due work every 500 ms, uses leases, and checks profile/privacy/policy/contact/routing
revisions before sending. A backup becomes due after 60 seconds without
acknowledgment, or immediately after terminal primary failure; 120 seconds without
acknowledgment becomes `no_response`. These are prototype rehearsal defaults.
Only an explicit bounded Telegram 429 rejection may be retried once. A timeout,
network uncertainty or expired in-flight lease becomes `delivery_unknown` rather
than a blind duplicate send. Telegram provides no external exactly-once guarantee.

Stopping conversation does not cancel an initiated contact request. Acknowledgment
and explicit cancellation stop future scheduled attempts, but an already in-flight
message may still arrive. Deletion cascades controlled request/attempt records;
late provider completion performs updates only and cannot recreate deleted rows.
Application deletion cannot erase delivered Telegram messages/provider records.

Alerts contain a fictional display name, time, request ID, generic reason and
source attribution. Raw utterances, paraphrases, audio, sensitive topic details,
model instructions and contact destinations are excluded from durable jobs and
notification previews. Credentials stay server-side. Telegram receives its normal
destination/message payload and has independent retention; no universal deletion
or compliance claim is made.

## Verification and handoff

Initial implementation checks: 11 contact tests passed against isolated PostgreSQL
with fixture Telegram responses. They cover durable creation/deduplication/restart,
scope/revision guards, receipt rollback, recipient revocation, acknowledgment during
send, bounded retry/unknown delivery, backup/safe-alternate routing, expiry and
deletion races. The full fixture-backed suite subsequently passed **489 tests**, with **19 skipped**
and **0 failures**, against isolated PostgreSQL. Build and real-send results are
recorded separately; they are not implied by fixture acceptance.

Anay reviews server/data/access and rollout, Kylie consumes help-status events and
caregiver actions, and Emilia verifies actual local pause/stop/help and status
rendering. No hardware or real-patient readiness is claimed.


Final combined verification: **496 tests passed, 19 skipped, 0 failures; 12,827 expectations** across 61 files, using isolated PostgreSQL and fixture provider responses. Type/Svelte checks, production build, formatting and whitespace checks passed. The 19 skipped cases need their additional dedicated database variables; they were not marked passed. Three existing generic-photo alt-text warnings remain in Svelte diagnostics/build. The two real manual/Jev smoke alerts reached Telegram, confirmed by the user; no deployed service or production data changed.

Same-destination contact opt-out, removed verification and disabled routes survive ordinary restart. A changed trusted recipient destination/configuration is deliberate reprovisioning under the operator attestation. Caregiver/API and real device counterpart review remains required before integrated production use.

## Follow-up trigger extension

The contact contract additionally accepts these internal categories. Existing
manual-help, urgent, wellbeing and safeguarding behavior remains in the same
request/outbox service; no new provider or session authority is introduced.

| Category | Trigger meaning | Alert/source distinction | Policy |
| --- | --- | --- | --- |
| `departure` | A current participant departure/travel plan requiring the configured caregiver heads-up | **Departure/travel plan reported**. It does not infer wandering, impairment or danger from an ordinary plan. | Requires automatic alerts enabled |
| `contact_request` | The participant explicitly asks to call/contact a person | **Call/contact requested**. The configured recipient is notified; no requested relative is dialed, impersonated or promised a call. | Like explicit help, does not require the automatic-concern switch |
| `human_support` | Lemmi's admitted response recommends trusted human support | **Lemmi recommended trusted human support**, with `source=model_reply` and attribution that this is Lemmi's recommendation, not a participant report | Requires automatic alerts enabled |

The classifier/prompt integration decides whether a current input or admitted
response meets those conditions. A mere quoted, negated, hypothetical, historical
or third-person statement must not become a current participant report. Model
output cannot choose destinations, compose alert text, call people, or change a
profile. Safeguarding still takes precedence and never falls back to the ordinary
caregiver when a safe alternate is unavailable.

`008_contact_followup_triggers.sql` extends only the bounded request category and
source CHECK constraints. `HelpSnapshot.reason` remains `manual` for help/contact
requests, `urgent_concern` for urgent reports, and `concern` for the remaining
categories. Public requests/events do not gain utterance or model-response fields.
Only the fixed category/source/template is persisted and sent; neither the
participant's departure/contact wording nor Lemmi's recommendation is retained.

The follow-up adds positive participant wording: **I'm notifying your caregiver** while queued/sending and **I've sent a notification to your caregiver** only after Telegram accepts it. Failed/uncertain states remain explicit; acknowledgment/arrival are still separate internally. The generic notification preview retains only category/source, not a named requested relative or the conversation text.

Observed follow-up checks: 15 contact database tests / 182 expectations, 9 coordinator follow-up tests / 100 expectations, 5 adapter/gate tests / 144 expectations. Six actual Jev decisions passed for contact, departure, historical exclusion, support recommendation, safeguarding precedence and ordinary family-mention exclusion. The real Jev checks sent **zero additional Telegram messages**. The full combined result is recorded below; production rollout and actual device acceptance remain pending.


Follow-up final verification: **513 passed, 19 skipped, 0 failures; 13,127 expectations** across 63 files. Type/Svelte checks, production build, formatting and whitespace checks passed. All six real Jev scenarios passed with zero extra Telegram sends. Review additionally caught and fixed long reply/status overflow, refusal cancellation during support classification, and alerting from an output discarded by topic redirection. An existing speech test now waits safely through its initial null snapshot before asserting Stop ended the session. No production environment/database/services were changed. Apply additive migration **008** in addition to **007** before deploying this update.
