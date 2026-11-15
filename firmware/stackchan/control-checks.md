# Authenticated control firmware — first increment

### Observed control 0.9 Start — November 15, 00:00:43 UTC

Emilia's fixed-status receipt shows ack applied=1, state phase=ready stopped=0,
and owner local=1 after explicit Start. Initial ended snapshot reported local=0;
the new active session is owned by Stackchan. Capture/camera remained off.
Connection remained present from ready at 00:00:01 through Start at 00:00:43.
Pause/Resume/Stop on 0.9 and sustained transport remain pending; no voice/media
acceptance. Next: local Pause while the same observer remains open.


### Observed control 0.9 connection — November 15, 00:00:01 UTC

Emilia reports upload PASS, then same-credential RAM provisioning and local
Connect. Fixed statuses: control_ready, control_ack applied=1, and control_state
phase=ended stopped=1; capture/camera off throughout. Ready compatibility is
hardware-observed. This establishes connection and safe stopped synchronization,
not sustained transport, Start/control acceptance on 0.9, voice or camera.
Next: explicit local Start with the same bounded observer open.


## Control 0.9 continuation — November 14, 23:56 UTC rejection

Emilia reports 0.8 upload PASS; local manifest confirms all four image hashes
and the uploaded application matches the prepared 0.8 build. New Connect still
rejected ready_fields after WSS 101, ready=0, capture/camera off.
Fetched backend-deploy advanced from 2b833ef to 01b6ffb: ready now also emits
optional boolean photoStory (false for robot). This is a second reproduced
source mismatch consistent with the live rejection; no raw live payload read.
Control 0.9 accepts only that boolean metadata; no photo execution or media
permission added. Both teaching/photoStory absent/false/true accepted;
malformed, duplicate and unknown keys rejected transactionally in real-cJSON
ASan/UBSan tests. Fixture/hello/handoff validate against fetched shared schemas.
Pinned compile passed: 1,346,047 program bytes / 53,060 static globals.
Backup/four-image/esptool upload dry-run, 12 helper/privacy tests and whitespace
check passed. No agent serial access. Hardware upload/Connect pending.


## Latest continuation — control 0.8 teaching-capability compatibility

November 14 23:41:20 UTC, after restoring/hash-verifying control 0.7, an observed
new boot/self-check and private RAM provisioning: WSS upgraded 101, then firmware
rejected stage=ready_fields (no application ready). Camera/capture stayed off.
Do not treat this as an invalid credential, DNS failure or a completed connection.

Fetched backend ref `2b833ef` has deployed teaching support: device.ready includes
optional boolean `teaching`, emitted as true by the gateway. Firmware 0.7's strict
ready key list lacks that field. This is a reproduced source/fixture mismatch
consistent with ready_fields; no raw live ready payload was captured.

Control 0.8 accepts only that known optional boolean, without teaching execution,
media negotiation or new commands. Missing/false are valid; string/null/number,
duplicate keys and unknown fields fail closed without mutating the safe mirror.
Ownership/binding/expiry/Stop/TLS/media checks remain intact. Updated synthetic
boot self-check and host real-cJSON tests; exact fetched shared schemas accept
the fixture. All 12 Python helper/privacy checks pass. No credentials changed,
no new claim, no backend/shared-contract edit. Compile/upload results follow
when observed; 0.8 hardware acceptance remains pending.

0.8 pinned compile passed: 1,346,007 program bytes / 53,060 static globals.
Private backup/four-image/build-target/esptool upload dry-run passed without
serial access. Diff whitespace check passed. No 0.8 upload or new live Connect
performed by the agent. Next stop the open helper, upload control, privately
reprovision the same credential, and Connect once with the helper observing.

`lemmi_control/` now has **0.7 diagnostic source/build**, compared with fetched
`origin/backend-deploy` **7debf9a** (documented runtime **17a8522**). Last
upload is **0.6** (ready accepted, connection then exits). The latest source has not yet been
uploaded/tested on the robot. Earlier sections below retain historical evidence;
use this checkpoint and the final 0.6 section for current procedure/status.

Current private provisioning uses `--credential-file data/stackchan-access.json`,
then an explicit local Connect. No new pairing code is needed. Camera, mic,
speaker, petting and motion stay disabled. The target remains bound to the
existing Alex/stackchan-alex credential; new-profile enrollment files/device IDs
are not supported by this target yet. Backend media being enabled does not
negotiate audio for this hello (`audio:{supported:false}`, no playback field).

## Implemented path

- Explicit local RAM provisioning via USB, then **PAIR + CONNECT Alex** on-screen.
  USB provisioning alone does not initialize Wi-Fi, make a claim or start a session.
