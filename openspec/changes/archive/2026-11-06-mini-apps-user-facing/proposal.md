# Proposal

## Why

kody-os is a package that, installed on Kody, becomes a Kody app. Inside
it, the shell installs smaller units that are also called "apps" and can
be pinned to Home as widgets. That nesting is confusing in exactly the
place a new user meets it: a Kody app containing apps, with a third word
(widget) for what one of those apps looks like on Home.

Renaming the inner units to "widgets" was considered and rejected: a
widget already means one specific thing — the compact Home rendering of
an installed unit (see `widget-home` and `widget-visibility`) — and
things like Arrow Game, Cellular Playground, and Daily Feed are full
interactive pages that *also* have a widget view, not widgets alone.
Renaming the inner units to "mini-apps" keeps that distinction: a
mini-app is the installed unit, a widget is what it looks like on Home.

A full rename (routes, MCP exports, storage keys, type names) would be
a breaking change for every installed mini-app and every agent script
that calls `add_app` / `list_apps`. The confusion, though, lives almost
entirely in what a human reads in the browser. This change therefore
splits the name in two: keep `app` internally, use `mini-app` for
user-facing text. It is a copy change, not a refactor, and it is
reversible by changing the strings back.

## What Changes

- **Boundary rule (the whole change in one sentence):** if a human
  reads it in the browser, it says mini-app; if code, an MCP export, a
  route, a storage key, or a type name reads it, it stays app. See
  design.md Decision 1 for the exact boundary, including the two
  deliberate leaks (`/apps` URLs and MCP tool names visible in agent
  traces).
- **Shell chrome and pages** (`pkg/src/app.ts`,
  `pkg/src/apps/client.ts`): menu link "Apps" becomes "Mini-apps";
  the Apps page title and section head become "Mini-apps"; "All apps"
  becomes "All mini-apps"; "Edit apps" becomes "Edit mini-apps";
  "Back to Apps" becomes "Back to Mini-apps"; "no apps yet" becomes
  "no mini-apps yet"; the Apps empty hint, the Home dashboard empty
  hint ("Install apps from the App Store"), and inline browser error
  text that names an app all say mini-app. Pinned and Recent headings
  do not say "app" and do not change. Document titles follow the page
  word: "Mini-apps · {title}".
- **The Store** (`pkg/catalog/app-store.bundle.json`, id stays
  `app-store`): name, label, and title "App Store" become "Mini-App
  Store"; description "Install and update apps from the catalog…"
  becomes "Install and update mini-apps from the catalog…"; the intro,
  the no-JavaScript note, the "Could not load apps." status, the
  capability line "Can manage other apps.", and the confirm-dialog
  wording ("This will remove this app", "replace this app's
  definition") all say mini-app. The Store's own row in its list shows
  the new label; its id, route (`/apps/app-store`), and management
  calls are unchanged.
- **Help** (`pkg/catalog/help.bundle.json`, id stays `help`): the
  description "how apps are added" becomes "how mini-apps are added";
  the intro ("the Apps page lists installed apps") and the "Adding
  apps" heading become mini-apps; the add prompt becomes "Add a new
  mini-app to my hosted kody-os app on Kody…" while its code keeps
  `add_app`, `list_apps`, and `get_app_state` (see Decision 4); and
  Help gains one glossary line (design.md Decision 3) stating the
  mapping once: mini-apps are called apps by the agent tools.
- **Catalog descriptions:** only the generic ones change — the
  App Store and Help descriptions above. Per-app descriptions (Arrow
  Game, Counter, Daily Feed, and the rest) do not use the generic word
  and do not change; no bundle except Help and the App Store gets a
  catalogVersion bump for this change.
- **Docs** (`pkg/docs/setup.md`, `pkg/README.md`): user-facing prose
  says mini-apps ("Mini-apps are JSON definitions…", "the Mini-apps
  page shows its tile", "Add further mini-apps the same way"); code,
  MCP names, routes, and storage keys in those docs stay `app`.
- **What does NOT change:** MCP exports (`list_apps`, `add_app`,
  `remove_app`, `get_app_state`, `export_app`, `import_app`, `act`,
  `install_from_catalog`, `manage_*`); routes (`/apps`, `/apps/:id`,
  `/apps/app-store`); storage keys (`kody-os.apps.*`); type and
  function names (`AppDefinition`, `AppSummary`, `menuAppsFor`,
  `renderAppSection`, …); the adding-an-app skill name and path
  (`pkg/.agents/skills/adding-an-app/SKILL.md` — agent-facing, not
  browser-facing); the export envelope format (`kody-os-app/2`); MCP
  JSON error text; and the word "widget", which keeps meaning exactly
  what `widget-home` says it means.
- **Interaction with `empty-install`:** that change's Apps/Home
  empty-state prompts are user-facing text, so they must use mini-app
  wording too. Whichever change lands first, the other one's drafts
  are written in mini-app wording; the two must not ship one saying
  "apps" and the other "mini-apps" (see tasks §3 and design.md
  Decision 6).

## Capabilities

### New Capabilities

- `mini-apps-user-facing`: user-facing text in the shell, the Store,
  Help, catalog descriptions, and setup docs calls an installed unit
  a mini-app (Mini-App Store for the Store itself), while every
  internal identifier — MCP exports, routes, storage keys, types —
  keeps the name `app`.

### Modified Capabilities

- `shell`: menu, Apps-page, Edit-mode, empty-state, and inline-error
  wording changes from "app(s)" to "mini-app(s)" as listed above;
  no route, MCP, or storage behaviour changes.
- `app-registry`: a display-name mapping is added — internal `app`
  maps to display `mini-app` — with no change to the definition
  schema, the MCP interface, storage layout, or catalog behaviour.
  The App Store's display name changes; its id, route, and
  management API do not.
- `setup-guide`: user-facing prose in the guide and README uses
  mini-apps; code, MCP names, and routes in those docs stay `app`.

## Impact

- `pkg/src/app.ts` and `pkg/src/apps/client.ts` (rendered strings
  only — no routing, state, or handler change), `pkg/catalog/
  help.bundle.json` and `pkg/catalog/app-store.bundle.json` (display
  strings only; catalogVersion +1 each), `pkg/docs/setup.md` and
  `pkg/README.md` (prose only).
- No storage-schema change, no MCP export change, no route change,
  no definition-schema change, no change to any installed mini-app
  or its state. An agent script that worked before works unchanged;
  a user who learned the word "app" from the old UI sees "mini-app"
  instead and the Help glossary line explains the mapping.
- Version: PATCH recommended (copy correction, behaviour otherwise
  unchanged — see design.md Open Questions); build +1 on publish per
  `pkg/AGENTS.md`. The version decision is recorded in the
  implementation commit, not decided here.
- This change does NOT rename anything internally, does NOT rename
  "apps" to "widgets", does NOT change the adding-an-app skill, and
  does NOT fix the pre-existing drift that the canonical
  `app-registry` spec says the browser SHALL NOT render a removal
  control while the Store (v10, commit `08b81cd`) does render Remove;
  that is a separate change.
