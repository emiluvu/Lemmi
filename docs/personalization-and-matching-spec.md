# Lemmi — Growing preferences and object matching

**Status:** Committed planning requirements; no implementation or participant validation yet  
**Updated:** November 13, 2026  
**Owners:** Anay (memory/policy/contracts), Lukas (matching logic/content), Kylie (preferences/game UI), Emilia (device integration)

**Starter note:** Shared code now exists; see [team-start.md](team-start.md) for exports and current limitations. Reuse the starter. Requirements in this document remain unverified unless explicitly recorded as observed; typed snapshots do not establish working product/hardware behavior.

## 1. Intent and scope

**F15 — Per-profile evolving preferences:** Lemmi becomes more familiar through repeated interactions, remembering permitted interests and avoiding unwanted topics. All policy stays bound to the functional profile across sessions, devices and avatars. This demo implements only Alex; dashboard examples have no live policy. Retain resource authorization without building multi-profile management. Growth means better topic/content choices and less repetition, not model training, inferred dementia stage, personality diagnosis or automatic biography editing.

**F16 — Object matching:** Add a fourth built-in activity, `object_matching`, alongside music, gentle twenty questions and photo album talk. This is a new explicit requirement; it does not resurrect the old sorting implementation. Start with approved picture-to-picture matching, not camera-based real-object recognition. Pictures stay visible. No object naming, delayed recall, hidden cards, timers or score is required.

This document governs the added preference/retirement behavior. Existing safety, privacy, communication-support, contact and camera rules remain in effect. F13 camera still precedes F14 petting polish; F15 contracts and shared content eligibility must exist before F16 integration. No learning changes communication-support presets, permissions, help routing or urgency handling.

## 2. What Lemmi learns

Use a small reviewed topic/object catalog with stable semantic IDs shared by conversation prompts, question trees, matching cards, photos and tracks. For example, all pictures of a kettle map to the same `object:kettle`, independent of image/pack/wording. Related content carries explicit topic/object tags; aliases map to the same canonical entity. Do not expand one avoided object to an entire category without an explicit request.

| Signal | Immediate behavior | Across sessions when preference remembering is permitted |
| --- | --- | --- |
| Explicit interest: “I enjoy gardening” or deliberate favorite selection | Offer that topic naturally without repeating it continually | Store canonical topic ID + `prefer`, attributed to participant choice; no quotation or biographical claim |
| Explicit refusal: “Don't ask about that” / “I don't like this topic” | Stop that topic now; invalidate pending topic-linked speech/prompts | Store `avoid`; never proactively reopen, disguise it with another image or ask why |
| Repeated positive feedback | Vary suggestions; a deliberate positive choice can inform later ordering | After two distinct positive signals in separate sessions, allow a tentative interest to reorder optional suggestions, clearly labeled as inferred/unconfirmed to caregivers |
| One skip, silence, speech-recognition failure, incorrect tap or short session | Respect leaving; offer show/change/finish as appropriate | Do not infer dislike, inability, mood or cognitive decline |
| Explicit “Not sure / I don't know” about a matching object | Remove that object for the rest of this session; no naming drill or reattempt | Maintain the bounded retirement state in section 4; do not persist a performance history |

Positive signals are explicit feedback/favorite actions, not watch time, facial analysis or a model's guess that someone sounded happy. Ambiguous speech may yield a transient proposal, but cannot write a persistent preference until tied to a clear current participant choice. A participant refusal applies immediately even if no durable memory is enabled. A caregiver cannot override a current refusal during the interaction.

Learned interests are soft suggestions, never a reason to keep pushing. Rotate among eligible interests, allow neutral options and respect a new choice. Do not say “You always love this” or claim to remember an unretained conversation. Learned preferences remain distinct from approved biography, caregiver-authored guidance, observed technical events and AI summaries.

## 3. Consent, visibility and control

