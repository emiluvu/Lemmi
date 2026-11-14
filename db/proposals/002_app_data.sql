-- REVIEW DRAFT, not an active migration. Apply only to a disposable database
-- after 001_foundation.sql. Do not run against the shared backend as-is.
-- No permissions are enabled and no existing data is backfilled here.
-- UUIDs are supplied by the application; existing text profile/session IDs stay.
BEGIN;

-- Same-profile foreign keys need these referenced unique keys.
ALTER TABLE lemmi.media_assets ADD UNIQUE (profile_id, id, kind);
ALTER TABLE lemmi.activity_events ADD UNIQUE (profile_id, session_id, id);
ALTER TABLE lemmi.contacts ADD UNIQUE (profile_id, id);

-- Static, reviewed canonical IDs shared across all activities and prompts.
-- No participant-derived content or private biography belongs in this catalog.
CREATE TABLE lemmi.content_entities (
  id text PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 100),
  kind text NOT NULL CHECK (kind IN ('topic', 'object')),
  label text NOT NULL CHECK (length(label) BETWEEN 1 AND 100)
);
CREATE TABLE lemmi.content_entity_aliases (
  alias_id text PRIMARY KEY CHECK (length(alias_id) BETWEEN 1 AND 100),
  canonical_id text NOT NULL REFERENCES lemmi.content_entities(id),
  CHECK (alias_id <> canonical_id)
);
-- Existing media_assets.entity_ids remains the canonical tag field for now.
-- Do not introduce a second tag store. Import validates tags against this catalog.
-- Backfill/validate existing preference/item-policy IDs before adding catalog FKs.

CREATE TABLE lemmi.albums (
  id uuid PRIMARY KEY,
  profile_id text NOT NULL REFERENCES lemmi.profiles ON DELETE CASCADE,
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 100),
  collection_kind text NOT NULL CHECK (collection_kind IN ('album', 'place_scenes')),
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, id)
);
CREATE TABLE lemmi.album_photos (
  profile_id text NOT NULL,
  album_id uuid NOT NULL,
  asset_id uuid NOT NULL,
  asset_kind text NOT NULL DEFAULT 'image' CHECK (asset_kind = 'image'),
  position integer NOT NULL CHECK (position >= 0),
  PRIMARY KEY (profile_id, album_id, asset_id),
  UNIQUE (profile_id, album_id, position),
  FOREIGN KEY (profile_id, album_id) REFERENCES lemmi.albums(profile_id, id) ON DELETE CASCADE,
  FOREIGN KEY (profile_id, asset_id, asset_kind) REFERENCES lemmi.media_assets(profile_id, id, kind) ON DELETE CASCADE
);

CREATE TABLE lemmi.music_tracks (
  profile_id text NOT NULL,
  asset_id uuid NOT NULL,
  asset_kind text NOT NULL DEFAULT 'music' CHECK (asset_kind = 'music'),
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  artist text CHECK (length(artist) <= 200),
  duration_ms integer NOT NULL CHECK (duration_ms BETWEEN 1 AND 300000),
  PRIMARY KEY (profile_id, asset_id),
  FOREIGN KEY (profile_id, asset_id, asset_kind) REFERENCES lemmi.media_assets(profile_id, id, kind) ON DELETE CASCADE
);
CREATE TABLE lemmi.playlists (
  id uuid PRIMARY KEY,
  profile_id text NOT NULL REFERENCES lemmi.profiles ON DELETE CASCADE,
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 100),
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, id)
);
CREATE TABLE lemmi.playlist_tracks (
  profile_id text NOT NULL,
  playlist_id uuid NOT NULL,
  asset_id uuid NOT NULL,
  position integer NOT NULL CHECK (position >= 0),
  PRIMARY KEY (profile_id, playlist_id, asset_id),
  UNIQUE (profile_id, playlist_id, position),
  FOREIGN KEY (profile_id, playlist_id) REFERENCES lemmi.playlists(profile_id, id) ON DELETE CASCADE,
  FOREIGN KEY (profile_id, asset_id) REFERENCES lemmi.music_tracks(profile_id, asset_id) ON DELETE CASCADE
);

