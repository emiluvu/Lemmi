-- Reviewed subset of Emilia's 4e8993f app-data proposal. The migration runner
-- owns the transaction/checksum; do not add BEGIN/COMMIT here.
-- Storage only: no new endpoint, inference, content approval or playback authority.
ALTER TABLE lemmi.media_assets
  ADD CONSTRAINT media_assets_profile_kind_key UNIQUE (profile_id, id, kind);

CREATE TABLE lemmi.albums (
  id uuid PRIMARY KEY,
  profile_id text NOT NULL REFERENCES lemmi.profiles ON DELETE CASCADE,
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 100 AND btrim(title) <> ''),
  collection_kind text NOT NULL CHECK (collection_kind IN ('album', 'place_scenes')),
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, id)
);
CREATE TABLE lemmi.album_photos (
  -- A stable entry ID, distinct from the underlying asset, survives reordering.
  id uuid PRIMARY KEY,
  profile_id text NOT NULL,
  album_id uuid NOT NULL,
  asset_id uuid NOT NULL,
  asset_kind text NOT NULL DEFAULT 'image' CHECK (asset_kind = 'image'),
  position integer NOT NULL CHECK (position BETWEEN 0 AND 19),
  UNIQUE (profile_id, album_id, asset_id),
  CONSTRAINT album_photo_position UNIQUE (profile_id, album_id, position)
    DEFERRABLE INITIALLY IMMEDIATE,
  FOREIGN KEY (profile_id, album_id)
    REFERENCES lemmi.albums(profile_id, id) ON DELETE CASCADE,
  FOREIGN KEY (profile_id, asset_id, asset_kind)
    REFERENCES lemmi.media_assets(profile_id, id, kind) ON DELETE CASCADE
);

CREATE TABLE lemmi.music_tracks (
  profile_id text NOT NULL,
  asset_id uuid NOT NULL,
  asset_kind text NOT NULL DEFAULT 'music' CHECK (asset_kind = 'music'),
  -- Activity track titles are bounded to 100 characters in the shared schema.
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 100 AND btrim(title) <> ''),
  artist text CHECK (length(artist) <= 200),
  duration_ms integer NOT NULL CHECK (duration_ms BETWEEN 1 AND 300000),
  PRIMARY KEY (profile_id, asset_id),
  FOREIGN KEY (profile_id, asset_id, asset_kind)
    REFERENCES lemmi.media_assets(profile_id, id, kind) ON DELETE CASCADE
);
CREATE TABLE lemmi.playlists (
  id uuid PRIMARY KEY,
  profile_id text NOT NULL REFERENCES lemmi.profiles ON DELETE CASCADE,
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 100 AND btrim(title) <> ''),
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, id)
);
CREATE TABLE lemmi.playlist_tracks (
  id uuid PRIMARY KEY,
  profile_id text NOT NULL,
  playlist_id uuid NOT NULL,
  asset_id uuid NOT NULL,
  position integer NOT NULL CHECK (position BETWEEN 0 AND 19),
  UNIQUE (profile_id, playlist_id, asset_id),
  CONSTRAINT playlist_track_position UNIQUE (profile_id, playlist_id, position)
    DEFERRABLE INITIALLY IMMEDIATE,
  FOREIGN KEY (profile_id, playlist_id)
    REFERENCES lemmi.playlists(profile_id, id) ON DELETE CASCADE,
  FOREIGN KEY (profile_id, asset_id)
    REFERENCES lemmi.music_tracks(profile_id, asset_id) ON DELETE CASCADE
);

-- These FKs enforce resource scope/type, not caller authorization or current
-- approval/eligibility. A05 hosting must use the existing authorized asset read
-- and current policy checks. Never derive played events from these metadata rows.
REVOKE ALL ON lemmi.albums, lemmi.album_photos, lemmi.music_tracks,
  lemmi.playlists, lemmi.playlist_tracks FROM PUBLIC;
