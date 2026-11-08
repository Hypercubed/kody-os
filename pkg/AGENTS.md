# @hypercubed/kody-os

v4.1.0. Browser shell + data-driven apps in `packageStorage()`. Humans use forms; agents use MCP exports; both funnel into one `act()`.

## Version policy

Single source of truth: `pkg/package.json` — `version` (`MAJOR.MINOR.PATCH`) and `build` (integer). The status bar reads them at runtime via `getPackageMeta()`; never set the displayed version anywhere else. `pkg/AGENTS.md` and `pkg/README.md` headers MUST state the same version as `package.json`; update them in the same commit as any bump. `0.x` does not soften these rules: a breaking change bumps MAJOR even before 1.0.

Apply the HIGHEST bump any part of the change triggers. When in doubt between two levels, take the higher one. Bump in the same commit as the change it describes — never a separate "bump version" commit, and never bump for a change you have not verified.

- **MAJOR — existing apps or agent scripts will break.** Bump MAJOR when any of these is true: an existing valid app definition no longer validates, installs, or acts the same; support for a `schemaVersion` is dropped; a state field, storage key, or effect operator changes meaning or is removed without migration; rendered markup, client patch scope, or form semantics change in a way a conforming bundle must adapt to; an MCP export is removed, renamed, or changes signature/return shape; the shell-provided framework/adapter surface (once it lands) changes in a breaking way; auth, edge, or session behavior changes so existing bookmarks, codes, or sessions stop working. If an app, definition, or script that worked before stops working — or behaves differently — without changes on its side, it is MAJOR. No exceptions for "small" breakage.
- **MINOR — new feature, nothing existing breaks.** Bump MINOR for: a new `schemaVersion` (old versions keep working); a new MCP export; a new effect operator; a new optional `ui` or definition field (ignored by older readers); a new capability (e.g. a new feed type, a new launcher list); a new provided-framework capability that existing apps can ignore; a new doc surface describing a new feature. Reset PATCH to 0 on a MINOR bump.
- **PATCH — bug fix or correction, behavior otherwise unchanged.** Bump PATCH for: a fix that restores documented behavior; an internal refactor with no observable change; a CSS/theme tweak that does not change the contract; a docs-only correction (including drift fixes to this file and `pkg/README.md`). Reset nothing else. Docs-only changes ride with the next version-bumping change when one is pending; a publish containing only docs corrections still bumps PATCH.
- **BUILD — increment by exactly 1 on every publish**, including publishes where `version` is unchanged. Never reset `build`, never skip an increment, never reuse a `version` + `build` pair. The build number alone never communicates compatibility — it only orders publishes.

What does NOT bump the version: changes outside `pkg/` (e.g. `openspec/` drafts, repo tooling), and app definitions or state written via `add_app`/`act` (data, not package code). Those change no shipped package behavior and need no version decision.

This policy's own addition, and the header correction from v0.1.5 to v0.1.7 that accompanies it, do not bump the version: the header now states the version already in `package.json`, and the policy text is docs-only.

## Imports

```ts
import main, { add_app, act, list_apps, get_app_state, export_app, import_app, remove_app, get_launcher_state, get_recent, clear_recent, backup, restore } from 'kody:@hypercubed/kody-os'
```

## Device access gate

Only `src/app.ts` fetch requests are gated; MCP exports are not. Kody login is the only way in: a platform-verified Kody visitor with role `owner` in the owning org is served, verified per request — no session, no code, no cookie, no secret, no derived code, no stored-hash fallback. No link, form, redirect, or header the shell renders carries a credential. Under the local mock target (`kody dev --target mock`, detected by the `local:`-prefixed package/source id in the runtime context) the gate is skipped entirely, so local dev is login-free.

- No secret exists to create, rotate, or revoke, and there are no shell sessions to clear: Kody login is verified per request, so signing out of Kody itself ends access. Retired OTP/session registry keys (`kody-os.auth.otp.v2`, `kody-os.auth.sessions.v2`, and the v1 keys) are never read; every pre-removal session and OTP stopped working at the publish carrying the removal, and only Kody login restores access.
- Requests without verified visitor identity get the same honest 404. The Kody gate is owner-only (`isKodyOwnerVisitor` in `src/auth.ts` — platform visitor header with role `owner` plus a live `metaGetCurrentUser` confirm, fail-closed). Any other visitor is denied like an anonymous visitor. MCP exports are still ungated by fetch.
- Response headers on every HTML/JSON page: `no-store`, `no-referrer`, `nosniff`, `frame-ancestors 'none'`.

