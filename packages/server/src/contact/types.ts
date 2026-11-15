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
      ? 'Der Nachrichtenstatus ist unklar. Eine Antwort deiner Vertrauensperson ist nicht bestätigt.'
      : 'The message status is uncertain. A response from your trusted contact is not confirmed.';
  if (status === 'accepted')
    return de
      ? 'Ich habe eine Nachricht an deine Vertrauensperson gesendet.'
      : "I've sent a notification to your trusted contact.";
  if (status === 'acknowledged')
    return de
      ? 'Deine Vertrauensperson hat deine Anfrage bestätigt.'
      : 'Your trusted contact has acknowledged your request.';
  if (status === 'created' || status === 'sending')
    return de
      ? 'Ich benachrichtige deine Vertrauensperson.'
      : "I'm notifying your trusted contact.";
  if (status === 'no_response' || status === 'expired')
    return de
      ? 'Ich konnte keine Antwort von deiner Vertrauensperson bestätigen.'
      : "I couldn't confirm a response from your trusted contact.";
  if (status === 'canceled')
    return de
      ? 'Weitere Kontaktversuche wurden beendet. Bereits gesendete Nachrichten bleiben bestehen.'
      : 'Further contact attempts were canceled. Messages already sent cannot be recalled.';
  if (status === 'resolved')
    return de
      ? 'Eine Vertrauensperson hat die Anfrage als erledigt markiert.'
      : 'A trusted contact marked the request resolved.';
  return de
    ? 'Ich konnte den Kontakt nicht bestätigen. Bitte versuche es erneut oder kontaktiere eine andere vertraute Person direkt.'
    : "I couldn't confirm contact. Please try again or contact another trusted person directly.";
}
