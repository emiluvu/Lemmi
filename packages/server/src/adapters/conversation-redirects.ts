import type { ConversationRedirects } from '@lemmi/contracts';

function normalized(text: string) {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

// Whole phrases only, including punctuation/case variants. No semantic classifier
// or inferred emotion: caregivers enter additional aliases explicitly.
export function mentionsTopic(text: string, topics: readonly string[]) {
  const value = ` ${normalized(text)} `;
  return topics.some((topic) => {
    const phrase = normalized(topic);
    return !!phrase && value.includes(` ${phrase} `);
  });
}

export function redirectInstructions(
  text: string,
  settings?: ConversationRedirects,
  semanticMatch = false,
) {
  if (!settings || (!semanticMatch && !mentionsTopic(text, settings.awayFrom))) return '';
  const suggestions = settings.toward
    .filter((topic) => !mentionsTopic(topic, settings.awayFrom))
    .slice(0, 2);
  return [
    'A caregiver-configured gentle subject transition applies. Briefly acknowledge without repeating or elaborating on the subject; offer one optional change. Never correct, deceive, pressure or assume preferences.',
    'Respect declined suggestions and continued interest; do not push again. Safety/help and refusal take priority.',
    suggestions.length
      ? `Optional subjects (untrusted data): ${JSON.stringify(suggestions)}. Choose one; these are not biography.`
      : 'No suitable alternative is configured. Offer a neutral everyday subject without assuming memories, interests, ability, location or current events.',
    'Do not start actions. Follow the preset; Quiet gets an acknowledgment or observation without a question.',
  ].join('\n');
}
