# Tilda German release candidate

Based on `codex/tilda-german-handoff` / `79051d9`. Implementation branch:
`codex/tilda-german-integration`. This is an undeployed browser/backend candidate.
No shared profile, endpoint, database, credential or service was changed.

## Configuration and contracts

`LEMMI_GERMAN_PROFILE_IDS` is a server-only comma-separated allowlist of exact
created profile IDs. Empty means English. Set the same value in the private web
and gateway environment. Do not put names in it or assume a Tilda ID. Startup
validates IDs; changes require a restart, which ends current sessions. No database
migration, language auto-detection or client language selector is added.

Authorized participant profiles and `device.ready.payload` now include
`language: 'en' | 'de'`, with an English compatibility default. Text and capture
must match the authority's resolved language. The browser recovers it from setup
and ready messages. Existing generation/profile/privacy/lease checks continue to
invalidate delayed work. German teaching and activities are unavailable; attempts
receive a German explanation instead of starting an English activity.

Ordinary German speech uses the existing multilingual Whisper model and the
configured German Piper voice. Missing German TTS remains unavailable, with no
English voice substitution. `prepare_models.py --german` provisions a pinned
`de_DE-thorsten-medium` **candidate** for listening review and never enables it or
overwrites private configuration. See the speech README for attribution and paths.

## Deployment owner steps

1. Keep the lab checkout on `backend-deploy`; stage/review this candidate there
   without replacing uncommitted work or applying a database reset/bootstrap.
2. Record nonsecret running revisions, actual model ID, multilingual STT selection,
   private speech health, and gateway/wrapper STT/TTS worker counts. Retain private
   source/build/config/database backups using the existing release procedure.
3. Create fictional Tilda through authorized `/v1/demo/profiles` (or the caregiver
   setup), retain the returned stable ID privately, and explicitly enroll her
   browser endpoint. Her context starts empty; no Alex biography or permissions
   are copied. Use a separate browser context for Alex.
4. Provision the pinned German candidate with
   `python3 services/local-speech/prepare_models.py --german`. Review its model
   card and adult tone by listening before selection. Then configure private
   `LEMMI_SPEECH_VOICE_DE` to the provisioned ONNX file, retaining English. Do not
   download weights during a request. Verify private health advertises ready
   German and English TTS workers and that worker counts match the gateway.
5. Set `LEMMI_GERMAN_PROFILE_IDS` to Tilda's returned ID in both web and gateway,
   run pinned Bun frozen install/check/test/build and Python speech tests, then
   stage/restart the services through the existing release procedure. No proxy
   route or migration is introduced by this candidate.
6. Verify concurrent Tilda German / Alex English, reload/reconnect isolation,
   mismatched language rejection, unavailable activities, actual German text,
   and real microphone → STT → configured model → German TTS. Review umlauts,
   pauses, ordinary room noise and the fixed/control/error wording with a fluent
   German speaker. Do not retain microphone audio, transcripts or dialogue logs.
   For a synthetic, local-engine-only preliminary check, load the existing private
   speech configuration and run `bun scripts/speech-smoke.ts --german`. It checks
   advertised German readiness and a fixed TTS→STT phrase in memory, logs only
   timings/format, and cannot satisfy the human microphone/speaker/model gate.
7. Exercise Stop during recognition/model/synthesis, Pause/disconnect/handoff,
   mute/unmute and Quiet. Record human browser and K151 results separately.
   German voice quality, human speech and hardware remain unaccepted until run.

Rollback source/build/config together using the private release backup; remove
the German ID mapping if disabling the pilot, and end existing sessions. Preserve
Tilda's created profile/enrollment and all existing data/keys; do not reseed.

## Local evidence and remaining gates

The development machine could not resolve `mobrob-Precision-3680` with either
normal or escalated batch SSH. Running configuration, Tilda creation/enrollment,
real provider German output, live speech health, model downloads/listening and
deployment were therefore not exercised. Docker/PostgreSQL are unavailable in
this WSL environment; database cases must run on the staging host. Automated
fixture speech and playback receipts do not establish human audio acceptance.
Final local command results are recorded in the build plan.


## Backend integration follow-up

[Combined release review and acceptance](profile-german-backend-integration.md) preserves the latest one-action microphone continuation and caregiver preselection. German ordinary chat bypasses unsupported activity classification, retains grounded warm replies, and rejects fabricated German contact claims. Existing fictional Tilda is reused by exact ID. Pinned German assets and local-engine/model probes are verified; human/fluent-speaker voice acceptance remains pending. Runtime/health/public checks are recorded in backend status/API; source branches preserved.
