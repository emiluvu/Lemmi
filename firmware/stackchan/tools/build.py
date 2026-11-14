#!/usr/bin/env python3
"""Compile only. This script never opens a serial port or uploads firmware."""
import json
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parents[1]
lock = json.loads((root / "toolchain.json").read_text())
cli = root / ".tools/arduino-cli"
config = root / ".tools/arduino-cli.yaml"
if not cli.is_file() or not config.is_file():
    raise SystemExit("Run python3 tools/setup.py from firmware/stackchan first.")
subprocess.run([str(cli), "compile", "--fqbn", lock["fqbn"],
                "--config-file", str(config), "--build-path", str(root / "build/foundation"),
                str(root / "lemmi_foundation")], check=True)
