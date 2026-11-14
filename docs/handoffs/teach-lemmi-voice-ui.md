# Teach Lemmi voice UI — November 14, 2026

User correction: teaching participation should be by voice, with no activity answer/topic/feedback buttons. This supersedes the button-based teaching choices in experience section 16 for this UI slice.

Implemented in the existing integration/frontend-backend checkout and live participant surface. TeachingChoices renders authoritative topicLabel/prompt and connection, pause, unavailable, mute, listening, processing and speaking states. Stale prompts are hidden while disconnected, paused or unavailable. No local topic selection or activity engine was added. The live teaching mode hides the text submission form. Start Teach Lemmi remains an entry control, gated by teaching/audio capability, endpoint ownership and ready/waiting phase. Speak now/Finish speaking and shared Pause/Stop/mute/help remain explicit microphone and safety controls. Capture never starts automatically.

Voice guidance advertises only implemented whole-turn Different topic/Not sure routes. Current backend lacks voice entry/finish teaching routing, and replacement-topic narration after a voice choice remains a Lukas/Anay handoff (see lukas-teach-lemmi.md). Shared Stop remains available. Do not claim completely hands-free operation or deployed acceptance. No backend/protocol/provider changes or deployment performed.

Observed: 20 teaching/browser-audio/presentation tests passed. Svelte/TypeScript check and production build passed after the UI changes. Browser visual/keyboard and real speech acceptance remain pending; no hardware or provider test performed.

Next handoff: Kylie reviews visual/accessibility fit; Lukas/Anay complete voice start/finish and narrated topic transitions, then deployment owner integrates and rehearses the real browser voice flow.

## Larger avatar and playback mouth — November 14

LiveParticipant and the dev-only teaching preview now show a 420px responsive
avatar. The five existing generated avatar strips supply closed/open mouth frames;
static profile artwork is unchanged. BrowserAudio exposes an optional local
playback callback computed from AudioContext playback time and scheduled buffer
spans. Receipt of text/output metadata alone never animates. Gaps, cancellation,
Stop, disconnect and completion close the mouth. Reduced motion holds a single
open frame during playback instead of cycling. No new wire contract.

Six browser-audio/presentation tests passed, including scheduled-but-not-started
output, playback gaps and immediate cancellation; type/Svelte check and production
build passed. Chrome inspection confirmed the larger closed-mouth preview.
Real speech synchronization and all five animated identities still need counterpart
visual review; deployment and hardware remain unchanged.

## Integrated Lukas logic — November 14

Merged origin/codex/teach-lemmi at 4690bf6 into integration/frontend-backend,
retaining the newer enrollment/session authority and designed app layout. The
previous "remaining voice continuity" notes above are superseded in this local
source by Lukas's silence endpoint, explicit question/listen opt-in, and fresh
teaching reply authority. Voice entry/finish utterances are still not advertised.

`VoiceTeaching.svelte` wraps Lukas's VoiceClient with the shared TeachingChoices
and large animated AvatarArt. `/participant/conversation` → Play Teach Lemmi
opens it; `/participant/voice` renders the same component. Start Teach Lemmi
connects and sequences session start before teaching start using current snapshots.
The current model reply replaces the invitation text. No topic/feedback buttons
or teaching text form remain on these voice surfaces. Safety and explicit
microphone controls remain. Caregiver exit waits for server-confirmed Stop;
unmount/background closes local media. VoiceClient's playing state now follows
scheduled local playback spans rather than the end of the first consumed frame,
so the mouth stays closed during buffering and closes immediately on Stop.

The dev-only Vite voice proxy and private configuration from Lukas's branch are
preserved. This is a local voice demo against an explicitly configured backend,
not a new production credential mechanism. The existing enrolled /participant
live surface remains available; no auth or deployment configuration was replaced.
No private access bundle was loaded or credential reused in this integration pass.

Observed: type/Svelte check and production build passed. Full suite with local
socket permission and canonical TMPDIR: 181 passed, 20 database-dependent skipped,
0 failures (before the additional focused avatar test). Browser inspection confirmed
conversation entry → large-avatar teaching panel and the explicit disabled Start
state when this server has no private voice configuration. No real capture/model
rehearsal, backend deployment, database acceptance or hardware check was performed.
Anay reviews the new speech authority boundary before deployment; Kylie reviews
visual/keyboard flow. Configure a separately assigned Alex demo endpoint privately
before real voice rehearsal; do not share the robot's active credential.

## Live handshake compatibility and blocked rehearsal — November 14

User reported “Invalid audio or backend message.” A microphone-off probe through
the configured local voice proxy reproduced rejection of device.ready: the
backend includes optional boolean photoStory, absent from this checkout's strict
schema. Added that exact optional boolean; unknown fields and wrong types remain
rejected. The live ready/ack/snapshot handshake then validated successfully.
No session start, capture, speech or model request was sent by these probes.

A separate live blocker was observed immediately after handshake: WebSocket
close 1011, exact allowlisted reason “Persistent data unavailable.” VoiceClient
now explains backend storage unavailability rather than only a close number.
Deployment owner must investigate persistence/checkpoint failure; no host/database
restart, migration or credential change was attempted. No real voice acceptance
is implied. Fourteen voice-client tests passed, including deployed capability
validation and storage failure without reconnect/capture; type/Svelte and build
passed. Local server restarted with forced dependency refresh for retest after
backend recovery. Existing Alex credential was used only after user explicitly
confirmed Stackchan disconnected and authorized temporary reuse; only its path
is in ignored local configuration.
