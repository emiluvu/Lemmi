import { ok } from '@lemmi/contracts';
import type { ChatAdapter } from './types';

/** Explicit offline demonstration selection, never a fallback after a failed LLM request. */
export function createReviewedPhotoAdapter(): ChatAdapter {
  return {
    async complete(input, signal) {
      signal.throwIfAborted();
      const text = input.system.includes(
        'Keep the response brief. Do not ask an unsolicited follow-up question.',
      )
        ? 'We can take our time and just look.'
        : input.text === 'Begin the approved Photo Story conversation.'
          ? 'What do you enjoy about this scene?'
          : /^roses[.!]?$/i.test(input.text.trim())
            ? 'What do you enjoy about roses?'
            : 'Would you like to tell me more?';
      return ok({ text, language: input.language });
    },
  };
}
