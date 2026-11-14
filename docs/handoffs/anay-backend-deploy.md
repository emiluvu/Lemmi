# Anay: backend-deploy publication and private domain gate

The user authorized creating/pushing `backend-deploy` without switching the checkout used by the other Codex session. Backend code was assembled and verified in `/tmp` using a separate Git index. The shared branch and staging area are not changed by publication. Deployment-specific gate code lives on `backend-deploy`; merge it deliberately into feature/integration branches before editing it in the shared checkout.

Included: prior scoped controls; speech/chat adapters and service; activity A01–A04 contracts; the other agent's completed A18/A19 PostgreSQL/profile/media/device/session work; an outer domain key gate; updated backend API and new-machine deployment guide. Secrets, `.env`, models, virtual environments, databases and private media are excluded.

## Authentication choice

The user chose **shared key guards the domain; keep OIDC sign-in**. Set independent `LEMMI_ACCESS_KEY` on live web/gateway (32–256 visible characters). Live startup fails closed without it. Browser GET/POST `/access` exchanges it for an eight-hour signed `__Host-lemmi_access` Secure/HttpOnly/SameSite=Strict cookie. POST `/access/logout` clears the current browser cookie. Devices send `X-Lemmi-Access-Key` on provisioning/asset/profile requests and WSS upgrade, alongside the scoped Bearer credential. The computer harness supports the header; actual Stackchan firmware still needs Emilia's change. No key belongs in URLs, browser source, model context or logs.

The gate does not replace caregiver identity or device pairing. The selected self-hosted OIDC provider must expose compatible RFC 7662 introspection under the current adapter; issuer/audience/client credentials/assigned subject are still needed privately. Browser sign-in UI, generic JWT/JWKS verification and browser participant text transport are pending. Cloudflare Tunnel needs the explicit public route allowlist and proxy headers in the deployment guide; no Cloudflare Access account/service token is required for this gate.

## Persistence review

PostgreSQL persists profiles/approved facts/media, credential hashes and bounded factual/session checkpoints. Startup **revokes** prior tokens and **ends** interrupted sessions. It does not restore login, a conversation, listening or playback. Pairing codes remain transient. Key cookies may survive a restart with the same key until expiry; that grants no device/session authority. Rotate the key and restart both services to invalidate gate cookies/connections. Complete deletion/jobs/journal-review workflows remain pending.

## Observed checks and next host handoff

Pinned Bun 1.4.4, fresh frozen-lockfile install; **88 Bun tests, 794 expectations, no failures** against a newly isolated native PostgreSQL 14.24 cluster; type/Svelte checks, production build and formatting; certificate-verified HTTPS/WSS pairing/browser key exchange/fixture OpenRouter chat/pause/resume/revoke; real PostgreSQL production profile/PATCH/approved PNG/media/scope/revocation smoke with the gate enabled. Seven Python boundary tests passed before the gate; speech Python sources are unchanged. No dependencies/lockfile were changed. The temporary PostgreSQL cluster is stopped after verification.

Real host/domain/tunnel, actual OIDC provider/model, browser usability and hardware remain unverified. Counterpart technical review is still required for the shared auth/persistence boundary. See [deployment guide](../backend-deploy.md), [backend API](../backend_api.md), [database guide](../../db/README.md) and [data owner handoff](anay-database-profile-assets.md). The user configures automatic branch pull/rebuild/restart on the new machine; this repository does not install that automation.

## Merge verification update

Main integration conflicts and a reproduced stale-gateway credential-issuance bug were resolved. The resulting tree passed 91 Bun tests against isolated PostgreSQL, seven Python boundary tests, type/build/format checks and control/chat/data/mock smokes. Exact evidence and limits: [merge verification](anay-backend-deploy-verification.md). Live host/provider observations above were not repeated by that local review.
