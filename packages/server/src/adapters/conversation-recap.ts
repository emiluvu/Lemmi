import type { ChatMessage } from './types';
import { routeParticipantText } from './input-routing';
import { mentionsTopic } from './conversation-redirects';

// A reminder of what was actually said, never a guessed memory or biography.
// Quotes remain transient and never feed journal/persistent summary sources.
export function conversationRecap(history: readonly ChatMessage[], awayFrom: readonly string[]) {
  const previous = [...history]
    .reverse()
    .find((entry) => entry.role === 'user' && routeParticipantText(entry.content) === 'ordinary');
  if (!previous || mentionsTopic(previous.content, awayFrom))
    return 'We can take our time. We can pause here or talk about something new.';
  const compact = previous.content.replace(/\s+/g, ' ').trim();
  const excerpt = compact.length > 140 ? `${compact.slice(0, 140)}…` : compact;
  return `Just now, you said: “${excerpt}” We can take our time.`;
}
