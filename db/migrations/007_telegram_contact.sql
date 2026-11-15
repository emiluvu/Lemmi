-- Fixed, minimal contact events only; never utterances, prompts, destinations or model text.
CREATE TABLE lemmi.telegram_routes (
  profile_id text PRIMARY KEY REFERENCES lemmi.profiles ON DELETE CASCADE,
  subject text NOT NULL,
  revision text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  auto_alerts boolean NOT NULL DEFAULT false,
  primary_contact_id uuid REFERENCES lemmi.contacts ON DELETE SET NULL,
  backup_contact_id uuid REFERENCES lemmi.contacts ON DELETE SET NULL,
  safe_contact_id uuid REFERENCES lemmi.contacts ON DELETE SET NULL
);
CREATE TABLE lemmi.help_requests (
  id uuid PRIMARY KEY,
  profile_id text NOT NULL REFERENCES lemmi.profiles ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('help_request','urgent','concern','safeguarding')),
  source text NOT NULL CHECK (source IN ('manual','participant_phrase','model')),
  route_revision text NOT NULL,
  profile_revision integer NOT NULL,
  privacy_revision integer NOT NULL,
  policy_revision integer NOT NULL,
  status text NOT NULL CHECK (status IN ('created','sending','accepted','delivery_unknown','acknowledged','failed','no_response','canceled','expired','resolved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  acknowledged_at timestamptz,
  acknowledged_by text,
  resolved_at timestamptz,
  CHECK ((acknowledged_at IS NULL) = (acknowledged_by IS NULL)),
  CHECK (status NOT IN ('acknowledged','resolved') OR acknowledged_at IS NOT NULL),
  CHECK ((status = 'resolved') = (resolved_at IS NOT NULL)),
  UNIQUE (profile_id,id)
);
CREATE TABLE lemmi.help_receipts (
  profile_id text NOT NULL,
  command_id text NOT NULL,
  fingerprint text NOT NULL,
  request_id uuid NOT NULL,
  PRIMARY KEY (profile_id,command_id),
  FOREIGN KEY (profile_id,request_id) REFERENCES lemmi.help_requests(profile_id,id) ON DELETE CASCADE
);
CREATE TABLE lemmi.help_attempts (
  id uuid PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES lemmi.help_requests ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES lemmi.contacts ON DELETE CASCADE,
  contact_revision integer NOT NULL,
  slot text NOT NULL CHECK (slot IN ('primary','backup','safe')),
  state text NOT NULL CHECK (state IN ('pending','sending','accepted','failed','unknown','canceled')),
  due_at timestamptz NOT NULL,
  tries integer NOT NULL DEFAULT 0 CHECK (tries BETWEEN 0 AND 2),
  lease_id uuid,
  lease_expires_at timestamptz,
  provider_message_id bigint,
  UNIQUE (request_id,slot),
  CHECK ((lease_id IS NULL) = (lease_expires_at IS NULL))
);
CREATE INDEX help_attempts_due ON lemmi.help_attempts(due_at) WHERE state='pending';
REVOKE ALL ON ALL TABLES IN SCHEMA lemmi FROM PUBLIC;
