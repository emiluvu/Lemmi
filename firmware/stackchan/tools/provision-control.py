#!/usr/bin/env python3
"""Provision the control-only sketch through local USB. No flash/file writes or network requests."""
import argparse
import getpass
import json
import time
import sys
import warnings
import re
import os
from pathlib import Path
from datetime import datetime, timezone
try:
    import serial
except ImportError:
    raise SystemExit("Use the existing ESP Python environment with pyserial.")


def valid(config):
    def printable(value, low, high):
        return low <= len(value) <= high and all(33 <= ord(ch) <= 126 for ch in value)
    return (0 < len(config["ssid"].encode("utf-8")) <= 32
            and len(config["password"].encode("utf-8")) <= 63
            and printable(config["accessKey"], 32, 256)
            and 0 < len(config["pairingId"].encode("utf-8")) <= 100
            and printable(config["code"], 24, 24))


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
    r"(?:event=control_(?:selftest_passed|selftest_failed|boot|provision_ready|provisioned|provision_busy|provision_invalid|ready|local_stop|queue_full|mic_muted|mic_unmuted|connect_failed|claim_failed|expired|watchdog|protocol_error|disconnected)|"
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
    parser.add_argument("--observe-seconds", type=int, default=120)
    args = parser.parse_args()
    if not 1 <= args.observe_seconds <= 600:
        parser.error("--observe-seconds must be between 1 and 600")
    if not sys.stdin.isatty() or not sys.stderr.isatty():
        raise SystemExit("Use an interactive local Terminal; redirected/private-input capture is refused.")
    warnings.simplefilter("error", getpass.GetPassWarning)
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
        print("Control sketch confirmed. Private inputs below are hidden and kept in process memory only.")
        config = {
            "ssid": getpass.getpass("Wi-Fi name (hidden): "),
            "password": getpass.getpass("Wi-Fi password (hidden, empty for open Wi-Fi): "),
            "accessKey": getpass.getpass("Lemmi domain access key (hidden): "),
            "pairingId": getpass.getpass("Fresh pairing ID (hidden): "),
            "code": getpass.getpass("Fresh 24-character pairing code (hidden): "),
            "utcEpoch": int(time.time()),
        }
        if not valid(config):
            raise SystemExit("Provisioning values have invalid lengths/characters; no secrets sent.")
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
