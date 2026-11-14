# Lemmi backend integration reference

This is the current implementation reference for **Kylie's frontend, Emilia's firmware, Lukas's activities and Anay's speech/services**. Update it whenever a backend-facing route, schema, event, authorization rule, configuration key or availability changes. Runtime schemas/source remain authoritative; a proposed interface is not permission to invent a parallel backend.

**Scope:** one functional fictional profile, `profile-alex`, and one assigned live device, `stackchan-alex`. Preview cards are presentation-only. API examples below use fictional IDs/placeholders and contain no usable credentials. All paths are relative to their stated origin; do not substitute a robot's `127.0.0.1` for the backend host.

**Deployed baseline:** `04d050e` on `https://lemmi.chaoswarrior.dev`. Host observations, verification scope and remaining limitations are maintained in [backend status](backend-status.md); service commands and private setup are in [host setup](host-setup.md). API implementation and deployment acceptance are tracked separately.

## 1. Availability and ownership

| Surface | Current availability | Integration consumer |
| --- | --- | --- |
| Local mock HTTP RPC | Implemented; loopback-only, bounded in-memory state, no actual media/contact | Kylie/Lukas development, computer smoke tests |
| Scoped device pairing/claim/revoke HTTP | Implemented; real VoidAuth setup/introspection and public claim verified on deployed host. Public caregiver-bearer pairing/revoke requests have not been exercised in the live rehearsal | Kylie caregiver setup; Emilia provisioning |
| Authenticated device WSS | Controls and optional **text** chat implemented through one coordinator; actual K151 network integration pending | Emilia; computer control harness |
| OpenRouter chat | Configured on deployed host; actual fictional greeting and public WSS text turn passed. Broader conversational quality/readiness remains unverified | Anay server only |
| Local STT/TTS | Authenticated wrapper/adapters running privately; prior synthetic check passed on another host, but deployed-host recognition is intermittent and its quality gate is incomplete | Anay server only |
| Robot/browser microphone → STT → chat → TTS → playback | **Not implemented end to end**; no capture grant or media ingestion/output on the live gateway | Anay + Emilia + Kylie |
| Photos/guessing/matching | State/pack/action/view/context/event contracts and fixtures exist; three reducers/catalog hosting remain unavailable | Lukas logic; Kylie rendering; Anay host |
| Camera/health/teaching/preferences | Preliminary contracts/clients/fixtures; executable live integrations remain unavailable | All four owners at their assigned boundaries |
| Production profile/assets REST | PostgreSQL mode enabled on deployed host; scoped participant profile verified live. Caregiver edit/media checks used production fixture smokes; exact routes/limits below | Kylie; Anay data backend |
| Journal/contact/overview REST | Still planned; no complete review/notification workflow | Kylie; Anay implements |
| Database / durable jobs / real notifications | PostgreSQL/profile/media/device/session checkpoints implemented optionally; durable jobs and real notifications remain unimplemented | Anay |

Anay edits canonical backend/contracts. Kylie renders safe projections and submits typed actions; Lukas supplies pure reducers/content; Emilia enforces local controls and consumes the shared wire protocol. The app, gateway, worker and speech wrappers do not create independent session authorities. Relevant details: [integration contracts](integration-contracts.md), [activity handoff](handoffs/anay-activity-contracts.md), [control handoff](handoffs/anay-control-foundation.md), [speech/chat handoff](handoffs/anay-speech-chat.md).

### A18/A19 profile/private-media increment

[Database/profile/assets handoff](handoffs/anay-database-profile-assets.md) and [database setup](../db/README.md) define the current exact fields, permissions, format limits and restart behavior. PostgreSQL is opt-in via private `LEMMI_DATABASE_URL`/`LEMMI_PRIVATE_MEDIA_DIR` plus the configured caregiver subject. `bun run db:migrate` / `db:bootstrap` prepare only fictional Alex. One gateway owns the database; boot checks reject stale writes. Credential hashes and bounded session/factual-event checkpoints are persisted; restart deliberately revokes pairing credentials and ends old sessions. Full contact/policy/journal/deletion workflows remain pending despite schema foundations.

Public additions: caregiver GET/PATCH `/v1/profiles/:id`, POST `/v1/profiles/:id/photos` or `/assets`, GET `/v1/profiles/:id/assets/:assetId`; paired-device GET `/v1/participant/profiles/:id`, `/v1/assets/:assetId`, `/v1/assets/:assetId/metadata`. All reject example/unassigned scope, verify credentials server-side and disable caching. Device tokens never go to managed-identity introspection. Private `POST /internal/data` is solely the authenticated SvelteKit → existing gateway adapter, never a public route. Proxy only the new explicit resource paths and keep internal routes/services private.

Set production `BODY_SIZE_LIMIT=29M` and upload-proxy limits; handlers still bound profile JSON to 32 KiB, device control to 4 KiB and asset JSON to 28 MiB. Supported media is plain RGB/RGBA PNG (5 MiB/4096 dimensions/8 million pixels) or metadata-free PCM16 WAV (20 MiB/5 minutes); JPEG/SVG/MP3/range support is unavailable. Upload only approved static assets, not microphone/camera/generated-speech data. Authorized byte reads return actual media; metadata excludes storage paths and private discussion context. Caregiver context-changing edits cancel/pause the current session before COMMIT; support-only saves preserve its effective preset. Approved biography facts remain caregiver-provided; remembering/excerpt enablement is rejected pending its own workflows.

### Implemented profile/media HTTP routes

These routes are enabled on the current deployment and require the outer access key/cookie **and** the stated Bearer credential. Only `profile-alex` is assigned; asset IDs are UUIDs scoped and authorized by the backend. `assets`/`photos` accept validated JSON with bounded base64 data, not multipart uploads. Use the shared schemas for exact bodies.

| Method / URL | Bearer identity | Result |
| --- | --- | --- |
| `GET /v1/profiles/profile-alex` | Assigned caregiver | `ProfileDetail` |
| `PATCH /v1/profiles/profile-alex` | Assigned caregiver | Revision/command-checked update → `ProfileDetail` |
| `POST /v1/profiles/profile-alex/photos` | Assigned caregiver | Approved PNG upload → `AssetMetadata` |
| `POST /v1/profiles/profile-alex/assets` | Assigned caregiver | Approved PNG/PCM WAV upload → `AssetMetadata` |
| `GET /v1/profiles/profile-alex/assets/:assetId` | Assigned caregiver | Authorized media bytes |
| `GET /v1/participant/profiles/profile-alex` | Paired device | Safe `ParticipantProfile` |
| `GET /v1/assets/:assetId` | Paired device | Authorized media bytes |
| `GET /v1/assets/:assetId/metadata` | Paired device | Safe `AssetMetadata` |

