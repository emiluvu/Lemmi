# Anay → Lukas / Kylie: activity contracts A01–A04

November 13, 2026. Branch `anay/device-control-foundation`; changes are in the working tree, not committed. This is a contract increment, ready for counterpart review. New reducers, reviewed live content, catalog hosting and real playback remain pending. A05/A06 and full activity acceptance are not complete.

## State and content shapes (A01/A02)

Import schemas and inferred types from `@lemmi/contracts`. `ActivityStateSchema` now has four separate `activityId` variants. Each carries `instanceId`, nonnegative `revision`, and `phase: ready | active | paused | ended | unavailable`.

| Activity | Additional server/reducer state |
| --- | --- |
| `music_playlist` | Existing `currentTrackId`, `playback` |
| `twenty_questions` | Nullable `roundId`, `questionId`, `guessCandidateId`; `roundPhase: ready | asking | guess_offered | complete`; internal `questionsAsked` bounded 0–20 |
| `photo_album` | Nullable `currentPhotoId` and zero-based `position` (both present or both empty); `viewingMode: just_look | talk` |
| `object_matching` | Nullable `sampleCardId`, two distinct `choiceIds` when populated, nullable `selectedChoiceId`, `pairShown`, nullable coordinator `presentation` |

`phase` is the outer lifecycle; keep the activity position/round phase on pause. Resume returns to ready without replaying effects; end is terminal. When policy removes content, clear its references while retaining a paused outer phase. The schema permits these states; Lukas must implement/test the transitions. The existing create function returns schema-valid **unavailable** stubs for the three unfinished activities and still throws on their progression/projection. It does not claim those games work.

`ApprovedPackSchema` changes:

- Guessing replaces the old `candidateIds` placeholder with `candidates`, `questions`, and `rounds`, each bounded to 20 and containing unique IDs. Candidates carry `id`, `label`, nullable `assetId`, and nonempty canonical `entityIds`. Questions carry `id`, `prompt`, nonempty `entityIds`, and all four reviewed `branches: {yes, no, not_sure, skip}`. A branch is `{kind:'question', questionId}`, `{kind:'guess', candidateId}`, or `{kind:'round_end'}`. Rounds carry `id`, `candidateIds`, `entryQuestionId` and a terminal `reveal`. All references resolve; every question is reachable from a round; cycles, unreviewed references and guesses outside a round are rejected. At most 20 acyclic question nodes bounds every path. Shared subtrees are allowed.
- Lukas follows the reviewed answer/skip branches; `guess.reveal` uses the current round's reviewed terminal; `guess.new_round` explicitly starts the next eligible reviewed round in catalog order, or returns a complete/empty state when none remain. It must not automatically loop/retest excluded objects. These are the agreed contract semantics for implementation, not new reducers in this change.
- Photo entries now have stable `id` for `photo.select`, `assetId`, nullable `caption`, nullable approved `discussionContext`, and nonempty `entityIds`. A missing caption/context is represented by null. `collectionKind` still supports `album | place_scenes`. Discussion context stays server-side; participant views never contain it.
- Matching cards now have stable `id`, `assetId`, canonical primary `entityId`, and nonempty `entityIds` including that primary object. Card IDs distinguish sample/choice positions; several cards may share an object or picture. Filter every tag on sample and distractor cards. A shown pair or nonmatching tap alone cannot emit an uncertainty signal.
- Music tags are now nonempty too. Schema validation cannot verify the completeness of visual/content tags or whether wording is suitable; content review remains required.

For guessing, filter all referenced candidates/questions and their tags before exposing prompts/guesses. Do not follow a branch into excluded content; use a safe empty/finish state. No unavailable eligibility fallback is unrestricted. The internal question cap never appears as a participant failure count.

## Matching evidence and freshness (A03)

`MatchingPresentationSchema` is `{instanceId, presentationId, presentationRevision, policyRevision}`. The coordinator issues it. `ActivityContextSchema` **requires** `matchingPresentation`, using null for nonmatching/unavailable presentations; the nested policy revision must match `eligibility.policyRevision`. There is no permissive default.

Matching state and view use a single nullable `presentation` object. This **replaces the old top-level `presentationId`/`presentationRevision` view fields**. The view also adds `pairShown`. Guessing views add `roundPhase` and nullable `offeredGuess: {label, assetId}`. Hidden candidate tables, answer flags, question counts, selection history and policy reasons are not view fields.

Every `match.*` action is submitted through existing `clients.activities.submit`, with the current view's `presentation` copied onto the **command envelope**, alongside `sessionId`, `instanceId`, `commandId` and `expectedRevision`. The action itself remains the existing participant-only union. `match.select.choiceId` is a displayed card ID. No client-selected entity/profile is accepted as evidence. `activity.leave` remains an exit without presentation evidence, including when no eligible sample exists. All `match.*`, including Finish, require a current presentation; use `activity.leave` for an empty/unavailable view.

`validateActivityCommandContext(raw, state, context)` returns a shared Result. It checks session/instance/revision, lifecycle, action family, current matching token and displayed choice. Stale revisions/tokens or paused/ended progression return `REVISION_CONFLICT`; malformed commands/foreign choices return `VALIDATION_ERROR`; unavailable eligibility returns `UNAVAILABLE`. The existing music host uses it before reduction. Full matching hosting is A05.

Signal effects are now explicit:

```ts
{ type: 'preference.signal', entityId, signal: 'prefer' | 'avoid', presentation }
{ type: 'item.uncertain', entityId, presentation }
```

