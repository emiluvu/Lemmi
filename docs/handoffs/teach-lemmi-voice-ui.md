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
