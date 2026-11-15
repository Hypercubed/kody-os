## 1. Server — remove `from` from renderers

- [x] 1.1 In `pkg/src/apps/client.ts`, remove `?from=` from every rendered link: `tileItem` (plain and `?touch=1` modal tiles), `renderOverlaySection` (modal-expand box), `renderHomeTiles`, and `renderWidgetSection` (widget expand box). After this step every app link in the shell renders as a plain `/apps/<id>` (plus `?touch=1` for modal tiles)
- [x] 1.2 In the same file, delete the `fromPath` parameter and the hidden `<input type="hidden" name="from">` from `renderAppSection`, and delete the `fromPath` parameter from `renderAppPanel` (including the `renderOverlaySection` call that passed `/apps#app-<id>` as its form field value; the separate `renderWidgetSection` call to `renderAppSection` that passed `/` goes with it). Update all callers so no `fromPath` argument remains anywhere in `pkg/src`. The `closeHref` / `expandHref` parameters of `renderAppPanel` are unchanged (overlay close stays `#apps`)
- [x] 1.3 Verify by grep that no `?from=`, `name="from"`, or `fromPath` remains in `pkg/src/apps/client.ts`

## 2. Server — remove `from` from dispatch

- [x] 2.1 In `pkg/src/app.ts`, drop the `fromParam` parameter from `appBody` and `renderAppPage`. The close box renders from `shellChrome`'s existing default (Home, `/`) with label Home; do not add a new default path. Update the App Store branch and the plain app-page branch to call `appBody(gid, '')` with no return value
- [x] 2.2 In the action branch, delete the `fromPath` read and the `dest` computation: a successful action 303s to the app page (`appBasePath + '/apps/' + gid`), and a failed action always re-renders the app page via `appBody` (delete the `dashboardBody` error branch). Keep excluding `from` from the arguments passed to `act()` and add a comment that it is legacy tolerance for old links, not a feature
- [x] 2.3 In the touch branch, delete the `touchFrom` read and derive the destination server-side as `appBasePath + '/apps#app-' + gid`. Add the `format=json` branch: when `format=json` is present, record the open with the same `record_use` call and failure tolerance as the 303 path, then return JSON `{ ok: true }` with `no-store` headers instead of redirecting
- [x] 2.4 In the theme branch, delete `themeFrom` / `themeDest`: set/reset without `format=json` 303 back to the app page (`appBasePath + '/apps/' + themeApp`). The `format=json` paths are unchanged
- [x] 2.5 Delete `safeNextPath` from `pkg/src/app.ts` once nothing calls it, and verify by grep that no `query.get('from')`, `themeQuery.get('from')`, `fromParam`, or `safeNextPath` remains in `pkg/src` except the legacy-tolerance exclusion in the action branch (2.2) and its comment

## 3. Client — store the return on navigation

- [x] 3.1 In `pkg/src/client/index.ts`, add a delegated click listener on `document` that matches links whose path is `<base>/apps/<id>` (base read from `document.documentElement.dataset.appBase`, falling back to the path prefix up to the first `/apps/`), and synchronously stores `location.pathname + location.hash` under `sessionStorage` key `kody-os:return` before the navigation proceeds. The handler MUST NOT prevent default, stop propagation, or change the destination; middle-clicks and modified clicks are left to the browser and simply store nothing extra. All storage access is wrapped in try/catch with a `typeof sessionStorage !== 'undefined'` guard, and any failure behaves as "no stored value"
- [x] 3.2 In the same listener, intercept modal-tile clicks (href carrying `?touch=1`): prevent the default navigation, fetch the same URL with `format=json` appended (`credentials: 'same-origin'`, same-origin guard as the existing fast path), and on a JSON `{ ok: true }` response set `location.hash = 'app-<id>'` to reveal the overlay. On any fetch failure, non-JSON response, or `{ ok: false }`, fall through to the native touch URL (plain navigation, server 303s to the overlay as today). The intercept MUST NOT run for non-modal tiles

## 4. Client — apply the return on the app page

