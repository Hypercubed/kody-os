# @hypercubed/kody-os

v4.5.1. Browser shell + data-driven apps in `packageStorage()`. Humans use forms; agents use MCP exports; both funnel into one `act()`.

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

## Access: Kody permissions decide, the shell performs no check

The shell performs no access check in `fetch()`: every request that reaches it is served. Who reaches it is decided before shell code runs by Kody's platform gate — with `internet_visible` off, only the owner and holders of an `app:execute` / Use grant on the app; with `internet_visible` on, anyone on the internet. Access is granted by granting Use / `app:execute` on the app in Kody, and revoked by revoking that grant (or by the visitor signing out of Kody). No link, form, redirect, or header the shell renders carries a credential, because there is no shell check to carry one for. Under the local mock target (`kody dev --target mock`) local dev is login-free because there is no gate at all, not because of a bypass.

- Package visibility (public source, forkable) and `internet_visible` (hosted app reachable without a session) are independent toggles. Warning: with no shell gate left, turning `internet_visible` on exposes the app to anyone on the internet. Do not turn it on for a private shell.
- No secret exists to create, rotate, or revoke, and there are no shell sessions to clear: signing out of Kody itself ends access. Retired OTP/session registry keys (`kody-os.auth.otp.v2`, `kody-os.auth.sessions.v2`, and the v1 keys) are never read; every pre-removal session and OTP stopped working at the publish carrying the removal, and only Kody login restores access.
- MCP exports are not routed through `fetch()` and are governed by Kody's `package:execute` / org access, not by the browser shell. Removing the fetch gate changed nothing about who may call them.
- Response headers on every HTML/JSON page: `no-store`, `no-referrer`, `nosniff`, `frame-ancestors 'none'`.

## App actions and the package-app edge

Kody's edge rejects mutating requests to a `*.kody.run` package-app subdomain when the browser reports a foreign or `null` `Origin`. Never render `<form method="POST">` or `fetch(..., { method: 'POST' })`. UI actions are GET forms (`GET /apps/:id?action=<name>`, no credential field — the platform admits the visitor before shell code runs); `POST /apps/:id` stays for API clients. Bundle scripts resolve action URLs against the shell-stamped `data-action-base="/apps/<id>"` container with `credentials: 'same-origin'`. Checklist: `src/apps/INTEGRATION.md`.

## Frontend / backend boundary (FE/BE)

The shell's browser code (FE) and Kody code (BE) are separated
by directory and by contract, so the FE could run on a different
BE that honors the same contract (fe-be-separation, 2026-11-14).

- **Boundary.** FE code lives in `pkg/src/client/`: the shell
  client module (`index.ts`, the entry — loads the bridge,
  defines the shared `os-*` elements, enhances forms, and
  navigates shell pages client-side), the
  bridge adapter (`bridge.js`), and the shared elements
  (`os-elements.ts`, `os-stepper.ts` — one file per custom
  element). BE code lives in `pkg/src/` outside `client/`: the
  entry, the fetch handler, `act()`, the registry, storage, MCP
  exports, feeds, theme, and the server renderers
  (`apps/render.ts`, `shellChrome` in `app.ts`). No FE module
  imports a BE module: nothing under `pkg/src/client/` imports
  `packageStorage`, the registry, a server type, or any file
  outside `pkg/src/client/` except the vendored Lit
  (`window.KodyLit`, loaded as a script, not an import).