## App actions and the package-app edge

Kody's edge rejects mutating requests to a `*.kody.run` package-app subdomain when the browser reports a foreign or `null` `Origin`. Never render `<form method="POST">` or `fetch(..., { method: 'POST' })`. UI actions are GET forms (`GET /apps/:id?action=<name>`, no credential field — authentication rides the platform-verified Kody visitor); `POST /apps/:id` stays for API clients. Bundle scripts resolve action URLs against the shell-stamped `data-action-base="/apps/<id>"` container with `credentials: 'same-origin'`. Checklist: `src/apps/INTEGRATION.md`.

## Adding an app

Registry write, not a package change: no commit, no republish. Shipped catalog apps install from the browser App Store (`/apps/app-store`, installed explicitly — a fresh shell starts empty and seeds nothing); agents call `add_app` for custom apps. Not on home until added via Apps Edit's **Add to home** control. The App Store is a data app that installs, updates, and restores catalog apps through the shell management API; pin, hide, and home live in Apps Edit (`/apps?edit=1`), not in the Store. Full contract: [Adding an app](.agents/skills/adding-an-app/SKILL.md) — stateful bundles must follow its Bundle/shell interaction contract and pre-`add_app` checklist, not just the definition contract. Scribe constraints: [Scribe limitations](docs/scribe-limitations.md).

- Definition: meta + bundle (`entry: index.html`, relative `.html`/`.js`/`.css` only, 256 KiB cap) + `stateSchema` + `actions` (`set`/`append`; `increment`/`toggle`/`reset` are deprecated sugar). `ui.template` was removed in schemaVersion 4 (required only for schemaVersion 3 submissions, ignored by the renderer in every version) — never send it in a v4 definition, never branch on it.
- `ui.hideState: true` hides the server-rendered state readout (stays in the DOM for bundle scripts to read initial state). Use when the bundle already displays state.
- `ui.menuBar: true` also shows the app in the top menu bar while installed (after Apps, alphabetically by label). Author-controlled, not a user toggle; hidden apps are excluded, and uninstalling removes the link. No shipped app uses it today: Help and About are built-in shell pages, not catalog apps.
- `capabilities.feeds`: up to 8 `{ name, url, ttlSeconds?, maxBytes? }` — HTTPS only, served via `GET /feed/:app/:name` with storage caching. Data-only declarations; the route takes the feed name, never a URL.
- `capabilities.proxy`: up to 8 `{ name, url, ttlSeconds?, maxBytes? }`, same limits as feeds — HTTPS only, served via `GET /proxy/:app/:name` with storage caching. The route takes the proxy name, never a URL.
- `capabilities.manageApps`: boolean. Only a bundle declaring this may use the shell management API (`GET /manage/rows|install|update|restore`); undeclared callers get the feed-style plain 404. Capabilities are installer disclosure plus this allowlist, not a sandbox: bundle scripts run same-origin with the visitor's authority.
- `capabilities.theme`: `{ view: boolean, set: boolean }` — `view` allows the read route, `set` allows set and reset through `GET /theme/:app`; a definition with neither flag true is treated as not declaring theme. Undeclared callers get the feed-style plain 404. Capabilities are installer disclosure plus this allowlist, not a sandbox: bundle scripts run same-origin with the visitor's authority.
- Bundle scripts run same-origin with the visitor's full authority: installing an app = trusting its code. Review third-party bundles before `import_app`.

## Smoke tests

```ts
import main from 'kody:@hypercubed/kody-os'
const info = await main()
// => { package, exports: [...], note: 'Phase 2 app layer — data-driven apps via packageStorage.' }

import { add_app, act, list_apps, get_app_state, export_app, import_app, remove_app } from 'kody:@hypercubed/kody-os'
import counterBundle from './catalog/counter/definition.json' with { type: 'json' }
await add_app(counterBundle) // { ok:true, id:'counter' } — no republish
await list_apps() // exactly 1 entry
await act('counter', 'set_count', { value: 1 }) // { ok:true, state:{ count:1 } }
await get_app_state('counter') // same state the UI route renders
const exp = await export_app('counter') // format 'kody-os-app/2'
await act('counter', 'set_count', { value: 9999999 }) // { ok:false } — state unchanged
await remove_app('counter') // definition, state, and all reference lists gone
```

