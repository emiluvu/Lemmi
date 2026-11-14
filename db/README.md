# PostgreSQL and private media — A18/A19

The optional live backend now uses PostgreSQL for Alex's profile/access, approved facts/media, issued-device credential hashes and session/factual-event checkpoints. The schema also defines scoped contact and preference/item-policy tables for later owners; their editing, notification, journal-review and remembering workflows are not implemented here. Mock mode still runs without a database and remains in-memory. No live database failure becomes mock success.

Bun **1.4.4** supplies the PostgreSQL driver; there are no new dependencies or lockfile changes. This slice was exercised on native **PostgreSQL 14.24** in an isolated local cluster. `db/compose.yaml` supplies an optional PostgreSQL 17 Docker setup for portable development; Docker was unavailable here, so that specific container configuration and other machines are not yet verified.

## One setup per machine

Feature branch `anay/chat-support-hardening` adds `003_communication_support.sql` for minimal profile/session support-selection provenance. It contains actor/time/config IDs, never dialogue, and cascades with its parent profile/session. `001` is unchanged. `002` is reserved for the independent media-collection branch; `003` depends only on `001`. Run the normal explicit migrations before starting the new code. [Preset integration handoff](../docs/handoffs/anay-chat-support-hardening.md) explains the caregiver routes, transaction/cancellation behavior and undeployed status. Apply the host's new proxy allowlist separately when deploying.