-- Minimal agreement evidence, never a transcript, signature image or free-text story.
-- Revocation remains an update to this record; it does not preserve removed content.
CREATE TABLE lemmi.privacy_agreements (
  id uuid PRIMARY KEY,
  profile_id text NOT NULL REFERENCES lemmi.profiles ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('statement_excerpts', 'remember_preferences')),
  recorded_by_subject text NOT NULL CHECK (length(recorded_by_subject) BETWEEN 1 AND 200),
  explanation_version text NOT NULL CHECK (length(explanation_version) BETWEEN 1 AND 100),
  privacy_revision integer NOT NULL CHECK (privacy_revision >= 0),
  agreed_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE (profile_id, purpose, id),
  CHECK (revoked_at IS NULL OR revoked_at >= agreed_at)
);
-- Explicit per-session grant; a profile default never authorizes excerpt storage alone.
CREATE TABLE lemmi.session_excerpt_permissions (
  profile_id text NOT NULL,
  session_id text NOT NULL,
  agreement_id uuid NOT NULL,
  purpose text NOT NULL DEFAULT 'statement_excerpts' CHECK (purpose = 'statement_excerpts'),
  enabled boolean NOT NULL DEFAULT false,
  privacy_revision integer NOT NULL CHECK (privacy_revision >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, session_id),
  FOREIGN KEY (profile_id, session_id) REFERENCES lemmi.sessions(profile_id, id) ON DELETE CASCADE,
  FOREIGN KEY (profile_id, purpose, agreement_id) REFERENCES lemmi.privacy_agreements(profile_id, purpose, id)
);

-- A single typed source registry gives summaries real FKs, not loose polymorphic IDs.
-- Measured events remain in activity_events. Text is only observations or permitted
-- selected participant excerpts. Approved facts/preferences are NOT summary sources.
CREATE TABLE lemmi.journal_sources (
  id uuid PRIMARY KEY,
  profile_id text NOT NULL,
  session_id text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('measured_event', 'caregiver_observation', 'participant_excerpt')),
  activity_event_id uuid,
  text_value text,
  author_subject text,
  recognition_uncertain boolean,
  saved_privacy_revision integer,
  saved_generation integer,
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz,
  UNIQUE (profile_id, session_id, id),
  UNIQUE (profile_id, session_id, activity_event_id),
  FOREIGN KEY (profile_id, session_id) REFERENCES lemmi.sessions(profile_id, id) ON DELETE CASCADE,
  FOREIGN KEY (profile_id, session_id, activity_event_id) REFERENCES lemmi.activity_events(profile_id, session_id, id) ON DELETE CASCADE,
  CHECK (
    (source_type = 'measured_event' AND activity_event_id IS NOT NULL AND text_value IS NULL
      AND author_subject IS NULL AND recognition_uncertain IS NULL
      AND saved_privacy_revision IS NULL AND saved_generation IS NULL)
    OR (source_type = 'caregiver_observation' AND activity_event_id IS NULL
      AND text_value IS NOT NULL AND length(text_value) BETWEEN 1 AND 1000
      AND author_subject IS NOT NULL AND length(author_subject) BETWEEN 1 AND 200
      AND recognition_uncertain IS NULL AND saved_privacy_revision IS NULL AND saved_generation IS NULL)
    OR (source_type = 'participant_excerpt' AND activity_event_id IS NULL
      AND text_value IS NOT NULL AND length(text_value) BETWEEN 1 AND 1000
      AND author_subject IS NULL AND recognition_uncertain IS NOT NULL
      AND saved_privacy_revision IS NOT NULL AND saved_privacy_revision >= 0
      AND saved_generation IS NOT NULL AND saved_generation >= 0)
  )
);

