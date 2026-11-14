#!/usr/bin/env python3
"""Install a project-local pinned Arduino toolchain. Does not access the robot."""
import hashlib
import io
import json
import platform
from pathlib import Path
import subprocess
import tarfile
import urllib.request

root = Path(__file__).resolve().parents[1]
lock = json.loads((root / "toolchain.json").read_text())
local = root / ".tools"
local.mkdir(exist_ok=True)
system = platform.system()
architecture = platform.machine().lower()
if system != "Darwin":
    raise SystemExit("This bootstrap is currently verified for macOS only; add another platform explicitly before use.")
suffix = "macOS_ARM64" if architecture == "arm64" else "macOS_64bit"
version = lock["arduinoCli"]
name = f"arduino-cli_{version}_{suffix}.tar.gz"
base = f"https://github.com/arduino/arduino-cli/releases/download/v{version}/"
cli = local / "arduino-cli"
if not cli.is_file():
    def download(url):
        request = urllib.request.Request(url, headers={"User-Agent": "Lemmi-firmware-setup"})
        with urllib.request.urlopen(request, timeout=120) as response:
            return response.read()
    archive = download(base + name)
    checksums = download(base + f"arduino-cli_{version}_checksums.txt").decode()
    expected = next(line.split()[0] for line in checksums.splitlines()
                    if line.split()[-1].lstrip("*") == name)
    if hashlib.sha256(archive).hexdigest() != expected:
        raise SystemExit("Arduino CLI checksum mismatch")
    with tarfile.open(fileobj=io.BytesIO(archive), mode="r:gz") as package:
        member = next(item for item in package.getmembers()
                      if item.name == "arduino-cli" and item.isfile())
        cli.write_bytes(package.extractfile(member).read())
    cli.chmod(0o755)
actual = subprocess.check_output([str(cli), "version"], text=True)
if f"Version: {version} " not in actual:
    raise SystemExit("Local Arduino CLI version differs from toolchain.json")
config = local / "arduino-cli.yaml"
# JSON is also valid YAML, and safely quotes paths containing spaces.
config.write_text(json.dumps({"board_manager": {"additional_urls": [
    "https://static-cdn.m5stack.com/resource/arduino/package_m5stack_index.json"]},
    "directories": {key: str(root / ".arduino" / folder) for key, folder in
                    [("data", "data"), ("downloads", "downloads"), ("user", "user")] }}, indent=2))
def run(*args):
    subprocess.run([str(cli), *args, "--config-file", str(config)], check=True)
run("core", "update-index")
run("core", "install", lock["core"])
run("lib", "install", *[f"{name}@{version}" for name, version in lock["libraries"].items()])
print("Local toolchain ready. Run python3 tools/build.py; no firmware has been uploaded.")
