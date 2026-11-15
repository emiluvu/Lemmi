# UI and spoken activity integration review

Source branch **`integration/frontend-backend` / `a664e7e`** is preserved unchanged.
Integration is prepared separately on `anay/ui-voice-integration-20261114`, based on
deployed branch `3a326fd`. This record initially describes a tested candidate;
actual installation and public observations are added to backend status after rollout.

## Included changes and overlap resolution

- Retain the redesigned single conversation screen, five updated avatar strips,
  thinking/speech presentation, phrase list, typing/reply dialogs, caregiver
  name/avatar controls and server-verified four-digit exit keypad.
- Explicit English commands select Teach Lemmi or browser-only Photo Story;
  Explore pictures uses the same reviewed Photo Story pack. Back to conversation
  ends the current mode without opening capture. Music/guessing/matching remain
  unavailable. This does not add another activity engine or session authority.
- Immediate Stop/Pause/help and fixed sensitive/refusal routes retain priority.
  Exact reviewed mode commands are handled before the optional decision model.
  Semantic activity classifications remain advisory and cannot execute a game;
  model failure does not fall back to phrase classification. Updated obsolete
  guidance that said all voice launch was unconnected. Runtime decisions remain
  disabled after the prior release's failed live evaluation.
- Preserve the deployed 1,500 ms WebRTC turn ending, opt-in diagnostics,
  twelve-frame browser/four-frame robot playback credit, HFC CPU 2+2 speech,
  owner-only background Pause, current revision/lease/grant checks, and bounded
  eight-message transient text history in the reply dialog. History clears on
  Stop/Pause/disconnect/reconnect/profile/authority changes; no new storage.
- The source hid safety controls in a modal, conflicting with experience section
  3's persistent Pause/Stop/Get help requirement. The merged layout keeps those
  labeled controls visible and repeats them inside typing/reply/exit dialogs.
  Local Stop/Pause cancel owned browser audio even if transport is unavailable.
- Reviewed mode transitions mint a server-owned UUID instead of extending the
  caller's command ID. A valid 100-character ID previously overflowed the contract
  after adding `-select`, canceling the old mode before failing selection.

## Database and access review

`POST /v1/demo/profile-update` accepts only `{profileId,expectedRevision,commandId,
patch:{preferredName,avatarId}}`. It requires the existing private gate, explicit
fictional-demo enablement, configured caregiver assignment, and an active
`is_demo` profile. Strict input validation rejects private biography, interests,
redirects, contacts, privacy or caller-supplied authority. Responses contain only
the participant projection; no private caregiver fields are returned.

Writes reuse `PersistentData.handle` / `DataRepository.update`, the bounded
serialized configuration queue, locked profile/membership/boot/revision checks,
durable mutation receipts, cancellation-before-commit and uncertain-outcome
reconciliation. Added a **demo-only check inside that same write transaction**,
so a profile cannot cease being fictional between list authorization and write.
Normal independently authenticated caregiver updates retain their prior scope.

Identity edits retain existing conversation redirects/private configuration,
pause only that profile, require explicit continuation, and invalidate pending
speech output. No raw command text, transcript, audio, new journal/preferences or
model inference is persisted. No migration, schema rewrite, reseed or existing
credential replacement is required; all seven migration files remain unchanged.

The exit keypad is a navigation aid, **not caregiver identity, device pairing or
a security boundary for private records**. Its separate HttpOnly/SameSite cookie
guards navigation and fictional setup mutations in that browser; private APIs
continue using independent authorization. Live has no default code; preserve an
existing protected `LEMMI_CAREGIVER_EXIT_PASSWORD` or provision it privately.
Never publish its value. Local mock code `1234` is explicitly fictional. The
proxy needs only the three exact new names: `profile-update`, `conversation-lock`,
`conversation-exit`; internal/mock/preview/raw media stay blocked publicly.

## Observed candidate checks

- Pinned Bun 1.4.4 frozen install; type/Svelte zero errors/warnings; production
  build, full format check and whitespace passed.
- **336 tests passed, zero failures/skips; 5,382 expectations**, with five separate
  disposable PostgreSQL databases. New coverage includes real/foreign/deleted
  profile and private-field denial, locked-write demo-flag races, durable retries,
  preserved redirect/private data, cross-profile isolation, pending spoken-mode
  synthesis cancellation/late-buffer wiping and content-free checkpoints.
- Mode tests cover every displayed phrase through synthetic STT/TTS/receipts,
  explicit command priority over optional decisions, advisory classifications,
  stale/paused/duplicate selection, valid maximum IDs and Stop during synthesis.
- Production-build verified HTTPS/WSS participant smoke passed with new exit-code
  wrong/correct checks, safe durable identity edit/stale/private-field checks,
  activity command transport, scoped scene access, concurrent endpoint isolation,
  restart/release. Persistent data/media/support and chat/control smokes passed.
  Two long speech fixture turns consumed 600 chunks with simulated receipts.
- Actual Chromium inspected the local explicit mock preview at desktop and
  390×844: safety controls in the viewport, selected-avatar presentation, no horizontal
  overflow/runtime errors, keypad Stop, Escape, wrong-code rejection and successful
  mock exit. This is not live database/audio or physical microphone acceptance.

Initial merged tests exposed the old semantic guidance expectation; it was updated
to the actual advisory contract. New regression scaffolding initially used the
wrong event-table name and an overly narrow UUID annotation; both were corrected
before the clean full run. The old participant smoke expected profile creation on
the participant page; the new UI correctly places creation in the caregiver view,
and the smoke now checks that flow and the exit guard instead of weakening it.

Remaining counterpart work: Kylie reviews the final compact layout/keyboard/zoom,
Lukas reviews reviewed mode/scene transitions, Emilia verifies real local controls,
voice recognition and K151 behavior. Human microphone, room noise and actual audible
playback remain unverified; no P0/clinical/unattended-care acceptance is implied.

## Observed rollout

Web/gateway `95bdcef` is installed; private speech was retained without restart/configuration change. The branch source remains `a664e7e`. No migration or reseed. Proxy syntax/reload and the three exact new demo routes passed. The live exit code was provisioned privately in the protected root `.env`, never printed or sent into model context. Rollback backup pointer `.data/ui-voice-rollback-path`.

Actual public Chromium passed profile create/avatar/name edit with database-confirmed revision, safe result shape, typed mode switching, empty-profile/no-borrowed-context behavior, truthful unavailable music, Pause/Resume/Stop, mobile direct safety controls/no overflow, wrong/correct live exit and locked mutation denial. Actual ordinary local-STT/external-LLM/HFC-TTS rehearsal passed 177 input frames/388 chunks. Actual synthetic recognized Explore pictures activated the reviewed browser Photo Story scene without an LLM action, returned 235 TTS chunks from 109 input frames, remained capture-off, then stopped; the initial missing-Origin harness was rejected and the corrected run passed. All consumption was simulated. Scoped public Photo Story/model/media/Stop and the retained persistent credential passed. Secret scan passed 54 browser text assets; internal/mock/preview/unlisted static resources remain blocked. Four services active; no automatic restarts. Only each rehearsal's own profile/enrollment was removed. Human mic/speaker/K151 and counterpart acceptance remain unrun.
