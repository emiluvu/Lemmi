import type { Result, ConversationDecisionInput, ConversationDecision } from '@lemmi/contracts';
export {
  ConversationDecisionInputSchema,
  ConversationDecisionSchema,
  DecisionActivitySchema,
} from '@lemmi/contracts';
export type { ConversationDecisionInput, ConversationDecision } from '@lemmi/contracts';
export interface ConversationDecisionAdapter {
  classify(
    input: ConversationDecisionInput,
    signal: AbortSignal,
  ): Promise<Result<ConversationDecision>>;
}

// Also bounds injected/noncooperative adapters. Late completions are consumed and ignored.
export function abortable<T>(work: () => Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const aborted = () => {
      signal.removeEventListener('abort', aborted);
      reject(new Error('Conversation work canceled'));
    };
    if (signal.aborted) {
      aborted();
      return;
    }
    signal.addEventListener('abort', aborted, { once: true });
    Promise.resolve()
      .then(() => {
        signal.throwIfAborted();
        return work();
      })
      .then(resolve, reject)
      .finally(() => signal.removeEventListener('abort', aborted));
  });
}
