# Lemmi logo, favicon and browser identity

November 15, 2026. Branch: `codex/lemmi-branding`, based on main `f3e3b41`. Ready for backend integration review; not deployed.

## Source and UI changes

Verified `/home/chaos/projects/Lemmi/lemmi.png`: 1312 × 1199 RGBA PNG, 303,747 bytes. The source remains in place and unmodified. The exact bytes are committed at `apps/web/static/images/brand/lemmi.png`; see that directory’s README for source/permission details and SHA-256.

- `BrandLogo.svelte` uses the supplied character in the app header and mock welcome page. An SVG viewport excludes the original transparent margins without editing or regenerating its pixels. Participant avatar choices and robot assets remain unchanged.
- `apps/web/static/favicon.svg` embeds the identical PNG in the same square viewport, so browser tabs can render it without external image requests. App HTML also sets the Apple touch icon, application name, mobile title and cream theme color.
- Default title: **Lemmi — a little company**. Caregiver and participant routes retain their appropriate Lemmi titles; caregiver settings uses **Caregiver settings — Lemmi**. The description now explains the product instead of calling it a development starter.
- `deploy/nginx.conf.template` adds only `/favicon.svg` and `/images/brand/lemmi.png` to the existing reviewed static-file allowlist. No broad image-directory alias. The existing participant smoke script includes the same exact paths and MIME checks.

## Backend deployment handoff

Integrate this branch’s commit into the current `backend-deploy` integration branch using the team’s normal review/merge or cherry-pick workflow. Keep existing backend changes and private configuration; do not replace the deployed checkout with the older main baseline. This branch is separate from `codex/participant-greetings-exit` and does not merge or deploy that work.

Use the pinned Bun 1.4.4 setup and the existing `bun install --frozen-lockfile`, `bun run check` and `bun run build` commands. Deploy the resulting web bundle and restart the web service through the existing host process manager. No gateway/speech restart, database migration, credential change, new environment variable or dependency is required for branding.

The backend owner must carry the two new exact static paths into the **actual** reverse-proxy allowlist, run the installed proxy’s `nginx -t`, and reload it through its normal host procedure. Nginx is unavailable in this local environment, so its installed configuration has not been syntax-tested or changed here. Rebuilding only the web app without allowing these two paths at the proxy can leave the logo or favicon returning 404.

After rollout, verify the caregiver header, browser tab title and icon, and successful public image responses at `/favicon.svg` (`image/svg+xml`) and `/images/brand/lemmi.png` (`image/png`). Keep unrelated static/private paths blocked. A reload/reopened tab may be needed because browsers cache favicons. The separate private-access HTML remains the existing gate; no authentication policy or CSP is changed.

## Observed checks

- Frozen Bun install succeeded with no lockfile change.
- `bun run check`: 0 Svelte errors/warnings and workspace TypeScript passed.
- `bun run test`: **371 passed, 42 skipped, 0 failed**, 5,937 expectations across 55 files. Database checks need configured isolated PostgreSQL.
- `bun run build`, `bun run format:check` and `git diff --check` passed. A standalone production build on loopback port 5182 returned both brand files with byte-for-byte equality, HTTP 200 and the expected MIME types; home/settings HTML contained the expected titles and resolved favicon URL.
- Original/copy/embedded-favicon PNG bytes match exactly. Static allowlist matching checks admit the two assets and reject unlisted brand files, README paths, `.env` and a favicon suffix path.
- Headless Chromium at 1280×900 and 390×844 verified the header logo, home/caregiver/settings/participant titles, global metadata/favicon and keyboard menu open/Escape. A 32×32 canvas decode confirmed the favicon paints the supplied artwork (547 opaque pixels), rather than a broken or blank icon. No page errors or horizontal overflow were observed. Screenshots are in `/tmp/lemmi-branding-home-1280.png`, `/tmp/lemmi-branding-home-390.png`, `/tmp/lemmi-branding-caregiver-1280.png` and `/tmp/lemmi-branding-caregiver-390.png`.

These checks use the local mock app and fictional fixtures. No real profile data, providers, hardware, production proxy or live deployment were used. Anay reviews/reloads the narrow static proxy rules; Kylie reviews the supplied branding in the actual deployed UI.
