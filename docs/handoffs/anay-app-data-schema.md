# App data schema proposal for Anay

Status: review draft, November 14, 2026. No runtime behavior or active migration changed. This is a concrete storage handoff, not acceptance of completed journal, consent, contact, camera or deletion features.

The proposed SQL is [db/proposals/002_app_data.sql](../../db/proposals/002_app_data.sql). It extends [001_foundation.sql](../../db/migrations/001_foundation.sql); it does not replace the current backend or session authority. The migration runner only reads `db/migrations`, so normal startup/migration commands do not apply this proposal. Anay owns promotion into ordered migrations and shared contracts. Preserve the existing migration checksum.

## Storage decision

Use the existing PostgreSQL database for structured records, the existing private-media adapter for approved static files, and bounded server memory for live speech/dialogue. Keep one selected backend authority. Managed sign-in remains the identity authority; `profile_access.subject` maps its validated subject to Alex. No new password/account database is needed.

| Data | Storage and relationship |
| --- | --- |
| Participant profile and approved biography | Existing `profiles`, `profile_access`, `profile_facts`; caregiver guidance remains private |
| Photos | Existing `media_assets` + private files; new `albums` → ordered `album_photos` → image assets |
| Music | Existing `media_assets` + private files; new `music_tracks` adds title/artist/duration; `playlists` → ordered `playlist_tracks` |
| Reviewed topic/object IDs | New `content_entities` and canonical alias mapping; existing asset tags remain authoritative |
| Matching, guessing and teaching content | Reviewed versioned packs in the existing content/contracts seam; no new game engine or arbitrary executable content table |
| Session checkpoints and factual events | Existing `sessions`, `activity_events`; no transcript or persisted full reducer state added |
| Journal | New typed `journal_sources`: event reference, caregiver observation, or permitted selected participant excerpt |
| Summary | New `summaries` plus `summary_sources`; every supporting source belongs to the same profile and session |
| Privacy choices | Existing profile settings + new minimal `privacy_agreements` and explicit `session_excerpt_permissions` |
| Learned preferences | Existing `profile_preferences` and `profile_item_policies`; separately permitted structured state only |
| Help routing | Existing `contacts`; new `routing_policies`, `help_requests`, `help_request_recipients`, `notification_attempts` |
| Background work | New `jobs`: typed resource references, deadlines, deduplication and leases; no generic JSON payload |
| Profile deletion | New retryable `deletion_jobs` plus existing opaque `media_cleanup` keys |
| Camera check-ins | New `camera_access_events` for minimal access metadata; frames remain memory-only |

Composite foreign keys prevent linking another profile/session's resource. They do not authorize a caller. The existing server must still enforce caregiver membership or paired endpoint scope. Alex remains the only functional profile; preview cards stay outside these tables. No row-level-security claim is added.

## Concrete design choices

- Retain current text profile/session IDs and application-supplied UUIDs for new resources. All dates are server UTC timestamps. No extension dependency or new package is introduced.
- Keep photo captions/context/source/permission on `media_assets`, rather than duplicating them per album. Editing one photo's context affects every album containing that asset and invalidates related pending speech. Create a separate approved asset if different context is needed.
- An asset appears at most once in each album/playlist. Reordering needs a transaction that avoids intermediate position collisions, for example removing/reinserting membership rows under the collection lock. Duplicate track entries can be added later if requested.
- Retain existing profile-scoped media ownership even for generic demo content. Version generic pack definitions in the repository; ingest approved files into Alex's existing private asset store. A cross-profile asset library is outside the demo.
- Import validates canonical tags and source permissions. `entity_ids` is the one tag store; do not maintain a separate competing asset-tag table. Aliases resolve directly to canonical IDs, without alias chains. No automatic visual tagging/inference is added.
- SQL's 5-minute track limit matches the current WAV adapter. The existing schema lists JPEG/MP3 types, but the current parser accepts only the documented PNG/PCM-WAV subset. This proposal does not enable new formats or streaming range requests.
- The 1,000-character excerpt ceiling is a proposed bounded subset, not permission to save a full transcript. Anay should agree the excerpt shape with Kylie. Observation/summary bounds match the existing client inputs (1,000/2,000 characters).
- Journal source types cannot be reclassified to bypass excerpt rules. Participant excerpts retain recognition uncertainty. Editing observations/summaries overwrites the old text; keep attribution/timestamps, not a hidden content history. An edited/reviewed AI summary keeps its AI origin.
- No cognition scores, failure counts, emotion labels, transcript history, media blobs, arbitrary URLs, prompt logs or contact destination copies are introduced.

