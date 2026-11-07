# Tasks

## 1. Remove Help and About from the catalog

- [x] Delete `pkg/catalog/help/` (`definition.json` + `RECIPE.md`)
- [x] Delete `pkg/catalog/about/` (`definition.json` + `RECIPE.md`)
- [x] Remove the `help` and `about` imports from the explicit import list in `pkg/src/apps/catalog.ts`
- [x] Regenerate `pkg/catalog/catalog.json` (18 apps, no `collections` section)
- [x] Remove `installMode: "recipe-or-json"` from the app-store definition (it becomes a plain unattended JSON install); no `catalogVersion` bump (fingerprint-excluded)
- [x] Rewrite the app-store `RECIPE.md` as the trivial recipe: install `app-store` via `install_from_catalog('app-store')`, verify with `list_apps` (keep the "open and confirm the Store page renders" step as verification)
- [x] Delete `pkg/catalog/collections/starter/RECIPE.md` and the `pkg/catalog/collections/` directory
- [x] Remove the collections walk from `scripts/build-catalog-index.ts` (no `collections` section in the output; the generator fails on a stray `collections/` directory rather than indexing it)

## 2. Rename `os-theme.json` to `settings.json` and add the page-visibility flags

- [x] Rename `pkg/os-theme.json` to `pkg/settings.json` (contents unchanged; the two new flags are NOT added to the shipped file — both default to shown when absent)
- [x] Update every `os-theme.json` reference: `pkg/src/app.ts` (`getTheme()` import), `pkg/src/shell-theme.ts`, `pkg/src/shell-css.ts`, `pkg/public/styles.css`, `pkg/README.md`, `pkg/docs/shell-settings.md`, and any other hit from a repo-wide grep (the canonical specs are updated by this change's deltas, not by hand)
- [x] Extend `validateThemeSet` in `pkg/src/shell-theme.ts` with `showHelp` / `showAbout`: JSON booleans via `set_shell_theme`, `"1"` / `"0"` via the theme set route (field-named param); any other value fails the whole payload with no write
- [x] Extend `get_shell_theme` / `set_shell_theme` / `reset_shell_theme` (and their `pkg/src/index.ts` exports) to carry the flags in the `defaults` / `override` / `effective` splits; read path falls back to shown per flag on a non-boolean value
- [x] Confirm the `GET /theme/:app` route needs no structural change (same capability gate, same 404/400 behavior, same `format=json` / 303 behavior) and carries the flags through the existing set semantics

## 3. Built-in Help and About pages

- [x] `GET /help` renders the shared help text (`renderEmptyHelp` output) with 200 in the shared chrome; delete the 303 redirect to `/apps/help`
- [x] Add `GET /about` rendering the current About content (about-wrap markup, description, donation links, QR code) moved from the about catalog bundle into shell code, plus a Kody referral note at the bottom
- [x] `GET /apps/help` and `GET /apps/about` fall through to the existing unknown-app handling (plain 404 inside the chrome)
- [x] Menu (`menuAppsFor` / `shellChrome`): render built-in Help and About links after the menu-app links (label order: Help, then About), each shown only when its page is enabled; the disable check reads the effective settings on each render
- [x] Help and About pages carry no page-mode expand control (shell pages, like Home and the Apps page)
- [x] Help and About never appear in the Apps list, Edit mode, pin/hide/home state, home widgets, or the App Store list (they are never installed apps)
- [x] Update `renderEmptyHelp`'s "Install the App Store" prompt to install `app-store` only (Decision 7 text); no other change to the shared text

## 4. Migration of installed Help / About rows

- [x] Choose the seam (recommended: the registry read / dispatch path drops installed rows with id `help` or `about`, with their state)
- [x] After upgrade, `list_apps` never lists `help` or `about`; `install_from_catalog('help')` / `('about')` returns the unknown-id `{ ok: false }` and writes nothing
- [x] Verify no stale Help/About row can render, be edited, be pinned/hidden, or appear as a widget after upgrade (including on a store that had them installed before the upgrade)

## 5. Settings app Pages section

- [x] Add a Pages section to the Settings bundle (following the existing `st-field` pattern): for each of Help and About, Show / Hide GET forms to `../theme/settings` (hidden `action=set`, hidden `field=showHelp` / `field=showAbout`, value in the field-named param: `1` show / `0` hide), a per-field reset, and the current state shown (effective value + source, from the read route's split)
- [x] Bundle JavaScript MAY enhance the section in place; the GET forms SHALL work with no JavaScript (303 back to the panel)
- [x] Bump the Settings app `catalogVersion` 1 → 2 (its definition changes) and regenerate the catalog index
- [x] Extend the Settings bundle tests (`pkg/catalog/tests/settings-tests.cjs`, `settings-dom-tests.cjs`) for the new section, following the existing patterns

## 6. Harnesses, docs, and other references

- [x] Catalog harness: expect 18 apps and no collections (drop the collections == dirs check and the "starter collection installs app-store, help, about in order" check)
- [x] Store harness: delete the starter-recipe prompt-sync checks; rework "empty help prompt 2 matches Help prompt" to compare the Help page output against `renderEmptyHelp` (there is no Help catalog definition any more); update the prompt-steps checks to the app-store-only install
- [x] Agent-tools harness: update the recorded pre-existing FAIL expectation from "list_catalog returns 16 apps — got 20" to "got 18" (it still expects 16; still a FAIL, still pre-existing)
- [x] Update the README quote of the empty-state prompts (App Store prompt only) and any other doc quoting the starter collection recipe. (Correction: verified there was nothing to update — neither README contains the App Store prompt, and no live doc quotes the starter collection recipe.)
- [x] Grep the repo for `help` / `about` catalog references (`get_catalog_definition('help')`, `install_from_catalog('help' | 'about')`, `collections/starter`) and update or delete each hit; the adding-an-app skill needs no change (it does not name them)

## 7. Verification

- [x] `bun tests/catalog-harness.ts` — ALL PASSED (18 apps, 0 collections)
- [x] `bun tests/store-harness.ts` — ALL PASSED
- [x] `bun tests/open-mode-harness.ts`, `bun tests/owner-check-harness.ts` — pass
- [x] `bun tests/agent-tools-harness.ts` — exactly the 1 pre-existing FAIL, now "got 18"
- [x] `node pkg/catalog/tests/app-store-tests.cjs` (under node, not bun) — all pass; Settings bundle tests pass
- [x] `bun build pkg/src/app.ts --target=browser --external kody:* --outfile /tmp/kodyos-build-check.js` — succeeds
- [x] `npx --yes @fission-ai/openspec@latest validate help-about-built-in --type change` — valid (re-run after any change-file edit)
- [ ] Mock-dev check (`kody dev`, mock store): fresh install shows the shared help text; installing app-store only via the prompt works; Help page renders the same text; About page renders; disabling Help/About from Settings hides page + menu link and nothing else; an upgraded mock store with pre-installed help/about rows shows no stale rows
- [x] Human-browser / Scribe visual check (verified by the user Nov 6 evening in the browser: Home, Apps, Help, and About pages all render correctly)

## 8. Specs, version, archive

- [ ] Version decision at the implementation commit: MAJOR (3.0.0) recommended (Decision 10), taken together with catalog-restructure task 8.3; build +1 on publish
- [ ] Archive in order: `catalog-restructure`, then `shell-settings` (dropping the superseded "Help page SHALL name the Settings app" sentence and adding `showHelp` / `showAbout` to the "Agent access to the theme override" field list), then this change
- [x] No commit, push, or publish in this change — spec only; the implementation commit is a separate stop on the user's direction. (Overtaken: the implementation was committed as c5d10d4, with follow-up c786c46.)
