"""Private loopback speech adapter. No session authority, recordings or request logs."""
from __future__ import annotations

import hmac
import json
import logging
import multiprocessing as mp
import os
import signal
import socket
import threading
import time
from dataclasses import dataclass, replace
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
from uuid import UUID

MAX_PCM = 16000 * 2 * 20
MAX_AUDIO = 48000 * 2 * 30
LANGUAGES = {"en", "de"}


@dataclass(frozen=True)
class Config:
    token: str
    port: int = 8765
    stt_backend: str = "faster-whisper"
    tts_backend: str = "piper"
    stt_model: str = ""
    stt_device: str = "cpu"
    stt_compute: str = "int8"
    tts_device: str = "cpu"
    stt_workers: int = 1
    tts_workers: int = 1
    threads: int = 4
    voice_en: str = ""
    voice_de: str = ""

    @classmethod
    def from_env(cls):
        p = "LEMMI_SPEECH_"
        result = cls(
            token=os.environ.get(p + "TOKEN", ""),
            port=int(os.environ.get(p + "PORT", "8765")),
            stt_backend=os.environ.get(p + "STT_ENGINE", "faster-whisper"),
            tts_backend=os.environ.get(p + "TTS_ENGINE", "piper"),
            stt_model=os.environ.get(p + "STT_MODEL_PATH", ""),
            stt_device=os.environ.get(p + "STT_DEVICE", "cpu"),
            stt_compute=os.environ.get(p + "STT_COMPUTE", "int8"),
            tts_device=os.environ.get(p + "TTS_DEVICE", "cpu"),
            stt_workers=int(os.environ.get(p + "STT_WORKERS", "1")),
            tts_workers=int(os.environ.get(p + "TTS_WORKERS", "1")),
            threads=int(os.environ.get(p + "THREADS", "4")),
            voice_en=os.environ.get(p + "VOICE_EN", ""),
            voice_de=os.environ.get(p + "VOICE_DE", ""),
        )
        if not 32 <= len(result.token) <= 512 or any(not 33 <= ord(c) <= 126 for c in result.token):
            raise ValueError("Configure a private speech token of at least 32 characters")
        if result.stt_backend not in {"faster-whisper", "disabled"} or result.tts_backend not in {"piper", "disabled"}:
            raise ValueError("Unsupported speech engine; no fallback was selected")
        if result.stt_device not in {"cpu", "cuda"} or result.stt_compute not in {"int8", "float16", "int8_float16", "float32"}:
            raise ValueError("Unsupported STT execution configuration")
        if result.tts_device not in {"cpu", "cuda"}:
            raise ValueError("Unsupported TTS device")
        if not 1 <= result.stt_workers <= 4 or not 1 <= result.tts_workers <= 4:
            raise ValueError("Each speech pool requires 1–4 workers")
        if not 0 <= result.port <= 65535 or not 1 <= result.threads <= 16:
            raise ValueError("Invalid speech port/thread bounds")
        if result.stt_backend != "disabled" and (not result.stt_model or not Path(result.stt_model).is_dir()):
            raise ValueError("Provision a local STT model directory before starting")
        if result.tts_backend != "disabled" and not Path(result.voice_en).is_file():
            raise ValueError("Provision the English voice before starting")
        return result

    def engines(self):
        # The inference subprocess needs model options, never the service/LLM credentials.
        return {k: v for k, v in self.__dict__.items() if k not in {"token", "port"}}


