import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("provision_control", Path(__file__).parents[1] / "tools/provision-control.py")
provision = importlib.util.module_from_spec(spec)
spec.loader.exec_module(provision)


class ProbeChecks(unittest.TestCase):
    class Port:
        def __init__(self, reply_at=None, response=None, short_write=False):
            self.now = 0
            self.sent = []
            self.reply_at = reply_at
            self.response = list(response or [])
            self.short_write = short_write

        def write(self, value):
            self.sent.append((self.now, value))
            return 0 if self.short_write else len(value)

        def read(self, count):
            self.now += 0.2
            if self.reply_at is not None and self.now >= self.reply_at and self.response:
                return self.response.pop(0)
            return b""

    def run_probe(self, port):
        with patch.object(provision.time, 'monotonic', side_effect=lambda: port.now):
            result = provision.probe_control(port)
        self.assertTrue(all(value == b'control.probe\n' for _, value in port.sent))
        self.assertLessEqual(len(port.sent), 15)
        self.assertLessEqual(port.now, 15.3)
        return result

    def test_late_fragmented_reply_after_startup(self):
        port = self.Port(6, [b'event=control_boot capture=off camera=off\n',
                             b'event=control_provision_', b'ready capture=off camera=off\n'])
        self.assertTrue(self.run_probe(port))
        self.assertGreater(len(port.sent), 1)

    def test_timeout_and_wrong_firmware_never_confirm(self):
        for response in ([], [b'event=ready capture=off\n'],
                         [b'event=control_provision_ready capture=off camera=off secret=x\n']):
            port = self.Port(0, response)
            self.assertFalse(self.run_probe(port))

    def test_selftest_failure_and_short_write_stop(self):
        port = self.Port(0, [b'event=control_selftest_failed capture=off camera=off\n'])
        self.assertFalse(self.run_probe(port))
        self.assertEqual(len(port.sent), 1)
        port = self.Port(short_write=True)
        self.assertFalse(self.run_probe(port))
        self.assertEqual(len(port.sent), 1)

