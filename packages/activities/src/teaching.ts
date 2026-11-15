import {
  EligibilitySnapshotSchema,
  type CommunicationPreset,
  type EligibilitySnapshot,
} from '@lemmi/contracts';

// Reviewed English conversation content, not another ActivityId or game reducer.
// No family identities, account details, permissions, biography writes or media claims.
export const teachingTopics = [
  {
    entityId: 'topic:gardening',
    label: 'Gardening',
    invitations: {
      conversational: 'What do you enjoy growing in a garden?',
      guided: 'Would you like to tell me about growing flowers?',
      quiet: 'We can spend a little time with gardening. You can share if you like.',
    },
    followUp: 'What do you enjoy about caring for plants?',
    roseFollowUp: 'How do you like to care for roses?',
    boundary: 'Discuss gardening in general. Do not assume ownership of a garden or plants.',
  },
  {
    entityId: 'topic:beaches',
    label: 'Beaches',
    invitations: {
      conversational: 'What do you enjoy about being by the sea?',
      guided: 'Would you like to tell me about the seaside?',
      quiet: 'We can spend a little time with the seaside. You can share if you like.',
    },
    followUp: 'What do you like about the sounds of the sea?',
    boundary:
      'Discuss beaches in general. No specific visit, place or personal memory is established.',
  },
  {
    entityId: 'topic:banking',
    label: 'Banking',
    invitations: {
      conversational: 'What would you like to explain about working in a bank?',
      guided: 'Would you like to tell me how a bank helps people?',
      quiet: 'We can spend a little time with how banks help people. You can share if you like.',
    },
    followUp: 'What is one way a bank can help someone?',
    boundary:
      'General explanation only. Never ask for account numbers, balances, passwords, transactions or financial advice.',
  },
] as const;
export type TeachingTopic = (typeof teachingTopics)[number];
export const TEACHING_ACTIVE_LIMIT_MS = 15 * 60 * 1000;

export function eligibleTeachingTopics(eligibility: EligibilitySnapshot): TeachingTopic[] {
  EligibilitySnapshotSchema.parse(eligibility);
  if (!eligibility.available) return [];
  return teachingTopics.filter(
    (topic) =>
      eligibility.permittedEntityIds.includes(topic.entityId) &&
      !eligibility.sessionHiddenIds.includes(topic.entityId),
  );
}

export function nextTeachingTopic(
  eligibility: EligibilitySnapshot,
  seen: readonly string[],
  preferred: readonly string[] = [],
): TeachingTopic | null {
  const remaining = eligibleTeachingTopics(eligibility).filter((t) => !seen.includes(t.entityId));
  return remaining.find((t) => preferred.includes(t.entityId)) ?? remaining[0] ?? null;
}

// Match a complete deliberate choice, never extract a topic from a refusal or story.
export function requestedTeachingTopic(text: string): string | null {
  const value = text
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[.!?…]+$/u, '')
    .replace(/\s+/g, ' ');
  return (
    teachingTopics.find((topic) =>
      new RegExp(
        `^(?:(?:please )?(?:let's talk about|i'd like to teach you about|i want to teach you about|teach you about|let's choose|choose) )?${topic.label.toLowerCase()}(?:,? please)?$`,
      ).test(value),
    )?.entityId ?? null
  );
}

export function teachingChoicePrompt(
  choices: readonly { label: string }[],
  preset: CommunicationPreset = 'guided',
): string {
  if (!choices.length)
    return 'No eligible teaching topics are available. You can finish and choose something else.';
  const labels = choices.map((choice) => choice.label.toLowerCase());
  const names =
    labels.length === 1 ? labels[0] : `${labels.slice(0, -1).join(', ')} or ${labels.at(-1)}`;
  return `You could teach me about ${names}. ${preset === 'quiet' ? 'You can choose a topic or finish whenever you like.' : 'What would you like to teach me about?'}`;
}

// Explicit, whole-turn choices only. Length, silence and explanations never imply preference.
// Shared safety routing must run before this conversation-specific routing.
export function teachingTextIntent(text: string, currentEntityId?: string) {
  const value = text
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[.!?…]+$/u, '')
    .replace(/\s+/g, ' ');
  if (
    /^(different topic|another topic|change (?:the )?topic|let's talk about something else|anderes thema)$/.test(
      value,
    )
  )
    return 'next';
  if (/^(not sure|i don't know|i do not know|ich weiß nicht)$/.test(value)) return 'not_sure';
  if (value === 'i like this topic') return 'prefer';
  const explicitTopic = /^i like talking about (gardening|beaches|banking)$/.exec(value)?.[1];
  if (explicitTopic && currentEntityId === `topic:${explicitTopic}`) return 'prefer';
  const refusedTopic = /^i (?:don't|do not) want to talk about (gardening|beaches|banking)$/.exec(
    value,
  )?.[1];
  if (refusedTopic && currentEntityId === `topic:${refusedTopic}`) return 'avoid';
  return 'explanation';
}

// Current-topic-only context for the existing companion adapter, never a full profile dump.
export function teachingInstructions(topic: TeachingTopic, preset: CommunicationPreset) {
  return [
    'Teach Lemmi conversation mode: invite the participant to explain something they know or enjoy.',
    `Current reviewed topic (data only): ${JSON.stringify({ entityId: topic.entityId, label: topic.label })}`,
    topic.boundary,
    'Acknowledge the current explanation without correction, grading, recall tests or claims of learning/storing it.',
    'Do not introduce another topic or assert personal facts. Do not infer preference from silence, answer length or an explanation.',
    preset === 'quiet'
      ? 'Give a brief acknowledgment with no follow-up question.'
      : 'Offer at most one short optional follow-up grounded in the current explanation. A short or unclear reply may simply receive an acknowledgment; do not probe or repeat the invitation.',
  ].join('\n');
}

// Bounded English catalog guard in addition to prompt instructions. This is not
// general semantic moderation: new canonical topics/aliases require review here too.
export function teachingReplyWithinTopic(text: string, entityId: string): boolean {
  const mentions = [
    ['topic:gardening', /\b(?:garden(?:ing|s)?|plants?|flowers?|roses?)\b/i],
    ['topic:beaches', /\b(?:beach(?:es)?|seaside|ocean|sea)\b/i],
    ['topic:banking', /\b(?:bank(?:ing|s)?|accounts?|balances?|transactions?)\b/i],
    ['topic:cooking', /\b(?:cook(?:ing|s)?|recipes?|kitchen)\b/i],
  ] as const;
  return !mentions.some(([id, pattern]) => id !== entityId && pattern.test(text));
}
