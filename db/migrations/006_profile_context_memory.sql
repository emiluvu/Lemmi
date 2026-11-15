ALTER TABLE lemmi.profiles ADD COLUMN conversation_context jsonb NOT NULL DEFAULT '{}'::jsonb
  CHECK (jsonb_typeof(conversation_context)='object');
ALTER TABLE lemmi.profiles ADD COLUMN summary_memory_enabled boolean NOT NULL DEFAULT false;
CREATE TABLE lemmi.conversation_memories (
  profile_id text NOT NULL REFERENCES lemmi.profiles(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  profile_revision integer NOT NULL,
  privacy_revision integer NOT NULL,
  summary text NOT NULL CHECK (length(summary) BETWEEN 1 AND 300),
  source text NOT NULL DEFAULT 'ai_summary' CHECK (source='ai_summary'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id,session_id),
  FOREIGN KEY (profile_id,session_id) REFERENCES lemmi.sessions(profile_id,id) ON DELETE CASCADE
);
REVOKE ALL ON lemmi.conversation_memories FROM PUBLIC;
