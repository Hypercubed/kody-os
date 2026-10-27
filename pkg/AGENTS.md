# @hypercubed/kody-os

## Imports

```ts
import main, { add_app, act, list_apps, get_app_state, export_app, remove_app } from 'kody:@hypercubed/kody-os'
```

## Device access gate

The browser shell is locked by one-time codes; only `src/app.ts` fetch
requests are gated, MCP exports are not. The owner mints a 4-digit OTP over
MCP (`mint_otp`, single use, 10-minute TTL); typing it into the unlock form
burns it and mints a session (random token, SHA-256 hash in
`packageStorage()`, 30-day expiry, HttpOnly cookie named
`<cookiePrefix>kody_os_auth` so the edge forwards it). Anonymous visitors
can't read the Kody secret, so the secret-derived code is fallback-only,
never the live device path.

```ts
import { get_access_status, mint_otp } from 'kody:@hypercubed/kody-os'

await get_access_status() // { configured: true } once the secret is bound
const otp = await mint_otp() // { ok: true, code: '4821' } — single use, 10 min
```

- There is no MCP or in-app set path: the owner creates and rotates the code
  only in the Kody UI (creation form `https://kody.codes/@<org>/-/credentials/new?kind=secret&name=access-key`).
  Overwriting the secret value rotates the code at once: every bookmark and
  cookie stops working. Steps: [Device key](docs/device-key.md).
- The secret value never appears in code, storage, logs, or chat; the handler
  recomputes the code per request. `packageStorage()` holds no auth secrets on
  the derived path (the pre-secret `kody-os.auth.code_hash` is fallback-only).
- Browser paths: the 4-digit OTP is typed into the unlock form, whose inline script rewrites the submit to the path form `/unlock/<code>` (Kody's edge drops query strings, so `?k=` never arrives); success burns the OTP, sets the session cookie, and 303-redirects to a clean URL. A wrong or expired code re-renders the locked page with an inline error; too many failures in 10 minutes yields a lockout notice instead. Logout (device sessions only, in the menu) revokes the server-side session and clears the cookie.
- Unauthenticated or invalid requests get the same 404 page; with no secret bound and no stored hash, anonymous requests are denied and only Kody-logged-in visitors are served (login-only mode, no `internet_visible` needed).

## App actions and the package-app edge

Kody's edge rejects a mutating request to a `*.kody.run` package-app subdomain
when the browser reports a foreign or `null` `Origin`:

> Cross-origin mutating requests to a package-app subdomain are not allowed.

Never render a mutating `<form method="POST">` or a UI `fetch(..., { method: 'POST' })`.
UI actions must be GET forms: `GET /apps/:id?action=<name>`, with a hidden `k`
field only when the current session is query-authenticated (a GET form discards
the action's query string, so legacy query sessions keep the code as form data;
cookie sessions render clean forms). The `POST /apps/:id` route stays for API
clients that send a same-origin origin. The unlock form is a plain GET whose
inline script rewrites the submit to `/unlock/<code>`; without JavaScript the
plain GET still submits (works wherever the platform preserves the query
string). Full checklist: `src/apps/INTEGRATION.md`.

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
//   exports: [{ shell }, { list_apps }, { get_app_state }, { act }, { add_app }, { remove_app }, { export_app }],
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
- The page works without JavaScript through plain form submission and PRG; the browser client only enhances GET `form.app-action` with `?format=json` in-place patching (Scribe-safe: guarded, falls back to native submit).
- Kindle ceiling is ES2019: no `?.` or `??` in pkg/src (Chromium 75 crashes), no flexbox gap (grid gap OK), system fonts only, no emojis, 3rem (48px) minimum tap targets.
- Styles are inlined (`src/shell-css.ts` generated from `public/styles.css`) — Scribe loads no external stylesheets. Regen after any theme edit.
