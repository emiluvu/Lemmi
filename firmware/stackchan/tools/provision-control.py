#!/usr/bin/env python3
"""Provision the control-only sketch through local USB. Existing private device access file or optional caregiver-authenticated pairing; networking requires local confirmation."""
import argparse
import getpass
import json
import time
import sys
import warnings
import re
import os
import stat
import hmac
import ssl
import uuid
import urllib.request
import urllib.error
from pathlib import Path
from datetime import datetime, timezone
try:
    import serial
except ImportError:
    raise SystemExit("Use the existing ESP Python environment with pyserial.")


def valid_wifi(config):
    return (isinstance(config.get("ssid"),str) and 0 < len(config["ssid"].encode("utf-8")) <= 32
            and isinstance(config.get("password"),str) and len(config["password"].encode("utf-8")) <= 63)


def valid(config):
    def printable(value, low, high):
        return low <= len(value) <= high and all(33 <= ord(ch) <= 126 for ch in value)
    return (0 < len(config["ssid"].encode("utf-8")) <= 32
            and len(config["password"].encode("utf-8")) <= 63
            and printable(config["accessKey"], 32, 256)
            and 0 < len(config["pairingId"].encode("utf-8")) <= 100
            and printable(config["code"], 24, 24))


ORIGIN = "https://lemmi.chaoswarrior.dev"


