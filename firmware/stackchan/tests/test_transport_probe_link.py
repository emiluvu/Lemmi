import importlib.util
from pathlib import Path
import unittest
spec = importlib.util.spec_from_file_location('probe_stack', Path(__file__).parents[1]/'tools/check-stack.py')
probe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(probe)

class ProbeLinkChecks(unittest.TestCase):
    def fixture(self):
        return ''.join(symbol+' /build/sketch.o\n  /sdk/libtcp_transport.a(transport_ssl.c.obj)\n'
                       for symbol in ['__wrap_esp_transport_poll_write','__wrap_esp_tls_conn_write'])
    def test_both_sdk_edges_required(self):
        probe.check_probe_link(self.fixture())
        with self.assertRaises(ValueError):
            probe.check_probe_link(self.fixture().replace('transport_ssl.c.obj','transport_ws.c.obj'))
    def test_missing_tls_hook_fails(self):
        with self.assertRaises(ValueError):
            probe.check_probe_link(self.fixture().split('__wrap_esp_tls_conn_write')[0])
    def test_unrelated_later_reference_does_not_pass(self):
        with self.assertRaises(ValueError):
            probe.check_probe_link(self.fixture().replace('  /sdk/', 'unrelated /sdk/'))