## Required service transactions and contract handoffs

The SQL provides structure and foreign keys. The following are required application behavior, not guarantees supplied by DDL.

### Permissions and remembering

Keep `001_foundation.sql`'s checks forbidding excerpt/remembering enablement until their complete flows exist. Do not remove those checks just to apply this draft. Anay must create a later explicit migration when ready, bind a current remembering agreement to the profile policy flow, and add the missing permission/review schemas to the shared contracts. `JournalSchema` currently exposes `summary: null`; it needs an intentional extension before serving summaries. No replacement API URLs are proposed here.

To save an excerpt: lock/check the active profile and session, authenticate the endpoint, verify the enabled session grant and unrevoked agreement, and compare current privacy revision and generation with the pending write. Require the explicit session choice even when the profile default is enabled. Refusal/revocation clears pending excerpt buffers. No writes may complete after session end; completed permitted excerpts may remain until removal/reset. No full transcript is stored.

Remembering remains separate. Keep only canonical IDs, prefer/avoid/source and bounded first-occasion markers; no durable signal log. Add created/updated timestamps and a bounded prior-positive-session marker to existing preference records when A24 lands. `prior_session_id` on item policy identifies the first distinct uncertainty occasion; never collect a cumulative mistake history or schedule retests. Validate catalog IDs, evidence and all revisions before committing. Turning remembering off disables use/writes; Forget separately deletes learned state. Caregiver-entered guidance stays distinct.

### Journal and summary correctness

1. Store only schema-validated allowlisted factual events through the existing event writer; JSONB is not permission for arbitrary text. Create measured source references idempotently.
2. A summary worker reads persisted permitted sources only. With excerpts off, omit participant text and paraphrases; never send the live dialogue buffer to the worker. Preferences/approved biography are not automatically summary sources.
3. Copy source IDs and revisions into transient worker memory. At commit, lock the profile/session and sources, recheck profile/privacy/policy revisions, deletion state and every source revision, then write the summary with at least one source link in the same transaction. A finished session can be summarized from retained sources; it cannot accept new delayed excerpts.
4. BEFORE any source edit/removal, delete every linked summary in the same transaction. This includes deletion/change of an underlying activity event. Then edit/remove the source. Cascading deletion of `summary_sources` alone does not remove summary text. Serialize against summary commit using the same profile/source locks.
5. A summary edit needs expected revision, permitted source validation, editor/time and a return to unreviewed. Review records reviewer/time and preserves AI origin. No old summary text is retained. Generation failure leaves factual sources usable.

Do not expose excerpt or summary writes until these checks and dependent-summary removal are implemented and tested. If desired, Anay can add database triggers/constraint triggers as defense in depth; this draft does not pretend a plain CHECK can validate cross-table permissions or require nonempty source links.

### Contacts and workers

Request creation, recipient-ID/revision snapshot and initial send/backup/no-response jobs commit together. Manual help bypasses LLM/journal work and works without a session. The first SQL draft stores only manual/urgent trigger categories; finer concern codes must come from Anay's reviewed safety contract, not arbitrary model text. A caregiver allegation selects the configured safe alternate, excluding the implicated recipient; absent safe routing is explicit failure. Contact destinations remain in the protected existing `contacts` table.

