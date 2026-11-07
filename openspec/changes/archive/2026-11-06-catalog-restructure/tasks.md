# Tasks

Phases land in order: 1, then 2, then 3, then 4, then 5, then 6, then 7,
then 8. Each phase's verification must pass before the next phase starts.
No task in this file commits, pushes, or publishes anything.

## 1. Moves and installMode fields

- [x] 1.1 `git mv pkg/catalog/<id>.bundle.json pkg/catalog/<id>/definition.json`
  for all 20 apps (rename tracking). Verify with `git diff HEAD --stat` +
  `git status`: 20 renames, nothing else touched.
- [x] 1.2 Add `"installMode": "recipe-or-json",` to `app-store`,
  `daily-feed`, and `generic-feed` definition.json only, by surgical text
  insert right after the `"catalogVersion": N,` line. Do NOT json
  round-trip any definition file (key order and formatting must not
  change). No other definition content changes; no catalogVersion bump
  anywhere. No definition carries `"recipe-only"` today.
- [x] 1.3 Verify: `git diff HEAD --stat` shows the moves + 3 one-line
  inserts only; every definition.json parses (json.load over all 20).

## 2. RECIPE.md files

- [x] 2.1 Write the trivial recipe for the 17 JSON-only apps (about,
  arrow-game, calculator, calendar, cellular-playground, clock, counter,
  eight-ball, help, hoodie-weather, link-drop, mac-puzzle, news, probe,
  settings, three-bit-art, xkcd): install the sibling definition.json via
  `install_from_catalog('<id>')`, then verify with `list_apps`.
- [x] 2.2 Write the app-store recipe: install app-store alone via
  `install_from_catalog('app-store')`, then verify with `list_apps`; do
  not install any other app, do not publish or change the package source.
  (The Store plus Help and About is the separate starter collection
  recipe, §2.5 — not this recipe.)
- [x] 2.3 Write the daily-feed recipe: install, then push the first feed
  items via `set_feed` following the bundle's empty-state prompt (read
  current state, prepend one new RSS item, newest first, at most 14 items,
  set the full feed; do not overwrite if the current feed cannot be read
  or parsed). The recipe fully configures the app; unattended install
  lands with an empty feed and the built-in prompt guides setup.
- [x] 2.4 Write the generic-feed recipe: install, ask the user for the RSS
  feed URL, fetch it, set the full feed via `set_feed` (newest first, max
  14; do not overwrite if fetch/parse/current-state read fails). The
  recipe fully configures the app; unattended install lands unconfigured
  and the built-in prompt (blank RSS URL) guides setup.
- [x] 2.5 Write the starter collection recipe at
  `pkg/catalog/collections/starter/RECIPE.md` (proposed home and id):
  install app-store, help, and about (one `install_from_catalog` step
  per app, in that order), then verify all three with `list_apps`.
  Confirm it matches the empty-state prompt (see §7).
- [x] 2.6 Verify: every `pkg/catalog/<id>/` contains `definition.json` +
  `RECIPE.md`, and `pkg/catalog/collections/starter/` contains `RECIPE.md`;
  no other files added.

## 3. Registry and types: installMode

- [x] 3.1 Add `installMode?: 'json' | 'recipe-only' | 'recipe-or-json'`
  to `AppDefinition` in `pkg/src/apps/types.ts` with a doc comment
  (absent means `'json'`; only apps with a non-trivial recipe carry it;
  `'recipe-only'` has no current members).
- [x] 3.2 `validateDefinition` (`pkg/src/apps/registry.ts` ~565): add a
  clause — if present, `installMode` must be `'json'`, `'recipe-only'`,
  or `'recipe-or-json'`.
- [x] 3.3 `canonicalizeDefinition` (~728): preserve `installMode` when
  present, like `catalogVersion`.
- [x] 3.4 `fingerprintDefinition` (~793): exclude `installMode` from the
  fingerprint, like `catalogVersion` (`delete canon['installMode']`).
- [x] 3.5 Verify: fingerprint with `installMode` equals fingerprint
  without it for app-store, daily-feed, and generic-feed (harness check,
  §6); a definition with `installMode` `'bogus'` fails validation.

## 4. Generator and index

- [x] 4.1 Write `scripts/build-catalog-index.ts` (repo tooling, outside
  `pkg/`; run with bun from the repo root): walk
  `pkg/catalog/*/definition.json`, read id/label/catalogVersion, compute
  the fingerprint via `fingerprintDefinition` imported from
  `pkg/src/apps/index.ts`, read `installMode` (absent means `'json'`) and
  recipe presence, write `pkg/catalog/catalog.json` sorted by id with
  entries { id, label, catalogVersion, fingerprint, installMode,
  definitionPath, recipePath } (paths relative to `pkg/catalog/`); also
  walk `pkg/catalog/collections/*/RECIPE.md` and write a `collections`
  section with entries { id, recipePath, apps }.