- Fixed selected origin `https://lemmi.chaoswarrior.dev`; HTTPS claim at
  `/v1/device-pairings/claim`, WSS `/v1/device-stream`, with `X-Lemmi-Access-Key`.
  WSS also carries the scoped Bearer device credential. No URL secrets, provider
  keys, caregiver token, anonymous stream or loopback mock token is used.
- Existing pinned SDK TLS/WS/cJSON, WiFi and M5Unified; no library installation.
  Full pinned SDK CA bundle, ordinary hostname/SNI verification and validity time
  checks. UTC is provisioned from the local Mac, with TZ fixed to UTC. No insecure
  certificate mode, IP workaround or time-check bypass is present.
- Wi-Fi persistence and automatic reconnect are disabled. Credentials/config stay
  in application RAM; no preferences/filesystem credential storage is added.
  Reboot loses enrollment. Gateway restart/revocation/expiry requires fresh pairing.
- Hello declares audio unsupported, camera false and petting false for this target.
  It requires live `device.ready` with the assigned fictional Alex IDs, audio=false,
  camera=false and recognized controls, then a current state snapshot. Neither
  hello nor reconnect sends Start/Resume. Any capture grant is rejected.
- Explicit Start, Pause/Resume, microphone setting, Stop and Get help controls.
  Local Stop stays latched across server snapshots/acks; Unmute never captures.
  This build initializes no mic, speaker, camera, servo/body, petting, RGB or NFC.
  Get help currently receives backend UNAVAILABLE; no notification was sent.
- One four-entry command queue with session/generation and local epoch checks.
  Stop flushes queued work and has an independent priority flag. If a previously
  sent Start creates a session after Stop, its snapshot is reconciled and a Stop
  is sent for that current session. Only matching command errors can reject that
  pending Start/Stop. Revision retries are bounded; unrelated late errors cannot
  erase the intent. Transport delivery failure is never reported as server success.
- About two-second client heartbeats, six-second JSON-heartbeat watchdog, 4 KiB
  server message bound, 24-level JSON nesting bound and one-second partial-message
  deadline between successful reads. Unsupported fragments/media fail closed.
- Network/claim/TLS work runs in a dedicated task. UI Stop applies local restrictions
  before network acknowledgments; connect cancellation is checked after blocking
  SDK calls. Wi-Fi association is bounded to 15 seconds; claim I/O timeout is 3
  seconds, TLS/upgrade timeout 4 seconds, socket reads 100 ms and writes 250 ms.
  These SDK timeout settings are not measured worst-case wall/Stop latency.

## Scope and deliberate limits

This mirrors participant-safe fields; it is not a second session authority. The
consumer checks critical bindings, mode, generations, sequence, format/capture
restrictions and field bounds. It does not reproduce all game/teaching schemas or
execute their effects. It discards bounded text replies rather than requesting or
rendering model output. Shared backend schemas are unchanged. Anay's counterpart
review of the live boundary remains required before integrated merge acceptance.

After disconnect, local Stop remains latched. If reconciliation shows an existing
paused/active session, press Stop to end it before an explicit new Start. Ordinary
Pause/Resume works in a started session. No automatic continuation/retry is added.
SDK transport/header buffers hold plaintext credentials in RAM during use and are
freed at cleanup; complete physical memory erasure is not claimed. Application
buffers are wiped where owned. Fixed status logs exclude credentials, SSIDs,
headers, message bodies, session IDs and model text. SDK diagnostic logs are disabled.
The provisioning helper's Python strings also remain process memory until exit;
its byte buffer is cleared best-effort, not a universal RAM-erasure guarantee.

The existing offline PCM packetizer is not wired to this control target. Backend
`device.ready.audio`/`camera` remain false. Mic/STT/chat/TTS/playback and secure F13
camera are still later integrations; native TTS rate 22,050 Hz is not the proposed
16,000 Hz mic input rate. No streaming permission follows from physical feasibility.

## Checks actually performed

Using the already installed pinned tools:

```sh
python3 firmware/stackchan/tools/build.py --target control
c++ -std=c++11 -Wall -Wextra -Werror -fsanitize=address,undefined firmware/stackchan/tests/control_policy.cpp -o /tmp/lemmi-control-policy-test
/tmp/lemmi-control-policy-test
/Users/emiliavu/.espressif/python_env/idf5.5_py3.14_env/bin/python -m unittest discover -s firmware/stackchan/tests -p test_provision_control.py -v
```

- Pinned ESP32 compile passed: 1,339,299 program bytes / 52,804 static global bytes.
  Network/TLS allocations and the 24 KiB worker stack are runtime costs, not a
  measured peak memory budget.
- Host ASan/UBSan assertions passed: stopped/muted startup, readiness/snapshot gate,
  stale/replayed sequence and queued commands, generation/session mismatch, Stop
  surviving late ready/unmute, explicit new session, watchdog rollover, reconnect,
  pending Start→Stop, unrelated errors and bounded revision retries.
