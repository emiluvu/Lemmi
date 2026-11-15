"""Provisioning boundaries: tiny synthetic assets only; never download weights."""
import contextlib
import hashlib
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import prepare_models


class Provisioning(unittest.TestCase):
    def fixture(self, root):
        asset = {"repository": "fixture/model", "revision": "fixed",
                 "files": [{"name": "fixture.bin", "size": 2,
                            "sha256": hashlib.sha256(b"ok").hexdigest()}]}
        (root / "assets.json").write_text(json.dumps({
            "stt": asset, "tts": {**asset, "voice": "english"},
            "tts-de": {**asset, "voice": "german"}}))

    def test_german_is_opt_in_and_integrity_checked_before_install(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            self.fixture(root)
            destination = root / "models"
            with patch.object(prepare_models, "HERE", root), contextlib.redirect_stdout(io.StringIO()):
                with patch.object(prepare_models.urllib.request, "urlopen", side_effect=lambda *_a, **_k: io.BytesIO(b"ok")):
                    prepare_models.provision(destination)
                self.assertFalse((destination / "tts-de").exists())
                with patch.object(prepare_models.urllib.request, "urlopen", side_effect=lambda *_a, **_k: io.BytesIO(b"no")):
                    with self.assertRaises(ValueError):
                        prepare_models.provision(destination, german=True)
                self.assertFalse((destination / "tts-de" / "fixture.bin").exists())
                self.assertFalse((destination / "tts-de" / "fixture.bin.part").exists())
                with patch.object(prepare_models.urllib.request, "urlopen", side_effect=lambda *_a, **_k: io.BytesIO(b"ok")):
                    prepare_models.provision(destination, german=True)
                self.assertEqual((destination / "tts-de" / "fixture.bin").read_bytes(), b"ok")

    def test_configure_preserves_existing_private_environment_and_does_not_enable_german(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            self.fixture(root)
            with patch.object(prepare_models, "HERE", root), contextlib.redirect_stdout(io.StringIO()):
                prepare_models.configure(root / "models")
                environment = root / ".env"
                original = environment.read_bytes()
                self.assertIn(b"LEMMI_SPEECH_VOICE_DE=\n", original)
                environment.write_bytes(b"private-existing-config\n")
                prepare_models.configure(root / "other-models")
                self.assertEqual(environment.read_bytes(), b"private-existing-config\n")


if __name__ == "__main__":
    unittest.main()
