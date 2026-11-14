# Lemmi — Caregiver-adjustable conversation support

**Status:** Design requirements; backend implementation on `anay/chat-support-hardening`, UI/device acceptance pending; not clinically validated

**Version:** 0.1  
**Research reviewed:** November 11, 2026  
**Owners:** Anay (policy/schema/enforcement), Kylie (caregiver UI/preview), Lukas (activity presentation), Emilia (device/speech behavior)

**Starter note:** Shared code now exists; see [team-start.md](team-start.md) for exports and current limitations. Reuse the starter. Requirements in this document remain unverified unless explicitly recorded as observed; typed snapshots do not establish working product/hardware behavior.

## 1. Recommendation and evidence boundary

Implement the requested sliding control as **Conversation support**, with three named positions, rather than a numerical “dementia severity” score. This selects how Lemmi communicates, not a diagnosis, disease stage, capacity assessment, or automatic judgment of ability. The supported initial audience remains unchanged; selecting a quieter preset does not establish suitability for unsupervised use or later-stage dementia.

### What the sources support

| Source | Relevant guidance | Product implication (our inference) |
| --- | --- | --- |
| [Alzheimer's Association: communication](https://www.alz.org/help-support/caregiving/daily-care/communications) | Communication needs vary; allow time, ask one question at a time, provide clear steps/visual cues, and respect nonverbal communication. | Offer simpler phrasing and alternatives to speech; do not treat nonresponse as failure or proof of reduced understanding. |
| [Alzheimer's Society: dementia stages](https://dementiaconnect.alzheimers.org.uk/about-dementia/stages-and-symptoms/progression-stages-dementia) | Stages describe broad progression; people differ in symptoms and support needs. | Do not map a slider position directly to mild/moderate/severe or claim it measures progression. |
| [Alzheimer's Society: communication advice](https://www.alzheimers.org.uk/about-dementia/stages-and-symptoms/dementia-symptoms/how-to-communicate-dementia) | Clear, calm, simple language and suitable pacing can help; avoid patronizing speech and memory pressure. Too many choices can be confusing. | Keep an adult tone, allow limited choices, and make the supported style previewable. Slower speech must not mean a childish/high-pitched voice. |
| [NICE NG97: recommendations 1.1.1–1.1.3 and 1.4.1](https://www.nice.org.uk/guidance/ng97/chapter/Recommendations) | Support people's own views, modify communication where needed, and tailor activities to preferences. | Involve the person where possible and let caregivers adjust preferences rather than imposing an ability tier. |

These sources do not validate Lemmi, a three-position slider, particular word counts, or timing values. NICE's page was available through search excerpts during this review, but direct retrieval was blocked; verify the exact current recommendations during care-professional review. The presets and implementation rules below are design hypotheses to rehearse, not medical instructions.

## 2. Proposed presets

All positions retain respectful tone, approved-fact grounding, no recall testing, one question maximum, and no prompt loops. Plain labels are used rather than “normal/severe,” a 0–100 score, or colored risk levels. Choose with the participant wherever possible; do not infer preferences from an avatar or diagnosis.

| Preset / ID | Proposed interaction | Activity presentation | Example using the same approved gardening interest |
| --- | --- | --- | --- |
| **Conversational** / `conversational` | Default one or two short sentences. A familiar-topic invitation may be open-ended, with a simpler choice available. | Normal reviewed activity introduction, one step at a time. | “You enjoy gardening. What do you like growing?” |
| **Guided** / `guided` | One short idea per turn; prefer yes/no or two concrete choices. Supply context rather than request recall. | Show a simple action or example, not a long instruction. | “You enjoy gardening. Would you like to look at flowers?” |
| **Quiet companionship** / `quiet` | Brief acknowledgment or approved caption; no unsolicited follow-up question. User-initiated conversation remains available. | Offer listening or looking without answers; guessing remains an explicit optional activity, not a requirement. | “Here is a picture of flowers.” Then wait without repeating an invitation. |

Proposed initial default: **Guided**, shown explicitly during caregiver setup and adjustable before the session. No position is “better,” and the setting must not hide the participant's choices, imply diminished personhood, or override a request for more conversation.

This is a discrete slider/segmented selector with exactly three positions, not a continuous clinical scale. Accessible radio buttons or labeled cards are an equivalent control when easier to use. Numeric position indices remain internal presentation only; do not store a dementia score.

## 3. Functional requirements

| ID | Priority | Requirement and observable acceptance |
| --- | --- | --- |
| CSUP-1 | Core | Only an authorized caregiver can save a persistent preset. UI explains “Changes how Lemmi talks; does not assess dementia.” Saving shows exactly what was selected, and reload restores it. |
| CSUP-2 | Core | Each position shows a short description and preview using the same approved fictional topic. Preview is clearly a sample and cannot open the participant microphone or silently play on the robot. |
| CSUP-3 | Core | Preset and configuration version are validated enums, separate from diagnosis, avatar, language, and privacy permissions. Invalid values cannot silently fall back to an arbitrary severity. |
| CSUP-4 | Core | Anay resolves one effective server configuration and supplies it to conversation/activity adapters. App, robot, and summaries cannot maintain conflicting support settings. |
| CSUP-5 | Core | Conversational/Guided produce no more than one question per turn; Quiet emits no unsolicited follow-up question. Unsupported personal assertions and sensitive-topic behavior remain constrained at every position. |
| CSUP-6 | Core | Pauses, repeated questions, unclear speech, and choosing not to answer receive patient recovery at every position. No automatic setting change, caregiver concern alert, diagnosis, or score from these alone. |
| CSUP-7 | Core | Settings are reversible. Save for the next session by default; explicit Apply now pauses the current interaction, invalidates pending output and requires participant-aware explicit continuation. No hidden mid-sentence restart or queued old-style speech. |
| CSUP-8 | Core | Participant stop/refusal/mute and manual caregiver help work at every setting. Presets cannot change recording, consent, excerpt saving, contact destinations, notification deadlines, or emergency claims. |
| CSUP-9 | Core | A session records the selected preset/config version as context, labeled caregiver-selected. Journal changes are configuration history, never a dementia trajectory or inferred decline graph. |
| CSUP-10 | Core | All four activities remain optional. Guided can simplify instructions; Quiet defaults to music/just-look invitations without repeatedly soliciting an answer. An explicit guessing request uses its reviewed yes/no/not-sure/skip controls, not a new scoring system. |
| CSUP-11 | Later | Independent manual controls for response brevity, preferred question format, speech pace, extra waiting time, and sensory/motion preferences; mark Custom and preview the effective settings. Do not build an extensive editor before the core presets work. |
| CSUP-12 | Core | Every preset is available with all five avatars and both participant interfaces. It does not imply a different animal personality, cloned voice, hearing level, motor ability, or real-world care plan. |

“Core” here means the minimum complete implementation of this new feature, not a replacement for existing P0 work or its verification. Build it after the first audio/activity/contact vertical slice; include it in the completed planning target as F12.

## 4. Timing and sensory behavior

Do not attach a clinical waiting-time formula to the slider. The existing draft 4-second end-of-turn silence, 15-second initial silence and 20-second service timeout remain explicit prototype settings until tested; none is a validated dementia threshold. A quieter/more supported preset does not automatically shorten the person's response opportunity or extend a failed service wait indefinitely.

Use the selected local TTS voice, with any manual pace adjustment bounded to tested engine capabilities. If speech rate cannot be changed reliably, disclose that limitation rather than claiming an effective control. Do not substitute a louder or higher-pitched voice, change language, reduce text size, or increase motion from the preset. Hearing/vision/language/motion needs are separate preferences. No camera-based gesture or emotion inference is added; touch choices support people who prefer not to speak.

Keep known short fallback/status phrases in the appropriate style. Immediate stop/help/error instructions may exceed a normal brevity target when needed for accurate meaning; a Quiet setting must not suppress important status or send failures. Warm local model behavior and cancellation still require actual hardware tests.

In Quiet companionship, completion of speech returns to capture-off `waiting`; never automatically open another listening turn. A participant’s explicit Speak now starts one turn and its response returns to waiting. Conversational/Guided may continue into listening after speech only under a current explicit server capture grant and valid local permissions/state. Firmware/browser clients never start capture merely because playback ended. Stop/pause/mute/camera/help override every preset; unmute alone never restores a capture grant.

## 5. Schema and runtime contract

Backend implementation note (November 14): [chat/support handoff](handoffs/anay-chat-support-hardening.md) documents current caregiver read/default-save/apply APIs, central response policy, checkpointed configuration provenance and acceptance limits. The runtime `CommunicationSupport` value remains `{preset,configVersion}`. Actor/time are private configuration records, excluded from device/model snapshots; the illustrative settings shape below is not a replacement runtime schema. The effective activity presentation context follows the session preset; completed presentation behavior in all reducers still needs Lukas's review.

Proposed profile settings:

```ts
type CommunicationPreset = 'conversational' | 'guided' | 'quiet';
interface CommunicationSupport {
  preset: CommunicationPreset;
  configVersion: 1;
  selectedBy: string;       // authorized caregiver ID; not an LLM decision
  selectedAt: string;       // server timestamp
}
```

Persist the profile preference with optimistic profile revision. Add `communicationSupport` snapshot/config revision to session creation and authorized session views; expose only the needed effective communication fields to the model/device, not caregiver identity or a supposed disease stage. Do not add a `dementiaScore`, automatic stage classifier, or clinical staging instrument.

Saving this preference alone is for future sessions. Applying now is an explicit session command using current generation/revision, pause/cancel behavior, and a fresh effective config. Profile biography corrections still follow their existing next-applicable-turn rules; do not generalize this preference's next-session default to stale personal facts. Privacy revocation, stop and help remain immediate and cannot wait for a support-setting transition.

Model instructions are only one layer. Anay checks output shape/question policy and uses reviewed short recovery text when needed; unverified or stale output cannot be played. Lukas receives a bounded presentation policy without private biography. Kylie renders selected/unsaved/preview/save-conflict states. Emilia follows effective session/capture/output commands; firmware does not stage dementia or independently rewrite the setting.

Settings/history and session summaries are access-controlled and deleted through the existing profile/journal deletion flow. Store minimal actor/time/config history, not a clinically interpreted trend. Existing excerpt-off rules still apply to sample previews and session summaries.

## 6. UX placement and build order

Kylie adds a **Conversation support** section to `/caregiver/profile` (same component may be linked from settings; no second independently saved copy). Show three named positions, brief descriptions, same-topic previews, selected state, and next-session/apply-now scope. Keyboard and screen-reader labels must describe the actual preset, not merely a number. Do not show “patient severity” in participant navigation.

1. Anay + Kylie agree enum/schema, profile/session snapshot and preview fixtures.
2. Kylie renders the selector/previews against typed mocks; Anay implements profile permission/revision and resolves presets.
3. Anay connects policy to conversation/local TTS and tests identical prompts under all three positions without weakening safety.
4. Lukas applies presentation choices through the existing activity-view seam, without changing facts, difficulty scores, or permissions.
5. Emilia + Anay test explicit apply-now cancellation and app/robot consistency. Kylie + Lukas rehearse preferences with fictional data; do not use Grandma to test distress/urgency scripts.

## 7. Required checks

- Same approved topic produces distinct Conversational/Guided/Quiet previews while retaining adult tone and factual grounding.
- Guided asks one simple question; Quiet does not automatically ask another. Participant-initiated conversation, refusal, stop and help remain usable.
- Different selection does not alter avatar, consent, contact routing, speech capture mode, raw-audio retention, or language/volume settings.
- Caregiver edit/reload/unauthorized write/revision conflict and next-session versus apply-now behave as stated.
- Apply-now during generation/playback suppresses stale output and requires explicit continuation; never resumes a muted microphone.
- Repetition, uncertain game answers and silence do not automatically move the selector or label clinical change.
- Music listening and photo just-look work without answers; guessing always allows not-sure/skip/reveal/exit.
- Journal displays a caregiver configuration choice and relevant session context, not a diagnostic trend.
- Test speech/language/sensory preferences independently; a higher support position does not expand clinical eligibility.

- Quiet speech completion stays capture-off until explicit Speak now; muted/unmuted and stale playback-completion events cannot reopen capture. Conversational/Guided clients also require a current server capture grant.

Rehearsal feedback and care-professional/lived-experience review should refine the presets. No source reviewed here establishes that these exact three modes improve outcomes or are suitable for every person living with dementia.

## Camera and touch independence

Conversation support presets never enable camera, infer consent or change viewer permissions. F13 camera check-ins and F14 top-strip petting follow [robot-capabilities-spec.md](robot-capabilities-spec.md), in that priority order. A pet is not a consent action, clinical observation or activity answer; Quiet companionship does not suppress camera/stop notices.

## Evolving interests are distinct from support presets

F15/F16 in [personalization-and-matching-spec.md](personalization-and-matching-spec.md) add permitted profile-specific topic preferences and object retirement, plus optional visible-picture matching. This changes content eligibility, not Conversational/Guided/Quiet settings or inferred dementia stage. A Not sure can remove an object under the explicit retirement rule; it does not change speech mode/difficulty, imply decline or loosen privacy/help controls.