- Three Python tests passed: UTF-8 byte bounds, header-injection/length rejection,
  and allowlisted status logs refusing arbitrary/private fields.
- A synthetic cJSON protocol self-check is compiled into device startup. It tests
  hello/ready/state, duplicate sequence, foreign binding, capture grant rejection
  and nesting bounds. It must pass before provisioning/network are enabled. It has
  NOT yet been executed/observed on this device; compiler success is not a pass.
- Initial compile found an unavailable timegm API; fixed by using UTC-pinned
  mktime. Latest compile above passed. No dependencies were installed.

Actual Wi-Fi, claim, TLS chain/hostname, WSS, Stop timing under load, heap,
expiry/revocation/restart and venue DNS are untested here. No hardware upload or
real pairing has been performed by the agent in this increment. Receive-only
monitor, upload dry-run and a local-source review do not prove a connection.

## Local procedure — guide one step at a time

1. Stop any monitor. Recheck the serial port. Upload (add `--dry-run` for file/tool/
   original-backup integrity validation without serial):

   ```sh
   python firmware/stackchan/tools/upload.py \
     --target control \
     --port /dev/cu.usbmodem2101 \
     --backup-dir firmware/stackchan/backups/20261114T021027Z
   ```

2. Confirm the control screen says camera/microphone off and **Provision via USB**.
   A receive-only monitor can check `control_selftest_passed` and version 0.1;
   stop it before provisioning. Do not accept selftest_failed as success.
3. Obtain the actual domain key and a fresh caregiver-created pairing ID/24-character
   code privately. Do not paste secrets into chat, source, shell arguments or env
   output. A previous credential may need caregiver revocation before replacement.
   Device reboot alone does not revoke its credential on the server. Pending codes
   expire after five minutes; obtain one just before this step.
4. Run the private USB helper, using the already active ESP Python environment:

   ```sh
   python firmware/stackchan/tools/provision-control.py --port /dev/cu.usbmodem2101
   ```

   It first sends a nonsecret probe and refuses secrets without a matching control
   sketch response. Inputs use hidden local TTY prompts: Wi-Fi name/password,
   domain access key, pairing ID and code. No secret file is created. After RAM
   provisioning, the same port observes fixed statuses for 120 seconds (configurable
   1–600), saving ONLY allowlisted events to ignored `build/control-monitor.log` at
   mode 0600. The agent can read that file; never run a second monitor concurrently.
5. Read **PAIR + CONNECT Alex** and explicitly tap it. This is the local claim
   confirmation, not mic/camera consent. Wait for `control_ready` and initial state.
   If interrupted/lost during claim, get a new pairing; consumed codes cannot be
   retrieved/retried automatically. No Start is sent on connection.
6. Explicitly Start, Pause, Resume, Mute/Unmute and Stop on-device. Record actual
   state/ack events separately from local indications. Confirm capture stays off.
   Check Get help unavailable without a fake sent status. Stop without a server
   and reconnect: it must remain stopped and require explicit continuation.
7. With Anay, verify actual revocation, gateway restart, credential expiry and a
   silent-heartbeat failure. Do not disable TLS or hardcode an edge IP to get a pass.

