# Adding an app

An app is a JSON definition in `packageStorage()`. Adding one is a registry write: no source change, no commit, no publish, no republish. The same definition works in the hosted OS and the local preview; the two stores are separate, so add it to each target you use.

The browser shell has no add control. Agents add with the package's MCP `add_app` (or an `execute` wrapper). The shell can hide, pin, and add an app to the homepage; deletion is MCP-only (`remove_app`).

## Definition contract

| Field | Required | Value |
| --- | --- | --- |
| `id` | yes | Slug matching `^[a-z0-9][a-z0-9-]{0,63}$`. Routes and storage keys use it. |
| `name` | yes | Non-empty display name. |
| `label` | no | Tile label. Defaults to `name`. |
| `icon` | no | Plain-text glyph or short mark. Never an emoji. |
| `category` | no | Metadata string. The current shell lists all apps together. |
| `description` | no | Help text shown on the app page. |
| `ui.template` | yes | `hello` \| `generic` \| `clock`. Deprecated and frozen: no new values and no per-template render branches will be added. Use bundles for anything visual. |
| `ui.title` | no | App page and overlay title. Defaults to `name`. |
| `ui.placements` | no | Non-empty subset of `page`, `modal`, `widget`. Defaults to `["page"]`. `modal` makes the Apps tile open an overlay; `widget` is reserved and renders nothing. |
| `ui.actions` | no | Array of `{ action, label }`. Each `action` must exist in `actions`. Buttons are no-argument GET forms. |
| `stateSchema.type` | yes | `"object"`. |
| `stateSchema.initial` | yes | Initial values. Every key must be declared in `fields`. |
| `stateSchema.fields` | yes | Map of field name to `{ type, min?, max?, maxLength?, items?, maxItems? }`; `type` is `integer`, `string`, `boolean`, or `array`. `min`/`max` apply to integers; `maxLength` to strings; `items` (`integer`/`string`/`boolean`) and `maxItems` to arrays. |
| `bundle` | yes | `{ entry: "index.html", files: { path: content } }`. Every app ships its own UI files; see the bundle contract below. |
| `actions` | yes | `{ [name]: { description?, args?, effect } }`. |
| `actions.*.effect` | yes | One of `set`, `append` (see below). `increment`, `toggle`, and `reset` are deprecated sugar kept only until migration retires them; do not use them in new apps. |
| `actions.*.args` | no | `{ [name]: { type, required?, default?, min?, max?, maxLength? } }`. Values are coerced from form strings. |

Effects:

| `op` | Fields | Notes |
| --- | --- | --- |
| `set` | `field`, `value?`, `fromArg?` | `field` must be declared. Provide `value` or `fromArg` (an arg name). |
| `append` | `field`, `value?`, `fromArg?`, `cap?`, `maxEntryBytes?` | `field` must be a declared `array`. Appends one entry; oldest entries drop first past `cap` (default 500); string entries over `maxEntryBytes` (default 2048) are rejected. |

Definitions are JSON: no code, `eval`, or imports. The two effect operators are implemented once in the package registry; `add_app` validation rejects any other `op`. Agents compose apps from these fixed operators—they do not invent new operators per app. One effect per action. The package storage budget is 16 MiB.

### What `set` and `append` actually are

They are generic data-write operators, not a built-in counter app. `hello-counter` is only a test harness that happens to use them. Any app may define its own actions with either of:

- `set`: write a fixed value—or a validated arg—to a declared field.
- `append`: append a fixed entry—or a validated arg—to a declared array field, with length and entry-byte caps.

Each app has isolated state at `kody-os.apps.state.<id>`. Every action coerces its args, applies the effect to a copy of state, re-validates the result against the schema, then writes with a single set. A bad action returns `{ ok: false, error }` and leaves stored state untouched. One app cannot touch another app’s state.

Stated plainly: there is no `random`/`shuffle` operator, and UI buttons carry no arguments. A true Magic 8-ball “shake” keeps its randomness in bundle JS and persists the outcome through a `set`/`append` action (see `example-apps/eight-ball.bundle.json`); arg-taking actions are driven through MCP `act(id, action, args)` or bundle `fetch`. Do not invent new operators per app; they are only these two.

### Kindle Scribe browser: what agents may assume

Available:

- Plain server-rendered HTML, links, and GET forms.
- Inline CSS only; system fonts; high-contrast black-on-white.
- Server-side state in `packageStorage()`; no reliance on cookies or `localStorage`.
- Guarded vanilla-JS enhancement: if `fetch`/JSON parsing exist, the shell may replay the same GET action with `?format=json` and patch fields in place. If not, the same form still works through full navigation.

