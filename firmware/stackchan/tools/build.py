#!/usr/bin/env python3
"""Compile only. This script never opens a serial port or uploads firmware."""
import argparse
import json
from pathlib import Path
import subprocess

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--target", choices=["foundation", "feasibility", "packetizer", "playback", "presentation", "petting", "control", "voice", "voice_diag", "avatars", "display"], default="foundation")
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
lock = json.loads((root / "toolchain.json").read_text())
cli = root / ".tools/arduino-cli"
config = root / ".tools/arduino-cli.yaml"
if not cli.is_file() or not config.is_file():
    raise SystemExit("Run python3 tools/setup.py from firmware/stackchan first.")
sketch = root / ("tests/arduino_" + args.target) if args.target in ("packetizer", "playback", "presentation") else root / ("lemmi_" + args.target)
if args.target in ("avatars", "display"):
    import sys
    subprocess.run([sys.executable, str(root / "tools/export-avatars.py"), "--target", args.target], check=True)
extra=[]
if args.target == "voice_diag":
    extra=["--build-property", "compiler.c.elf.extra_flags=-Wl,--cref -Wl,--wrap=esp_transport_poll_write -Wl,--wrap=esp_tls_conn_write -Wl,--wrap=netconn_write_partly"]
subprocess.run([str(cli), "compile", *extra, "--fqbn", lock["fqbn"],
                "--config-file", str(config), "--build-path", str(root / "build" / args.target),
                str(sketch)], check=True)

if args.target == "feasibility":
    # All sensor bus access must resolve to our adapter, never a second IDF bus.
    link_map = (root / "build/feasibility/lemmi_feasibility.ino.map").read_text()
    if "sccb-ng.c.obj" in link_map or "sccb.c.obj" in link_map:
        raise SystemExit("Unsafe camera link: SDK SCCB driver was included")
    if "CameraBus.cpp.o" not in link_map:
        raise SystemExit("Camera bus adapter missing from link")
    print("PASS: application SCCB adapter linked; SDK SCCB driver absent.")

if args.target in ("voice", "voice_diag"):
    import sys
    dump_tools=list((root / '.arduino/data/packages/m5stack/tools/esp-x32').glob('*/bin/xtensa-esp32s3-elf-objdump'))
    if len(dump_tools)!=1:
        raise SystemExit('Expected one pinned Xtensa objdump; inspect installed toolchain.')
    probe_args=['--transport-probe-map',str(root / 'build' / args.target / 'lemmi_voice_diag.ino.map'),'--tcp-probe'] if args.target == 'voice_diag' else []
    subprocess.run([sys.executable,str(root / 'tools/check-stack.py'),
                    '--elf',str(root / 'build' / args.target / ('lemmi_' + args.target + '.ino.elf')),
                    '--objdump',str(dump_tools[0]),*probe_args],check=True)