CREATE TABLE lemmi.summaries (
  id uuid PRIMARY KEY,
  profile_id text NOT NULL,
  session_id text NOT NULL,
  text_value text NOT NULL CHECK (length(text_value) BETWEEN 1 AND 2000),
  origin text NOT NULL DEFAULT 'ai_summary' CHECK (origin = 'ai_summary'),
  review_status text NOT NULL DEFAULT 'unreviewed' CHECK (review_status IN ('unreviewed', 'reviewed')),
  model_id text NOT NULL CHECK (length(model_id) BETWEEN 1 AND 200),
  policy_version text NOT NULL CHECK (length(policy_version) BETWEEN 1 AND 100),
  profile_revision integer NOT NULL CHECK (profile_revision >= 0),
  privacy_revision integer NOT NULL CHECK (privacy_revision >= 0),
  policy_revision integer NOT NULL CHECK (policy_revision >= 0),
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  edited_by_subject text,
  edited_at timestamptz,
  reviewed_by_subject text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, session_id, id),
  FOREIGN KEY (profile_id, session_id) REFERENCES lemmi.sessions(profile_id, id) ON DELETE CASCADE,
  CHECK ((edited_by_subject IS NULL) = (edited_at IS NULL)),
  CHECK ((review_status = 'unreviewed' AND reviewed_by_subject IS NULL AND reviewed_at IS NULL)
    OR (review_status = 'reviewed' AND reviewed_by_subject IS NOT NULL AND reviewed_at IS NOT NULL))
);
CREATE TABLE lemmi.summary_sources (
  profile_id text NOT NULL,
  session_id text NOT NULL,
  summary_id uuid NOT NULL,
  source_id uuid NOT NULL,
  source_revision integer NOT NULL CHECK (source_revision >= 0),
  PRIMARY KEY (profile_id, session_id, summary_id, source_id),
  FOREIGN KEY (profile_id, session_id, summary_id) REFERENCES lemmi.summaries(profile_id, session_id, id) ON DELETE CASCADE,
  FOREIGN KEY (profile_id, session_id, source_id) REFERENCES lemmi.journal_sources(profile_id, session_id, id) ON DELETE CASCADE
);
-- The service must delete dependent summaries BEFORE editing/removing sources,
-- including activity_events. CASCADE on a link alone does not erase summary text.
-- Commit summary + nonempty links in one transaction after rechecking sources.

