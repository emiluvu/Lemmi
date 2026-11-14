-- Preserve existing Alex data while enabling separately authorized profiles/endpoints.
ALTER TABLE lemmi.profiles DROP CONSTRAINT profiles_id_check;
ALTER TABLE lemmi.profiles ADD CONSTRAINT profiles_id_check CHECK (id='profile-alex' OR id ~ '^profile-[0-9a-f-]{36}$');
ALTER TABLE lemmi.profiles ADD COLUMN is_demo boolean NOT NULL DEFAULT false;
UPDATE lemmi.profiles SET is_demo=true WHERE id='profile-alex';
ALTER TABLE lemmi.devices DROP CONSTRAINT devices_id_check;
ALTER TABLE lemmi.devices ADD CONSTRAINT devices_id_check CHECK (length(id) BETWEEN 1 AND 100 AND id !~ '^preview-');
ALTER TABLE lemmi.devices ADD COLUMN endpoint text NOT NULL DEFAULT 'robot' CHECK (endpoint IN ('browser','robot'));
CREATE UNIQUE INDEX device_credential_hash ON lemmi.devices(credential_hash) WHERE credential_hash IS NOT NULL;
CREATE TABLE lemmi.gateway_state (singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), boot_id uuid NOT NULL);
REVOKE ALL ON lemmi.gateway_state FROM PUBLIC;
