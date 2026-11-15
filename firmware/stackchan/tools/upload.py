#!/usr/bin/env python3
"""Upload selected Lemmi firmware only after a matching private full-flash backup."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from datetime import datetime, timezone

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--target", choices=["foundation", "feasibility", "petting", "control", "voice", "voice_diag", "avatars", "display"], default="foundation")
parser.add_argument("--port", required=True)
parser.add_argument("--backup-dir", required=True, type=Path)
parser.add_argument("--esptool-python", default=sys.executable)
parser.add_argument("--dry-run", action="store_true")
parser.add_argument("--tcp-send-capacity-experiment", type=int, choices=[8192],
                    help="Use the locally assessed isolated 8192-byte candidate; voice_diag only")
parser.add_argument("--tcp-policy", choices=['bounded-16k'],
                    help="Use the assessed 16KB/23-pbuf candidate; voice_diag only")
args = parser.parse_args()
os.umask(0o077)
root = Path(__file__).resolve().parents[1]
folder = args.backup_dir.resolve()
if not folder.is_relative_to((root / "backups").resolve()):
    raise SystemExit("Use a private backup inside firmware/stackchan/backups.")
manifest = json.loads((folder / "manifest.json").read_text())
backup = (folder / manifest["backupFile"]).resolve()
if not backup.is_relative_to(folder):
    raise SystemExit("Invalid backup path")
if manifest.get("chip") != "ESP32-S3" or manifest.get("flashBytes") != 16777216:
    raise SystemExit("Unexpected backup device/capacity")
if "verify_flash passed" not in manifest.get("deviceComparison", ""):
    raise SystemExit("A device-verified full backup is required")
if backup.stat().st_size != 16777216 or hashlib.sha256(backup.read_bytes()).hexdigest() != manifest["sha256"]:
    raise SystemExit("Private backup integrity check failed")
lock = json.loads((root / "toolchain.json").read_text())
build = root / "build" / args.target
if args.tcp_send_capacity_experiment and args.tcp_policy:
    raise SystemExit('Select one TCP candidate only')
if args.tcp_send_capacity_experiment or args.tcp_policy:
    if args.target != 'voice_diag':
        raise SystemExit('The send-capacity experiment requires --target voice_diag')
    sys.path.insert(0, str(root / 'experiments/tcp-send-capacity'))
    import assess_pair
    experiment = root / ('build/tcp-send-capacity-bounded-16k' if args.tcp_policy else 'build/tcp-send-capacity-8192')
    assessed = json.loads((experiment / 'assessment.json').read_text())
    checked = assess_pair.verify(experiment)
    expectedCapacity = 16384 if args.tcp_policy else 8192
    expectedPolicy = 'bounded-16k' if args.tcp_policy else 'derived'
    if checked['candidateCapacity'] != expectedCapacity or checked['policy'] != expectedPolicy or not checked['sourceInputsVerified'] or checked['variants']['candidate']['ram']['localPreparationGate'] != 'pass-for-bounded-test-only':
        raise SystemExit('Experimental RAM preparation gate failed')
    if any(assessed[key] != value for key, value in checked.items()):
        raise SystemExit('Experimental assessment is stale; reassess before upload')
    if assessed['firmwareSources'] != assess_pair.firmware_sources():
        raise SystemExit('Firmware source changed since assessment; rebuild and reassess')
    for address, image in assess_pair.image_paths(experiment):
        assess_pair.check_hash(image, assessed['images'][address]['sha256'])
    build = experiment / 'candidate/voice'
sketch = "lemmi_" + args.target
firmware = {"foundation": "lemmi-foundation/0.1", "feasibility": "lemmi-feasibility/0.8", "petting": "lemmi-petting/0.2", "control": "lemmi-control/0.9", "voice": "lemmi-voice/0.11", "voice_diag": "lemmi-voice/0.11-diag1", "avatars": "lemmi-avatars/0.1", "display": "lemmi-display/0.7"}[args.target]
if args.tcp_send_capacity_experiment:
    firmware='lemmi-voice/0.9-diag1'  # preserved historical candidate, never the current normal target
if args.tcp_policy:
    firmware='lemmi-voice/0.12-diag1-tcp16'
if json.loads((build / "build.options.json").read_text())["fqbn"] != lock["fqbn"]:
    raise SystemExit("Build target differs from pinned toolchain")
# Same four offsets/images as the pinned M5Stack platform.txt upload recipe.
images = [("0x0", build / (sketch + ".ino.bootloader.bin")),
          ("0x8000", build / (sketch + ".ino.partitions.bin")),
          ("0xe000", root / ".arduino/data/packages/m5stack/hardware/esp32/3.3.10/tools/partitions/boot_app0.bin"),
          ("0x10000", build / (sketch + ".ino.bin"))]
checksums = {}
for address, image in images:
    checksums[address] = {"file": image.name, "bytes": image.stat().st_size,
                          "sha256": hashlib.sha256(image.read_bytes()).hexdigest()}
version = subprocess.check_output([args.esptool_python, "-m", "esptool", "version"], text=True)
if "4.12.0" not in version:
    raise SystemExit("Use the esptool 4.12.0 Python environment tested for backup on this device.")
if args.dry_run:
    print("PASS: backup integrity, build target, four image files and esptool version checked. No serial port opened.")
    raise SystemExit(0)
# Keep the original backup and all prior transfer evidence untouched.
run_folder = root / "backups" / "runs" / (datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ") + "-" + args.target)
run_folder.mkdir(parents=True, mode=0o700)
base = [args.esptool_python, "-m", "esptool", "--chip", "esp32s3", "--port", args.port,
        "--baud", "921600", "--connect-attempts", "3"]
def diagnostic(name, command):
    result = subprocess.run(base + ["--after", "no_reset", command],
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=45)
    (run_folder / name).write_text(result.stdout)
    if result.returncode:
        raise SystemExit("Device preflight failed; private log saved. No firmware write attempted.")
    return result.stdout
identity = diagnostic("pre-upload-flash-id.log", "flash_id")
security = diagnostic("pre-upload-security.log", "get_security_info")
if not re.search(r"Detected flash size:\s*16MB", identity):
    raise SystemExit("Connected flash capacity does not match backup")
original = re.search(r"MAC:\s*([0-9a-f:]{17})", (folder / "flash-id.log").read_text(), re.I)
connected = re.search(r"MAC:\s*([0-9a-f:]{17})", identity, re.I)
if not original or not connected or original.group(1).lower() != connected.group(1).lower():
    raise SystemExit("Connected device identity does not match the private backup")
if not re.search(r"Secure Boot:\s*Disabled", security) or not re.search(r"Flash Encryption:\s*Disabled", security):
    raise SystemExit("Unexpected security settings; no firmware write attempted")
print("Backup and connected device match. Uploading selected Lemmi firmware; no erase-all or eFuse changes.", flush=True)
command = base + ["--after", "hard_reset", "write_flash", "-z", "--flash_mode", "keep",
                  "--flash_freq", "keep", "--flash_size", "keep"]
for address, image in images:
    command.extend([address, str(image)])
with (run_folder / "upload.log").open("w") as output:
    result = subprocess.run(command, stdout=output, stderr=subprocess.STDOUT, timeout=180)
record = {"time": datetime.now(timezone.utc).isoformat(), "firmware": firmware,
          "esptool": "4.12.0", "exitCode": result.returncode, "images": checksums,
          "backupIntegrityChecked": True, "deviceIdentityMatched": True}
if args.tcp_send_capacity_experiment:
    record['tcpSendCapacityExperiment'] = args.tcp_send_capacity_experiment
if args.tcp_policy:
    record['tcpPolicy'] = args.tcp_policy
    record['resolvedTcp'] = checked['variants']['candidate']['macros']
(run_folder / "upload-manifest.json").write_text(json.dumps(record, indent=2) + "\n")
if result.returncode:
    raise SystemExit("Upload did not complete. Flash may be partially written; retain backup and inspect private log before recovery.")
count = (run_folder / "upload.log").read_text().count("Hash of data verified")
if count != len(images):
    raise SystemExit("Upload returned success but expected image verification messages are missing; inspect the private log.")
print("PASS: all four flash images written and hash-verified; hard reset requested. Hardware screen/touch checks remain pending.")
