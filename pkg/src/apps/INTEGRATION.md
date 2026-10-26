# App-layer integration notes

The app layer in `src/apps/` is wired into `src/app.ts` and verified live
(`GET /` tiles, `GET /apps/:id`, GET action submit, same `act()` as MCP).

## What exists

- `src/apps/types.ts` — the contract: `AppDefinition`, state schema, action/effect schema.
- `src/apps/storage.ts` — `packageStorage()` with shared in-memory fallback; `createMemoryStore()` for isolated/fresh stores.
- `src/apps/registry.ts` — `list_apps`, `get_app`, `get_app_state`, `act`, `add_app`, `remove_app`, `export_app`, `import_app`, `validateDefinition`.
- `src/apps/forms.ts` — `actFromForm(id, entries)` — the UI path; funnels into the same `act()` MCP uses.
- `src/apps/client.ts` — browser-safe (zero runtime imports) HTML builders: `renderHomeTiles`, `renderAppSection(def, state, appBasePath, code?)`.
- `src/apps/test-app.ts` — `helloCounterDefinition()` test harness (NOT a product feature; do not ship it as one).

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
   rows carry `data-field` hooks with a `data-value` value node, and the app
   panel `section.app` carries `data-app-id` — styling unchanged, hooks only
   for the guarded in-place refresh.
2. On the `?k=` path, also render a hidden `k` field carrying the code. A GET
   form **discards the action's query string**, so the code must travel as form
   data, not only in the action.
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
5. The locked-page unlock form follows the same rule: it is a GET form that
   navigates to the safe `next` path with `?k=<code>`.
6. Keep the code out of storage and logs. `renderAppSection` receives the
   normalized code only for the hidden field; never write it to
   `packageStorage()`.

The browser client (`src/client/index.ts`) adds a guarded same-origin GET
fast path: it intercepts only `form.app-action`, and only when `fetch`,
`document.querySelector`, and JSON parsing all exist. It replays the same GET
URL plus `format=json` with `Accept: application/json`; on `{ ok:true }` it
updates the matching `[data-app-id] [data-field] [data-value]` nodes and
clears the `role="alert"` error in place, on `{ ok:false }` it shows that
error in place, and on any failure it falls back to a native `form.submit()`.
Plain GET navigation stays the resilient fallback; do not add a
JS-only POST path, a timer/polling loop, or client routing.

## How the shell wires it up

1. **Home/launcher:** `GET /` → `list_apps()` → themed tile grid. Empty
   registry renders the honest "no apps yet" state.
2. **App page:** `GET /apps/:id` → `get_app(id)` →
   `renderAppSection(def, state, appBasePath, code)`. Unknown id → 404 page in
   shell chrome.
3. **Actions:** `GET /apps/:id?action=...` → `actFromForm(id, entries)` → 303
   redirect on ok; 400 with the inline error on `{ ok:false }`. With
   `?format=json` the same path returns `ActResult` JSON (no redirect, no
   HTML) for the guarded client fast path.
   `POST /apps/:id` remains for API clients that send a same-origin origin.
4. **MCP tools** (same functions, same state): `list_apps`, `get_app_state`,
   `act`, `add_app`, `remove_app`, `export_app` map 1:1 to the registry exports.
5. **Removal is MCP-only:** `remove_app` is not wired to any route or form.
   Edit mode exposes pin and hide only; deleting an app requires an agent call.
6. **Do NOT:** touch `public/styles.css` without regenerating
   `src/shell-css.ts`, change `package.json` kody id/visibility, or ship the
   hardcoded counter in `src/app.ts` as a product feature.

## Storage keys (all under packageStorage(), 16 MiB budget — keep definitions small)

- `kody-os.auth.code_hash` — hex SHA-256 of the device access code (never the raw code)
- `kody-os.apps.registry` — `string[]` of installed app ids
- `kody-os.apps.def.<id>` — the `AppDefinition` JSON
- `kody-os.apps.state.<id>` — the live `AppState` JSON
