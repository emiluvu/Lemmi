#!/usr/bin/env python3
"""Create and claim a device credential into one private team access file."""
import argparse
import base64
import getpass
import hashlib
import json
import os
from pathlib import Path
import secrets
import shlex
import sys
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, quote, urlencode, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener
import uuid


class PairingError(ValueError):
    """Application-authored diagnostics safe to show without provider response bodies."""


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def settings(path):
    values = {}
    if path.exists():
        for line in path.read_text().splitlines():
            if not line.strip() or line.lstrip().startswith('#') or '=' not in line:
                continue
            key, value = line.split('=', 1)
            value = value.strip()
            values[key.strip()] = (shlex.split(value)[0] if value else '')
    return {**values, **os.environ}


def https(url):
    parsed = urlsplit(url)
    if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password or parsed.fragment:
        raise ValueError('Expected an HTTPS URL without embedded credentials or fragment')
    return url


def request_json(url, body=None, headers=None):
    request = Request(https(url), data=body, headers={
        'User-Agent': 'Lemmi-pairing-helper/1', **(headers or {}),
    })
    try:
        with build_opener(NoRedirect()).open(request, timeout=15) as response:
            data = response.read(65537)
            if len(data) > 65536:
                raise ValueError('Response exceeds the helper limit')
            return json.loads(data)
    except HTTPError as error:
        status = error.code
        error.close()  # Provider error bodies can contain private values; never print them.
        guidance = {
            400: 'check the registered redirect/client settings and request format',
            401: 'check the access key and caregiver sign-in; the token may be expired',
            403: 'check assigned caregiver, exact Origin, and provider/edge access policy',
            409: 'a device is already enrolled or a five-minute pairing is pending; claim the existing pairing, wait for its expiry, or explicitly revoke the old enrollment',
            429: 'request limit reached; wait before starting a new explicit attempt',
            503: 'backend or identity provider unavailable; check service/database health',
        }.get(status, 'check HTTPS service availability and client configuration')
        raise PairingError(f'HTTP {status}: {guidance}') from None
    except (URLError, OSError, json.JSONDecodeError):
        raise ValueError('HTTPS request failed; check network, certificates and service availability') from None