Sources: installed pinned SDK headers and [Espressif WS transport source](https://github.com/espressif/esp-idf/blob/v5.5.1/components/tcp_transport/transport_ws.c);
backend [control handoff](../../docs/handoffs/anay-control-foundation.md),
[current API inventory](../../docs/backend_api.md) and
[deployment status](../../docs/backend-status.md). Earlier handoffs' loopback-only
claims are historical; this target uses the documented live authenticated path.

## Local pairing-creation helper option

If Emilia has her caregiver VoidAuth access token locally, use the same helper
with `--create-pairing`. It prompts privately for the caregiver token after Wi-Fi
and the domain key, sends the documented fixed-origin HTTPS pairing request with
a fresh UUID, then provisions only pairing ID/code and device configuration. The
caregiver token is never serialized to USB or written to the status log. HTTPS
certificate/hostname checks remain enabled; redirects and proxy-environment
forwarding are disabled, responses are bounded to 4 KiB and scope/expiry are
validated. No automatic retry/revoke is added. An ambiguous timeout needs Anay's
pending-pairing review. This does not implement caregiver OIDC login or acquire a
token; alternatively Anay can create a request and privately supply its ID/code
for the original helper mode. Six fixture tests pass; no real HTTP request was
made by the agent. This helper-only update needs no firmware re-upload.

Control 0.1 was successfully uploaded by Emilia after an initial preflight
no-response failure resolved by reconnecting USB. All four image hashes verified.
Serial at 08:13:32 UTC on November 14 observed `control_selftest_passed`,
`control_boot` and `firmware=lemmi-control/0.1 display=320x240 capture=off camera=off`.
The on-device protocol self-check is now actually observed passing. No live
claim, Wi-Fi/TLS/WSS or session controls have been verified yet.

## First live attempt and Wi-Fi diagnostic follow-up

Emilia privately provisioned control 0.1, then tapped Pair + Connect Alex. The
screen stayed at Connecting Wi-Fi and the saved log reported control_connect_failed
at 08:28:36 UTC. The top button returned to PAIR + CONNECT Alex, meaning cfg was
still pending and the HTTPS claim had not begun. Emilia confirms her network is
2.4 GHz. This is an association failure in this run, not a proven TLS/backend or
credential-claim failure. No successful Wi-Fi/WSS connection is established.

0.2 adds a status-only Wi-Fi disconnect event with native status/reason numbers,
without SSID/password/BSSID. The local helper now shows the Wi-Fi name while it is
typed for typo checking; passwords, keys and codes stay hidden. Only the fixed
numeric diagnostic is saved in the status log. New firmware upload and actual
reason/success remain pending; re-enter private provisioning after upload.

0.2 compile passed (1,340,383 program bytes / 52,804 static globals), six helper
fixture tests and original-backup integrity upload dry-run passed. A test caught
a duplicated status-filter suffix in the new Wi-Fi diagnostic; it was corrected
before local use. Actual Wi-Fi failure reason/success remains pending.

## Wi-Fi-only diagnostic mode (0.2)

A new local provisioning mode separates Wi-Fi diagnosis from enrollment:

```sh
python firmware/stackchan/tools/provision-control.py --port /dev/cu.usbmodem2101 --wifi-only
```

After uploading control 0.2, this asks only for SSID/password, then provisions a
strict Wi-Fi-only object and observes statuses on the same port. The local button
becomes TEST WI-FI (no pairing). Only that explicit tap starts association. Success
reports control_wifi_ready and turns the radio off after the test; failure reports
numeric status/reason. Neither path creates/claims a pairing or contacts the
backend. Domain key/caregiver token/pairing ID/code are not accepted in the Wi-Fi-
only object. UTC is provided automatically, but no TLS/backend work is done in
this mode. All media/motion remain off.

Use normal provisioning only after Wi-Fi succeeds; obtain the fresh five-minute
pairing then. --wifi-only and --create-pairing are mutually exclusive. Seven
fixture helper tests pass; actual Wi-Fi-only association remains unverified.

Final Wi-Fi-only 0.2 compile passed: 1,340,659 program bytes / 52,804 static
globals. Original-backup-integrity upload dry-run passed. No 0.2 upload or Wi-Fi-
only hardware result has been observed yet.

## Wi-Fi-only hardware result

Emilia uploaded final control 0.2; helper reported all four images hash-verified.
She privately provisioned --wifi-only, explicitly tapped TEST WI-FI and saw
Wi-Fi association passed. Saved allowlisted status at 2026-11-14 17:52:31 UTC:
`event=control_wifi_ready capture=off camera=off`. This verifies association in
this run. The diagnostic shuts the radio down afterward; it does not establish
DNS, TLS, backend claim, WSS or a session. The earlier failure's exact cause was
not established; no network defect or credential typo is asserted.

Next: stop the USB observer, create a fresh pairing via the caregiver-authorized
path or obtain its ID/code privately from Anay, then provision normal mode and
explicitly Pair + Connect Alex. No re-upload is needed for that mode switch.

The two-minute observers repeatedly expired during guided manual setup, leaving
no diagnostic for later failures. Read-only monitor now accepts up to 600 seconds;
provision helper observation defaults to 600 seconds (still bounded, fixed-status
only). This host-only change needs no firmware upload and changes no network or
capture permission. The cold-boot Wi-Fi-only retry was reported failed by Emilia,
but its status log was empty, so no new reason code was observed.

## Correct network retry

Emilia later identified that the wrong Wi-Fi network name had been entered in
the failing retry. After re-provisioning the correct network locally and keeping
the same helper open, the device showed association passed; saved status at
2026-11-14 18:39:46 UTC confirmed control_wifi_ready, capture/camera off. This
supersedes the unresolved Wi-Fi discovery diagnosis for that retry. No network
name or password was copied into the handoff/status log. The backend claim/WSS
are still untested. Stop the current helper, obtain fresh post-restart pairing
details and provision normal mode with the now-confirmed Wi-Fi name. Keep that
same helper open for the on-device Pair action; no new firmware upload is needed.

## Fresh-code claim failure and diagnostic 0.3 (November 14)

Observed: Wi-Fi-only passed at 18:39:46 UTC after the network name was corrected.
Normal pairing then emitted `control_claim_failed` at 18:44:35 UTC. Emilia
confirms the pairing was brand new. Control 0.2 mapped all claim errors to “Need
new pairing code”; this does not establish an expired/rejected code or TLS success.

0.3 changes that screen to “Claim failed - see USB” and logs only fixed stages
(init/headers/open/write/status/size/read/shape/expiry/ok), numeric HTTP status,
SDK error/socket errno, header length and received count (write count at write
failure). HTTP=0 means no HTTP status was captured; stage=open does not alone
distinguish DNS, TCP and TLS. Socket errno may be zero/uninformative. Existing
certificate validation, single-use clearing, response bound/validation and local
activation remain in force. No automatic retry or response/body/header logging.
A fresh attempted code may have been consumed even if response validation fails.
Both observers reject arbitrary diagnostic strings or appended private fields.
Eight helper tests passed, including both observer diagnostic privacy filters.
Hardware diagnostics on 0.3 remain pending; see subsequent build result below.

0.3 pinned compile passed: 1,341,191 program bytes / 52,804 static globals.
Upload dry-run passed backup integrity, four images and esptool version without
opening serial. Original private backup remains unchanged. No 0.3 upload performed.

## Existing credential provisioning — control 0.4

Emilia replaced the live-test pairing workflow with an existing persistent device
credential in private local `data/stackchan-access.json`. Exact path is locally
Git-excluded; file mode is 0600. No file values were printed. Firmware remains
RAM-only; power/reset requires local reprovisioning from the Mac file. This is a
device credential, not a caregiver/provider token. Backend acceptance, lifetime
and restart/revocation behavior are not yet observed; existing local backend
source still describes the earlier temporary credential workflow.

After uploading 0.4, stop any other serial observer and run:

```sh
python firmware/stackchan/tools/provision-control.py \
  --port /dev/cu.usbmodem2101 \
  --credential-file data/stackchan-access.json
```

Helper checks a private regular file, 8 KiB limit, unique JSON keys, exact fixed
URLs/Alex assignment, matching Bearer header, token/header bounds and expiry.
It sends only Wi-Fi config, domain key, device credential, expiry and local UTC
through the existing probed private USB flow. No backend requests occur before
the robot's CONNECT (stays stopped) button. No pairing/claim is needed in this
mode, and no secret values are command-line arguments. The token file stays on
the Mac. Normal pairing and Wi-Fi-only options remain mutually exclusive modes.

Explicit null expiry means no local credential time deadline. Ready must contain
explicit null too; missing/malformed/mismatched expiry fails closed. Dated
credentials still expire locally. TLS hostname/CA/time validation, scoped ready,
Stop, capture-off policy, bounded queues and six-second watchdog are unchanged.
A persistent credential is not an automatic start/reconnect/capture authorization.
11 host helper tests passed, including wrong scope/URLs/auth/expiry/permissions,
duplicate keys, oversize input and both fixed diagnostic filters. Device startup
self-check now includes null expiry and rejection of missing/malformed/mismatched
expiry; execution on 0.4 hardware is pending.

0.4 pinned compile passed: 1,341,959 program bytes / 52,804 static globals.
Upload dry-run passed original backup integrity, target/images and esptool version;
no serial port opened or hardware upload performed by the agent.

## First live control connection — November 14, 19:05 UTC

Emilia uploaded control 0.4: all four flash image hashes verified. She used
--credential-file with private Wi-Fi inputs and explicitly tapped CONNECT (stays
stopped). Screen reported “Stopped locally”. The helper's fixed status log shows
19:05:25.876 UTC control_ready, then control_ack applied=1 and control_state
phase=ended stopped=1; camera/capture stayed off. This is actual authenticated
WSS ready/state/ack evidence using the existing credential; no HTTPS pairing claim
was performed. The credential's durability/restart/revocation behavior is still
unverified. Explicit new Start, Pause/Resume, local Stop round trip and physical
watchdog/disconnect checks remain pending. No mic/camera/STT/TTS is enabled.

## Start acknowledgment regression and heartbeat repaint — control 0.5

Actual 0.4 log: 19:06:21.036 UTC command ack applied=1, then at .038 UTC state
phase=ready stopped=1. Emilia saw Start do nothing and recurrent screen flashing.
Root cause: the event handler re-latched Stop whenever its mirror was ended,
including Start's ack/heartbeat before the new ready snapshot. Every event also
marked the view dirty and draw cleared/repainted the entire display.

0.5 imposes server Stop only on a received ended snapshot; ack/heartbeat cannot
apply a stale ended mirror. A physical local Stop remains independent and cannot
be cleared by any ack/state. Duplicate queued Start cannot send while a prior
Start is in flight. Status displays actual server phase when not locally stopped.
Publish only requests rendering on visible status/phase changes. Draw caches
status/button labels and updates only changed regions; full-screen initialization
runs once. Stop/mute touch handling remains ahead of rendering and never depends
on networking. Hardware flicker and Start behavior are pending verification.

Host policy ASan/UBSan regression checks passed for Start→ack/heartbeat with an
old ended mirror→ready, local Stop surviving ack, and a new ended snapshot forcing
Stop. All 11 helper tests also passed. Compile/dry-run evidence follows below.

0.5 final pinned compile passed: 1,342,287 program bytes / 52,852 static globals.
Upload dry-run passed original backup integrity, all four image files and tool
version; no serial port opened. No 0.5 hardware upload or screen check performed
by the agent.

## Control 0.5 hardware Start/Stop evidence — November 14

Emilia reports the 0.5 upload passed and reprovisioned via the private credential
file. At 19:13:27 UTC, connection produced control_ready, ack applied=1 and
phase=paused stopped=1 (an existing paused session, so new Start is blocked).
At 19:14:46 UTC she explicitly tapped local Stop: control_local_stop, ack
applied=1, then phase=ended stopped=1. At 19:15:01 UTC an explicit Start produced
ack applied=1 and phase=ready stopped=0. This confirms the new-session Start path
and local Stop's backend reconciliation on the uploaded firmware. Camera/capture
remained off throughout. It does not measure physical Stop latency, prove audible
output/capture, or establish watchdog/revocation behavior. Screen flicker fix,
Pause/Resume, active-session Stop and disconnect checks remain pending.

## Full control sequence observed — November 14, 19:19–19:20 UTC

On uploaded control 0.5, Emilia supplied these fixed status receipts:

- Pause at 19:19:01 UTC: ack applied=1; phase=paused stopped=0.
- Explicit Resume at 19:20:11 UTC: ack applied=1; phase=ready stopped=0.
- Local Stop from ready at 19:20:32 UTC: control_local_stop, ack applied=1;
  phase=ended stopped=1.

Together with Start at 19:15:01 UTC, this is actual hardware/backend evidence for
Start → Pause → Resume → local Stop, all capture=off camera=off. Timestamp spacing
is observed serial event spacing, not a physical touch latency measurement.
Display flashing improvement still awaits Emilia's explicit visual confirmation.
Credential restart/revocation, network loss/watchdog, sustained load, and real
mic/STT/TTS/camera streaming remain unverified in this connected control target.

Visual confirmation after the full 0.5 control sequence: Emilia confirms the
screen flashing has stopped. This is a user-observed hardware result, not only
a source/rendering assumption. Start behavior and flicker fixes are now both
confirmed on the uploaded firmware.

## Reboot/self-check and local Unmute — November 14, 19:23 UTC

After the bounded helper observer ended, Emilia opened the receive-only monitor.
It observed control_selftest_passed, control_boot and firmware=lemmi-control/0.5
320x240 at 19:23:04 UTC. This establishes a new boot occurred; its cause is not
established. Ending an observer alone is not proof of a reboot/disconnect.
The 0.5 expanded synthetic protocol self-check (including null expiry handling)
is now observed passed on-device. RAM-only provisioning must be restored for
further backend checks. A local Unmute at 19:23:25 UTC emitted control_mic_unmuted
capture=off camera=off. This verifies capture stayed off after a local Unmute on
the fresh boot; it is not a connected-session mute/unmute receipt. Next restore
local Mute, then deliberately reprovision/connect as needed.

## Local mute and explicit disconnect/reconnect — November 14

After the previously observed reboot, local Mute at 19:24:18 UTC emitted
control_mic_muted capture=off camera=off. Emilia privately reprovisioned the same
existing credential and explicitly connected; at 19:26:34 UTC device ready and
phase=ended stopped=1 were observed. Start at 19:27:39 UTC was acknowledged,
phase=ready stopped=0. On-screen DISCONNECT at 19:28:41 UTC emitted local_stop
then disconnected, capture/camera off. Explicit local CONNECT at 19:29:09 UTC
succeeded with ready/ack and phase=paused stopped=1. The existing session was
not automatically resumed, and local Stop stayed latched on reconnect. No new
pairing claim was needed; the same credential was accepted again.

This verifies deliberate disconnect/reconnect, not unplanned Wi-Fi loss, physical
watchdog timing or backend restart/revocation. A final explicit Stop is requested
to end the paused test session. No raw microphone, speaker or camera media was
enabled in this control-only test.

## Final test cleanup — November 14, 19:29:53 UTC

Emilia's final local Stop emitted control_local_stop, ack applied=1, and
phase=ended stopped=1, all camera/capture off. The paused reconnect test session
is ended. On 0.5, actual checks now include authenticated ready/state/ack,
Start/Pause/Resume/Stop, a stable screen after the redraw fix, local fresh-boot
Unmute remaining capture-off/Mute restored, and explicit disconnect/reconnect
remaining locally stopped with no automatic resume. Unexpected network loss/
watchdog timing, backend restart/revocation, peak/load memory and integrated
STT/TTS/camera media remain unverified. Original backup remains preserved.

Restart handoff cleanup: upload.py future control manifest version label corrected
from stale 0.2 to installed 0.5. Previous private manifests and binary/evidence
files preserved unchanged. No firmware code/binary or upload changed for this
metadata correction; dry-run passed again. Current resume handoff consolidated
with final observed stopped state and explicit local/unpushed status.

## Backend endpoint compatibility — control 0.6, awaiting hardware

Emilia reported the installed 0.5 screen showed camera/mic off and “Invalid
server state”. The saved helper log still contains the earlier accepted control
run, not the new rejection. An agent fetch failed GitHub DNS; Emilia fetched in
local Terminal, updating backend-deploy to **7debf9a**. Read its backend status,
API, endpoint handoff, device/session schemas, and actual control gateway. The
current documented deployed runtime is **17a8522**. Its source emits handoff
plus text controls (eight total); 0.5 rejects both handoff and arrays >7. This is
a reproduced source/fixture incompatibility that explains failure at ready with
this backend, not a captured live packet or proof no other incompatibility exists.

Firmware 0.6:

- Accepts the shared known control descriptors (up to nine), rejects duplicates/
  unknowns, and explicitly declares endpoint=robot with audio unsupported. It
  still requires the exact provisioned legacy Alex binding and nullable expiry.
- Tracks activeEndpointId/lease and robot-vs-browser ownership. Loss of local
  ownership latches Stop, invalidates pending controls and sets local mute. Owner
  checks gate Resume/microphone commands. Foreign-owner snapshots never clear Stop.
- Mirrors a valid foreign owner's captureGrant only as bounded metadata, so a
  browser's listening state does not disconnect the observing robot. Grant shape,
  owner, listening/unmuted phase, generation/lease and deadline format must match.
  An own grant remains an error because this target negotiated no audio. It does
  not initialize mic/speaker or store/transmit media based on any grant.
- When another endpoint owns an active session, row three says **USE ROBOT
  (pauses)**. Only that explicit tap sends input.handoff with current scope.
  It remains stopped; await the authoritative owned/paused snapshot, then a
  separate explicit Resume can return to capture-off ready. No automatic handoff,
  Resume, capture or playback. Stop/Help remain separate controls.
- FORBIDDEN control responses no longer wipe a valid device credential as if
  revoked; ownership rejection differs from UNAUTHORIZED access rejection.
- Rejected messages do not partially mutate the safe mirror/sequence or Stop
  reconciliation. Fixed protocol-reject stages and numeric local-owner events
  allow diagnosis without server text, IDs, headers, payloads or secrets. Both
  host observers allow only the defined status shape.
- The compatibility pairing claim path now also accepts explicit null expiry;
  the current credential-file flow bypasses claim and is unchanged.

Testing actually run using existing installed tools, no new dependencies:

- Host ASan/UBSan control policy and **real cJSON firmware parser** tests passed:
  eight-control ready, null expiry, observer/owner handoff states, foreign listening
  grants with capture off, own/malformed grants rejected, cross-profile/session/
  generation and replay rejection, rejected messages leave safe state unchanged.
- 12 Python helper/privacy fixtures passed, including both new diagnostic filters.
- Exact fetched backend runtime schemas accepted the new ready/session fixtures
  and outgoing hello/handoff. This uses existing TypeScript/Zod in memory; no
  backend checkout/merge/service/network call or package install was performed.
- Pinned ESP32 compile passed: **1,345,115 program bytes / 53,060 static globals**.
  Runtime/peak heap is unmeasured. No 0.6 hardware acceptance is claimed.

Additional reproduction commands from repository root (local SDK source exists):

```sh
cc -std=c11 -fsanitize=address,undefined -c /Users/emiliavu/esp/esp-idf-v5.5.1/components/json/cJSON/cJSON.c -o /tmp/lemmi-cjson-test.o
c++ -std=c++11 -Wall -Wextra -Werror -fsanitize=address,undefined -I /Users/emiliavu/esp/esp-idf-v5.5.1/components/json/cJSON firmware/stackchan/tests/control_protocol.cpp /tmp/lemmi-cjson-test.o -o /tmp/lemmi-control-protocol-test
/tmp/lemmi-control-protocol-test
node firmware/stackchan/tests/check_backend_contract.cjs origin/backend-deploy
```

The SDK C source emits existing macOS deprecated-sprintf warnings; it was not
modified. The schema check initially needed workspace-local Zod resolution;
fixed to resolve from packages/contracts, then passed with no install.

Next local procedure: stop any serial observer, upload --target control (0.6),
privately reprovision the SAME existing credential file, keep that helper open,
and tap Connect. Do not send a second simultaneous WSS client with the shared
key; the backend permits one connection per identity. Browser frontend should
use its own enrollment/cookie. Record actual ready/state/local-owner receipts and
rejection stage if one remains. If a browser owns the session, coordinate before
explicit handoff/Stop; these actions pause/end that profile's session.

Speech integration remains pending: server code supports 16 kHz mono pcm_s16le,
320-sample/640-byte/20 ms input, granted explicit Speak/Finish, 22.05 kHz native
TTS and four-chunk consumed-receipt window. The fetched docs still say public
speech disabled; Emilia reports voice enablement in progress. Do not claim live
server configuration changed or robot speech works from these docs. This target
stays control-only until bounded real capture/playback/receipts/cancellation,
independent local Stop/mute/watchdog, and explicit local activation are implemented
and tested. No shared backend/contracts were edited here.

Final 0.6 upload dry-run passed backup integrity, four images and esptool version
without opening serial. Diff whitespace check passed. Shared-schema verification
also accepted the foreign-browser listening/grant fixture. No 0.6 upload or
live connection/ownership/voice hardware test was performed by the agent.

## Control 0.6 first hardware connection — November 14, 20:44 UTC

Emilia uploaded 0.6: all four flash images hash-verified, then privately
reprovisioned the existing credential file and tapped Connect. At 20:44:15.928
UTC: control_ready, then ack applied=1, phase=none stopped=1. Thus the new ready
control descriptors and empty session were accepted on hardware. At .931440 UTC,
control_connect_failed followed immediately. No protocol_reject or protocol_error
was reported. The generic event does not distinguish socket poll/read/close,
Wi-Fi link loss or a send failure. This is NOT a rejected ready payload, expired
pairing proof or confirmed backend failure. No Start/media was requested; camera/
capture stayed off. Next: one explicit Connect retry on retained RAM enrollment,
keeping the same observer open; if repeated, add bounded numeric transport-stage/
close-code diagnostics and coordinate deployment status with Anay. No new key or
re-upload is justified merely by this generic status. TLS validation stays on.

## Repeated post-ready exit — diagnostic 0.7, awaiting upload

The explicit 0.6 reconnect retry at 20:45:39 UTC repeated device ready, ack
applied=1, phase=none stopped=1, then connect_failed. No parser rejection or
Start was reported in either attempt. The exit cause is unknown. Host event
timestamp spacing is not actual device connection duration; it can reflect USB
buffering. Do not infer an invalid/expired credential after accepted ready.

0.7 adds one **fixed/numeric** transport-exit record before socket/Wi-Fi cleanup:
stage (Wi-Fi/setup/connect/hello/send/poll/read/close/frame/parser/watchdog/etc),
I/O result, last WebSocket opcode, HTTP upgrade status, socket errno, native Wi-Fi
status/disconnect reason, whether ready was accepted, and monotonic milliseconds
since this connection attempt began (including association). Opcode 8 is a close
frame; 256 means no frame observed. Errno may be zero/uninformative; absent close
opcode does not establish server intent. No reason text, message data, payload,
IDs or secrets are logged. SDK automatic control-frame handling is unchanged.
It is diagnostic evidence, not a guessed connection fix or relaxed validation.

12 helper/privacy tests pass including acceptance of the exact diagnostic shape
and rejection of appended/private/free-text fields in BOTH observers. Exact fetched
backend schemas still accept hello/handoff/ready/session/foreign listening fixture.
Protocol/ownership/media policy is unchanged from 0.6; no mic/camera/output enabled.
No real service request/device access made by the agent. Compile result follows.

0.7 pinned compile passed: 1,345,819 program bytes / 53,060 static globals.
Backup-integrity/four-image/esptool upload dry-run and diff whitespace check passed.
No serial opened; diagnostic 0.7 remains hardware-pending.

## Diagnostic 0.7 hardware result — November 14, 20:50:30 UTC

Emilia uploaded 0.7 (PASS), privately reprovisioned and explicitly tapped Connect.
Observed ready, ack applied=1, phase=none stopped=1, then:
`stage=read result=-1 opcode=256 upgrade=101 errno=0 wifi=3 reason=0 ready=1 age_ms=10185`.
Camera/capture stayed off. Wi-Fi remained associated and HTTPS/WSS upgrade plus
application ready had succeeded. No new WS header was decoded for the failing
read (opcode NONE=256); no close reason/code was captured. age_ms includes Wi-Fi/
TLS/setup, NOT time since ready. Do not identify the whole 10.185s as session time.

Inspected installed esp-idf-v5.5.1 transport source: TLS read maps a clean peer FIN
to -1, while WS read_exact_size also turns an underlying zero-byte timeout into
-1 before a header is complete. Therefore this diagnostic alone cannot prove a
server-initiated close or firmware timeout. Do not ignore/retry all negative
reads (a partial header might have been consumed) or disable verification.
Next obtain Anay's sanitized gateway/proxy disconnect/restart/access/heartbeat
cause near 20:50:30 UTC before another blind flash or credential change. If no
server cause is available, richer numeric TLS error/underlying-read diagnostics
may be required. Existing credential/backup remain preserved. Live voice pending.
