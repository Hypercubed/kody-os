# kody-os plugin definition

## Status

**Draft for review. Exploration only — no implementation.**

This document is the output of the plugin exploration plan
(`~/workspace/your_files/kody-os-plugin-exploration-plan/`), following its
five steps in order. Nothing in it is built, extracted, installed, or
published. The next step after review is an OpenSpec change for the
plugin model itself; any plugin extraction (feed proxy first) is a
separate, later change specified on its own.

**Sources checked:** GitHub `Hypercubed/kody-os` main `1525bad`
(v4.1.11, build 46), read 2026-11-09/10. OpenSpec changes on main:
`compatible-catalog`, `install-registry-race`, `store-recipe-prompt`,
`store-row-agent-prompts`, `generic-rss-feed`, `handoff-board`,
`email-client`, `agent-app-authoring`, `catalog-robustness-fixes`.

**Caveat — inventory source:** the inventory in Step 1 was supposed to
run against the live tree on `be-quite-900`
(`/home/jmh/workspace/kody/kody-os`). That context is **paused** since
2026-11-08 05:13:47Z (by hypercubed, no reason recorded; still paused
2026-11-09 19:22 MST) and takes no runs — a pinned run failed with
`no_execution_context_available`, and the context must not be resumed
remotely while the user is working on the PC. The inventory below is
therefore from public GitHub main, not the local tree. It does not
cover any uncommitted work on `be-quite-900`, including the SPA shell
POC branch. Re-verify the inventory against the local tree (git status
/ branch first) once the context is resumed.

**Out of scope (from the plan):** building, extracting, or publishing
any plugin; changing the data-app install path or the catalog;
deciding the public/private package split; picking a framework.

## The definition

> A plugin is code that ships inside the kody-os package, lives in its
> own segregated directory, and is reached by the shell only through a
> declared interface. It declares what it needs; the shell does not
> reach into its internals, and it does not reach into the shell's.

A plugin is the answer to one question: **the feature needs server
power, but not every installation needs the feature.** Server power
means a `kody:` import, a server route, a secret, or a declared
capability. If no installation needs it, it does not belong in the
shell core. If every installation needs it, it is core. Everything
else is a plugin candidate.

---

## Step 1 — Inventory of the shell

Source: `pkg/` on main `1525bad`. No file in `pkg/src` mentions the
word "plugin" today. The shell has exactly four declared capability
kinds for data apps (`AppCapabilities` in `pkg/src/apps/types.ts`):
`feeds`, `proxy`, `manageApps`, `theme`. Everything else a data app
does is HTML/JS plus its own synced state.

### Core — stays in the shell no matter what

| Module | What it does | Consumers | Why core |
|---|---|---|---|
| `pkg/src/app.ts` (1,225 lines) | Fetch handler + dispatch; `shellChrome`; theme merge; GET-action rule | Every request | It *is* the shell: routing, page chrome, and the entry point. A plugin failure must never take it down, so it cannot live in a plugin. |
| `pkg/src/index.ts` | MCP export surface (`list_apps`, `get_app_state`, `act`, `add_app`, `remove_app`, `export_app`, `list_catalog`, `get_catalog_definition`, `install_from_catalog`, `update_from_catalog`, launcher state, theme, backup/restore, import/export install) | Agents, Kody execute, `kody:@hypercubed/kody-os` importers | The agent contract. Plugins are reached *through* this surface or the fetch handler, never around it. |
| `pkg/src/apps/registry.ts` | App registry, `act()` engine, install gates (`minPackageVersion`, schema floor 3, supported `[3,4,5]`), `/manage/*` API, install snapshots, backup/restore | Shell, Store, agents | Registry + install + act are the system itself. The install-registry-race change derives the installed list from definition keys instead of the shared registry value — that derivation stays core. |
| `pkg/src/apps/storage.ts` | `KeyStore` (get/set/delete only), `resolveStore`, key scheme | Every server module | The storage abstraction. **Gap, see below:** it exposes no `list()` and no `sql()`, although `packageStorage()` itself provides both (Kody docs, Nov 9). |
| `pkg/src/apps/definition.ts` | Definition validation, bundle assembly, capability sanitising, fingerprint | `add_app`, Store | Validation is the trust boundary for everything installed as data. A plugin must not be able to widen it. |
| `pkg/src/apps/types.ts` | `AppDefinition`, `AppCapabilities`, state/action schema (versions 3–5) | Everything | The contract data apps and the shell agree on. |
| `pkg/src/apps/forms.ts` | `actFromForm` (GET/POST form → `act()`) | Fetch handler | The action path. |
| `pkg/src/apps/client.ts` | Server rendering: app panels, widgets, dashboard, Apps Edit, empty-help | Fetch handler | Page rendering. |
| `pkg/src/shell-css.ts`, `shell-theme.ts`, `shell-pages.ts` | Page chrome CSS, theme override (`kody-os.shell.theme`), Help/About pages | Fetch handler | Shell-owned presentation and one shell-owned setting. |
| `pkg/src/client/index.ts`, `pkg/src/bridge/bridge.js` | Browser enhancement, `window.KodyBridge` (state store, dispatch queue, rebase) | Bundles | The bridge owns state; no plugin replaces it. |
| `/manage/*` API (`GET /manage/rows|install|update|restore|remove`, gated by `capabilities.manageApps`) | App management for the Store | App Store only | The management machinery is core; the *flag* is a capability. A plugin must not gain its own management API. |
| `/theme/:app` route (`GET`, gated by `capabilities.theme` view/set) | Shell theme read/set/reset | Settings app only | Shell-owned setting, one key, no upstream, no secret. Straddles the line (it is a capability like `feeds`) but stays core: it mutates shell state directly, and no plugin needs to own it. |

