# Lemmi backend status

Observed November 13, 2026 (America/Los_Angeles). Branch: `backend-deploy`.

The implemented backend is deployed on `mobrob-Precision-3680`. This is a fictional Alex integration deployment, not completed P0 scope or readiness for unattended care.

## Deployment

Public origin: **https://lemmi.chaoswarrior.dev**. Open **[/access](https://lemmi.chaoswarrior.dev/access)** to unlock the outer domain gate. `/` intentionally returns 404. The shared access key is stored privately in the host's root `.env`; it does not replace caregiver authentication or device pairing.

Traffic follows Cloudflare → `cloudflared` → loopback Nginx → SvelteKit HTTP API / Bun realtime gateway. Database, private media and speech are not public services.

| Component | Running configuration |
| --- | --- |
| HTTP API | `lemmi-web` user service, `127.0.0.1:3000` |
| Session/realtime authority | `lemmi-gateway` user service, `127.0.0.1:3001` |
| Reverse proxy | Docker Compose project `lemmi-proxy`, Nginx 1.28 Alpine, `127.0.0.1:8080` |
| Public tunnel | `lemmi-tunnel` user service, named tunnel `lemmi-backend`, four observed edge connections |
| PostgreSQL | Docker Compose project `lemmi`, PostgreSQL 17, healthy on `127.0.0.1:5432`, persistent volume |
| Private speech | `lemmi-speech` user service, `127.0.0.1:8765`, CPU Whisper/Piper; quality gate incomplete |
| Worker | Placeholder only; not deployed |

User lingering is enabled. Application/tunnel/speech services are enabled; containers use restart policies. Bun 1.4.4 and cloudflared 2026.11.0 are installed under ignored `.data/bin`. Reboot recovery has not been rehearsed. No automatic Git pull, build or deployment updater is installed.

## Authentication and persistence

- The missing live access-key wiring in `controlConfig` was repaired. Live configuration now requires an independent outer key, passed to both HTTP and WSS gate checks.
- Actual VoidAuth discovery, authorization-code login with state/PKCE and authenticated introspection passed. Issuer: `https://auth.chaoswarrior.dev/oidc`.
- This host explicitly selects `LEMMI_AUTH_TOKEN_BINDING=client_id` for VoidAuth non-resource tokens. Client identity, issuer, active status, Bearer type, expiry and assigned caregiver subject remain required. Any present audience must match the configured audience. Other deployments default to strict audience binding; there is no automatic fallback.
- The loopback-only `scripts/setup-caregiver.ts --assign-alex` helper saved the verified subject/database configuration without retaining tokens. It is setup tooling, not production browser sign-in.
- Migrations and fictional Alex bootstrap completed. The running gateway uses PostgreSQL for the implemented profile, credential-hash and bounded factual/session-checkpoint storage. Private approved media uses protected local storage.
- Gateway restart invalidates issued device credentials and ends interrupted sessions. It does not resume listening, playback or a conversation. Explicit re-pairing/start is required.
- Root and speech environment files are mode 0600. Provider credentials, identity identifiers, tunnel credential JSON, certificates, models, databases and private media are excluded from this commit.

## Observed verification

| Check | Result and scope |
| --- | --- |
| Pinned frozen-lockfile install | Passed; Bun lockfile unchanged |
| Type/Svelte, production build, formatting, diff whitespace | Passed |
| Bun automated suite | **90 tests passed, 826 expectations**, including real isolated `lemmi_test` PostgreSQL |
| Production control/chat smoke | Passed with certificate-verified HTTPS/WSS and explicit identity/model fixtures |
| Production data smoke | Passed with real isolated PostgreSQL/private media and fixture identity |
| Python speech boundary suite | **7 tests passed**; fixture inference worker |
| Public access boundary | Verified HTTPS unlock, secure cookie exchange/logout, missing-key/device rejection and internal/mock route denial |
| Actual identity provider | VoidAuth code/PKCE login and introspection passed; tokens discarded |
| Actual model provider | OpenRouter fictional greeting passed; standalone request approximately 3.6 seconds; reply/credentials not logged |
| Public computer-device path | Real persistent pairing authority → public HTTPS claim/profile → verified WSS Start → real model greeting → Pause → Resume → Stop passed; rehearsal credential revoked |

The live computer rehearsal created its pairing through the private authenticated server authority. It did **not** exercise a public caregiver-bearer pairing request; real caregiver verification was tested separately. No physical robot, microphone, camera, real contact or notification was used. Fixture tests remain distinct from these live observations.

## Remaining limits and next handoff

1. **Host DNS:** the lab system resolver still fails to resolve the new public hostname, including after cache flush. Public DNS-over-HTTPS resolves it. Public checks used the published Cloudflare edge address while preserving Host, TLS SNI and certificate validation. Normal hostname-only clients on this machine require this DNS issue to clear or a separately reviewed resolver fix. Global network settings were not changed.
2. **Speech:** synthetic English recognition was intermittent. Engines are running privately, but integrated device/browser capture, STT-to-chat, speech/music playback and receipts are incomplete. No robot voice-readiness claim follows from engine startup.
3. **Product work:** production browser OIDC sign-in/participant text transport, full journal/summary, notification/outbox, preferences/deletion workflows, completed activities, camera and physical K151 acceptance remain pending as described in the [API inventory](backend_api.md) and team plan.
4. **Review:** Anay reviews access/storage/deployment changes; Emilia verifies real firmware headers, pairing and independent local controls. Shared-boundary technical review and reboot/network-failure rehearsal remain outstanding.

Operations, private provisioning and service commands: [host setup](host-setup.md). General deployment topology and acceptance checklist: [backend deployment](backend-deploy.md). Observed team acceptance record: [build and demo plan](build-and-demo-plan.md).
