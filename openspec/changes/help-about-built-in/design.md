# Design: help-about-built-in

## Context

Verified on be-quite-900, Nov 6–7, 2026, against the staged tree (branch
`main`, HEAD `dc062f6`, 85 staged entries, 0 unstaged — the staged
catalog-restructure implementation plus the staged store-recipe-prompt
change).

- Help is a catalog app (`pkg/catalog/help/definition.json`, catalogVersion
  8, `ui.menuBar: true`, no actions, one `index.html` of 1688 chars: intro
  + "Adding apps" with its own prompt copy). About is a catalog app
  (`pkg/catalog/about/definition.json`, catalogVersion 4, `ui.menuBar:
  true`, `index.html` of 6596 chars: about-wrap markup, QR code, donation
  links for GitHub Sponsors, Ko-fi, and Buy Me a Coffee).
- `GET /help` (`pkg/src/app.ts`, ~line 911) responds 303 to `/apps/help`
  and carries no query string forward. No `/about` route exists.
- The menu (`menuAppsFor`, `pkg/src/app.ts` ~line 629) builds links from
  installed apps with `menuBar: true` and not hidden; the canonical shell
  spec says "no static Help link".
- The shared empty-state help block is `renderEmptyHelp` in
  `pkg/src/apps/client.ts` (line 580): intro ("No apps installed yet. This
  shell starts empty — nothing is installed until you add it. Pick a path
  below. Copy a prompt into a Kody-connected agent."), "Add your own apps"
  prompt (Name + "What it does: [describe what it should do]"), "Install
  the App Store" prompt (today: "Follow the starter collection recipe
  (pkg/catalog/collections/starter/RECIPE.md):
  install_from_catalog('app-store'), install_from_catalog('help'),
  install_from_catalog('about'), then verify with list_apps that all three
  are installed."), closing line ("Once an app is installed your apps
  show up on the Apps page."). It renders on the empty
  Apps page and, via `renderDashboard`, on the empty Home page. The Install
  prompt lives ONLY in `client.ts` — the Help bundle and README carry only
  the "Add your own apps" prompt.
- `pkg/os-theme.json` is `{name, title, icon, background, _comment}`; every
  field optional; missing file or broken JSON falls back to the stock look.
  The theme machinery: file theme is the default layer; durable override
  under `kody-os.shell.theme`, merged per field on every page render;
  `validateThemeSet` (allowed fields name/title/icon/background; null
  clears; any invalid field fails the whole payload with no write),
  `get_shell_theme` / `set_shell_theme` / `reset_shell_theme` in
  `pkg/src/shell-theme.ts`, exported from `pkg/src/index.ts`;
  `GET /theme/:app` route (capability-gated, `capabilities.theme.view` for
  read, `.set` for set/reset; unknown apps / undeclared / view-only callers
  of set/reset → plain 404; invalid value → JSON `{ok: false, error}` 400,
  writes nothing; no POST).
- Settings app (`settings`, catalogVersion 1, `capabilities.theme: {view:
  true, set: true}`, `ui.openAs: "page"`): bundle with Background, Name,
  Title, Icon, Reset all sections; plain GET forms to `../theme/settings`
  (hidden `action=set|reset`, hidden `field=<name>`, value in a param named
  after the field — e.g. `background=desk`); a `<script>` filling current
  values (no-JS shows "…", a known open issue).
- `pkg/catalog/catalog.json` has `{apps: [...], collections: [...]}`; the
  generator `scripts/build-catalog-index.ts` walks app dirs and
  `pkg/catalog/collections/<name>/RECIPE.md`, parsing install steps from
  `install_from_catalog('<id>')` in order.
- Harnesses: the catalog harness checks index collections == collections
  dirs and asserts "starter collection installs app-store, help, about in
  order"; the store harness prompt-sync checks assert the App Store prompt
  points at the starter collection recipe and that "empty help prompt 2
  matches Help prompt" (comparing `renderEmptyHelp` against
  `get_catalog_definition('help')` HTML — this check cannot survive Help
  leaving the catalog).
