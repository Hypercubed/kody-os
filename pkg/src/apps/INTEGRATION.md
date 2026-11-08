# App-layer integration notes

The app layer in `src/apps/` is wired into `src/app.ts` and verified live
(`GET /` tiles, `GET /apps/:id`, GET action submit, same `act()` as MCP).

## What exists

- `src/apps/types.ts` — the contract: `AppDefinition`, state schema, action/effect schema.
- `src/apps/storage.ts` — `packageStorage()` with shared in-memory fallback; `createMemoryStore()` for isolated/fresh stores.
- `src/apps/registry.ts` — `list_apps`, `get_app`, `get_app_state`, `act`, `add_app`, `remove_app`, `export_app`, `import_app`, `validateDefinition`.
- `src/apps/forms.ts` — `actFromForm(id, entries)` — the UI path; funnels into the same `act()` MCP uses.
- `src/apps/client.ts` — browser-safe (zero runtime imports) HTML builders: `renderHomeTiles`, `renderAppSection(def, state, appBasePath, fromPath?)`. Counter comes from `catalog/counter/definition.json` via `add_app` (no in-code harness).

## Edge rule: app actions are GET, never POST

Kody's edge rejects a mutating request to a `*.kody.run` package-app subdomain
when the browser reports a foreign or `null` `Origin`:

> Cross-origin mutating requests to a package-app subdomain are not allowed.

A plain same-origin POST works from some browsers, but embedded views,
sandboxed iframes, and some older browsers report `Origin: null`. The Scribe
must not depend on that. The edge does not block GET.

Rules for every current and future app:

1. Render UI actions as `<form class="app-action" method="GET"
   action="{appBasePath}/apps/{id}">` with a hidden `action` field. State
   rows carry `data-field` hooks with a plain `<span>` value node, and the app
   panel `section.app` carries `data-app-id` — styling unchanged, hooks only
   for the guarded in-place refresh.
2. No form carries a credential: requests are authenticated by the
   platform-verified Kody visitor (or served login-free on the mock
   target), so action forms carry only `action` (and `from` where
   present). No `?k=`, no hidden credential field, ever.
3. Handle `GET /apps/:id?action=<name>` by removing `k`, `from`, and
   `format` from the query entries and passing the rest to
   `actFromForm(id, entries)`. Without `format=json`: on success, 303 back to
   the app page (or the safe `from` path); on failure, re-render the page
   with the inline error (400). With `?format=json`: return the `ActResult`
   JSON (`{ ok:true, state }` with 200, or `{ ok:false, error }` with 400)
   with `Content-Type: application/json` and `Cache-Control: no-store`
   instead of any redirect or HTML.
4. Do not add a mutating `<form method="POST">` or a `fetch(..., { method:
   'POST' })` to the app UI. POST is only for programmatic clients that can
   send a same-origin `Origin`; the server route remains for them.
5. There is no shell denial page: unknown routes return an honest 404
   in the full chrome with plain "Not found." text and no home link
   in the body. A request the platform does not admit never reaches
   shell code, so the shell renders no denial of its own. Signing in
   happens in Kody itself, never in the shell.
6. Keep credentials out of rendered output, storage, and logs. No
   renderer receives a credential; there are no auth registries at all
   (Kody login is verified per request), only app data (see Storage
   keys below).

The browser client (`src/client/index.ts`) adds a guarded same-origin GET
fast path: it intercepts only `form.app-action`, and only when `fetch`,
`document.querySelector`, and JSON parsing all exist. It replays the same GET
URL plus `format=json` with `Accept: application/json`; on `{ ok:true }` it
updates the matching `[data-app-id] [data-field] span` nodes and
clears the `role="alert"` error in place, on `{ ok:false }` it shows that
error in place, and on any failure it falls back to a native `form.submit()`.
Plain GET navigation stays the resilient fallback; do not add a
JS-only POST path, a timer/polling loop, or client routing.

## How the shell wires it up

1. **Home/launcher:** `GET /` → `list_apps()` → themed tile grid. Empty
   registry renders the honest "no apps yet" state.
2. **App page:** `GET /apps/:id` → `get_app(id)` →
   `renderAppSection(def, state, appBasePath)`. Unknown id → 404 page in
   shell chrome.
3. **Actions:** `GET /apps/:id?action=...` → `actFromForm(id, entries)` → 303
   redirect on ok; 400 with the inline error on `{ ok:false }`. With
   `?format=json` the same path returns `ActResult` JSON (no redirect, no
   HTML) for the guarded client fast path.
   `POST /apps/:id` remains for API clients that send a same-origin origin.
4. **MCP tools** (same functions, same state): `list_apps`, `get_app_state`,
   `act`, `add_app`, `remove_app`, `export_app` map 1:1 to the registry exports.
   Catalog tools (`list_catalog`, `get_catalog_definition`,
   `install_from_catalog`, `update_from_catalog`) and pin tools
   (`get_pinned`, `set_pin`, `set_pinned`) are exported from the package
   entry the same way: an agent tool is a function exported from
   `pkg/src/index.ts`. `install_from_catalog` is idempotent and never
   wipes state; `update_from_catalog` refuses uninstalled ids and
   refuses to install new ones. Home-screen tools (`get_homepage`,
   `set_home`, `set_homepage`, `move_home`) and hide tools
   (`get_hidden`, `set_hide`, `set_hidden`) follow the same pattern:
   anything the browser shell lets the user do to pins, home, or
   hidden flags, an agent can do too. Deliberately NOT exported:
   the recency tools (`get_recent`, `record_use`, `clear_recent`) —
   recency is shell-derived history, not user-managed state, so it
   stays internal even though the shell has a clear-recents control.
5. **Removal is MCP-only:** `remove_app` is not wired to any route or form.
   Edit mode exposes pin and hide only; deleting an app requires an agent call.
6. **Do NOT:** touch `public/styles.css` without regenerating
   `src/shell-css.ts`, change `package.json` kody id/visibility, or ship the
   hardcoded counter in `src/app.ts` as a product feature.

## Storage keys (all under packageStorage(), 16 MiB budget — keep definitions small)

- `kody-os.apps.registry` — `string[]` of installed app ids
- `kody-os.apps.def.<id>` — the `AppDefinition` JSON
- `kody-os.apps.state.<id>` — the live `AppState` JSON
