"""Local fixtures only: no live provider, production pairing or token persistence."""
import base64
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import threading
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.parse import parse_qs, urlencode, urlsplit
from urllib.request import urlopen

spec = importlib.util.spec_from_file_location('pair_stackchan', Path(__file__).resolve().parents[1] / 'scripts/pair-stackchan.py')
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)


class PairingHelper(unittest.TestCase):
    def setUp(self):
        self.config = {'LEMMI_PUBLIC_ORIGIN': 'https://lemmi.invalid',
                       'LEMMI_ACCESS_KEY': 'fixture-key',
                       'LEMMI_AUTH_ISSUER': 'https://identity.invalid/oidc',
                       'LEMMI_AUTH_CLIENT_ID': 'fixture-client',
                       'LEMMI_AUTH_CLIENT_SECRET': 'fixture-secret'}

    def test_pair_uses_public_auth_and_fresh_commands_without_claiming(self):
        fixture = {'ok': True, 'data': {'deviceId': 'stackchan-alex', 'profileId': 'profile-alex',
                   'pairingId': 'fixture-pairing', 'code': 'fixture-code', 'expiresAt': 'fixture-time'}}
        with patch.object(helper, 'request_json', return_value=fixture) as request:
            for _ in range(2):
                self.assertEqual(helper.create_pairing(self.config, 'fixture-token')['pairingId'], 'fixture-pairing')
            calls = request.call_args_list
        self.assertEqual(len(calls), 2)
        commands = []
        for call in calls:
            url, body, headers = call.args
            self.assertEqual(url, 'https://lemmi.invalid/v1/devices/stackchan-alex/pairings')
            self.assertEqual(headers['Authorization'], 'Bearer fixture-token')
            self.assertEqual(headers['X-Lemmi-Access-Key'], 'fixture-key')
            self.assertEqual(headers['Origin'], 'https://lemmi.invalid')
            commands.append(json.loads(body)['commandId'])
        self.assertNotEqual(*commands)

    def test_wrong_assignment_and_plaintext_are_rejected(self):
        with patch.object(helper, 'request_json', return_value={'ok': True, 'data': {'deviceId': 'other'}}):
            with self.assertRaises(ValueError):
                helper.create_pairing(self.config, 'fixture-token')
        for url in ['http://identity.invalid', 'https://user:password@identity.invalid']:
            with self.assertRaises(ValueError):
                helper.https(url)
        self.assertIsNone(helper.NoRedirect().redirect_request(None, None, None, None, None, None))

    def test_private_settings_are_read_without_modifying_them(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / '.env'
            content = '# fixture\nLEMMI_ACCESS_KEY="quoted-fixture"\n'
            path.write_text(content)
            with patch.dict(helper.os.environ, {}, clear=True):
                self.assertEqual(helper.settings(path)['LEMMI_ACCESS_KEY'], 'quoted-fixture')
            self.assertEqual(path.read_text(), content)

    def test_browser_callback_checks_state_and_token_exchange_uses_pkce(self):
        issuer = self.config['LEMMI_AUTH_ISSUER']
        authorization = {}
        workers, failures = [], []

        def printed(value):
            if not value.startswith(issuer):
                return
            authorization.update(parse_qs(urlsplit(value).query))

            def callback():
                try:
                    base = 'http://127.0.0.1:3333/callback?'
                    with self.assertRaises(HTTPError) as error:
                        urlopen(base + urlencode({'state': 'wrong', 'code': 'fixture-code'}), timeout=3)
                    self.assertEqual(error.exception.code, 403)
                    error.exception.close()
                    with urlopen(base + urlencode({'state': authorization['state'][0], 'code': 'fixture-code'}), timeout=3) as response:
                        self.assertEqual(response.status, 200)
                        self.assertEqual(response.headers['Cache-Control'], 'no-store')
                except Exception as error:
                    failures.append(type(error).__name__)

            worker = threading.Thread(target=callback, daemon=True)
            workers.append(worker)
            worker.start()

        def provider(url, body=None, headers=None):
            if url.endswith('/.well-known/openid-configuration'):
                return {'issuer': issuer, 'authorization_endpoint': issuer + '/auth', 'token_endpoint': issuer + '/token'}
            self.assertEqual(url, issuer + '/token')
            fields = parse_qs(body.decode())
            verifier = fields['code_verifier'][0]
            challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip('=')
            self.assertEqual(challenge, authorization['code_challenge'][0])
            self.assertEqual(fields['code'], ['fixture-code'])
            self.assertEqual(headers['Authorization'], 'Basic ' + base64.b64encode(b'fixture-client:fixture-secret').decode())
            return {'access_token': 'fixture-token', 'token_type': 'Bearer'}

        with patch.object(helper, 'request_json', side_effect=provider), patch('builtins.print', side_effect=printed):
            self.assertEqual(helper.login(self.config), 'fixture-token')
        for worker in workers:
            worker.join(timeout=4)
            self.assertFalse(worker.is_alive())
        self.assertEqual(failures, [])


if __name__ == '__main__':
    unittest.main()
