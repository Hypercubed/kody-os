# Proposal

## Why

Help and About are catalog apps today (`help` catalogVersion 8, `about`
catalogVersion 4), installed like any other app, with `GET /help` 303-redirecting
to `/apps/help`. That split has cost more than it saves:

- The Help bundle carries its own copy of the add-apps prompt, and the
  empty-home text (`renderEmptyHelp` in `pkg/src/apps/client.ts`) carries
  another. The two copies can silently diverge — the store harness has a
  check whose only job is asserting they still match.
- The starter collection recipe (`pkg/catalog/collections/starter/RECIPE.md`)
  exists only to install `app-store`, `help`, and `about` together, so the
  empty-state "Install the App Store" prompt points at a collection instead
  of at the App Store itself.
- Help and About are not user-chosen apps: they are shell pages every
  install wants, they need no install snapshot, no update flow, no widget,
  and no Edit-mode toggles, and they keep showing up in places (Apps list,
  Store list, widgets) where they do not belong.

The user direction (Nov 6, 2026) moves both back into the shell as built-in
pages, makes the Help page render exactly the empty-home text, renames
`pkg/os-theme.json` to `pkg/settings.json` now that the file carries more
than theme, adds settings to disable Help and About, and deletes the starter
collection entirely.

## What Changes

1. Help and About stop being catalog apps. `pkg/catalog/help/` and
   `pkg/catalog/about/` (definitions + recipes) are deleted; the catalog
   goes from 20 apps to 18, and the generated index loses those entries.
2. The shell serves built-in pages: `GET /help` renders the shared help
   text (the exact `renderEmptyHelp` output) with 200 — the 303 redirect to
   `/apps/help` is gone — and a new `GET /about` renders the current About
   content. `/apps/help` and `/apps/about` fall through to the existing
   unknown-app 404. Neither page is an app: no Apps-list row, no Edit-mode
   toggles, no pin/hide/home, no home widget, no App Store row, no
   page-mode expand control.
3. One shared help text, identical on all three surfaces: the Help page,
   the empty Home page, and the empty Apps page all render the same
   `renderEmptyHelp` block (intro, "Add your own apps" prompt, "Install the
   App Store" prompt, closing line).
4. `pkg/os-theme.json` becomes `pkg/settings.json`. Every reference moves
   (theme code, Settings app, harness/tests, docs). The file gains two flat
   booleans, `showHelp` and `showAbout`, defaulting to shown when absent.
   They ride the existing file-default + durable-override (`kody-os.shell.theme`)
   machinery, the existing `validateThemeSet` / `get_shell_theme` /
   `set_shell_theme` / `reset_shell_theme` functions, and the existing
   `GET /theme/<app>` route — no second override key, no second route, no
   renamed internals.
5. Disabling Help hides `GET /help` (404) and its menu link, and nothing
   else. Disabling About hides `GET /about` (404) and its menu link, and
   nothing else. In particular, disabling Help does NOT hide the empty
   Home / empty Apps help text: that is first-run guidance shown only when
   no apps are installed, not the Help page.
6. The Settings app gains a Pages section with Show / Hide controls for
   Help and About, following its existing GET-form pattern. Its
   `catalogVersion` goes 1 → 2.
7. The starter collection goes away entirely: the recipe file, the
   `pkg/catalog/collections/` directory, the index `collections` section,
   the generator's collections support, the Collection recipe requirement,
   and the prompt reference. The empty-state "Install the App Store" prompt
   points directly at the App Store recipe
   (`pkg/catalog/app-store/RECIPE.md`).
8. `app-store` loses its `installMode`: its recipe is now the trivial
   install + verify, so it is a plain unattended JSON install. `daily-feed`
   and `generic-feed` stay `recipe-or-json`; `recipe-only` stays defined
   with no members.
9. Upgrade migration: an install that already has `help` / `about` rows
   installed must not show two Helps (built-in page + stale installed app
   rendering old content). Installed `help` / `about` rows are pruned on
   upgrade (recommended seam: the registry read / dispatch path).
10. Version: MAJOR (3.0.0) recommended — `install_from_catalog('help')` and
    `install_from_catalog('about')` stop working, and a fork's
    `os-theme.json` would be silently ignored. Decided at the implementation
    commit, together with the catalog-restructure change's outstanding
    version decision (task 8.3 there).

## Capabilities

### New Capabilities

- Built-in Help page (`GET /help` renders the shared help text).
- Built-in About page (`GET /about` renders the About content).
- Settings file page-visibility flags (`showHelp` / `showAbout`).
- Settings app Pages section (Show / Hide for Help and About).

### Modified Capabilities

- Shared help text (one block, three surfaces).
- Catalog index (no `collections` section; 18 apps).
- App recipe (no collection recipes; a recipe installs only its own app).
- Recipe install mode (app-store is `json` now).
- Menu chrome (built-in Help / About links when enabled; brand from
  `settings.json`).
- Theme file (renamed to `settings.json`; flags ride the same machinery).

## Impact

- Catalog: 20 → 18 apps. The catalog harness and store harness counts and
  prompt-sync checks change; the agent-tools harness's pre-existing FAIL
  expectation changes from "got 20" to "got 18" (it expects 16).
- `install_from_catalog('help')` / `('about')` return unknown-id
  `{ ok: false }` after this change; any agent prompt naming them must be
  updated (the empty-state prompt is updated here; the adding-an-app skill
  does not name them).
- A fork's `os-theme.json` is silently ignored after the rename; forks must
  rename the file to `settings.json`. This is the MAJOR-bump driver, with
  the `install_from_catalog` break.
- The Help page no longer names the Settings app as the browser path for
  changing the shell theme (that sentence in the shell-settings change's
  "Settings catalog app" requirement is superseded — see design.md, Open
  Questions). The Settings app is reached from the Apps page like any
  catalog app.
- The Help page no longer points at the setup guide (`pkg/docs/setup.md`):
  the shared text does not mention it. The guide itself is unchanged.
- Out of scope: the Store recipe-prompt UI (separate change
  `store-recipe-prompt`, staged); the out-of-pkg catalog move (separate
  change `catalog-out-of-pkg`); anything public; no Kody publish.
- Dependency: this change builds on the staged tree — branch `main`, HEAD
  `dc062f6`, 85 staged entries, 0 unstaged (verified Nov 7): the
  `catalog-restructure` implementation plus the `store-recipe-prompt`
  change. Archive order is a hard constraint: `catalog-restructure`, then
  `shell-settings`, then this change (see design.md, Open Questions).