- **Contract.** The FE talks to the BE only through this
  surface: the bridge (`window.KodyBridge` — state reads /
  writes / dispatch, the FE's only interface to BE state), the
  JSON state seed the BE renders before each bundle (read once
  at mount; the bridge reads it, falling back to the spans only
  when no seed is present), the action URLs
  (`data-action-base`, GET forms, `format=json` fast path,
  same-origin), and the `data-*` attributes the FE reads
  (`data-app-id`, `data-field`, `data-client-module`,
  `data-app-base` — the last for client-side navigation). A
  different BE could serve the same FE as long as it honors
  that contract. The BE still renders the shell + seed +
  section skeleton (the islands model). JavaScript is assumed —
  working without JavaScript is NOT a requirement (the no-JS
  requirement was dropped Oct 29–30, 2026). Do not design a
  feature to work without JavaScript or add no-JS fallbacks; the
  server-rendered skeleton is a rendering choice, not a no-JS
  constraint to preserve.
- **Client-side navigation.** The FE navigates Home (`/`) and
  Apps (`/apps`) client-side: it intercepts same-origin clicks
  to those pages, fetches the target as HTML, swaps the
  `#os-main` content in place, updates the document title and
  nav `aria-current`, and pushes the URL with
  `history.pushState`; back/forward (`popstate`) fetches and
  swaps the same way. Any failure falls back to a native
  navigation (a full page load). App pages, Help, and About
  stay full-load. A page whose `#os-main` contains a bundle
  section (a Home widget, `section[data-app-id]`) is never
  swapped in — it falls back to a native full load so the
  widget's script runs and mounts the bundle. Overlapping
  navigations are discarded by a sequence token, and a
  `pushState` failure falls back to a native navigation. The
  BE's only part is stamping `id="os-main"`
  on the `<main>` in `shellChrome`. Scripts in swapped HTML do
  not execute, so all behaviour stays in the persistent bundle;
  the post-swap step (title, `aria-current`, scroll) is the hook
  where seed adoption would go if a future shell page carries
  seeds — Home/Apps carry none, so none is implemented.
- **Organization.** The FE is grouped by concern (entry,
  bridge, elements), not split into one file per UI piece. The
  BE's HTML text stays in the BE renderers; it is not split
  into component files.

## Adding an app

Registry write, not a package change: no commit, no republish. Shipped catalog apps install from the browser App Store (`/apps/app-store`, installed explicitly — a fresh shell starts empty and seeds nothing); agents call `add_app` for custom apps. Not on home until added via Apps Edit's **Add to home** control. The App Store is a data app that installs, updates, and restores catalog apps through the shell management API; pin, hide, and home live in Apps Edit (`/apps?edit=1`), not in the Store. Full contract: [Adding an app](.agents/skills/adding-an-app/SKILL.md) — stateful bundles must follow its Bundle/shell interaction contract and pre-`add_app` checklist, not just the definition contract. Scribe constraints: [Scribe limitations](docs/scribe-limitations.md).

- Definition: meta + bundle (`entry: index.html`, relative `.html`/`.js`/`.css` only, 256 KiB cap) + `stateSchema` + `actions` (`set`/`append`; `increment`/`toggle`/`reset` are deprecated sugar). `ui.template` was removed in schemaVersion 4 (required only for schemaVersion 3 submissions, ignored by the renderer in every version) — never send it in a v4 definition, never branch on it.
- `ui.hideState: true` hides the server-rendered state readout (stays in the DOM for bundle scripts to read initial state). Use when the bundle already displays state.
- `ui.menuBar: true` also shows the app in the top menu bar while installed (after Apps, alphabetically by label). Author-controlled, not a user toggle; hidden apps are excluded, and uninstalling removes the link. No shipped app uses it today: Help and About are built-in shell pages, not catalog apps.
- `ui.help: string` — ship one on every app (every catalog app carries it): a short plain-text how-to-use string (one or two short lines saying what the controls do). It adds a `[?]` button immediately left of expand in the app header (app page and modal overlay), opening the standard modal (no fragment, no navigation) with a `{app name} - Help` header line, the text (escaped, line breaks preserved), and a normal Close button. Distinct from `description` (what the app is for); absent or empty `help` means no button.
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

## Typecheck

```sh
cd pkg
bun run typecheck # tsc --noEmit over src/ (ES2019 + DOM libs, strict, erasableSyntaxOnly; pinned TypeScript 5.9.3). First run needs network (bunx fetches it); afterwards cached.
```

As of 2026-11-08 this reports 19 pre-existing errors: union-narrowing corrections in `app.ts`, `apps/registry.ts`, `apps/definition.ts`, `shell-theme.ts`, plus 4 `process`-not-found errors in `apps/remote-catalog.ts` (missing @types/node — a config gap, not a code error). None introduced by the definition-compiler or owner-gate work (the base commit reported 20; the one fewer is `auth.ts` leaving with the gate). None blocking `bun` or `kody dev`. Fixing them is open work, not part of adding the config.

## Local dev (`kody dev`)

Run from `pkg/` only (repo root fails: missing `kody.app.entry`). Proxy bypass required on this host for every `kody dev` / `curl` call: `export NO_PROXY='*' no_proxy='*'; unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy ALL_PROXY`. Bare `kody dev` (no `--port`) so `fetch` can attach.

```sh
cd pkg
kody dev --target mock --allow-private-network # → App ready at http://127.0.0.1:4302/, status at /__kody/dev/status
systemctl --user enable --now kody-os-dev.service # persistent across turns; verify with is-active + curl status
kody execute --target mock --file scripts/registry.ts --params '{"op":"list"}' # list; op add/remove take definition/id
kody execute --target mock --allow-private-network --file scripts/catalog.ts --params '{"op":"install","id":"app-store","base":"http://127.0.0.1:8901/"}' # install from catalog by id; op update/list also supported
kody execute --target mock --file scripts/add-app.ts --params "$(cat myapp.json)" # install a definition file directly; params ARE the definition, no op wrapper
```

The `app-store` install needs an explicit `"base"` and `--allow-private-network` on the execute. Without `"base"`, `install_from_catalog` has no catalog source when the App Store itself is not installed yet (and `KODY_CATALOG_BASE` does not reach package code in the mock), so it fails with `no catalog source`. Without the flag, the execute's workerd blocks the loopback fetch to `http://127.0.0.1:8901/catalog.json` and the install fails with `unknown catalog app`. The `"base"` above is the local catalog served by `./scripts/dev-local-catalog.sh` on port 8901 (which must be running); installing from GitHub instead uses `"base":"https://raw.githubusercontent.com/Hypercubed/kody-os/main/catalog/"` and needs no flag. `kody dev` also needs `--allow-private-network` for the running mock to fetch the local catalog at all — `dev-local-catalog.sh` does not yet pass it, so start the mock manually with the flag until the script is fixed.

**Mock writes need a stopped server.** `kody dev` reads `~/.cache/kody/mock-sessions/default/state.json` once at startup and serves that snapshot from memory; `kody execute` writes the file, not the running process. A write made while the preview is running returns `{ ok: true }` and does land on disk, but the preview never shows it — and the preview's next write (any app action or state change) rewrites the file from its snapshot and silently deletes the CLI change. So stop `kody dev`, run the `registry`/`catalog`/`add-app` writes, then start it again; "write now, restart later" loses the write as soon as the running preview acts. Verified 2026-10-31: `add-app.ts` with a new id → `{ ok: true }` and present on disk, `GET /apps/<id>` still 404, and the definition gone from the file after one `set_count` on the preview. Live-reload covers `src/` edits; it does not cover mock data.

Install the `app-store` catalog app with the server stopped (see above): `catalog.ts` install as above, with the explicit `"base"` and `--allow-private-network` on the execute — without them it fails (`no catalog source` with no base, `unknown catalog app` without the flag, because the loopback manifest fetch is blocked). No Python step needed any more. Install it explicitly: a fresh shell starts empty and seeds nothing, so the App Store only appears once installed. No credential step: the mock target serves login-free because there is no gate at all. Mock store: `~/.cache/kody/mock-sessions/default/state.json` (`kody-os.apps.registry`, `def.*`, `state.*`). Live-reload 47–197ms; `POST /apps/:id` → 400 guard is expected; `check --offline` 8 checks pass; `fetch` attaches to running pid; `job`/`webhook`/`emit` report `(none)` — no handlers declared. There is no authenticated `fetch` check ceremony: verify actions in the browser instead.

## Edge cases

- No root-export side effects: no jobs, file writes, or installs.
- Missing runtime context falls back to shared in-memory storage, starting empty with an honest "no apps yet" tile.
- JavaScript is assumed (Chromium 80 on the Scribe; the no-JS requirement was dropped Oct 29–30, 2026). Working without JavaScript is NOT a requirement: do not design a feature to work without JavaScript, and do not add no-JS fallbacks. The client enhances `form.app-action` with `?format=json` in-place patching. The App Store requires JavaScript, because it is a data app that loads its rows through the management API; without JavaScript it shows a note pointing at agent `add_app`. Return-to-opener is a JavaScript enhancement backed by `sessionStorage` (`kody-os:return`): with scripting the app-page Close box points at the opener, and without it the Close box goes Home while a native widget submit lands on the app page. Plain action submit + redirect, fragment expand/collapse, and `:target` overlays are unchanged behavior.
- Browser ceiling: the canonical ES2019 statement in `pkg/docs/scribe-limitations.md` binds bundle scripts and the shell client (ES2019 and earlier; Chromium 80 on-device probe, 2026-10-25). Do not restate the ceiling here. No flexbox gap (grid gap OK), system fonts only, zero emojis, 48px minimum tap targets.
- Styles inlined (`src/shell-css.ts` generated from `public/styles.css`) — no external stylesheets. Regen after any theme edit.
- App styles live in the app, never in the shell theme: never put app-specific rules in `public/styles.css` (or the generated `src/shell-css.ts`). A rule that targets one app — for example one scoped by that app's panel label (`aria-label`) — belongs in that app's own bundle CSS, as a `<style>` block in its `index.html` or a `.css` file in its `files` map.
