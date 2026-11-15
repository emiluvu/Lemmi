import type { ChatMessage } from './types';
import { routeParticipantText } from './input-routing';
import { mentionsTopic } from './conversation-redirects';

// A reminder of what was actually said, never a guessed memory or biography.
// Quotes remain transient and never feed journal/persistent summary sources.
export function conversationRecap(
  history: readonly ChatMessage[],
  awayFrom: readonly string[],
  excludedMessage: string | null = null,
  language: 'en' | 'de' = 'en',
) {
  const previous = [...history]
    .reverse()
    .find((entry) => entry.role === 'user' && routeParticipantText(entry.content) === 'ordinary');
  if (
    !previous ||
    previous.content === excludedMessage ||
    mentionsTopic(previous.content, awayFrom)
  )
    return language === 'de'
      ? 'Wir können uns Zeit lassen. Wir können eine Pause machen oder über etwas Neues sprechen.'
      : 'We can take our time. We can pause here or talk about something new.';
  const compact = previous.content.replace(/\s+/g, ' ').trim();
  const excerpt = compact.length > 140 ? `${compact.slice(0, 140)}…` : compact;
  return language === 'de'
    ? `Gerade haben Sie gesagt: „${excerpt}“ Wir können uns Zeit lassen.`
    : `Just now, you said: “${excerpt}” We can take our time.`;
}