Feature branch `anay/app-data-schema` adds [002_media_collections.sql](migrations/002_media_collections.sql): profile-scoped albums/photos, music metadata and playlists with stable entry IDs. This is storage only; no collection CRUD/hosting API is enabled. It is not deployed. Existing `001_foundation.sql` is unchanged. Read [Anay's review](../docs/handoffs/anay-app-data-schema-review.md) before promotion. Emilia's original [full draft](proposals/002_app_data.sql) and [handoff](../docs/handoffs/anay-app-data-schema.md) remain inactive design input; do not apply the full draft on top of active migrations.

You do not need to select a primary host now. Each test machine can have its own database and private-media directory. Use fictional data. Devices are paired separately to the selected origin and require a new explicit pairing after gateway restart. Later, select one primary host and configure the other clients to use its authenticated HTTPS/WSS origin; do not connect multiple gateways to the same database. The gateway holds a PostgreSQL advisory lock enforcing one authority.

Install/run PostgreSQL using your host's maintained package or Docker. With Docker, set `LEMMI_POSTGRES_PASSWORD` privately in the root `.env`, then:

```sh
docker compose --env-file .env -f db/compose.yaml up -d
```

The database binds to loopback only; its named volume survives container restart. This command has not been run here. Pick an unoccupied `LEMMI_POSTGRES_PORT` if needed; do not stop another project's database. Never expose the database or media directory through the web proxy. Do not run `down --volumes` unless you intend to delete that machine's database.

Set these values in the ignored root `.env` (real secrets must never be pasted into chat, command arguments, source, screenshots or logs):

```dotenv
# Preserve the existing managed-auth/TLS control configuration as well.
LEMMI_DATABASE_URL=postgres://lemmi:REPLACE_PRIVATELY@127.0.0.1:5432/lemmi
LEMMI_PRIVATE_MEDIA_DIR=/ABSOLUTE/PRIVATE/PATH/lemmi-media
LEMMI_CAREGIVER_SUBJECT=EXACT_CONFIGURED_MANAGED_SUBJECT
BODY_SIZE_LIMIT=29M
```

Use a URL-encoded password in the URL. The media directory must be an absolute canonical path outside public/static directories; the adapter creates it with mode 0700 and files with 0600. `.data/` at the project root is ignored and can be used locally if you supply its actual absolute path. Treat it and the database volume as private data, not repository content. Remote PostgreSQL requires `sslmode=verify-full` and a trusted certificate; remote TLS/venue access is not verified by the local tests.

```sh
bun install --frozen-lockfile
bun run db:migrate
bun run db:bootstrap
bun run build
# Existing live gateway/web startup, with the private .env and HTTPS proxy configured:
LEMMI_MODE=live bun run start:gateway
# In another terminal; ORIGIN must match LEMMI_PUBLIC_ORIGIN:
LEMMI_MODE=live HOST=127.0.0.1 PORT=3000 bun run start:web
```

Supply `ORIGIN` through `.env` to the web process. Migrations are explicit, ordered, transactionally applied and checksum-verified under a transaction lock. The gateway does not silently run migrations on startup. `db:bootstrap` creates only fictional Alex, assigns the configured managed caregiver, and provisions the one device record. It does not overwrite an existing profile or silently reassign ownership; changing the configured subject needs an explicit authorized access migration. Setup errors are sanitized.

The web adapter defaults to 512 KiB, so set `BODY_SIZE_LIMIT=29M` for the bounded base64 upload envelope. The HTTPS proxy must also permit that ceiling on upload paths while retaining 4 KiB device-control limits. All profile handlers still bound their own JSON to 32 KiB, device control to 4 KiB, and asset uploads to 28 MiB. Do not expose `/internal/*`, mock pages/RPC or model/database services.

The initial migration assumes a dedicated Lemmi database and an application OS/database account under team control. The repository verifies membership/resource scope on every operation inside a transaction; there is no public SQL interface and no claim of PostgreSQL row-level security. PUBLIC gets no schema/table privileges. In this prototype the setup/runtime connection owns these dedicated tables; selecting separate production migration/runtime roles is a later deployment step. Every other machine needs its own private credentials and host checks. The setup/startup check requires `log_statement=none`, `log_min_error_statement=panic`, `log_parameter_max_length=0`, `log_parameter_max_length_on_error=0`, `log_error_verbosity=terse`, `log_duration=off`, and `log_min_duration_statement=-1`. Configure these in the server configuration (the compose command supplies them). Terse error verbosity matters because default constraint errors include rejected row details even when statement logging is disabled. Setup fails before seeding/private operations when these settings differ. Keep statement/parameter/row-detail logging disabled, disable HTTP body capture, and keep provider/admin secrets server-side.

## Storage and interruption behavior

- Profile writes lock the current Alex row, check caregiver membership and `expectedRevision`, and commit a single new revision. Command retries retain only fingerprints/revision/resource references, never a second copy of profile/biography text. A retry after another edit returns conflict instead of returning obsolete sensitive text. Receipts are bounded to 1,000/profile, and assets to 100/profile.
- Approved facts are caregiver-authored, attributed records (at most 10 × 200 characters) and separate from transient participant text. Replacement removes old fact rows. The existing conversation adapter receives only these bounded approved facts; private guidance, contacts and asset bytes are not sent to the LLM. Provider retention/disclosure remains documented in the speech handoff.
- Changes to name/avatar/interests/guidance/facts pause the existing coordinator and cancel pending context/output before COMMIT. A commit failure leaves it paused. Saving only Conversation support changes the future default; current-session effective support is retained (explicit apply-now remains A20). Avatar is still one of the exact five IDs. Excerpt/remembering enablement is rejected pending A23/A24.
- Pairing codes stay transient. Credential issuance stores a SHA-256 digest/credential ID/expiry/boot assignment before returning success; no raw credential or code is persisted. Reads recheck database scope; the connected-socket watchdog also checks current assignment. Revocation invalidates local work before waiting on SQL. Old revoke retries cannot clear replacement credentials. All outstanding codes/credentials are deliberately revoked on gateway restart, persisted device rows remain, and re-pairing is required. Do not promise durable login across restart.
- The existing single coordinator keeps running session/activity authority. Bounded snapshots and schema-validated factual events are checkpointed asynchronously; Stop/help do not wait on database or journal work. Checkpoint errors pause/close the affected device connection; no success is fabricated. Crash can lose an uncommitted checkpoint: no durable-event guarantee is claimed. Committed event IDs are stable/deduplicated. On startup interrupted persisted sessions are ended with a generation bump; no active conversation/capture/playback is restored.
- Assets are caregiver-approved static PNG or PCM WAV only, with source/permission/canonical tags. No upload comes from camera/microphone/TTS capture. Uploads are bounded, one at a time in the authority; the file is written using a random UUID and exclusive/no-follow mode, then approved metadata is committed. Failed/uncertain commits reconcile against the DB before deleting bytes; startup under the single-owner lock removes unreferenced UUID objects after crashes. Missing/corrupt/unsupported media is an explicit failure.
- Reads authorize before accessing the file, hold the profile lock during the bounded read, reject avoided/retired tags, and verify length/hash through a no-follow file descriptor. No raw storage keys/paths/private discussion context appear in participant metadata or URLs. Responses use `Cache-Control: no-store` and `nosniff`; clients attach bearer tokens in headers. Bytes already delivered to a client cannot be recalled.
- Native format support is intentionally narrow: noninterlaced 8-bit RGB/RGBA PNG, at most 5 MiB/4096 per dimension/8 million pixels, with no extra text/EXIF/ancillary chunks; PCM16 mono/stereo WAV, 8–48 kHz, at most 20 MiB/5 minutes, without metadata chunks. JPEG, SVG, MP3, animation, range/resume and arbitrary URLs are explicitly unsupported in this increment. Export approved source media into the accepted format first; import does not prove licensing or complete visual tags.
- PostgreSQL/WAL/backups and delivered provider messages have their own retention. Replacing a DB row does not erase old backup/WAL pages. Full profile deletion, dependent summary/cache cleanup and late-write/provider callback deletion races remain A25. No deletion endpoint or automatic media/record expiry is claimed here. Contact/outbox execution is A21/A22; complete factual journal/review/summary APIs remain A23. Do not infer those workflows from the presence of tables.

## Verification

Create a **dedicated** disposable database ending in `_test`, set `LEMMI_TEST_DATABASE_URL` privately, and run:

```sh
bun run test:data
bun run check
bun run test
bun run build
bun run smoke:data
bun run format:check
```

The database tests/smoke refuse a target whose database name does not end in `_test`. They truncate fictional test records and must never target live/shared test data in use by someone else. Without the variable, the ordinary test suite skips the database integration cases; media/parser/HTTP/client tests still run. Run `test:data` with the variable to establish actual persistence. `smoke:data` uses the production SvelteKit build, real PostgreSQL, certificate-verified HTTPS, and a fixture identity provider. It exercises caregiver/participant routing, profile revision/retry behavior, actual private photo upload/read and committed device revocation. It sends no notifications and makes no external model requests. Native PostgreSQL commands used to prepare this workspace's temporary test cluster are not required on other machines; their actual host setup remains to be verified.

See [A18/A19 handoff](../docs/handoffs/anay-database-profile-assets.md) for exact APIs and observed results.

The communication-support suite uses a separate disposable `LEMMI_SUPPORT_TEST_DATABASE_URL` ending `_support_test`, different from `LEMMI_TEST_DATABASE_URL`. It truncates fictional profile rows and verifies selection provenance, scoped access, retries, failed commits/checkpoints and Stop while SQL is delayed. With both variables set, `bun run test` runs these alongside the ordinary backend integration tests. `smoke:data` now also exercises caregiver support read/save/apply/retry/Resume/Stop through built HTTPS routes and a computer control socket; identity/socket remain fixtures.

For the media migration upgrade/rollback suite, set `LEMMI_SCHEMA_TEST_DATABASE_URL` privately to a **different dedicated disposable** database ending `_schema_test`, then run `bun test tests/media-collections.test.ts`. This suite resets its selected `lemmi` schema and migration ledger to test a populated foundation upgrade; do not reuse the ordinary backend-test database or another agent's database. With both variables set, `bun run test` runs both suites against separate databases.

For the historical full-draft diagnostic, use a third dedicated database ending `_review_test` via `LEMMI_REVIEW_DATABASE_URL` and run `bun scripts/review-app-data-proposal.ts`. It resets/removes that schema and reports boolean observations of missing draft guards; it is not a deployment command or an acceptance test for those behaviors.
