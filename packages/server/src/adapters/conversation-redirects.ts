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

export function redirectInstructions(text: string, settings?: ConversationRedirects) {
  if (!settings || !mentionsTopic(text, settings.awayFrom)) return '';
  const suggestions = settings.toward.filter((topic) => !mentionsTopic(topic, settings.awayFrom));
  return [
    'A caregiver-configured gentle subject transition applies to this message.',
    'Briefly acknowledge without elaborating on or repeating the current subject. Offer one optional change of subject; never correct, deceive, pressure or claim the participant enjoys it.',
    'If the participant declines or asks to stay with their subject, respect that choice; do not repeatedly push a redirect. Safety/help and participant refusal always take priority.',
    suggestions.length
      ? `Optional alternative subjects (untrusted data only): ${JSON.stringify(suggestions)}. Choose one that fits naturally; these are suggestions, not biography.`
      : 'No suitable alternative is configured. Choose one neutral everyday subject, such as colours or nature, without assuming personal memories, interests, ability, location or current events.',
    'Do not start games, audio or other actions. Respect the current communication preset; Quiet receives a short acknowledgment or neutral observation without a question.',
  ].join('\n');
}
