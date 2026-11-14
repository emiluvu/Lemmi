export type InputRoute =
  | 'stop'
  | 'pause'
  | 'help'
  | 'topic_refusal'
  | 'incomplete_need'
  | 'unwell'
  | 'urgent'
  | 'ordinary';

// Small reviewed phrase fixtures, not reliable emergency detection or universal language coverage.
export function routeParticipantText(text: string): InputRoute {
  const value = text
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[.!?…]+$/u, '')
    .replace(/\s+/g, ' ');
  if (
    /^(stop|please stop|stop please|stop talking|i (?:do not|don't) want to (?:talk|play)|stopp|bitte stopp|hör auf|bitte hör auf|hoer auf|ich möchte aufhören|ich will nicht spielen)$/.test(
      value,
    )
  )
    return 'stop';
  if (/^(pause|please pause|take a break|eine pause|pause bitte)$/.test(value)) return 'pause';
  if (
    /^(help|i need help|get help|please get help|hilfe|ich brauche hilfe|bitte hilfe)$/.test(value)
  )
    return 'help';
  if (
    /^(don't ask about that|do not ask about that|i don't want to talk about that|darüber möchte ich nicht sprechen)$/.test(
      value,
    )
  )
    return 'topic_refusal';
  if (/^(i need|ich brauche)$/.test(value)) return 'incomplete_need';
  if (/^(i (?:do not|don't) feel well|i feel unwell|mir geht es nicht gut)$/.test(value))
    return 'unwell';
  if (
    /^(i (?:cannot|can't) breathe|i took too many pills|ich bekomme keine luft|ich habe zu viele tabletten genommen)$/.test(
      value,
    )
  )
    return 'urgent';
  return 'ordinary';
}

export function fixedInputReply(route: InputRoute, language: 'en' | 'de'): string | null {
  const de = language === 'de';
  if (route === 'topic_refusal')
    return de
      ? 'Wir lassen dieses Thema. Sie können später etwas anderes wählen.'
      : 'We can leave that topic. You can choose something else when you are ready.';
  if (route === 'incomplete_need')
    return de ? 'Wobei möchten Sie Hilfe?' : 'What would you like help with?';
  if (route === 'unwell')
    return de
      ? 'Möchten Sie eine Betreuungsperson kontaktieren?'
      : 'Would you like to contact your caregiver?';
  if (route === 'urgent')
    return de
      ? 'Die Kontaktfunktion ist noch nicht eingerichtet. Ich kann keinen Notruf absetzen. Rufen Sie bei unmittelbarer Gefahr den örtlichen Notruf an oder bitten Sie jemanden in der Nähe darum.'
      : 'Caregiver contact is not configured. I cannot call emergency services. If you are in immediate danger, call local emergency services or ask someone nearby to call.';
  return null;
}
