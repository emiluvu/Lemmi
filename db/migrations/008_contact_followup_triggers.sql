-- Additional minimal categories, never participant/model utterances or paraphrases.
-- Keep accepted migrations immutable; extend the contact slice additively.
ALTER TABLE lemmi.help_requests DROP CONSTRAINT help_requests_category_check;
ALTER TABLE lemmi.help_requests ADD CONSTRAINT help_requests_category_check
  CHECK (category IN (
    'help_request','urgent','concern','safeguarding',
    'departure','contact_request','human_support'
  ));
ALTER TABLE lemmi.help_requests DROP CONSTRAINT help_requests_source_check;
ALTER TABLE lemmi.help_requests ADD CONSTRAINT help_requests_source_check
  CHECK (source IN ('manual','participant_phrase','model','model_reply'));
