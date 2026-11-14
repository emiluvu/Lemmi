-- Preserve durable pre-endpoint revoke receipts while introducing device scope.
ALTER TABLE lemmi.device_revocations RENAME TO legacy_device_revocations;
CREATE TABLE lemmi.device_revocations (
 device_id text NOT NULL REFERENCES lemmi.devices(id) ON DELETE CASCADE,
 actor text NOT NULL CHECK(length(actor) BETWEEN 1 AND 200),
 command_id text NOT NULL CHECK(length(command_id) BETWEEN 1 AND 100),
 credential_id uuid,
 PRIMARY KEY(device_id,actor,command_id)
);
INSERT INTO lemmi.device_revocations(device_id,actor,command_id)
 SELECT 'stackchan-alex',subject,command_id FROM lemmi.legacy_device_revocations
 WHERE profile_id='profile-alex';
REVOKE ALL ON lemmi.device_revocations, lemmi.legacy_device_revocations FROM PUBLIC;
