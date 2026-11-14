# Authenticated control firmware — first increment

`lemmi_control/` (`lemmi-control/0.1`) implements the control-only backend at
main be1e096. This is source/compile validation until the local procedure below
is observed. It replaces the petting screen while installed; petting 0.2 and
camera/audio 0.5 sources and the original private flash backup are preserved.

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
