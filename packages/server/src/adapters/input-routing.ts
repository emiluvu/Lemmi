export type InputRoute =
  | 'stop'
  | 'pause'
  | 'help'
  | 'topic_refusal'
  | 'incomplete_need'
  | 'unwell'
  | 'urgent'
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

// Small reviewed phrase fixtures, not reliable emergency detection or universal language coverage.
export function routeParticipantText(text: string): InputRoute {
  const value = text
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[.!?…]+$/u, '')
    .replace(/\s+/g, ' ');
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
    /^(help(?: me)?|i need help|get help|please (?:get )?help(?: me)?|hilfe|ich brauche hilfe|bitte hilfe)$/.test(
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
export function requestedActivity(text: string): 'photo' | 'teaching' | 'unavailable' | null {
  const value = normalizeVoiceCommand(text);
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
  const invitation =
    /^(?:please )?(?:(?:start|play|open|do|try|begin|switch to)|(?:let's|let us|i want to|i would like to|i'd like to|(?:can|could|may) (?:we|i|you)) (?:play|start|do|open|try|switch to)) (?:the )?/;
  const name = value.replace(invitation, '').replace(/,? please$/, '');
  if (
    /^(?:photo stor(?:y|ies)|photo album(?: talk)?|explore pictures|look at pictures)$/.test(name)
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
  return /^(?:back to (?:the )?conversation|(?:finish|end) (?:teach(?:ing)? (?:lemmi|lemmy|lemme|lemi)(?: game)?|teaching|photo story|explor(?:e|ing) pictures)|let's just talk|let us just talk)$/.test(
    normalizeVoiceCommand(text),
  );
}
