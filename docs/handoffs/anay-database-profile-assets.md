# Anay → Kylie / backend: PostgreSQL and profile/assets APIs (A18–A19)

Implemented locally in an isolated copy, then integrated into the shared working tree without changing its branch or committing/pushing the other agent's work. Use the pinned Bun 1.4.4 workspace. Exact setup, storage limits and recovery behavior are in [db/README.md](../../db/README.md). Database mode is opt-in; the default mock remains in-memory.

## What changed

- Transactional, ordered, checksummed SQL migration and an explicit fictional-Alex bootstrap. Schema covers profile/access, caregiver-approved facts, device hashes, sessions, factual activity events, approved media and bounded mutation receipts. Contact and preference/item-policy tables are defined for subsequent workflows; no notification, journal-review or preference-writing workflow is added.
- Profile persistence uses the existing single session authority. Revision-checked caregiver edits pause/cancel old context before commit and update its approved context afterward. Future-only support saves preserve the current session's effective preset. Approved facts are bounded caregiver-provided records; no participant text becomes biography or enters durable command payloads.
- Opt-in device persistence commits credential hashes/expiry/boot assignment before claim success. Codes remain transient. Revocation immediately invalidates local work, then commits the scoped revocation; retries cannot revoke a replacement. Restart explicitly revokes credentials/codes and ends interrupted persisted sessions, requiring pairing and a fresh participant session.
- A database advisory lock allows only one gateway. Boot checks and current profile/privacy/policy checks reject stale process writes and obsolete checkpoint recreation. The current coordinator checkpoints only bounded snapshots/factual events, asynchronously so help/Stop stay independent. Uncommitted checkpoints may be lost on a crash; complete durable journal APIs remain A23.
- Private files use random UUID storage keys, 0700/0600 permissions, exclusive/no-follow access, byte/hash verification, database scope/policy checks and startup orphan recovery. Raw paths, private discussion context and licensing/provenance details stay server-side. There is no camera/video/microphone/TTS storage path.

## HTTP/client contract

All public routes require the configured HTTPS proxy. No credentials in query strings. Keep `/internal/*`, mock RPC/pages, PostgreSQL and speech/model services private. Extend the proxy allowlist for these exact resource routes; keep 4 KiB device-control limits and permit at most 29 MiB for the base64 upload envelope. Set production SvelteKit `BODY_SIZE_LIMIT=29M`; handlers enforce their narrower limits.

| Method/path | Authorization | Returns/behavior |
| --- | --- | --- |
| `GET /v1/profiles/profile-alex` | Managed caregiver token | `Result<ProfileDetail>` with approved facts and private caregiver fields |
| `PATCH /v1/profiles/profile-alex` | Managed caregiver token | Revision-checked partial edit; same command/body retry is idempotent; stale edit/receipt returns 409 |
| `GET /v1/participant/profiles/profile-alex` | Current paired-device token | Existing safe `ParticipantProfile`; no biography/guidance/journal/contacts |
| `POST /v1/profiles/profile-alex/photos` | Managed caregiver token | Approved static PNG upload; rejects music/unsupported formats |
| `POST /v1/profiles/profile-alex/assets` | Managed caregiver token | Approved PNG or PCM WAV upload; source/permission/tags required |
| `GET /v1/profiles/profile-alex/assets/:assetId` | Managed caregiver token | Private authorized bytes |
| `GET /v1/assets/:assetId` | Current paired-device token | Private authorized bytes |
| `GET /v1/assets/:assetId/metadata` | Current paired-device token | `Result<AssetMetadata>`, no private storage/discussion context |

Other profile IDs, including preview cards, are rejected. Device tokens never enter the identity provider's introspection request. Caregiver routes always verify managed identity; participant routes independently verify the assigned device/credential against current database state and boot. These are separate projections/permissions in the same app, not another backend.

`@lemmi/contracts` exports `ApprovedFactSchema`, `ProfileDetailSchema`, `ProfileUpdateSchema`, `AssetIdSchema`, `AssetCreateSchema`, `AssetMetadataSchema`, `DataRequestSchema`, and inferred types. Existing typed clients now add:

```ts
clients.profile.detail({ profileId: 'profile-alex' }); // managed token
clients.profile.update({
  profileId: 'profile-alex', commandId, expectedRevision,
  patch: { preferredName, avatarId, communicationSupport, interests,
           sensitiveTopicGuidance, approvedFacts },
});
clients.assets.create({
  profileId: 'profile-alex', commandId, expectedRevision,
  kind: 'image', mediaType: 'image/png', approved: true,
  source, permission, caption, discussionContext: null,
  entityIds, dataBase64,
});
clients.assets.metadata({ assetId }); // paired token
clients.profile.load({ profileId: 'profile-alex' }); // safe paired GET in live mode
```

