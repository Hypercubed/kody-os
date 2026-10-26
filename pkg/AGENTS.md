# @hypercubed/kody-os

## Imports

```ts
import main, { add_app, act, list_apps, get_app_state, export_app, remove_app } from 'kody:@hypercubed/kody-os'
```

## Device access gate

The browser shell is locked by a device access code.
Only `src/app.ts` fetch requests are gated; MCP exports are not.

```ts
import { set_access_code, get_access_status } from 'kody:@hypercubed/kody-os'

await get_access_status() // { configured: false } on a fresh install
const res = await set_access_code() // { ok:true, code:'abcde-fghjk-…' } — the only copy
// rotate later: await set_access_code() again; old bookmarks and cookies stop working
```

- The store keeps only a SHA-256 hash under `kody-os.auth.code_hash`; the raw code is never stored or logged.
- Browser paths: `?k=<code>` bookmark (Scribe-safe; the shell keeps the code on every link and form action) or the plain unlock form, which navigates to `?k=<code>` and sets the same one-year HttpOnly cookie.
- Unauthenticated or invalid requests get the same 404 page; an unconfigured install authorizes nobody.
- Omit the argument to generate a 25-character code; a supplied code must be at least 16 characters.
- Fresh install: `POST /__access-code` (optional form field `code`) mints the first code once and shows it; the route refuses forever after a code exists, so it cannot rotate or reset the lock.

## App actions and the package-app edge

Kody's edge rejects a mutating request to a `*.kody.run` package-app subdomain
when the browser reports a foreign or `null` `Origin`:

> Cross-origin mutating requests to a package-app subdomain are not allowed.

Never render a mutating `<form method="POST">` or a UI `fetch(..., { method: 'POST' })`.
UI actions must be GET forms: `GET /apps/:id?action=<name>`, with a hidden `k`
field on the `?k=` path (a GET form discards the action's query string, so the
code must be form data). The `POST /apps/:id` route stays for API clients that
send a same-origin origin. The unlock form is also GET and navigates to the safe
`next` path with `?k=<code>`. Full checklist: `src/apps/INTEGRATION.md`.

## Adding an app

An app is a registry write, not a package change: no commit and no republish. The browser UI has no add control; agents call `add_app` (or an `execute` wrapper) and the app appears on the Apps page. It is not on the home dashboard until added via Apps → Edit → **Add to home**.

The full guide covers the definition contract, hosted vs local preview, verification, homepage placement, export, and MCP-only removal: [Adding an app](docs/adding-an-app.md). Binding Scribe constraints live at [Scribe limitations](docs/scribe-limitations.md).

## Smoke tests

Call the root export from `execute` after publish:

```ts
import main from 'kody:@hypercubed/kody-os'

const info = await main()
// => {
//   package: '@hypercubed/kody-os',
//   exports: [{ shell }, { list_apps }, { get_app_state }, { act }, { add_app }, { remove_app }, { export_app }, { set_access_code }],
//   note: 'Phase 2 app layer — data-driven apps via packageStorage.'
// }
```

Check `info.package` is `@hypercubed/kody-os` and `info.note` identifies the Phase 2 app layer.

Phase 2 gates (all pass locally against an isolated store):

```ts
import { add_app, act, list_apps, get_app_state, export_app, import_app, remove_app, helloCounterDefinition } from 'kody:@hypercubed/kody-os'

await add_app(helloCounterDefinition()) // { ok:true, id:'hello-counter' } — no republish
await list_apps() // exactly 1 entry
await act('hello-counter', 'increment') // { ok:true, state:{ count:1, ... } }
await get_app_state('hello-counter') // same state the UI route renders
const exp = await export_app('hello-counter') // format 'kody-os-app/2'
// fresh store: await import_app(exp) round-trips definition + state
await act('hello-counter', 'add', { by: 9999 }) // { ok:false } — state unchanged
await remove_app('hello-counter') // { ok:true, id } — definition, state, and all reference lists gone
```

## Edge cases

- No root-export side effects: no jobs, file writes, or installs.
- Shell is data-driven: GET / lists the registry, GET /apps/:id renders definition + state. UI actions submit a plain GET form (`?action=...`, plus hidden `k` on the bookmark path) and funnel into the same `act()` MCP uses (303 on ok, 400 with inline error on bad action). POST /apps/:id remains for API clients.
- Export v1 payloads (`kody-os-app/1`, name-keyed) import with id derived from name; v2 is id-keyed.
- `remove_app` is the only destructive registry call: it validates the id is installed first, then deletes the definition + state and scrubs the registry, pinned, hidden, and recent lists. Unknown ids return `{ ok:false }` and write nothing. It is MCP-only: the browser UI exposes hide, never remove.
- Missing runtime context falls back to shared in-memory storage starting empty with an honest "no apps yet" tile.
- The page works without JavaScript through plain form submission and PRG; the browser client only enhances POST forms in place (currently none — app actions and the unlock form are GET).
- Kindle ceiling is ES2019: no `?.` or `??` in pkg/src (Chromium 75 crashes), no flexbox gap (grid gap OK), system fonts only, no emojis, 3rem (48px) minimum tap targets.
- Styles are inlined (`src/shell-css.ts` generated from `public/styles.css`) — Scribe loads no external stylesheets. Regen after any theme edit.
