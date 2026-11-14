# Anay review of Emilia's app-data proposal

Reviewed November 14, 2026 on `anay/app-data-schema`, based on `backend-deploy` at `8172e17`. This feature branch has not been deployed. The actual deployed revision remains `04d050e`. The separate speech implementation remains on `anay/speech-pipeline`.

## Decision

Emilia's proposal is useful as a storage plan. Adopt its album/playlist subset with the corrections below; retain the remaining tables as an inactive proposal until their service transactions and acceptance checks exist. Do not apply the whole draft to an existing database. No notification, journal, consent, remembering, deletion or camera workflow is enabled by this change.

Original source: `emilia/firmware-foundation`, commit `4e8993f16e7919b70920ef538f7d9394f662eb24`. Only its [SQL draft](../../db/proposals/002_app_data.sql) and [handoff](anay-app-data-schema.md) were imported for review. No firmware commits were merged. The draft SQL is preserved unchanged as historical review input and remains outside migration discovery.

| Proposed area | Decision and required next work |
| --- | --- |
| Albums, photo membership, track metadata, playlists | Promoted with corrections to `002_media_collections.sql`; storage only. A05 must implement authorized catalog hosting and reviewed-pack projection before clients can use it. |
| Canonical entities and aliases | Defer to A24. Prevent alias/canonical namespace collisions, define the reviewed resolver/import, and validate/backfill existing IDs before adding catalog FKs. Keep `media_assets.entity_ids` as the only asset tag store. |
| Privacy agreements and session excerpt permissions | Defer to A23/A24. Current profile CHECKs continue to forbid permission enablement. Permission/revocation flows and delayed-write revision checks must exist before storing excerpts. |
| Journal sources, summaries and source links | Defer to A23. Implement typed source writers, nonempty revision-checked summary links, transactional dependent-summary removal and edit/review races. `JournalSchema.summary` remains `null`. |
| Contact routing, help requests, recipients, attempts | Defer to A21/A22. Implement authenticated acknowledgment, recipient verification/revision checks, monotonic transitions and isolated real/simulation execution. Acceptance/delivery never implies arrival or acknowledgment. |
| Durable jobs | Retain as design input for A22/A23. Implement atomic request/job creation, leases, bounded retries, unknown-send reconciliation and stale-result fencing; table presence is not a worker. |
| Deletion jobs | Defer to A25. Fence late callbacks and bootstrap by deletion epoch, invalidate work, and verify actual private-file/cache removal across restart. |
| Camera access events | Defer until the camera slice has cleanup scheduling and scoped relay. Metadata never authorizes a camera or proves physical local controls. |

The draft correctly reuses existing profile/session IDs, private asset storage, one session authority and typed job references. Same-profile/session foreign keys, no duplicate contact destinations, separate transport receipts and a deletion job surviving its profile are sound foundations. Emilia already identifies most missing service safeguards in her handoff; the observations below explain staged promotion.

## Concrete review findings

1. **The standalone draft is not directly compatible with the migration runner.** Its `BEGIN`/`COMMIT` would interfere with the runner's outer transaction, advisory lock and checksum insertion. Promote small migrations without transaction-control statements; leave `001_foundation.sql` unchanged. A forced failure partway through the new migration proves both its DDL and ledger entry roll back.
2. **Excerpt permissions are not enforced by draft table constraints.** PostgreSQL accepted a participant excerpt with both profile flags false and no session grant/agreement. This was a direct SQL diagnostic against the draft, not a reachable new API. A23 must authenticate and lock the current profile/session, validate an enabled unrevoked grant plus current privacy/generation, and reject end/revoke/delete races before exposing writes.
3. **Deleting a source leaves its summary text.** PostgreSQL removed the `summary_sources` link but retained the summary after source deletion. As the handoff warns, source/event edit/removal must remove every dependent summary in the same serialized transaction; summary commits need current source revisions and at least one valid link. A mutable source type must not become an excerpt-permission bypass.
4. **Alias and canonical namespaces can conflict.** The draft accepted canonical `object:fixture-a` as an alias for different canonical `object:fixture-b`. A resolver cannot interpret that unambiguously. Validate a single namespace or use a catalog schema/transaction that prevents this conflict in both insertion directions.
5. **Notification states need service invariants.** PostgreSQL accepted `state='acknowledged'` with no actor/time. Nullable-pair CHECKs are useful but do not supply authenticated acknowledgment or monotonic request/receipt transitions. Provider retries, recipient changes and callbacks require runtime tests before promotion.
6. **Collection membership needed contract corrections.** The draft lacks stable membership IDs, permits track titles up to 200 characters while the activity schema permits 100, and has unbounded positions. Immediate position uniqueness also makes an in-place swap fail. These are corrected in the active subset.

