import { ok } from '@lemmi/contracts';
import { teachingTopics } from '@lemmi/activities';
import type { ChatAdapter } from './types';

// Explicit local mock only. No provider call, voice synthesis or durable memory.
export const teachingScriptAdapter: ChatAdapter = {
  async complete(input, signal) {
    signal.throwIfAborted();
    const topic = teachingTopics.find((t) => input.system.includes(`"entityId":"${t.entityId}"`));
    const quiet = input.system.includes('no follow-up question');
    let text = 'Thank you for sharing. We can take our time.';
    if (!quiet && topic && input.text.trim().split(/\s+/).length > 2) {
      text =
        topic.entityId === 'topic:gardening' && /\broses?\b/i.test(input.text)
          ? topic.roseFollowUp
          : topic.followUp;
    }
    return ok({ text, language: input.language });
  },
};