def engine_process(connection, config):
    """Warm engines once; bounded jobs cross a private parent/child pipe in memory."""
    # The service parent owns shutdown and terminates this worker explicitly. Terminal
    # SIGINT must not interrupt native inference/IPC cleanup in both processes at once.
    signal.signal(signal.SIGINT, signal.SIG_IGN)
    logging.disable(logging.CRITICAL)
    # Third-party diagnostics must not write raw text/phonemes to inherited logs.
    sink = os.open(os.devnull, os.O_WRONLY)
    os.dup2(sink, 1)
    os.dup2(sink, 2)
    os.close(sink)
    os.environ["HF_HUB_OFFLINE"] = "1"
    os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"
    os.environ["DO_NOT_TRACK"] = "1"
    try:
        # Bound ONNX/OpenMP CPU work per independently cancelable process.
        os.environ["OMP_NUM_THREADS"] = str(config["threads"])
        import numpy as np
        stt = None
        voices = {}
        if config["stt_backend"] == "faster-whisper":
            if config["stt_device"] == "cuda":
                import ctranslate2
                if config["stt_compute"] not in ctranslate2.get_supported_compute_types("cuda", 0):
                    raise ValueError("Requested GPU compute is unavailable")
            from faster_whisper import WhisperModel
            stt = WhisperModel(config["stt_model"], device=config["stt_device"],
                               compute_type=config["stt_compute"], cpu_threads=config["threads"],
                               num_workers=1, local_files_only=True)
        if config["tts_backend"] == "piper":
            from piper import PiperVoice
            import onnxruntime as ort
            use_cuda = config["tts_device"] == "cuda"
            if use_cuda and "CUDAExecutionProvider" not in ort.get_available_providers():
                raise ValueError("CUDA TTS provider unavailable")
            for language in ["en", "de"]:
                model = config["voice_" + language]
                if model:
                    # This first path uses bundled eSpeak data, without downloadable G2P.
                    with open(model + ".json", encoding="utf-8") as f:
                        voice_config = json.load(f)
                    if voice_config.get("phoneme_type", "espeak") != "espeak" or not voice_config.get("language", {}).get("code", "").startswith(language):
                        raise ValueError("Unsupported or mismatched voice language")
                    # Keep Piper's phonemizer/config but explicitly bound ORT threads.
                    options = ort.SessionOptions()
                    options.intra_op_num_threads = config["threads"]
                    options.inter_op_num_threads = 1
                    options.log_severity_level = 4
                    from piper.config import PiperConfig
                    providers = [("CUDAExecutionProvider", {"cudnn_conv_algo_search": "HEURISTIC"})] if use_cuda else ["CPUExecutionProvider"]
                    session = ort.InferenceSession(model, sess_options=options, providers=providers)
                    if use_cuda and session.get_providers()[0] != "CUDAExecutionProvider":
                        raise ValueError("CUDA TTS initialization failed; no CPU fallback")
                    session.disable_fallback()
                    voices[language] = PiperVoice(session=session, config=PiperConfig.from_dict(voice_config))
        connection.send({"ready": True, "stt": {"backend": config["stt_backend"], "device": config["stt_device"], "compute": config["stt_compute"], "languages": ["en", "de", "auto"] if stt else []},
                         "tts": {"backend": config["tts_backend"], "device": config["tts_device"], "languages": list(voices)}})
    except Exception:
        connection.send({"ready": False})
        connection.close()
        return
    while True:
        job = None
        samples = audio = pcm = segments = segment = info = text = chunk = None
        try:
            job = connection.recv()
            if job is None:
                break  # Idle shutdown allows native/Python resource finalizers to run.
            if job["kind"] == "stt":
                if stt is None:
                    raise ValueError("STT disabled")
                pcm = job["pcm"]
                samples = np.frombuffer(pcm, dtype="<i2").astype(np.float32) / 32768.0
                try:
                    segments, info = stt.transcribe(samples, language=None if job["language"] == "auto" else job["language"],
                                                    task="transcribe", beam_size=1, temperature=0,
                                                    condition_on_previous_text=False, vad_filter=True,
                                                    log_progress=False)
                    text = ""
                    for segment in segments:
                        text += segment.text
                        if len(text) > 2000:
                            raise ValueError("Transcription limit")
                    if info.language not in LANGUAGES:
                        raise ValueError("Unsupported detected language")
                    connection.send({"ok": True, "data": {"text": text.strip(), "language": info.language}})
                finally:
                    samples.fill(0)
            elif job["kind"] == "tts":
                voice = voices.get(job["language"])
                if voice is None:
                    raise ValueError("Voice unavailable")
                audio = bytearray()
                rate = voice.config.sample_rate
                for chunk in voice.synthesize(job["text"]):
                    if chunk.sample_width != 2 or chunk.sample_channels != 1 or chunk.sample_rate != rate:
                        raise ValueError("Unsupported voice format")
                    audio.extend(chunk.audio_int16_array.astype("<i2", copy=False).tobytes())
                    chunk.audio_float_array.fill(0)
                    chunk.audio_int16_array.fill(0)
                    if len(audio) > min(MAX_AUDIO, rate * 2 * 30):
                        raise ValueError("Synthesis limit")
                connection.send({"ok": True, "pcm": bytes(audio), "sampleRate": rate, "language": job["language"]})
                audio[:] = b"\0" * len(audio)
            else:
                raise ValueError("Unknown job")
        except EOFError:
            break
        except Exception:
            connection.send({"ok": False})
        finally:
            # Python/engine internals may retain transient copies; no secure RAM-erasure claim.
            if samples is not None:
                samples.fill(0)
            if isinstance(audio, bytearray):
                audio[:] = b"\0" * len(audio)
            samples = audio = pcm = segments = segment = info = text = chunk = None
            job = None
    connection.close()


