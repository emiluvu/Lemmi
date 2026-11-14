#!/usr/bin/env python3
"""Create an unclaimed Stackchan pairing. Python 3.10+, standard library only."""
import argparse
import base64
import getpass
import hashlib
import json
import os
from pathlib import Path
import secrets
import shlex
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, quote, urlencode, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener
import uuid


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
        raise ValueError(f'HTTP {status}: check credentials, client configuration and pairing state') from None
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
    tokens = request_json(endpoints[1], urlencode({
        'grant_type': 'authorization_code', 'code': result['code'],
        'redirect_uri': redirect, 'code_verifier': verifier,
    }).encode(), {'Authorization': 'Basic ' + basic,
                 'Content-Type': 'application/x-www-form-urlencoded'})
    if tokens.get('token_type') != 'Bearer' or not isinstance(tokens.get('access_token'), str) or not tokens['access_token']:
        raise ValueError('Provider did not return a Bearer access token')
    return tokens['access_token']  # Backend verifies issuer, binding, expiry and assigned subject.


def create_pairing(config, token):
    origin = https(config.get('LEMMI_PUBLIC_ORIGIN') or 'https://lemmi.chaoswarrior.dev')
    parsed = urlsplit(origin)
    if parsed.path or parsed.query:
        raise ValueError('LEMMI_PUBLIC_ORIGIN must be an origin without a path/query')
    result = request_json(origin + '/v1/devices/stackchan-alex/pairings', json.dumps({
        'deviceId': 'stackchan-alex', 'profileId': 'profile-alex', 'commandId': str(uuid.uuid4()),
    }).encode(), {'Authorization': 'Bearer ' + token, 'X-Lemmi-Access-Key': config['LEMMI_ACCESS_KEY'],
                 'Content-Type': 'application/json', 'Origin': origin})
    if result.get('ok') is not True:
        raise ValueError('Pairing rejected; an existing device may need explicit revocation')
    data = result['data']
    if data.get('deviceId') != 'stackchan-alex' or data.get('profileId') != 'profile-alex':
        raise ValueError('Unexpected pairing assignment')
    return {key: data[key] for key in ('pairingId', 'code', 'expiresAt')}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--env-file', type=Path, default=Path(__file__).resolve().parents[1] / '.env')
    parser.add_argument('--token', action='store_true', help='Prompt privately for an existing caregiver token instead of browser login')
    args = parser.parse_args()
    try:
        config = settings(args.env_file)
        if not config.get('LEMMI_ACCESS_KEY'):
            config['LEMMI_ACCESS_KEY'] = getpass.getpass('Lemmi access key: ')
        token = getpass.getpass('Caregiver VoidAuth access token: ') if args.token else login(config)
        if not token:
            raise ValueError('A caregiver access token is required')
        pairing = create_pairing(config, token)
        print('\nPrivate pairing details for Stackchan (expire in five minutes):')
        print(json.dumps(pairing, indent=2))
        print('Not claimed or saved. Give the ID and code to Stackchan; keep them out of logs/Git.')
    except KeyError:
        parser.exit(1, 'Missing settings: browser login needs LEMMI_AUTH_ISSUER, LEMMI_AUTH_CLIENT_ID and LEMMI_AUTH_CLIENT_SECRET. Use --token if you already have a caregiver token.\n')
    except (ValueError, OSError):
        # Do not include a raw exception/traceback that could expose an OAuth URL or response.
        parser.exit(1, 'Pairing failed. Check HTTPS connectivity, client settings, assigned caregiver and existing pairing/device state. No automatic revoke or retry was attempted.\n')
    except KeyboardInterrupt:
        parser.exit(130, '\nCanceled. No token was saved.\n')


if __name__ == '__main__':
    main()
