export type ConversationTranscriptEntry = {
  speaker: 'participant' | 'lemmi';
  text: string;
};

const MAX_VISIBLE_TURNS = 8;

// Display-only, current-browser-session state. Callers clear it on interruption.
export function appendConversationTurn(
  entries: ConversationTranscriptEntry[],
  entry: ConversationTranscriptEntry,
): ConversationTranscriptEntry[] {
  const text = entry.text.trim();
  if (!text) return entries;
  return [...entries, { ...entry, text }].slice(-MAX_VISIBLE_TURNS);
}
