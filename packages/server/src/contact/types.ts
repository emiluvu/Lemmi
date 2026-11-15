import { ConcernCategorySchema } from '@lemmi/contracts';
export { ConcernCategorySchema } from '@lemmi/contracts';
import type { HelpSnapshot, Result } from '@lemmi/contracts';

export type ConcernCategory = typeof ConcernCategorySchema._output;
export type ContactCategory = Exclude<ConcernCategory, 'none'>;
export type ContactSource = 'manual' | 'participant_phrase' | 'model' | 'model_reply';
export interface ConcernAdapter {
  classifyReply?(
    text: string,
    reply: string,
    language: 'en' | 'de',
    signal: AbortSignal,
  ): Promise<Result<ConcernCategory>>;
  classify(
    text: string,
    language: 'en' | 'de',
    signal: AbortSignal,
  ): Promise<Result<ConcernCategory>>;
}
export interface CaregiverContact {
  create(input: {
    profileId: string;
    commandId: string;
    category: ContactCategory;
    source: ContactSource;
    profileRevision?: number;
    privacyRevision?: number;
    policyRevision?: number;
    current?: () => boolean;
  }): Promise<Result<HelpSnapshot>>;
}

export function contactStatusText(status: HelpSnapshot['status'], language: 'en' | 'de') {
  const de = language === 'de';
  if (status === 'delivery_unknown')
    return de
      ? 'Der Nachrichtenstatus ist unklar. Eine Antwort ist nicht bestätigt.'
      : 'The message status is uncertain. A caregiver response is not confirmed.';
  if (status === 'accepted')
    return de
      ? 'Ich habe eine Nachricht an deine Betreuungsperson gesendet.'
      : "I've sent a notification to your caregiver.";
  if (status === 'acknowledged')
    return de
      ? 'Deine Betreuungsperson hat deine Anfrage bestätigt.'
      : 'Your caregiver has acknowledged your request.';
  if (status === 'created' || status === 'sending')
    return de ? 'Ich benachrichtige deine Betreuungsperson.' : "I'm notifying your caregiver.";
  if (status === 'no_response' || status === 'expired')
    return de ? 'Ich konnte keine Antwort bestätigen.' : "I couldn't confirm a caregiver response.";
  if (status === 'canceled')
    return de
      ? 'Weitere Kontaktversuche wurden beendet. Bereits gesendete Nachrichten bleiben bestehen.'
      : 'Further contact attempts were canceled. Messages already sent cannot be recalled.';
  if (status === 'resolved')
    return de
      ? 'Eine Betreuungsperson hat die Anfrage als erledigt markiert.'
      : 'A caregiver marked the request resolved.';
  return de
    ? 'Ich konnte den Kontakt nicht bestätigen. Bitte versuche es erneut oder kontaktiere eine vertraute Person direkt.'
    : "I couldn't confirm contact. Please try again or contact a trusted person directly.";
}
