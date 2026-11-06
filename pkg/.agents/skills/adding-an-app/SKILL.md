---
name: adding-an-app
description: Add a custom app to a kody-os install — definition contract, bundle contract, state schema, set/append actions, and the pre-add_app checklist. Use when the user wants to add, author, validate, install, update, export, or remove an app, asks how app definitions, bundles, or actions work, or asks about the bundle/shell interaction contract, and when an app's display goes stale after a shell action.
---

# Adding an app

An app is a JSON definition in `packageStorage()`. Adding one is a registry write: no source change, no commit, no publish, no republish. The same definition works in the hosted OS and the local preview; the two stores are separate, so add it to each target you use.

The browser shell has no add control. Agents add with the package's MCP `add_app` (or an `execute` wrapper). The shell can hide, pin, and add an app to the homepage; deletion is MCP-only (`remove_app`).

Before writing a bundle that displays state, read the [Bundle/shell interaction contract](#bundleshell-interaction-contract) below and run the [pre-`add_app` authoring checklist](#pre-add_app-authoring-checklist). A bundle that only follows the definition contract above will render, but its display can go stale the first time a shell action form fires; the contract is what keeps bundle display and shell state in sync.

## Definition contract

| Field | Required | Value |
| --- | --- | --- |
| `id` | yes | Slug matching `^[a-z0-9][a-z0-9-]{0,63}$`. Routes and storage keys use it. |
| `name` | yes | Non-empty display name. |
| `label` | no | Tile label. Defaults to `name`. |
| `icon` | no | Plain-text glyph or short mark (never an emoji), OR a sanitized inline SVG starting with `<svg`. See [Tile icons](#tile-icons). |
| `category` | no | Metadata string. The current shell lists all apps together. |
| `description` | no | Help text shown on the app page. |
| `ui.title` | no | App page and overlay title. Defaults to `name`. |
| `ui.openAs` | no | `"page"` or `"modal"`. Defaults to `"page"`. This is only the default for how the Apps-page tile opens the app — `modal` opens the inline overlay, `page` opens the full app page. It is a default, not a restriction: every app is allowed in every context, direct navigation to `/apps/<id>` always renders the full page, and home widget presence is governed by the homepage list, not by this field. |
| `ui.placements` | deprecated | Old allowlist (`page`, `modal`, `widget`). Still accepted, but it gates nothing: when a definition carries `placements` but no `openAs`, the shell derives `openAs` from it — `["modal"]` without `"page"` derives `"modal"`, any other value derives `"page"` — and when both fields are present, `openAs` wins. Stored and exported definitions carry `openAs` and no `placements`; re-export once to migrate an old definition. |
| `ui.actions` | no | Array of `{ action, label }`. Each `action` must exist in `actions`. Buttons are no-argument GET forms. |
| `ui.menuBar` | no | Boolean. When `true`, the app also appears in the top menu bar while installed (after Apps, alphabetically by label, linking to `/apps/<id>`). Author-controlled, not a user toggle: there is no menu on/off control, and uninstalling the app removes its link automatically. Hidden apps are excluded from the menu. Defaults to `false`. |
| `stateSchema.type` | yes | `"object"`. |
| `stateSchema.initial` | yes | Initial values. Every key must be declared in `fields`. |
| `stateSchema.fields` | yes | Map of field name to `{ type, min?, max?, maxLength?, items?, maxItems? }`; `type` is `integer`, `string`, `boolean`, `array`, or `object` (schemaVersion 5). `min`/`max` apply to integers; `maxLength` to strings; `items` (`integer`/`string`/`boolean`/`object`) and `maxItems` to arrays. |
| `bundle` | yes | `{ entry: "index.html", files: { path: content } }`. Every app ships its own UI files; see the bundle contract below. |
| `actions` | yes | `{ [name]: { description?, args?, effects } }`. |
| `actions.*.effects` | yes | Non-empty array of `set` / `append` effects (see below), applied in order. `increment`, `toggle`, and `reset` are deprecated sugar kept only until migration retires them; do not use them in new apps. |
| `actions.*.args` | no | `{ [name]: { type, required?, default?, min?, max?, maxLength? } }`. Values are coerced from form strings. |
| `capabilities.feeds` | no | Array of `{ name, url, ttlSeconds?, maxBytes? }` (at most 8). Declares allowlisted upstream feeds the app may read through `GET /feed/<app>/<name>` — HTTPS only, served same-origin with storage caching. Never put a URL from user input here; the route takes only the declared feed name. |
| `capabilities.proxy` | no | Array of `{ name, url, ttlSeconds?, maxBytes? }` (at most 8), same limits as feeds. Declares allowlisted generic upstreams the app may read through `GET /proxy/<app>/<name>` — HTTPS only, served same-origin with storage caching. The route takes only the declared proxy name. |
| `capabilities.manageApps` | no | Boolean. When `true`, the app may use the shell management API (`GET /manage/rows|install|update|restore`). Undeclared callers get a plain 404. Capabilities are installer disclosure plus this allowlist, not a sandbox: bundle scripts run same-origin with session authority, so declaring a capability does not stop a malicious bundle from calling a shell route directly. |
| `capabilities.theme` | no | `{ view: boolean, set: boolean }`. Declares shell theme access through `GET /theme/<app>`: `view` allows the read route, `set` allows set and reset. A definition with neither flag true is treated as not declaring theme. Undeclared callers get a plain 404. Capabilities are installer disclosure plus this allowlist, not a sandbox: bundle scripts run same-origin with session authority, so declaring a capability does not stop a malicious bundle from calling a shell route directly. |

Effects:

| `op` | Fields | Notes |
| --- | --- | --- |
| `set` | `field`, `value?`, `fromArg?` | `field` must be declared. Provide `value` or `fromArg` (an arg name). |
| `append` | `field`, `value?`, `fromArg?`, `cap?`, `maxEntryBytes?` | `field` must be a declared `array`. Appends one entry; oldest entries drop first past `cap` (default 500); string entries over `maxEntryBytes` (default 2048) are rejected. |

Definitions are JSON: no code, `eval`, or imports. The two effect operators are implemented once in the package registry; `add_app` validation rejects any other `op`. Agents compose apps from these fixed operators—they do not invent new operators per app. Each action carries a non-empty `effects[]` sequence applied in order. The package storage budget is 16 MiB.

### What `set` and `append` actually are

They are generic data-write operators, not a built-in counter app. `counter` is only a test harness that happens to use them. Any app may define its own actions with either of:

- `set`: write a fixed value—or a validated arg—to a declared field.
- `append`: append a fixed entry—or a validated arg—to a declared array field, with length and entry-byte caps.

Each app has isolated state at `kody-os.apps.state.<id>`. Every action coerces its args, applies the effect to a copy of state, re-validates the result against the schema, then writes with a single set. A bad action returns `{ ok: false, error }` and leaves stored state untouched. One app cannot touch another app’s state.

Stated plainly: there is no `random`/`shuffle` operator, and UI buttons carry no arguments. A true Magic 8-ball “shake” keeps its randomness in bundle JS and persists the outcome through a `set`/`append` action (see `catalog/eight-ball.bundle.json`); arg-taking actions are driven through MCP `act(id, action, args)` or bundle `fetch`. Do not invent new operators per app; they are only these two.

### Kindle Scribe browser: what agents may assume

Available:

- Plain server-rendered HTML, links, and GET forms.
- Inline CSS only; system fonts; high-contrast black-on-white.
- Server-side state in `packageStorage()`; no reliance on cookies or `localStorage`.
- Guarded vanilla-JS enhancement: if `fetch`/JSON parsing exist, the shell may replay the same GET action with `?format=json` and patch fields in place. If not, the same form still works through full navigation.

Not available to depend on:

- Client-side routing, or JS-required actions.
- Mutating POST forms or `fetch` POST in the UI; the Kody edge rejects cross-origin/null-origin POSTs to package-app subdomains.
- WebSockets, timers/polling, auto-refresh, background sync, animations/transitions.
- External stylesheets or external scripts.
- Cookies/`localStorage` as functional storage; treat them as absent.

The shell provides the bridge adapter, `window.KodyBridge` v1 (Phase 2 — see the bridge surface in the [Bundle/shell interaction contract](#bundleshell-interaction-contract)). The second-app gate is passed: Counter and xkcd are both ported to it, live on v0.3.0 build 12. Per-app framework vendoring is not the recommended path. JavaScript itself is assumed: the on-device probe in `scribe-limitations.md` proves Chromium 80 with working fetch, timers, events, DOM, and storage. The span-based state contract in this guide documents current shell behavior for existing bundles; new bundles use the JSON seed through the bridge, not span scraping.

ReKindle is existence proof that guarded vanilla JS can run in a Kindle browser. It is not proof of modern APIs, storage, sockets, or timers. So: enhance where present, never require.

### Access transport (device latch)

Unlock is a 4-digit one-time code, single use, valid 10 minutes (owner mints it over MCP with `mint_otp`). The unlock form's inline script rewrites the submit to the path form `/unlock/<code>` — Kody's edge drops query strings before the fetch handler runs, so `?k=` in the browser never arrives; the code lives in the path for one request and the success redirect lands on the clean app home. A correct code burns on first use and mints a session: a random token whose SHA-256 hash is stored (30-day expiry) and carried in a `kody_os_auth` HttpOnly cookie (prefixed with the platform's `cookiePrefix` so the edge forwards it). The unlock interstitial also writes the session token to `localStorage` under `kody_os_auth` as a carrier. After unlock, authentication rides the cookie alone: the client enhancement's `fetch` (`format=json`) fast path and bundle bridge actions send the cookie (`credentials: 'same-origin'`) and attach no credential to the URL, falling back to native submit on any failure. Without JavaScript the plain GET still submits (works wherever the platform preserves the query string). Failed unlocks are capped at 10 per 10-minute window device-wide. `?k=` is only a single-use OTP submission transport; it never carries a session token and never appears in a rendered link, form, or redirect.

The device gate is a latch, not multi-user auth: one shared gate per OS install, valid from any browser that completes it. Treat anyone holding an unlocked browser as holding the device. There is no per-user separation. There is no fallback path: OTP sessions and Kody-owner login are the only ways in; see [Device key](../../../docs/device-key.md).

### Bundle contract

Every app ships its own UI files: there is no separate bundle kind and no `kind` field. Shape fragment: `{ bundle: { entry: "index.html", files: { path: content } } }`. The bundle manifest holds `entry` (must be exactly `index.html`) plus a `files` map of path to string content. Every path must be a relative `.html`, `.js`, or `.css` path with no `..` and no absolute path; deeper nesting beyond one level is not accepted. The files in one bundle must total no more than 256 KiB (`BUNDLE_CAP_BYTES = 256 * 1024`, part of the 16 MiB package storage budget). A definition with a `kind` field is rejected with guidance naming the unified shape. See `catalog/counter.bundle.json`, `catalog/eight-ball.bundle.json`, and `catalog/clock.bundle.json` (modal placement) for installable shapes.

Validation rejects bad bundles before any write and returns `{ ok: false, error }`:

- `definition.bundle.entry must be "index.html"`
- `definition.bundle.files is missing the entry "index.html"`
- `definition.bundle.files has bad path "..." (relative .html/.js/.css only, no "..", no absolute paths)`
- `definition.bundle.files."..." must be a string`
- `definition.bundle.files total ... bytes exceeds the 256 KiB cap`

Effect validation accepts only `set` and `append` (`increment`, `toggle`, `reset` still validate as deprecated sugar until migration retires them; never author new uses). SchemaVersion 3 required the frozen `ui.template` set (`hello | generic | clock`); schemaVersion 4 removes it — delete the field and put anything visual in the bundle. The renderer always shows bundle UI plus live state plus action forms.

### Tile icons

`icon` takes either a plain-text glyph (system fonts only, never an emoji) or an inline SVG mark whose trimmed value starts with `<svg`. Plain text is escaped on render exactly as before. SVG is sanitized at validation, stored canonically, and then inserted unescaped inside the tile's `.tile-icon` plate.

SVG icons are monochrome and Scribe-safe by construction:

- Allowlisted elements only: `svg`, `path`, `circle`, `rect`, `line`, `polyline`, `polygon`, `g`, `title`. Any other element — including `script`, `foreignObject`, `use`, `image`, `style`, and animation elements — rejects the whole definition.
- Geometry plus monochrome `fill`/`stroke` attributes only. `fill`/`stroke` values must be `none`, `currentColor`, `inherit`, `black`, `white`, or a black/white hex value; colors, `url(...)`, gradients, and external refs are rejected.
- No `on*` handlers, inline `style`, `href`/`xlink:href`, comments, or doctypes. Unknown benign attributes are dropped.
- Rendered in a fixed 1.5rem box with `fill`/`stroke` set to `currentColor`, so the mark follows the theme (and inverts correctly on press and on e-ink).
- Keep authored icons around 2 KiB. They live inside the definition and count toward the 16 MiB package storage budget.

A valid icon:

```json
"icon": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\"><circle cx=\"10.5\" cy=\"10.5\" r=\"6.5\" /><path d=\"M15.1 15.1 20.5 20.5\" /></svg>"
```

Validation failures name the offending construct — for example `definition.icon uses a disallowed element <script>` or `definition.icon has an event handler attribute "onload"` — and write nothing. The installable examples (`clock`, `eight-ball`, `counter`, `probe`) all use real monochrome SVG icons.

### Definition versioning

Every definition carries `schemaVersion`, an integer matching the current `DEFINITION_SCHEMA_VERSION` (`5` today; `1` = operator-only era, `2` = bundle-kind era, `3` = unified single-`effect`, `4` = v2 `effects[]` sequence with `ui.template` removed, `5` = v5 `object` fields and arrays of objects, JSON depth cap 10). Send it in every `add_app` call. A definition without it, or a **new** id carrying an older version, is rejected with an error naming the current version, and nothing is written. Versions 3 and 4 still validate for existing ids, which are restamped to 5 on re-add with state preserved by default.

Re-adding an existing id overwrites it and restamps it to the current version regardless of what was submitted. That is how an old app comes forward: export it first if you need the current state, then re-add it. `list_apps()` returns `schemaVersion` on every summary, so "which apps need updating?" is a filter over the list.

Installs from before versioning backfill on read: a stored app with no `schemaVersion` reports the current version when it validates against the current shape, otherwise the oldest known version (`1`). Both eras stay readable and listable instead of bricking the shell.

Breaking definition changes bump `DEFINITION_SCHEMA_VERSION` and ship a migration where one exists (same pattern as the `kody-os-app/1` to `/2` importer). Export envelopes keep `format: "kody-os-app/2"`: the version rides inside the definition, not the envelope.

`act()` applies to every app: bundle UI and MCP calls share the one `act()` handler and the same state. An unknown action returns `{ ok: false, error }` and writes nothing. Re-adding an id with `add_app` overwrites the definition, keeps registry order, pins, hidden flags, homepage placement, and recent entries, and preserves state by default (declared fields carried forward, dropped fields reset to `initial`). Pass `resetState: true` to restore the legacy wipe, or `migrate: { oldField: newField }` to rename fields with validator-checked values; an unmappable `migrate` aborts the whole re-add with `{ ok: false }` and no state change.

The shell hosts a bundle inside the existing chrome (title, nav, inlined theme, single `<style>`, zero external assets). It inlines the `index.html` entry into the app panel (or overlay for `modal` placement), inlines referenced bundle-relative `<script src>` and stylesheet `<link>` content, drops dangling references that match no bundle file instead of fetching them, and appends any extra bundled `.js`/`.css` files as inline blocks. A modal overlay panel opens with its top at 25vh (upper, not centered); its titlebar carries a close box on the left (back to the Apps page) and an expand box on the right that opens the full app page at `/apps/<id>?from=/apps` — the same expand pattern as a home widget. The full app page in turn carries a page-mode expand box at the far right of the shell titlebar, opposite the close box: it makes the window span the viewport edge-to-edge from the top and hides the menubar and status bar, using a URL fragment (`#os-full`) and CSS `:target` with no JavaScript. Height is not forced, so content scrolls exactly as on the normal page, and the control becomes a collapse box in that view. A bundle that cannot be displayed degrades to the normal chrome plus an explanatory message and a working close or back control, never a blank page. Unknown ids still return 404.

### Bundle/shell interaction contract

This section states the full protocol between a bundle and the shell. It is the binding contract for stateful bundles (agent-app-authoring Phase 1, 2026-10-29; Phase 2 bridge decisions, 2026-10-30). The Counter bundle (`pkg/catalog/counter.bundle.json`) is the reference implementation: it is ported to the bridge, and `pkg/catalog/tests/counter-tests.cjs` is the harness that proves it. There are two paths, and both are valid: the bridge path (recommended, below) and the hand-rolled path (rules 4–6, for bundles that do not use the bridge). The retired no-JS premise does not justify the span contract: JavaScript is assumed on the Scribe (see the Kindle Scribe section above). The span-based state handoff below is current behavior for existing bundles; the structured JSON state handoff is decided for Phase 2 and is what new bundles use, with a dual-channel migration (seed and span both rendered) until existing bundles are ported.

**1. Rendered markup, exactly.** The shell renders, in order: the JSON state seed, the bundle UI, then one state readout per declared state field, then one form per `ui.actions` entry. The code in `pkg/src/apps/client.ts` (`renderAppSection`, `renderStateSeed`) is authoritative; the markup is:

```html
<script type="application/json" data-kody-state-seed="1" data-app-id="<id>">{"<field>": <value>}</script>
<div class="bundle" data-bundle="<id>" data-action-base="/apps/<id>">…bundle HTML…</div>
<p data-field="<field>"><field>: <span><escaped value></span></p>
<form class="app-action" method="GET" action="/apps/<id>">
  <input type="hidden" name="action" value="<action>" />
  <!-- hidden from input only when the shell has one to carry; no credential field -->
  <button type="submit">label</button>
</form>
```

The bundle container sits inside `<section class="app" data-app-id="<id>">` on app pages and modal overlays; a home widget renders the same content inside `<section class="widget" data-app-id="<id>">`. (Widget sections carried no `data-app-id` before v0.2.1 — that gap made the bridge read another app's seed on the home screen; do not assume it is absent.) The state readout is a `<p data-field="<name>">` containing the field name as text and a plain `<span>` holding the escaped value. There is **no `data-value` attribute** on the paragraph or the span. With `ui.hideState: true` the paragraph carries `hidden`; the span stays in the DOM with the current value. `ui.actions` forms are shell-owned GET forms: `form.app-action`, hidden `action` input (plus `from` when present), one submit button. No form carries a credential. A bundle must not rewrite, replace, or restyle these forms as its own, and must not assume any other markup for state or actions.

**2. Initial-state reading.** A bundle using the bridge reads its initial value from the JSON seed the shell renders before the bundle (rule 1) — the seed is present at bundle-script time, which the span readout is not (2026-10-30 Scribe probe: span present only by `DOMContentLoaded`). The bridge (`KodyBridge.create`) reads the seed for the bundle's section, falling back to the spans only when no seed is present. A hand-rolled bundle that displays a declared state field reads its initial value from the rendered `[data-field]` span's text. Never assume a `data-value` attribute exists: the renderer emits none, so a bundle that reads one silently falls back to whatever it hardcoded. The Counter bundle's stored display is hardcoded to `0`; reading its own display alone would restart the counter at `0` on every page load. Read the seed (bridge) or the span (hand-rolled) first, and treat the bundle's own static markup only as a last-resort fallback when neither is present at all.

**3. Shell-client patch semantics.** In a capable browser (where `fetch`, `querySelector`, and JSON parsing all exist), the shell client (`pkg/src/client/index.ts`) replays a submitted `form.app-action` as the same GET URL plus `?format=json` with `Accept: application/json`. On `{ ok: true, state }` it patches **only** the `[data-field]` spans inside the nearest `[data-app-id]` ancestor (or the enclosing `<section>`, or the document when neither exists), setting each span's `textContent` from the returned state for keys present in it, and clears or shows the in-place `role="alert"` error. It never writes to bundle-owned DOM and never touches bundle variables. Any failure — fetch error, unparsable response, missing `ok`, non-object state, cross-origin URL guard — falls back to native `form.submit()`: full navigation, server redirect, fresh render. On the server, `k`, `from`, and `format` are stripped before the action runs, so they never become action arguments. A bundle therefore cannot rely on the shell client to update its display: after a shell-form action, only the span has moved.

**4. Form ownership and the capture/sequencing pattern.** When a bundle has its own buttons for an action that a shell `ui.actions` form also performs (Counter's `+1`/`-1` buttons share state with the shell Reset form), the bundle must handle the shared action with all four parts, scoped to its own section:

- **Capture-phase claim, scoped to the app's own form.** Register a capture-phase `submit` listener on the document. Claim a submit only when the form is inside the bundle's own section scope, its `input[name="action"]` names the shared action, and its form action base matches the bundle's own `data-action-base`. On a claim, prevent the default and stop propagation so the shell client's fetch never starts, paint optimistically at once, and send the write through the bundle's single-flight queue (rule 5). Never claim another app's form, and never claim a form for a different action.
- **Optimistic paint.** Paint the intended value immediately, in both the bundle's display and the shell span (rule 6), before any fetch resolves. A shell-form action with no optimistic paint feels a full round trip behind the bundle's own buttons.
- **Sequencing guard.** Count local actions (steps and claimed submits) in order. Record the sequence number of a Reset-style submit; a shell span patch that arrives after the sequence has moved past it is stale and must not be adopted. Without this guard, a late shell patch (the Reset value) overwrites a step taken after Reset was pressed, and the in-flight handler can then re-send the stale value server-side, losing the step for good. The reverse ordering fails the same way: a stale pre-Reset response must not repaint the old value after Reset.
- **`MutationObserver` adoption, with a form-level fallback.** Observe the `[data-field]` paragraph (child list, character data, subtree, attributes) and adopt a value the bundle did not itself paint — that is how a shell-form action the bundle did not claim (or a claim that never delivered) still resets the bundle's display and internal count. The observer must not loop (painting the same value back is no change) and must not fire extra fetches. As a fallback for engines that do not deliver submit capture, attach a form-level `submit` listener that paints and sequences at submit time without claiming the submit: the shell client's fetch still owns the server call, and the sequencing guard keeps its late patch from losing steps taken since.

A bundle with no shared actions needs none of this; a bundle whose buttons are the only writers to its fields needs only rules 5 and 6. The no-JS path needs none of it either: native submit reloads the page and initialization reads the freshly rendered span.

**5. Single-flight ordered queue.** One in-flight state write per app. Clicks update a single desired value and paint it immediately; `flush` sends at most one request at a time, and inputs made while one is in flight coalesce into a single follow-up request for the latest desired value — rapid clicks never send duplicate writes with the same value. On a response, if the server value differs from the in-flight value (someone else moved the state), rebase the pending deltas onto the server value instead of overwriting the desired value. On fetch or JSON failure, fall back to full navigation for the latest desired value, and clear the in-flight flag so the bundle is not wedged: the next input must send again. The Counter bundle's `flushCounter` / `stepCounter` / `desiredCount` / `confirmedCount` variables are the reference shape of this queue.

**6. Paint/sync.** When a bundle paints, it writes the same value to its own display and to the shell `[data-field]` span, so the two never diverge. Initialize on `DOMContentLoaded`, guarded against double initialization, by reading the span (rule 2) and painting that value before wiring observers and listeners. Keep one source of truth after initialization (desired vs. confirmed counts in the Counter bundle): never re-read the painted DOM as the current value, because it only changes when a fetch returns or the shell patches it.

**7. Action-URL resolution (`data-action-base`).** Bundle buttons that mutate state SHALL resolve their action URL from their own `.bundle` container's `data-action-base` attribute, never from `window.location.pathname` alone. The shell stamps `data-action-base="/apps/<id>"` on every bundle container it renders — app page, modal overlay, and home widget — so the same button acts on the owning app from the dashboard as well as from the app's own page. Walk up from the clicked element to the nearest ancestor carrying the attribute and fall back to `window.location.pathname` only when it is absent (an older shell). When the button uses `fetch` for the `?format=json` fast path, pass `credentials: 'same-origin'` so the session cookie authenticates the request, attach no credential to the URL, and keep the full-navigation fallback. The Counter bundle's `actionBase()` is the reference implementation. The checklist below rejects any bundle that builds action URLs from `window.location.pathname` alone.

**Bridge adapter (recommended path, `window.KodyBridge` v1).** A stateful bundle SHOULD use the bridge. It is loaded once by the shell client module (so it exists by `DOMContentLoaded`, when bundles init), and it is instantiated per app section — one store per section, never shared across sections. The source of truth is `pkg/src/bridge/bridge.js` (plain ES2019, classic-script compatible); the Counter bundle is the reference consumer.

- **Create:** `var store = window.KodyBridge.create(section, { fieldTypes: { count: 'integer' }, reassert: fn })`, where `section` is the bundle's `<section data-app-id>` (capture it from `document.currentScript` at parse time, falling back to the first `section[data-app-id]` — never to a seed `<script>`, which also carries `data-app-id`). If the bridge is absent, paint from the seed/span and do nothing else; the shell Reset form still works natively.
- **Store model:** `durable` mirrors the server and changes only via dispatch to `act()`; `ephemeral` is local only (drafts, selection, filters) via `store.setEphemeral(field, value)` and is never sent or stored server-side; `derived` is computed from durable + ephemeral via `store.defineDerived(name, fn)`, recomputed on change, never stored. `store.getState()` returns `{ durable, ephemeral, derived, desired, pending }`; `store.get(field)` returns the desired value.
- **Render:** `store.subscribe(fn)` calls `fn(snapshot)` on every change; the bundle renders from `snapshot.desired` with plain DOM (the Counter does exactly this). No separate renderer library is provided yet — re:dom UMD and light-DOM Custom Elements remain the ceiling-clean renderer candidates for list/complex rendering, to be confirmed at the gate; do not vendor one per app as the default path.
- **Dispatch:** `store.dispatch(action, args, optimistic, rebase)` paints `optimistic` at once and sends one `?format=json` fetch (action URL from the section's `.bundle` `data-action-base`, `credentials: 'same-origin'`, `k` preserved from the page URL). One write in flight per section; a dispatch while one is in flight coalesces into a single follow-up for the latest desired value. On fetch failure or `{ ok: false }`, the in-flight flag clears and the desired paint is kept, so the next dispatch re-sends — the bundle is never wedged.
- **Rebase:** `rebase(server, pending, sent)` returns `{ args, optimistic }` or `null`. For a delta (Counter steps), recompute from the server: `server.count + (pending.count - sent.count)`, clamped. For an absolute set, return `null` (server wins) or the absolute value (bundle wins). Nested fields are replaced wholesale on rebase unless the bundle's rebase says otherwise — there is no silent deep-merge. This is the whole nested rebase rule.
- **Shell forms:** `store.claimForm(form, action, argsFn, rebaseFn)` claims a shell `ui.actions` form in the capture phase, paints optimistically, and sends through the queue. `store.startSpanObserver()` observes the section's `[data-field]` spans: a span change matching durable or desired is the bundle's own paint and is ignored; a patch that is the late echo of a shell submit made before a bundle dispatch is stale and is repainted to desired; any other patch is adopted as new durable state, and if a write is in flight, the bundle's `reassert(desired)` (returning `{ action, args, optimistic, rebase }`) re-sends the adopted value when the stale response returns. A bundle without a `reassert` function never adopts over a pending dispatch — no lost writes.
- **SchemaVersion 5:** the current definition version is 5 (supported: 3, 4, 5). Version 5 adds `object` fields and arrays of objects; nested values must be JSON-serializable, depth cap 10. Version 5 is MAJOR for the durable schema; existing v4 definitions still validate and still work, and re-adding an id restamps it to 5 with state preserved by default.
- **Fallback rules:** hand-rolled bundles that follow rules 4–6 remain valid — the validator does not reject a bundle for not using the bridge. Stateless and presentational bundles need not use it at all. Per-app vendoring or compilation (Svelte, Lit pieces, microframeworks) is allowed only as a documented fallback with its pinned version and update owner recorded with the bundle, never as the default path. Svelte and Lit are not provided by the shell as shipped (they need downleveling/ESM conversion); a couple of polyfills are a narrow, case-by-case exception for an otherwise ceiling-clean candidate, not a general pipeline.

### Widget visibility (hide content in widgets)

A bundle can hide chosen content when it is displayed as a home widget, using CSS only — no shell change and no context API. The widget wrapper is `<section class="widget" data-app-id="<id>">`; app pages and modals use `<section class="app">`. Bundle CSS is inlined verbatim and unscoped, so a `section.widget` ancestor selector matches only in widgets.

Rules:

- Qualify every widget rule with an id or class unique to the app (for example `section.widget #my-install { display: none; }`, or `section.widget[data-app-id="my-app"] .app-body { ... }` for the shell body). Never use unqualified element or shared-class selectors under `section.widget`: bundle styles apply document-wide, so such a rule would hide matching content in other apps' widgets on the same home page.
- Hiding means `display: none` only. Hidden content stays in the DOM, bundle JS keeps running, and hiding changes no state, action, capability, or permission. It is not a privacy boundary.
- The inverse pattern (widget-only content) hides by default and reveals under `section.widget` with an explicit display value.
- Shell action forms (`form.app-action`) carry no app-specific CSS hook — the action name lives only in a hidden input — so bundle CSS cannot hide one app's shell form without leaking into others, and `:has()` is unavailable on the Scribe's Chromium 80. Hide a shell form from bundle JS instead: the bundle's existing claim function can set `style.display = 'none'` when its section is a widget (Hoodie Weather's Restore form does this).
- Reference implementations: Link Drop (install block and Clear All hidden in widgets, link list visible) and Hoodie Weather (buttons and rewrite note hidden by CSS, Restore form hidden by JS, forecast and verdict visible; widget body vertically centered with a `section.widget[data-app-id="hoodie-weather"] .app-body` flex rule).

Do not invent a context signal: there is no `data-context` attribute and no shared theme utility class for page-only content in v1.

### Pre-`add_app` authoring checklist

Run every item before calling `add_app`. The verification path is exactly one: the `kody dev` end-to-end check below plus the jsdom harness pattern in `pkg/catalog/README.md`. There is no other supported local verification path.

- [ ] The definition validates: id, `schemaVersion` 5 for a new app (3 and 4 still accepted on re-add of an existing app, which restamps it to 5 with state preserved), bundle entry and 256 KiB cap, state schema (including `object` fields and arrays of objects in v5), `set`/`append` effects only, `ui.actions` referencing declared actions.
- [ ] The bundle renders in `kody dev`: the app page shows the JSON seed before the bundle, the bundle, the state readout, and the shell action forms, with no console or render error.
- [ ] State initializes from the JSON seed (bridge) or the shell span (hand-rolled): loading the page at a non-zero stored value displays that value, not the bundle's hardcoded markup.
- [ ] Shell-form actions stay in sync under rapid and overlapping input: Reset-then-step, step-then-Reset, and a stale response landing after Reset all settle at the newest intended value, in the bundle display and in the span (run the harness scenarios, or step through them in `kody dev` with the network delayed).
- [ ] The ES2019 scan is clean for browser-executed bundle code: no post-ES2019 syntax or APIs; see the canonical ceiling in `scribe-limitations.md`. (The Counter bundle's stricter avoidance of arrows, `const`/`let`, `async`/`await`, and template literals is its own style, not a checklist requirement.)
- [ ] No action URL is built from `window.location.pathname` alone: every bundle `fetch` resolves against the container's `data-action-base`, sends `credentials: 'same-origin'`, requests `?format=json`, and falls back to full navigation.
- [ ] Stateful bundle: uses the bridge (`window.KodyBridge` v1, see the bridge surface above), or records why not (hand-rolled per rules 4–6, or a documented per-app fallback with pinned version and update owner). The second-app gate is passed (Counter + xkcd ported, live on v0.3.0 build 12); the bridge is the recommended path for stateful bundles.

Scribe posture for bundle content: ES2019 only — see the canonical ceiling in `scribe-limitations.md` (no post-ES2019 syntax or APIs); system fonts only, zero emojis, all CSS and JS inlined, no external stylesheets or scripts. Guarded `fetch` of the same-origin GET action with `?format=json` is allowed where `fetch` and JSON parsing exist; never require timers, WebSockets, client-side routing, animations, auto-refresh, or polling. Large tap targets and high-contrast black-on-white still apply. Full device findings: `scribe-limitations.md`.

Styling: see [Style guide](../../../docs/style-guide.md). The shell's inlined theme styles standard bundle controls with no class needed (a bare `<button>`, `<input>`, `<select>`, or `<textarea>` inside a bundle gets the shared look); the shared `os-*` classes remain only for variants (`.os-btn--dark`, `.os-display`, `.os-keypad` / `.os-key`) — do not copy or redefine them, and do not load an external stylesheet. Bundle-only CSS stays inline in the bundle.

Trust boundary: a bundle runs its own JS in the page. It has no direct storage access and no access to other apps or the registry; every persistence goes through `act()` (shell GET forms, or bundle `fetch` of the same-origin GET action URL — resolved against the container's `data-action-base` — with `?format=json` and `credentials: 'same-origin'`, with full-navigation fallback where `fetch`/JSON parsing are absent). Keep bundles toy-scoped and self-contained; anything needing shared validated state belongs in `set`/`append` actions.

Decision rule: one shape for everything. Write the bundle for what the eye sees, the state schema for what must persist, and `set`/`append` actions for every mutation. Never add a `kind` field, a template branch, or a new operator.

### Complete example

Save this as `/tmp/preview-counter.json` (a scratch path outside the repo; the commands below run from `pkg/`):

```json
{
  "id": "preview-counter",
  "name": "Preview Counter",
  "label": "Counter",
  "schemaVersion": 5,
  "icon": "+",
  "category": "Tests",
  "description": "A counter added through the app registry; no republish.",
  "bundle": {
    "entry": "index.html",
    "files": {
      "index.html": "<!doctype html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<style>\n.counter-wrap { font-family: system-ui, sans-serif; text-align: center; padding: 24px 16px; }\n</style>\n</head>\n<body>\n<div class=\"counter-wrap\"><p>Preview counter bundle.</p></div>\n</body>\n</html>\n"
    }
  },
  "ui": {
    "title": "Preview Counter",
    "actions": [
      { "action": "reset_count", "label": "Reset" }
    ]
  },
  "stateSchema": {
    "type": "object",
    "initial": { "count": 0 },
    "fields": {
      "count": { "type": "integer", "min": 0, "max": 999999 }
    }
  },
  "actions": {
    "set_count": {
      "description": "Set the counter to an explicit value.",
      "args": { "value": { "type": "integer", "required": true, "min": 0, "max": 999999 } },
      "effects": [{ "op": "set", "field": "count", "fromArg": "value" }]
    },
    "reset_count": {
      "description": "Reset to zero.",
      "effects": [{ "op": "set", "field": "count", "value": 0 }]
    }
  }
}
```

### Validation

`add_app` validates before writing. On failure it returns `{ ok: false, error }` and writes nothing. Common errors:

- `definition.id must match ^[a-z0-9][a-z0-9-]{0,63}$`
- `definition.schemaVersion must be a positive integer; the current version is 5`
- `definition.schemaVersion 1 is stale for a new app; send the current version 5 (re-adding an existing id restamps it)`
- `unsupported definition.schemaVersion <n> (supported: 3, 4, 5)`
- `definition.kind "..." is retired; use the unified shape: meta + bundle { entry, files } + stateSchema + actions`
- `definition.bundle.entry must be "index.html"` (plus bad-path, non-string-file, and 256 KiB cap errors)
- `definition.ui.template must be hello, generic, or clock` (schemaVersion 3 only; frozen, required but render-ignored)
- `definition.ui.template is removed in schemaVersion 4; delete it (renderer ignores it)`
- `actions.<name> must use effects[] in schemaVersion 4 (single effect retired)`
- `definition.ui.actions references unknown action "..."`
- `stateSchema.initial key "..." has no field declaration`
- `actions.<name>.effects must be a non-empty array`
- `actions.<name>.effects[0].field must name a declared state field`
- `actions.<name>.effects[0] append target must be an array field`
- `actions.<name>.effects[0].op must be set, append, increment, toggle, or reset`

`add_app` on an existing `id` overwrites the definition and preserves state by default (declared fields carried forward, dropped fields reset to `initial`). Pass `resetState: true` to reset to `initial`, or `migrate` to rename fields. Export first if you need the old state.

`act` validates args and the resulting state before a single write. A bad action returns `{ ok: false, error }` and leaves state unchanged.

`ui.actions` entries are only `{ action, label }`; the current shell renders one no-argument button per entry. An action with `args` is callable through MCP `act(id, action, args)` but has no generated UI form yet.

## Add to the hosted OS (real running app)

The package is `@hypercubed/kody-os`; this install is hosted at `https://hypercubed.kody.run/kody-os`. MCP exports are not gated by the device gate.

1. Save the definition to `/tmp/preview-counter.json`.
2. Add it through the Kody MCP `execute` tool (an agent does this) or the CLI:

   MCP `execute` (the `definition` value is the parsed `/tmp/preview-counter.json` object):

   ```js
   execute({
     code: `import { add_app } from 'kody:@hypercubed/kody-os'
   export default async function main(definition) {
     return await add_app(definition)
   }`,
     params: definition,
   })
   ```

   CLI (cloud execute; sign in with `kody login` or use a token):

   ```bash
   cd pkg
   kody execute --code '
   import { add_app } from "kody:@hypercubed/kody-os"
   export default async function main(definition) {
     return await add_app(definition)
   }
   ' --params "$(cat /tmp/preview-counter.json)"
   ```

   Success is `{ "ok": true, "id": "preview-counter" }`. No republish happens.

3. Verify:

   ```js
   execute({
     code: `import { list_apps } from 'kody:@hypercubed/kody-os'
   export default async function main() { return await list_apps() }`,
   })
   ```

   Or open `https://hypercubed.kody.run/kody-os/apps` in a browser that already holds a session cookie (or unlock it first with a fresh OTP). The app appears in All apps immediately.

4. Optional: add it to the home dashboard. Open Apps Edit, find the app's row, and choose **Add to home**. New apps do not appear on the home dashboard automatically. The home page shows homepage apps as live widgets; the widget up/down buttons reorder them. **Pin** is a separate Apps-page section and does not place an app on the home dashboard.

## Add to the local preview (`kody dev`)

The local preview serves the working tree with `kody dev`. This is the one supported local verification path, together with the jsdom harness in `pkg/catalog/README.md` — see the [pre-`add_app` authoring checklist](#pre-add_app-authoring-checklist). Run every command in this section from `pkg/` (running from the repo root fails: the package entry is not found there). Its mock storage is separate from the hosted store. A fresh mock store is locked until you mint a local OTP.

Local registry writes use the existing file helpers in `pkg/scripts/` — do not recreate them: `scripts/registry.ts` (add/list/remove through `add_app`/`list_apps`/`remove_app`), `scripts/catalog.ts` (install/update/list through `install_from_catalog`/`update_from_catalog`/`list_catalog` — use this for shipped catalog apps instead of hand-wrapping a bundle file), `scripts/add-app.ts` (install one definition file directly — params ARE the definition, no op wrapper, unlike `registry.ts`), `scripts/mint-dev-otp.ts` (mint a local-dev OTP; no params), and `scripts/clear-auth.ts` (clear local sessions and OTPs; returns counts only). The same commands, proxy bypass, and `kody dev` checks are in the "Local dev" sections of `pkg/README.md` and `pkg/AGENTS.md`; this section is the authoring copy of that path, not a second one.

Use `--file`, not `--code`, for local writes. `--file` from `pkg/` uses the package bucket `local:kody-os`, the same bucket `kody dev` reads. `--code` with `kody:@...` uses the `local-default` mock bucket and will not appear in the preview.

1. Stop `kody dev` if it is running. A running preview keeps its mock state in memory; start it after the writes, or restart it afterward.
2. Mint a local-dev OTP and add the app. Proxy bypass is required on this host for every `kody dev` / `curl` call:

   ```bash
   cd pkg
   export NO_PROXY='*' no_proxy='*'
   unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy ALL_PROXY

   kody execute --target mock --file scripts/mint-dev-otp.ts

   DEF="$(cat /tmp/preview-counter.json)"
   kody execute --target mock --file scripts/registry.ts \
     --params "{\"op\":\"add\",\"definition\":$DEF}"
   ```

   The mint returns a 4-digit code exactly once: single use, valid 10
   minutes. Enter it in the unlock form after starting the preview; it
   burns into a 30-day session cookie, and the footer then reads
   `via cookie` with a clean URL.

3. Start the preview:

   ```bash
   kody dev --target mock
   ```

   Open the printed URL and enter the minted code in the unlock form (or open `/unlock/<code>`). Start without an explicit `--port` (bare `kody dev`, no `--port` flag) so `kody dev fetch` can attach to it.

4. Verify against real shell rendering:

   ```bash
   kody dev check --target mock --offline
   ```

   A minted OTP is single use, so there is no repeatable `?k=` fetch check: verify the served HTML in the unlocked browser instead. Confirm it carries the contract markup: the bundle, then `<p data-field="…">` with a plain `<span>` holding the stored value, then the `form.app-action` forms. Or use the registry helper:

   ```bash
   kody execute --target mock --file scripts/registry.ts --params '{"op":"list"}'
   ```

5. Reset the local mock store when you want a clean install. Stop the preview first:

   ```bash
   kody execute --target mock --reset-storage --file scripts/registry.ts --params '{"op":"list"}'
   ```

   This wipes the local apps and the local sessions/OTPs without starting a server. Re-run the mint-OTP step and the add, then start `kody dev`.

The local mock session defaults to `default`; set `KODY_MOCK_SESSION_ID` to use a different scratch session. The store is in the CLI user cache (Linux: `~/.cache/kody/mock-sessions/<session>/state.json`).

## Verify, homepage, export, remove

- **Read state:** `get_app_state(id)` returns the same state the app page renders.
- **Run an action:** `act(id, action, args?)` returns `{ ok: true, state }` or `{ ok: false, error }`.
- **App page:** `/apps/<id>` shows the description, every state field, and the declared action forms. Forms submit as GET (`/apps/<id>?action=<name>`); no form carries a credential — authentication rides the session cookie, so every page renders clean forms. In capable browsers the same GET is replayed with `?format=json`, and only the changed `data-field` value spans update in place; without working `fetch`/JSON parsing, the form submits natively and the server 303-redirects. The renderer adds `form.app-action`, `section[data-app-id]`, `data-action-base` on the bundle container, and `data-field` hooks automatically — but that is not the whole job for a bundle that displays state: the bundle must read its initial value from the JSON seed (bridge) or the span (hand-rolled) and handle shell-form actions per the [Bundle/shell interaction contract](#bundleshell-interaction-contract), or its display goes stale the first time a shell form fires.
- **Homepage:** Apps Edit row → **Add to home** / **Remove from home**. The home dashboard shows live widgets in homepage order. Homepage placement is a UI action in the current shell; there is no `set_home` MCP export.
- **Pin and hide:** Apps Edit row → **Pin** / **Hide**. Hide is reversible, and a hidden app still appears in Apps Edit so it can be unhidden there. The UI has no Remove control.
- **Launcher state:** `get_launcher_state()` returns `{ pinned, hidden, recent, homepage }` in stored order, missing keys as `[]`, and reads never write. Recency is read internally by the aggregate and is not a separate root export: `get_pinned`, `get_hidden`, and `get_homepage` are exported individually, `get_recent` is not. Rendered correspondence: `/` homepage order, `/apps` Pinned/Recent sections. Use the aggregate to verify a removal scrubbed every list, recent included.
- **Export:** `export_app(id)` returns `{ format: "kody-os-app/2", exportedAt, definition, state }`. `import_app(payload, undefined, { overwrite: true })` restores it into the other target. Use this to copy between hosted and local, which have separate stores. An export never carries an install snapshot or a backup.
- **Remove:** `remove_app(id)` deletes the definition, state, registry entry, install snapshot, and pinned/hidden/recent/homepage references. Unknown ids return `{ ok: false, error }` and write nothing. Removal is MCP-only; the browser UI only hides.
- **Install backups:** `backup(name)` captures the whole install (apps, definitions, states, pinned, hidden, homepage) under `kody-os.backups.<name>`; recency and auth are never captured. Names must match `^[a-z0-9][a-z0-9-]{0,63}$`; an existing name is refused unless `overwrite: true` is passed. `list_backups()` reports name, capture time, app count, and size; `delete_backup(name)` removes one backup, and an unknown name returns `{ ok: false }` with no write. `restore(name)` validates the snapshot before any delete, auto-snapshots the current install first (the result names that auto-snapshot, so restoring it undoes the restore), wipes only install keys, and writes the snapshot contents. Unknown names, unknown format tags, and corrupt entries fail closed with the install untouched. Keep 2–3 recent backups: the 16 MiB budget is shared, and no quota or expiry policy exists yet.
- **App Store and catalog versioning:** the first authenticated shell request against an empty registry installs only the App Store, from the browser, with no agent and no republish. The App Store (`/apps/app-store`) is a data app: its bundle renders one row per id from the union of catalog and installed ids, alphabetical, unfiltered, through the shell management API (`GET /manage/rows|install|update|restore`, acting app must declare `manageApps`). Catalog-only rows offer Install only and no Open link; installed rows offer Update, Restore, or neither by status, never Pin/Hide/Home — those live in Apps Edit. Every catalog definition carries `catalogVersion`, a positive integer starting at 1 and +1 on any change to that definition file, distinct from `schemaVersion` and from the package version; a catalog definition without a valid `catalogVersion` fails catalog validation, while a generic `add_app` definition without one stays valid. A store install or store update records an install snapshot separate from the definition (install-time `catalogVersion` plus a fingerprint of the canonical stored definition, content only — a version-only change still fingerprints as up to date). Generic `add_app` and `import_app` never write a snapshot, `remove_app` deletes it, and it is never exported. Status is derived from installed vs. snapshot vs. catalog fingerprints and versions: up-to-date, behind-clean, catalog-differing, behind-modified, modified-current, modified-ahead, or snapshot-less (no status, no update control). Behind-clean and catalog-differing rows offer Update; modified-current and modified-ahead rows offer Restore, never Update; behind-modified rows offer a confirmed update. A confirmed update or restore first shows the bundle's confirmation UI stating that definition changes are lost and unrecoverable unless exported first, while state for surviving fields is preserved and dropped fields reset, and naming any capability additions — and it writes nothing until confirmed, and nothing if declined. The store never auto-updates.

Example MCP calls for the hosted target:

```js
execute({
  code: `import { act } from 'kody:@hypercubed/kody-os'
export default async function main(input) {
  return await act(input.id, input.action, input.args)
}`,
  params: { id: 'preview-counter', action: 'set_count', args: { value: 1 } },
})
```

```js
execute({
  code: `import { remove_app } from 'kody:@hypercubed/kody-os'
export default async function main(input) { return await remove_app(input.id) }`,
  params: { id: 'preview-counter' },
})
```

Local removal:

```bash
kody execute --target mock --file scripts/registry.ts \
  --params '{"op":"remove","id":"preview-counter"}'
```

## Storage map

| Key | Holds |
| --- | --- |
| `kody-os.apps.registry` | Installed app ids, in add order. |
| `kody-os.apps.def.<id>` | The app definition JSON. |
| `kody-os.apps.state.<id>` | The current state JSON. |
| `kody-os.apps.pinned` | Pinned ids for the Apps page. |
| `kody-os.apps.hidden` | Hidden ids, excluded from the All apps list and Recent. |
| `kody-os.apps.recent` | Recently used ids for the Apps page. |
| `kody-os.apps.homepage` | Homepage/widget order. |
| `kody-os.apps.snapshot.<id>` | Install snapshot for a store-installed app: `{ catalogVersion, fingerprint }`. Written only by store install/update, deleted by `remove_app`, never exported. |
| `kody-os.shell.theme` | Shell theme override (Phase 1 storage layer): partial `{ name, title, icon, background }`, merged per field over the published file theme on every page render. |
| `kody-os.backups.<name>` | Named install backup: `{ format: "kody-os-backup/1", name, capturedAt, install }` (the `export_install` envelope). |
| `kody-os.backups.index` | Index of backup names (packageStorage has no key listing); maintained by `backup`/`delete_backup`, never wiped by `restore`, never exported. |
| `kody-os.auth.otp.v2` | Live OTP hashes: `{ h, exp }[]`, 10-minute TTL, max 5 outstanding, pruned on write. Burned (removed) on first correct use. The v1 key is never read (cutover invalidation, v2.0.0). |
| `kody-os.auth.sessions.v2` | Live session hashes: `{ h, exp }[]`, 30-day TTL, pruned on read. Deleted on logout. The v1 key is never read (cutover invalidation, v2.0.0). |
| `kody-os.auth.fail2` | Unlock rate-limit counter: `{ n, start }` for the 10-fails-per-10-minutes device-wide window. |

The hosted and local stores are independent. Adding to one does not add to the other. OTP codes and session bearers are never stored or logged raw — only their SHA-256 hashes rest in storage.

## Troubleshooting

- **`{ ok: false, error }` from `add_app`:** validation failed and nothing was written. Fix the named field and retry.
- **App is on Apps but not the home dashboard:** add it with Apps Edit's **Add to home** control. New apps are not automatically homepage widgets.
- **App added to hosted but not local (or the reverse):** the stores are separate. Run the same add against the other target; use `list_apps()` in the target you are checking.
- **Local preview shows the locked 404:** a fresh mock store has no session. Run `scripts/mint-dev-otp.ts` before starting `kody dev`, then enter the code in the unlock form (see [Device key](../../../docs/device-key.md)).
- **Local add is missing in a running preview:** `kody dev` loaded the mock store at startup. Run the registry write before starting it, or stop and restart it. `kody dev fetch` attaches only to a server started without an explicit `--port`.
- **`kody dev --target prod` throws `local:<kody.id>`:** it does not provide the hosted `packageStorage()`. Use the hosted MCP/execute path for the real app.
- **`--invoke` with `add_app` fails:** this package exports only the root, so there is no `/add_app` subpath. Use the `--code`/`--file` wrappers shown here.
- **An action with args has no button:** the current shell renders only no-arg buttons. Call `act(id, action, args)` through MCP.
- **Increment flashes a full reload:** expected on browsers without working `fetch`/JSON parsing, or when the fast-path request fails. Capable browsers patch the changed fields in place; the no-JS navigation path always still works.
- **`format` appears in a request:** the UI/server fast path uses `?format=json` to ask for `ActResult` JSON. It is stripped before `actFromForm`, so it never becomes an action arg.
- **Re-adding reset the state:** it does not, by default. `add_app` on an existing id overwrites the definition and preserves state (declared fields carried forward, dropped fields reset to `initial`). Pass `resetState: true` to restore the legacy wipe, or `migrate: { oldField: newField }` to rename fields. Export before replacing if you need the old state regardless.
- **No remove button in the UI:** removal is MCP-only by design. Use `remove_app`; use Hide for a reversible action.
- **Access code:** the hosted browser needs a fresh OTP (owner mints with `mint_otp`, valid 10 minutes, single use, 4 digits); MCP exports are not gated. Do not put a code in a definition, export, or log. `?k=` is only the OTP submission transport, on hosted and local alike — never a session token, never a bookmark.

## See also

- [Agent guide](../../../AGENTS.md)
- [App-layer integration](../../../src/apps/INTEGRATION.md)
- [Package README](../../../README.md)
- [Scribe limitations](../../../docs/scribe-limitations.md)
