# Alex Photo Story album integration

## Alex saved-photo Photo Story deployed — November 15, 2026

**Web/gateway runtime `c44f092`**, integrating requested `978a0b6` and its
Start/Resume prerequisites into `backend-deploy`. Alex uses five existing saved
non-portrait caregiver photos/descriptions; no generic garden fallback for Alex.
Other fictional profiles keep neutral scenes. No migration, photo/context edit,
memory opt-in, credential replacement or speech-model change. Speech/tunnel
PID/start state retained; web/gateway active with zero automatic restarts after
coordinated rollout at **08:01:06 UTC**. Nginx validated and reloaded the narrow
UUID photo-asset rule. Existing profile/device/credential fingerprints preserved.

Substantive review fixed an actual stale-context bug: profile updates and lost
COMMIT reconciliation now pass through the registry, refreshing saved-photo
packs immediately. Real PostgreSQL regressions cover edits/removal, late model
suppression, stale profile/privacy/policy revisions, gateway-epoch replacement
and byte wiping after interrupted private reads. Browser review found no blocker.

Pinned frozen Bun1.4.4 install, type/Svelte zero errors/warnings, formatting and
whitespace passed. **450 tests /6,704 expectations**, zero failures/skips, using
five dedicated disposable PostgreSQL databases. Isolated production build and
HTTP/verified-TLS/WSS smoke passed against a sixth disposable database, including
real fixture PNG media and gate-only/noncurrent/ended denials. Initial smoke
still expected Alex's old garden fixture; corrected it to seed approved private
PNGs and the rerun passed. This was a test-harness assumption, not a restored
product fallback.

Actual public Chromium on an isolated fictional profile passed desktop/mobile
image containment, visible safety controls, keyboard focus, forced image failure
→Pause, image retry without capture/Resume, and Stop; zero runtime errors.
Capture/playback were disabled and fixed text used; no microphone, screenshots,
recorded audio, live model-quality or physical K151 acceptance is claimed.

Actual public Alex acceptance also passed: all five saved UUID PNGs loaded
with protected no-store/nosniff headers and valid PNG signatures; complete
navigation, Pause/Resume same picture/question, Stop denial and cross-profile
denial passed with capture off. No private bytes/descriptions were logged or
saved. Successful probes were cleaned. One earlier harness expected a JSON
credential instead of its HttpOnly cookie and left an unused enrollment; it was
uniquely identified by comparison with the predeployment device dump plus
profile/type/issuance-time guards, revoked and removed. Final existing
profile/device/credential fingerprints match the predeployment baseline.

**Stackchan diagnostics are off**, per user's request. All allowlisted evidence,
source/config backups and bounded socket records are saved; resume later via
[the preserved diagnostic handoff](stackchan-uplink-backend-investigation.md).
Only gateway restarted for disablement; subsequent web/gateway restart was the
Photo Story rollout. The robot itself remains stopped; its uplink failure is
unresolved. Protected deployment rollback pointer `.data/alex-photo-story-rollback-path`
contains previous source, private configuration/proxy/build and a database/media
backup refreshed with web/gateway writers stopped. Routine rollback must retain
current deletions/permissions/data; do not restore old DB/media indiscriminately.

Refresh/reconnect the participant browser, select Alex and explicitly Start.
Open Photo Story to use the saved album. Human microphone/speaker, spoken
acknowledgment/tone and hardware Stop acceptance remain pending. [Photo Story
handoff](alex-photo-story-pack.md).

## Original source handoff (before deployment)

Source candidate `codex/alex-photo-story-pack`, based on Anay’s completed Start/Resume branch at `5efffcf`. User explicitly authorized backend integration. This historical source handoff preceded the deployed acceptance above.

Alex’s saved caregiver context now supplies the photo album. Non-portrait image UUIDs and approved descriptions become the existing activity pack; portrait images are excluded. Removed/changed photos pause and invalidate pending output. Empty Alex albums disable Photo Story rather than showing garden fixtures. Other existing fictional demo profiles retain their neutral scenes. No migration, new session authority, public command or participant profile-context exposure.

The existing private image operation reads through DataRepository’s scoped transaction (profile/device locks, active gateway epoch, revisions, attachment, approval, media policy and bounded integrity-checked private read). It checks current session/generation/photo before and after reading. The web proxy requires PNG for UUID assets, limits bytes to5MiB, strips upstream headers and returns no-store/nosniff/CSP. Existing generic SVG handling is retained.

## Actual data update

Five photos saved and verified by reopening the hosted Alex caregiver editor: gardening, Alex at the beach, favorite beach, table with Barbara and relatives, Christmas family scene. Cooking and My Way excluded. Captions use filenames as approved fictional scene context; conflicting children’s names remain unnamed. Biography/interests updated from the supplied information. Bunny, Guided and summary-memory-off retained. User confirmed permission for hosted team-demo display. Original images/private upload copies are not in Git.

## Verification

- Focused tests:78 pass,0 fail,848 assertions across profile-photo-pack, photo-scene-http, multi-endpoint, photo-story-integration, speech-gateway, german-language-authority and browser-playback-window. Coverage includes no garden fallback, portrait exclusion, cross-profile denial, stale album/model cancellation, current-photo image access, protected PNG proxy/MIME/size, Start/Resume and Stop.
- Full local suite:395 pass,42 skip,4 fail. Two TLS tests need OpenSSL on PATH; private-media POSIX0600 assertion fails on Windows; VAD WASM dependency missing. PostgreSQL suites skipped without dedicated test database configuration. These are not accepted as passes.
- Frozen Bun1.4.4 dependency install fails SvelteKit lifecycle on this Windows machine. `check` could not find svelte-kit; build could not resolve fdir. Full type/build verification remains required on the deployment/review machine. No physical microphone/speaker/K151 or live LLM end-to-end acceptance claimed.

## Anay review and deployment

Review private-media transaction/revision fences and activity cancellation substantively before integration. Run frozen install, check, test and build on the backend environment, including dedicated PostgreSQL tests. Deploy web/gateway from the same reviewed revision and apply the `deploy/nginx.conf.template` UUID asset allowlist; validate `nginx -t` before reload. Preserve deployment checkout on backend-deploy. No database migration/configuration/credential change required. Record actual revisions in backend-status and backend_api after rollout.

Then refresh/reconnect Alex’s participant browser and explicitly Start. Open Photo Story: expect Alex gardening, no roses illustration. Advance through all five images; check aspect ratio and descriptions, respond and confirm acknowledgement/context, Pause/Resume same question, Stop while speaking, then verify other-profile credentials cannot read Alex’s UUID. Test photo removal/policy/revocation during a pending read/output using isolated fixtures. No photo bytes/descriptions in logs or journals. Capture/playback and human voice quality still require a real device pass.