- Canonical specs: the shell-settings change is UNARCHIVED (still in
  `openspec/changes/shell-settings/`), so the canonical specs do NOT yet
  contain its requirements ("Durable per-field theme override", "Settings
  catalog app", the shell theme-route requirements, "Theme capability
  declaration for apps"). This change's deltas are written against the
  canonical specs as they stand, on top of the shell-settings texts where
  they overlap (see Open Questions).

## Goals / Non-Goals

Goals:
- Help and About are shell pages, reachable with no install, no Store row,
  no widget, no Edit-mode surface.
- One shared help text, byte-identical on the Help page, empty Home, and
  empty Apps page, with a single source (`renderEmptyHelp`).
- The settings file holds theme + page visibility, with one machinery
  (file default + override + route + MCP exports) for both.
- The starter collection disappears completely — file, index section,
  generator support, requirement, prompt reference.
- No silent behavior change for anything else: theme rendering, the Store,
  the recipe modes of daily-feed / generic-feed, and the agent-tools
  harness's pre-existing FAIL (count changes 20 → 18, still a FAIL).

Non-goals:
- Store recipe-prompt UI (separate change `store-recipe-prompt`).
- Catalog out of `pkg/` (separate change `catalog-out-of-pkg`).
- Renaming the `os-theme` spec directory or the internal theme function
  names (`get_shell_theme`, `set_shell_theme`, `reset_shell_theme`,
  `kody-os.shell.theme` key, `/theme/<app>` route) — historical names stay.
- Any change to what the help text says beyond the App Store prompt's
  install list (the user directed exact-equality with the empty-home text).
- Public flip, rename-versus-promote, Kody publish, commit, or push — this
  change is spec only.

## Decisions

### Decision 1: the shared help text is `renderEmptyHelp` output, verbatim on all three surfaces — DECIDED

The canonical source is the current empty-home text: `renderEmptyHelp` in
`pkg/src/apps/client.ts`. The Help page renders that block's output, the
empty Home page renders it (via `renderDashboard`), and the empty Apps page
renders it. "Identical" means the same block content — intro, both prompts,
closing line — not three copies. The Help page omits the closing line
("Once an app is installed your apps show up on the Apps page."): it describes the first-run empty state, not the Help page
itself, and the user directed its removal on the Help page only (Nov 6,
2026). Empty Home and empty Apps keep the line; the block is otherwise
identical on all three surfaces. The only text change in the block is the App
Store prompt's install list (Decision 7).

Consequence: the setup-guide pointer drops from the Help page. The old
help-page requirement said the Help bundle names `pkg/docs/setup.md` as the
first-run/fork setup path; the shared text does not mention it, and adding
it would change the empty-home text too. The guide itself is unchanged as a
repo doc.

### Decision 2: `app-store` becomes `json` (its `installMode` is removed) — DECIDED, with the exact code reason

The restructure rule is "Only an app with a non-trivial recipe SHALL carry
`installMode`". With the collection gone, the app-store recipe is the
trivial recipe: install the sibling `definition.json` via
`install_from_catalog('app-store')`, then verify with `list_apps`. The
"open and confirm the Store page renders" step in its current RECIPE.md is
verification, not setup — it does not make the recipe non-trivial. So the
property is removed, not set to `"json"` (absent means `json`).

Removing `installMode` needs no `catalogVersion` bump: the field is
excluded from the definition fingerprint, exactly like `catalogVersion`, so
no installed copy changes update status. (The "Catalog version"
requirement gains the symmetric removing sentence.) `daily-feed` and
`generic-feed` stay `recipe-or-json`; `recipe-only` stays defined with no
members. The store-recipe-prompt change is unaffected: it keys off
`recipe-only` rows, and app-store was never one.

### Decision 3: `settings.json` schema — flat booleans, same layers, same machinery — DECIDED

`pkg/settings.json` keeps the theme fields flat (`name`, `title`, `icon`,
`background`) and adds flat booleans `showHelp` and `showAbout`, each
defaulting to shown (`true`) when absent — following the file's existing
flat style. The flags ride the existing machinery in place: the file is
the default layer, the durable override under `kody-os.shell.theme` is the
override layer, `validateThemeSet` is extended with the two boolean
fields, `get_shell_theme` returns them in its `defaults` / `override` /
`effective` splits, `set_shell_theme` / `reset_shell_theme` accept them,
and the `GET /theme/<app>` route carries them.

Encoding (verified against the Settings bundle's existing form pattern,
where the value rides in a param named after the field):
- Via MCP `set_shell_theme`: JSON booleans `true` / `false`.
- Via the theme set route: the strings `1` (show) / `0` (hide) in the
  field-named param (`field=showHelp&showHelp=1`).
- Anything else fails the whole payload with no write, exactly like an
  invalid theme field. On the read path a non-boolean stored or file value
  falls back to shown for that flag only. Resetting a flag deletes that
  flag's override; resetting with no argument deletes the whole key.

Internal names stay: `get_shell_theme`, `set_shell_theme`,
`reset_shell_theme`, the `kody-os.shell.theme` key, and the `/theme/<app>`
route are historical and are not renamed. The `os-theme` spec directory
also keeps its name (renaming the capability directory is out of scope;
the file rename is what was asked for).

### Decision 4: disable semantics — page + menu link only; the empty-state text is unaffected — DECIDED

Disabling Help hides exactly two things: `GET /help` (responds 404) and
the Help menu link. Disabling About hides exactly two things: `GET
/about` (404) and the About menu link. Nothing else changes: disabling
Help does NOT hide the empty Home / empty Apps help text, because that text
is first-run guidance shown only when no apps are installed — it is not
the Help page. (Alternative considered and rejected: suppressing the
empty-state text when Help is disabled. It conflates two different things —
a page and first-run guidance — and would leave a fresh install with
disabled Help and no apps showing a bare empty page with no path forward.)

The disable check is a read of the effective settings on each render, so a
toggle in the Settings app takes effect on the next render with no
republish, like a theme change.

### Decision 5: built-in pages are shell pages, not app pages — DECIDED

Help and About pages use the shared chrome (title bar, menu strip, footer)
like Home and the Apps page, and like those pages they carry NO page-mode
expand control (the expand control is an app-page feature; the shell spec's
"App page expands to fill the window" requirement is updated to say so).
They have no `/apps/<id>` route (`/apps/help` and `/apps/about` fall
through to the existing unknown-app handling — plain 404, per "Bundle
failures degrade, never blank"), no Apps-list row, no Edit-mode row, no
pin/hide/home state, no home widget, and no App Store row. They are never
installed, so they have no install snapshot and no update status.

Menu order (after the menu-app links, in label order): Help, then About,
each shown only when enabled. They are the ONLY menu links not derived from
installed apps — the "Menu apps are derived, not stored" requirement gains
that exception sentence; there is still no menu storage key and no menu
write.

### Decision 6: the Help page no longer names the Settings app — DECIDED, superseding shell-settings

The shell-settings change's ADDED requirement "Settings catalog app" ends
with: "The Help page SHALL name the Settings app as the browser path for
changing the shell theme." That sentence cannot survive this change: the
Help page now renders the shared help text verbatim, which does not name
the Settings app. This change therefore specifies the removal (in the ADDED
"Help is a built-in shell page" requirement: "The shared help text SHALL
NOT name the Settings app or any other browser path for changing
settings"). The Settings app remains reachable from the Apps page like any
catalog app. At archive time the sentence must be dropped from "Settings
catalog app" when shell-settings archives (see Open Questions) — this
change does not MODIFIY that requirement because it does not exist in the
canonical specs yet.

### Decision 7: the App Store prompt points directly at app-store — DECIDED

New prompt text (the only change inside `renderEmptyHelp`): "Add the App
Store to my kody-os shell. Follow the app-store recipe
(pkg/catalog/app-store/RECIPE.md)." It points at the app's own recipe,
which is the trivial install-and-verify — no collection, no help/about
installs — and stops there, leaving the steps to the recipe. The store harness prompt-sync checks are updated to
match (the starter-recipe checks are deleted; the "prompt 2 matches Help
prompt" check is reworked because there is no Help catalog definition to
compare against — the Help page output is compared against
`renderEmptyHelp` instead).

### Decision 8: migration — prune installed help/about rows on upgrade — DECIDED, seam recommended

Otherwise a shell that installed Help would show two Helps: the built-in
page and the stale installed app rendering the old bundle content (and the
stale row would still be editable, pinnable, and widget-able). Recommended
seam: the registry read / dispatch path drops installed rows whose id is
`help` or `about` (and their state) when the registry is read, so no stale
row can render, be edited, or appear in `list_apps`. The implementation
picks the seam; the requirement is that after upgrade `list_apps` never
lists `help` or `about`, `install_from_catalog('help' | 'about')` returns
the unknown-id `{ ok: false }`, and no stale row renders anywhere. A fork
that customized the Help/About catalog content loses those customizations
on upgrade — the built-in pages are shell code, customized by editing the
shell (flagged for review in Open Questions).

### Decision 9: About content moves verbatim into the shell — DECIDED

The About page renders the same content the about catalog app rendered
(the about-wrap markup: the "About kody-os" description, the donation
links for GitHub Sponsors, Ko-fi, and Buy Me a Coffee, and the QR code),
as a shell page. No content change; the move is from bundle HTML into
shell code.

### Decision 10: version — MAJOR (3.0.0) recommended — DECIDED as a recommendation, confirmed at the commit

Per the version policy in `pkg/AGENTS.md` ("when in doubt, take the higher
one"): `install_from_catalog('help')` and `install_from_catalog('about')`
stop working (a valid catalog id no longer installs), and a fork's
`os-theme.json` would be silently ignored after the rename (the file is
read at render time; a missing `settings.json` falls back to stock values
with no warning). Either alone is a breaking change for a fork or an
agent prompt that names those ids. Build +1 on publish either way. The
decision is taken at the implementation commit, together with the
catalog-restructure change's outstanding version decision (task 8.3 there)
— the two changes will almost certainly publish together, and the highest
bump wins.

## Open Questions

1. **Archive order (hard constraint).** Archive in this order:
   `catalog-restructure`, then `shell-settings`, then this change.
   - This change's app-registry MODIFIED deltas are written on top of the
     catalog-restructure texts (already hand-synced into the canonical
     specs); the known archive INFO stands — catalog-restructure's ADDED
     "Catalog index" delta collides with the hand-synced canonical
     requirement at its archive time, and must be reconciled there, not
     here.
   - This change's os-theme MODIFIED "Single theme file with defaults" is
     written on top of shell-settings' MODIFIED text (it includes
     shell-settings' DEFAULT-layer paragraph, with `settings.json`
     substituted). If shell-settings archived AFTER this change, its delta
     would overwrite the requirement with the `os-theme.json` text and
     silently drop the rename and the flags. Shell-settings MUST archive
     first.
   - When shell-settings archives, drop the sentence "The Help page SHALL
     name the Settings app as the browser path for changing the shell
     theme." from its ADDED "Settings catalog app" requirement (superseded
     by Decision 6), and note that its ADDED "Agent access to the theme
     override" field list (`name`, `title`, `icon`, `background`) gains
     `showHelp` / `showAbout` per this change's ADDED "Settings file
     carries page-visibility flags" requirement.
2. **Migration seam.** Decision 8 recommends pruning at the registry read /
   dispatch path; the implementation picks the seam. Open until the
   implementation names it.
3. **Closing line on the Help page — RESOLVED.** The Help page omits "Once an
   app is installed your apps show up on the Apps page." (user direction, Nov 6, 2026: that line is about the empty
   state, so it stays only on empty Home and empty Apps). Exact-equality
   applies to the intro and the two prompts, not the closing line.
4. **Setup-guide pointer.** The Help page no longer points at
   `pkg/docs/setup.md`. Confirm in review that dropping the pointer is
   wanted; restoring it would mean adding it to the shared text (and
   therefore to the empty-home text too).
5. **Forks that customized Help/About.** A fork that edited the Help or
   About catalog bundle loses those customizations on upgrade (Decision 8).
   Confirm in review; there is no migration that preserves bundle edits.
6. **Carried over from catalog-restructure (unaffected by this change):**
   whether updates re-run recipes (assumed install-time only); where a
   custom app's recipe is stored; catalog-out-of-pkg manifest
   reconciliation.

Note on the "Catalog index" delta: the validator refuses MODIFIED blocks
that drop scenarios, so the "Index lists collection recipes" scenario is
kept by name with its expectation inverted — it now asserts the index has
no `collections` section. The scenario's subject (collection recipes) is
gone; the name is retained only as the anchor the validator requires.
