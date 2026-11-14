import { JournalSchema, type Journal } from '@lemmi/contracts';
// Factual projection only, never an AI summary or a reconstruction of unsaved dialogue.
export function photoEventRecap(journal: Journal, sessionId: string) {
  const parsed = JournalSchema.parse(journal);
  const events = parsed.sessions.find((s) => s.sessionId === sessionId)?.events ?? [];
  return {
    source: 'measured_event' as const,
    spokenContentIncluded: false,
    viewedPhotoIds: events
      .filter((e) => e.type === 'photo_selected')
      .map((e) => ('itemId' in e ? e.itemId : null)),
    skippedPhotoIds: events
      .filter((e) => e.type === 'photo_skipped')
      .map((e) => ('itemId' in e ? e.itemId : null)),
    text: 'Factual photo activity only. Spoken responses were not saved or summarized.',
  };
}
