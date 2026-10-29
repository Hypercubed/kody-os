# @hypercubed/kody-os

v0.1.5. Browser shell + data-driven apps in `packageStorage()`. Humans use forms; agents use MCP exports; both funnel into one `act()`.

## Imports

```ts
import main, { add_app, act, list_apps, get_app_state, export_app, import_app, remove_app } from 'kody:@hypercubed/kody-os'
import { get_access_status, mint_otp } from 'kody:@hypercubed/kody-os'

await get_access_status() // { configured: true } once the secret is bound
const otp = await mint_otp() // { ok: true, code: '4821' } — single use, 10 min
```

## Device access gate

Only `src/app.ts` fetch requests are gated; MCP exports are not. The owner mints a 4-digit OTP over MCP; typing it into the unlock form burns it and mints a session (random token, SHA-256 hash in `packageStorage()`, 30-day expiry, HttpOnly cookie named `<cookiePrefix>kody_os_auth` so the edge forwards it). Anonymous visitors can't read the Kody secret, so the secret-derived code is fallback-only.

- No MCP or in-app set path: create/rotate the code only in the Kody UI. Overwriting the secret rotates everything at once. Steps: [Device key](docs/device-key.md).
- The secret value never appears in code, storage, logs, or chat; the handler recomputes per request.
- Unlock form submits to path form `/unlock/<code>` (the edge drops query strings, so `?k=` never arrives); success sets the session cookie and 303-redirects to a clean URL. Wrong/expired codes re-render locked with an inline error; 10+ failures in 10 minutes locks out with a notice. Logout is device-sessions only.
- Unauthenticated requests get the same honest 404. With no secret bound, only Kody-logged-in visitors are served (login-only mode).
- Response headers on every HTML/JSON page: `no-store`, `no-referrer`, `nosniff`, `frame-ancestors 'none'`.

## App actions and the package-app edge

Kody's edge rejects mutating requests to a `*.kody.run` package-app subdomain when the browser reports a foreign or `null` `Origin`. Never render `<form method="POST">` or `fetch(..., { method: 'POST' })`. UI actions are GET forms (`GET /apps/:id?action=<name>`, hidden `k` field only on query-authenticated sessions); `POST /apps/:id` stays for API clients. Bundle scripts resolve action URLs against the shell-stamped `data-action-base="/apps/<id>"` container with `credentials: 'same-origin'`. Checklist: `src/apps/INTEGRATION.md`.

## Adding an app

Registry write, not a package change: no commit, no republish. No add control in the UI; agents call `add_app`. Not on home until pinned via Apps → Edit → **Add to home**. Full contract: [Adding an app](docs/adding-an-app.md). Scribe constraints: [Scribe limitations](docs/scribe-limitations.md).

- Definition: meta + bundle (`entry: index.html`, relative `.html`/`.js`/`.css` only, 256 KiB cap) + `stateSchema` + `actions` (`set`/`append`; `increment`/`toggle`/`reset` are deprecated sugar). `ui.template` is frozen (`hello|generic|clock`): required by the validator, ignored by the renderer — never branch on it.
- `ui.hideState: true` hides the server-rendered state readout (stays in the DOM for bundle scripts to read initial state). Use when the bundle already displays state.
- `capabilities.feeds`: up to 8 `{ name, url, ttlSeconds?, maxBytes? }` — HTTPS only, served via `GET /feed/:app/:name` with storage caching. Data-only declarations; the route takes the feed name, never a URL.
- Bundle scripts run same-origin with full session authority: installing an app = trusting its code. Review third-party bundles before `import_app`.

## Smoke tests

```ts
import main from 'kody:@hypercubed/kody-os'
const info = await main()
// => { package, exports: [...], note: 'Phase 2 app layer — data-driven apps via packageStorage.' }

import { add_app, act, list_apps, get_app_state, export_app, import_app, remove_app, counterDefinition } from 'kody:@hypercubed/kody-os'
await add_app(counterDefinition()) // { ok:true, id:'counter' } — no republish
await list_apps() // exactly 1 entry
await act('counter', 'increment') // { ok:true, state:{ count:1, ... } }
await get_app_state('counter') // same state the UI route renders
const exp = await export_app('counter') // format 'kody-os-app/2'
await act('counter', 'add', { by: 9999 }) // { ok:false } — state unchanged
await remove_app('counter') // definition, state, and all reference lists gone
```

`remove_app` is MCP-only (the UI exposes hide, never remove) and validates the id first; unknown ids return `{ ok:false }` and write nothing. Export v1 payloads import with id derived from name; v2 is id-keyed.

## Edge cases

- No root-export side effects: no jobs, file writes, or installs.
- Missing runtime context falls back to shared in-memory storage, starting empty with an honest "no apps yet" tile.
- Works without JavaScript (form submit + PRG); the client only enhances `form.app-action` with `?format=json` in-place patching (guarded, falls back to native submit).
- ES2019 ceiling in `pkg/src`: no `?.`/`??` (Chromium 75 crashes), no flexbox gap (grid gap OK), system fonts only, zero emojis, 48px minimum tap targets.
- Styles inlined (`src/shell-css.ts` generated from `public/styles.css`) — no external stylesheets. Regen after any theme edit.