No raw speech, real participant information, contact destinations or external calls were used for review. The diagnostic reports booleans only; successful reproduction of a draft gap is not acceptance of that behavior.

## Implemented migration

[002_media_collections.sql](../../db/migrations/002_media_collections.sql) adds five tables: `albums`, `album_photos`, `music_tracks`, `playlists`, `playlist_tracks`, plus the unique media key needed by composite foreign keys.

- Albums and playlists belong to Alex. Composite FKs enforce same-profile membership and image/music kind. This is resource consistency, not caller authorization.
- Membership rows have stable application-generated UUID entry IDs distinct from asset IDs. One asset appears at most once per collection.
- Positions are 0–19 and unique per collection, bounding membership to 20 entries to match the current pack arrays. Gaps are permitted; hosting must sort by position and validate the complete pack.
- Named `DEFERRABLE INITIALLY IMMEDIATE` position constraints permit transactional reordering without replacing entry IDs. A future writer locks the collection, defers only its position constraint, updates positions and the collection revision together, then commits a unique final order. Revision checks/invalidation remain part of A05, not an automatic SQL behavior.
- Titles are nonblank and at most 100 characters; artist is at most 200; duration is 1–300,000 ms. Captions/context/source/permission remain on the existing asset record. No format support changes.
- Asset/profile deletion cascades only related collection metadata. This is not a full profile deletion endpoint or proof that private bytes/caches are removed.
- PUBLIC has no table privileges. Existing explicit profile/asset projections and permission-off CHECKs are unchanged. No new REST/client/coordinator surface exists.

Existing media reads must continue to check caller scope, current approval and eligibility, revisions and actual private bytes. A collection row must never bypass them, expose private discussion context, or manufacture a played receipt.

## Observed verification

Native PostgreSQL **14.24**, pinned Bun **1.4.4**, isolated local cluster and separate disposable databases; no shared or deployed database changes. The new migration was exercised both as a fresh install through the existing suite and as a populated `001` upgrade.

- **97 Bun tests / 875 expectations passed**, including six migration tests for atomic rollback, existing checksum/data preservation, repeat application, type/scope rejection, bounded metadata, stable ordering and cascade cleanup. Existing authorization, persistence, cancellation and stale gateway checks passed with the new migration installed.
- The historical full draft applied successfully in a different disposable database. All four gaps above (excerpt grant, dependent summary removal, alias namespace and acknowledgment actor) were reproduced. The diagnostic removes its own schema afterward.
- `bun run check`, `bun run build` and `bun run format:check` passed. Production `smoke:data` passed actual SvelteKit → authenticated gateway → PostgreSQL profile read/edit/retry/conflict, approved photo upload/read, participant projection, preview denial and committed device revocation over verified fixture TLS/identity. No real provider or hardware check was needed for this migration-only slice. PostgreSQL 17 Docker, remote-host upgrades and counterpart review remain unrun.

For the migration suite set `LEMMI_SCHEMA_TEST_DATABASE_URL` privately to a dedicated database ending `_schema_test`, separate from `LEMMI_TEST_DATABASE_URL`, and run `bun test tests/media-collections.test.ts`. It resets its selected schema and migration ledger. For the historical diagnostic set `LEMMI_REVIEW_DATABASE_URL` to a third dedicated database ending `_review_test` and run `bun scripts/review-app-data-proposal.ts`; it resets/removes that schema. Never select shared/live databases. Neither command defaults to the deployed database.

## Next handoff

Anay reviews/promotes the migration before deployment. Lukas should review the stable collection entry IDs, 20-entry bounds and eventual reviewed-pack projection; Kylie consumes the eventual authorized catalog APIs when A05 supplies them. Keep A05 and A21–A25 open. No user input is blocking this isolated implementation; real hardware and provider-specific work remain separate.
