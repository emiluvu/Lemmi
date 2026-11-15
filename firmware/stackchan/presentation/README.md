# Selected avatar and playback presentation foundation

Current integration: the separate [voice test](../lemmi_voice/README.md) uses
actual mic/PCM/speaker adapters and shared audio light policy. The installed
0.12 bounded TCP candidate passed a three-turn conversation/Pause/Resume/Stop
rehearsal; some playback buffering and longer reliability checks remain.
Selected-avatar/profile rendering and connected petting remain unintegrated;
preserve the accepted offline display. Earlier helper preparation notes below
are historical, not a live-avatar pass.

## Status lights — prepared, no upload

Follow-up: shared policy also supports yellow for an active camera, ahead of
audio/petting and below Stop. Feasibility 0.7 wires it to initialized current
local camera activity; request/starting remain off. Host priority/Stop and exact
yellow register tests pass. Physical yellow/expiry/Stop checks remain pending.
Emilia confirmed green mic, blue speaker and the local preview on 0.6.

`StatusLights.h` maps actual local microphone capture to green, actual Lemmi
speech playback to blue, petting hearts to the existing pink, and idle to off.
Stop overrides everything; capture/speech override pink. Capture defensively
wins if both audio inputs are reported; the coordinator must prevent overlap.
Unmute, capture permission, queued chunks and a server phase are not activity.

`BodyHardware::lights` writes all 12 LEDs without UART/servo initialization;
legacy `pink` callers remain supported. The offline display uses this policy
with capture/speech false, preserving the accepted 1.2-second pink behavior.
`AvatarPresentation::playbackActive()` exposes current actual playback even
with reduced motion and clears on buffering/completion/invalidation.

Live audio adapters remain pending: the serialized driver owner must supply
actual capture/playback state, refresh LEDs on driver transitions and petting
expiry, and clear activity/petting on Stop/pause/help/camera/disconnect/watchdog,
ownership or revision invalidation. No backend connection or upload occurred.

Observed: status-light priority, actual playback, static mode and stale-callback
ASan/UBSan tests pass, as do existing avatar tests and hardware-adapter tests
for exact green/blue/pink/off bytes with no servo traffic. Pinned display compile
passes (2,860,867 program bytes / 26,444 globals); presentation compile passes
(309,828 / 22,248). Physical green/blue and live transitions remain untested.

```sh
c++ -std=c++11 -Wall -Wextra -Werror -fsanitize=address,undefined firmware/stackchan/tests/status_lights.cpp -o /tmp/lemmi-status-lights-test
/tmp/lemmi-status-lights-test
```

Prepared November 14, 2026. `AvatarPresentation.h` is a firmware-only helper,
not a second session authority, audio executor or new network protocol. Current
installed `lemmi-avatars/0.1` is unchanged. The helper is not yet wired into it
or `lemmi_control` and no upload is needed for this preparation.

## Implemented and tested locally

- Stable dog/cat/bunny/bird/lemming mapping; missing/unknown identity remains
  explicitly unavailable rather than silently choosing another animal.
- Accept a previously validated profile choice with profile/privacy/policy and
  generation context. Revisions cannot go backwards through selection.
- `arm` returns a fresh local epoch only with caller-validated current scope,
  output ownership/permission, capture-off, and a supported selected avatar.
- Receiving metadata or queueing audio never opens the mouth. Only the future
  local speaker driver's actual consumption/start callback calls playbackStarted.
  Waiting/underflow closes it; completion invalidates callbacks. Static mode
  remains closed for every identity. Mouth movement is a visual cycle during
  real playback, not phoneme/word lip synchronization.
- Invalidate before Stop/Pause/Help/camera/disconnect/watchdog/owner loss or
  audio cleanup. Old callbacks cannot restart the mouth or end a newer stream.
  Changed scope clears identity until a fresh validated selection is supplied.

The helper requires ONE serialized owner. Network/audio/UI callbacks must be
marshaled to that owner; it is not thread safe. The adapter must independently
validate profile/session/lease/turn/stream IDs, sequence and current revisions,
enforce actual audio cancellation, and bound playback. These tests only prove
presentation policy, not credential validity, real audio or hardware stop timing.