Supply the appropriate Authorization header through the existing authenticated fetcher. Only include intended patch fields, not undefined UI placeholders. Approved facts are `{id: UUID, field: familiar_person | interest_context | personal_context, value, source:'caregiver_provided'}`; at most 10 facts, 200 characters each. Sending `approvedFacts:[]` explicitly clears the current approved facts; omitting the field preserves them. The database records caregiver author/revision separately. Remembering/excerpt enablement is rejected until A23/A24's permission/storage behavior exists. This API does not apply a new support preset to the current session (A20).

Legacy `profile.save`, `profile.loadCaregiver` and `assets.resolve` remain their existing mock/unavailable live seams; use the new `detail/update/create/metadata` operations for these implemented resource routes. Mock calls to new operations remain explicitly unavailable unless a caller supplies a fixture. No second frontend data store was added.

Fetch asset bytes with an authenticated request, not a token-bearing URL or unauthenticated `<img src>`. A browser UI may create a local object URL from the response and must revoke/clear it on scope/revision changes. Errors use the existing Result vocabulary; binary success has a validated media type, length, `no-store`, `nosniff` and a restrictive CSP. An unknown/blocked asset is 404; failed/corrupt private storage is 503. No fake success or public file fallback.

Supported formats are deliberately narrow: plain noninterlaced RGB/RGBA PNG (5 MiB, 4096 per dimension, 8 million pixels, no metadata chunks) and metadata-free PCM16 WAV (mono/stereo, 8–48 kHz, 20 MiB/5 minutes). JPEG/SVG/MP3/range requests are not implemented. Export reviewed static content into these supported formats; neither the schema nor the import proves permission or complete content tags. Media bytes never reach the LLM.

## Database/setup and current limits

Private config: `LEMMI_DATABASE_URL`, absolute `LEMMI_PRIVATE_MEDIA_DIR`, and the same managed `LEMMI_CAREGIVER_SUBJECT` as authentication. PostgreSQL must use the private statement/parameter/terse-error logging settings in `db/README.md`; migration/bootstrap reject unsafe defaults. Use `bun run db:migrate`, `bun run db:bootstrap`; existing live gateway/web commands then opt into persistent mode. Without a database URL, live control/text retains the earlier explicit ephemeral behavior and data routes report unavailable. No dependency/lockfile changes.

Each machine can run its own independent database/media directory. Later, select one shared gateway/HTTPS origin and test that host/network; do not run competing gateways against one database. `db/compose.yaml` is an optional loopback-only PostgreSQL 17 configuration with logging restrictions and a persistent named volume; Docker/other-host execution has not been verified here. Native PostgreSQL 14.24 was exercised in a private temporary cluster on this machine, without installing a system service or changing unrelated processes. The temporary test server is stopped after verification; no permanent production DB/credentials are claimed.

Full contact routing/outbox, learned policy operations, journal-review/summary APIs, profile deletion/private-cache cleanup, and end-to-end deletion/callback races remain A21–A25. The tests reject operations once deletion state is set, but this is not an implemented deletion workflow. Replaced DB rows do not erase WAL/backups or provider data. Runtime/setup currently use a dedicated team-controlled DB owner; PostgreSQL RLS/separate production roles are not claimed. Managed provider/login configuration, actual remote/LAN TLS, browser UI/accessibility, and hardware still need their respective owners' checks.

## Observed verification

On Linux, Bun **1.4.4**, native PostgreSQL **14.24**: real database tests exercise migration repeatability, sole-Alex scope, concurrent/retried edits, rollback and precommit cancellation, safe participant projection, committed hashed credentials/revocation/restart, static-media scope/integrity/policy/orphan handling, single-gateway ownership, stale-boot/deletion checkpoint rejection immediate local revocation while SQL is blocked, and rapid Stop/new-Start ordering while SQL is delayed. No raw audio/transcripts/LLM replies enter persisted test records.

`smoke:data` exercises the actual production SvelteKit build → authenticated gateway → PostgreSQL, using certificate-verified HTTPS and a fixture managed identity endpoint. It verifies caregiver read/PATCH/retry/stale rejection, safe paired projection, real approved PNG upload/read/metadata, unsupported SVG rejection, preview/invalid token rejection and committed revocation. It does not use a real identity provider or hardware. The dedicated `_test` database is deliberately reset by tests/smoke; never point them at other active data. Final command counts/results are recorded in the build-plan acceptance entry.

**Kylie next:** use `profile.detail/update` in the caregiver editor and the scoped asset routes/clients; review field shapes, missing/error states and byte-fetch cleanup. Keep examples preview-only; preserve supported preset labels and the exact five avatars.

**Backend counterpart next:** review database membership/locking, precommit cancellation, device issuance/revocation/boot fencing, media scope/path/integrity checks and async checkpoint failure handling before integrated merge. Complete A20–A25 behavior through these existing stores rather than a parallel authority. The speech agent's adapter files and pipeline were preserved; coordinator integration only supplies approved profile context/cancellation and persistence snapshots.