Add a clearly explained **Remember preferences between visits** choice, separate from **Save statement excerpts**. Default off until explicitly enabled through the explained setup/agreement flow. Explain: “Lemmi can remember topics you enjoy or want to avoid, and items you don't want to be asked about again. It won't save recordings or the conversation.” A caregiver account label alone does not establish authority; follow the existing supported-decision rules and participant choice.

- With remembering on, save only the structured preference/item-policy state described below, even when excerpts remain off. This is an explicitly disclosed new category of retained derived data, not a transcript-saving workaround.
- With remembering off, adapt within the current session, then clear derived state at end. Keep separately authorized caregiver-entered preferences. Explain that cross-session learning/retirement cannot be promised while remembering is off.
- Turning remembering off stops and invalidates pending preference writes. Offer a separate **Forget learned preferences** action with deletion of derived caches and dependency handling; turning off alone need not delete previously saved preferences, but they are not used while disabled. The UI must make this distinction explicit.
- Caregiver Profile gains **Interests & boundaries**: preferred topics, avoided topics and retired objects; source labels (participant choice / caregiver choice / tentative pattern / item policy), last change and edit/remove/undo actions. No utterances, miss counts, ability labels or clinical trend charts. Show the remembered policy and its limitation without a hidden AI dossier.
- Participant controls support Like this topic, Different topic and Don't ask about this, using simple labels. A clear spoken refusal follows the same path. Never require feedback or a reason. Do not repeatedly ask for permission to save every turn.
- Re-enabling a retired/avoided item requires an explicit authorized edit with participant agreement where possible. Do not reset automatically because time passed, a model suggests a new topic, an avatar changed or a new pack was installed. Current refusal still wins.

## 4. Matching game and retirement rule

Starter content: a few permission-approved everyday-object illustrations, each with canonical entity tags and visually clear alternatives. Show a sample image and two large candidate images; optionally reveal or show the matching pair at once. A prompt can be **“We can find the same picture, or just look.”** This is optional enjoyment, not an assessment. Naming the object is never required.

Controls: select a picture, Show me, Not sure, Another picture and Finish, plus shared Pause/Stop/Get help. No error sound, red failure screen, countdown, streak, leaderboard, wrong-answer tally or automatic difficulty increase. A nonmatching tap is not proof of unfamiliarity: offer to show the pair or move on without requesting another attempt.

**Draft operational default for “repeatedly”: two distinct explicit uncertainty occasions for the same canonical object.** This is an engineering default, not an evidence-based clinical threshold. Revisit with person-centered feedback; do not collect ability scores to tune it.

Apply the same rule to an unambiguous object-specific uncertainty in conversation or another activity when the current canonical entity is known. A generic “I don't know” with no identified referent is not evidence about an object; do not probe to manufacture it.

1. First explicit Not sure / “I don't know what that is”: respond briefly (“That's okay. Let's choose something else”), remove it from this session and offer a different eligible item or Finish. Do not re-present it that session to gather a second signal. Show me or ordinary Skip alone is not an uncertainty signal.
2. If the object is independently encountered in a later session and the person again explicitly indicates uncertainty, retire it across sessions when remembering is on. Never schedule a deliberate retest to reach the threshold. Refusal/discomfort retires/avoids immediately; no second occasion is needed.
3. Retirement applies to the canonical object across matching, guessing, photo prompts and proactive conversation. Do not name it, ask about it, use it as a distractor or smuggle it back through another asset/alias. Filter eligible content before selection and invalidate pending prompts/output when policy changes. Exclude an entire card/question/photo if it cannot be safely separated from the retired object. Approved media tags must cover recognizable objects relevant to this rule; do not claim exhaustive visual detection.
4. If the participant later independently brings it up, acknowledge without quizzing or testing and without automatically unretiring it. The rule stops Lemmi introducing/asking about it; it does not require ignoring the person's own speech. Safety/help responses remain available and cannot be suppressed by topic avoidance.
5. No eligible items left: **“We can listen to music, just look, or finish.”** Do not relax eligibility, restart a pack or claim an error by the person. A disabled memory setting means session-only avoidance; disclose that limitation.

