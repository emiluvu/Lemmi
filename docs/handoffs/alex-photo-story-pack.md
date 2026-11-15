# Alex Photo Story album integration

Source candidate `codex/alex-photo-story-pack`, based on Anay’s completed Start/Resume branch at `5efffcf`. User explicitly authorized backend integration. Not deployed.

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