Checks actually run:

```sh
c++ -std=c++11 -Wall -Wextra -Werror -fsanitize=address,undefined firmware/stackchan/tests/avatar_presentation.cpp -o /tmp/lemmi-avatar-presentation-test
/tmp/lemmi-avatar-presentation-test
python3 firmware/stackchan/tools/build.py --target presentation
```

ASan/UBSan cases pass: all identities, unknown/null choice, no animation before
actual playback, ownership/permission/capture exclusion, buffering, stale
callbacks, cancellation, all four scope revisions, static mode and clock rollover.
Pinned ESP32 compile-only probe passes: 309,780 program bytes / 22,248 static
globals. Probe startup execution is unobserved; no peripherals or upload target.

## Existing interface and owner handoff

Inspected fetched `origin/backend-deploy` at `2b833ef`; this is source evidence,
not a fresh live service test or a merge. Contracts/speech.ts and device.ts already
define speech. Contracts/common.ts defines AvatarId and ParticipantProfile.

**Selection path:** Kylie uses the existing authorized caregiver profile update
with `patch.avatarId` (revision/command checked); Anay persists it. The robot can
use the EXISTING paired-device `GET /v1/participant/profiles/:profileId` to obtain
safe `{id,preferredName,avatarId,revision,communicationSupport}` through the
existing Result envelope. Do not use demo profile listing or a caregiver token
on the robot. Keep the existing robot credential privately provisioned.

The current WSS device.ready/state.changed projection does not contain avatarId.
Firmware should fetch the scoped profile after authentication, compare its
revision against authoritative session profileRevision, and re-read after a
change/reconnect. Until matched, keep capture/playback off and show unavailable
selection. Fetch results must also be connection/local-epoch guarded; a late
read cannot restore deleted/revoked or obsolete state. No new URL/action/event
name is proposed here. Anay reviews read/revision consistency, deletion/revocation
and whether profile changes are pushed or observed through the existing state.

There is no reduced-motion field in the inspected ParticipantProfile projection.
Keep a local static control; Anay/Kylie must supply an agreed existing/new schema
if app-side reduced-motion sync is required. Do not infer a sixth avatar.

**Speech path:** retain protocol-v1 response.start/audio.chunk/audio.end/
response.cancel and device audio.receipt, bound to session/generation/turn/lease/
stream. Existing native output rates include 22050 Hz; chunkBytes for that rate
is 882 (floor(22050/50)*2), distinct from 640-byte microphone input. Maximum
output chunk payload is 1920 bytes, receipt window four chunks, maximum output
30 seconds. Do not keep the whole utterance in ESP RAM or count queued chunks as
played. Speaker-consumed receipts and actual isPlaying/driver completion need
hardware validation. Peer response.start/phase=speaking alone never animates.

Current gateway only enables output when hello negotiates supported input audio
AND playback, so do not advertise microphone/audio support merely to obtain
TTS before the bounded capture/playback/cancellation adapter exists. Keep
`lemmi-control/0.7` audio unsupported until that implementation is checked.

**Concurrent testing:** robot keeps stackchan-alex; browser/test tools must use
their separately enrolled endpoint, not its shared credential. Same-profile
output ownership still requires explicit handoff, authoritative pause then a
separate Resume. No new pairing/key rotation or extra functional profile is
required for this preparation.

## Next runnable integration

1. Firmware: bounded authenticated profile read with same TLS/time/CA validation,
   safe avatar/revision parsing, no body/credential logs and no durable cache.
2. Firmware: bounded actual PCM capture/output and receipts, sharing existing
   authority/grants and local cancellation; integrate the existing packetizer.
3. Wire this helper to the validated profile and actual speaker callbacks, and
   draw the tested 144×144 assets with Stop/mic/camera notices independent of art.
4. Hardware: app changes Alex's avatar → robot reconciles that same revision;
   real speech starts/mouth moves → Stop silences/closes immediately → delayed
   audio cannot restart it; repeat pause/owner/revision/disconnect/static checks.

These are pending work, not passed acceptance. Secure F13 remains ahead of
integrated F14; preserve the user-tested separate offline petting experiment.