Use small, reversible policy states: `eligible` → `session_hidden` with one remembered uncertainty occasion → `retired` at the next distinct occasion. The session-hidden overlay expires; the first-occasion marker is retained only with remembering permission. No historical list of mistakes, inferred reason such as “forgot kettle,” difficulty score, or presentation schedule aimed at testing is needed. Two duplicated messages about the same presentation count once.

## 5. Shared contracts and implementation

Anay owns runtime-validated types and schemas in the existing contracts package, not a vector database or agent framework. Start with reviewed topic/object IDs and deterministic policy application. New personal facts still require the approved biography-edit path. Unknown/free-text sensitive topics are handled immediately in-session and may be entered privately by an authorized caregiver; do not automatically extract/store sensitive biography as a preference.

| Contract | Minimum proposed fields / rules |
| --- | --- |
| `PreferenceMemorySettings` | Profile ID, remembering enabled, privacy revision, agreement record reference in protected storage. Keep journal excerpt permission separate. |
| `ProfilePreference` | Profile ID, canonical topic/entity ID, `prefer`/`avoid`, source enum, tentative/explicit status, revision, created/updated time. No utterance text or paraphrase. |
| `ItemPolicy` | Profile ID, canonical entity ID, `eligible`/`retired`, bounded `uncertaintySeen` boolean, prior occasion/session reference for deduplication, revision. No cumulative error count. |
| `EligibilitySnapshot` | Policy revision, permitted content/entity IDs and session-hidden IDs, scoped to profile/session. Give reducers only needed eligibility, not private reasons/guidance. |
| Matching actions | `match.select` with `choiceId`; `match.show`, `match.not_sure`, `match.next`, `match.finish`. Coordinator binds to current instance/presentation/entity IDs; clients cannot choose whose policy to change. |
| Matching view | Current sample/candidate asset IDs, safe controls and phase, presentation revision. Never expose hidden correct-answer flags or retirement history to participant clients. |
| Preference operations | Scoped load/update/delete; `POST /profiles/:id/preferences/signals` accepts only supported current-session/presentation evidence, idempotent command ID and expected revisions; caregiver `GET/PATCH /profiles/:id/preferences`, `DELETE /profiles/:id/preferences/learned` and remembering setting on the existing profile/privacy route. Reject invented/stale/unscoped writes. |

Only the authenticated server can commit policy. A model may propose an allowlisted topic signal from the current transient turn; it cannot approve its own evidence, choose arbitrary memory text or write to storage. Two positive occasions can use a bounded first-signal/session marker; do not retain the utterance to justify it. Tentative interests stay reversible and visibly unconfirmed. Do not send private avoidance reasons or the full preference store to the external LLM; use a minimum permitted context and server-filtered topic choices. Validate generated output against active boundaries; if the system cannot safely avoid the blocked topic, discard the response and use a neutral reviewed transition rather than playing it.

Lukas's matching reducer stays pure: uses the required `ActivityContext` eligibility/presentation policy in create/reduce/project, plus `applyActivitySystemInput` for authoritative interruptions and eligibility updates, as defined in integration-contracts section 3. It returns view/state and allowlisted `preference.signal`/`item.uncertain` effect proposals. Anay validates the current presentation, revisions and deduplication, commits the item policy, cancels old work, and reprojects all affected activity choices. No reducer writes a database. If durable policy save fails, keep session avoidance, report that future remembering failed, and do not claim it was saved. Before future use, reload authoritative policy; when required eligibility is unavailable, pause personalized prompts rather than falling back to unrestricted content.

Anay checks profile, privacy, memory-policy, session generation and presentation revision both before output and before accepting delayed writes. Profile switch clears audio/output queues, browser/device caches and old policy; never blend profiles through a shared robot. Revocation/deletion discards pending proposals, clears dependent caches and summaries, and prevents resurrection. Retain structured preferences/item policy until edit/forget/profile deletion/demo reset; cap by the reviewed catalog, not an unlimited append-only history. Learning signals are transient; raw audio/transcripts remain unretained. Learned records are not automatically available to journals/summaries; those keep their existing permitted-source rules.

