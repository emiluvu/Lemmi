-- Retry receipts contain IDs only; credentials and dialogue never enter this table.
CREATE TABLE lemmi.device_revocations (
  device_id text NOT NULL REFERENCES lemmi.devices(id) ON DELETE CASCADE,
  actor text NOT NULL CHECK(length(actor) BETWEEN 1 AND 200),
  command_id text NOT NULL CHECK(length(command_id) BETWEEN 1 AND 100),
  credential_id uuid,
  PRIMARY KEY(device_id,actor,command_id)
);
REVOKE ALL ON lemmi.device_revocations FROM PUBLIC;
