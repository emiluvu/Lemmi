# Lukas → Anay / Kylie: photo and guessing reducers

The activity branch now includes main through `53c7a5f` (A01–A04). The existing
`createActivity`, `reduceActivity`, `projectActivity`, and `applyActivitySystemInput`
exports dispatch photos and guessing into `packages/activities/src/reviewed.ts`.
No shared schemas, hosting, effect executors or frontend components were changed.

Photos support stable selection, bounded next/previous navigation, just-look and
approved-context talk requests. Changing pictures stops old media/talk. Missing
caption is null; missing discussion context disables talk. Private discussion
context never appears in the view. Quiet offers just-looking wording.

Guessing follows validated reviewed branches for yes/no/not-sure/skip, explicit
reveal, and forward-only next rounds. The internal 20-question bound is enforced;
question counts and hidden candidate tables stay outside views. Visible candidate
asset IDs accompany the round. Neither silence nor a timer supplies an answer.

Both activities filter every canonical tag in create/reduce/project and system
inputs. Guessing conservatively requires the entire reachable round and its
candidates to be eligible. Exclusion clears current question/guess/photo references
and stops output; camera pause stays paused. Resume never replays effects. Finish
is possible even when content becomes unavailable. End is terminal. Once the photo
selection is cleared, a fresh activity start is required; no automatic replacement
picture or talk occurs on resume. Playback receipts do not advance these activities.

These paths currently exercise Anay's placeholder pack fixtures. They establish
pure logic, not approved media availability or a finished hosted game. A05 must
host them, serialize commands and cancel stale talk effects using current photo,
instance, revisions and session/output validity. Kylie renders the shared view.

## Remaining exact matching handoffs

- `ActivityStateSchema`'s `object_matching` variant has only the current sample and
  choices. Agree a bounded progression/visited canonical entity field, or an
  explicit coordinator-selected next presentation, so clearing a sample on
  uncertainty/eligibility change cannot restart the pack or retest an earlier
  object. The reducer must not create an independent history/session store.
- `ActivityContextSchema.matchingPresentation` is current input evidence. Agree
  how the host supplies fresh evidence for content changes/resume while validating
  the action and uncertainty signal against the old input presentation. The
  reducer cannot mint that token.
- `ActivityActionSchema` has no explicit prefer/avoid feedback action. Match taps,
  Show me, Skip and Next cannot justify `preference.signal`; agree the explicit
  participant feedback route/action before connecting that effect. `item.uncertain`
  has the explicit `match.not_sure` source. A24 owns immediate session hiding and
  persistence/save-failure behavior.

Matching remains explicitly unavailable pending these decisions. The Python
terminal experiment remains preserved and separate from these participant rules.
