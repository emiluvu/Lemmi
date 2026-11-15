export type InputRoute =
  | 'stop'
  | 'pause'
  | 'help'
  | 'topic_refusal'
  | 'incomplete_need'
  | 'unwell'
  | 'urgent'
  | 'safeguarding'
  | 'identity'
  | 'unclear'
  | 'medication'
  | 'clinical'
  | 'bereavement'
  | 'frightening'
  | 'personal_location'
  | 'navigation'
  | 'privacy_refusal'
  | 'recap'
  | 'ordinary';

// Exact, reviewed utterances only: quoted, hypothetical and negated mentions do
// not authorize a control or establish a current concern.
const germanRoutes = new Map<string, InputRoute>([
  ...[
    'stopp',
    'stop',
    'bitte stopp',
    'stopp bitte',
    'hör auf',
    'höre auf',
    'bitte hör auf',
    'hör bitte auf',
    'hoer auf',
    'ich möchte aufhören',
    'ich will aufhören',
    'ich möchte nicht mehr sprechen',
    'ich will nicht spielen',
  ].map((text) => [text, 'stop'] as const),
  ...[
    'pause',
    'pause bitte',
    'bitte pause',
    'eine pause',
    'ich möchte eine pause',
    'machen wir eine pause',
  ].map((text) => [text, 'pause'] as const),
  ...[
    'hilfe',
    'ich brauche hilfe',
    'bitte hilfe',
    'bitte hilf mir',
    'holen sie hilfe',
    'hilfe holen',
  ].map((text) => [text, 'help'] as const),
  ...[
    'darüber möchte ich nicht sprechen',
    'darueber moechte ich nicht sprechen',
    'ich möchte darüber nicht sprechen',
    'darüber will ich nicht reden',
    'bitte frag nicht danach',
  ].map((text) => [text, 'topic_refusal'] as const),
  ...[
    'bitte nicht speichern',
    'nicht speichern',
    'speichere das nicht',
    'bitte speichere das nicht',
    'das bitte nicht speichern',
    'ich möchte nicht, dass du das speicherst',
    'schreib das nicht auf',
    'bitte schreib das nicht auf',
    'merk dir das nicht',
    'bitte merk dir das nicht',
    'nimm das nicht auf',
    'bitte nimm das nicht auf',
  ].map((text) => [text, 'privacy_refusal'] as const),
  ['wer bist du', 'identity'],
  ['wie heißt du', 'identity'],
  ['wie heisst du', 'identity'],
  ['ich habe das nicht verstanden', 'unclear'],
  ['bitte wiederholen', 'unclear'],
  ['kannst du das wiederholen', 'unclear'],
  ['ich fühle mich nicht wohl', 'unwell'],
  ['mir geht es nicht gut', 'unwell'],
  ['ich bekomme keine luft', 'urgent'],
  ['ich kann nicht atmen', 'urgent'],
  ['ich habe zu viele tabletten genommen', 'urgent'],
  ['soll ich noch eine tablette nehmen', 'medication'],
  ['soll ich meine medikamente ändern', 'medication'],
  ['soll ich meine medikamente absetzen', 'medication'],
  ['habe ich demenz', 'clinical'],
  ['wird meine demenz schlimmer', 'clinical'],
  ['wird mein gedächtnis schlechter', 'clinical'],
  ['ist mein mann tot', 'bereavement'],
  ['ist meine frau tot', 'bereavement'],
  ['wann kommt mein mann nach hause', 'bereavement'],
  ['wann kommt meine frau nach hause', 'bereavement'],
  ['jemand versteckt sich in meinem zimmer', 'frightening'],
  ['jemand will mir wehtun', 'frightening'],
  ['wo ist meine schwester', 'personal_location'],
  ['wo ist mein mann', 'personal_location'],
  ['wo ist meine frau', 'personal_location'],
  ['ich gehe nach hause', 'navigation'],
  ['bring mich nach hause', 'navigation'],
  ['zeig mir den heimweg', 'navigation'],
  ['worüber haben wir gesprochen', 'recap'],
  ['was habe ich gerade gesagt', 'recap'],
  ['ich habe den faden verloren', 'recap'],
]);