-- Notification proposal: transport receipts are separate from human acknowledgment.
-- These tables store no conversation text or copies of contact destinations.
CREATE TABLE lemmi.routing_policies (
  profile_id text PRIMARY KEY REFERENCES lemmi.profiles ON DELETE CASCADE,
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  primary_contact_id uuid NOT NULL,
  backup_contact_id uuid,
  safe_alternate_contact_id uuid,
  automatic_concern_alerts_enabled boolean NOT NULL DEFAULT false,
  send_timeout_seconds integer NOT NULL DEFAULT 15 CHECK (send_timeout_seconds > 0),
  backup_after_seconds integer NOT NULL DEFAULT 60 CHECK (backup_after_seconds > 0),
  no_response_after_seconds integer NOT NULL DEFAULT 120 CHECK (no_response_after_seconds > 0),
  max_retries integer NOT NULL DEFAULT 1 CHECK (max_retries BETWEEN 0 AND 1),
  FOREIGN KEY (profile_id, primary_contact_id) REFERENCES lemmi.contacts(profile_id, id),
  FOREIGN KEY (profile_id, backup_contact_id) REFERENCES lemmi.contacts(profile_id, id),
  FOREIGN KEY (profile_id, safe_alternate_contact_id) REFERENCES lemmi.contacts(profile_id, id),
  CHECK (backup_contact_id IS NULL OR backup_contact_id <> primary_contact_id),
  CHECK (no_response_after_seconds >= backup_after_seconds)
);
CREATE TABLE lemmi.help_requests (
  id uuid PRIMARY KEY,
  profile_id text NOT NULL REFERENCES lemmi.profiles ON DELETE CASCADE,
  session_id text,
  mode text NOT NULL CHECK (mode IN ('simulation', 'real')),
  trigger_kind text NOT NULL CHECK (trigger_kind IN ('manual', 'urgent_concern')),
  routing_revision integer NOT NULL CHECK (routing_revision >= 0),
  state text NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'acknowledged', 'no_response', 'expired', 'canceled', 'resolved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  backup_due_at timestamptz NOT NULL,
  no_response_due_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  acknowledged_by_subject text,
  acknowledged_at timestamptz,
  attempts_canceled_at timestamptz,
  resolved_by_subject text,
  resolved_at timestamptz,
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  UNIQUE (profile_id, id),
  FOREIGN KEY (profile_id, session_id) REFERENCES lemmi.sessions(profile_id, id),
  CHECK (backup_due_at >= created_at AND no_response_due_at >= backup_due_at AND expires_at >= no_response_due_at),
  CHECK ((acknowledged_by_subject IS NULL) = (acknowledged_at IS NULL)),
  CHECK ((resolved_by_subject IS NULL) = (resolved_at IS NULL))
);
CREATE UNIQUE INDEX one_open_manual_request_per_mode ON lemmi.help_requests(profile_id, mode)
  WHERE trigger_kind = 'manual' AND state = 'open';
-- Snapshot recipient IDs/order/revisions at creation. Destination is resolved from
-- contacts at send time; a changed/revoked contact must not receive an old send.
CREATE TABLE lemmi.help_request_recipients (
  profile_id text NOT NULL,
  request_id uuid NOT NULL,
  contact_id uuid NOT NULL,
  contact_revision integer NOT NULL CHECK (contact_revision >= 0),
  routing_role text NOT NULL CHECK (routing_role IN ('primary', 'backup', 'safe_alternate')),
  PRIMARY KEY (profile_id, request_id, contact_id),
  FOREIGN KEY (profile_id, request_id) REFERENCES lemmi.help_requests(profile_id, id) ON DELETE CASCADE,
  FOREIGN KEY (profile_id, contact_id) REFERENCES lemmi.contacts(profile_id, id)
);
CREATE TABLE lemmi.notification_attempts (
  id uuid PRIMARY KEY,
  profile_id text NOT NULL,
  request_id uuid NOT NULL,
  contact_id uuid NOT NULL,
  attempt_number integer NOT NULL CHECK (attempt_number BETWEEN 1 AND 2),
  idempotency_key uuid NOT NULL UNIQUE,
  provider_message_id text CHECK (length(provider_message_id) BETWEEN 1 AND 200),
  transport_status text NOT NULL CHECK (transport_status IN ('queued', 'sending', 'accepted', 'delivery_unknown', 'delivered', 'failed')),
  error_code text CHECK (error_code ~ '^[A-Z0-9_]{1,80}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  delivered_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, request_id, contact_id, attempt_number),
  FOREIGN KEY (profile_id, request_id, contact_id) REFERENCES lemmi.help_request_recipients(profile_id, request_id, contact_id) ON DELETE CASCADE
);

CREATE TABLE lemmi.jobs (
  id uuid PRIMARY KEY,
  profile_id text NOT NULL REFERENCES lemmi.profiles ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('notification_send', 'notification_backup', 'notification_expire', 'summary_build')),
  request_id uuid,
  session_id text,
  expected_privacy_revision integer NOT NULL CHECK (expected_privacy_revision >= 0),
  expected_profile_revision integer NOT NULL CHECK (expected_profile_revision >= 0),
  expected_policy_revision integer NOT NULL CHECK (expected_policy_revision >= 0),
  dedupe_key uuid NOT NULL UNIQUE,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'leased', 'done', 'failed', 'canceled')),
  run_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  lease_token uuid,
  lease_until timestamptz,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts integer NOT NULL CHECK (max_attempts BETWEEN 1 AND 5),
  error_code text CHECK (error_code ~ '^[A-Z0-9_]{1,80}$'),
  FOREIGN KEY (profile_id, request_id) REFERENCES lemmi.help_requests(profile_id, id) ON DELETE CASCADE,
  FOREIGN KEY (profile_id, session_id) REFERENCES lemmi.sessions(profile_id, id) ON DELETE CASCADE,
  CHECK ((kind = 'summary_build' AND session_id IS NOT NULL AND request_id IS NULL)
    OR (kind <> 'summary_build' AND request_id IS NOT NULL AND session_id IS NULL)),
  CHECK (expires_at > run_at),
  CHECK (attempts <= max_attempts),
  CHECK ((state = 'leased' AND lease_token IS NOT NULL AND lease_until IS NOT NULL)
    OR (state <> 'leased' AND lease_token IS NULL AND lease_until IS NULL))
);
CREATE INDEX jobs_due ON lemmi.jobs(run_at) WHERE state = 'pending';
CREATE INDEX jobs_leases ON lemmi.jobs(lease_until) WHERE state = 'leased';
CREATE INDEX journal_sources_by_session ON lemmi.journal_sources(profile_id, session_id, created_at);
CREATE INDEX summary_sources_by_source ON lemmi.summary_sources(profile_id, session_id, source_id);
CREATE INDEX summaries_by_session ON lemmi.summaries(profile_id, session_id, created_at);