class Worker:
    def __init__(self, config, target=engine_process):
        self.config = config
        self.target = target
        self.lock = threading.Lock()
        self.canceled = threading.Event()
        self.active = None
        self.process = None
        self.connection = None
        self.capabilities = None
        self.early_cancels = {}
        self.cancel_lock = threading.Lock()

    def health(self):
        process, capabilities = self.process, self.capabilities
        try:
            return capabilities if process and process.is_alive() else None
        except (ValueError, OSError):
            return None

    def start(self, deadline):
        context = mp.get_context("spawn")
        self.connection, child = context.Pipe()
        self.process = context.Process(target=self.target, args=(child, self.config.engines()), daemon=True)
        self.process.start()
        child.close()
        while time.monotonic() < deadline and not self.canceled.is_set():
            if self.connection.poll(0.02):
                self.capabilities = self.connection.recv()
                if self.capabilities.get("ready"):
                    return
                break
            if not self.process.is_alive():
                break
        self.dispose()
        raise RuntimeError("Speech engines unavailable")

    def dispose(self, graceful=False):
        if self.process:
            if graceful and self.active is None and self.process.is_alive():
                try:
                    self.connection.send(None)
                    self.process.join(timeout=1)
                except (BrokenPipeError, EOFError, OSError):
                    pass
            if self.process.is_alive():
                self.process.terminate()
                self.process.join(timeout=1)
            if self.process.is_alive():
                self.process.kill()
                self.process.join(timeout=1)
            self.process.close()
        if self.connection:
            self.connection.close()
        self.process = self.connection = self.capabilities = None

    def cancel(self, request_id):
        with self.cancel_lock:
            if self.active == request_id:
                self.canceled.set()
                return True
            # Cancellation may overtake the HTTP inference request. Bounded, transient
            # tombstones prevent a canceled job starting later; IDs contain no utterances.
            cutoff = time.monotonic() - 30
            self.early_cancels = {key: at for key, at in self.early_cancels.items() if at > cutoff}
            if len(self.early_cancels) >= 256:
                return False
            self.early_cancels[request_id] = time.monotonic()
            return False

    def infer(self, request_id, job):
        if not self.lock.acquire(blocking=False):
            raise RuntimeError("Speech engine busy")
        try:
            with self.cancel_lock:
                canceled_at = self.early_cancels.pop(request_id, None)
                if canceled_at is not None and canceled_at > time.monotonic() - 30:
                    raise RuntimeError("Speech request canceled before start")
                self.canceled.clear()
                self.active = request_id
            deadline = time.monotonic() + 20
            if not self.process or not self.process.is_alive():
                self.dispose()
                self.start(deadline)
            self.connection.send(job)
            while time.monotonic() < deadline and not self.canceled.is_set():
                if self.connection.poll(0.02):
                    result = self.connection.recv()
                    if self.canceled.is_set():
                        break
                    if not result.get("ok"):
                        raise RuntimeError("Speech inference unavailable")
                    return result
                if not self.process.is_alive():
                    break
            self.dispose()  # Hard stop in-flight CPU/GPU work; next explicit request reloads.
            raise RuntimeError("Speech request canceled or timed out")
        finally:
            self.active = None
            self.lock.release()


