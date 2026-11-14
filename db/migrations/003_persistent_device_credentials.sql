-- Opt-in persistent device keys. Existing credentials remain short-lived.
ALTER TABLE lemmi.devices
  ADD COLUMN credential_persistent boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT persistent_device_has_key CHECK (
    NOT credential_persistent OR
    (credential_id IS NOT NULL AND credential_hash IS NOT NULL
     AND credential_expires_at IS NULL AND revoked_at IS NULL)
  );

-- Durable, bounded revocation receipts prevent a retry after restart from
-- revoking a replacement key. No plaintext credential or pairing code is stored.
CREATE TABLE lemmi.device_revocations (
  profile_id text NOT NULL REFERENCES lemmi.profiles ON DELETE CASCADE,
  subject text NOT NULL,
  command_id text NOT NULL,
  PRIMARY KEY (profile_id, subject, command_id)
);
REVOKE ALL ON lemmi.device_revocations FROM PUBLIC;