// Small reviewed phrase fixtures, not reliable emergency detection or universal language coverage.
export function routeParticipantText(text: string): InputRoute {
  const value = text
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[.!?…]+$/u, '')
    .replace(/\s+/g, ' ');
  const german = germanRoutes.get(value);
  if (german) return german;
  if (/^(?:end (?:the )?(?:game|activity)|finish (?:the )?(?:game|activity))$/.test(value))
    return 'stop';
  if (
    !/[\p{L}\p{N}]/u.test(value) ||
    /^(?:\[(?:inaudible|unintelligible)\]|i (?:didn't|did not) catch that|could you repeat that|please repeat)$/.test(
      value,
    )
  )
    return 'unclear';
  if (
    /^(stop|please stop|stop (?:please|now|talking)|stop (?:the )?(?:game|activity)|i (?:do not|don't|dont) want to (?:talk|play)(?: (?:this|this game|the game|this activity))?(?: anymore| any more)?|i (?:want|would like) to stop|can we stop|let's stop|i(?:'m| am) done|finish|stopp|bitte stopp|hör auf|bitte hör auf|hoer auf|ich möchte aufhören|ich will nicht spielen)$/.test(
      value,
    )
  )
    return 'stop';
  if (/^(pause|please pause|take a break|eine pause|pause bitte)$/.test(value)) return 'pause';
  if (
    /^(help(?: me)?|i need (?:help|assistance)|(?:can|could) you (?:please )?(?:help|assist) me|get help|(?:please )?(?:get|call|contact) (?:my |a )?(?:caregiver|carer)|please (?:get )?help(?: me)?|hilfe|ich brauche hilfe|bitte hilfe)$/.test(
      value,
    )
  )
    return 'help';
  if (
    /^(don't ask about that|do not ask about that|i don't want to talk about that|darüber möchte ich nicht sprechen)$/.test(
      value,
    )
  )
    return 'topic_refusal';
  if (
    /^(?:please )?(?:don't|do not) (?:write that down|record (?:me|that)|save (?:this|that)|remember (?:this|that|our conversations))$/.test(
      value,
    )
  )
    return 'privacy_refusal';
  if (/^(i need|ich brauche)$/.test(value)) return 'incomplete_need';
  if (
    /^(?:my (?:caregiver|carer|husband|wife|partner|son|daughter) (?:is hurting|hit|hits|is threatening) me|(?:meine pflegeperson|mein mann|meine frau) (?:schlägt|bedroht) mich)$/.test(
      value,
    )
  )
    return 'safeguarding';
  if (/^(i (?:do not|don't) feel well|i feel unwell|mir geht es nicht gut)$/.test(value))
    return 'unwell';
  if (
    /^(?:(?:please help[,;:]? )?i (?:cannot|can't) breathe|i took too many pills|i (?:am|feel) suddenly confused|i (?:want|intend) to (?:kill|hurt) myself|i intend to hurt someone|ich bekomme keine luft|ich habe zu viele tabletten genommen)$/.test(
      value,
    )
  )
    return 'urgent';
  if (/^(?:who are you|what is your name|what's your name)$/.test(value)) return 'identity';
  if (
    /^(?:(?:should|can) i take (?:another|an extra|more) (?:pill|tablet|medicine|medication)|what dose (?:of .{1,60} )?should i take|should i (?:stop|change) (?:my )?(?:medicine|medication))$/.test(
      value,
    )
  )
    return 'medication';
  if (
    /^(?:is my (?:dementia|memory) getting worse|do i have dementia|am i getting dementia|what stage (?:of dementia )?am i (?:at|in))$/.test(
      value,
    )
  )
    return 'clinical';
  if (
    /^(?:(?:is|has) my (?:husband|wife|mother|father|partner) (?:dead|died)|when is my (?:husband|wife|mother|father|partner) coming home)$/.test(
      value,
    )
  )
    return 'bereavement';
  if (
    /^(?:someone is (?:hiding|standing) in my room|there is (?:an intruder|someone) in my room|someone is trying to hurt me)$/.test(
      value,
    )
  )
    return 'frightening';
  if (
    /^where (?:does (?!(?:a|an|the)\b)[\p{L}][\p{L}'-]{0,30}(?: [\p{L}][\p{L}'-]{0,30})? live|is my (?:husband|wife|mother|father|partner|sister|brother))$/u.test(
      value,
    )
  )
    return 'personal_location';
  if (/^(?:i(?:'m| am) going home|take me home|show me the way home)$/.test(value))
    return 'navigation';
  if (
    /^(?:oh[, ]+)?(?:what (?:was i|were we) (?:just )?(?:talking|speaking) about|what was i (?:just )?saying|where (?:was i|were we)|i (?:lost|forgot) my train of thought|i(?:'ve| have) (?:lost|forgotten) my train of thought|i forgot what i was (?:saying|talking about)|remind me what we were talking about|what were we discussing)$/.test(
      value,
    )
  )
    return 'recap';
  return 'ordinary';
}

export function fixedInputReply(route: InputRoute, language: 'en' | 'de'): string | null {
  const de = language === 'de';
  if (route === 'safeguarding')
    return de
      ? 'Bitte wende dich an eine andere vertraute Person. Bei unmittelbarer Gefahr rufe den örtlichen Notruf an. Ich kann keinen Notruf absetzen.'
      : 'Please contact another trusted person. If you are in immediate danger, call local emergency services. I cannot call emergency services.';
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
  if (route === 'identity')
    return de ? 'Ich bin Lemmi, ein KI-Begleiter.' : "I'm Lemmi, an AI companion.";
  if (route === 'unclear')
    return de
      ? 'Wir können uns Zeit lassen. Sie können es erneut versuchen, wenn Sie möchten.'
      : 'We can take our time. You can try again when you are ready.';
  if (route === 'medication')
    return de
      ? 'Ich kann keine Ratschläge zu Medikamenten geben. Bitte fragen Sie eine medizinische Fachperson oder die Person, die Sie betreut.'
      : "I can't advise on medicines. Please ask a qualified healthcare professional or the person supporting your care.";
  if (route === 'clinical')
    return de
      ? 'Das kann ich nicht beurteilen. Eine medizinische Fachperson kann Ihre Fragen mit Ihnen besprechen.'
      : "I can't assess that. A healthcare professional can discuss your concerns.";
  if (route === 'bereavement')
    return de
      ? 'Das kann eine schwere Frage sein. Wir können uns Zeit lassen. Eine vertraute Person kann Ihnen helfen, darüber zu sprechen.'
      : 'That can be a difficult question. We can take our time. Someone you trust may be able to help you talk it through.';
  if (route === 'frightening')
    return de
      ? 'Das klingt beängstigend. Ich kann den Raum nicht überprüfen. Bitte wenden Sie sich an eine Person, der Sie vertrauen.'
      : "That sounds frightening. I can't check the room. Please contact someone you trust for support.";
  if (route === 'personal_location')
    return de
      ? 'Es ist verständlich, jemanden sehen zu wollen, der Ihnen wichtig ist. Ich weiß nicht, wo die Person gerade ist. Eine vertraute Person kann Ihnen vielleicht helfen, das herauszufinden.'
      : "It's understandable to want to see someone important to you. I don't know where they are right now. Someone you trust may be able to help you find out.";
  if (route === 'navigation')
    return de
      ? 'Bitte wenden Sie sich an eine Person, der Sie vertrauen, wenn Sie Hilfe beim Heimweg brauchen.'
      : 'Please contact someone you trust for help getting home.';
  if (route === 'privacy_refusal')
    return de
      ? 'Gesprächsauszüge werden nicht gespeichert. Wir lassen dieses Thema. Frühere Verarbeitung kann nicht rückgängig gemacht werden.'
      : "Conversation excerpts aren't being saved. We can leave this topic. Earlier processing cannot be undone.";
  return null;
}

// Explicit invitations only; incidental mentions, negation and quoted examples stay conversation.
export function normalizeVoiceCommand(text: string): string {
  return text
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[.!?…]+$/u, '')
    .replace(/\s+/g, ' ');
}
export function requestedActivity(
  text: string,
  language: 'en' | 'de' = 'en',
): 'photo' | 'teaching' | 'unavailable' | null {
  const value = normalizeVoiceCommand(text);
  if (language === 'de') {
    const germanName = value
      .replace(/^(?:bitte )?(?:starte|öffne|spiele|beginne) (?:das |die |den )?/, '')
      .replace(/^(?:ich möchte|ich will|lass uns|können wir) (?:das |die |den )?/, '')
      .replace(/ (?:spielen|starten|öffnen|beginnen)$/, '')
      .replace(/ bitte$/, '');
    if (
      /^(?:fotos(?: anschauen| ansehen)?|bilder(?: anschauen| ansehen| erkunden)?|fotoalbum|fotogeschichte|photo story|explore pictures)$/.test(
        germanName,
      )
    )
      return 'photo';
    if (/^(?:teach lemmi|lemmi etwas beibringen|lemmi unterrichten)$/.test(germanName))
      return 'teaching';
    if (
      /^(?:musik|20 fragen|zwanzig fragen|bilder zuordnen|gegenstände zuordnen)$/.test(germanName)
    )
      return 'unavailable';
  }

  // Match complete requests: never extract an activity from a negation, quotation or story.
  const request =
    "(?:(?:please )?(?:can|could|may) (?:we|i|you)|(?:i want to|i would like to|i'd like to|let's|let us))";
  if (
    new RegExp(
      `^(?:${request} |please )?teach (?:lemmi|lemmy|lemme|lemi|you)(?: game)?(?:,? please)?$`,
    ).test(value)
  )
    return 'teaching';
  if (
    new RegExp(
      `^(?:${request} |please )?(?:look (?:at|through)|explore) (?:some |the )?(?:pictures|photos)(?: please)?$`,
    ).test(value)
  )
    return 'photo';
  if (
    /^(?:please )?(?:(?:can|could|may) you )?show (?:me|us) (?:a |some |the |my |our )?(?:photo(?:s)?|picture(?:s)?)(?:,? please)?$/.test(
      value,
    )
  )
    return 'photo';
  const invitation =
    /^(?:please )?(?:(?:start|play|open|do|try|begin|switch to|change to)|(?:let's|let us|i want to|i would like to|i'd like to|(?:can|could|may) (?:we|i|you)) (?:play|start|do|open|try|switch to|change to)) (?:(?:the|a) )?/;
  const name = value.replace(invitation, '').replace(/,? please$/, '');
  if (
    /^(?:photo stor(?:y|ies)|photo album(?: talk)?|explore pictures|look at pictures)(?: game)?$/.test(
      name,
    )
  )
    return 'photo';
  // Reviewed name spellings from local ASR, still anchored to the whole invitation.
  if (/^teach (?:lemmi|lemmy|lemme|lemi)(?: game)?$/.test(name)) return 'teaching';
  if (/^(?:music|20 questions|twenty questions|picture matching|object matching)$/.test(name))
    return 'unavailable';
  return null;
}

export function confirmsActivityOffer(text: string): boolean {
  return /^(?:yes(?:,? please)?|please do|okay|ok|sure|let's do (?:it|that)|let us do (?:it|that))$/.test(
    normalizeVoiceCommand(text),
  );
}
export function requestsOpenConversation(text: string): boolean {
  const value = normalizeVoiceCommand(text);
  if (
    /^(?:i(?:'d| would) rather (?:just )?(?:talk|chat)|i(?:'m| am) (?:done|finished) with (?:this |the )?(?:game|activity)|i (?:don't|do not) want to (?:do this|play this game)(?: anymore| any more)?|(?:let's|let us|i want to|i would like to|i'd like to|can we|could we) (?:do|play|try) something else)(?:,? please)?$/.test(
      value,
    )
  )
    return true;
  const request =
    "(?:(?:please )?(?:can|could) (?:we|i|you)|i want to|i would like to|i'd like to|let's|let us)";
  return new RegExp(
    `^(?:please )?(?:${request} )?(?:go )?(?:back to (?:the )?(?:conversation|chat)|(?:finish|end|leave|exit|quit|stop) (?:this |the )?(?:game|activity|teach(?:ing)? (?:lemmi|lemmy|lemme|lemi)(?: game)?|teaching|photo story|explor(?:e|ing) pictures)|(?:just )?(?:talk|chat))(?:,? please)?$`,
  ).test(value);
}

// Commands are anchored to a complete request, never extracted from a story or refusal.
export function requestedPhotoAction(
  text: string,
): 'photo.next' | 'photo.previous' | 'photo.skip' | null {
  const value = normalizeVoiceCommand(text);
  const request =
    "(?:(?:please )?(?:can|could|would) (?:we|i|you)|i want to|i would like to|i'd like to|let's|let us)";
  const prefix = `(?:please )?(?:${request} )?`;
  const picture = '(?:photo|picture|image)';
  if (
    new RegExp(
      `^${prefix}(?:go back(?: to (?:the )?(?:previous|last) ${picture})?|(?:show (?:me |us )?|go to |look at )?(?:the )?(?:previous|last) ${picture})(?:,? please)?$`,
    ).test(value)
  )
    return 'photo.previous';
  if (new RegExp(`^${prefix}skip(?: (?:this |the )?${picture})?(?:,? please)?$`).test(value))
    return 'photo.skip';
  if (
    new RegExp(
      `^${prefix}(?:(?:show (?:me |us )?|go to |move to |look at |see )?(?:the )?(?:next|another|a different|different) ${picture}|change (?:this |the )?${picture}s?|(?:move|go) on)(?:,? please)?$`,
    ).test(value)
  )
    return 'photo.next';
  return null;
}