`remove_app` is MCP-only (the UI exposes hide, never remove) and validates the id first; unknown ids return `{ ok:false }` and write nothing. Export v1 payloads import with id derived from name; v2 is id-keyed.

## Local dev (`kody dev`)

Run from `pkg/` only (repo root fails: missing `kody.app.entry`). Proxy bypass required on this host for every `kody dev` / `curl` call: `export NO_PROXY='*' no_proxy='*'; unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy ALL_PROXY`. Bare `kody dev` (no `--port`) so `fetch` can attach.

```sh
cd pkg
kody dev --target mock # → App ready at http://127.0.0.1:4302/, status at /__kody/dev/status
systemctl --user enable --now kody-os-dev.service # persistent across turns; verify with is-active + curl status
kody execute --target mock --file scripts/registry.ts --params '{"op":"list"}' # list; op add/remove take definition/id
kody execute --target mock --file scripts/catalog.ts --params '{"op":"install","id":"app-store"}' # install from catalog by id; op update/list also supported
kody execute --target mock --file scripts/add-app.ts --params "$(cat myapp.json)" # install a definition file directly; params ARE the definition, no op wrapper
```

**Mock writes need a stopped server.** `kody dev` reads `~/.cache/kody/mock-sessions/default/state.json` once at startup and serves that snapshot from memory; `kody execute` writes the file, not the running process. A write made while the preview is running returns `{ ok: true }` and does land on disk, but the preview never shows it — and the preview's next write (any app action or state change) rewrites the file from its snapshot and silently deletes the CLI change. So stop `kody dev`, run the `registry`/`catalog`/`add-app` writes, then start it again; "write now, restart later" loses the write as soon as the running preview acts. Verified 2026-10-31: `add-app.ts` with a new id → `{ ok: true }` and present on disk, `GET /apps/<id>` still 404, and the definition gone from the file after one `set_count` on the preview. Live-reload covers `src/` edits; it does not cover mock data.

Install the `app-store` catalog app with the server stopped (see above): `catalog.ts` install as above — no Python step needed any more. Install it explicitly: a fresh shell starts empty and seeds nothing, so the App Store only appears once installed. No unlock step: the mock target serves login-free. Mock store: `~/.cache/kody/mock-sessions/default/state.json` (`kody-os.apps.registry`, `def.*`, `state.*`). Live-reload 47–197ms; `POST /apps/:id` → 400 guard is expected; `check --offline` 8 checks pass; `fetch` attaches to running pid; `job`/`webhook`/`emit` report `(none)` — no handlers declared. There is no authenticated `fetch` check ceremony: verify actions in the browser instead.

## Edge cases

- No root-export side effects: no jobs, file writes, or installs.
- Missing runtime context falls back to shared in-memory storage, starting empty with an honest "no apps yet" tile.
- Works without JavaScript (form submit + PRG); the client only enhances `form.app-action` with `?format=json` in-place patching (guarded, falls back to native submit). Exception: the App Store itself requires JavaScript, because it is a data app that loads its rows through the management API; without JavaScript it shows a note pointing at agent `add_app`, and the rest of the shell still works without JavaScript.
- Browser ceiling: the canonical ES2019 statement in `pkg/docs/scribe-limitations.md` binds bundle scripts and the shell client (ES2019 and earlier; Chromium 80 on-device probe, 2026-10-25). Do not restate the ceiling here. No flexbox gap (grid gap OK), system fonts only, zero emojis, 48px minimum tap targets.
- Styles inlined (`src/shell-css.ts` generated from `public/styles.css`) — no external stylesheets. Regen after any theme edit.
- App styles live in the app, never in the shell theme: never put app-specific rules in `public/styles.css` (or the generated `src/shell-css.ts`). A rule that targets one app — for example one scoped by that app's panel label (`aria-label`) — belongs in that app's own bundle CSS, as a `<style>` block in its `index.html` or a `.css` file in its `files` map.