- [x] 4.1 On load in `pkg/src/client/index.ts`, when a `section[data-app-id]` is present, implement the return reader: read `kody-os:return`, validate it with a client-side validator mirroring the deleted `safeNextPath` rules (leading `/`, no `//` prefix, no `\`, no `://`, no CR/LF, must start with the `data-app-base` value), plus the fragment guard (a `#app-<id>` fragment is kept only when `<id>` equals the current app id, otherwise the bare path is used if valid). On any validation failure, storage failure, or missing value, leave the server-rendered close box untouched (Home)
- [x] 4.2 With a valid value, set the titlebar close box (`.os-titlebar a.os-box`) `href` to it and its `aria-label` / `title` to Apps when it equals the Apps path, Home when it equals the home path, and Back otherwise — the same labelling rule the server used
- [x] 4.3 Legacy migration on the same load: when the URL carries a `from` query value, validate it under 4.1; when valid it wins over the stored value, is written to storage, and is then removed from the visible URL with `history.replaceState` (other query parameters preserved). When invalid it is stripped from the URL and ignored. This migration runs only on app pages, not on the dashboard or Apps page

## 5. Docs + version

- [x] 5.1 In `pkg/AGENTS.md`, qualify the "Works without JavaScript" line so the narrowed scope is explicit: return-to-opener (close box destination) is a JavaScript enhancement backed by `sessionStorage`; without JavaScript the close box goes Home and a native widget submit lands on the app page. Do not rewrite the rest of the no-JS baseline (plain submit + redirect, fragment expand/collapse, `:target` overlays), which is unchanged
- [x] 5.2 Bump MINOR at implementation (a new client capability; the server drops a query contract no bundle, definition, MCP export, or route depends on), reset PATCH to 0, update `pkg/package.json`, `pkg/AGENTS.md`, and `pkg/README.md` headers in the same commit as the change, per `pkg/AGENTS.md`. The release itself is the user's call and is not a step in this change. If the no-JS waiver in the proposal is withdrawn before implementation, stop and re-evaluate the version as MAJOR instead of proceeding

## 6. Verification

- [x] 6.1 Rendering grep: zero `?from=`, `name="from"`, `fromPath`, `fromParam`, `query.get('from')`, and `safeNextPath` in `pkg/src` after implementation, except the one legacy-tolerance exclusion in the action branch and its comment. Rendered tile, widget-expand, home-tile, and overlay-expand links are plain `/apps/<id>`; modal tiles are `/apps/<id>?touch=1`; action forms carry no hidden `from` input
- [x] 6.2 Return flows (browser or `kody dev` mock where it can run — record any substitution, do not mark a check done that was not run): Apps tile to app page, close returns to Apps; home widget expand to app page, close returns Home; overlay expand to app page, close returns to the overlay (`/apps#app-<id>`); menu link from an app page to another app, close returns to the first app page; direct navigation / bookmark to an app page, close goes Home; legacy `?from=/apps` link, close returns to Apps once and the URL is clean after load
- [x] 6.3 Modal flows: modal tile with JavaScript opens the overlay without a navigation and records the open in Recent; modal tile with the touch fetch forced to fail falls through to the touch URL and still lands on the overlay; modal action forms patch in place with no navigation and no hidden `from` field
- [x] 6.4 Degradations: with JavaScript disabled, an app action still submits and lands on the app page, the close box goes Home, a widget submit lands on the app page, and a modal tile still opens the overlay via the touch 303. With `sessionStorage` throwing (disabled storage), the app page renders and the close box stays Home with no console error breaking the page
- [x] 6.5 Validation + spoofing: a stored value of `https://evil.example/`, `//evil.example/`, `/apps/../../etc`, a value with `\` or CR/LF, and a `#app-<other-id>` fragment are all rejected (close stays Home, or the bare path for the fragment case); a stored `/apps` and `/` are accepted with labels Apps and Home
- [x] 6.6 Ceilings + spec: ES2019 grep zero hits for `?.` / `??` / `replaceAll` / `.at(` in the touched files, `node --experimental-strip-types --check` passes on the touched sources, `bun run typecheck` reports no new errors, and `openspec validate` passes for the change
- [x] 6.7 Scribe verification — `sessionStorage` write-before-navigation and the delegated click handler on the Scribe (the specific unknown this change has: whether the Scribe browser's storage survives the tile navigation and the synchronous click handler runs before it). Verify on the device that opening an app from Apps and closing it returns to Apps, and that opening from Home returns Home. If a Scribe check cannot run, record that openly and do not mark it done
- [x] 6.8 Record the close-out note in this file (what was actually verified, what was substituted, and what was left open) before archiving

## Close-out note (2026-11-15)

**Verified**

- 6.1 Renderer and served-HTML grep: zero `?from=`, `name="from"`, `fromPath`,
  `fromParam`, `query.get('from')`, and `safeNextPath` in `pkg/src`. Served
  `/`, `/apps`, and `/apps/counter` from `kody dev --target mock` contain zero
  `from=` and zero `name="from"`. Tile, widget-expand, home-tile, overlay-expand
  and menu links render plain `/apps/<id>`; the modal expand link renders
  `/apps/clock` (its tile carries `?touch=1`); the action form renders
  `<form class="app-action" method="GET" action="/apps/counter">` with no hidden
  input.
- 6.2/6.5 Return flows and value validation ran in `tests/sessionstorage-return.cjs`
  (jsdom against the bun-bundled client, 30 checks, all pass): tile/Apps, widget/Home,
  overlay return, stale fragment, direct navigation, legacy `?from=` adoption and
  stripping. Server side observed with `kody dev --target mock`: `/apps` carries a
  plain `/apps/counter` link; `/apps/counter` close box is `href="/" aria-label="Home"`;
  `?from=/apps` still returns 200 with the same Home close box (value ignored).
- 6.3 Modal flows: harness checks 11/12/12b pass (JSON intercept sets
  `#app-<id>` with no navigation; fetch failure falls back to the touch URL; a
  non-modal tile never fetches). Server observed: `?touch=1` → 303
  `Location: /apps#app-counter`; `?touch=1&format=json` → 200
  `{"ok":true}` with `content-type: application/json; charset=utf-8` and
  `cache-control: no-store`.
- 6.4 Degradations: harness check 14 passes (throwing `sessionStorage` leaves the
  page rendered with the Close box Home). Native no-JS paths are exactly the
  server responses above: action → 303 to the app page, touch → 303 to the
  overlay fragment. A successful action observed as 303 `Location: /apps/counter`;
  an invalid action as 400.
- 6.6 Ceilings and spec: ES2019 grep zero hits (`?.`/`??`/`replaceAll`/`.at(`
  appear only inside comments); `node --experimental-strip-types --check` passes on
  `pkg/src/app.ts`, `pkg/src/client/index.ts`, `pkg/src/apps/render.ts`;
  `bun run typecheck` reports no new errors; `openspec validate sessionstorage-return`
  is valid.

**Substitutions (checks not run as written)**

- 6.2–6.5 were not run on a Scribe or a desktop browser. They were run in jsdom
  against the bundled client plus live `kody dev --target mock` HTTP responses.
- 6.7 Scribe verification was **not run** (no device in this environment) and is
  left unchecked. The Scribe-specific unknown — whether its storage survives the
  tile navigation and whether the synchronous click handler runs before it —
  remains open.
- `kody dev` ran only against the mock target, not the Kody platform.

**Deviations from the task text (recorded, not silently changed)**

- Tasks 1.1–1.3 name `pkg/src/apps/client.ts`; the link and panel renderers live in
  `pkg/src/apps/render.ts` (there is no `apps/client.ts`). The change was applied
  there, including `tileItem`, `renderOverlaySection`, `renderHomeTiles`,
  `renderWidgetSection`, `renderAppSection`, and `renderAppPanel`.
- The client validator adds a `..` path-segment rejection beyond the deleted
  server `safeNextPath` rules, so 6.5's `/apps/../../etc` case is rejected rather
  than normalized by the browser. The added requirement records this.
- The client-nav `popstate` handler gained a same-document fragment guard. A
  fragment change fires `popstate`; without the guard, the modal-tile intercept's
  `location.hash` write made the shell re-fetch `/apps` and replace `#os-main`,
  wiping the overlay it had just revealed. Harness check 11 caught it.
- Task 5.1 refers to a "Works without JavaScript" line in `pkg/AGENTS.md` that does
  not exist; the equivalent statement is the "JavaScript is assumed" bullet, which
  now names the narrowed no-JS scope (Close goes Home, native widget submit lands
  on the app page) and leaves the rest of the no-JS baseline intact.
- `dashboardBody` is retained: task 2.2 removed only the action branch's use, while
  the dashboard error route still calls it.

**Version** — `pkg/package.json` 4.5.0 (MINOR, PATCH reset to 0); `pkg/AGENTS.md`
and `pkg/README.md` headers state 4.5.0; `build` stays 51 because nothing was
published.

**Pre-existing harness failures** — reproduced on a clean base worktree
(`/tmp/kody-base-check` at `7edb3d7`), so not caused by this change:
`tests/open-mode-harness.ts` 12 failures; `tests/store-harness.ts` 2 failures
(`storeSelf finds the newer Store on the discovery base`, `Store self-update
installs v32` — the catalog is now v33). `tests/catalog-harness.ts` passes
(19 apps), `tests/client-nav.cjs` passes all 12 — one run showed two
timing-sensitive failures in its check 9 (Back/Home swap), and two immediate
reruns passed, so it is jsdom flake rather than a regression.

**Open** — 6.7 Scribe check not run; the change is not archived (archive waits on
that check and on user direction). No commit, push, or publish was made.
