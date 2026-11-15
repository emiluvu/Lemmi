# Telegram caregiver contact

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

Apply `007_telegram_contact.sql` using `bun run db:migrate`, build/check the web
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
