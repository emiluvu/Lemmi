function normalized(text: string) {
  return text
    .normalize('NFKC')
    .replace(/[‘’]/g, "'")
    .trim()
    .replace(/[.!?…]+$/u, '')
    .replace(/\s+/g, ' ');
}

// This is only a candidate gate. Jev must validate the recommendation and safe routing.
export function humanSupportRecommended(text: string, language: 'en' | 'de'): boolean {
  if (!text.trim() || text.length > 1000) return false;
  let value = normalized(text);
  if (/^["“«'].*["”»']$/u.test(value)) return false;
  if (language === 'en') {
    value = value.replace(
      /\b(?:you (?:should|could|can|might|may) not|you (?:don't|do not) (?:need|have) to|there(?:'s| is) no need to|do not|don't)\b[^.!?;]*/giu,
      '',
    );
    const person =
      '(?:someone(?: you trust)?|somebody|a person you trust|a trusted person|a trusted adult|your (?:family|caregiver|carer|friend|sister|brother|mother|father|mum|mom|dad|son|daughter|husband|wife|partner)|a (?:friend|caregiver|carer|doctor|healthcare professional)|family members?)';
    const action =
      '(?:(?:talk(?:ing)?|speak(?:ing)?|chat(?:ting)?) (?:to|with)|(?:check(?:ing)? in|reach(?:ing)? out|connect(?:ing)?) (?:to|with)|contact(?:ing)?|call(?:ing)?|ask(?:ing)?)';
    return (
      new RegExp(
        `\\b(?:you (?:could|can|should|might|may)(?: (?:want|like|wish) to)?|would you like to|do you want to|i (?:recommend|suggest)(?: that you)?|perhaps|maybe|please|consider|try|it (?:might|could|may) help to|why not|let's)\\s+(?:[^.!?]{0,35}\\s)?${action}\\b[^.!?]{0,65}\\b${person}\\b`,
        'iu',
      ).test(value) ||
      new RegExp(
        `\\b${person}\\s+(?:can|could|may|might)(?: be able to)?\\s+(?:help|support)\\b`,
        'iu',
      ).test(value) ||
      new RegExp(
        `\\b(?:talking|speaking|connecting|checking in)\\s+(?:to|with)\\s+${person}\\b[^.!?]{0,35}\\b(?:could|may|might|can) help\\b`,
        'iu',
      ).test(value)
    );
  }
  value = value.replace(
    /\b(?:du (?:solltest|musst|brauchst) nicht|sie (?:sollten|müssen|brauchen) nicht|es ist nicht nötig)\b[^.!?;]*/giu,
    '',
  );
  const person =
    '(?:jemand(?:em|en)?|vertraute[nr]? (?:person|menschen?)|familie|betreuungsperson|pflegeperson|freund(?:in)?|schwester|bruder|mutter|vater|sohn|tochter|partner(?:in)?|arzt|ärztin)';
  const action = '(?:sprechen|reden|kontaktieren|anrufen|wenden|fragen|besprechen)';
  return (
    new RegExp(
      `\\b(?:du (?:könntest|kannst|solltest|möchtest)|sie (?:könnten|können|sollten|möchten)|vielleicht|es (?:könnte|kann) helfen|möchtest du|möchten sie)\\b[^.!?]{0,100}\\b${person}\\b[^.!?]{0,65}\\b${action}\\b`,
      'iu',
    ).test(value) ||
    new RegExp(
      `\\b(?:sprich|sprechen sie|rede|reden sie|wende dich|wenden sie sich|ruf|rufe|rufen sie|kontaktiere|kontaktieren sie)\\b[^.!?]{0,75}\\b${person}\\b`,
      'iu',
    ).test(value) ||
    new RegExp(
      `\\b${person}\\s+(?:kann|könnte|können|könnten)\\b[^.!?]{0,30}\\b(?:helfen|unterstützen)\\b`,
      'iu',
    ).test(value)
  );
}

// Reviewed full commands only. The target is never returned or used as a destination.
export function requestedHumanContact(text: string, language: 'en' | 'de'): boolean {
  if (!text.trim() || text.length > 200 || /["“”«»@/:=<>\d]/u.test(text)) return false;
  const value = normalized(text);
  let target: string | undefined;
  if (language === 'en') {
    target = value.match(
      /^(?:please |(?:can|could|would) you (?:please )?|i (?:want|need|would like) (?:you )?to )?(?:call|phone|contact|message|notify|reach out to|speak to|speak with|talk to|talk with) (.+?)(?:,? (?:please|now|for me|right now))?$/iu,
    )?.[1];
    if (!target) return false;
    if (
      /^(?:someone(?: (?:i|you) trust)?|somebody|a trusted person|a trusted adult|(?:my|our|the|a) (?:family|caregiver|carer|friend|sister|brother|mother|father|mum|mom|dad|son|daughter|husband|wife|partner|doctor|aunt|uncle|grandmother|grandfather|grandson|granddaughter))$/iu.test(
        target,
      )
    )
      return true;
  } else {
    target =
      value.match(/^(?:bitte )?(?:ruf(?:e)?|rufen sie)(?: bitte)? (.+?) an(?: bitte)?$/iu)?.[1] ??
      value.match(
        /^(?:(?:kannst|könntest|würdest) du|(?:können|könnten|würden) sie|ich (?:möchte|will))(?: bitte)? (.+?) (?:anrufen|kontaktieren|benachrichtigen)(?: bitte)?$/iu,
      )?.[1] ??
      value.match(
        /^(?:bitte )?(?:kontaktiere|kontaktieren sie|benachrichtige|benachrichtigen sie)(?: bitte)? (.+?)(?: bitte)?$/iu,
      )?.[1];
    if (!target) return false;
    if (
      /^(?:jemanden|eine vertraute person|(?:(?:meine[nmrs]?|unsere[nmrs]?|die|den|eine[nmr]?) )?(?:familie|schwester|bruder|freund(?:in)?|mutter|vater|mama|papa|sohn|tochter|betreuungsperson|pflegeperson|arzt|ärztin))$/iu.test(
        target,
      )
    )
      return true;
  }
  if (/^(?:function|api|url|server|endpoint|database|tool|funktion|datenbank)$/iu.test(target))
    return false;
  return /^[\p{Lu}][\p{L}\p{M}'-]{0,30}(?: [\p{Lu}][\p{L}\p{M}'-]{0,30}){0,2}$/u.test(target);
}