def load_credential_file(path):
    """Read scoped device access privately; errors never include file contents."""
    def unique(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError()
            result[key] = value
        return result
    def printable(value, low, high):
        return isinstance(value,str) and low <= len(value) <= high and all(33 <= ord(ch) <= 126 for ch in value)
    try:
        with Path(path).open('rb') as source:
            mode=os.fstat(source.fileno()).st_mode
            if not stat.S_ISREG(mode) or stat.S_IMODE(mode) & 0o077:
                raise ValueError()
            raw=source.read(8193)
        if len(raw)>8192:
            raise ValueError()
        value=json.loads(raw,object_pairs_hook=unique)
        if (set(value)!={'backendUrl','websocketUrl','deviceId','profileId','credential','expiresAt','headers'}
                or value['backendUrl']!=ORIGIN or value['websocketUrl']!='wss://lemmi.chaoswarrior.dev/v1/device-stream'
                or value['deviceId']!='stackchan-alex' or value['profileId']!='profile-alex'
                or not printable(value['credential'],40,100)):
            raise ValueError()
        headers=value['headers']
        if (not isinstance(headers,dict) or set(headers)!={'Authorization','X-Lemmi-Access-Key'}
                or not printable(headers['X-Lemmi-Access-Key'],32,256)
                or not isinstance(headers['Authorization'],str)
                or not hmac.compare_digest(headers['Authorization'].encode(),('Bearer '+value['credential']).encode())):
            raise ValueError()
        expiry=value['expiresAt']
        if expiry is not None:
            deadline=datetime.fromisoformat(expiry)
            if deadline.tzinfo is None or deadline.timestamp() <= time.time():
                raise ValueError()
            expiry=deadline.astimezone(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
        return dict(accessKey=headers['X-Lemmi-Access-Key'],credential=value['credential'],expiresAt=expiry)
    except (OSError,ValueError,KeyError,TypeError,AttributeError,OverflowError):
        raise SystemExit('Credential file rejected: check private permissions (600), Alex/server binding, format and expiry. Nothing sent.') from None


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def create_pairing(access_key, caregiver_token):
    if not 32 <= len(access_key) <= 256 or any(not 33 <= ord(ch) <= 126 for ch in access_key):
        raise SystemExit("Invalid domain key format; pairing not requested.")
    # This token authorizes only the Mac's request, never USB/device provisioning.
    if not 1 <= len(caregiver_token) <= 4096 or any(not 33 <= ord(ch) <= 126 for ch in caregiver_token):
        raise SystemExit("Invalid caregiver token format; pairing not requested.")
    request = urllib.request.Request(
        ORIGIN + "/v1/devices/stackchan-alex/pairings",
        data=json.dumps({"deviceId": "stackchan-alex", "profileId": "profile-alex", "commandId": str(uuid.uuid4())}).encode(),
        headers={"Content-Type": "application/json", "Origin": ORIGIN,
                 "X-Lemmi-Access-Key": access_key, "Authorization": "Bearer " + caregiver_token},
        method="POST",
    )
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect(),
                                         urllib.request.HTTPSHandler(context=ssl.create_default_context()))
    try:
        with opener.open(request, timeout=10) as response:
            if response.status != 200:
                raise SystemExit("Pairing creation rejected; ask Anay to check assignment/existing pairing.")
            body = response.read(4097)
    except urllib.error.HTTPError as error:
        raise SystemExit("Pairing creation rejected (HTTP %d); check local token/key and existing pairing with Anay." % error.code) from None
    except (urllib.error.URLError, OSError):
        raise SystemExit("Pairing request failed TLS/network validation or timed out. Outcome may be unknown; check pending pairing with Anay before retrying.") from None
    try:
        if len(body) > 4096:
            raise ValueError()
        root = json.loads(body)
        data = root["data"]
        if (root.get("ok") is not True or data["deviceId"] != "stackchan-alex"
                or data["profileId"] != "profile-alex"
                or not isinstance(data["pairingId"], str) or not 1 <= len(data["pairingId"].encode()) <= 100
                or not isinstance(data["code"], str) or len(data["code"]) != 24
                or any(not 33 <= ord(ch) <= 126 for ch in data["code"])):
            raise ValueError()
        deadline = datetime.fromisoformat(data["expiresAt"])
        remaining = deadline.timestamp() - time.time()
        if deadline.tzinfo is None or not 0 < remaining <= 301:
            raise ValueError()
        return data["pairingId"], data["code"]
    except (KeyError, ValueError, TypeError, AttributeError):
        raise SystemExit("Invalid/expired pairing response; no secrets sent to device. Ask Anay to check the pending pairing.") from None


def wait_for(connection, expected, seconds=5):
    deadline = time.monotonic() + seconds
    pending = b""
    while time.monotonic() < deadline:
        pending = (pending + connection.read(256))[-4096:]
        while b"\n" in pending:
            line, pending = pending.split(b"\n", 1)
            if line.strip() == expected:
                return True
    return False

STATUS = re.compile(
    r"event=control_transport_exit stage=(?:wifi|wifi_test|claim|tls_init|ws_init|headers|connect|hello|link|expiry|watchdog|stop_send|heartbeat_send|control_send|poll|close|read|partial|frame|message|auth) result=-?\d{1,10} opcode=\d{1,3} upgrade=\d{1,3} errno=-?\d{1,10} wifi=\d{1,3} reason=\d{1,3} ready=[01] age_ms=\d{1,10} capture=off camera=off|"
    r"(?:event=control_protocol_reject stage=(?:envelope|sequence|ready_fields|ready_binding|ready_media|ready_controls|before_ready|event_shape|state_fields|state_binding|state_owner|state_capture|reply_binding|unsupported_event)|event=control_owner local=[01]|event=control_handoff_requested) capture=off camera=off|"
    r"(?:event=control_claim_result stage=(?:init|headers|open|write|status|size|read|shape|expiry|ok) http=\d{1,3} error=-?\d{1,10} errno=-?\d{1,10} length=-?\d{1,19} received=-?\d{1,10}|"
    r"event=control_claim_build_failed|event=control_wifi_failure status=\d{1,3} reason=\d{1,3}|"
    r"event=control_(?:selftest_passed|selftest_failed|boot|provision_ready|provisioned|provision_busy|provision_invalid|ready|local_stop|queue_full|mic_muted|mic_unmuted|connect_failed|claim_failed|wifi_ready|expired|watchdog|protocol_error|disconnected)|"
    r"event=control_state phase=(?:none|ready|listening|processing|speaking|waiting|paused|unavailable|ended) stopped=[01]|"
    r"event=control_ack applied=[01]) capture=off camera=off"
)


def observe(connection, seconds):
    folder = Path(__file__).resolve().parents[1] / "build"
    folder.mkdir(exist_ok=True)
    path = folder / "control-monitor.log"
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    os.fchmod(fd, 0o600)
    print("Observing fixed control status for a bounded interval; saved in build/control-monitor.log.", flush=True)
    deadline = time.monotonic() + seconds
    pending = b""
    with os.fdopen(fd, "w") as output:
        while time.monotonic() < deadline:
            pending = (pending + connection.read(256))[-4096:]
            while b"\n" in pending:
                raw, pending = pending.split(b"\n", 1)
                line = raw.decode("ascii", errors="ignore").strip()
                if STATUS.fullmatch(line):
                    record = json.dumps({"time": datetime.now(timezone.utc).isoformat(), "status": line})
                    output.write(record + "\n"); output.flush()
                    print(record, flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", required=True)
    modes=parser.add_mutually_exclusive_group()
    modes.add_argument("--wifi-only", action="store_true", help="Wi-Fi association only; no domain key, caregiver token or pairing needed")
    modes.add_argument("--create-pairing", action="store_true", help="Create the request using a hidden local caregiver token; never sent to device")
    modes.add_argument("--credential-file", type=Path, help="Private Alex device access JSON; bypass pairing claim, still requires local Connect")
    parser.add_argument("--observe-seconds", type=int, default=600)
    args = parser.parse_args()
    if not 1 <= args.observe_seconds <= 600:
        parser.error("--observe-seconds must be between 1 and 600")
    if not sys.stdin.isatty() or not sys.stderr.isatty():
        raise SystemExit("Use an interactive local Terminal; redirected/private-input capture is refused.")
    warnings.simplefilter("error", getpass.GetPassWarning)
    device_access=load_credential_file(args.credential_file) if args.credential_file else None
    connection = serial.Serial(port=None, baudrate=115200, timeout=0.2, exclusive=True)
    connection.dtr = connection.rts = False
    connection.port = args.port
    try:
        connection.open()
    except serial.SerialException:
        raise SystemExit("Cannot open USB port. Stop the monitor and check the port; nothing provisioned.")
    try:
        connection.write(b"control.probe\n")
        if not wait_for(connection, b"event=control_provision_ready capture=off camera=off"):
            raise SystemExit("Control sketch did not confirm provisioning mode. No secrets sent.")
        print("Control sketch confirmed. Wi-Fi name is visible locally; passwords/tokens/codes are hidden. Values stay in process memory only.")
        config = {
            "ssid": input("Wi-Fi name (visible locally, not saved in status log): "),
            "password": getpass.getpass("Wi-Fi password (hidden, empty for open Wi-Fi): "),
            "utcEpoch": int(time.time()),
        }
        if args.wifi_only:
            config["wifiOnly"] = True
        elif device_access is not None:
            config.update(device_access)
            device_access.clear()
        else:
            config.update({
                "accessKey": getpass.getpass("Lemmi domain access key (hidden): "),
                "pairingId": "pending" if args.create_pairing else getpass.getpass("Fresh pairing ID (hidden): "),
                "code": "x" * 24 if args.create_pairing else getpass.getpass("Fresh 24-character pairing code (hidden): "),
            })
        if not (valid_wifi(config) if args.wifi_only or args.credential_file else valid(config)):
            raise SystemExit("Provisioning values have invalid lengths/characters; no secrets sent.")
        if args.create_pairing:
            caregiver_token = getpass.getpass("Caregiver VoidAuth access token (hidden, Mac only): ")
            try:
                config["pairingId"], config["code"] = create_pairing(config["accessKey"], caregiver_token)
            finally:
                caregiver_token = None
            print("Fresh pairing created privately; ID/code will be provisioned without display.", flush=True)
            config["utcEpoch"] = int(time.time())
        config['utcEpoch']=int(time.time())
        encoded = bytearray(json.dumps(config, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))
        if len(encoded) > 2048:
            raise SystemExit("Provisioning message exceeds device limit; no secrets sent.")
        try:
            connection.write(encoded + b"\n")
            connection.flush()
            if not wait_for(connection, b"event=control_provisioned capture=off camera=off"):
                raise SystemExit("Provisioning not confirmed. Keep robot disconnected and retry deliberately.")
        finally:
            encoded[:] = b"\0" * len(encoded)
            config.clear()
        if args.wifi_only:
            print("Wi-Fi-only config provisioned in RAM. Tap TEST WI-FI locally. No pairing will be created or claimed.", flush=True)
            observe(connection,args.observe_seconds)
            return
        if args.credential_file:
            print("Device access provisioned in RAM. Camera/mic remain off. Tap CONNECT (stays stopped) locally. No pairing claim is used.",flush=True)
        else:
            print("Provisioned in device RAM. Camera/mic remain off. On the robot, confirm PAIR + CONNECT Alex.")
            print("This helper sent no HTTPS claim. Pairing begins only with that local button.", flush=True)
        observe(connection, args.observe_seconds)
    finally:
        connection.close()


if __name__ == "__main__":
    try:
        main()
    except (KeyboardInterrupt, EOFError, getpass.GetPassWarning):
        raise SystemExit("Provisioning cancelled.")
