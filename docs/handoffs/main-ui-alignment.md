# Main-based Kylie UI alignment

Review branch: `codex/main-ui-alignment`. Base: main `818b269`.
Visual reference: `codex/kylie-ui-refinements` at `d8a6fe4`.

Main already has the reference global stylesheet, bundled fonts, generic artwork,
folder dashboard, settings and Games components. Do not overwrite main with the
older UI branch: that would remove live setup, scoped WSS, teaching and browser
audio/cancellation fixes.

This branch updates only the two live presentation components:

- `LiveProfilePanel.svelte`: reference dialog header, sage portrait, five animal
  cards, basic-information area, paper/tape summary cards, empty trends area and
  supporting-file section. Name/avatar/support come from the existing participant-
  safe projection. Private biography, trends, excerpts, editing and uploading
  remain unavailable; no fixture data, privacy state or successful save is implied.
- `LiveParticipant.svelte`: reference 440px maximum avatar, meadow scene spacing,
  quieter connection area, large existing controls and responsive control bar.
  Heading reflects paused/ended states. Existing connection, enrollment, text,
  teaching, Stop/Pause/mute/handoff and audio handlers are retained.

The public caregiver page remains the fictional demo landing; this is not a
caregiver authentication implementation. The mock scene keeps its explicit mock
status and teaching demo; the live scene keeps its working controls. No new asset
URLs, proxy allowlist, dependencies, migrations or backend contracts are needed.

## Verification and review

Pinned frozen install, type/Svelte (zero errors/warnings), production build and
diff-whitespace checks passed. Existing automated suite: 183 pass, 33 database
skip, zero fail; 3,818 expectations. No isolated PostgreSQL configuration was
available for the skipped checks or production participant smoke.

Chrome visual QA used a temporary local fixture route, removed before final
checks. Inspected profile dialog/sections and disconnected conversation at desktop
and 390 × 844, including keyboard Escape dismissal. It made no real caregiver
requests and does not establish live audio/session or physical K151 acceptance.
Browser control subsequently failed with a ScreenCaptureKit capture-stream error.
The local mock preview uses web 5188 / gateway 3018; the earlier reference demo
is on 5187 / 3017. Mock preview routes do not display the live-only panel.

Before merging, Kylie reviews visual fidelity and Anay reviews that the existing
live setup/teaching/audio boundaries are preserved. Rehearse the live profile
open/close, explicit conversation Start, text, Teach Lemmi, Pause/Resume/Stop,
reconnect and endpoint handoff on a configured review host. Real browser speech
and K151 remain separate gates. Merge into main and deployment await user review.

## Integration/deployment follow-up — November 14, 2026

User explicitly requested merge into main and deployment. `a0a3797` was merged with the tested backend/Photo Story local-rehearsal source as web runtime `eab2c35`. Retained component controller/authorization behavior and empty/unavailable private-data states. Combined type/Svelte/build passed; updated profile bundle fetched over the actual public gate matched installed bytes, and caregiver/conversation/profile-list/root/private/local-only route checks passed. Only web restarted; gateway and current connections remained running. Published source to main and backend-deploy. The prior author Chrome fixture review remains distinct from deployment HTTP checks; no new actual browser audio or K151 acceptance was performed.