Worker leases use `FOR UPDATE SKIP LOCKED`, a unique lease token and expiry. Reclaim only expired leases and enforce bounded attempts/deadlines; a lease is not permission for a second external send. Before sending, recheck recipient revision/verification/opt-in, request mode/cancellation/acknowledgment/expiry, routing and active profile. Use the attempt idempotency key and reconcile unknown provider results. Provider calls are outside SQL transactions. Notification-attempt bounds and worker job bounds are separate; restarting a job must not bypass the one-retry delivery bound.

Resolve destinations only at send time. A changed/deleted recipient cancels the stale send; never silently redirect. Contact removal first cancels pending jobs, clears recipient/attempt references and updates routing, then deletes the contact; restrictive foreign keys make accidental silent rerouting fail. Authenticated request-recipient acknowledgment is separate from caregiver profile access; recipient subject/token mapping and signed callback verification still need Anay's selected auth/provider contract. No raw acknowledgment token belongs in these tables.

API help status is a projection of request state plus attempt receipts, matching `HelpSnapshotSchema`; the request's internal state is not the whole public status enum. Provider acceptance/delivery never means acknowledgment or arrival. Later receipts cannot erase acknowledgment/resolution. Conversation Stop does not cancel contact work; `attempts_canceled_at` separately stops future sends and does not undo previous delivery. `no_response` does not authorize infinite retries. Real/simulation adapters stay isolated.

### Deletion and camera

Deletion first marks the profile deleting, invalidates generations/revisions, pauses local work, disables routing and cancels jobs. The job copies only opaque file keys into existing `media_cleanup` before deleting metadata. Remove bytes and controlled caches, delete dependent rows in FK-safe order, then delete the profile. `deletion_jobs` deliberately survives the profile row until every controlled store confirms removal. Its epoch/ID must fence late jobs/callbacks; do not recreate Alex until deletion completes and old work cannot apply. Final bootstrap/recreation epoch integration remains Anay's A25 implementation.

`help_requests.session_id` is restrictive so deleting a session does not silently delete an initiated request. A journal-only removal deletes its sources/dependent summaries while retaining minimal session/contact metadata where still needed; full profile deletion explicitly removes contact/request rows before sessions. No universal provider/backup erasure is promised.

Camera table retention is at most seven days from request, earlier on deletion/reset. An explicit cleanup schedule must delete expired rows. Active consent/request tokens and frames remain transient; persisted metadata never authorizes reconnect/restart. Local Stop/expiry/revocation closes the actual camera independently. Metadata is not proof of tested hardware behavior.

## Review and validation handoff

Split into small migrations for content/media, journal/permission scaffolding, contact/jobs, and deletion/camera as features land. Do not enable feature flags/permissions from table presence. Existing repository queries include `SELECT *`/`RETURNING *`; inspect their row mapping and private/public projections before adding fields to existing tables. Anay still needs to implement reads/writes.

Required disposable-PostgreSQL checks before promotion:

- Apply the real foundation then this draft on a fresh dedicated `_test` database; verify migration order and rollback on invalid DDL. Never use an existing shared database.
- Reject cross-profile/session links, image-in-playlist/music-in-album, duplicate positions and malformed typed journal sources. Use isolated authorization fixtures rather than enabling another functional profile.
- Exercise excerpt-off storage inspection, revocation/end/deletion during delayed writes, source edit/removal during summary generation, dependent-summary removal and stale review edits.
- Exercise durable request+job creation, duplicate help, expired leases, uncertain sends, recipient change/removal, acknowledgment races, backup/no-response and simulation separation.
- Prove files and caches disappear, deletion survives restart and late callbacks cannot recreate data. Prove camera access metadata expiry; hardware camera controls require separate physical checks.

Authoring validation: repository schema/contracts/specifications were inspected, migration discovery was checked, and whitespace checks passed for all changed/new files. The proposal is outside migration discovery. `psql` and `postgres` were unavailable on this workspace PATH, so the SQL has not been executed; runtime/database acceptance remains pending. No provider, hardware or live feature checks were performed for this handoff.
