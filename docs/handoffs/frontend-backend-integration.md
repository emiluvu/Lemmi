# Frontend/backend integration preparation — November 14, 2026

Branch: `integration/frontend-backend`. Worktree: `.worktrees/frontend-backend`.
This is local integration work; nothing was pushed or deployed by this pass.

## Sources and preservation

- Teach Lemmi and reviewed fictional Alex content: `codex/teach-lemmi` at `c006d26`.
- Existing UI history: `codex/kylie-ui-refinements` at `0fa00a7`, followed by a copy of the **22 local modified/untracked UI files** from `.worktrees/kylie-ui`, including fonts, surfaces, and current profile/conversation components. That source worktree remains uncommitted and untouched. The integration copy was saved at `2cd56f3` before combining browser support.
- Browser setup, cookie enrollment, audio adapter, scoped WSS and per-profile authority: Anay's published `anay/multi-profile-endpoints` at `284dcb7`.
- Firmware remains on `emilia/firmware-foundation` at `4e8993f`, with the original uncommitted firmware work preserved outside this worktree.

## What is connected locally

The copied caregiver dashboard, profile panel, imagery, fonts, temporary photo selection and conversation scene are retained. Alex's supplied fictional background is shown in the caregiver panel from `packages/activities/src/alex-profile.ts`, rather than an invented second biography fixture. Temporary biography edits do not update the live database. Supplied photographs/song bytes are not committed or uploaded; no media approval is inferred.

In mock mode, `/participant/conversation` keeps the designed scene and offers **Try Teach Lemmi**. Its explicit Start uses the original typed clients and shared mock coordinator. Gardening/Beaches/Banking, scripted replies, topic choices and safety controls use the teaching implementation. Closing via the demo exit flow requests Stop first; local interruption/disconnection also suppresses delayed replies. The existing public demo PIN is a presentation gate, not caregiver authentication.

In live mode, `/participant` uses Anay's `createParticipantSetup`, `ParticipantConnection` and `BrowserAudio`. It renders the assigned avatar, supports explicit text/speech controls, adds negotiated Teach Lemmi controls, and uses the backend's current snapshot/ownership. The local caregiver HTTP-RPC clients remain explicitly mock-only. They are not repurposed as live caregiver authentication.

Use Anay's published HTTPS flow: `/access` → fictional participant selection/enrollment at `/participant` → explicit Start. Cookies authorize setup and same-origin WSS; the browser receives no harness Bearer token or private access-key header. `/participant/conversation` is still a **local mock route**, not a newly exposed live route. Caregiver OIDC and live caregiver/dashboard APIs remain separate work.

## Merge decisions needing Anay's technical review

- Keep `SessionRegistry` and its scoped speech scheduler. Pass the existing fixed-reply state callback through each coordinator, preserving immediate paused-generation publication before concern/refusal synthesis. Existing urgent-output and Stop-during-synthesis tests pass in the combined tree.
- Sweep teaching deadlines for **every profile coordinator**, alongside speech deadlines; no singleton coordinator remains in the live gateway. A new gateway regression proves Alex teaching, an empty-context second profile, observer rejection, explicit owner handoff and active-time expiry stay isolated.
- Use one privacy/policy revision pair in the combined coordinator; retain teaching eligibility invalidation on profile updates and per-profile journal identity.
- Retain both schema increments unchanged: `002_media_collections.sql`, `002_multi_profile_endpoints.sql`, and `003_device_revocation_receipts.sql`. The existing runner orders and records **full filenames**, so the two 002 filenames are distinct. Do not rename or edit applied migrations. The collection migration test now expects the combined ledger and uses a valid isolated profile ID without weakening the new profile constraint.
- UI reply presentation rejects stale session/generation/turn/endpoint responses and ended sessions. Paused replies are limited to current fixed application guidance. Local Pause/Stop suppress output immediately; mic mute preserves unrelated approved playback.

No new public route, credential scope, external provider, database migration content or server deployment setting was invented during resolution. The API/status documents retain both branches' handoff records; historical deployed observations are not promoted to integration acceptance.

## Observed checks on this Mac

- Bun **1.4.4**, `bun install --frozen-lockfile`: passed; `bun.lock` unchanged.
- `bun run check`: passed, **0 Svelte errors / 0 warnings**.
- `bun run build`: passed.
- `bun run format:check`: passed after formatting the integration files and two copied asset README files.
- `TMPDIR=/private/tmp bun run test`: **154 passed, 20 skipped, 0 failed; 2,832 expectations**. Tests needed loopback-listener permission. The first unrestricted run exposed macOS's aliased temporary-directory path; using canonical `/private/tmp` fixed the environment without weakening private-media validation.
- Existing `scripts/smoke-web.ts`, copied to ignored `.data/integration-smoke-web.ts` with **only** its origin changed from 5173 to **5187**: passed against isolated mock gateway **3017**. Validates SvelteKit → coordinator → music request, preview denial, Pause and explicit live unavailability. Original script unchanged.
- `TMPDIR=/private/tmp bun run smoke:control`: passed against the production build with fixture identity, verified HTTPS/WSS, pairing, Start/Pause/Resume/revoke. No real provider/media/contact or running deployment used.
- Chrome inspection of the integration preview: copied dashboard and inert preview cards; Alex background/explicit temporary-draft label; conversation scene → Teach Lemmi → explicit Start → reviewed Gardening prompt → fictional roses answer/scripted follow-up → Pause (reply cleared and input disabled) → keyboard Resume → Not sure/Beaches → Stop/session ended. Camera/mic remained off. This is a mock text rehearsal, not live media acceptance.

## Next connection gate

Anay should review the merge decisions above, run the combined migrations and **all 20 skipped database checks on fresh isolated test databases**, then run `smoke:participant`, `smoke:data`, and the speech production smoke against this built tree. No PostgreSQL test service/configuration was available on this Mac. Combining individually tested branches does not establish combined database acceptance.

Then Anay can integrate the reviewed revision into the deployment branch and update the proxy/configuration using the existing handoff. No shared database/service changes were performed here. On the deployed build, verify `/access` → enroll Alex → text reply → Teach Lemmi → Pause/Stop/reconnect → profile isolation → browser/robot handoff. Actual browser microphone/speaker permissions, consumed playback, K151 local controls and deployment/network checks remain pending. Caregiver OIDC, full activities, journal/summary, real notifications, camera, durable preferences and deletion remain their owners' unfinished scope.
