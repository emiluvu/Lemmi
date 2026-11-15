# Photo Story Start/Resume — deploy-agent handoff

November 14, 2026. Branch: `codex/photo-story-start-resume`.
Updated against `origin/main` **f3e3b41**, retaining the original Photo Story work
from **38ca3c7**. Source candidate only: **no server deployment was performed**.
The requested endpoint is a pushed branch plus this review/deployment handoff.

## Result and preserved behavior

- New WSS `input.start` sessions produce one reviewed greeting/opening. Explicit
  `input.resume` produces one reorientation, preserving the current photo and its
  last question, or the current open-conversation/teaching prompt. Neither asks
  the model to reconstruct canceled output or advances the scene/topic.
- The gateway enters prompt processing before publishing the Start/Resume
  acknowledgment/state. The current browser explicitly waits for opening output
  to finish, its consumed playback receipt and current waiting authority before
  unmuting/requesting a **fresh** capture grant. Conversational/Guided retain
  main's subsequent listening behavior. Quiet stays capture-off after the
  greeting/reorientation; explicit Start listening can request an individual turn.
  Raw Start/Resume, plain Unmute and robot clients never gain capture by themselves.
- Start/Resume wording and output language follow the server-resolved `en`/`de`
  profile. German retains exact-ID configuration, strict language authority,
  unavailable teaching/photo activities, and its existing STT/TTS selection;
  there is no English voice fallback. German Resume repeats a German conversation
  reminder with a German prefix.
- Missing adapters, absent negotiated playback, or a current failed/throwing TTS
  adapter return the approved prompt as `response.text`. This covers session
  Start/Resume and the direct Photo Story introduction. Text fallback leaves
  capture off in waiting; an opted-in browser listening attempt ends without
  requesting the microphone. It does not claim audio played or retry a provider.
  This change does not add a general fallback for every model-generated turn.
- Stop/Pause/disconnect/handoff/configuration or privacy changes invalidate pending
  output. Late synthesis success/failure cannot publish text/audio, reopen capture,
  restore a deleted context or change an ended session. Late PCM is wiped.
- Main's robot/browser **12-frame** negotiation, omitted/explicit **4-frame**
  fallback, consumed-only credit, short-tail completion and Stop cancellation
  remain. Tests retain captured, typed and approved-output paths, and add explicit
  greeting credit/Stop coverage. No firmware changes were made.
- The earlier branch's avatar beside the picture, reserved caption/image space,
  scoped no-store image reads, one HTTP 409 retry and bounded failure/retry behavior
  remain. Picture retry never resumes conversation or capture.

Reminders are bounded transient output, bound to the current photo instance/asset
where relevant. Participant Pause/Resume and mic mute preserve them; Stop,
disconnect, handoff, activity replacement and context/privacy/policy changes clear
them. They are excluded from checkpoints, journals and memory summaries. Main's
background memory work, consent/deletion fences and Jev activity-only routing
remain integrated.

## Interfaces and deployment scope

No new public route, WSS schema, dependency, lockfile, database migration or
configuration change relative to `f3e3b41`. The behavior of existing Start/Resume
commands changes: clients must finish/cancel their opening output before capture
or another turn. Clients without playback receive current fixed text and waiting
state. The existing approved-output ceiling is 600 characters. Long repeat prefixes
are omitted rather than truncating the retained bounded reply.

Changed runtime boundaries: coordinator and shared speech queue; realtime WSS
Start/Resume/photo dispatch; browser listening orchestration and participant/photo
presentation. Deploy **web and gateway together** after review. This increment does
not require speech-engine restart, model download, firmware flashing, proxy changes,
profile backfill, credential rotation or database seeding/reset.

## Observed local checks

Pinned Bun **1.4.4**, `bun install --frozen-lockfile` passed; lockfile unchanged.

- `bun run test`: **435 passed, zero failed/skipped, 6,607 expectations**, 55 files.
  Five fresh isolated PostgreSQL 14.24 databases used the repository's required
  private logging settings; the test cluster was stopped afterward. Coverage
  includes database/revocation/deletion races, German authority and failed-TTS
  cancellation, Photo Story/Resume continuity, opening-before-capture, Quiet,
  text-only recovery and all current Stackchan output-credit regressions.
