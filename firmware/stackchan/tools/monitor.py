#!/usr/bin/env python3
"""Read only known Lemmi status lines; never transmit commands or reset intentionally."""
import argparse
import json
import re
import time
from datetime import datetime, timezone

try:
    import serial
except ImportError:
    raise SystemExit("This helper requires pyserial; use the Python environment used for esptool.")

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--port", required=True)
parser.add_argument("--seconds", type=int, default=30)
args = parser.parse_args()
if not 1 <= args.seconds <= 120:
    parser.error("--seconds must be between 1 and 120")
allowed = {
    "event=local_stop capture=off camera=off",
    "event=mic_muted capture=off",
    "event=mic_unmuted capture=off",
    "event=ready capture=off",
    "event=pet_stop capture=off camera=off",
    "event=pet_disabled capture=off camera=off",
    "event=pet_enabled capture=off camera=off",
    "event=pet_ack capture=off camera=off",
}
boot = re.compile(r"firmware=(?:lemmi-foundation/0\.1|lemmi-feasibility/0\.[2345]|lemmi-petting/0\.[12]) display=\d{2,4}x\d{2,4} capture=off camera=off")
diagnostics = re.compile(
    r"(?:event=pet_sensor_unavailable stage=[1-6] capture=off camera=off|"
    r"event=camera_frame width=\d{1,5} height=\d{1,5} format=-?\d{1,10} bytes=\d{1,10} valid=[01]|"
    r"event=camera_allowed local_only=1 limit_ms=15000|"
    r"event=audio_start kind=(?:mic|tone) ok=[01]|"
    r"event=test_stop reason=(?:local|expired|declined|mute|audio_error|camera_done|start_timeout) cleanup_ms=\d{1,10} camera_pending=[01]|"
    r"event=camera_result code=-?\d{1,10} frames=\d{1,10} max_wait_ms=\d{1,10} heap_before=\d{1,10} heap_after=\d{1,10}|"
    r"event=camera_closed stop_to_closed_ms=\d{1,10} max_loop_gap_ms=\d{1,10})"
)
connection = serial.Serial(port=None, baudrate=115200, timeout=0.2, exclusive=True)
# Set before open to avoid requesting an automatic bootloader/reset transition.
connection.dtr = False
connection.rts = False
connection.port = args.port
connection.open()
print("Listening for known Lemmi status events only; no serial commands sent.", flush=True)
events = []
pending = b""
try:
    deadline = time.monotonic() + args.seconds
    while time.monotonic() < deadline:
        pending = (pending + connection.read(256))[-4096:]
        while b"\n" in pending:
            raw, pending = pending.split(b"\n", 1)
            line = raw.decode("ascii", errors="ignore").strip()
            if line in allowed or boot.fullmatch(line) or diagnostics.fullmatch(line):
                event = {"time": datetime.now(timezone.utc).isoformat(), "status": line}
                events.append(event)
                print(json.dumps(event), flush=True)
except KeyboardInterrupt:
    pass
finally:
    connection.close()
print(f"Observed {len(events)} recognized status events. No output is not proof of a failed boot.")
