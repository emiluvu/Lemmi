import { resolveCommunicationSupport, type CommunicationSupport } from '@lemmi/contracts';

// Mechanical checks supplement the prompt and reviewed fixed routes. They do
// not prove semantic safety, language fluency, or factual grounding universally.
export function permittedModelReply(text: string, support: CommunicationSupport): boolean {
  const policy = resolveCommunicationSupport(support);
  const normal = text.normalize('NFKC').replace(/[’‘]/gu, "'");
  return (
    !!text.trim() &&
    text.length <= policy.maxReplyCharacters &&
    (normal.match(/[?\u061f]/gu)?.length ?? 0) <= policy.maxQuestions &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(text) &&
    !/\p{Cf}/u.test(text) &&
    !/```|<[^>]+>|https?:\/\//iu.test(text) &&
    !/\bi(?: have|'ve| just)? (?:called|contacted|notified|alerted|messaged|checked your room)\b/iu.test(
      normal,
    ) &&
    !/\bi(?: will|'ll) (?:call|contact|notify|alert|message) (?:your|the) (?:caregiver|family|doctor|emergency services)\b/iu.test(
      normal,
    )
  );
}
