# Anay → Emilia / Kylie: authenticated control foundation

**Scope:** fictional Alex, one configured caregiver subject, one assigned device `stackchan-alex`. This implements the first control increment from [Emilia's handoff](anay-device-integration.md). It does not complete F13, speech, sign-in UI, persistence or real caregiver contact.

## What is implemented

- One existing `SessionCoordinator`, extracted from the mock coordinator. `MockCoordinator` remains an explicit mock wrapper. The gateway selects mock **or** authenticated control mode at startup; it never runs competing session authorities.
- Managed caregiver token verification through a configurable [RFC 7662 introspection endpoint](https://www.rfc-editor.org/rfc/rfc7662.html). Issuer, audience, active status, Bearer token type, expiry and configured subject assignment are checked server-side. No cookie/role switch/static caregiver password grants access.
- Scoped pairing, explicit local-confirmation claim, one-hour bearer device credentials, revocation, active-socket authorization checks and expiry. Only Alex and `stackchan-alex` are assigned. Device credentials cannot access caregiver routes or the private gateway adapter.
- Control-only hello, heartbeat, start/pause/resume/stop/mute and fixed help routing. Audio, camera, activities and teaching on this transport return explicit unavailable results. Capture grants remain null.
- Existing loopback mock UI/RPC/music/fake-device behavior remains available in mock mode. Live requests never become simulated success.

`mode: live` identifies the authenticated control transport. It does not imply that media, real contact delivery, the identity-provider deployment, or hardware are ready.

## Run/configure

Use Bun **1.4.4**, `bun install --frozen-lockfile`, and the existing scripts. Default `bun run dev` remains mock-only. No dependencies or lockfile versions changed.

The optional live configuration keys are listed in `.env.example`. Supply private values through the host's protected environment, never browser `PUBLIC_*` variables, firmware admin keys, command arguments or repository fixtures:

| Key | Meaning |
| --- | --- |
| `LEMMI_PUBLIC_ORIGIN` | Selected HTTPS origin, no path/trailing slash, e.g. `https://lemmi.example` (placeholder; no public host has been provisioned) |
| `LEMMI_CONTROL_TOKEN` | Independent random secret of at least 32 characters, shared only by web/gateway; cannot reuse mock token |
| `LEMMI_AUTH_INTROSPECTION_URL` | Managed provider's HTTPS token introspection endpoint, using confidential-client Basic authentication |
| `LEMMI_AUTH_ISSUER`, `LEMMI_AUTH_AUDIENCE` | Exact expected issuer and Lemmi API audience |
| `LEMMI_AUTH_CLIENT_ID`, `LEMMI_AUTH_CLIENT_SECRET` | Provider-issued introspection client credentials, server only |
| `LEMMI_CAREGIVER_SUBJECT` | Pre-created managed identity assigned to fictional Alex; no client-selected profile membership |
| `GATEWAY_PORT` | Loopback gateway port, default 3001 |

The provider must return `active: true`, `token_type: "Bearer"`, matching `iss` and `aud`, configured `sub`, and integer `exp` with at most one hour remaining. Optional `nbf` must be valid and not in the future. Inactive/mismatched tokens return UNAUTHORIZED; unrelated subjects return FORBIDDEN; failed provider verification returns UNAVAILABLE. Introspection is not cached, uses a three-second timeout, forbids redirects, and bounds response JSON to 16 KiB. Configure an actual provider and its access-token issuance flow before using these routes; the login UI/provider account setup is still pending.

After private environment configuration, start the two existing processes separately:

```sh
LEMMI_MODE=live bun run start:gateway
bun run build
LEMMI_MODE=live HOST=127.0.0.1 PORT=3000 ORIGIN=https://lemmi.example bun run start:web
```

Replace the example origin with the selected origin, matching `LEMMI_PUBLIC_ORIGIN`. `bun run dev` intentionally refuses live mode. Keep `ADDRESS_HEADER`, `HOST_HEADER` and `PROTOCOL_HEADER` unset: this increment verifies the actual loopback proxy peer, and the adapter uses explicit `ORIGIN`. Do not expose either application port directly.

### TLS/proxy boundary

A trusted reverse proxy on the same host terminates HTTPS/WSS. It must overwrite `Host` with the selected public host (including nondefault port) and `X-Forwarded-Proto: https`. Both Bun processes stay bound to `127.0.0.1`. Only proxy these public paths:

- `/v1/device-stream` → gateway, preserving WebSocket upgrade and Authorization.
- `/v1/devices/stackchan-alex/pairings`, `/v1/devices/stackchan-alex/revoke`, `/v1/device-pairings/claim` → SvelteKit.
- All other public paths → reject. In particular, never proxy `/internal/*`, `/v1/mock/*` or the mock pages.

The gateway independently checks loopback peer, configured Host, forwarded HTTPS, Origin when present, no query string, and paired bearer credential before upgrading. SvelteKit independently checks loopback proxy peer/configured origin/forwarded HTTPS; the resource handler verifies caregiver tokens and rejects foreign Origin and query strings. No query-string credentials, public raw streams or unauthenticated caregiver pages are introduced.

For example, this is the intended shape for a Caddy configuration after selecting a host; it has **not** been deployed or Caddy-validated in this session:

```caddyfile
lemmi.example {
    request_body {
        max_size 4KB
    }
    handle /v1/device-stream {
        reverse_proxy 127.0.0.1:3001 {
            header_up Host lemmi.example
            header_up X-Forwarded-Proto https
        }
    }
    @access path /v1/devices/stackchan-alex/pairings /v1/devices/stackchan-alex/revoke /v1/device-pairings/claim
    handle @access {
        reverse_proxy 127.0.0.1:3000 {
            header_up Host lemmi.example
            header_up X-Forwarded-Proto https
        }
    }
    handle {
        respond 404
    }
}
```

See Caddy's [reverse proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy) and [body-limit](https://caddyserver.com/docs/caddyfile/directives/request_body) references. Leave request/body/access logging disabled for credentials and provisioning data. Actual DNS, certificate issuance, host firewall and demo-network reachability remain deployment checks. Firmware must verify certificate chain, hostname and validity using the selected trust root and correct time; never disable certificate verification. The automated WSS test uses a temporary test CA, with verification enabled; it is not a public certificate or robot trust configuration.

## Shared HTTP/client contract

`@lemmi/contracts` exports `PairDeviceInputSchema`, `PairDeviceResultSchema`, `ClaimDeviceInputSchema`, `ClaimDeviceResultSchema`, `RevokeDeviceInputSchema`, `RevokeDeviceResultSchema`, inferred types, and the three operation entries `device.pair`, `device.claim`, `device.revoke`.

`createClients(createHttpTransport('live', authenticatedFetcher)).device` exposes `pair`, `claim`, `revoke`. The fetcher attaches the **managed caregiver access token** for pair/revoke; firmware claim uses the code and no caregiver token. In live mode these operations use the resource URLs below; other live service operations remain unavailable. Mock mode continues to use explicit mock RPC, where device access is unavailable.

Shared nonsecret examples are exported from `@lemmi/contracts/fixtures`: `controlHelloFixture`, `controlSessionFixture`, `controlEventFixtures`, `controlServerEventFixtures`. These contain fixed fictional IDs and a sample expired credential deadline, no usable pairing codes/tokens. The socket integration tests consume the same hello fixture. Counterparts should use these before agreeing any further wire changes.

1. Caregiver POST `/v1/devices/stackchan-alex/pairings`, Authorization: Bearer managed-provider-access-token:

   ```json
   {"deviceId":"stackchan-alex","profileId":"profile-alex","commandId":"unique-pair-command"}
   ```

   Success returns `{ok:true,data:{pairingId,deviceId,profileId,code,expiresAt}}`. The random 24-character code expires after five minutes. Same command/body returns the same pending code; after consumption/expiry/revocation use a new command ID. Only one pending pairing is allowed. Revoke an existing paired credential before replacing it.

2. Transfer `pairingId`/`code` privately to the intended device, show the assignment locally, and obtain an explicit local confirmation. Then firmware POSTs `/v1/device-pairings/claim`:

   ```json
   {"pairingId":"value-from-step-1","code":"24-character-code-value!","localConfirmed":true}
   ```

   The code string above is illustrative; use the exact returned 24-character code. Success returns `{ok:true,data:{deviceId,profileId,credential,expiresAt}}` **once**. A consumed/expired/wrong code returns UNAUTHORIZED. No response or a lost successful response requires a new pairing; it cannot retrieve the credential again. Claims are limited to 20 attempts/minute globally for this one-device demo.

   `localConfirmed` is a firmware contract, not cryptographic proof of a button press. Its physical enforcement, private provisioning UX and credential storage require Emilia's hardware implementation/review. Pairing consent never authorizes audio capture or camera access.

3. Open `wss://<selected-host>/v1/device-stream`, Authorization: Bearer device-credential. No profile/device ID in a query string. Scope is derived from the credential. Only one connected device socket is accepted.

4. Caregiver POST `/v1/devices/stackchan-alex/revoke` with `{deviceId:"stackchan-alex",commandId:"unique-revoke-command"}` and their managed access token. This invalidates pending pairing/current credentials, ends the session, and closes the active socket. Retrying an old revoke command does not revoke a replacement. GET never pairs, claims, revokes or acknowledges help.

All response bodies use the shared Result/error vocabulary and `Cache-Control: no-store`. Public JSON and control frames are bounded to 4 KiB. The private loopback `/internal/control/{pair,claim,revoke}` adapter requires a separate server-only token; it is not a public business API or firmware credential.

## Device wire examples

Existing protocol v1 envelope names remain unchanged. `DeviceEventSchema` now permits `audio: {supported:false}` and `input.start`. The existing PCM variant remains accepted for the mock fixtures; it does **not** negotiate media support. `ServerEventSchema` adds `device.ready`, permits actual control-mode `live` state/ack/heartbeat, and allows `error.payload.commandId` for correlation.

Control-only hello, always capture-off:

```json
{"protocol_version":1,"event_id":"unique-hello","session_id":null,"turn_id":null,"generation":0,"sequence":0,"type":"device.hello","payload":{"firmwareVersion":"emilia-version","cameraSupported":false,"pettingSupported":false,"audio":{"supported":false}}}
```

Server replies with `device.ready` (assigned device/profile, credential expiry, `audio:false`, `camera:false`, recognized controls), `command.ack`, then `state.changed` with the current participant-safe snapshot or null. `controls` lists recognized input events; `help` recognition does not imply contact-provider readiness.

Start is an explicit local participant action, **not** an action on hello/reconnect:

```json
{"protocol_version":1,"event_id":"unique-start","session_id":null,"turn_id":null,"generation":0,"sequence":1,"type":"input.start","payload":{}}
```

Use the resulting session ID and current generation for later session-bound controls:

```json
{"protocol_version":1,"event_id":"unique-stop","session_id":"current-session-id","turn_id":null,"generation":0,"sequence":2,"type":"input.stop","payload":{}}
```

`input.pause`/`input.resume` use empty payloads; `input.mute` uses `{muted:true|false}`. Each new event has a unique event ID and strictly increasing per-connection sequence. Resume returns to ready with capture off. Mic mute cancels capture permission without changing the unrelated output generation; full input-turn/output execution is still unavailable. Local Stop/mute must take effect before sending anything, regardless of acknowledgment.

Send `heartbeat` with an empty payload about every two seconds. The server requires a heartbeat within six seconds (checked every 500 ms), even if other controls arrive. A hello is required before other input; pre-hello silence is bounded too. Disconnect/watchdog leaves the session paused. Reconnect uses a fresh sequence/hello and reconciles that paused snapshot; no automatic start/resume/media. A new explicit start is needed after an ended session. Revoked/expired credentials require new pairing. Server restart discards every pairing/credential/session, preventing old work from recreating a session; restart IDs/leases are random.

`input.help` is accepted without an active conversation and routes directly to the application-owned help seam. Currently it returns `command.ack {applied:false}` plus correlated UNAVAILABLE: **no request was created or sent**. With an active session it pauses that session first. It never calls a model, waits for journal saving, invents delivery or falls back to a simulated send. Invalid/stale inputs return structured errors; media/camera/health ingestion remains unavailable.

Backpressure/rate limits close the control connection safely: maximum 30 incoming messages/second, 4 KiB/frame, 16 KiB output backpressure cap. Valid rejected session commands still consume their wire sequence. Server Stop and access revocation remain available when bounded command history is full.

## Computer harness

With the live origin/proxy configured, put the claimed credential in the computer's protected `LEMMI_DEVICE_CREDENTIAL` environment. Optionally set `LEMMI_DEVICE_CA_FILE` to the lab CA bundle; this adds trust without disabling verification. Then:

```sh
LEMMI_MODE=live bun run fake-device
```

This is a computer harness, not K151 firmware. It connects and prints ready/capture-off; type `start`, `pause`, `resume`, `stop`, `mute`, `unmute`, `help`, or `quit`. It sends no audio/images, does not auto-start/reconnect and does not print credentials. In default mock mode `bun run fake-device` retains its original behavior.

## Storage, evidence and next handoff

Pairing secrets exist only in bounded process memory until claim/expiry/revocation. Issued device credentials are returned once; only their SHA-256 digest remains in the authority. No audio, image, transcript, provider token, contact destination or request body is persisted/logged. Credentials are bearer credentials, not hardware attestation; secure device storage/extraction risks remain a firmware task. Histories are bounded at 256 commands; new pairings/ordinary commands fail explicitly at capacity. Restart requires re-pairing. Durable PostgreSQL pairing/credential management, audit retention, caregiver membership updates, provider-account revocation integration and private profile deletion are later slices; this foundation is not a production auth deployment.

Observed on this Linux workspace with Bun 1.4.4: the existing 23-test baseline passed before changes; the updated suite passes **37 tests**. Checks, production build, formatting, original `smoke:web` and browser server-symbol inspection pass. The suite exercises runtime contracts, assigned/unassigned caregiver and device IDs, single-use/expired pairing, retry integrity, active credential revocation/expiry, help without session, stale/replayed controls, watchdog/reconnect/Stop, and real WebSocket traffic through a test TLS proxy with certificate verification. Managed identity responses are **fixtures**, not a tested external provider. Final commands/results are recorded in the build plan. No hardware acceptance has passed.

After `bun run build`, `bun run smoke:control` runs an isolated production-build wiring check. It creates a temporary local CA, fixture managed identity endpoint, TLS proxy, gateway/web processes and computer control harness on temporary loopback ports. It verifies actual resource routes, HTTPS introspection, WSS controls and revocation with certificate verification enabled, and cleans up its own processes/files. It requires OpenSSL; it uses no real accounts/media/contacts and never exposes a public service. This is distinct from testing the selected provider or K151.

**Emilia next:** review the exact hello/ready/control samples; implement private local provisioning/confirmation and certificate-verified WSS control; demonstrate local Stop/mute before network acknowledgment, disconnect/watchdog and explicit resume. Report measured audio/camera capabilities before changing format/byte limits. **Kylie next:** use the shared device client after the managed login integration; treat token/provisioning codes as private setup data and keep participant projections separate. **Anay next:** configure/verify the chosen identity provider and actual TLS origin/network, then implement the F13 consent/expiry/cancellation state machine and media relay alongside speech readiness. Counterpart review is pending; do not mark protocol freeze, F13 or independent robot operation complete.

### Explicit VoidAuth token binding

`LEMMI_AUTH_TOKEN_BINDING` defaults to `audience`, preserving the required `LEMMI_AUTH_AUDIENCE` check. For VoidAuth non-resource access tokens, explicitly select `client_id`; `client_id` must then equal the dedicated configured `LEMMI_AUTH_CLIENT_ID`. Missing/foreign clients are rejected. A present `aud` still must match `LEMMI_AUTH_AUDIENCE`; it is never ignored. Issuer, active status, Bearer type, one-hour expiry bound and configured caregiver subject checks remain enforced in both modes. This is a provider-specific integration choice, not automatic fallback or JWT-only verification. The loopback-only `scripts/setup-caregiver.ts --assign-alex` helper obtains the actual subject using an explicitly authorized one-time code/PKCE login; see [host setup](../host-setup.md). Production browser login UI remains pending.