### Plugin candidates — server work only some installations need

| Module | What it does | Consumers | Why a plugin candidate |
|---|---|---|---|
| `pkg/src/feeds.ts` — `serveFeed` (`GET /feed/:app/:name`) + `serveProxy` (`GET /proxy/:app/:name`) | Allowlisted upstream fetch + `packageStorage` cache, served same-origin. HTTPS only, 8 s timeout, TTL 60–86400 s, max 64 KiB default (1024–262144), stale-on-error, never takes a URL from the request — only a declared feed/proxy name. Cache keys `kody-os.feeds.cache.*`, `kody-os.proxy.cache.*`. | `feeds`: News (6 feeds), xkcd (1), hoodie-weather (1, `default`). `proxy`: App Store only (`catalog`). | Self-contained; own trust rules (allowlist from the app's declared capabilities); own behaviour (TTL, stale-on-error); specific consumers, not the shell as a whole. The cleanest extraction. |
| `pkg/src/apps/remote-catalog.ts` | Remote catalog fetch: manifest + definitions + recipes from a declared base. HTTPS-only + loopback `http` dev override (`KODY_CATALOG_BASE`), 8 s timeout, per-payload size caps (definition ≥ 256 KiB — the feed proxy's 64 KiB cap must not apply), 30 s manifest TTL, cached fallback labelled stale. Base precedence: explicit > dev override > installed Store's declared base. | App Store (via `list_catalog`, `install_from_catalog`, `update_from_catalog`, `get_store_rows`); agents | Server work done on behalf of one app (the Store), with its own trust rules and its own failure mode. Second extraction candidate, after the feed proxy. Note: it is also the module the compatible-catalog resolver plugin would sit next to — resolver *uses* it, it does not *become* the resolver. |
| `pkg/src/email.ts` — **does not exist yet** (`openspec/changes/email-client`, spec only) | Live Kody platform mail (list/search/open/archive/delete/reply) via declared `kody.app.capabilities`, modelled on `feeds.ts`, served to one declared app at a time. Today only the agent-synced viewer exists (stale, capped by state sizes, cannot act). | No app yet | Needs `kody:` email capabilities + a secret-adjacent authority + its own routes. By the dividing test it is a plugin, not a shell addition — and it is the case that would most bloat the core if done there. |
| Compatible-catalog resolver — **does not exist yet** (`openspec/changes/compatible-catalog`, spec only, gated behind this spec) | Reads `catalog/releases.json` from `main`, picks the highest snapshot whose required shell ≤ running shell, keeps a durable last-good snapshot of the resolved catalog. Tags = mechanism, SHA = fetch identity. | App Store | Defined in its proposal as a user-land plugin by design. It is also the first plugin whose *absence* must be a clean no-op: without it the Store reads `main` exactly as today. |

### Data apps — not plugins, not core

The 18 catalog apps are data: definition + bundle + state, installed
without a publish, changed only via `act()`. Only four declare any
capability at all:

- **News, xkcd, hoodie-weather** — declare `feeds` (8 feeds total).
  They consume the feed proxy; they do not implement it.
- **App Store** — declares `proxy: [catalog]` + `manageApps: true`.
  It consumes the catalog proxy and the management API.
- **Settings** — declares `theme: { view, set }`. It consumes the
  theme route.
- The other 13 (arrow-game, calculator, calendar, cellular-playground,
  clock, counter, daily-feed, eight-ball, generic-feed, link-drop,
  mac-puzzle, probe, three-bit-art) declare no capabilities.

Two nuances the inventory surfaced:

1. **daily-feed and generic-feed do not use the feed proxy.**
   Their content is pushed into state by an agent via `act()`
   (`set_latest` / `set_feed`); generic-feed's live RSS fetch needs
   the spec'd shell change (per-install `feedUrl` + `GET
   /user-feed/<app>`). A feed-proxy plugin must keep serving the
   three declared-feed apps, and generic-feed's future live fetch is
   a *consumer* of the plugin, not a second proxy.
2. **The 64 KiB proxy cap is a known trap.** `remote-catalog.ts`
   already documents that the feed proxy's 64 KiB cap must not apply
   to definitions (bundle cap 256 KiB). A feed-proxy plugin that
   hard-codes one cap for all its routes would reintroduce it.

### Not shell code

- `pkg/scripts/*` (`act.ts`, `add-app.ts`, `catalog.ts`,
  `registry.ts`) — local dev tools, not shipped in the package.
- `catalog/*` — data, not code in the package (see above).
- `openspec/*`, `tests/*`, `scripts/*` — spec and harness, not
  shipped.

### Storage keys in play (shared bucket, one `packageStorage`)

| Prefix / key | Owner |
|---|---|
| `kody-os.apps.def.<id>`, `kody-os.apps.state.<id>` | Registry (per-app definition + state) |
| `kody-os.apps.registry` | Registry list — being retired by install-registry-race (derived list) |
| `kody-os.apps.pinned`, `.hidden`, `.recent`, `.homepage` | Launcher lists (still shared arrays; same race, out of scope for that change) |
| `kody-os.apps.snapshot.<id>` | Install snapshots |
| `kody-os.backups.<name>`, `kody-os.backups.index` | Backups |
| `kody-os.shell.theme` | Shell theme override |
| `kody-os.feeds.cache.<app>.<name>` | Feed proxy cache |
| `kody-os.proxy.cache.<app>.<name>` | Generic proxy cache |

There is no per-plugin storage and no per-key access control in Kody:
`packageStorage()` is one bucket per user × package. Plugin storage
segregation is therefore **logical only** — a prefix plus review —
never physical. Any definition that claims otherwise is wrong.

---

## Step 2 — Reference models (brief)

Only ideas that map onto Kody's constraints were taken. Kody gives
the shell: a static module graph (imports resolved at publish), one
storage bucket, no process isolation, no dynamic loading of a
package by a name read from data (see Step 4, Handoff case). Anything
below that depends on what Kody does not provide is marked as such.

| System | Idea borrowed | Where it breaks on Kody |
|---|---|---|
| **Browser extensions (MV3)** | Manifest declares permissions; the browser enforces them; an extension that exceeds its manifest fails. | Kody enforces no per-plugin permissions. A plugin's manifest is a declaration the *shell and reviewers* enforce, not the platform. Do not write as if Kody will reject an overreaching plugin — it will not. |
| **VS Code extensions** | `contributes` points + activation events: an extension loads only when its contribution is used; the core ships no extension code. | No lazy activation exists in Kody. A plugin's code is in the package bundle whether or not it is used; "activation" here means the shell *routes* to it, not that it loads. |
| **Obsidian plugins** | `manifest.json` + `main.js` in one folder per plugin; community plugins are plainly third-party code the user chose to trust. | Obsidian plugins run with full app access and the trust model is "you installed it". Same here — a plugin is trusted code. The difference is Obsidian can disable one without republishing the app; kody-os cannot (see Lifecycle). |
| **WordPress child themes / plugins** | A child layer overrides without forking the parent; the parent stays updatable. | Kody has no layering: a fork copies source, and there is no overlay between base and private layer. Plugins are the candidate for that missing layer *inside one package*, not a replacement for forks. |
| **Docker / Nix layers** | Immutable layers, each with a declared content; a layer is added or removed as a unit. | A plugin *is* added/removed as a unit (one directory + one registry line), which is the part that maps. Content-addressing and layer reuse do not exist here. |
| **Emacs / Doom modules** | Private config layer declared separately from the distribution; the distribution never contains the private layer. | The closest analogy for public/private: a private plugin lives only in private source, never in the public tree. The mechanism is different (separate package source, not a config layer) but the rule is the same: where it lives decides what travels. |

What was **not** taken: dynamic plugin loading (no Kody support —
imports must be in the module graph), per-plugin sandboxing (same
isolate as the shell), a dependency graph / package manager (explicitly
out of scope; compatible-catalog's non-goals say the same), and
auto-install (plugin install is always agent-assisted via a recipe).

---

## Step 3 — Draft plugin definition

### Segregation rules

**Source.** Plugin code lives in `pkg/plugins/<id>/`, one directory
per plugin, separate from `pkg/src/` (shell core). A plugin directory
contains its code, its `manifest.json`, and its own README/recipe.
Nothing in `pkg/src/` may import from `pkg/plugins/` except the
static registry (below). A plugin may import:

- its own files;
- shared, side-effect-free helpers it vendors itself;
- `kody:runtime` (literal import only — `packageStorage`,
  `packageContext`);
- the `kody:` imports its manifest declares (see Manifest).

A plugin **must not** import from `pkg/src/apps/*` (registry,
storage internals, definition validation), from `pkg/src/app.ts`,
or from another plugin's directory. It must not reach into shell
state except through the interface the shell offers it (route
context + its storage prefix). The shell, symmetrically, must not
reach into a plugin's internals: it calls the plugin's declared
entry points and reads nothing else.

**Interface.** The only contract between shell and plugin is the
manifest plus the static registry. No other coupling is allowed.

**State.** A plugin owns exactly one storage prefix:
`kody-os.plugins.<id>.` — all its keys live under it, including its
cache (`kody-os.plugins.<id>.cache.<name>`). It must not read or
write `kody-os.apps.*`, `kody-os.shell.*`, or another plugin's
prefix. Enforcement is by review and by the registry check below,
not by the platform (Kody has no per-key ACL — see Step 1).

**Visibility.** Where the plugin lives decides what travels, not a
setting. A plugin in public source (`pkg/plugins/<id>/` on GitHub
main) travels to every fork. A plugin present only in private source
stays private. There is no "private flag" on a public plugin, and no
mechanism that strips a plugin at fork time. If it must never appear
in public, it must never be committed to the public tree.

### Manifest shape (draft, `pkg/plugins/<id>/manifest.json`)

```json
{
  "id": "feed-proxy",
  "name": "Feed proxy",
  "version": "1.0.0",
  "minShellVersion": "5.0.0",
  "schemaVersion": 1,
  "entry": "./index.ts",
  "routes": [
    { "name": "serve-feed", "path": "feed", "method": "GET" },
    { "name": "serve-proxy", "path": "proxy", "method": "GET" }
  ],
  "kodyImports": [],
  "capabilities": ["fetch:https"],
  "secrets": [],
  "provides": ["feeds", "proxy"],
  "storagePrefix": "kody-os.plugins.feed-proxy.",
  "visibility": "public"
}
```

| Field | Meaning |
|---|---|
| `id` | Slug, `^[a-z0-9][a-z0-9-]{0,63}$` — same rule as app ids. Identity for routes, storage, registry. |
| `name`, `version` | Human name; semver `MAJOR.MINOR.PATCH`. |
| `minShellVersion` | Minimum shell (package) version the plugin works with. Same format as an app's `minPackageVersion`. The shell refuses to register a plugin whose minimum is above the running shell. |
| `schemaVersion` | Manifest format version, starting at 1. A shell that does not understand the manifest version refuses the plugin. |
| `entry` | Plugin entry point, relative to its directory. |
| `routes` | Route names the plugin serves. Each is one `{ name, path, method }`. The shell maps them under `/plugin/<id>/<path>` (see Registration). A plugin declares route *names*, never full paths and never URLs. |
| `kodyImports` | Every `kody:` import the plugin uses, e.g. `["kody:runtime"]` or `["kody:@hypercubed/handoff"]`. Anything not listed is forbidden; the shell never grants an unlisted import. |
| `capabilities` | What the plugin may do, in platform terms the shell can check: `fetch:https` (upstream fetch, HTTPS only), plus others only as the spec adds them. |
| `secrets` | Named secrets the plugin may use, e.g. `["BraveSearch"]`. Empty means none. How a secret binds to a plugin (package-level secret vs per-plugin grant) is **undecided** — see Open questions. |
| `provides` | Capability surfaces the plugin implements for data apps, e.g. `["feeds", "proxy"]`. This is how a plugin backs a capability apps already declare, without changing any app definition. |
| `storagePrefix` | Must equal `kody-os.plugins.<id>.`. Declared so the registry check can verify it mechanically. |
| `visibility` | `"public"` or `"private"`. Informational only — it records intent. It enforces nothing; where the code lives enforces it. |

### Registration — static registry, not discovery

The shell discovers plugins from **one static registry file in
source**, e.g. `pkg/src/plugins.ts`, which lists installed plugins
by id with their manifest paths and imports their entry points:

```ts
// Registry (illustrative shape, not code):
// - one entry per installed plugin
// - the shell imports each entry point statically
// - removing a plugin = delete its directory + delete its line
```

Why static, not auto-discovery from storage or a directory scan:

1. Kody's bundler resolves a static module graph at publish. There
   is no runtime directory scan in the Worker, and no proven way to
   import a package by a name read from storage (see Step 4,
   Handoff case). The only proven cross-package shape is a static
   import in the module graph (handoff-board's `kody.dependencies`
   in `package.json`).
2. A static registry is reviewable in git: installing a plugin is a
   visible diff (new directory + one registry line), and a fork
   absorbs it like any other source change.
3. The shell can check the registry at publish/build time: manifest
   `id` matches directory, `storagePrefix` matches the rule,
   `minShellVersion` is parseable, routes do not collide (below).

**Route namespacing.** Plugin routes live under
`/plugin/<plugin-id>/<route-path>`, e.g.
`/plugin/feed-proxy/feed`. Rules:

- Shell routes take precedence. A plugin may not register a path
  that collides with `/`, `/apps`, `/help`, `/about`, `/manage`,
  `/feed`, `/proxy`, `/theme`, or another plugin's
  `/plugin/<other-id>/` prefix. A collision is a registry error:
  the plugin is not registered.
- A plugin route never takes a URL, a message id, or an address
  from the request unless its manifest declares that parameter and
  the shell validates it. The feed proxy's discipline is the
  template: the request names a declared entry; the entry supplies
  the upstream URL.
- The existing `/feed/:app/:name` and `/proxy/:app/:name` routes
  stay where they are until the feed proxy is extracted. On
  extraction, the plugin *provides* `feeds`/`proxy` and the shell
  dispatches those routes to it — the route shape apps use does not
  change. New plugins use `/plugin/<id>/…` from the start.

**What a plugin exposes to apps vs to the shell.** Two surfaces,
deliberately different:

- *To the shell:* the manifest + entry points + routes. The shell
  calls the plugin; the plugin never calls the shell except through
  its route context (request, its storage prefix, declared
  capabilities).
- *To apps:* only what the plugin `provides`. A data app declares
  `capabilities.feeds` exactly as today; whether the feed proxy is
  shell code or a plugin is invisible to the app. A plugin must not
  invent a new capability surface for apps without a spec change to
  `AppCapabilities` — that surface is core-owned.

### Lifecycle

| Step | What it consists of | Cost |
|---|---|---|
| **Install** | (1) Copy the plugin source into `pkg/plugins/<id>/` from its recipe source (repo + ref — see Agent install request). (2) Add its line to the static registry. (3) Check: manifest validates, routes do not collide, `minShellVersion` ≤ running shell, storage prefix matches, no forbidden imports (grep the plugin dir for `pkg/src/apps`, `pkg/src/app.ts`, other plugins, and unlisted `kody:` imports). (4) Publish the *user's own* package. | A publish. Unlike a data app, which installs with a registry write and no publish. |
| **Update** | Same as install, with the new version: replace the directory, re-check, publish. State under the plugin's prefix is preserved across updates. A plugin update never touches app state. | A publish. |
| **Disable** | Remove its line from the registry (directory may stay or go), publish. Its routes become 404s ("not installed"); its stored data is kept. Re-enabling is adding the line back + publish. | A publish. There is no runtime toggle — Kody has no per-plugin switch. |
| **Remove** | Delete the directory + registry line, publish. Stored data under its prefix is deleted only by an explicit, separate step (agent or shell cleanup with confirmation) — removal alone keeps data, so a mistaken removal is recoverable by reinstalling. **Undecided:** whether removal should delete data by default — see Open questions. | A publish + a deliberate data decision. |
| **Shell update under a plugin** | A shell update that raises the package version never breaks a plugin whose `minShellVersion` is met. A plugin whose minimum is above the running shell is skipped at registration (its routes 404) and the shell otherwise runs normally. | None at install time; the failure mode is a missing plugin, not a broken shell. |

**Verification that a plugin landed (all must pass before the work
is called done):**

1. The plugin directory and registry line exist in the *intended*
   package's source (package name/id named in the request — see
   below), not in another package and not only in a local checkout.
2. The manifest validates and the registry check passes.
3. The plugin's route responds for a declared entry and 404s for
   an undeclared one.
4. The shell's own pages (Home, Apps, one app page) still render.
5. For a private plugin: the plugin's files appear in no public
   source (no GitHub commit, no public package listing).
6. A failing plugin degrades to its route's error, never to a
   shell-wide failure (see Failure isolation).

### Failure isolation

- **Per-request:** the shell wraps each plugin route call in
  try/catch. A plugin throw, timeout, or bad response becomes that
  route's error (404/502 with the plugin's honest message), never a
  shell 500 and never a broken Home/Apps page.
- **Per-plugin:** a plugin that fails its registry check (bad
  manifest, route collision, unmet `minShellVersion`) is skipped:
  its routes 404 as "not installed". Other plugins and the shell
  are unaffected.
- **Import time — the honest limit:** a plugin is code in the same
  package isolate as the shell. If a plugin module throws *at
  import time*, it can take down the package, because there is no
  per-plugin process or sandbox in Kody. The mitigation is to
  import plugin entry points lazily inside the route handler
  (a literal, build-time-resolvable import — the same shape as the
  shell's existing literal dynamic `import('kody:runtime')`), so a
  broken plugin fails when its route is hit, not on every request.
  **This lazy-import shape is to be verified in the first
  extraction, not claimed here.** Until then, the definition states
  the limit plainly: failure isolation is per-request, not
  per-process, and a bad plugin publish is repaired by republishing
  without it.

### Agent install request

A plugin install request must name three things, or it is ambiguous
and must not be acted on:

1. **The plugin** — id + source (repo + ref/tag/SHA, or recipe path).
2. **The target package** — package name and id, e.g.
   `@hypercubed/kody-os` (`a7c276b6-…`) vs
   `@hypercubed/kody-os-demo` (`03d6b449-…`). Never "my kody-os".
3. **The visibility** — public (goes in the public tree) or
   private-only (must not exist in GitHub or the public package).

Template: *"Install plugin `<id>` from `<repo>@<ref>` into package
`<name>` (`<package_id>`), visibility `<public|private-only>`."*
A request that omits the target package or the visibility is sent
back for clarification. This is the same rule the plan set for the
handoff case, applied to every plugin.

### The decision test (revised)

Apply to any new feature, in this order:

1. **Needed by the system itself to run at all?** Registry,
   dispatch, app management, `act()`, storage, definition
   validation, theme, bridge → **core**.
2. **Needs server power?** A `kody:` import, a server route, a
   secret, or a declared capability → **plugin**.
3. **Just interface and its own state?** HTML/JS reading only its
   own synced state → **data app**.

Hard cases (each either sharpens the test or is a recorded
exception — see Step 4):

- A feature needing one small server call → still a plugin; there
  is no "small enough to inline in the shell" exception, or the
  core grows one call at a time. (If the call is *also* needed by
  the shell itself, it is core.)
- A capability several plugins would want to share → the shared
  piece is core only if the shell itself needs it; otherwise the
  first plugin owns it and the second duplicates it or waits for a
  spec that extracts it as core. No plugin-to-plugin dependencies
  in v1.
- A data app that later grows a server need → it gains a plugin
  that *provides* the capability it declares; the app itself stays
  a data app. The app does not become a plugin.
- A shell module that straddles core and plugin (theme) → stays
  core when it mutates shell-owned state directly; the capability
  flag only gates *who may call it*.

---

## Step 4 — Stress test

### 1. Feed proxy (`pkg/src/feeds.ts` → plugin `feed-proxy`)

Walked through the draft end to end:

- **Source:** `pkg/plugins/feed-proxy/` with `index.ts`,
  `manifest.json`, README/recipe. Moves `serveFeed` + `serveProxy`
  and their cache-prefix constants out of `pkg/src/`.
- **Interface:** manifest declares `provides: ["feeds", "proxy"]`,
  routes `serve-feed`/`serve-proxy`, `kodyImports:
  ["kody:runtime"]` (for `packageStorage` only), `capabilities:
  ["fetch:https"]`, no secrets. The shell keeps dispatching
  `/feed/:app/:name` and `/proxy/:app/:name` to it, so News, xkcd,
  hoodie-weather, and the App Store see no change.
- **State:** cache moves to `kody-os.plugins.feed-proxy.cache.*`.
  Old keys `kody-os.feeds.cache.*` / `kody-os.proxy.cache.*` are
  abandoned (read once, never written) — a cold cache after the
  move, not a migration. **Ambiguity found:** whether the first
  extraction should migrate old cache entries or accept a cold
  cache. Recommendation: accept a cold cache (cache entries are
  regenerable by definition); record the decision in the extraction
  spec.
- **Lifecycle:** install = copy + registry line + check + publish.
  Disable = registry line out; feeds 404 as "not installed" and
  the three feed apps degrade to their existing no-feed state.
  Remove = directory out; cache data kept until the explicit
  cleanup step.
- **Failure:** upstream timeout → stale-on-error (existing
  behaviour, preserved inside the plugin). Plugin throw → route
  502, shell pages unaffected.
- **Verdict:** the definition describes the feed proxy cleanly.
  It is the right first extraction.

### 2. Catalog proxy (`pkg/src/apps/remote-catalog.ts` → plugin `catalog-proxy`)

- **Source/interface:** `pkg/plugins/catalog-proxy/`, manifest
  `provides: ["catalog"]`, routes for manifest/definition/recipe
  fetch. `kodyImports: ["kody:runtime"]`, `capabilities:
  ["fetch:https"]`.
- **Straddle found:** `remote-catalog.ts` is not only a fetcher.
  It also owns base-precedence rules (explicit > dev override >
  installed Store base), manifest validation, and the 30 s
  in-memory manifest cache — and the registry (`list_apps`,
  `get_store_rows`, `install_from_catalog`) calls it directly.
  If the whole module moves, the registry's precedence logic moves
  with it and the shell loses the ability to resolve a catalog
  base when the plugin is absent. **Resolution:** split, don't
  move whole. The *fetch* (HTTPS, timeout, size caps, cache)
  becomes the plugin; the *precedence + validation + base
  resolution* stays core in the shell, calling the plugin's fetch
  when installed and failing honestly when it is not. This split
  must be written into the extraction spec — a whole-module move
  would break the no-plugin fallback (Store reads `main` as today).
- **Second straddle:** the compatible-catalog resolver is a
  *separate* plugin that also reads catalogs. The catalog proxy
  fetches; the resolver *chooses which snapshot* to fetch from.
  Two plugins touching the same domain need the boundary stated:
  the resolver decides the base, the proxy fetches from it, the
  shell owns precedence. If that boundary is not written down, the
  two will grow into each other.
- **Verdict:** describable, but only as a split, not a whole-module
  move. Second extraction, after the feed proxy proves the model.

### 3. Private-only plugin (handoff case)

The handoff queue (`@hypercubed/handoff`, package
`dbee1a15-…`) must be readable from the user's private kody-os and
must never appear in the GitHub repo or the public package.

- **Source/visibility:** the plugin lives only in private source:
  `pkg/plugins/handoff/` exists in the private package's tree and
  nowhere in public. The static registry in the private package
  lists it; the public registry does not. Visibility is decided by
  where the code lives, exactly as the definition requires.
- **Interface:** manifest declares `kodyImports:
  ["kody:@hypercubed/handoff"]` and `provides: ["handoff"]`.
  The plugin's route serves the queue; a board app snapshots it
  into its own state via standard `act()` (the handoff-board
  proposal's pattern).
- **The dynamic-import trap (correction carried forward):** the
  shell today dynamically imports only the *literal*
  `kody:runtime` — for `packageContext` (`app.ts`) and for
  `packageStorage` (`storage.ts`). A registry that dynamically
  imports a package name read from a manifest, from storage, or
  from an app definition is **unproven**: the import likely needs
  to be static in the package module graph for provenance
  stamping and authority, and a browser bundle cannot do `kody:*`
  dynamic import at all (user correction, Nov 9). The definition
  therefore requires the **static registry with static imports**
  (Step 3): the handoff plugin's `kody:@hypercubed/handoff`
  import is a literal import in the private package's module
  graph, exactly like handoff-board's `kody.dependencies` entry.
  Any future proposal to load plugins by a data-driven dynamic
  import must prove it on its own — it is not part of this
  definition.
- **Fork consequence:** a fork of the public package does not get
  the handoff plugin (it was never in public source) and its
  registry does not list it. A fork that wants it must add it
  itself and repoint the import to its own handoff fork — the same
  rule as for any cross-package import.
- **Agent request:** must name the target package explicitly
  (`@hypercubed/kody-os`, private) and visibility `private-only`;
  a bare "install the handoff plugin" is refused for
  clarification.
- **Verdict:** describable, and the case that forced the static
  registry decision. It also answers the plan's question in part:
  plugins make the split *inside one package* cleaner, but they do
  not by themselves remove the need for a second package — the
  private package still exists as the place private plugins live.
  Whether that is enough to drop the two-package plan is a user
  decision, not a consequence of this definition.

### 4. Ordinary data app (counter)

- Declares no capabilities, reads only its own state, acts only
  via `act()`. The test classifies it as a data app at step 3.
  Nothing in the plugin definition touches it: no manifest, no
  registry line, no publish to install. **Verdict:** unchanged,
  as required.

### Hard cases

| Case | Outcome |
|---|---|
| Email client (spec'd, `openspec/changes/email-client`) | Plugin. Needs `kody:` email capabilities + a server route + its own trust rules (never takes a message/address from an untrusted source except as a validated route parameter). Its spec already models the module on `feeds.ts` — that modelling is now the plugin pattern. Open: how its capabilities are declared (`kody.app.capabilities` in `package.json` today) maps onto the plugin manifest. |
| Handoff-board (spec'd, `openspec/changes/handoff-board`) | **Recorded exception / straddle.** It puts the cross-package read path in `app.ts` (shell core) via a static `kody.dependencies` entry, with the board as a data app. By the dividing test (needs a `kody:` import) it points to *plugin*, but its proposal implements it in core. Resolution for review: either the board's read path becomes the handoff plugin's route (preferred — keeps core free of per-package reads), or the spec records a deliberate exception with a reason. It must not silently stay in core once plugins exist, or every future cross-package read will cite it as precedent. |
| One small server call | Plugin. No smallness exception (see decision test). |
| Two plugins wanting a shared helper | No plugin-to-plugin dependencies in v1. The shared piece is core only if the shell itself needs it; otherwise the first plugin owns it. If this hurts in practice, it is a v1.1 spec question, not a silent dependency. |
| Data app grows a server need | App stays a data app; a plugin provides the capability it declares. (Generic-feed's future live fetch is this case.) |
| Plugin depending on the shell version | Enforced by `minShellVersion` at registration; a mismatched plugin is skipped, not fatal. |
| Theme capability | Core (see Step 1). The capability flag gates callers; the machinery stays shell-owned. |

### Ambiguities and exceptions recorded

1. **Cache migration on extraction** — cold cache accepted
   (feed proxy); to be confirmed in the extraction spec.
2. **Catalog proxy split** — fetch moves, precedence/validation
   stays core. A whole-module move would break the no-plugin
   fallback.
3. **Resolver vs proxy boundary** — resolver chooses the base,
   proxy fetches from it, shell owns precedence. Must be written
   into both specs.
4. **Handoff-board in core** — exception or rework; must not be
   silent precedent.
5. **Secrets binding** — how a named secret attaches to a plugin
   is undecided (Open questions).
6. **Remove vs data** — removal keeps plugin data by default in
   this draft; whether that is the right default is undecided.
7. **Lazy import for failure isolation** — mitigation proposed,
   verification owed in the first extraction.
8. **Manifest `schemaVersion` vs plugin `version`** — two versions
   (manifest format vs plugin release). Kept separate deliberately;
   flag if it reads as overkill.

---

## Step 5 — Revision and stop

This document is the revised definition after the stress test. The
changes the stress test forced, relative to the plan's provisional
shape:

- **Static registry, not discovery.** The plan left "static registry
  in source, a manifest per plugin, or both" open. The stress test
  settles it: **both, with the static registry as the discovery
  mechanism** — because Kody resolves a static module graph, and a
  data-driven dynamic import of a package is unproven.
- **Route namespace `/plugin/<id>/…`** for new plugins, with the
  existing `/feed/` and `/proxy/` routes preserved and delegated
  to the feed-proxy plugin on extraction.
- **No plugin-to-plugin dependencies in v1.**
- **A plugin `provides` capability surfaces** for data apps, so
  extraction does not change any app definition.
- **Failure isolation stated honestly:** per-request, not
  per-process; import-time failure can still take down the
  package, with lazy import as a mitigation to verify.

### Done-when checklist (from the plan)

- [x] Every current shell module has a classification and a reason
  (Step 1). Caveat: from GitHub main `1525bad`, not the paused
  local tree — re-verify on `be-quite-900` once resumed.
- [x] The feed proxy is fully described in plugin terms (Step 4.1).
- [x] The manifest, boundary, storage, and lifecycle questions
  each have an answer, or an explicit deferral with a reason
  (Steps 3–4; deferrals are Open questions below).
- [x] The plugin / data app / core test classifies the hard cases
  without silent exceptions (Step 4; the one exception,
  handoff-board, is recorded, not silent).
- [x] The public / private question is answered in plugin terms:
  what travels to a fork, what stays private, and what an install
  request must name to be unambiguous (Steps 3–4).
- [x] Open risks are listed plainly (below).

### Open risks

- **Two install paths, permanently.** Data apps install with a
  registry write and no publish; plugins install with copy-in +
  register + publish. Every future feature pays the "which path?"
  question, and the Store, agents, and docs must keep the two
  straight. The decision test is the mitigation; it only works if
  it is actually applied.
- **A plugin can break the shell it ships inside.** Same isolate,
  no sandbox, no per-plugin permissions enforced by Kody. The
  manifest is enforced by review and registry checks, not by the
  platform. A bad plugin publish is repaired by republishing
  without it — which is also the recovery path, and it is manual.
- **Kody gaps the model depends on:** no per-plugin storage (one
  bucket; segregation is logical); no transactions/CAS (Kody
  confirmed Nov 9 — the install-registry-race fix works around it
  by deriving the installed list, a pattern plugins inherit);
  `KeyStore` exposes no `list()`/`sql()` yet, although
  `packageStorage()` provides them (the list-prefix fix adds
  `list()` to `KeyStore` — a plugin that enumerates its own keys
  needs it); no dynamic loading by a data-driven name (hence the
  static registry); no runtime toggle (disable = publish).
- **Registry as a merge point.** The static registry is one file
  every plugin install touches. Two agents installing two plugins
  concurrently can conflict on it the same way concurrent
  `add_app` calls raced on the registry value — except here the
  conflict surfaces in git, not silently in storage. Worth a line
  in the plugins spec: installs are serialised by the agent, one
  plugin at a time.
- **Fork absorb of plugins.** A fork absorbs a shell update by
  porting source; plugins it added itself are its own source and
  survive, but a shell update that changes the plugin interface
  (manifest version, route namespace) can strand them. The
  manifest `schemaVersion` and `minShellVersion` are the tripwires;
  the absorb flow must check them.
- **Scope creep into a package manager.** Resolver, versions,
  dependencies, private registries — each is a small step from
  this definition. The compatible-catalog non-goals (no
  multi-version catalog, no dependency graph) are the guardrail;
  the plugins spec should restate them.

### What remains undecided — user decisions

1. **Secrets binding:** how does a named secret attach to a
   plugin — package-level secret the plugin may use, or a
   per-plugin grant? (Affects the email client and any
   secret-using plugin.)
2. **Remove vs data:** does removing a plugin delete its stored
   data by default, or keep it (this draft: keep, with an explicit
   cleanup step)?
3. **Handoff-board:** rework its read path into the handoff
   plugin, or record a deliberate exception for a core read path?
4. **Two packages vs plugins:** does a private-only plugin make
   the second (private) package unnecessary, or is the private
   package still the place private plugins live? (This definition
   assumes the latter; the split itself is not decided here.)
5. **Cache migration on extraction:** accept a cold cache for the
   feed proxy (this draft: yes)?
6. **Manifest shape:** is the draft manifest (above) the right
   size, or is `schemaVersion` + `version` + `provides` overkill
   for v1?
7. **Lazy import mitigation:** verify in the first extraction, or
   accept import-time risk for v1 and verify later?

### Next step (not taken here)

After review: write the plugins OpenSpec change from this
definition (spec-first, no release/publish steps in it), then
spec the feed-proxy extraction separately. The compatible-catalog
change is unblocked by the plugins spec once it exists and is
settled — it must not be implemented against a guessed interface.