Not available to depend on:

- Frameworks, client-side routing, or JS-required actions.
- Mutating POST forms or `fetch` POST in the UI; the Kody edge rejects cross-origin/null-origin POSTs to package-app subdomains.
- WebSockets, timers/polling, auto-refresh, background sync, animations/transitions.
- External stylesheets or external scripts.
- Cookies/`localStorage` as functional storage; treat them as absent.

ReKindle is existence proof that guarded vanilla JS can run in a Kindle browser. It is not proof of modern APIs, storage, sockets, or timers. So: enhance where present, never require.

### Bundle contract

Every app ships its own UI files: there is no separate bundle kind and no `kind` field. Shape fragment: `{ bundle: { entry: "index.html", files: { path: content } } }`. The bundle manifest holds `entry` (must be exactly `index.html`) plus a `files` map of path to string content. Every path must be a relative `.html`, `.js`, or `.css` path with no `..` and no absolute path; deeper nesting beyond one level is not accepted. The files in one bundle must total no more than 256 KiB (`BUNDLE_CAP_BYTES = 256 * 1024`, part of the 16 MiB package storage budget). A definition with a `kind` field is rejected with guidance naming the unified shape. See `example-apps/hello-counter.json`, `example-apps/eight-ball.bundle.json`, and `example-apps/clock.bundle.json` (modal placement) for installable shapes.

Validation rejects bad bundles before any write and returns `{ ok: false, error }`:

- `definition.bundle.entry must be "index.html"`
- `definition.bundle.files is missing the entry "index.html"`
- `definition.bundle.files has bad path "..." (relative .html/.js/.css only, no "..", no absolute paths)`
- `definition.bundle.files."..." must be a string`
- `definition.bundle.files total ... bytes exceeds the 256 KiB cap`

Effect validation accepts only `set` and `append` (`increment`, `toggle`, `reset` still validate as deprecated sugar until migration retires them; never author new uses). The `ui.template` set stays frozen at `hello | generic | clock`: it is required by the validator but ignored by the renderer, which always shows bundle UI plus live state plus action forms. Pick the closest frozen value and put anything visual in the bundle.

`act()` applies to every app: bundle UI and MCP calls share the one `act()` handler and the same state. An unknown action returns `{ ok: false, error }` and writes nothing. Re-adding an id with `add_app` overwrites the definition, keeps registry order, pins, hidden flags, homepage placement, and recent entries, and resets state to `initial`.

The shell hosts a bundle inside the existing chrome (title, nav, inlined theme, single `<style>`, zero external assets). It inlines the `index.html` entry into the app panel (or overlay for `modal` placement), inlines referenced bundle-relative `<script src>` and stylesheet `<link>` content, drops dangling references that match no bundle file instead of fetching them, and appends any extra bundled `.js`/`.css` files as inline blocks. A bundle that cannot be displayed degrades to the normal chrome plus an explanatory message and a working close or back control, never a blank page. Unknown ids still return 404.

Scribe posture for bundle content: vanilla ES2019 only (no `?.`, no `??`, no `replaceAll`, no `Array.at`), system fonts only, zero emojis, all CSS and JS inlined, no external stylesheets or scripts. Guarded `fetch` of the same-origin GET action with `?format=json` is allowed where `fetch` and JSON parsing exist; never require timers, WebSockets, client-side routing, frameworks, animations, auto-refresh, or polling. Large tap targets and high-contrast black-on-white still apply. Full device findings: `scribe-limitations.md`.

Trust boundary: a bundle runs its own JS in the page. It has no direct storage access and no access to other apps or the registry; every persistence goes through `act()` (shell GET forms, or bundle `fetch` of the same-origin GET action URL with `?format=json`, preserving the `k` code when present, with full-navigation fallback where `fetch`/JSON parsing are absent). Keep bundles toy-scoped and self-contained; anything needing shared validated state belongs in `set`/`append` actions.

Decision rule: one shape for everything. Write the bundle for what the eye sees, the state schema for what must persist, and `set`/`append` actions for every mutation. Never add a `kind` field, a template branch, or a new operator.

### Complete example

Save this as `/tmp/preview-counter.json` (a scratch path outside the repo; the commands below run from `pkg/`):

