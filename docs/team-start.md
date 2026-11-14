# Lemmi — team start guide

Shared mock starter, November 13, 2026. This is the baseline for parallel development, not the completed product or a production deployment.

## Clone and run

Install Bun **1.4.4** using the [official installation instructions](https://bun.sh/docs/installation). No database, API account or real credentials are needed for the starter.

```sh
git clone https://github.com/emiluvu/Lemmi.git
cd Lemmi
bun install --frozen-lockfile
bun run dev
```

Open http://127.0.0.1:5173/. The launcher runs SvelteKit plus the mock gateway on 127.0.0.1:3001; Ctrl+C stops them. If either port is occupied, stop that process or coordinate a port change; do not kill unrelated work. The gateway and web server must both be running. Each teammate runs their own copy on their own machine.

Without global Bun, Node/npm users can prefix commands with `npx --yes bun@1.4.4`, for example `npx --yes bun@1.4.4 run dev`. The npm cache stores the runner; no global installation is required. Keep `bun.lock` and use Bun for dependency changes. Never commit node_modules, build outputs, .env files or credentials.

The `.env.example` lists optional mock settings. Defaults require no copy. If you change the local token/port, set the same values for web, gateway and fake device, preferably in a root `.env`. The fixed default token is a local development convention, not authentication for real data or devices. Use 127.0.0.1; LAN/tunnel/public access is intentionally unsupported.

## Check the shared path

```sh
bun run check
bun run test
bun run build
bun run format:check
```

With `bun run dev` running, open another terminal in the repo:

```sh
bun run fake-device
```

For a repeatable SvelteKit-to-gateway HTTP smoke check, run `bun run smoke:web` while the dev server runs and no mock session is open. It starts/stops a fictional session, validates preview rejection and never sends media or real notifications.

1. Open Participant and start Alex’s mock session.
2. Open the music example and request playback. It stays **requested** because no asset/executor/receipt exists. No sound is played.
3. Pause, explicitly resume to ready, and Stop. Unmute never activates capture.
4. Demo help creates a simulation only and pauses the session. Stop does not cancel that request.
5. Refresh the caregiver demo to see source-labeled in-memory events and clearly labeled preview-only cards.
6. Connect/disconnect the fake device; its snapshots refer to the same session as the browser. Disconnect pauses the mock session. It does not test actual K151 controls or audio.

`bun run dev:web` and `bun run dev:gateway` run the two processes separately. `bun run worker` prints an unimplemented-worker notice and exits; it sends nothing. Restarting the gateway resets all fictional sessions/events/simulations. No durable deletion/reset or notification guarantee exists.

A production *build* can be smoke-tested locally with `bun run start:gateway` and, separately, `HOST=127.0.0.1 PORT=3000 bun run start:web`; open http://127.0.0.1:3000/. This remains the same mock-only application, not a deployable care service.

## What exists and who extends it

| Path | Existing baseline | Owner’s next task |
| --- | --- | --- |
| `packages/contracts/src/` | Strict Zod schemas, inferred types, errors, profile/session/activity/device/check-in/preference/journal shapes; `operations`, typed clients and explicit HTTP/fixture transports | Anay maintains; counterparts agree missing fields/events before changing them |
| `packages/contracts/src/fixtures.ts` | Alex, two preview-only cards, music metadata, unavailable views plus separate state/screen/pause fixtures for all four activities, help/camera scenario snapshots | Each owner supplies domain examples; Anay integrates shared fixture/schema changes; see [A01–A04 handoff](handoffs/anay-activity-contracts.md) for exact fields and placeholder-only packs |
| `packages/activities/src/index.ts` | Pure music create/reduce/project/system-input example with filtering and interruption behavior | Lukas completes reviewed music content and all other reducers, signals and teaching prompts; no I/O/server inside games |
| `packages/server/src/session-coordinator.ts`, `mock-coordinator.ts` | One bounded in-memory session/activity authority; explicit mock wrapper and optional authenticated control-only mode | Anay adds persistence, speech and durable contact flow; see control handoff for pairing/auth limits |
| `apps/realtime/src/index.ts` | Loopback mock RPC and one validated fake-device WebSocket connection; disconnect/watchdog pauses | Anay with Emilia: real device pairing/TLS, grants, media/control bounds, camera access and session integration |
| `apps/web/src/` | Minimal participant/caregiver shells, clients, polling subscriptions and mock RPC proxy | Kylie owns UI outside `/v1`; Anay owns `/v1`, server access and auth. Evolve these files, do not create another app |
| `apps/worker/src/index.ts`, `db/README.md` | Explicit worker/database ownership placeholders | Anay implements PostgreSQL schema/outbox, worker and deletion/privacy behavior |
| `firmware/stackchan/README.md`, `scripts/fake-device.ts` | Hardware handoff notes and a mock transport client, no firmware | Emilia inventories toolchain, tests local controls and combined hardware, then agrees WSS/audio/camera protocol with Anay |
| `tests/` | Runtime boundary, retry/cancellation, scope, eligibility and actual HTTP/WebSocket integration tests | Owners extend relevant meaningful tests with each new seam |

SvelteKit is **3.2.0**, Svelte **5.57.3**, Vite **8.3.8**, Zod **4.6.7**, TypeScript **6.0.3**, Bun **1.4.4**. Exact versions live in manifests and `bun.lock`. Kit 3 configuration lives in `apps/web/vite.config.ts`; use `#lib/clients.ts`, `$app/tsconfig` and `@sveltejs/kit/hooks`. Do not scaffold a second project or copy older Kit configuration over these files.

## What is explicitly unfinished

- No K151 firmware, audio capture/playback, speech models, LLM integration, physical watchdog proof or real media assets. Play requests are not playback evidence.
- No caregiver sign-in, device pairing, WSS/TLS, production resource routes, external access, database/migrations, persistent summaries, retained excerpts or real notification provider/outbox. The mock caregiver page is never a security boundary.
- Guessing/photo/matching states and packs are placeholders, not finished game schemas. The teaching snapshot/command seam exists, but teaching execution is unavailable. Lukas/Anay must extend the discriminated schemas together. Shared contract additions are expected, not permission for a second session store.
- Camera is off; request/end adapters return UNAVAILABLE. Camera UI snapshots/header/control schemas are preliminary, not a working authorization/consent/relay. F13 hardware and access gate precedes F14 polish.
- Preferences load as empty with remembering off. Update/forget/signals, journal writes/summary edits and asset resolution return UNAVAILABLE. Policy retention, item retirement, source review, deletion and late-write races are not implemented.
- Subscriptions poll the one authority, with unsubscribe and no overlapping requests; production event streaming, full revision-conflict snapshots and complete server event vocabulary remain work for Anay. Fake-device wire traffic currently supports hello/heartbeat/basic controls/state, not audio/camera/teaching actions.
- The starter is limited to bounded in-memory history (100 sessions, 100 events/session, 256 command IDs), not production retention. No diagnostic/clinical or emergency claims follow from its tests.

For the current firmware/backend boundary and Anay’s next tasks, read the [device integration handoff](handoffs/anay-device-integration.md). It distinguishes compile-checked source from untested hardware and names the missing protocol exports.

The next backend increment is documented in [Anay’s authenticated control handoff](handoffs/anay-control-foundation.md): `clients.device.pair/claim/revoke`, explicit unsupported-audio hello, scoped control WebSockets and configurable managed-provider token verification. These are opt-in, require a trusted local TLS proxy/private configuration and do not expose the mock gateway. Default commands above remain mock-only. No actual provider/public host or K151 operation has been verified; media/contact and durable storage remain unavailable. `ServerEventSchema` now permits authenticated control-mode live snapshots/acks/heartbeat; this is narrower than the pending complete live protocol described above.

## Start each person’s Codex

Create a feature branch from updated main, for example `git switch -c emilia/stackchan-foundation` (use your own name/task). Keep one editing owner for root manifests, lockfile and shared contracts. Pull/rebase shared changes between slices. Do not commit real credentials, contacts or biography.

Use this prompt, replacing NAME:

> Read AGENTS.md, docs/team-start.md, docs/integration-contracts.md and NAME’s brief in docs/build-and-demo-plan.md. Inspect the existing scaffold and use the pinned Bun workspace. Work only in NAME’s assigned slice; preserve teammates’ changes. First run the existing checks and identify exact exports/schema changes needed. Reuse the clients, shared session authority and pure activity seam. Ask the owning teammate for missing shared interfaces instead of inventing another system. Implement the next small runnable increment, test it and report changed files, mock/live status, remaining limits and the next handoff.

Anay starts by reviewing/extending the existing backend baseline, not redoing scaffolding. Kylie can build views from typed fixtures immediately. Lukas can extend pure logic immediately. Emilia can begin hardware tests immediately; real device connection waits for agreed scoped WSS/audio contracts. Coordinate any contract change across all consumers before merging.

## Verification scope

Observed on this development Mac: dependency install with Bun lockfile, type/Svelte checks, contract/coordinator/HTTP/WebSocket tests and Bun adapter production build. The 23 automated tests and the end-to-end `smoke:web` path passed; these checks validate the mock subset only. Home and participant-shell rendering were inspected in Chrome; full interactive browser/accessibility/recovery checks and later feature/hardware results remain to be recorded when observed; no provider, hardware, clinical or full P0 acceptance is implied.
