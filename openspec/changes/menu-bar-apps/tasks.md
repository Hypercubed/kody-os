## 1. Definition flag

- [x] 1.1 Add `menuBar?: boolean` to `UiDef` in
  `pkg/src/apps/types.ts`, documented as "also show this app in
  the top menu bar when installed", and `menuBar: boolean` to
  `AppSummary`, documented as derived (false when the field is
  absent)
- [x] 1.2 In `pkg/src/apps/registry.ts`, reject a non-boolean
  `ui.menuBar` in `validateDefinition` (same wording shape as
  the `hideState` check), preserve `menuBar` in the `add_app`
  canonical `ui` rebuild, and include `menuBar: def.ui.menuBar
  === true` in the `list_apps()` summary
- [x] 1.3 Verify against a memory store: a definition with
  `menuBar: true` validates, installs, and lists with
  `menuBar: true`; one without the field lists with
  `menuBar: false`; one with `menuBar: "yes"` is rejected and
  writes nothing; export/import round-trips the flag

## 2. Menu rendering

- [x] 2.1 Add optional `menuApps?: { id: string, label: string
  }[]` and `currentApp?: string` to `shellChrome()` in
  `pkg/src/app.ts`; render menu links after Apps, in the
  order given, each to `/apps/<id>`, with `aria-current="page"`
  when the id matches `currentApp`; delete the static Help
  link from the nav
- [x] 2.2 In dispatch, derive the menu for Home, Apps, and app
  pages from `list_apps()` with hidden apps excluded,
  filtered to `menuBar`, sorted by label case-insensitively
  with id as tiebreak, and pass it (plus `currentApp` on app
  pages) to `shellChrome()`; locked, 404, logout-confirm, and
  unlocked pages pass no menu list
- [ ] 2.3 Verify with no JavaScript against a memory store and
  `kody dev` (mock): flagged apps appear in the bar on Home,
  Apps, and app pages in label order; the viewed app's link
  is marked current; hidden flagged apps do not appear;
  unflagged apps do not appear; removing a flagged app
  removes its link with no other write; locked and 404 pages
  show no menu apps

## 3. Help as a catalog app

- [x] 3.1 Author `pkg/catalog/help.bundle.json` (id `help`,
  name/label "Help", stateless, no actions, page,
  `ui.menuBar: true`) carrying the current static Help
  content in substance — what the OS is, the agent `add_app`
  prompt, the setup-guide pointer — with no installed-apps
  list and no JavaScript; add the import line to
  `pkg/src/apps/catalog.ts` in alphabetical order and a
  README entry to `pkg/catalog/README.md`
- [x] 3.2 Replace the static `/help` route in
  `pkg/src/app.ts` with a 303 redirect to `/apps/help`
  preserving the request's query string
- [ ] 3.3 Verify: the catalog harness passes with the help
  bundle (validate + install + list + initial state);
  `GET /help` redirects to `/apps/help` (query preserved);
  with help installed, the bar shows Help; without it
  installed, the bar shows no Help link; the help app page
  shows the reference content and no installed-apps list

## 4. About flag and docs

- [x] 4.1 Set `ui.menuBar: true` in
  `pkg/catalog/about.bundle.json` (already in the working
  tree, uncommitted, alongside its catalog registration)
- [x] 4.2 Document the flag in `pkg/docs/adding-an-app.md`
  (definition contract: `ui.menuBar` row, next to
  `hideState`, stating author-controlled, hidden-excluded,
  install/uninstall lifecycle) and in `pkg/AGENTS.md`
  ("Adding an app" section, one line plus the Help/About
  examples)
- [x] 4.3 Re-run `bun tests/catalog-harness.ts` and confirm
  all catalog apps pass, including about and help with
  `menuBar: true`, and that a repo-wide grep finds no
  remaining static Help link in the shell chrome

## 5. Version

- [x] 5.1 Apply the MINOR version bump in the same commit as
  the code (PATCH reset, `pkg/AGENTS.md` + `pkg/README.md`
  headers updated) per `pkg/AGENTS.md`, with the bump
  determined at implementation time from the then-current
  package version (1.3.2 → 1.4.0 at the time of writing);
  BUILD increments by 1 only on publish, not in this commit
- [x] 5.2 Confirm the change is not committed or published
  by this change's own tasks: implementation lands in the
  working tree for review, and commit/publish remain
  separate user decisions, as with About

## Implementation notes (2026-10-31, repo-only)

- Code implemented in the working tree, uncommitted: types, registry,
  shell chrome + dispatch, help bundle, About flag, docs, version
  1.3.2 → 1.4.0 with AGENTS/README headers updated, build stays 18.
- Verified here: `bun tests/catalog-harness.ts` — ALL CATALOG CHECKS
  PASSED (12 apps); memory-store menu tests in /tmp/menu-test.ts —
  flag validate/list, hidden exclusion, remove_app drop, export/import
  round-trip, all passed; tsc under generic flags shows no new
  menu-related errors (pre-existing tsc noise elsewhere under those
  flags, repo check is `kody check --offline`).
- NOT verified here: tasks 2.3 and 3.3 end-to-end shell rendering and
  the /help redirect, because this environment has no `kody` CLI and
  no running `kody dev` mock. Those two tasks stay unchecked until
  run against a mock or live shell. No commit, no publish, no live
  change was made by this implementation.