class ProvisionChecks(unittest.TestCase):
    def test_voice_observers_accept_only_fixed_status_without_content(self):
        import ast,re
        tree=ast.parse((Path(__file__).parents[1]/'tools/monitor.py').read_text())
        expr=next(n.value for n in tree.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='diagnostics' for t in n.targets))
        for pattern in (provision.STATUS,re.compile(ast.literal_eval(expr.args[0]))):
            for line in [
                'event=voice_send_failed reason=6 status=2 result=0 bytes=0 send_max_ms=100 capture_sent=100 camera=off',
                'event=voice_fault code=2 send_max_ms=100 capture_sent=3 heap_free=70000 camera=off',
                'event=voice_transport_probe polls=5 poll_zero=5 poll_error=0 poll_max_us=20000 writes=0 write_zero=0 write_want=0 write_error=0 write_max_us=0 camera=off',
                'event=voice_link nodelay=1 wifi_sleep=0 camera=off',
                'event=voice_ready audio=1 output_window=12 language=en camera=off',
                'event=voice_ready audio=1 output_window=4 language=de camera=off',
                'event=voice_stream received=12 consumed=8 buffer_waits=1 camera=off',
                'event=voice_boot reset=1 heap_free=200000 loop_min=4000 camera=off',
                'event=voice_memory loop_min=3000 worker_min=10000 heap_free=160000 camera=off',
                'event=voice_audio capture=on playback=off camera=off',
                'event=voice_audio capture=off playback=on camera=off',
                'event=voice_state phase=listening stopped=0 owner=1 camera=off',
                'event=voice_ack applied=1 camera=off',
                'event=voice_control_ready camera=off',
                'event=voice_control_handoff_requested camera=off',
                'event=voice_reject stage=reply_binding camera=off',
                'event=voice_transport_exit stage=read result=-1 opcode=256 upgrade=101 errno=0 wifi=3 reason=0 ready=1 age_ms=500 camera=off',
            ]:
                self.assertTrue(pattern.fullmatch(line))
                self.assertFalse(pattern.fullmatch(line+' transcript=private'))
            self.assertFalse(pattern.fullmatch('event=voice_transport_probe polls=private poll_zero=0 camera=off'))
            self.assertFalse(pattern.fullmatch('event=voice_audio capture=private playback=off camera=off'))
            self.assertFalse(pattern.fullmatch('event=voice_reject stage=secret camera=off'))
            self.assertFalse(pattern.fullmatch('event=voice_send_failed reason=secret status=0 result=0 bytes=0 send_max_ms=0 capture_sent=0 camera=off'))
            self.assertFalse(pattern.fullmatch('event=voice_fault code=13 send_max_ms=0 capture_sent=0 heap_free=0 camera=off'))

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
        self.assertTrue(provision.STATUS.fullmatch("event=control_wifi_failure status=6 reason=202 capture=off camera=off"))
        self.assertFalse(provision.STATUS.fullmatch("event=control_wifi_failure ssid=private status=6 reason=202 capture=off camera=off"))
        self.assertTrue(provision.STATUS.fullmatch("event=control_state phase=paused stopped=1 capture=off camera=off"))
        self.assertFalse(provision.STATUS.fullmatch("credential=private"))
        self.assertFalse(provision.STATUS.fullmatch("event=control_ready credential=private capture=off camera=off"))

    def test_wifi_only_needs_no_backend_secrets(self):
        config=dict(ssid="fictional-wifi",password="test-password",wifiOnly=True,utcEpoch=1800000000)
        self.assertTrue(provision.valid_wifi(config))
        self.assertFalse({"accessKey","pairingId","code","caregiverToken"} & set(config))
        self.assertFalse(provision.valid_wifi(dict(ssid="",password="")))
        self.assertTrue(provision.STATUS.fullmatch("event=control_wifi_ready capture=off camera=off"))

    def test_claim_diagnostics_allow_only_fixed_stages_and_numbers(self):
        # Check both readers without importing monitor.py (which opens serial).
        import ast
        tree=ast.parse((Path(__file__).parents[1] / "tools/monitor.py").read_text())
        expr=next(node.value for node in tree.body if isinstance(node,ast.Assign) and any(isinstance(t,ast.Name) and t.id=="diagnostics" for t in node.targets))
        import re
        monitor_pattern=re.compile(ast.literal_eval(expr.args[0]))
        for pattern in (provision.STATUS,monitor_pattern):
            for stage in ("open","status","shape","expiry","ok"):
                line=f"event=control_claim_result stage={stage} http=403 error=-1 errno=60 length=-1 received=0 capture=off camera=off"
                self.assertTrue(pattern.fullmatch(line))
                self.assertFalse(pattern.fullmatch(line.replace(stage,"private-token",1)))
                self.assertFalse(pattern.fullmatch(line+" credential=private"))
                self.assertFalse(pattern.fullmatch(line.replace("http=403","http=private")))

    def test_protocol_diagnostics_and_owner_filter_redact_payloads(self):
        import ast,re
        tree=ast.parse((Path(__file__).parents[1]/'tools/monitor.py').read_text())
        expr=next(n.value for n in tree.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='diagnostics' for t in n.targets))
        for pattern in (provision.STATUS,re.compile(ast.literal_eval(expr.args[0]))):
            for line in ['event=control_owner local=0 capture=off camera=off',
                         'event=control_handoff_requested capture=off camera=off',
                         'event=control_protocol_reject stage=ready_controls capture=off camera=off',
                         'event=control_transport_exit stage=read result=-1 opcode=1 upgrade=101 errno=0 wifi=3 reason=0 ready=1 age_ms=400 capture=off camera=off',
                         'event=control_transport_exit stage=close result=0 opcode=8 upgrade=101 errno=0 wifi=3 reason=0 ready=1 age_ms=500 capture=off camera=off']:
                self.assertTrue(pattern.fullmatch(line))
                self.assertFalse(pattern.fullmatch(line+' token=private'))
            self.assertFalse(pattern.fullmatch('event=control_protocol_reject stage=private-content capture=off camera=off'))
            self.assertFalse(pattern.fullmatch('event=control_owner local=private capture=off camera=off'))
            self.assertFalse(pattern.fullmatch('event=control_transport_exit stage=private result=-1 opcode=1 upgrade=101 errno=0 wifi=3 reason=0 ready=1 age_ms=400 capture=off camera=off'))

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


