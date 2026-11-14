# backend-deploy merge verification

Reviewed remote `backend-deploy` at `51ede5e` against remote `main` at `53c7a5f`. Both refs were refreshed; the branch was pulled fast-forward-only into an isolated checkout. The shared developer checkout, its branch and its uncommitted work were preserved. This review used generated fictional fixtures; no production account, token, model request, device, private media or deployment restart was needed.

## Resolution

The initial dry-run merge found conflicts in `docs/anay_tasks.md`, `docs/build-and-demo-plan.md`, `docs/handoffs/anay-activity-contracts.md`, `docs/integration-contracts.md` and `packages/server/src/session-coordinator.ts`. Merge commit `98d476c` preserves the branch's implemented speech/profile/persistence code, retains the activity contracts already merged to main, and corrects the historical activity publication notes. No backend code was removed by the conflict resolution.

The review also reproduced a credential ownership bug: after a replacement gateway set a new database boot marker, an older authority could still consume a pending pairing and overwrite that marker in `claim`. The old process then authenticated its newly issued credential. Credential issuance now requires the existing row's boot marker to match; it cannot assign ownership itself. New pairing requests from a stale authority are also rejected. A database regression test proves rejection, preservation of the replacement boot marker, and successful pairing/authentication by the current owner. The original reproducer now reports all three unsafe outcomes false.

The Python boundary suite exposed a test race when uploading a known oversized body to a server that intentionally rejects its Content-Length and closes without reading it. The test now sends only the oversized declaration and checks the 400 response, preserving the size guard without racing a client BrokenPipe. No speech runtime/inference behavior changed.

The API inventory's planned-route table incorrectly listed already implemented Alex profile read/edit/photo upload and authorized asset bytes as unavailable. Those rows now distinguish existing A18/A19 routes from genuinely pending create/privacy/deletion/activity-playback work.

## Observed checks on the resolved tree

- Bun **1.4.4**, clean frozen-lockfile install; no dependencies or lockfile changes.
- `bun run check`: Svelte/TypeScript pass.
- `bun run test` with a fresh, dedicated native PostgreSQL **14.24** database: **91 passed, 0 failed, 833 expectations**, including the new stale-authority regression. Database has restrictive statement/parameter/error-detail logging and is stopped after verification.
- `python3 -m unittest discover -s services/local-speech -p 'test_*.py' -v`: **7 passed**, fixture inference worker only.
- `bun run build`, `bun run format:check`, and `git diff --check`: pass. The build and local-socket tests required sandbox escalation; permission errors were not counted as code defects.
- `bun scripts/smoke-control.ts --chat-fixture`: certificate-verified HTTPS/WSS gate/cookie, managed-identity fixtures, pairing, text generation fixture, cancellation/controls and revocation pass.
- `bun run smoke:data`: production SvelteKit → existing gateway → real PostgreSQL/private media with fixture identity passes; approved PNG upload/read, scope, revision/idempotency and revocation checked.
- `bun run smoke:web`: default loopback mock development path passes.
- Tracked-file checks found no actual `.env`, private-key files, database/model/virtualenv directories or large media files; inspected private-key/OpenRouter-key patterns had no matches. Built client inspection found no inspected server configuration secrets, credential storage or server modules.

The two first checks were accidentally overlapped with the initial merge dry run and saw conflict markers; those results were discarded. All results above refer to the resolved tree. The first production smokes were attempted before a successful production build; the sandbox-restricted build was rerun with the required permissions, and both smokes then passed against that build.

## Merge recommendation and remaining scope

The resolved branch is suitable to merge as the documented backend integration baseline once the pushed head is the reviewed tree and current main remains its ancestor. This is not full product or unattended-care acceptance.

Teammates should start with [backend API inventory](../backend_api.md), [deployment status](../backend-status.md), [host setup](../host-setup.md), [database setup](../../db/README.md) and the domain-specific handoffs. Browser application OIDC sign-in and participant transport, integrated mic/STT/chat/TTS/playback, completed activities, notifications/outbox, full journal/preferences/deletion, camera and physical K151 checks remain tracked work. The real-host/provider observations in the status document were not repeated during this local review; host DNS/reboot/venue behavior and actual firmware compatibility retain their documented limitations. Publishing these fixes does not restart the deployed host; its updater/restart remains an explicit operational step and revokes device credentials as documented.