class WorkerPool:
    """No inference queue here. The gateway owns bounded waiting/deadlines.

    Each process has its own model copy, pipe and cancel gate, so killing one
    turn's native inference never kills another participant's work.
    """
    def __init__(self, config, target=engine_process):
        self.workers = {}
        self.lock = threading.Lock()
        self.active = {}
        self.early_cancels = {}
        self.closed = False
        if config.stt_backend != "disabled":
            single = replace(config, tts_backend="disabled", voice_en="", voice_de="")
            self.workers["stt"] = [Worker(single, target) for _ in range(config.stt_workers)]
        if config.tts_backend != "disabled":
            single = replace(config, stt_backend="disabled", stt_model="")
            self.workers["tts"] = [Worker(single, target) for _ in range(config.tts_workers)]

    def start(self, deadline):
        try:
            for workers in self.workers.values():
                for worker in workers:
                    worker.start(deadline)
        except Exception:
            self.dispose()
            raise

    def health(self):
        result = {"ready": True}
        for kind in ["stt", "tts"]:
            workers = self.workers.get(kind, [])
            ready = [state for worker in workers if (state := worker.health()) and state.get("ready")]
            if workers and not ready:
                result["ready"] = False
            backend = getattr(workers[0].config, kind + "_backend") if workers else "disabled"
            details = ready[0][kind] if ready else {"backend": backend, "languages": []}
            result[kind] = {**details, "workers": len(workers), "readyWorkers": len(ready)}
        if self.closed:
            result["ready"] = False
        return result if result["ready"] else None

    def cancel(self, request_id):
        with self.lock:
            worker = self.active.get(request_id)
            if worker:
                return worker.cancel(request_id)
            cutoff = time.monotonic() - 30
            self.early_cancels = {key: at for key, at in self.early_cancels.items() if at > cutoff}
            if len(self.early_cancels) < 256:
                self.early_cancels[request_id] = time.monotonic()
            return False

    def infer(self, request_id, job):
        with self.lock:
            if self.closed or request_id in self.active:
                raise RuntimeError("Unavailable or duplicate speech job")
            canceled_at = self.early_cancels.pop(request_id, None)
            if canceled_at is not None and canceled_at > time.monotonic() - 30:
                raise RuntimeError("Speech request canceled before assignment")
            busy = set(self.active.values())
            worker = next((w for w in self.workers.get(job["kind"], []) if w not in busy), None)
            if worker is None:
                raise RuntimeError("Speech pool busy or disabled")
            self.active[request_id] = worker
        try:
            return worker.infer(request_id, job)
        finally:
            with self.lock:
                self.active.pop(request_id, None)

    def dispose(self, graceful=False):
        with self.lock:
            self.closed = True
            active = list(self.active.items())
        for request_id, worker in active:
            worker.cancel(request_id)
        for workers in self.workers.values():
            for worker in workers:
                # Wait for the canceled request's owner to finish touching its pipe.
                with worker.lock:
                    worker.dispose(graceful=graceful)