```json
{
  "id": "preview-counter",
  "name": "Preview Counter",
  "label": "Counter",
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
    "template": "hello",
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
      "effect": { "op": "set", "field": "count", "fromArg": "value" }
    },
    "reset_count": {
      "description": "Reset to zero.",
      "effect": { "op": "set", "field": "count", "value": 0 }
    }
  }
}
```

### Validation

`add_app` validates before writing. On failure it returns `{ ok: false, error }` and writes nothing. Common errors:

- `definition.id must match ^[a-z0-9][a-z0-9-]{0,63}$`
- `definition.kind "..." is retired; use the unified shape: meta + bundle { entry, files } + stateSchema + actions`
- `definition.bundle.entry must be "index.html"` (plus bad-path, non-string-file, and 256 KiB cap errors)
- `definition.ui.template must be hello, generic, or clock` (frozen; required but render-ignored)
- `definition.ui.actions references unknown action "..."`
- `stateSchema.initial key "..." has no field declaration`
- `actions.<name>.effect.field must name a declared state field`
- `actions.<name>.effect append target must be an array field`
- `actions.<name>.effect.op must be set, append, increment, toggle, or reset`

`add_app` on an existing `id` overwrites the definition and resets state to `initial`. It is not a merge. Export first if you need the old state.

`act` validates args and the resulting state before a single write. A bad action returns `{ ok: false, error }` and leaves state unchanged.

`ui.actions` entries are only `{ action, label }`; the current shell renders one no-argument button per entry. An action with `args` is callable through MCP `act(id, action, args)` but has no generated UI form yet.

## Add to the hosted OS (real running app)

The package is `@hypercubed/kody-os`; this install is hosted at `https://hypercubed.kody.run/kody-os`. MCP exports are not gated by the Scribe access code.

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

   Or open `https://hypercubed.kody.run/kody-os/apps` with the existing access code/bookmark. The app appears in All apps immediately.

4. Optional: add it to the home dashboard. Open Apps, choose **Edit**, then **Add to home**. New apps do not appear on the home dashboard automatically. The home page shows homepage apps as live widgets; the widget up/down buttons reorder them. **Pin** is a separate Apps-page section and does not place an app on the home dashboard.

## Add to the local preview (`kody dev`)

The local preview serves the working tree with `kody dev` (default target `mock`). Its mock storage is separate from the hosted store. A fresh mock store is unconfigured, so the shell is locked until you set a local access code.

Local registry writes use a small file helper. Create `pkg/scripts/registry.ts` once:

```ts
import { add_app, list_apps, remove_app, set_access_code } from '../src/index.ts'

type Input =
  | { op: 'add'; definition: Parameters<typeof add_app>[0] }
  | { op: 'list' }
  | { op: 'remove'; id: string }
  | { op: 'set-code'; code: string }

export default async function main(input: Input) {
  if (input.op === 'add') return await add_app(input.definition)
  if (input.op === 'remove') return await remove_app(input.id)
  if (input.op === 'set-code') return await set_access_code(input.code)
  return await list_apps()
}
```

Use `--file`, not `--code`, for local writes. `--file` from `pkg/` uses the package bucket `local:kody-os`, the same bucket `kody dev` reads. `--code` with `kody:@...` uses the `local-default` mock bucket and will not appear in the preview.

1. Stop `kody dev` if it is running. A running preview keeps its mock state in memory; start it after the writes, or restart it afterward.
2. Set a local access code and add the app:

   ```bash
   cd pkg
   kody execute --target mock --file scripts/registry.ts \
     --params '{"op":"set-code","code":"local-dev-code-123456"}'

   DEF="$(cat /tmp/preview-counter.json)"
   kody execute --target mock --file scripts/registry.ts \
     --params "{\"op\":\"add\",\"definition\":$DEF}"
   ```

   `set-code` returns the normalized code (for example `local-devco-de123-456`). Either that value or the original input unlocks the shell.

3. Start the preview:

   ```bash
   kody dev
   ```

   Open the printed URL with `?k=local-dev-code-123456`. Start without an explicit `--port` so `kody dev fetch` can attach to it.

4. Verify:

   ```bash
   kody dev fetch '/apps?k=local-dev-code-123456'
   kody dev fetch '/apps/preview-counter?k=local-dev-code-123456'
   ```

   Or use the registry helper:

   ```bash
   kody execute --target mock --file scripts/registry.ts --params '{"op":"list"}'
   ```