`validateMatchingSignalContext(effect, inputState, pack, inputContext)` checks current presentation and primary sample identity, plus eligibility of the entire displayed sample/choice set. Validate against the **input** state/context before moving on or committing a policy update; the next state may already have cleared the uncertain sample. Effects retain their source presentation, not the next presentation. This helper does not persist anything, establish explicit choice evidence, deduplicate occasions or authenticate a sender.

A05/A24 must authenticate/resource-scope callers, serialize validate/reduce/commit, deduplicate command/effect IDs, enforce profile/privacy/generation/lease validity and remembering permission, and refresh presentations on every content/policy change and resume. A current refusal/session hide must apply even when durable remembering fails. No append-only uncertainty history or biography write is introduced here.

## Factual events and transitions (A04)

`ActivityEventSchema` and `ActivityTransitionSchema` are runtime exports; `ActivityTransition` is inferred from the latter. Transitions strictly validate `{nextState, events, effects}` with bounded arrays. Events contain IDs/enums, with receipt evidence where required, and reject raw statements/private guidance/scores/unknown fields.

Events cover:

- Lifecycle: `activity_started`, `activity_ended`, `activity_paused` (fixed `reason`), `activity_resumed`, `eligibility_changed` (`policyRevision`).
- Music requests: `track_selected`, `track_play_requested`, `track_pause_requested` (`itemId`).
- Endpoint evidence: `track_played`, `track_paused`, `track_ended`, `media_failed` (`itemId` plus `receipt`). Each receipt status must match its event; its instance must match the transition. In this increment `media_failed` denotes endpoint playback failure. Asset/image read failures still need their own executor reporting in A05/A19.
- Guessing: `question_answered` (`itemId`, fixed `answer`), `question_skipped`, `guess_offered`, `guess_round_ended` (`itemId`). These are factual actions without correctness/ability labels.
- Photos: `photo_selected`, `photo_talk_requested`, `photo_just_look` (`itemId` = photo entry ID).
- Matching: `match_presented`, `match_selected`, `match_shown`, `match_next`, `match_finished` (`itemId` = sample/selected card ID as applicable). No error count or retained uncertainty-performance log. Policy signal proposals are separate effects.

`offer_photo_conversation` effects now include both `photoId` and `assetId`, so the executor can bind/cancel talk against the exact approved entry. This is a request to the existing conversation pipeline, not a second model service. Fixed reviewed narration uses `speak_approved_text.textId`; resolve that ID within the current eligible approved content, never as a URL or arbitrary model text.

`JournalEventSchema` reuses those event shapes with `source:'measured_event'`, plus the existing `session_stopped`. The existing coordinator retains complete validated events instead of discarding fields and now records interruption/resume events with the actual fixed reason. All storage remains bounded in-memory, with excerpts/memory disabled. The existing music example validates action/system inputs and transition outputs; pause/end return stop-media effects and resume returns no output. Track requests remain requests until receipt input.

**Receipt schema validation is not authentication.** `system.playback_receipt` stays coordinator-only. The host must verify endpoint, committed effect ID, lease, generation, current profile/privacy/policy revisions and monotonic receipt sequence before calling the pure reducer. A05 still owns this receipt/execution path; no public receipt route, executor or audio asset is added. Late receipts cannot activate paused/ended or newly ineligible music in the existing reducer. Raw valid-looking receipts are never authorized solely by Zod.

## Fixtures, checks and next handoff

From `@lemmi/contracts/fixtures`:

- `guessingPackFixture`, `photoPackFixture`, `matchingPackFixture`: fictional schema examples with placeholder asset IDs, **not reviewed/live content or media**. `approved:true` exercises the approved-pack discriminator only; these fixtures are not added to the hosted catalog.
- `activityStateFixtures`, `activityScreenFixtures`, `activityTransitionFixtures`: initial/paused/ended examples for all four activities and camera-pause transitions. These are handcrafted contract/UI fixtures, not extra reducers or a session store.
- `matchingPresentationFixture`, `activityContextFixture`, `matchingSignalFixtures`: shared presentation, policy and signal examples.
- Existing `activityViewFixtures` still supplies four unavailable UI fixtures, updated to the new shape; `contextFor` now includes explicit null matching context.

Observed in this Linux workspace with **Bun 1.4.4**: the pre-change 37-test suite and check passed; after changes `bun run test` passed **51 tests**, `bun run check` passed with zero Svelte errors/warnings and no TypeScript errors, `bun run build` and `bun run format:check` passed. `bun run smoke:web` verifies the existing SvelteKit → mock gateway → music request/pause/Stop path; its result is recorded in the build-plan acceptance note. No dependency/lockfile changes or installation were needed. One intermediate test expectation failed TypeScript and was corrected before the final successful check.

**Lukas next:** review the exact state/branch/presentation/effect fields, replace fictional pack content with reviewed content, then implement all three missing create/reduce/project/system-input paths. Use the shared schemas and both signal effects; test pause/eligibility/resume/end interleavings without I/O in reducers.

**Kylie next:** review/render the safe screen fixtures through existing typed clients, copy `view.presentation` to matching command envelopes, and handle unavailable/empty/paused/ended states and missing captions/images. No application layout/UI files were changed here. Actual browser/accessibility review remains pending.

**Anay next:** A05 catalog/instance hosting, authenticated receipt/effect execution and A24 policy writes, followed by A06 publication/counterpart review. Obtain Lukas/Kylie review before integrated merge; none has been claimed. No actual hardware, provider, camera, persistent memory or full activity acceptance passed in this contract increment.
