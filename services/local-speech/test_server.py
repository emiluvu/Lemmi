"""Boundary tests use an explicit fake engine; real model checks use speech-smoke.ts."""
import concurrent.futures
import contextlib
import http.client
import io
import json
import os
import threading
import time
import unittest
from unittest.mock import patch
from uuid import uuid4

from server import Config, SpeechServer, Worker, MAX_PCM


def fixture_engine(connection, config):
    connection.send({"ready": True, "stt": {"backend": "fixture", "languages": ["en"]}, "tts": {"backend": "fixture", "languages": ["en"]}})
    try:
        while True:
            job = connection.recv()
            if job.get("text") == "wait":
                time.sleep(10)
            if job["kind"] == "stt":
                connection.send({"ok": True, "data": {"text": "fictional fixture", "language": "en"}})
            elif job.get("language") == "de":
                connection.send({"ok": False})
            else:
                connection.send({"ok": True, "pcm": b"\0\0" * 100, "sampleRate": 22050, "language": "en"})
    except EOFError:
        connection.close()


class Boundaries(unittest.TestCase):
    def setUp(self):
        self.token = "fixture-speech-token-not-real-000000"
        config = Config(self.token, port=0, stt_backend="disabled", tts_backend="disabled")
        self.worker = Worker(config, fixture_engine)
        self.worker.start(time.monotonic() + 10)
        self.server = SpeechServer(config, self.worker)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.worker.dispose()
        self.thread.join()

    def call(self, path, body=None, method="POST", authorize=True, headers=None):
        connection = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=5)
        extra = {"X-Lemmi-Request-Id": str(uuid4()), **(headers or {})}
        if authorize:
            extra["Authorization"] = "Bearer " + self.token
        connection.request(method, path, body=body, headers=extra)
        response = connection.getresponse()
        result = response.status, dict(response.getheaders()), response.read()
        connection.close()
        return result

    def test_auth_origin_query_and_health(self):
        self.assertEqual(self.call("/health", method="GET", authorize=False)[0], 401)
        self.assertEqual(self.call("/health", method="GET", headers={"Origin": "https://foreign.invalid"})[0], 403)
        self.assertEqual(self.call("/health?token=forbidden", method="GET")[0], 403)
        status, headers, _ = self.call("/health", method="GET")
        self.assertEqual(status, 200)
        self.assertEqual(headers["Cache-Control"], "no-store")

    def test_pcm_bounds_and_language(self):
        headers = {"Content-Type": "application/octet-stream", "X-Lemmi-Language": "en"}
        for body in [b"", b"\0" * 3]:
            self.assertEqual(self.call("/v1/stt", body, headers=headers)[0], 400)
        # The server rejects an oversized Content-Length before reading its body.
        # Sending that entire body can race the deliberate connection close and
        # raise BrokenPipe in the client instead of observing the rejection.
        self.assertEqual(self.call("/v1/stt", b"", headers={**headers, "Content-Length": str(MAX_PCM + 2)})[0], 400)
        self.assertEqual(self.call("/v1/stt", b"\0" * 640, headers={**headers, "X-Lemmi-Language": "unsupported"})[0], 400)
        status, _, body = self.call("/v1/stt", b"\0" * 640, headers=headers)
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body)["data"]["language"], "en")
        # A supported initial listening pause can exceed the former 20s body cap.
        status, _, _ = self.call("/v1/stt", b"\0" * (16000 * 2 * 32), headers=headers)
        self.assertEqual(status, 200)

    def test_tts_metadata_no_implicit_language_fallback(self):
        headers = {"Content-Type": "application/json"}
        status, metadata, body = self.call("/v1/tts", json.dumps({"text": "Hello", "language": "en"}), headers=headers)
        self.assertEqual(status, 200)
        self.assertEqual(metadata["X-Lemmi-Sample-Rate"], "22050")
        self.assertEqual(metadata["X-Lemmi-Encoding"], "pcm_s16le")
        self.assertEqual(len(body), 200)
        self.assertEqual(self.call("/v1/tts", json.dumps({"text": "Hallo", "language": "de"}), headers=headers)[0], 503)
        # Missing German must not poison English readiness or synthesize it as English.
        status, _, health = self.call("/health", method="GET")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(health)["data"]["tts"]["languages"], ["en"])
        self.assertEqual(self.call("/v1/tts", json.dumps({"text": "Hello", "language": "en"}), headers=headers)[0], 200)
        self.assertEqual(self.call("/v1/tts", json.dumps({"text": "Hello", "language": "en", "url": "https://injected.invalid"}), headers=headers)[0], 400)

    def test_cancel_hard_stops_work_and_other_request_cannot_queue(self):
        request_id = str(uuid4())
        job = {"kind": "tts", "text": "wait", "language": "en"}
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            running = pool.submit(self.worker.infer, request_id, job)
            deadline = time.monotonic() + 2
            while self.worker.active != request_id and time.monotonic() < deadline:
                time.sleep(0.01)
            self.assertFalse(self.worker.cancel(str(uuid4())))
            with self.assertRaises(RuntimeError):
                self.worker.infer(str(uuid4()), job)
            status, _, response = self.call("/v1/cancel", json.dumps({"requestId": request_id}), headers={"Content-Type": "application/json"})
            self.assertEqual(status, 200)
            self.assertTrue(json.loads(response)["data"]["applied"])
            with self.assertRaises(RuntimeError):
                running.result(timeout=3)
        self.assertIsNone(self.worker.process)
        # A fresh explicit job can reload; a canceled job itself is never replayed.
        result = self.worker.infer(str(uuid4()), {"kind": "stt", "pcm": b"\0\0", "language": "en"})
        self.assertTrue(result["ok"])

    def test_requests_do_not_print_content_or_credentials(self):
        capture = io.StringIO()
        with contextlib.redirect_stdout(capture), contextlib.redirect_stderr(capture):
            self.call("/v1/tts", json.dumps({"text": "private-fixture-marker", "language": "en"}), headers={"Content-Type": "application/json"})
        self.assertEqual(capture.getvalue(), "")

    def test_cancel_overtaking_request_prevents_it_starting(self):
        request_id = str(uuid4())
        self.assertFalse(self.worker.cancel(request_id))
        with self.assertRaises(RuntimeError):
            self.worker.infer(request_id, {"kind": "stt", "pcm": b"\0\0", "language": "en"})
        self.assertIsNone(self.worker.active)
        for _ in range(300):
            self.worker.cancel(str(uuid4()))
        self.assertLessEqual(len(self.worker.early_cancels), 256)


class Configuration(unittest.TestCase):
    def test_explicit_disabled_backends_and_no_guessed_fallback(self):
        env = {"LEMMI_SPEECH_TOKEN": "fixture-token-" * 3, "LEMMI_SPEECH_STT_ENGINE": "disabled", "LEMMI_SPEECH_TTS_ENGINE": "disabled"}
        with patch.dict(os.environ, env, clear=True):
            self.assertEqual(Config.from_env().stt_backend, "disabled")
        with patch.dict(os.environ, {**env, "LEMMI_SPEECH_STT_ENGINE": "invented"}, clear=True):
            with self.assertRaises(ValueError):
                Config.from_env()
        with patch.dict(os.environ, {**env, "LEMMI_SPEECH_TOKEN": ""}, clear=True):
            with self.assertRaises(ValueError):
                Config.from_env()


if __name__ == "__main__":
    unittest.main()