5. Reset the local mock store when you want a clean install. Stop the preview first:

   ```bash
   kody execute --target mock --reset-storage --file scripts/registry.ts --params '{"op":"list"}'
   ```

   This wipes the local apps and the local access code without starting a server. Re-run `set-code` and the add, then start `kody dev`.

The local mock session defaults to `default`; set `KODY_MOCK_SESSION_ID` to use a different scratch session. The store is in the CLI user cache (Linux: `~/.cache/kody/mock-sessions/<session>/state.json`).

## Verify, homepage, export, remove

- **Read state:** `get_app_state(id)` returns the same state the app page renders.
- **Run an action:** `act(id, action, args?)` returns `{ ok: true, state }` or `{ ok: false, error }`.
- **App page:** `/apps/<id>` shows the description, every state field, and the declared action forms. Forms submit as GET (`/apps/<id>?action=<name>`); the shell adds the access code as a hidden `k` field on the bookmark path. In capable browsers the same GET is replayed with `?format=json`, and only the changed `data-field`/`data-value` nodes update in place; without working `fetch`/JSON parsing, the form submits natively and the server 303-redirects. App authors do nothing special: the renderer adds `form.app-action`, `section[data-app-id]`, and `data-field`/`data-value` hooks automatically.
- **Homepage:** Apps → Edit → **Add to home** / **Remove from home**. The home dashboard shows live widgets in homepage order. Homepage placement is a UI action in the current shell; there is no `set_home` MCP export.
- **Pin and hide:** Apps → Edit → **Pin** / **Hide**. Hide is reversible. The UI has no Remove control.
- **Export:** `export_app(id)` returns `{ format: "kody-os-app/2", exportedAt, definition, state }`. `import_app(payload, undefined, { overwrite: true })` restores it into the other target. Use this to copy between hosted and local, which have separate stores.
- **Remove:** `remove_app(id)` deletes the definition, state, registry entry, and pinned/hidden/recent/homepage references. Unknown ids return `{ ok: false, error }` and write nothing. Removal is MCP-only; the browser UI only hides.

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
| `kody-os.auth.code_hash` | SHA-256 hash of the device access code. |

The hosted and local stores are independent. Adding to one does not add to the other. The access code is never stored or logged raw.

## Troubleshooting

- **`{ ok: false, error }` from `add_app`:** validation failed and nothing was written. Fix the named field and retry.
- **App is on Apps but not the home dashboard:** add it with Apps → Edit → **Add to home**. New apps are not automatically homepage widgets.
- **App added to hosted but not local (or the reverse):** the stores are separate. Run the same add against the other target; use `list_apps()` in the target you are checking.
- **Local preview shows the locked 404:** a fresh mock store has no access code. Run `set-code` before starting `kody dev`, then open `?k=<code>`. The one-time `POST /__access-code` route also works on localhost.
- **Local add is missing in a running preview:** `kody dev` loaded the mock store at startup. Run the registry write before starting it, or stop and restart it. `kody dev fetch` attaches only to a server started without an explicit `--port`.
- **`kody dev --target prod` throws `local:<kody.id>`:** it does not provide the hosted `packageStorage()`. Use the hosted MCP/execute path for the real app.
- **`--invoke` with `add_app` fails:** this package exports only the root, so there is no `/add_app` subpath. Use the `--code`/`--file` wrappers shown here.
- **An action with args has no button:** the current shell renders only no-arg buttons. Call `act(id, action, args)` through MCP.
- **Increment flashes a full reload:** expected on browsers without working `fetch`/JSON parsing, or when the fast-path request fails. Capable browsers patch the changed fields in place; the no-JS navigation path always still works.
- **`format` appears in a request:** the UI/server fast path uses `?format=json` to ask for `ActResult` JSON. It is stripped before `actFromForm`, so it never becomes an action arg.
- **Re-adding reset the state:** `add_app` overwrites an existing id and restores `initial`. Export before replacing if you need the old state.
- **No remove button in the UI:** removal is MCP-only by design. Use `remove_app`; use Hide for a reversible action.
- **Access code:** the hosted browser needs the existing bookmark/`?k=` code; MCP exports are not gated. Do not put the code in a definition, export, or log. The local code is a development code, not the hosted one.

## See also

- [Agent guide](../AGENTS.md)
- [App-layer integration](../src/apps/INTEGRATION.md)
- [Package README](../README.md)
- [Scribe limitations](scribe-limitations.md)
- Repo-only working spec: `docs/app-definition.md` (not included in the published package).
