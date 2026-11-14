"""Polling terminal input: no blocking input(), background reader, or late queue."""

import os
import select
import sys
import time


class TerminalInput:
    def __init__(self, stream=None, output=None, clock=time.monotonic):
        self.stream = stream or sys.stdin
        self.output = output or sys.stdout
        self.clock = clock
        self.pending = b""

    def read(self, prompt, timeout):
        """Return a line, None at deadline, or raise EOFError at closed input."""
        self.output.write(prompt)
        self.output.flush()
        deadline = self.clock() + timeout
        if os.name == "nt" and self.stream.isatty():
            return self._windows_console(deadline)
        return self._stream(deadline)

    def _windows_console(self, deadline):
        import msvcrt

        chars = []
        extended = False
        while self.clock() < deadline:
            if not msvcrt.kbhit():
                time.sleep(0.01)
                continue
            char = msvcrt.getwch()
            if extended:
                extended = False
                continue
            if char in ("\x00", "\xe0"):
                extended = True
            elif char == "\x03":
                raise KeyboardInterrupt
            elif char == "\x1a":
                raise EOFError
            elif char in ("\r", "\n"):
                self.output.write("\n")
                self.output.flush()
                return "".join(chars)
            elif char == "\b":
                if chars:
                    chars.pop()
                    self.output.write("\b \b")
                    self.output.flush()
            elif char.isprintable():
                chars.append(char)
                self.output.write(char)
                self.output.flush()
        # Discard a partially typed answer; it cannot answer the next question.
        self.output.write("\n")
        self.output.flush()
        return None

    def _stream(self, deadline):
        while self.clock() < deadline:
            if b"\n" in self.pending:
                line, self.pending = self.pending.split(b"\n", 1)
                return line.rstrip(b"\r").decode(self.stream.encoding or "utf-8", errors="replace")
            remaining = max(0, deadline - self.clock())
            if os.name == "nt":
                import ctypes
                import msvcrt
                available = ctypes.c_ulong()
                kernel = ctypes.WinDLL("kernel32", use_last_error=True)
                peek = kernel.PeekNamedPipe
                peek.argtypes = [ctypes.c_void_p, ctypes.c_void_p, ctypes.c_ulong,
                                 ctypes.c_void_p, ctypes.POINTER(ctypes.c_ulong), ctypes.c_void_p]
                peek.restype = ctypes.c_int
                handle = msvcrt.get_osfhandle(self.stream.fileno())
                if not peek(handle, None, 0, None, ctypes.byref(available), None):
                    if ctypes.get_last_error() == 109:  # closed pipe
                        if self.pending:
                            line, self.pending = self.pending, b""
                            return line.decode(self.stream.encoding or "utf-8", errors="replace")
                        raise EOFError
                    raise OSError(ctypes.get_last_error(), "Expected a console or input pipe")
                if not available.value:
                    time.sleep(min(0.01, remaining))
                    continue
            elif not select.select([self.stream], [], [], remaining)[0]:
                break
            chunk = os.read(self.stream.fileno(), 1)
            if not chunk:
                if self.pending:
                    line, self.pending = self.pending, b""
                    return line.decode(self.stream.encoding or "utf-8", errors="replace")
                raise EOFError
            self.pending += chunk
        self.pending = b""
        if os.name != "nt" and self.stream.isatty():
            import termios
            termios.tcflush(self.stream.fileno(), termios.TCIFLUSH)
        return None