-- Intentionally survives profile-row deletion to track outstanding filesystem work.
-- No FK: no deleted profile text, contact details or old resource payloads retained.
CREATE TABLE lemmi.deletion_jobs (
  id uuid PRIMARY KEY,
  profile_id text NOT NULL CHECK (profile_id = 'profile-alex'),
  deletion_epoch uuid NOT NULL,
  phase text NOT NULL CHECK (phase IN ('invalidate', 'private_media', 'database', 'controlled_caches', 'complete')),
  state text NOT NULL CHECK (state IN ('pending', 'running', 'failed', 'complete')),
  error_code text CHECK (error_code ~ '^[A-Z0-9_]{1,80}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CHECK ((state = 'complete') = (completed_at IS NOT NULL)),
  CHECK ((state = 'complete') = (phase = 'complete'))
);
-- Existing media_cleanup stores opaque file keys across deletion, not old captions.

CREATE TABLE lemmi.camera_access_events (
  id uuid PRIMARY KEY,
  profile_id text NOT NULL REFERENCES lemmi.profiles ON DELETE CASCADE,
  actor_subject text NOT NULL CHECK (length(actor_subject) BETWEEN 1 AND 200),
  device_id text NOT NULL CHECK (device_id = 'stackchan-alex'),
  requested_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  ended_at timestamptz,
  end_reason text CHECK (end_reason IN ('declined', 'expired', 'local_stop', 'caregiver_end', 'disconnected', 'revoked', 'help', 'error')),
  delete_after timestamptz NOT NULL,
  CHECK (delete_after > requested_at AND delete_after <= requested_at + interval '7 days'),
  CHECK (started_at IS NULL OR started_at >= requested_at),
  CHECK (ended_at IS NULL OR ended_at >= coalesce(started_at, requested_at)),
  CHECK ((ended_at IS NULL) = (end_reason IS NULL))
);
CREATE INDEX camera_access_expiry ON lemmi.camera_access_events(delete_after);
-- No video, image bytes, thumbnails or scene descriptions. A cleanup worker must
-- enforce delete_after; a CHECK constraint does not schedule deletion.

REVOKE ALL ON ALL TABLES IN SCHEMA lemmi FROM PUBLIC;
COMMIT;