def login(config):
    issuer = https(config['LEMMI_AUTH_ISSUER'])
    metadata = request_json(issuer.rstrip('/') + '/.well-known/openid-configuration')
    if metadata.get('issuer') != issuer:
        raise ValueError('OIDC issuer mismatch')
    endpoints = [https(metadata[key]) for key in ('authorization_endpoint', 'token_endpoint')]
    if any(urlsplit(url).netloc != urlsplit(issuer).netloc for url in endpoints):
        raise ValueError('Unexpected OIDC endpoint host')
    redirect = 'http://127.0.0.1:3333/callback'
    state, verifier = secrets.token_urlsafe(32), secrets.token_urlsafe(48)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip('=')
    result = {}

    class Callback(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass  # Never log authorization codes or callback query strings.

        def do_GET(self):
            url = urlsplit(self.path)
            query = parse_qs(url.query)
            valid = (self.headers.get('Host') == '127.0.0.1:3333'
                     and url.path == '/callback'
                     and query.get('state') == [state]
                     and len(query.get('code', [])) == 1
                     and 0 < len(query['code'][0]) <= 4096)
            self.send_response(200 if valid else 403)
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Referrer-Policy', 'no-referrer')
            self.send_header('Content-Security-Policy', "default-src 'none'")
            self.end_headers()
            self.wfile.write(b'Return to the pairing terminal.' if valid else b'Invalid callback.')
            if valid:
                result['code'] = query['code'][0]

    with HTTPServer(('127.0.0.1', 3333), Callback) as server:
        server.timeout = 1
        print('Open in a browser on this machine (or use SSH forwarding for port 3333):')
        print(endpoints[0] + '?' + urlencode({
            'client_id': config['LEMMI_AUTH_CLIENT_ID'], 'redirect_uri': redirect,
            'response_type': 'code', 'scope': 'openid', 'state': state,
            'code_challenge': challenge, 'code_challenge_method': 'S256',
        }))
        deadline = time.monotonic() + 300
        while 'code' not in result and time.monotonic() < deadline:
            server.handle_request()
    if 'code' not in result:
        raise ValueError('Login timed out; run the helper again')
    basic = base64.b64encode((':'.join(quote(config[key], safe='') for key in
                             ('LEMMI_AUTH_CLIENT_ID', 'LEMMI_AUTH_CLIENT_SECRET'))).encode()).decode()
    try:
        tokens = request_json(endpoints[1], urlencode({
            'grant_type': 'authorization_code', 'code': result['code'],
            'redirect_uri': redirect, 'code_verifier': verifier,
        }).encode(), {'Authorization': 'Basic ' + basic,
                     'Content-Type': 'application/x-www-form-urlencoded'})
    except PairingError as error:
        raise PairingError('VoidAuth token exchange: ' + str(error)) from None
    if tokens.get('token_type') != 'Bearer' or not isinstance(tokens.get('access_token'), str) or not tokens['access_token']:
        raise ValueError('Provider did not return a Bearer access token')
    return tokens['access_token']  # Backend verifies issuer, binding, expiry and assigned subject.


def create_pairing(config, token, persistent=True):
    origin = https(config.get('LEMMI_PUBLIC_ORIGIN') or 'https://lemmi.chaoswarrior.dev')
    parsed = urlsplit(origin)
    if parsed.path or parsed.query:
        raise ValueError('LEMMI_PUBLIC_ORIGIN must be an origin without a path/query')
    body = {'deviceId': 'stackchan-alex', 'profileId': 'profile-alex', 'commandId': str(uuid.uuid4())}
    if persistent:
        body['credentialMode'] = 'persistent'
    try:
        result = request_json(origin + '/v1/devices/stackchan-alex/pairings', json.dumps(body).encode(), {'Authorization': 'Bearer ' + token, 'X-Lemmi-Access-Key': config['LEMMI_ACCESS_KEY'],
                     'Content-Type': 'application/json', 'Origin': origin})
    except PairingError as error:
        raise PairingError('Backend pairing request: ' + str(error)) from None
    if result.get('ok') is not True:
        raise ValueError('Pairing rejected; an existing device may need explicit revocation')
    data = result['data']
    if data.get('deviceId') != 'stackchan-alex' or data.get('profileId') != 'profile-alex':
        raise ValueError('Unexpected pairing assignment')
    return {key: data[key] for key in ('pairingId', 'code', 'expiresAt')}


def claim_pairing(config, pairing):
    origin = config.get('LEMMI_PUBLIC_ORIGIN') or 'https://lemmi.chaoswarrior.dev'
    try:
        result = request_json(origin + '/v1/device-pairings/claim', json.dumps({
            'pairingId': pairing['pairingId'], 'code': pairing['code'], 'localConfirmed': True,
        }).encode(), {'X-Lemmi-Access-Key': config['LEMMI_ACCESS_KEY'],
                     'Content-Type': 'application/json', 'Origin': origin})
    except PairingError as error:
        raise PairingError('Device credential claim: ' + str(error)) from None
    if result.get('ok') is not True:
        raise PairingError('Device claim rejected; explicitly revoke/re-enroll if the claim response was lost')
    data = result['data']
    if (data.get('deviceId') != 'stackchan-alex' or data.get('profileId') != 'profile-alex'
            or not isinstance(data.get('credential'), str)
            or not 40 <= len(data['credential']) <= 512
            or any(not 33 <= ord(c) <= 126 for c in data['credential'])
            or (data.get('expiresAt') is not None and not isinstance(data['expiresAt'], str))):
        raise PairingError('Unexpected device credential response')
    return data


def credential_bundle(config, device):
    origin = https(config.get('LEMMI_PUBLIC_ORIGIN') or 'https://lemmi.chaoswarrior.dev')
    return {
        'backendUrl': origin, 'websocketUrl': 'wss://' + urlsplit(origin).netloc + '/v1/device-stream',
        'deviceId': device['deviceId'], 'profileId': device['profileId'],
        'credential': device['credential'], 'expiresAt': device['expiresAt'],
        'headers': {'Authorization': 'Bearer ' + device['credential'],
                    'X-Lemmi-Access-Key': config['LEMMI_ACCESS_KEY']},
    }


def reserve_output(path):
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    try:
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError:
        raise PairingError('Access file already exists; reuse it or choose a new --output path. No new pairing was requested') from None
    os.fchmod(fd, 0o600)
    return os.fdopen(fd, 'w', encoding='utf-8')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--env-file', type=Path, default=Path(__file__).resolve().parents[1] / '.env')
    parser.add_argument('--token', action='store_true', help='Prompt privately for an existing caregiver token instead of browser login')
    parser.add_argument('--pair-only', action='store_true', help='Print an unclaimed ID/code for robot-side claim instead of creating the team access file')
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[1] / '.data' / 'stackchan-access.json', help='Private credential bundle path; existing files are never overwritten')
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--persistent', dest='persistent', action='store_true', help='Use a database-backed key valid until revoked (default)')
    mode.add_argument('--short-lived', dest='persistent', action='store_false', help='Use the original one-hour credential instead')
    parser.set_defaults(persistent=True)
    args = parser.parse_args()
    output = None
    claimed = saved = False
    try:
        # Reserve mode-0600 storage before requesting a single-use credential.
        if not args.pair_only:
            output = reserve_output(args.output)
        config = settings(args.env_file)
        if not config.get('LEMMI_ACCESS_KEY'):
            config['LEMMI_ACCESS_KEY'] = getpass.getpass('Lemmi access key: ')
        token = getpass.getpass('Caregiver VoidAuth access token: ') if args.token else login(config)
        if not token:
            raise ValueError('A caregiver access token is required')
        pairing = create_pairing(config, token, args.persistent)
        if args.pair_only:
            print('\nPrivate pairing details for robot-side claim (expire in five minutes):')
            print(json.dumps(pairing, indent=2))
            print('Unclaimed; no credential file saved.')
        else:
            device = claim_pairing(config, pairing)
            claimed = True
            if args.persistent and device['expiresAt'] is not None:
                raise PairingError('Persistent claim unexpectedly returned a finite expiry')
            json.dump(credential_bundle(config, device), output, indent=2)
            output.write('\n')
            output.flush()
            os.fsync(output.fileno())
            saved = True
            print(f'Credential claimed and saved privately: {args.output.resolve()}')
            print('Send this one file privately to authorized teammates; it includes the reusable device credential, headers and URLs.')
            print('Device access only; caregiver/admin actions still require caregiver sign-in. One active WSS client at a time.')
    except KeyError:
        parser.exit(1, 'Missing settings: browser login needs LEMMI_AUTH_ISSUER, LEMMI_AUTH_CLIENT_ID and LEMMI_AUTH_CLIENT_SECRET. Use --token if you already have a caregiver token.\n')
    except PairingError as error:
        parser.exit(1, f'Pairing failed. {error}. No automatic revoke or retry was attempted.\n')
    except (ValueError, OSError):
        # Do not include a raw exception/traceback that could expose an OAuth URL or response.
        parser.exit(1, 'Pairing failed. Check HTTPS connectivity, client settings, assigned caregiver and existing pairing/device state. No automatic revoke or retry was attempted.\n')
    except KeyboardInterrupt:
        parser.exit(130, '\nCanceled. Caregiver tokens are never saved.\n')
    finally:
        if output:
            output.close()
            if not saved and not claimed:
                args.output.unlink(missing_ok=True)
            elif claimed and not saved:
                print('Claim succeeded but saving failed. Preserve the output file; if unusable, revoke and enroll again. Do not repeat the consumed claim.', file=sys.stderr)


if __name__ == '__main__':
    main()
