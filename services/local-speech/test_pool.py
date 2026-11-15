"""Multiprocess isolation tests with synthetic fixture engines, never native models."""
import concurrent.futures
import http.client
import json
import os
import threading
import time
import unittest
from unittest.mock import patch
from uuid import uuid4

from server import Config, SpeechServer, WorkerPool


def pool_fixture(connection, config):
    connection.send({"ready": True,
                     "stt": {"backend": config["stt_backend"], "languages": ["en"]},
                     "tts": {"backend": config["tts_backend"], "languages": ["en"]}})
    try:
        while True:
            job = connection.recv()
            if job is None:
                break
            time.sleep(job.get("delay", 0))
            if job["kind"] == "stt":
                connection.send({"ok": True, "data": {"text": "fixture", "language": "en"}})
            else:
                connection.send({"ok": True, "pcm": bytes([job.get("marker", 0), 0]) * 100, "sampleRate": 22050, "language": "en"})
    except (EOFError, BrokenPipeError):
        pass
    finally:
        connection.close()


class Pools(unittest.TestCase):
    def setUp(self):
        self.config = Config("fixture-private-token-000000000000000", port=0, stt_workers=2, tts_workers=2)
        self.pool = WorkerPool(self.config, pool_fixture)
        self.pool.start(time.monotonic() + 10)
        self.executor = concurrent.futures.ThreadPoolExecutor(max_workers=8)

    def tearDown(self):
        self.pool.dispose(graceful=True)
        self.executor.shutdown(wait=True)

    def pending(self, kind="stt"):
        request_id = str(uuid4())
        result = self.executor.submit(self.pool.infer, request_id, {"kind": kind, "delay": 10})
        deadline = time.monotonic() + 2
        while time.monotonic() < deadline:
            with self.pool.lock:
                worker = self.pool.active.get(request_id)
                if worker and worker.active == request_id:
                    return request_id, worker, result
            time.sleep(0.01)
        self.fail("Fixture request did not acquire its own worker")

    def test_two_users_and_other_engine_overlap_without_head_of_line_blocking(self):
        a, wa, first = self.pending()
        b, wb, second = self.pending()
        self.assertIsNot(wa, wb)
        self.assertEqual(len(self.pool.active), 2)
        # STT saturation cannot block TTS; a third STT does not accumulate a queue.
        self.assertTrue(self.pool.infer(str(uuid4()), {"kind": "tts"})["ok"])
        with self.assertRaises(RuntimeError):
            self.pool.infer(str(uuid4()), {"kind": "stt"})
        # Duplicates must not steal another slot or change cancellation routing.
        with self.assertRaises(RuntimeError):
            self.pool.infer(a, {"kind": "tts"})
        self.assertTrue(self.pool.cancel(a))
        with self.assertRaises(RuntimeError):
            first.result(timeout=3)
        self.assertFalse(wb.canceled.is_set())
        self.assertFalse(second.done())
        self.assertTrue(wb.process.is_alive())
        self.assertIsNone(wa.process)
        self.assertEqual(self.pool.health()["stt"]["readyWorkers"], 1)
        # An explicit later turn can reload only the canceled process.
        self.assertTrue(self.pool.infer(str(uuid4()), {"kind": "stt"})["ok"])
        self.assertEqual(self.pool.health()["stt"]["readyWorkers"], 2)
        self.pool.cancel(b)
        with self.assertRaises(RuntimeError):
            second.result(timeout=3)

    def test_cancel_before_assignment_is_bounded_and_cannot_start_in_another_slot(self):
        request_id = str(uuid4())
        self.assertFalse(self.pool.cancel(request_id))
        with self.assertRaises(RuntimeError):
            self.pool.infer(request_id, {"kind": "tts"})
        self.assertFalse(self.pool.active)
        for _ in range(300):
            self.pool.cancel(str(uuid4()))
        self.assertLessEqual(len(self.pool.early_cancels), 256)

    def test_concurrent_tts_results_cannot_cross_private_worker_pipes(self):
        futures = [self.executor.submit(self.pool.infer, str(uuid4()),
                                       {"kind": "tts", "delay": 0.2, "marker": marker})
                   for marker in [3, 7]]
        for marker, result in zip([3, 7], futures):
            self.assertEqual(result.result(timeout=3)["pcm"], bytes([marker, 0]) * 100)

    def test_shutdown_cancels_all_owned_jobs_without_allowing_new_assignments(self):
        _, _, a = self.pending("stt")
        _, _, b = self.pending("tts")
        self.pool.dispose()
        for result in [a, b]:
            with self.assertRaises(RuntimeError):
                result.result(timeout=3)
        self.assertIsNone(self.pool.health())
        with self.assertRaises(RuntimeError):
            self.pool.infer(str(uuid4()), {"kind": "tts"})

    def test_private_http_health_and_cancel_work_while_both_stt_workers_are_busy(self):
        a, _, first = self.pending()
        b, wb, second = self.pending()
        server = SpeechServer(self.config, self.pool)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        def call(path, body=None):
            client = http.client.HTTPConnection("127.0.0.1", server.server_port, timeout=2)
            client.request("GET" if body is None else "POST", path,
                           None if body is None else json.dumps(body),
                           {"Authorization": "Bearer " + self.config.token, "Content-Type": "application/json"})
            response = client.getresponse()
            result = response.status, json.loads(response.read())
            client.close()
            return result
        try:
            status, health = call("/health")
            self.assertEqual(status, 200)
            self.assertEqual(health["data"]["stt"]["workers"], 2)
            self.assertTrue(call("/v1/cancel", {"requestId": a})[1]["data"]["applied"])
            with self.assertRaises(RuntimeError):
                first.result(timeout=3)
            self.assertFalse(wb.canceled.is_set())
            self.pool.cancel(b)
            with self.assertRaises(RuntimeError):
                second.result(timeout=3)
        finally:
            server.shutdown()
            server.server_close()
            thread.join()


class PoolConfiguration(unittest.TestCase):
    def test_cpu_defaults_and_gpu_selection_are_explicit_and_pool_sizes_are_bounded(self):
        env = {"LEMMI_SPEECH_TOKEN": "fixture-token-" * 3,
               "LEMMI_SPEECH_STT_ENGINE": "disabled", "LEMMI_SPEECH_TTS_ENGINE": "disabled"}
        with patch.dict(os.environ, env, clear=True):
            config = Config.from_env()
            self.assertEqual((config.stt_workers, config.tts_workers, config.tts_device), (1, 1, "cpu"))
        with patch.dict(os.environ, {**env, "LEMMI_SPEECH_TTS_DEVICE": "cuda", "LEMMI_SPEECH_STT_WORKERS": "2"}, clear=True):
            config = Config.from_env()
            self.assertEqual((config.stt_workers, config.tts_device), (2, "cuda"))
            self.assertNotIn("token", config.engines())
        for key, value in [("STT_WORKERS", "0"), ("TTS_WORKERS", "5"), ("STT_WORKERS", "1.5"), ("TTS_DEVICE", "auto")]:
            with patch.dict(os.environ, {**env, "LEMMI_SPEECH_" + key: value}, clear=True):
                with self.assertRaises(ValueError):
                    Config.from_env()
