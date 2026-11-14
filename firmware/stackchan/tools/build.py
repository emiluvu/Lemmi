#!/usr/bin/env python3
"""Compile only. This script never opens a serial port or uploads firmware."""
import argparse
import json
from pathlib import Path
import subprocess

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--target", choices=["foundation", "feasibility", "packetizer", "petting", "control"], default="foundation")
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
lock = json.loads((root / "toolchain.json").read_text())
cli = root / ".tools/arduino-cli"
config = root / ".tools/arduino-cli.yaml"
if not cli.is_file() or not config.is_file():
    raise SystemExit("Run python3 tools/setup.py from firmware/stackchan first.")
sketch = root / "tests/arduino_packetizer" if args.target == "packetizer" else root / ("lemmi_" + args.target)
subprocess.run([str(cli), "compile", "--fqbn", lock["fqbn"],
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