class PairingCreation(unittest.TestCase):
    def response(self, **changes):
        import datetime
        data=dict(deviceId="stackchan-alex", profileId="profile-alex", pairingId="fixture-pair", code="x" * 24,
                  expiresAt=(datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(seconds=240)).isoformat())
        data.update(changes)
        return provision.json.dumps(dict(ok=True, data=data)).encode()

    def call(self, body):
        from unittest.mock import patch, MagicMock
        response=MagicMock(); response.status=200; response.read.return_value=body
        opener=MagicMock(); opener.open.return_value.__enter__.return_value=response
        with patch.object(provision.urllib.request,"build_opener",return_value=opener):
            result=provision.create_pairing("d" * 32,"fictional-caregiver-token")
        return result, opener.open.call_args.args[0]

    def test_correct_scope_and_only_mac_has_caregiver_token(self):
        result, request=self.call(self.response())
        self.assertEqual(result,("fixture-pair","x" * 24))
        self.assertEqual(request.full_url, provision.ORIGIN+"/v1/devices/stackchan-alex/pairings")
        self.assertEqual(request.get_header("Authorization"),"Bearer fictional-caregiver-token")
        body=provision.json.loads(request.data)
        self.assertEqual(set(body),{"deviceId","profileId","commandId"})
        provision.uuid.UUID(body["commandId"])

    def test_wrong_binding_expiry_and_oversize_fail_closed(self):
        for body in [self.response(profileId="foreign"),self.response(code="short"),self.response(expiresAt="2000-01-01T00:00:00Z"),b"x" * 4097]:
            with self.assertRaises(SystemExit): self.call(body)

    def test_redirect_is_not_followed_and_header_injection_rejected(self):
        self.assertIsNone(provision.NoRedirect().redirect_request(None,None,302,"",{},"https://other.example"))
        with self.assertRaises(SystemExit): provision.create_pairing("d" * 32,"bad\ntoken")


class CredentialFile(unittest.TestCase):
    def fixture(self):
        return dict(backendUrl=provision.ORIGIN,websocketUrl='wss://lemmi.chaoswarrior.dev/v1/device-stream',
                    deviceId='stackchan-alex',profileId='profile-alex',credential='c'*64,expiresAt=None,
                    headers={'Authorization':'Bearer '+'c'*64,'X-Lemmi-Access-Key':'a'*32})

    def load(self,value,mode=0o600,raw=None):
        import tempfile,os
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'access.json'
            path.write_text(raw if raw is not None else provision.json.dumps(value));os.chmod(path,mode)
            return provision.load_credential_file(path)

    def test_valid_private_credential_has_no_pairing_or_caregiver_fields(self):
        result=self.load(self.fixture())
        self.assertEqual(set(result),{'accessKey','credential','expiresAt'})
        self.assertIsNone(result['expiresAt'])

    def test_wrong_scope_server_auth_expiry_and_permissions_rejected(self):
        for key,value in [('profileId','foreign'),('deviceId','other'),('backendUrl','https://other.example'),
                          ('websocketUrl','ws://lemmi.chaoswarrior.dev/v1/device-stream'),
                          ('expiresAt','2000-01-01T00:00:00Z'),('credential','short')]:
            fixture=self.fixture();fixture[key]=value
            with self.assertRaises(SystemExit):self.load(fixture)
        fixture=self.fixture();fixture['headers']['Authorization']='Bearer mismatch'
        with self.assertRaises(SystemExit):self.load(fixture)
        with self.assertRaises(SystemExit):self.load(self.fixture(),mode=0o644)
        with self.assertRaises(SystemExit):self.load({},raw='{"credential":"one","credential":"two"}')
        with self.assertRaises(SystemExit):self.load({},raw='x'*8193)

    def test_future_expiry_preserved_as_utc(self):
        import datetime
        fixture=self.fixture()
        fixture['expiresAt']=(datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(minutes=30)).isoformat()
        result=self.load(fixture)
        self.assertTrue(result['expiresAt'].endswith('Z'))

if __name__ == "__main__":
    unittest.main()
