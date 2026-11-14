-- 002 is reserved for the independently reviewed media-collection branch.
-- These tables depend only on 001; the runner owns the transaction/checksum.
-- No utterances, clinical labels, profile text or provider payloads belong here.
CREATE TABLE lemmi.profile_support_selections (
  profile_id text NOT NULL REFERENCES lemmi.profiles ON DELETE CASCADE,
  profile_revision integer NOT NULL CHECK (profile_revision >= 0),
  preset text NOT NULL CHECK (preset IN ('conversational','guided','quiet')),
  config_version integer NOT NULL CHECK (config_version = 1),
  actor_subject text NOT NULL CHECK (length(actor_subject) BETWEEN 1 AND 200),
  selected_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, profile_revision)
);
-- Only explicit caregiver saves create selection history. Do not invent who
-- selected an older/default profile setting by backfilling historical rows.
CREATE TABLE lemmi.session_support_selections (
  id uuid PRIMARY KEY,
  profile_id text NOT NULL,
  session_id text NOT NULL,
  generation integer NOT NULL CHECK (generation >= 0),
  profile_revision integer NOT NULL CHECK (profile_revision >= 0),
  preset text NOT NULL CHECK (preset IN ('conversational','guided','quiet')),
  config_version integer NOT NULL CHECK (config_version = 1),
  source text NOT NULL CHECK (source IN ('profile_default','caregiver_apply')),
  actor_subject text CHECK (length(actor_subject) BETWEEN 1 AND 200),
  selected_at timestamptz NOT NULL,
  UNIQUE (profile_id,session_id,generation),
  FOREIGN KEY (profile_id,session_id) REFERENCES lemmi.sessions(profile_id,id) ON DELETE CASCADE,
  CHECK ((source = 'caregiver_apply') = (actor_subject IS NOT NULL))
);
REVOKE ALL ON lemmi.profile_support_selections, lemmi.session_support_selections FROM PUBLIC;
