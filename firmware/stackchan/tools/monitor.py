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
if not 1 <= args.seconds <= 600:
    parser.error("--seconds must be between 1 and 600")
allowed = {
    "event=local_stop capture=off camera=off",
    "event=mic_muted capture=off",
    "event=mic_unmuted capture=off",
    "event=ready capture=off",
    "event=pet_stop capture=off camera=off",
    "event=pet_disabled capture=off camera=off",
    "event=pet_enabled capture=off camera=off",
    "event=pet_ack capture=off camera=off",
    "event=display_stop capture=off camera=off",
    "firmware=lemmi-display/0.7 capture=off camera=off",
}
boot = re.compile(r"firmware=(?:lemmi-foundation/0\.1|lemmi-feasibility/0\.[2345678]|lemmi-petting/0\.[12]|lemmi-control/0\.[123456789]|lemmi-voice/0\.[123456789]) display=\d{2,4}x\d{2,4} capture=off camera=off")
diagnostics = re.compile(
    r"event=voice_send_failed reason=(?:2|3|4|6) status=[0-3] result=-?\d{1,10} bytes=\d{1,5} send_max_ms=\d{1,10} capture_sent=\d{1,10} camera=off|"
    r"event=voice_fault code=(?:[0-9]|1[0-2]) send_max_ms=\d{1,10} capture_sent=\d{1,10} heap_free=\d{1,10} camera=off|"
    r"event=voice_link nodelay=1 wifi_sleep=0 camera=off|"
    r"event=voice_ready audio=[01] output_window=(?:4|12) language=(?:en|de) camera=off|"
    r"event=voice_stream received=\d{1,4} consumed=\d{1,4} buffer_waits=\d{1,4} camera=off|"
    r"event=voice_boot reset=\d{1,3} heap_free=\d{1,10} loop_min=\d{1,10} camera=off|"
    r"event=voice_memory loop_min=\d{1,10} worker_min=\d{1,10} heap_free=\d{1,10} camera=off|"
    r"event=voice_(?:audio capture=(?:on|off) playback=(?:on|off)|state phase=(?:none|ready|listening|processing|speaking|waiting|paused|unavailable|ended) stopped=[01] owner=[01]|ack applied=[01]) camera=off|"
    r"event=voice_control_(?:handoff_requested|audio_error|selftest_passed|selftest_failed|boot|ready|local_stop|queue_full|mic_muted|mic_unmuted|connect_failed|claim_failed|wifi_ready|expired|watchdog|protocol_error|disconnected) camera=off|"
    r"event=voice_reject stage=(?:envelope|sequence|ready_fields|ready_binding|ready_media|ready_controls|before_ready|event_shape|state_fields|state_binding|state_owner|state_capture|reply_binding|unsupported_event) camera=off|"
    r"event=voice_transport_exit stage=(?:wifi|wifi_test|claim|tls_init|ws_init|headers|connect|hello|link|expiry|watchdog|stop_send|heartbeat_send|control_send|poll|close|read|partial|frame|message|auth) result=-?\d{1,10} opcode=\d{1,3} upgrade=\d{1,3} errno=-?\d{1,10} wifi=\d{1,3} reason=\d{1,3} ready=[01] age_ms=\d{1,10} camera=off|"
    r"event=servo_probe battery_mv=-?\d{1,5} yaw=(?:ok|value|timeout_empty|timeout_partial|reply|write|tx_wait|rx_flush|rx_error|not_ready) pitch=(?:ok|value|timeout_empty|timeout_partial|reply|write|tx_wait|rx_flush|rx_error|not_ready) off=[01] capture=off camera=off|"
    r"event=motion_fault stage=(?:uart_init|power_on|power_missing|yaw_probe|yaw_torque_value|yaw_torque_off|pitch_torque_off|yaw_limit_low|yaw_limit_high|yaw_position|pose_bounds|hold_goal|yaw_torque_on|move_bounds|move_goal|return_position|finish_torque_off|power_off) transport=(?:none|uart_busy|uart_install|uart_config|not_ready|rx_pending|rx_flush|rx_error|tx_wait|write|timeout|timeout_empty|timeout_partial|reply|ok) capture=off camera=off|"
    r"event=control_transport_exit stage=(?:wifi|wifi_test|claim|tls_init|ws_init|headers|connect|hello|link|expiry|watchdog|stop_send|heartbeat_send|control_send|poll|close|read|partial|frame|message|auth) result=-?\d{1,10} opcode=\d{1,3} upgrade=\d{1,3} errno=-?\d{1,10} wifi=\d{1,3} reason=\d{1,3} ready=[01] age_ms=\d{1,10} capture=off camera=off|"
    r"(?:event=control_protocol_reject stage=(?:envelope|sequence|ready_fields|ready_binding|ready_media|ready_controls|before_ready|event_shape|state_fields|state_binding|state_owner|state_capture|reply_binding|unsupported_event) capture=off camera=off|event=control_owner local=[01] capture=off camera=off|event=control_handoff_requested capture=off camera=off)|"
    r"(?:event=control_claim_result stage=(?:init|headers|open|write|status|size|read|shape|expiry|ok) http=\d{1,3} error=-?\d{1,10} errno=-?\d{1,10} length=-?\d{1,19} received=-?\d{1,10} capture=off camera=off|"
    r"event=control_claim_build_failed capture=off camera=off|event=control_wifi_failure status=\d{1,3} reason=\d{1,3} capture=off camera=off|"
    r"event=control_state phase=(?:none|ready|listening|processing|speaking|waiting|paused|unavailable|ended) stopped=[01] capture=off camera=off|"
    r"event=control_ack applied=[01] capture=off camera=off|"
    r"event=control_(?:selftest_passed|selftest_failed|boot|provision_ready|provisioned|provision_busy|provision_invalid|ready|local_stop|queue_full|mic_muted|mic_unmuted|connect_failed|claim_failed|wifi_ready|expired|watchdog|protocol_error|disconnected) capture=off camera=off|"
    r"event=pet_sensor_unavailable stage=[1-6] capture=off camera=off|"
    r"event=camera_frame width=\d{1,5} height=\d{1,5} format=-?\d{1,10} bytes=\d{1,10} valid=[01]|"
    r"event=camera_allowed local_only=1 limit_ms=15000|"
    r"event=audio_start kind=(?:mic|tone) ok=[01]|"
    r"event=test_stop reason=(?:local|expired|declined|mute|audio_error|lights_error|camera_done|start_timeout) cleanup_ms=\d{1,10} camera_pending=[01]|"
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
