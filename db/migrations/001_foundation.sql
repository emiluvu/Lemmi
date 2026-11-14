-- UUIDs identify new private resources; profile-alex and stackchan-alex are stable shared IDs.
CREATE SCHEMA IF NOT EXISTS lemmi;
CREATE TABLE lemmi.profiles (
  id text PRIMARY KEY CHECK (id = 'profile-alex'),
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  privacy_revision integer NOT NULL DEFAULT 0 CHECK (privacy_revision >= 0),
  policy_revision integer NOT NULL DEFAULT 0 CHECK (policy_revision >= 0),
  preferred_name text NOT NULL CHECK (length(preferred_name) BETWEEN 1 AND 80),
  avatar_id text NOT NULL CHECK (avatar_id IN ('dog','cat','bunny','bird','lemming')),
  communication_preset text NOT NULL CHECK (communication_preset IN ('conversational','guided','quiet')),
  interests jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(interests)='array' AND jsonb_array_length(interests)<=20),
  sensitive_guidance text NOT NULL DEFAULT '' CHECK (length(sensitive_guidance)<=1000),
  -- Permission-enabling flows/storage are A23/A24, intentionally unavailable here.
  remembering_enabled boolean NOT NULL DEFAULT false CHECK (NOT remembering_enabled),
  excerpt_saving_enabled boolean NOT NULL DEFAULT false CHECK (NOT excerpt_saving_enabled),
  deletion_state text NOT NULL DEFAULT 'active' CHECK (deletion_state IN ('active','deleting')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE lemmi.profile_access (
  profile_id text NOT NULL REFERENCES lemmi.profiles ON DELETE CASCADE,
  subject text NOT NULL CHECK (length(subject) BETWEEN 1 AND 200),
  role text NOT NULL CHECK (role = 'caregiver'),
  PRIMARY KEY (profile_id, subject)
);
CREATE TABLE lemmi.profile_facts (
  id uuid PRIMARY KEY, profile_id text NOT NULL REFERENCES lemmi.profiles ON DELETE CASCADE,
  field text NOT NULL CHECK (field IN ('familiar_person','interest_context','personal_context')),
  value text NOT NULL CHECK (length(value) BETWEEN 1 AND 300),
  source text NOT NULL CHECK (source='caregiver_provided'),
  author text NOT NULL, revision integer NOT NULL CHECK (revision>=0), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, id)
);
CREATE TABLE lemmi.devices (
  id text PRIMARY KEY CHECK (id='stackchan-alex'), profile_id text NOT NULL REFERENCES lemmi.profiles ON DELETE CASCADE,
  credential_id uuid, credential_hash text CHECK (credential_hash ~ '^[0-9a-f]{64}$'),
  credential_expires_at timestamptz, boot_id uuid, revoked_at timestamptz,
  CHECK ((credential_id IS NULL) = (credential_hash IS NULL))
);
CREATE TABLE lemmi.sessions (
  id text PRIMARY KEY, profile_id text NOT NULL REFERENCES lemmi.profiles ON DELETE CASCADE,
  generation integer NOT NULL CHECK (generation>=0), phase text NOT NULL CHECK (phase IN ('ready','listening','processing','speaking','waiting','paused','ended','unavailable')),
  profile_revision integer NOT NULL, privacy_revision integer NOT NULL, policy_revision integer NOT NULL,
  endpoint text NOT NULL CHECK (endpoint IN ('browser','robot')), lease_id text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(), ended_at timestamptz,
  UNIQUE (profile_id, id)
);
CREATE UNIQUE INDEX one_active_session ON lemmi.sessions(profile_id) WHERE phase <> 'ended';
CREATE TABLE lemmi.contacts (
  id uuid PRIMARY KEY, profile_id text NOT NULL REFERENCES lemmi.profiles ON DELETE CASCADE,
  display_name text NOT NULL, destination text NOT NULL, channel text NOT NULL,
  opted_in boolean NOT NULL DEFAULT false, verified_at timestamptz, tested_at timestamptz,
  revision integer NOT NULL DEFAULT 0
);
CREATE TABLE lemmi.activity_events (
  id uuid PRIMARY KEY, profile_id text NOT NULL, session_id text NOT NULL,
  event jsonb NOT NULL CHECK (jsonb_typeof(event)='object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (profile_id, session_id) REFERENCES lemmi.sessions(profile_id,id) ON DELETE CASCADE
);
CREATE TABLE lemmi.profile_preferences (
  profile_id text NOT NULL REFERENCES lemmi.profiles ON DELETE CASCADE, entity_id text NOT NULL,
  value text NOT NULL CHECK (value IN ('prefer','avoid')), source text NOT NULL CHECK (source IN ('participant_choice','caregiver_choice','tentative_pattern')),
  revision integer NOT NULL CHECK (revision>=0), PRIMARY KEY (profile_id,entity_id)
);
CREATE TABLE lemmi.profile_item_policies (
  profile_id text NOT NULL REFERENCES lemmi.profiles ON DELETE CASCADE, entity_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('eligible','retired')), uncertainty_seen boolean NOT NULL DEFAULT false,
  prior_session_id text, revision integer NOT NULL CHECK (revision>=0), PRIMARY KEY (profile_id,entity_id)
);
CREATE TABLE lemmi.media_assets (
  id uuid PRIMARY KEY, profile_id text NOT NULL REFERENCES lemmi.profiles ON DELETE CASCADE,
  storage_key uuid NOT NULL UNIQUE, kind text NOT NULL CHECK (kind IN ('image','music')),
  media_type text NOT NULL CHECK (media_type IN ('image/png','image/jpeg','audio/mpeg','audio/wav')),
  byte_length integer NOT NULL CHECK (byte_length BETWEEN 1 AND 20971520),
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  width integer, height integer, caption text NOT NULL CHECK (length(caption)<=300),
  discussion_context text CHECK (length(discussion_context)<=1000),
  entity_ids jsonb NOT NULL CHECK (jsonb_typeof(entity_ids)='array' AND jsonb_array_length(entity_ids) BETWEEN 1 AND 20),
  source text NOT NULL CHECK (length(source) BETWEEN 1 AND 200), permission text NOT NULL CHECK (length(permission) BETWEEN 1 AND 200),
  approved_by text NOT NULL, approved boolean NOT NULL DEFAULT true,
  profile_revision integer NOT NULL, privacy_revision integer NOT NULL, policy_revision integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- No generic durable command bodies/results: they would retain superseded profile text.
CREATE TABLE lemmi.mutation_receipts (
  profile_id text NOT NULL REFERENCES lemmi.profiles ON DELETE CASCADE, subject text NOT NULL,
  operation text NOT NULL CHECK (operation IN ('profile.update','asset.create')), command_id text NOT NULL,
  fingerprint text NOT NULL CHECK (fingerprint ~ '^[0-9a-f]{64}$'), resource_id text,
  result_revision integer NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, subject, operation, command_id)
);
CREATE TABLE lemmi.media_cleanup (
  storage_key uuid PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON SCHEMA lemmi FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA lemmi FROM PUBLIC;