class SpeechServer(ThreadingHTTPServer):
    daemon_threads = True
    request_queue_size = 16

    def __init__(self, config, worker):
        self.config = config
        self.worker = worker
        # At most eight inference slots plus room for cancel/health/control calls.
        self.slots = threading.BoundedSemaphore(16)
        super().__init__(("127.0.0.1", config.port), Handler)

    def process_request(self, request, client_address):
        if not self.slots.acquire(blocking=False):
            request.close()
            return
        try:
            super().process_request(request, client_address)
        except Exception:
            self.slots.release()
            raise

    def process_request_thread(self, request, client_address):
        try:
            super().process_request_thread(request, client_address)
        finally:
            self.slots.release()

    def handle_error(self, request, client_address):
        pass  # Never dump request/model context through traceback logging.


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def setup(self):
        super().setup()
        self.connection.settimeout(5)

    def reply(self, status, data=None, pcm=None, extra=None):
        body = pcm if pcm is not None else json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "audio/pcm" if pcm is not None else "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Connection", "close")
        for key, value in (extra or {}).items():
            self.send_header(key, str(value))
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError, socket.timeout):
            pass
        self.close_connection = True

    def allowed(self):
        url = urlsplit(self.path)
        if self.headers.get("Origin") or url.query or self.client_address[0] != "127.0.0.1":
            self.reply(403, {"ok": False, "error": {"code": "FORBIDDEN", "message": "Private speech adapter only"}})
            return False
        if not hmac.compare_digest(self.headers.get("Authorization", "").encode("utf-8"), ("Bearer " + self.server.config.token).encode("utf-8")):
            self.reply(401, {"ok": False, "error": {"code": "UNAUTHORIZED", "message": "Speech credential required"}})
            return False
        return True

    def do_GET(self):
        if self.allowed():
            if self.path == "/health":
                state = self.server.worker.health()
                self.reply(200 if state else 503, {"ok": bool(state), "data": state})
            else:
                self.reply(404, {"ok": False})

    def do_POST(self):
        if not self.allowed():
            return
        try:
            limit = MAX_PCM if self.path == "/v1/stt" else 4096
            length = int(self.headers.get("Content-Length", "0"))
            if self.headers.get("Transfer-Encoding") or not 0 < length <= limit:
                raise ValueError()
            body = self.rfile.read(length)
            if len(body) != length:
                raise ValueError()
            if self.path == "/v1/cancel":
                value = json.loads(body)
                if set(value) != {"requestId"}:
                    raise ValueError()
                request_id = str(UUID(value["requestId"]))
                self.reply(200, {"ok": True, "data": {"applied": self.server.worker.cancel(request_id)}})
                return
            request_id = str(UUID(self.headers.get("X-Lemmi-Request-Id", "")))
            if self.path == "/v1/stt":
                language = self.headers.get("X-Lemmi-Language", "en")
                if self.headers.get_content_type() != "application/octet-stream" or length % 2 or language not in LANGUAGES | {"auto"}:
                    raise ValueError()
                job = {"kind": "stt", "pcm": body, "language": language}
            elif self.path == "/v1/tts":
                value = json.loads(body)
                if self.headers.get_content_type() != "application/json" or set(value) != {"text", "language"} or not isinstance(value["text"], str) or not 0 < len(value["text"].strip()) <= 600 or value["language"] not in LANGUAGES:
                    raise ValueError()
                job = {"kind": "tts", **value}
            else:
                self.reply(404, {"ok": False})
                return
            result = self.server.worker.infer(request_id, job)
            if job["kind"] == "stt":
                self.reply(200, result)
            else:
                self.reply(200, pcm=result["pcm"], extra={"X-Lemmi-Sample-Rate": result["sampleRate"], "X-Lemmi-Encoding": "pcm_s16le", "X-Lemmi-Language": result["language"]})
        except (ValueError, TypeError, KeyError, socket.timeout, UnicodeError):
            self.reply(400, {"ok": False, "error": {"code": "VALIDATION_ERROR", "message": "Invalid or oversized speech request"}})
        except Exception:
            self.reply(503, {"ok": False, "error": {"code": "UNAVAILABLE", "message": "Local speech unavailable, busy or canceled; no fallback was used"}})


def main():
    worker = None
    server = None
    stage = "configuration"
    try:
        config = Config.from_env()
        stage = "engine initialization"
        worker = WorkerPool(config)
        worker.start(time.monotonic() + 120)
        stage = "loopback binding"
        server = SpeechServer(config, worker)
        print(f"Lemmi private speech ready on 127.0.0.1:{server.server_port}; no request/audio/transcript logging", flush=True)
        server.serve_forever(poll_interval=0.1)
    except KeyboardInterrupt:
        pass
    except Exception:
        print(f"Lemmi speech failed at {stage}; check private configuration, model assets and engine installation", flush=True)
        raise SystemExit(1)
    finally:
        # The Bun launcher and terminal can both deliver SIGINT. Finish cleanup even
        # if a second interrupt arrives while joining the inference subprocess.
        signal.signal(signal.SIGINT, signal.SIG_IGN)
        if server:
            server.server_close()
        if worker:
            worker.dispose(graceful=True)


if __name__ == "__main__":
    main()