Profile/metadata/upload successes use the common `Result<T>` envelope; successful media reads return binary bytes. Do not parse binary media responses as JSON. No photo list, arbitrary storage path, external asset URL or profile creation/deletion route follows from this table.

## 2. Origins, processes and credentials

Deployment tracking branch: `backend-deploy`. See [new-machine deployment and Cloudflare routing](backend-deploy.md) for setup, exposed paths, restart behavior and host acceptance checks. The current host has a configured, supervised Cloudflare Tunnel and loopback proxy. Templates are tracked under `deploy/`; private tunnel credentials/configuration remain host-local and are not provisioned automatically by a checkout.

| Process/origin | Default / exposure | Credential |
| --- | --- | --- |
| Mock SvelteKit development app | `http://127.0.0.1:5173`; local only | Explicit mock convention; no caregiver security boundary |
| Gateway, either mock or live mode | `127.0.0.1:3001`, configurable `GATEWAY_PORT` | Mock token **or** live internal/device credential, selected by startup mode |
| Built SvelteKit app | Run `HOST=127.0.0.1 PORT=3000 bun run start:web` after build | Live resource handlers independently verify authorization |
| Live public/LAN origin | Current `https://lemmi.chaoswarrior.dev`; other hosts explicitly set `LEMMI_PUBLIC_ORIGIN`; proxy only supported routes | Outer access key/cookie plus caregiver Bearer for pair/revoke/profile edits, or scoped device Bearer for claim-following participant resources/WSS; claim itself uses its pairing code |
| Local speech wrapper | `http://127.0.0.1:8765`; **never expose to robot/browser** | Independent `LEMMI_SPEECH_TOKEN` |
| OpenRouter | Fixed `https://openrouter.ai/api/v1/chat/completions` outbound server request | Private `OPENROUTER_API_KEY`, never sent to a client/model context |

