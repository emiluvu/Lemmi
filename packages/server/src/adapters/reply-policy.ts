import { resolveCommunicationSupport, type CommunicationSupport } from '@lemmi/contracts';

// Bounded third-party contact claims. Talking with the participant about a topic
// and reviewed denial forms remain permitted; this is not universal semantic detection.
const germanThirdParty =
  '(?:ihm|ihr|ihn|sie|(?:deinem|deiner|deinen|deine|ihrem|ihrer|ihren|ihre|dem|der|den|die) (?:mann|ehemann|frau|ehefrau|partner|partnerin|mutter|vater|schwester|bruder|sohn|tochter|familie|betreuungsperson|pflegeperson|arzt|ärztin))';
const germanContactTime = '(?:(?:gerade|eben|soeben|bereits|schon|vorhin|jetzt|gleich) ){0,2}';
const germanContactClaims = [
  new RegExp(
    `\\bich (?:habe|hab'?) ${germanContactTime}mit ${germanThirdParty} ${germanContactTime}(?:gesprochen|geredet|telefoniert|kontakt aufgenommen)\\b`,
    'iu',
  ),
  new RegExp(
    `\\bich (?:habe|hab'?) ${germanContactTime}${germanThirdParty} ${germanContactTime}(?:angerufen|kontaktiert|benachrichtigt|alarmiert|erreicht)\\b`,
    'iu',
  ),
  new RegExp(
    `\\bich (?:sprach|redete|telefonierte|spreche|rede|telefoniere) ${germanContactTime}mit ${germanThirdParty}\\b(?! (?:nicht|nie)\\b)`,
    'iu',
  ),
  new RegExp(
    `\\bich (?:werde ${germanContactTime}(?:mit ${germanThirdParty} (?:sprechen|reden|telefonieren)|${germanThirdParty} (?:anrufen|kontaktieren|benachrichtigen))|(?:rufe|kontaktiere|benachrichtige|alarmiere) ${germanContactTime}${germanThirdParty})\\b(?! (?:nicht|nie)\\b)`,
    'iu',
  ),
];

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
    !/\bi(?:(?: have|'ve)(?: just)?| just)? (?:called|contacted|notified|alerted|messaged|checked your room|(?:talked|spoken|spoke) (?:to|with))\b/iu.test(
      normal,
    ) &&
    !/\bi(?: will|'ll) (?:call|contact|notify|alert|message) (?:your|the) (?:caregiver|family|doctor|emergency services)\b/iu.test(
      normal,
    ) &&
    !/\bich habe (?:gerade |bereits |schon )?(?:(?:ihre|deine|die|den|einen|eine) (?:betreuungsperson|pflegeperson|familie|arzt|ärztin|rettungsdienst|notruf) (?:angerufen|kontaktiert|benachrichtigt|alarmiert)|(?:ihr|dein|das) zimmer (?:überprüft|kontrolliert))\b/iu.test(
      normal,
    ) &&
    !/\bich (?:werde|rufe|kontaktiere|benachrichtige|alarmiere) (?:jetzt |gleich )?(?:ihre|deine|die|den|einen|eine) (?:betreuungsperson|pflegeperson|familie|arzt|ärztin|rettungsdienst|notruf)\b/iu.test(
      normal,
    ) &&
    !/\b(?:hilfe|(?:ihre|deine|die) (?:betreuungsperson|pflegeperson|familie)) ist (?:schon |bereits )?(?:unterwegs|auf dem weg)\b/iu.test(
      normal,
    ) &&
    !germanContactClaims.some((claim) => claim.test(normal.replace(/\s+/gu, ' ')))
  );
}