- `bun run check`: Svelte/TypeScript passed.
- `bun run build`: production build passed.
- `bun run format:check` and `git diff --check`: passed.
- `python3 -m unittest discover -s services/local-speech -p 'test*.py'`:
  **15 passed**, using explicit fake engines/provisioning fixtures.
- `bun run smoke:participant`: passed against the production build and a separate
  disposable PostgreSQL cluster, actual HTTP and certificate-verified TLS/WSS.
  Covers profile/enrollment/entry/exit, simultaneous scoped robot/browser chat,
  restart/release, protected current-scene reads and Photo Story opening/Stop.
  The smoke now correlates the new opening replies before testing later turns.

Initial sandbox runs could not bind sockets or complete build-worker output;
allowed reruns passed. Earlier merge-test failures exposed outdated no-output
Start fixtures and were fixed before the clean results above. No existing service,
private configuration, deployed profile, credential or database was changed.

Local logs are under `/tmp/lemmi-photo-verify-h_nieyw4/`,
`/tmp/lemmi-photo-smoke-nl6076sb/`, and `/tmp/lemmi-photo-{check,build,format,python}.log`.
These paths are local evidence, not server prerequisites.

## Server deploy-agent checklist

1. Fetch `origin/codex/photo-story-start-resume`, inspect the final pushed commit,
   and verify main `f3e3b41` is an ancestor. If server/main advanced, integrate the
   additional commits without dropping newer German, memory, Jev or Stackchan work,
   and rerun the combined gate. Do not replace the running tree blindly.
2. Review the coordinator/reminder/fallback cancellation boundary (Anay), scene and
   question continuity (Lukas), browser listening/layout/keyboard behavior (Kylie),
   and output/local-control boundary (Emilia). The local software checks do not
   substitute for this counterpart review.
3. Before deployment, retain the current protected source/build/private-config and
   paired database/private-media rollback procedure from the backend deploy guide.
   Preserve current Tilda mapping/voice, Jev scope, memory consent, profile data and
   enrolled endpoint credentials. This increment needs no new migration; do not
   bootstrap/reset/reseed or run test databases against the live database.
4. In an isolated checkout with Bun 1.4.4, run frozen install, `check`, `test`,
   `build`, `format:check`, the Python fixtures above and `smoke:participant`.
   For full database tests, use separate disposable `_test`, `_support_test`,
   `_demo_test`, `_schema_test` and endpoint `_test` databases via the existing
   `LEMMI_*_TEST_DATABASE_URL` variables, with private PostgreSQL logging settings.
   `smoke:participant` truncates its selected test database; give it a separate
   disposable `_test` database. It uses fixture model/clients.
5. After authorized coordinated web/gateway rollout, use a separate fictional
   profile/enrollment: Start → hear/read Lemmi first → fresh listening only after
   consumed output; start Photo Story → caption/optional question with picture and
   avatar; answer → Pause → silence; Resume → same picture/question; Stop during
   delayed opening/Resume synthesis → no late output. Repeat Quiet, Type instead,
   microphone denied, playback unavailable and failed/throttled image loading.
   Text-only Resume must work while keeping capture off. Retry picture alone must
   not speak/capture. Reconnect/reload must not restore listening intent.
6. Rehearse German Start/Resume and a German conversation reminder on the configured
   pilot; verify no English prompt/voice or newly enabled German games. Verify the
   English Jev request/confirmation path and opt-in memory still work. On a separate
   robot enrollment, repeat ready12 → initial12 → consumed2 →14 →Stop/late-receipt
   denial and omitted/explicit4 fallback. Emilia verifies actual device queue flush,
   short replies, mute/Stop/watchdog and audible playback on hardware.
7. Record deployed revisions, actual acceptance and rollback evidence in backend
   status/build plan. If a gate fails, restore the coordinated previous web/gateway
   builds and report the failed gate; preserve existing database/configuration.

No live provider, real microphone/speaker, current visual/keyboard/zoom, public
network or physical K151 test was performed in this follow-up. Earlier commit
38ca3c7 recorded mobile/desktop fictional-image visual checks; those are historical,
not a new acceptance of the merged listening flow. No universal latency, deletion,
clinical or independent-use claim follows from the automated checks.
