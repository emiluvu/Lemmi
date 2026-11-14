# Chat hardening and communication support — Anay handoff

**Deployment follow-up:** both features were squash-merged into main and deployed as backend runtime `d067ac0` on November 14, 2026. The original branch-only observations below are historical. Both new migrations and the actual support-route proxy allowlist are installed; persistent same-key authentication after a live gateway restart passed. See [current backend status](../backend-status.md) for verification scope and remaining hardware/UI limits.

November 14, 2026. Branch: `anay/chat-support-hardening`, initially based on speech commit `151ebc3`, then merged with the server-agent fix `3fb561d` and main `a6f7ff9` (approved media schema). This branch adds A16's English backend fixtures/hardening and A20's server policy/save/apply seam. It does not modify `anay/speech-pipeline` or `anay/app-data-schema`. No deployment or remote-host changes were performed; the last verified deployment record remains in [backend status](../backend-status.md).

## Chat changes

`resolveCommunicationSupport` is the shared validated policy resolver. Conversational permits 600 response characters/one question; Guided permits 360/one question and asks for one idea or yes/no/two-choice phrasing; Quiet permits 240/zero model questions and asks for declarative replies. These are prototype presentation bounds, not clinical thresholds. All keep the same avatar, language/voice, privacy, Stop/help and contact rules. Mechanical validation counts normalized Unicode question marks and rejects control/format characters, markup/links and reviewed unsupported contact/action claims. It rejects an unsuitable reply without truncating it or pretending the provider succeeded.

Reviewed English full-phrase routes now cover identity/repetition, unclear recognition, medication/clinical questions, bereavement, frightening reports, personal-location requests, navigation and excerpt refusal, in addition to existing Stop/help/urgent/refusal routes. They use application-authored text without a model call. Personal-location routing is a bounded conservative phrase heuristic, not person recognition or an address resolver. Other questions still depend on approved context/prompt behavior; no universal grounding or concern-detection guarantee is claimed. Quoted, negated, third-person and hypothetical phrases are not matched as direct urgent reports by keyword alone. German remains a later language/voice/semantic acceptance task.

Frightening reports, navigation and excerpt refusal pause/cancel alongside existing urgent/unwell/topic refusal. The merged spoken-concern fix supplies fresh fixed-output authority after pausing, with the new paused generation published before synthesis. The same guarded path now covers the new frightening/navigation/privacy-refusal routes. Ordinary model playback stays canceled; fixed guidance finishes still paused with capture off. Repetition/unclear input never changes a preset, biography, remembering or privacy permission. Excerpts remain hard-disabled; the privacy-refusal response accurately distinguishes that from earlier processing. Fixed safety/help status may exceed a normal style target or ask a necessary help clarification; Quiet's zero-question check applies to model replies.

Provider errors/exceptions are sanitized at the coordinator boundary. A failed command ID replays only its failure, with no automatic provider retry. Explicit new turns can recover. Existing cancellation drops late STT/model/TTS results, and no raw dialogue/audio is added to persistence or logs.

The first real-model run passed 14/15 turns: a Quiet reply to a quoted concern contained a question and was blocked. Adding quote context alone still yielded 4/5 on the targeted Quiet run. Making the Quiet prompt explicitly prohibit all questions matched the runtime policy: targeted 5/5 and final 15/15 passed. Forty actual requests were used across these four explicit rehearsals, never automatic retries. Final GLM settings were `z-ai/glm-5.3-flash`, low reasoning, 512 tokens; final per-turn elapsed time ranged 740–2,894 ms. The [numeric/boolean artifact](../verification/chat-support-2026-11-14.json) contains no prompts/replies/keys. This bounded automated check leaves broader human semantic review incomplete.

## Caregiver integration

Both routes require the outer access key/cookie and a verified assigned caregiver Bearer token. They reject device credentials, foreign profiles/origins, query strings and caller-supplied actor/preset fields. Only `profile-alex` is functional. GET cannot apply a change.

| Method/path | Typed client | Successful Result data |
| --- | --- | --- |
| `GET /v1/profiles/profile-alex/communication-support` | `clients.profile.support({profileId})` | `{profileId,profileRevision,saved,session}`; saved is the current profile default, session is the active authoritative snapshot or null |
| Existing `PATCH /v1/profiles/profile-alex` | `clients.profile.update(...)` | `ProfileDetail`; saving `patch.communicationSupport` affects future sessions by default |
| `POST /v1/profiles/profile-alex/communication-support/apply` | `clients.profile.applySupport(...)` | Paused `SessionSnapshot` with the saved preset applied |

Apply body (IDs/revisions come from the caregiver GET above):

```json
{
  "profileId": "profile-alex",
  "expectedProfileRevision": 2,
  "sessionId": "session-FICTIONAL",
  "expectedGeneration": 0,
  "commandId": "UNIQUE-COMMAND-ID"
}
```