## 6. Ownership and delivery order

1. **Anay + Lukas + Kylie:** freeze canonical content IDs, signals, memory permission, policy projection and fixtures first. Use Alex as the sole functional profile. Additional dashboard profiles are labeled preview-only fixtures, without live memory/session operations. Test unassigned/example IDs with isolated authorization fixtures, not a second implemented profile. No separate frontend memory or firmware store.
2. **Anay:** implement scoped persistence/forget, session-only fallback, policy precedence and stale-result protection; offer mocks to the others early. A current refusal and avoid/retired state override preferred topics; sensitive/urgent safety rules stay higher priority.
3. **Lukas:** implement picture matching against fixtures; then consume Anay's eligibility and emit signals. Apply the same eligibility to guessing/photo/music topic selection, preserving camera/pause/help behavior. Add matching after music and the existing photo/guessing paths, without duplicating reducers or model adapters.
4. **Kylie:** add the matching card/page `/participant/activities/matching`, state-complete matching UI, simple participant feedback, and Profile's Interests & boundaries plus remembering/forget controls. Use Anay's client and Lukas's view; no local inferred ability score.
5. **Emilia:** consume profile/session/policy revisions and cancel stale topic narration on changes. Add supported matching actions; use a larger app screen when two candidate images are not usable on K151. Firmware does not infer/store likes or decide retirement. Preserve F13-before-F14 order and local stop priority.

## 7. Acceptance checks — all pending

- Alex’s permitted preferences survive restart/reconnect/avatar changes consistently. Preview-only dashboard cards have no live preference state; example/unassigned IDs cannot read or mutate Alex’s memory. Verify scope with isolated authorization fixtures, without implementing multi-profile switching. No statement becomes approved biography.
- Explicit refusal stops current/queued topic output immediately; inferred likes never defeat avoid/retired rules. Silence, STT failure, Skip/Show me/nonmatching taps do not create negative policy or clinical labels.
- Remembering on + excerpts off stores only disclosed structured IDs/state, no utterances/paraphrases. Remembering off adapts only within-session. Disable/forget/delete while a signal/model job is pending cannot recreate or reuse removed policy.
- One uncertainty hides the item for the session; a later distinct uncertainty retires it. Duplicate messages/retries do not count twice. No deliberate retest, automatic unretirement or reappearance through alias, image, distractor, guessing or proactive conversation.
- Current participant-initiated mention is acknowledged without a recognition question. Avoidance cannot suppress manual help, urgent response, Stop or permission notices.
- Eligibility/save failure is explicit; no silent unrestricted fallback. All-retired content offers another activity/finish. Changed policy invalidates already queued object-linked prompts, frames/views and speech.
- Touch/browser/device paths, camera pause/resume and all four activity views share one session authority. Matching remains optional, untimed, readable and without ability/performance reporting.

Rehearse with fictional data and teammates first. Do not use Grandma's live demo to elicit uncertainty, discover disliked topics or test the retirement threshold. A chosen matching activity remains optional and subject to the existing supervised-demo agreement/fallback.

## 8. Teach Lemmi and approved scene packs

F17 Teach Lemmi is a guided conversation mode: Lemmi supplies one simple approved, eligible object/topic and invites the participant to explain it. Use the same canonical entity tags and policy revision as matching/guessing/photo prompts. Prompted teaching must never reintroduce an avoided/retired object; the name supplied by Lemmi is not evidence that the person knows it. An object-specific Not sure emits the existing uncertainty proposal; no second test or automatic correction. Ordinary explanation content is not a positive preference signal or biography fact without the separately defined explicit evidence/approval. First-visit neutral topics gradually yield to permitted interests, without automatic clinical/preset changes.

Explore pictures reuses approved photo packs with places/scenes and context. Tag relevant canonical objects/topics before selection, respecting retirement even when a different photo or mode is used. No live camera recognition, new location service or inferred personal history is required. The experience spec section 16 defines controls and states.
