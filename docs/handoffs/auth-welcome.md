# Lemmi access page integration and deployment

## Server integration completed — November 15, 2026

Integrated source `c8a1cf9` into current `backend-deploy` with merge `7b2c3a3`.
Deployed web `5b4c23e` at 19:29:48 UTC. Added only `no-transform` to the existing
no-store access HTML cache policy after the public proxy injected analytics that
CSP correctly blocked; no script permission was added. The final public Chromium
run passed all four viewport layouts, assets/font, keyboard, wrong-key rejection,
private-key unlock, cookie reload and relock with zero browser/CSP errors. No
profile writes or notification sends occurred. Independent security review found
no blockers. Focused access/voice/device/demo checks passed 22 tests and 249
expectations; type/Svelte, build, formatting and whitespace passed with the three
existing generic-photo-alt warnings. Full-suite and hardware checks were not rerun.
Only web restarted. Gateway, speech, tunnel, private settings, proxy, database and
media were preserved. Protected rollback: `.data/auth-welcome-rollback-path`.
[Current deployment record](../backend-status.md#branded-access-page-deployed--november-15-2026).

The original branch instructions and development-only observations follow.

Branch: `codex/auth-welcome`  
Base: `435b73a` (existing branding integration)  
Handoff path: `docs/handoffs/auth-welcome.md`

## Change to integrate

The `/access` entrance now matches Lemmi's existing UI: supplied mascot/logo,
Nunito typography, cream paper texture, sage buttons and brown outlines. It has
responsive locked, rejected-key, unlocked, relocked and throttled states. Once
unlocked, it presents the existing caregiver and participant destinations plus
the browser-lock action.

Implementation files:

- `packages/server/src/private-access-page.ts`: standalone HTML, styles and
  matching Content Security Policy for the page served before the app shell.
- `packages/server/src/private-access.ts`: renders the new page for the existing
  handler states, including the HTTP 429 response.
- `tests/private-access.test.ts`: checks stylesheet authorization, blocked
  scripts, no key reflection, accessible rejection feedback and unlocked links,
  alongside existing cookie, CSRF, throttle and authorization checks.
- `docs/build-and-demo-plan.md`: observed local verification record.

The CSP authorizes the exact fixed stylesheet by SHA-256 and same-origin images
and fonts. Scripts remain denied by `default-src 'none'`. Keep the policy and
template together: changing the emitted stylesheet independently of its hash
would prevent styling. Existing POST actions, origin validation, signed cookie
settings, access-key checks and independent caregiver authorization are retained.

## Integrate on the server

Fetch `origin/codex/auth-welcome` and integrate it into the **current** deployment
integration branch using the team's normal merge or cherry-pick process. This
branch starts from `435b73a`; preserve newer server, UI, session and speech work.
Do not replace the current deployment checkout with this branch's older base.
Review any conflicts in `private-access.ts` against the newer authentication
behavior, and retain the current server's security checks.

Use Bun **1.4.4** and the existing workspace commands:

```sh
bun install --frozen-lockfile
bun run check
bun test tests/private-access.test.ts
bun run build
bun run format:check
git diff --check
```

Deploy the resulting web build and restart only the web service through the
existing deployment process. Save the current working web release for rollback
first. This change needs no database migration, configuration or credential
change, dependency update, gateway restart, speech restart or firmware change.

The following existing generic assets must remain publicly reachable before
unlocking, through the current narrow proxy allowlist:

- `/images/brand/lemmi.png` — `image/png`
- `/images/surfaces/cream-paper-v1.png` — `image/png`
- `/fonts/nunito-latin-variable.ttf` — font data
- `/favicon.svg` — `image/svg+xml`

They are already listed in this branch's `deploy/nginx.conf.template`; no new
proxy paths are introduced. If the actual server is missing one, reconcile only
these existing paths, validate the installed proxy configuration, and reload it
through its normal procedure. Keep private-media routes protected.

## Verify after deployment

1. Open `/access` in a fresh browser context without a gate cookie. Confirm the
   logo, texture, font, cream/sage colors and page title render before unlocking,
   with no asset failures, CSP violations or horizontal overflow.
2. Check a desktop viewport and a narrow mobile viewport, keyboard Tab/focus and
   enlarged layout. Confirm the input and primary action remain readable/usable.
3. Submit an incorrect fictional key. Expect HTTP 401 and clear feedback, with
   the input cleared and no submitted key echoed into the page.
4. Unlock using the privately configured real key without logging or exposing
   it. Expect the caregiver/participant links and the browser-lock action. Reload
   to verify the existing signed cookie keeps the browser unlocked.
5. Use **Lock this browser**. Reload and confirm the key form returns. The domain
   key still does not grant caregiver resource authorization or participant
   assignment. Use a fresh context if the browser already owns a live session.

Keep existing rate limits and security headers. Do not exhaust the shared live
throttle to test HTTP 429; that state is covered by the isolated tests.

If the web release fails these checks, restore the previous web release through
the existing rollback procedure and report the observed failure. Do not change
access policies, private configuration or unrelated services to hide a failure.

## Verification already observed locally

- Pinned Bun 1.4.4 frozen install; no lockfile or dependency change.
- `bun run check`: zero Svelte errors/warnings; TypeScript passed.
- `bun test tests/private-access.test.ts`: **7 passed, 0 failed, 64 expectations**.
- Production build, repository formatting and whitespace checks passed.
- Chromium against the actual handler and existing assets, using fictional
  credentials: 1280×900, 390×844, 320×740 and 640×450 (the available layout area
  at 200% desktop zoom). No horizontal overflow, runtime errors or CSP errors.
- Pre-unlock assets, native wrong-key/unlock/lock form submissions, cookie reload
  and keyboard focus passed. The headless favicon check explicitly loaded and
  decoded the icon because headless Chromium does not request tab icons itself.
- A read-only technical agent review found no blocking access/CSP issues.

The full application test suite was not rerun for this bounded page change.
These are local fixture/browser results, not public-host or hardware acceptance.
This task has not deployed or restarted any live service. Local screenshots are
under `/tmp/lemmi-auth-{desktop,mobile,rejected,unlocked}.png` on the development
machine; they are not required deployment artifacts or files in this branch.