- [x] 4.2 Run the generator twice; confirm byte-identical output (sha256).
  Document in `pkg/catalog/README.md` that editing an app requires
  re-running the generator.
- [x] 4.3 Rewrite `pkg/catalog/README.md` for the new layout: per-app
  directories, `definition.json` + `RECIPE.md`, generated index +
  generator rule, install-mode rule (both modes), collection recipes,
  file + import + harness checklist.

## 5. catalog.ts

- [x] 5.1 Repoint the 20 imports to `<id>/definition.json`; import the
  generated `catalog.json`; drive the listing summaries from the index
  (membership + alphabetical order), filling name/icon/category/description
  from the imported definitions; add `installMode` to `CatalogSummary`
  from the index. Keep the explicit import list; definitions stay
  statically imported for `get_catalog_definition`/install.
- [x] 5.2 Rewrite the `catalog.ts` header comment: app dirs, generated
  index, explicit import list still required (no directory listing in the
  Worker).

## 6. Harness and other references

- [x] 6.1 Update `tests/catalog-harness.ts`: walk app directories (each
  `<id>/` must contain `definition.json` + `RECIPE.md`); check index ==
  directories == definitions (ids, alphabetical order, catalogVersions,
  fingerprints, install modes) and the `collections` section matches the
  collections directories (ids, recipe paths, apps); every definition
  still validates + installs in a blank store + holds initial state;
  fingerprint-stability check (§3.5); unknown id returns null. Keep the
  harness outside `pkg/`.
- [x] 6.2 Update path references: `pkg/catalog/tests/*.cjs` (13 files
  loading `../<id>.bundle.json` → `../<id>/definition.json`),
  `tests/calendar-grid.cjs`, `tests/home-widget-counter.cjs`,
  `tests/news-list.cjs`; `pkg/docs/setup.md:196`; comments in
  `pkg/src/apps/index.ts:9` and `pkg/src/index.ts:21`;
  `pkg/src/apps/INTEGRATION.md:12`. Grep the repo for `bundle.json`
  afterwards and confirm no stale catalog path remains (archived
  `openspec/changes/` folders are records — do not mass-rename them).
- [x] 6.3 Run: `bun tests/store-harness.ts`,
  `bun tests/catalog-harness.ts`,
  `node pkg/catalog/tests/app-store-tests.cjs`,
  `bun tests/open-mode-harness.ts`, `bun tests/owner-check-harness.ts`,
  `bun tests/agent-tools-harness.ts`. Expect ONLY the known pre-existing
  FAIL `list_catalog returns 16 apps — got 20` (same on clean `c1da8cb`).
  Fix any new failure at its cause; do not delete or weaken assertions.

## 7. Prompt sync: App Store prompt matches the recipe

- [x] 7.1 Update the empty-state "Install the App Store" prompt to install
  app-store, help, and about (`install_from_catalog` for each, verify all
  three with `list_apps`) in the one place that carries it:
  `renderEmptyHelp` in `pkg/src/apps/client.ts`. (Correction: the prompt
  does not also live in the Help bundle or the README quote — it exists
  only in `client.ts`.) The prompt points at the starter collection
  recipe (§2.5), not at the app-store's own recipe. Do NOT change the
  "Add your own apps" prompt. (Note: that prompt's wording
  "What it does: [describe what it should do]" was changed separately by
  the user — leave it as is.)
- [x] 7.2 Add a store-harness prompt-sync check: the empty-page App Store
  prompt names app-store, help, and about and the verify step, matching
  the starter collection `RECIPE.md` install steps.
- [x] 7.3 Run the store harness; the prompt-sync check passes.

## 8. Verification, docs, specs, version

- [x] 8.1 Run the generator twice (byte-identical); run the full harness
  list from §6.3; `bun build pkg/src/app.ts --target=browser --external
  kody:* --outfile /tmp/kodyos-build-check.js` (never print the bundle to
  stdout); `git diff --stat` and `git status`.
- [x] 8.2 Sync the canonical specs by hand from this change's deltas
  (`openspec/specs/app-registry`, `authoring`, `shell`), following the
  repo's archive practice.
- [ ] 8.3 Record the version decision in the implementation commit (MINOR
  recommended; build +1 on publish either way, per `pkg/AGENTS.md`). No
  commit, push, or publish in this change unless the user directs it at
  each stop.