Apply the **already-saved** preset; this body cannot select a second unsaved value. Check/reload current profile/session revisions on conflict. Save-only leaves current support and pending old-style work intact. A new session inherits the saved default. The caregiver read exposes both values so the UI can show a saved default differing from an active preset.

Save-only also preserves fixed guidance that is already synthesizing/playing while paused; explicit apply-now cancels that fixed authority. Apply now validates caregiver/profile/session before mutation, pauses with `config_change`, increments generation, cancels capture/pending/output work and clears dialogue/old reply authorization. It updates the session and activity presentation context together. Mic mute, avatar, privacy/policy revisions, contacts and voice remain separate. The endpoint receives the existing state/cancel wire events immediately, before waiting on database completion. No wire schema or new firmware command is needed.

Resume remains an explicit participant-side control using the new generation. It never opens capture automatically. Do not have the caregiver UI silently send Resume. Same-command retries while the same paused generation remains current return its current snapshot; changed commands, later generations, resumed/ended sessions or stale profile revisions return conflict. This prevents a late retry from pausing a continued session again. There are at most 50 support selections per session; start a new session after capacity is reached.

Context-changing profile saves fence Resume/new-session/capture while their transaction is pending; default-only support saves do not. A failed profile write is not assumed rolled back: its authorized current row is reloaded before continuation. If that outcome cannot be reconciled, continuation stays disabled until gateway restart after database recovery; Stop/help remain available. Confirmed rollback leaves the old profile and a paused session. Failed apply checkpoints remain explicit failures with interaction paused. Stop/help/mute remain independent of SQL/model completion, and a delayed apply cannot restore an ended session. Profile mutations, support-state reads and apply share a bounded queue of at most 32 pending operations; overflow is an explicit failure with no automatic retry. They are serialized inside the existing authority; no second session store is added.

## Storage and deployment integration

Run the existing explicit `bun run db:migrate` before starting this code. [003_communication_support.sql](../../db/migrations/003_communication_support.sql) adds only minimal configuration provenance: `profile_support_selections` for explicit caregiver saves and `session_support_selections` for default-at-start/apply context. Actor/time/config/source are stored server-side; actor identity is absent from participant profiles, device snapshots and model prompts. No historical selector is invented for existing defaults. Current profile storage is still the authority for the saved value. Session support context uses the existing bounded checkpoint pipeline and is not a durable transcript or new journal API.

`001_foundation.sql` and its permission-off CHECKs/checksum are unchanged. `002` is reserved for the independently reviewed media branch; `003` depends only on `001`, so this branch can be tested independently. After integrating the media branch, the normal runner applies/verifies all present migrations in name order. Configuration rows cascade with their profile/session. Full deletion APIs/backup erasure remain outside this slice.

Update the actual host proxy allowlist to match the new `communication-support(/apply)?` paths in [nginx template](../../deploy/nginx.conf.template); changing application code alone does not update a deployed Nginx configuration. Keep its 4 KiB body limit. No new environment variable, dependency or lockfile change is required for runtime. Keep the actual deployment checkout on `backend-deploy`; use an isolated worktree for verification and obtain substantive cancellation/privacy review before integrated deployment.

## Checks and handoff

Backend regression, Svelte/TypeScript and production build pass locally. The production data smoke now exercises caregiver support GET/save/apply/retry, private gate/device/GET denial, endpoint state, explicit Resume, stale retry and Stop through real PostgreSQL and built HTTPS routes. Its control socket and identity are computer fixtures. The existing production control/chat fixture smoke also passed. Final integrated regression: 143 tests / 3,318 expectations, Svelte/TypeScript, build and formatting passed. Earlier standalone checks passed without media migration 002; final integrated tests use all three present migrations and separate backend/support/media-test databases. See the build plan for the observed acceptance record.

For the SQL support/race tests use a **separate disposable** `LEMMI_SUPPORT_TEST_DATABASE_URL` ending `_support_test`, alongside the ordinary disposable `LEMMI_TEST_DATABASE_URL`; it truncates fictional profile data. Run `bun run test`, `check`, `build`, `format:check` and `smoke:data` using pinned Bun 1.4.4. The live text-only check is separately opt-in: `bun scripts/chat-quality-smoke.ts --live` (optional `--preset=quiet`), at most 15 calls, with a privately configured model/key. For GLM, the observed run used `LEMMI_LLM_MAX_TOKENS=512 LEMMI_LLM_REASONING_EFFORT=low`. It prints only fixture IDs/booleans/counts/timing. Do not treat it as comprehensive semantic or hardware acceptance.

Kylie owns the selector, sample labels, save/apply/conflict/pending states and browser authentication/UI. Shared `communicationSupportPreviews` are static same-topic samples and invoke no model/capture/playback. Lukas receives the current `ActivityContext.presentationPolicy`; style changes inside his remaining reducers/content still need his review. Emilia verifies actual prompt rendering, cancel/flush, local Stop and explicit continuation. Human microphone/speaker quality, German, actual K151, provider outages on the deployed host and counterpart review remain open; no physical robot or real notification was used here.
