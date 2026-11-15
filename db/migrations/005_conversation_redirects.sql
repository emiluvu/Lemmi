-- Explicit caregiver configuration, never extracted participant statements.
ALTER TABLE lemmi.profiles ADD COLUMN conversation_redirects jsonb NOT NULL
  DEFAULT '{"awayFrom":[],"toward":[]}'::jsonb
  CHECK (jsonb_typeof(conversation_redirects) = 'object'
    AND jsonb_typeof(conversation_redirects->'awayFrom') = 'array'
    AND jsonb_typeof(conversation_redirects->'toward') = 'array'
    AND jsonb_array_length(conversation_redirects->'awayFrom') <= 12
    AND jsonb_array_length(conversation_redirects->'toward') <= 12);