`LEMMI_MODE` defaults to `mock`. `bun run dev` deliberately launches the local mock. For configured live mode, start web/gateway separately using the existing scripts; see [deployment instructions](handoffs/anay-control-foundation.md#runconfigure). The live gateway does not also run a mock coordinator.

The trusted same-host HTTPS/WSS proxy must overwrite Host to the configured public host and `X-Forwarded-Proto: https`; backend ports stay loopback-only. The web adapter uses explicit `ORIGIN` matching `LEMMI_PUBLIC_ORIGIN`; leave forwarded-address overrides unset for the current trusted-peer checks. Proxy `/v1/device-stream` to the gateway and the implemented access, device and profile/asset resource routes to SvelteKit; see the allowlist in `deploy/nginx.conf.template`. Reject `/internal/*`, mock RPC/pages and other unfinished routes externally. Certificate chain, hostname/IP and validity verification remain enabled on clients; the deployed host now resolves its public hostname normally (the initial DNS failure has cleared). A plain LAN WebSocket with the development mock token is not the live interface.

Credentials are **not interchangeable**:

- Caregiver: externally verified short-lived Bearer access token with assigned subject. Current verifier uses configured HTTPS token introspection, issuer/configured audience-or-client binding/Bearer/expiry checks and the single `LEMMI_CAREGIVER_SUBJECT` assignment. Actual VoidAuth issuance/introspection passed the one-time setup; production browser login UI remains pending.
- Device: random expiring bearer credential returned once after pairing and local confirmation. Scope is derived server-side; no caller-selected profile/role grants access.
- Internal control: separate `LEMMI_CONTROL_TOKEN`, at least 32 characters and not the mock token. Only SvelteKit→gateway; never firmware/browser.
- Speech: independent service credential shared only by trusted backend/engine wrapper.
- Mock: `LEMMI_MOCK_TOKEN` defaults to `local-mock-only`; development convention, not pairing/authentication for real users/data.

No tokens, pairing codes, private media, provider errors, prompts or contact destinations belong in query strings/logs/source/fixtures. Pairing codes and active authority remain transient. With database mode, credential hashes and factual/session checkpoints persist, but startup explicitly revokes tokens and ends interrupted sessions; restart still requires re-pairing. Complete journal/deletion workflows remain pending.

### Explicit VoidAuth token binding

`LEMMI_AUTH_TOKEN_BINDING` defaults to `audience`, preserving the required `LEMMI_AUTH_AUDIENCE` check. For VoidAuth non-resource access tokens, explicitly select `client_id`; `client_id` must then equal the dedicated configured `LEMMI_AUTH_CLIENT_ID`. Missing/foreign clients are rejected. A present `aud` still must match `LEMMI_AUTH_AUDIENCE`; it is never ignored. Issuer, active status, Bearer type, one-hour expiry bound and configured caregiver subject checks remain enforced in both modes. This is a provider-specific integration choice, not automatic fallback or JWT-only verification. The loopback-only `scripts/setup-caregiver.ts --assign-alex` helper obtains the actual subject using an explicitly authorized one-time code/PKCE login; see [host setup](host-setup.md). Production browser login UI remains pending.

### Private gateway routes — never proxy externally

| Route | Credential / input | Availability |
| --- | --- | --- |
| `POST /internal/mock/<operation>` | Loopback peer/Host/Origin plus mock bearer token; operation's JSON input | Mock gateway only; delegates to the same mock authority |
| `GET /health` on mock gateway | Same loopback/mock-token checks | `{mode:'mock',speech:false,camera:false,notifications:false}`; no live readiness implication |
| `POST /internal/control/pair` | Loopback plus independent internal token; `{actor,input:PairDeviceInput}` | Live control gateway only; SvelteKit derives actor from the verified caregiver, never trusts a browser-supplied actor |
| `POST /internal/control/claim` | Same internal token; `ClaimDeviceInput` | Live control gateway only |
| `POST /internal/control/revoke` | Same internal token; `{actor,input:RevokeDeviceInput}` | Live control gateway only |
| `POST /internal/data` | Loopback plus independent internal token; operation and server-derived caregiver actor or scoped device credential | Live PostgreSQL-backed data adapter; never a client-facing URL |

The current live gateway has no equivalent public health/readiness HTTP route. Missing/unconfigured services must be reported honestly; do not use mock health as production readiness or put an internal token into a device/browser to inspect it.

### Private domain access gate (deployment branch)

Set `LEMMI_ACCESS_KEY` (independent 32–256 visible characters) on web/gateway. Live process configuration requires the key and fails closed if it is missing, invalid or reused; local mock mode needs no key. With it enabled, all implemented live public API/WSS paths require either `X-Lemmi-Access-Key` or a signed browser cookie. Existing caregiver introspection, paired device Bearer authorization and internal server token checks remain separate; the key alone grants no role/resource authority. The current mock pages remain loopback-only.

| Route / credential | Behavior |
| --- | --- |
| `GET /access` | Public HTML unlock form; no private data or key in response; no-store/CSP/referrer protections |
| `POST /access` | Same-origin `application/x-www-form-urlencoded` body `{key}` ≤4 KiB; success sets eight-hour `__Host-lemmi_access` signed Secure/HttpOnly/SameSite=Strict cookie; wrong key 401, bad origin/query 403, malformed body 400, wrong type 415, global 20/minute limit 429 |
| `POST /access/logout` | Same-origin only, clears current browser cookie; does not revoke other browser cookies |
| Device/provisioning header | `X-Lemmi-Access-Key: <private key>`; WSS still requires `Authorization: Bearer <paired credential>` |

Browser same-origin clients carry cookies; never bundle the shared key. The computer harness reads private `LEMMI_ACCESS_KEY`. Public domain/gate cookie exchange/logout and computer WSS checks passed. Actual firmware header support and full production browser sign-in remain pending. Rotate the key and restart both processes to revoke gate cookies and active connections. No key is accepted in query strings. Cloudflare Access is optional and not required by this chosen gate. Self-hosted OIDC caregiver integration still requires compatible RFC 7662 introspection; a generic OIDC/JWKS adapter or sign-in UI is not implemented here.

## 3. Common contracts and error handling

Import environment-neutral schemas/types from `@lemmi/contracts`; fixtures from `@lemmi/contracts/fixtures`. Do not import `@lemmi/server` into frontend components or firmware. Most object schemas are strict: injected/unknown fields fail validation. IDs are 1–100 characters; revisions/generations are nonnegative integers. Server scope checks apply in addition to shape validation.

HTTP service operations use:

```ts
type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ErrorCode; message: string } };
```

| Error code | Meaning / caller behavior | Live resource HTTP status |
| --- | --- | --- |
| `UNAUTHORIZED` | Missing/invalid/expired credential; authenticate/re-pair explicitly | 401 |
| `FORBIDDEN` | Wrong profile/device/subject/origin/scope; do not retry with invented IDs | 403 |
| `REVISION_CONFLICT` | Stale snapshot or command-ID/body reuse; refresh and reconcile | 409 |
| `UNAVAILABLE` | Unconfigured/down/unsupported/canceled/busy service; no silent mock/provider fallback | 503 |
| `NOT_FOUND` | Unknown assigned resource/operation | 404 |
| `VALIDATION_ERROR` | Invalid shape/limits/state | 400 |
| `SAVE_FAILED` | Typed seam for failed durable save; not evidence that persistence exists | 400 in current control-response helper; final domain mapping pending |

Resource handlers can also return 405 (unsupported HTTP method) and WSS upgrade checks 426. Hooks/proxy/upgrade failures may have plain or empty bodies; handle non-JSON responses as transport failure. Mock gateway RPC maps `NOT_FOUND` and most other failures to 400, unlike the live resource helper; request-size middleware may return 413. Prefer parsed stable Result/error codes where present over assuming every transport uses identical status mapping. No `REVISION_CONFLICT` error currently contains a full snapshot: fetch/consume the next safe snapshot; richer conflict responses remain planned.

Retry identity is currently **body `commandId`**, scoped by operation, not an implemented `Idempotency-Key` header. Same ID/different body conflicts. This differs from the planned production REST specification. Copying a failed live call into a mock call is never an accepted retry.

## 4. Frontend client and current HTTP operation catalog

```ts
import { createClients, createHttpTransport } from '@lemmi/contracts';
const clients = createClients(createHttpTransport('mock'));
```

Mock clients POST JSON to `/v1/mock/<operation>` on SvelteKit, which authenticates its loopback gateway proxy. Both processes must run. The mock app checks actual loopback peer/Host and same Origin when present; it supplies no real caregiver permissions. The proxy and gateway bound request bodies to 32 KiB; client request timeout is five seconds, proxy gateway timeout three seconds. Default mock clients never contact providers.

`createHttpTransport('live', authenticatedFetcher)` maps `device.pair/claim/revoke`, safe paired `profile.load`, caregiver `profile.detail/update`, and `assets.create/metadata` to implemented resource URLs. The fetcher must attach the correct caregiver token for pair/revoke; there is no built-in login/cookie token store. Other operations POST `/v1/live/<operation>` and are explicitly unavailable, even if their input/output types exist.

The following table covers every current `operations` entry in [services.ts](../packages/contracts/src/services.ts). The input notation is field names, not an additional schema; use inferred `OperationInput<K>`/`OperationOutput<K>` for exact types.

| Operation | Input fields | Output | Mock behavior / live availability |
| --- | --- | --- | --- |
| `device.pair` | `deviceId, profileId, commandId` | Pairing ID/code/expiry | Mock unavailable; live resource below |
| `device.claim` | `pairingId, code, localConfirmed:true` | Assigned IDs/credential/expiry | Mock unavailable; live resource below |
| `device.revoke` | `deviceId, commandId` | `{revoked:true}` | Mock unavailable; live resource below |
| `profile.load` | `profileId` | `ParticipantProfile` | Safe mock projection; live paired-device GET `/v1/participant/profiles/:id` |
| `profile.detail` | `profileId` | `ProfileDetail` | Mock unavailable; live managed-caregiver GET `/v1/profiles/:id` |
| `profile.update` | `profileId,commandId,expectedRevision,patch` | `ProfileDetail` | Mock unavailable; live managed-caregiver PATCH `/v1/profiles/:id` |
| `assets.create` | `AssetCreate` (bounded base64/approved provenance/tags) | `AssetMetadata` | Mock unavailable; caregiver POST `/v1/profiles/:id/assets` (PNG/PCM WAV only) |
| `assets.metadata` | `assetId` (UUID) | `AssetMetadata` | Mock unavailable; paired-device GET `/v1/assets/:id/metadata` |
| `profile.loadCaregiver` | `profileId` | `CaregiverProfile` | Private fictional mock projection; live auth/API pending |
| `profile.save` | `profile, expectedRevision` | `CaregiverProfile` | Mock revision-checked update; cannot enable remembering/excerpts |
| `profile.previews` | `{}` | Preview profile array | Static `Example profile — preview only` cards; no live operations |
| `session.start` | `profileId, commandId, endpoint` | `SessionSnapshot` | Starts mock session; live start currently WSS only |
| `session.get` | `sessionId` | `SessionSnapshot` | Reads current mock session; live browser read seam pending |
| `session.command` | `SessionCommand` below | `SessionSnapshot` | Mock controls/handoff; speak/turn_end/teaching unavailable; live controls WSS below |
| `activities.list` | `profileId` | `{activityId,packId,packVersion,implemented}[]` | Four mock catalog entries; only music implemented; live catalog pending |
| `activities.start` | `sessionId,commandId,activityId,packId,packVersion` | `ActivityView` | Only `music_playlist` / `music-demo` / version 1; no real playback |
| `activities.view` | `sessionId,instanceId` | `ActivityView` | Current mock music view; other reducers/live host pending |
| `activities.submit` | `ActivityCommand` below | `ActivityView` | Revision/dedup checked music transition; no media effect execution |
| `help.create` | `profileId,commandId,mode:'simulation'|'real'` | `HelpSnapshot` | Simulation only; pauses session. Real contact explicitly unavailable |
| `help.status` | `requestId` | `HelpSnapshot` | Current simulated request only |
| `help.acknowledge` | `requestId` | `HelpSnapshot` | Simulated acknowledgment only; no provider/human arrival evidence |
| `help.cancel` | `requestId` | `HelpSnapshot` | Cancels simulation; session Stop alone does not cancel it |
| `preferences.load` | `profileId` | `PreferencesSnapshot` | Empty mock policy, remembering off |
| `preferences.update` | `profileId,expectedRevision,rememberingEnabled` | `PreferencesSnapshot` | Unavailable |
| `preferences.forget` | `profileId` | `{applied:boolean}` | Unavailable |
| `preferences.signal` | `PreferenceSignal` | `{applied:boolean}` | Unavailable; presentation-bound live policy validation/persistence pending |
| `journal.load` | `profileId` | `Journal` | Bounded measured mock events; `summary:null` |
| `journal.observe` | `sessionId,text` | `{applied:boolean}` | Unavailable; no observation write occurs |
| `journal.editSummary` | `summaryId,expectedRevision,text` | `{applied:boolean}` | Unavailable |
| `journal.removeSummary` | `summaryId,expectedRevision` | `{applied:boolean}` | Unavailable |
| `journal.reviewSummary` | `summaryId,expectedRevision` | `{applied:boolean}` | Unavailable |
| `assets.resolve` | `profileId,assetId` | `AssetManifest` | Unavailable; no scoped asset bytes/stream implemented |
| `checkIn.status` | `profileId` | `CheckInSnapshot` | Default-off fictional snapshot only |
| `checkIn.request` | `profileId,deviceId,commandId` | `CheckInSnapshot` | Unavailable |
| `checkIn.end` | `checkInId,commandId` | `CheckInSnapshot` | Unavailable |
| `overview.load` | `profileId` | `{profile,previews,mode:'mock',readiness:'not_configured'}` | Mock cards only; production source highlights/intervals pending |

`clients.session.subscribe`, `clients.activities.subscribe`, `clients.checkIn.subscribe` return an unsubscribe function. They currently **poll the same operation**, initially immediately then about every second, without overlapping requests. They are not a production event stream; expose failure states and unsubscribe on teardown. `createFixtureTransport` requires explicit configured scenarios and validates success shapes; missing fixtures return UNAVAILABLE, not fabricated success. Fictional packs and `approved:true` discriminator examples are not reviewed media readiness.

## 5. Live enrollment, claim and revocation HTTP

All are SvelteKit handlers on the configured HTTPS origin; JSON requests/responses ≤4 KiB and `Cache-Control:no-store`. Same Origin is checked when supplied; no URL query credentials. Mutations require POST; GET/link previews do not perform them. All three routes also require `X-Lemmi-Access-Key` or the signed access cookie. Include `Content-Type: application/json`; any supplied `Origin` must exactly match the configured public origin.

| Method / URL | Authorization | Request body | Success `data` |
| --- | --- | --- | --- |
| `POST /v1/devices/stackchan-alex/pairings` | Assigned caregiver managed access token | `{deviceId:'stackchan-alex',profileId:'profile-alex',commandId}` | `{pairingId,deviceId,profileId,code,expiresAt}` |
| `POST /v1/device-pairings/claim` | Possession of pending secret pairing code, plus firmware local confirmation | `{pairingId,code,localConfirmed:true}` | `{deviceId,profileId,credential,expiresAt}` |
| `POST /v1/devices/stackchan-alex/revoke` | Assigned caregiver managed access token | `{deviceId:'stackchan-alex',commandId}` | `{revoked:true}` |

Actual route pattern is `/v1/devices/[deviceId]/[action]`, but only Alex's configured device is assigned. Route/body device IDs must match. Unknown example/unassigned profile/device IDs fail scope checks; do not add a functional second profile to get around this.

The 24-character random code lasts five minutes and is single-use. Repeat pair ID/body returns the same still-pending code; after expiry/claim/revoke use a fresh command ID. Only one pending pairing/device credential is allowed; revoke before replacement. Claim returns the random device credential **once**, valid for one hour. A lost successful response cannot retrieve it again: revoke/re-pair explicitly. Claims are globally limited to 20/minute for this demo. `localConfirmed:true` is a firmware contract, not cryptographic proof of a physical button press or consent to microphone/camera access.

Revocation clears pending enrollment/current credential, ends the session and closes an existing socket. Replaying an old revoke command cannot revoke a new pairing. Pairing/revoke command history is bounded to 256; new pairings fail at capacity while revocation remains available. Gateway restart clears all credentials/codes; device must not automatically capture/restart on reconnect.

**Database ownership fence (`04d050e`):** pairing checks that the device row belongs to the current gateway boot; a stale authority returns `UNAVAILABLE`. Claim writes only when the row still has that same boot marker and never assigns/replaces ownership itself. If persistence/ownership checks fail, no usable credential is returned; explicitly re-pair against the current gateway. Regression coverage verifies stale claim/pair rejection, preservation of the replacement marker, and successful authentication by the current authority.

**Path difference from the draft:** technical-spec's `/v1/devices/pair` and `DELETE /v1/devices/:id/pairing` are proposed older route names, not implemented aliases. Use the three POST routes above until the shared specs/consumers are deliberately migrated.

### Python pairing helper

From the repo root, run `python3 scripts/pair-stackchan.py` (Python 3.10+, standard library only). It reads the private root `.env` with environment-variable overrides, performs a state/PKCE VoidAuth login on `http://127.0.0.1:3333/callback`, and requests a fresh pairing using the public caregiver endpoint. Use the printed authorization URL in a browser on the helper machine, or forward its loopback port over SSH. This reuses the existing registered setup redirect URL; it does not change caregiver assignments or the database configuration.

The helper prints the private `pairingId`, `code` and `expiresAt` for immediate Stackchan provisioning. It **leaves the code unclaimed**, stores no tokens/pairing files, never automatically revokes an existing device, and does not open a microphone or start a session. Keep its terminal output out of shared logs. If a pairing/device already exists, resolve it explicitly through the caregiver revocation route before generating a replacement. Missing access key is prompted privately; browser login requires issuer/client ID/secret in private configuration. `--token` privately prompts for an existing caregiver access token instead of browser login; `--env-file PATH` selects another private settings file. Basic literal/quoted dotenv values are supported, without variable expansion.

Four local Python fixture tests cover state/PKCE, public authorization headers and fresh command IDs, assignment/TLS constraints, and unchanged configuration. Run `python3 -m unittest discover -s tests -p test_pair_stackchan.py -v`. The helper itself has not been used to create a live pairing; existing live backend acceptance is recorded separately.

## 6. Firmware / authenticated WebSocket protocol

Connect `wss://<configured-host-or-IP>[:port]/v1/device-stream` using `Authorization: Bearer <paired-device-credential>` in the upgrade request. Same gateway/session as HTTP controls; no dependency on an open browser tab. One connection at a time, reserved atomically during upgrade. No URL tokens, insecure certificate bypass or caregiver/provider credentials on the device.

Protocol envelope, validated by `DeviceEventSchema` / `ServerEventSchema`:

```ts
{
  protocol_version: 1,
  event_id: string,       // unique command/event ID
  session_id: string | null,
  turn_id: string | null,
  generation: number,
  sequence: number,       // strictly increasing within this connection/direction
  type: string,
  payload: object
}
```

### Connection and controls

First message is `device.hello`, for example:

```json
{"protocol_version":1,"event_id":"hello-1","session_id":null,"turn_id":null,"generation":0,"sequence":0,"type":"device.hello","payload":{"firmwareVersion":"your-version","cameraSupported":false,"pettingSupported":false,"audio":{"supported":false}}}
```

An alternative audio capability shape permits `{encoding:'pcm_s16le',sampleRate:16000,channels:1,frameMs:20}`; it does **not** authorize capture/ingestion or prove actual hardware support. Server responds `device.ready`, hello `command.ack`, then `state.changed` with the current safe session/null.

`device.ready.payload` is `{mode:'live',deviceId,profileId,credentialExpiresAt,audio:false,camera:false,textChat?:boolean,controls:[...]}`. `textChat`/`text` control indicates configured adapter only, not a successful provider call. Camera/audio remain unsupported on this connected path.

| Incoming type | Payload | Session/behavior |
| --- | --- | --- |
| `heartbeat` | `{}` | About every 2 seconds; works without session; refreshes heartbeat deadline |
| `input.start` | `{}` | `session_id:null`, `generation:0`, `turn_id:null`; explicit participant start, never automatic hello/reconnect behavior |
| `input.pause` | `{}` | Current session/generation; cancels pending response and pauses |
| `input.resume` | `{}` | Current paused session/generation; explicit return to ready, no capture/playback |
| `input.stop` | `{}` | Current session/generation; ends, cancels output/turn work; local stop precedes transport |
| `input.mute` | `{muted:boolean}` | Current session/generation; mute clears capture/pending turn, unmute never records; unrelated approved output has separate validity |
| `input.help` | `{}` | Recognized without conversation; fixed application contact seam. Current real contact is UNAVAILABLE, no request/send; pauses an active session |
| `input.text` | `{text,language:'en'|'de'}` | Current session/generation and null `turn_id`; text 1–1,000 chars, explicit chat turn below |

Session-bound controls require the latest generation and assigned active session. A stale sequence conflicts; an accepted/rejected valid session packet consumes its wire sequence. Pre-hello events close the socket. New connection resets sequence and requires fresh hello/snapshot. Help is independent of model generation/journal saving; its unavailable error must remain visible.

| Outgoing type | Payload |
| --- | --- |
| `device.ready` | Negotiated implemented capabilities/assignment/credential deadline above |
| `state.changed` | `{mode:'mock'|'live',session:SessionSnapshot|null}` |
| `command.ack` | `{mode:'mock'|'live',commandId,applied:boolean}`; receipt of an applied control, **not** proof audio played/contact arrived |
| `heartbeat` | `{mode:'mock'|'live'}` |
| `error` | `{code,message,commandId?}`; sanitized stable error |
| `response.text` | `{turnId,text,language:'en'|'de',source:'model'|'fixed'}`; envelope `turn_id` matches reply turn |

Socket maximum payload 4,096 bytes; maximum 30 incoming messages/second; output backpressure limit 16 KiB. Heartbeat timeout is six seconds, checked every 500 ms (other controls do not substitute for heartbeat). Disconnect/watchdog pauses and clears pending turns; reconnect never resumes capture/media. Credential expiry/revoke ends session and closes access. Firmware must independently stop capture/playback/camera/motion under local Stop/watchdog even when no server acknowledgment can arrive; that hardware behavior is not established by a fake-device test.

### Text turn behavior

Example after explicit start, using the actual snapshot's ID/generation:

```json
{"protocol_version":1,"event_id":"text-1","session_id":"session-from-server","turn_id":null,"generation":0,"sequence":2,"type":"input.text","payload":{"text":"Hello","language":"en"}}
```

The coordinator sets `processing` with capture off; generation runs asynchronously so heartbeat/Stop/help remain usable. On success: correlated ack → `response.text` → safe `waiting` snapshot. All presets stay capture-off on this implementation path. Typed text is independent of mic mute; a deliberate text turn can start while the microphone setting is muted.

Stop/pause/mute/handoff/disconnect/revoke cancels pending generation and clears transient dialogue/reply receipts. Session/profile/privacy/policy revisions, lease and current reply ownership are checked before socket output. A resolved response still queued for emission loses permission immediately on mute, even though mute preserves unrelated output generation. Late/stale results cannot restart interaction.

An exact pending/current-turn duplicate avoids a second model request and duplicate socket output. Same ID/different content conflicts. Older/interrupted turns are not replayable. History is at most six dialogue messages; text command fingerprints are capped at 256 per session and last-reply cache is transient. Raw utterances do not enter generic command cache, journals, durable jobs or summaries. Explicit recognized Stop/help/refusal/concern examples bypass the model; these narrow phrase fixtures are not reliable intent/emergency detection. Contact remains unconfigured and never becomes a simulated send on a live call.

### Defined but not executable device events

`audio.chunk`, `camera.allow`, `camera.decline`, `camera.started`, `camera.ended`, `device.health` have preliminary schemas, **but the connected gateway does not ingest/execute them**. Capture grants remain null. There is no implemented `audio.end`, speech/audio output event/receipt path, camera.request/start/end/state server event, production activity event stream, robot teaching action or expression renderer command. Do not invent these event names/payloads in a consumer.

Current proposed `audio.chunk`: `leaseId`, `streamId`, `encoding:'pcm_s16le'`, base64 `data` exactly 856 characters decoding to 640 bytes. That represents 20 ms at 16 kHz mono int16; Emilia's native framing/reframing and real transport remain unverified. Do not stream merely because the schema accepts the shape.

## 7. Session, activity and data projections

### Session contract

`SessionSnapshot` includes `id,profileId,generation,profileRevision,privacyRevision,policyRevision,phase,endpoint,leaseId,micMuted,captureGrant,communicationSupport,conversationMode,teaching,mode`. Endpoint is `browser|robot`; phase enum is `ready|listening|processing|speaking|waiting|paused|unavailable|ended`. Not all schema phases are reachable in the current transport. A nonnull capture grant is legal only while current/unmuted/listening with matching generation/lease; **no current live handler grants one**.

`SessionCommand = {commandId,sessionId,expectedGeneration,action}`. Runtime actions: `pause`, `resume`, `stop`, `{type:'mute',muted}`, `{type:'handoff',endpoint}`. Schema additionally defines `speak`, `turn_end` and teaching actions, but they return unavailable. Mock HTTP supports handoff; the live device event union has no handoff event yet. Resume is explicit and capture-off, Stop is terminal, and initiated help requests have their own lifecycle.

### Activity integration: Lukas → coordinator → Kylie

The four stable IDs are `music_playlist`, `twenty_questions`, `photo_album`, `object_matching`. Pure exports in `@lemmi/activities` are `createActivity`, `reduceActivity`, `projectActivity`, `applyActivitySystemInput`. They take validated approved content and required context and return state/view or `{nextState,events,effects}`; no I/O/network/model/database/timer authority inside reducers. Current runnable reducer/host is **music only**; other states/fixtures are contracts, not completed games.

`ActivityCommand` is `{commandId,sessionId,instanceId,expectedRevision,action,presentation?}`. Matching actions require the current coordinator-issued `presentation`; do not generate a token/entity ID in UI. Session Stop/help/mute/pause are not activity actions; only the coordinator dispatches system interrupts/receipts/policy updates.

| Activity | Participant action family | State/view notes |
| --- | --- | --- |
| Music | `track.select {trackId}`, `track.play`, `track.pause`, `track.next` | Current track/playback; `requested` differs from endpoint receipt-backed `playing` |
| Guessing | `guess.answer {answer:'yes'|'no'|'not_sure'}`, `guess.skip`, `guess.reveal`, `guess.new_round` | Reviewed bounded acyclic tree/candidates/rounds; safe view exposes question/roundPhase/offeredGuess, not hidden candidate tables/counts |
| Photos | `photo.select {photoId}`, `photo.next`, `photo.previous`, `photo.just_look`, `photo.talk` | Stable entry ID, position and just-look/talk state; private discussion context never enters participant view; scene exploration uses the same activity |
| Matching | `match.select {choiceId}`, `match.show`, `match.not_sure`, `match.next`, `match.finish` | Visible sample/two candidates; nullable nested presentation; no correctness/ability field |
| Any | `activity.leave` | Exit without matching evidence; empty/unavailable matching views use Leave rather than forged match actions |

`ActivityContext = {eligibility,presentationPolicy,matchingPresentation}`; matching context is explicitly null for nonmatching/unavailable presentations. Token shape: `{instanceId,presentationId,presentationRevision,policyRevision}`, bound to current eligibility revision. Context is required for create/reduce/project, not only progression, so excluded prompts/assets cannot leak through view refresh.

`validateActivityCommandContext` checks state/context freshness and displayed actions; `validateMatchingSignalContext` binds effect/sample/eligible displayed content to **input** context. These helpers validate shape/state, not sender authorization, consent, durable deduplication or retirement. Host checks session/resource scope/generation/lease/privacy/policy before execution/writes. Matching preference signals are proposals; only the server can commit policy.

State/pack/view/event/transition field details and breaking placeholder changes are in [A01–A04 handoff](handoffs/anay-activity-contracts.md). Runtime `ActivityEventSchema`/`ActivityTransitionSchema` reject private/free text; factual playback events require consistent receipt shape, which is still not authenticated proof on its own. `offer_photo_conversation` includes exact photo/asset IDs and must reuse/cancel the existing conversation path. Pending effect execution/receipt validation/catalog hosting is A05; no direct reducer-selected URLs/model tools.

### Other shared projections

| Shape | Fields / boundary |
| --- | --- |
| `ParticipantProfile` | `id,preferredName,avatarId,revision,communicationSupport` only; no caregiver guidance/contact/journal |
| `CaregiverProfile` | Adds `source:'caregiver_provided',interests,sensitiveTopicGuidance,rememberingEnabled,excerptSavingEnabled`; caregiver-only; live `ProfileDetail` extends this shape |
| `AvatarId` / expression | Exactly `dog,cat,bunny,bird,lemming`; separate expression enum `idle,listening,processing,speaking,paused,unavailable`. Reduced motion is not another avatar |
| `CommunicationSupport` | `preset:'conversational'|'guided'|'quiet',configVersion:1`; not clinical stage, and not automatic language/privacy/help settings |
| `PreferencesSnapshot` | Profile/policy revision, remembering flag, structured preferences/items; mock is empty/off. No raw utterance history |
| `PreferenceSignal` | Command/session/presentation IDs and revisions, policy revision, canonical entity ID, `prefer|avoid|uncertain`. Current writes unavailable; do not bypass policy/evidence checks |
| `HelpSnapshot` | ID/profile, mode simulation/real, manual/urgent concern reason, templated message/status. Schema statuses include created/sending/accepted/delivery_unknown/delivered/acknowledged/failed/no_response/canceled/expired/resolved; mock only demonstrates a small simulated subset |
| `Journal` | Profile/mode and ≤100 session records with ≤100 source-labeled measured events/session; `summary:null` currently. No dialogue text/AI summary storage implemented |
| `CheckInSnapshot` | Assigned IDs, revision/privacy revision, state `off|requested|starting|active|ended|unavailable`, viewer name/times/reason/frame freshness fields; mock default off only |
| `TeachingSnapshot` | Conversation-mode/presentation/topic/asset/policy/phase scaffold; execution unavailable. Teach Lemmi is not a fifth activity |

## 8. Private speech and LLM adapters

Use [Ubuntu speech setup/configuration/API/privacy guide](../services/local-speech/README.md). The wrapper is not a participant endpoint, stores no session and accepts no credentials from firmware/browser. It is safe to test local engine readiness independently of caregiver sign-in, but that does not authorize production participant capture.

| Private endpoint on loopback speech origin | Request | Response |
| --- | --- | --- |
| `GET /health` | Speech bearer token | Readiness and engine/language capabilities, not paths/secrets |
| `POST /v1/stt` | Token, UUID `X-Lemmi-Request-Id`, `X-Lemmi-Language:en|de|auto`, binary content type and PCM | `{ok:true,data:{text,language}}`, text ≤2,000 chars |
| `POST /v1/tts` | Token, UUID header, JSON `{text,language:'en'|'de'}` | Raw mono signed int16 little-endian PCM + `X-Lemmi-Sample-Rate`, `X-Lemmi-Encoding`, `X-Lemmi-Language` |
| `POST /v1/cancel` | Token, JSON `{requestId:<UUID>}` | `{ok:true,data:{applied:boolean}}`; also remembers bounded early-cancel IDs |

STT input: **16 kHz mono**, positive even byte count ≤640,000 (20 seconds); this bounded whole-turn wrapper is separate from proposed 640-byte device chunks. TTS text ≤600 chars; output ≤30 seconds at 8–48 kHz. Current English Piper voice outputs **22,050 Hz**. Test-only in-memory resampling does not settle the device playback format. Unsupported German voice is unavailable, never silently English.

One inference job, no queue; eight request-thread cap, five-second connection/body bounds, 20-second inference bound. Best-effort cancel can terminate/reload the engine worker; callers independently reject late results. A client disconnect alone is not proof of immediate native inference cancellation. Speech errors are bounded/sanitized; no engine prompt/audio/transcript tracebacks are returned. Host RAM/IPC/native buffers remain transient without a secure-erasure claim; model/dependency caches persist, raw audio/transcripts do not intentionally persist.

Server adapter interfaces (`@lemmi/server` exports type-only speech/chat types and adapter factories):

```ts
stt.transcribe({ pcm: Uint8Array, language: 'en' | 'de' | 'auto' }, signal)
  // Promise<Result<{ text, language: 'en' | 'de' }>>
tts.synthesize({ text, language: 'en' | 'de' }, signal)
  // Promise<Result<{ pcm, sampleRate, encoding:'pcm_s16le', channels:1, language }>>
chat.complete({ system, history, text, language }, signal)
  // Promise<Result<{ text, language }>>
```

Independently select STT/TTS `local-http|disabled`, URL, engine/model/device/voice settings at startup. Concrete engines currently faster-whisper 1.2.1/base CPU-int8 and Piper 1.8.0/English LJ Speech medium CPU. Another backend requires an explicit adapter implementation/configuration, not a silent fallback. NVIDIA/VM/Mac/AMD acceleration and German speech quality remain untested.

OpenRouter is server-only: fixed HTTPS endpoint; explicit model; one attempt; no tools or client-selected provider URL; timeout ≤20 seconds, max tokens default 160 (32–512). Text response must be complete/plain/bounded and meet support question limits. Prompt/runtime validation is not proof of semantic safety or approved facts; selected-model rehearsal remains required. Routing/retention/account configuration and external data-handling limits are documented in [speech handoff](handoffs/anay-speech-chat.md#configure-openrouter-text-chat); no universal deletion guarantee.

## 9. Configuration and running integration checks

Templates: [root .env.example](../.env.example), [private speech template](../services/local-speech/.env.example). Keep real values in ignored private `.env`/host configuration. A configured variable is not the same as a live-tested provider. Do not print settings to debug credentials.

| Group | Keys |
| --- | --- |
| Mode/gateway | `LEMMI_MODE`, `GATEWAY_PORT`, mock-only `LEMMI_MOCK_TOKEN` |
| Authenticated origin/internal seam | `LEMMI_PUBLIC_ORIGIN`, `LEMMI_CONTROL_TOKEN`, `LEMMI_ACCESS_KEY`; web `HOST`, `PORT`, explicit `ORIGIN` |
| Caregiver verifier | `LEMMI_AUTH_INTROSPECTION_URL`, `LEMMI_AUTH_ISSUER`, `LEMMI_AUTH_AUDIENCE`, `LEMMI_AUTH_TOKEN_BINDING`, `LEMMI_AUTH_CLIENT_ID`, `LEMMI_AUTH_CLIENT_SECRET`, `LEMMI_CAREGIVER_SUBJECT` |
| Persistence/media | `LEMMI_DATABASE_URL`, `LEMMI_PRIVATE_MEDIA_DIR`, `BODY_SIZE_LIMIT`; setup uses `LEMMI_CAREGIVER_SUBJECT` and private PostgreSQL configuration |
| Paired computer harness | `LEMMI_DEVICE_CREDENTIAL`, optional `LEMMI_DEVICE_CA_FILE`; these are not server admin credentials |
| OpenRouter | `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `LEMMI_LLM_TIMEOUT_MS`, `LEMMI_LLM_MAX_TOKENS`, client `LEMMI_CHAT_LANGUAGE` |
| Speech adapters | `LEMMI_STT_BACKEND`, `LEMMI_TTS_BACKEND`, `LEMMI_STT_URL`, `LEMMI_TTS_URL`, `LEMMI_SPEECH_TOKEN`, `LEMMI_SPEECH_TIMEOUT_MS` |
| Local engine process | `LEMMI_SPEECH_PORT`, `LEMMI_SPEECH_STT_ENGINE`, `LEMMI_SPEECH_STT_MODEL_PATH`, `LEMMI_SPEECH_STT_DEVICE`, `LEMMI_SPEECH_STT_COMPUTE`, `LEMMI_SPEECH_THREADS`, `LEMMI_SPEECH_TTS_ENGINE`, `LEMMI_SPEECH_VOICE_EN`, `LEMMI_SPEECH_VOICE_DE` |

Use pinned Bun 1.4.4 and `bun install --frozen-lockfile`. Existing checks: `bun run check`, `bun run test`, `bun run build`, `bun run format:check`. With mock dev running/no active session: `bun run smoke:web`. After build: `bun run smoke:control`; optional `bun scripts/smoke-control.ts --chat-fixture` validates chat through a test-only provider fixture with real TLS verification, never a real key/model call.

Private local engine check (requires installed environment/assets; see speech guide):

```sh
# terminal 1
bun --env-file=services/local-speech/.env scripts/local-speech.ts
# terminal 2
bun --env-file=services/local-speech/.env scripts/speech-smoke.ts
```

Neither test plays sound/opens the microphone. Automated fixture tests validate contracts/cancellation/bounds; actual provider, browser usability, target-host performance and local robot controls require separate observations. Record evidence in [build plan](build-and-demo-plan.md#7-acceptance-tracker), not just a checked schema/test name.

## 10. Planned REST and unresolved handoffs — do not call yet

The following come from the technical/integration/robot/personalization specs and **do not exist as production routes in this baseline**. Their final request/response bodies, authorization and consumer changes must ship together. Use mocks/fixtures with explicit unavailable/error states until the owner publishes a working contract.

| Planned surface | Target routes / missing integration | Owner / task |
| --- | --- | --- |
| Profile creation/privacy/deletion | Profile collection/create, session privacy and deletion jobs; Alex read/PATCH and approved-media uploads already exist (A18/A19 above) | Anay A25; Kylie views |
| Browser session/text/audio | Profile session start, `/v1/sessions/:id/commands`, authorized read/event/text and audio grant/stream/end | Anay A12/A13; Kylie/Emilia consumers; do not reuse caregiver/device credentials across roles |
| Activities/playback | `/v1/activity-packs`, `/v1/sessions/:id/activities`, instance view/actions, pack catalog and effects/receipt executor; authorized `/v1/assets/:id` byte reads already exist (A19 above) | Anay A05 + Lukas logic + Kylie view |
| Journal/summary/overview | Profile/session journal, observation and summary review/edit/delete, `/v1/profiles/:id/overview` | Anay A23/A27; Kylie |
| Contacts/help/jobs | Verified contacts/test, `/v1/help-requests` plus status/acknowledge/cancel/resolve, signed notification callbacks and durable jobs | Anay A21/A22; real opted-in team tests |
| Preferences | Profile preference load/edit/forget/remembering and presentation-bound signals | Anay A24/A25; Lukas eligibility/effects; Kylie controls |
| Camera | Device check-in request, `/v1/check-ins/:id` status/end, nonce-bound control and separate bounded media relay | Anay A28–A32; Emilia/Kylie; F13 before F14 |
| Teaching/scene/overview refinements | Session teaching actions/prompt selection, approved photo scene packs and source-linked highlights | Anay A26/A27; reuse conversation/four-activity seams |
| Device health | Freshness/validated measured telemetry after secure F13 gate | Anay A33 + Emilia/Kylie |

Camera is default-off and requires current local Allow for each request; request/relay/state/expiry are not made functional by preliminary headers. End video leaves activities paused; mic mute is not camera-off. Raw frame data never enters models/journal/jobs. Matching retirement and remembered preferences need separate consent/storage/late-write protection; schemas alone do not implement policy. No automatic biography/support-preset writes, clinical scoring or model-chosen actions/contact destinations are part of the API.

## 11. Keeping this reference current

For each backend integration increment:

1. Update the actual shared runtime schema, typed client, authority and counterpart consumers together.
2. Update this reference's availability row, route/event/field/limit/config/error and compatibility notes. Update [backend status](backend-status.md) in the same change with the deployed revision, services, actual observations, failures and remaining limits; distinguish code-ready from deployed and fixture from live. Explicitly identify renamed/replaced shapes and current versus planned paths.
3. Add/reuse nonsecret fixtures and meaningful scope/revision/retry/cancellation/privacy checks; record actual commands/results and untested hardware/provider cases in the build plan.
4. Link the focused handoff and next owner in [Anay's tasks](anay_tasks.md). A task/schema/fixture marked ready never implies hardware or real delivery acceptance.

No OpenAPI document is generated yet. The `operations` registry covers the typed client seam, not every private/public route and not an implemented production REST catalog. Treat this file as the navigable integration inventory and import source schemas for exact executable validation.
