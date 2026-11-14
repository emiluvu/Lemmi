"""Explicit one-time model download. Never receives microphone audio or LLM credentials."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import secrets
import urllib.request

HERE = Path(__file__).resolve().parent


def provision(directory, stt_profile="base"):
    manifest = json.loads((HERE / "assets.json").read_text())
    hashes = {}
    for kind in ["stt", "tts"]:
        selected = "stt-small" if kind == "stt" and stt_profile == "small" else kind
        asset = manifest[selected]
        folder = directory / selected
        folder.mkdir(parents=True, exist_ok=True)
        for entry in asset["files"]:
            target = folder / entry["name"]
            def valid():
                if not target.is_file() or target.stat().st_size != entry["size"]:
                    return False
                return not entry.get("sha256") or hashlib.sha256(target.read_bytes()).hexdigest() == entry["sha256"]
            if not valid():
                remote = "/".join(filter(None, [asset.get("directory"), entry["name"]]))
                url = f'https://huggingface.co/{asset["repository"]}/resolve/{asset["revision"]}/{remote}'
                temporary = target.with_suffix(target.suffix + ".part")
                digest = hashlib.sha256()
                total = 0
                try:
                    with urllib.request.urlopen(url, timeout=60) as response, temporary.open("wb") as output:
                        while True:
                            chunk = response.read(1024 * 1024)
                            if not chunk:
                                break
                            total += len(chunk)
                            if total > entry["size"]:
                                raise ValueError("Model size exceeded pinned metadata")
                            digest.update(chunk)
                            output.write(chunk)
                    if total != entry["size"] or (entry.get("sha256") and digest.hexdigest() != entry["sha256"]):
                        raise ValueError("Model integrity verification failed")
                    temporary.replace(target)
                finally:
                    temporary.unlink(missing_ok=True)
            hashes[str(target.relative_to(directory))] = hashlib.sha256(target.read_bytes()).hexdigest()
            print(f"Verified model asset: {kind}/{entry['name']}", flush=True)
    (directory / "verified-assets.json").write_text(json.dumps(hashes, indent=2) + "\n")


def configure(directory, stt_profile="base"):
    destination = HERE / ".env"
    if destination.exists():
        print("Private speech .env already exists; preserved existing settings", flush=True)
        return
    manifest = json.loads((HERE / "assets.json").read_text())
    voice = manifest["tts"]["voice"]
    content = [
        "# Private generated speech configuration; never commit this file.",
        "LEMMI_STT_BACKEND=local-http", "LEMMI_TTS_BACKEND=local-http",
        "LEMMI_STT_URL=http://127.0.0.1:8765", "LEMMI_TTS_URL=http://127.0.0.1:8765",
        "LEMMI_SPEECH_TOKEN=" + secrets.token_urlsafe(32),
        "LEMMI_SPEECH_PORT=8765", "LEMMI_SPEECH_TIMEOUT_MS=20000",
        "LEMMI_SPEECH_STT_ENGINE=faster-whisper", "LEMMI_SPEECH_TTS_ENGINE=piper",
        "LEMMI_SPEECH_STT_MODEL_PATH=" + json.dumps(str(directory / ("stt-small" if stt_profile == "small" else "stt"))),
        "LEMMI_SPEECH_STT_DEVICE=cpu", "LEMMI_SPEECH_STT_COMPUTE=int8",
        "LEMMI_SPEECH_THREADS=4",
        "LEMMI_SPEECH_VOICE_EN=" + json.dumps(str(directory / "tts" / (voice + ".onnx"))),
        "LEMMI_SPEECH_VOICE_DE=", "",
    ]
    fd = os.open(destination, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    with os.fdopen(fd, "w") as output:
        output.write("\n".join(content))
    print("Created private speech .env with an independent token (value not printed)", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--directory", type=Path, default=HERE / ".models")
    parser.add_argument("--configure", action="store_true", help="Create private service .env only if absent")
    parser.add_argument("--stt-profile", choices=["base", "small"], default="base",
                        help="Explicit model profile; never silently switch a configured model")
    args = parser.parse_args()
    directory = args.directory.resolve()
    provision(directory, args.stt_profile)
    if args.configure:
        configure(directory, args.stt_profile)
