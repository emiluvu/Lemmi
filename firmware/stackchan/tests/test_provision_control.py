import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("provision_control", Path(__file__).parents[1] / "tools/provision-control.py")
provision = importlib.util.module_from_spec(spec)
spec.loader.exec_module(provision)

class ProvisionChecks(unittest.TestCase):
    def valid(self):
        return dict(ssid="fictional-wifi", password="fictional-password", accessKey="x" * 32, pairingId="fixture-pair", code="y" * 24)

    def test_header_injection_and_bounds(self):
        for field in ("accessKey", "code"):
            value = self.valid(); value[field] = value[field][:-1] + "\n"
            self.assertFalse(provision.valid(value))
        value=self.valid(); value["accessKey"]="x" * 257
        self.assertFalse(provision.valid(value))
        value=self.valid(); value["code"]="x" * 23
        self.assertFalse(provision.valid(value))

    def test_status_log_rejects_credentials_or_arbitrary_output(self):
        self.assertTrue(provision.STATUS.fullmatch("event=control_ready capture=off camera=off"))
        self.assertTrue(provision.STATUS.fullmatch("event=control_state phase=paused stopped=1 capture=off camera=off"))
        self.assertFalse(provision.STATUS.fullmatch("credential=private"))
        self.assertFalse(provision.STATUS.fullmatch("event=control_ready credential=private capture=off camera=off"))

    def test_wifi_utf8_byte_limits(self):
        self.assertTrue(provision.valid(self.valid()))
        value=self.valid(); value["ssid"]="é" * 16
        self.assertTrue(provision.valid(value))
        value["ssid"] += "é"
        self.assertFalse(provision.valid(value))
        value=self.valid(); value["password"]=""
        self.assertTrue(provision.valid(value))
        value["password"]="x" * 64
        self.assertFalse(provision.valid(value))

if __name__ == "__main__":
    unittest.main()
