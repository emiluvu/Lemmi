# Stackchan → Lemmi integration audit

Inspected Emilia's `emilia/firmware-foundation` at `e4c4cb6` and freshly fetched
`origin/backend-deploy` at `9257de1`. These are different source branches;
backend-source inspection is not a new live-service or hardware acceptance test.
Emilia now authorizes resuming hardware/application integration. Preserve accepted
offline tests and the earlier stop on servo investigation.

## Existing pieces

| Piece | Implemented / observed | Missing application integration |
| --- | --- | --- |
| Wi-Fi + WSS | `lemmi_control` 0.9, TLS validation, private RAM provisioning, scoped Alex endpoint, heartbeat/watchdog, local Stop latch. Earlier hardware receipts cover connection and controls; 0.9 has ready/Start receipts. | Reconnect against the current deployment and repeat controls; no new credential/pairing is inherently needed. |
| Mic | `lemmi_feasibility`: actual 16 kHz mono capture/level display, local mute/Stop; green light observed. `audio/PcmPacketizer.h`: bounded 640-byte framing and cancellation. | Current-grant capture, base64 `audio.chunk`, explicit end, bounded sending/backpressure, and STT round trip. |
| Speaker | Feasibility tone audible, early Stop observed; blue/off accepted on 0.8. | Actual PCM speech playback, rate negotiation, bounded buffers, consumed-chunk receipts and interruption. The tone-test blue deadline is not a playback receipt. |
| Camera | Local Allow, correct 160×120 RGB565 preview, expiry and Stop; yellow/off observed. Application SCCB adapter avoids a second sensor bus. | JPEG negotiation/conversion or an agreed contract change; authenticated request/consent/relay/viewer, revisions, deadlines and disconnect behavior. |
| Petting + avatar | `lemmi_display` 0.7: top-strip hearts and 1.2-second pink lights accepted; all five avatar assets available. | Integrate with connected control priorities after secure camera gate; suppress reactions during camera/help/stopping. |
| Presentation | `AvatarPresentation.h`, `StatusLights.h`, `BodyHardware.h` provide reusable helpers. | Scoped profile/avatar read and revision reconciliation; drive mouth/blue from actual playback and green from actual capture. Preserve text controls and local static setting. |

The connected target intentionally sends `audio: {supported:false}`,
`cameraSupported:false` and `pettingSupported:false`. Its parser rejects a capture
grant to itself and does not support speech output events. Combining the sketches
requires a bounded peripheral/transport adapter, not changing capability flags.

## Backend boundary confirmed from current source

- Speech is implemented in shared `speech.ts`, `device.ts` and realtime
  `control.ts`: `input.speak`, capture grants, input `audio.chunk`/`audio.end`,
  output `response.start`/`audio.chunk`/`audio.end`/`response.cancel`, and device
  `audio.receipt`. Reuse the same authority and assigned `stackchan-alex` endpoint.
- Input is 16 kHz mono PCM s16le, 20 ms / 640-byte frames, base64 JSON,
  bounded to 20 seconds. Output negotiates sample rates; robot output window is
  four chunks. A native 22,050 Hz frame is 882 bytes, not 640. Whole-utterance
  buffering and acknowledgments of merely queued chunks are unsuitable.
- Camera remains unavailable: `device.ready.camera` is literally false in the
  schema and gateway. There are no server `camera.request/start/end` variants in
  `ServerEventSchema`. Incoming preliminary camera shapes do not supply a relay.
  Anay owns the missing contracts/access/authority/relay; Kylie owns the viewer.
- The local checkout's app/server is older than the inspected backend branch.
  Do not run that mock gateway and assume it represents the deployed speech path.

## Execution order and handoffs

Confirmed by Emilia during integration: the final connected surface should reuse
the existing little-avatar UI with local petting and backend conversation/control.
Only activities that do not require an image belong on Stackchan's small screen.
Photo talk, matching and picture-dependent guessing/teaching require a companion
screen. Music and reviewed picture-free content remain candidates, subject to
actual audio/control support. Do not remove those image activities from the app
or duplicate their rules in firmware. See integration-contracts section 6.

1. Re-establish the preserved control target on the current service; verify
   Start/Pause/Resume/Stop, Unmute staying capture-off, disconnect and ownership.
   Reuse private provisioning; never print the credential file. Keep browser and
   robot endpoint identities separate.
2. Camera first: Anay supplies validated request/start/end, consent binding,
   scoped relay and fixtures; Emilia adds the local request/Allow/decline and
   bounded camera adapter using the existing bus driver. Resolve RGB565 versus
   JPEG with measured frames before advertising support. Require paused audio,
   visible notice, local Stop/deadline and no reopening after reconnect.
3. In parallel with the backend camera work, Emilia can implement/test bounded
   speech adapters against the existing speech protocol: independent input/output
   validity, actual consumed playback receipts, local cancellation and no backlog.
   Stop, Pause, owner/revision changes and disconnect invalidate work; mic mute
   cancels its input turn without stopping unrelated approved playback.
4. After the camera gate, compose the accepted avatar/petting/lights into that
   connected target. Fetch only the participant-safe profile; reconcile revisions.
   Keep motion disabled. A single firmware must own peripheral transitions and
   marshalled callbacks; preserve the separate working offline targets.
5. Hardware acceptance: real speech round trip; Stop during capture/playback;
   delayed output rejection; camera→Stop→explicit Resume→audio; stale consent,
   expiry/revocation/disconnect; browser/robot handoff; sustained TLS/peripheral
   load, memory and physical control responsiveness. Record observed results in
   the build plan. None of these was newly run in this audit.

## Checks run for this audit

- Current firmware fixtures/hello/handoff validated against freshly fetched
  backend runtime schemas: PASS (`check_backend_contract.cjs`).
- Provisioning/privacy helper unit checks: 12 PASS.
- PCM packetizer and control-policy host checks with ASan/UBSan: PASS.
- No firmware upload, serial access, microphone capture, camera stream, live
  session mutation, credential rotation or merge performed. The existing
  untracked deployed-acceptance handoff was preserved.
