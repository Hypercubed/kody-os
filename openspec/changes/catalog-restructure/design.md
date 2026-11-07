# Design: catalog-restructure

## Context

The catalog is 20 flat `*.bundle.json` files in `pkg/catalog/`
(`pkg/src/apps/catalog.ts`, 93 lines, statically imports all 20 into a
`CATALOG` array; explicit import list, alphabetical by id — required
because the Worker has no directory listing at runtime; listing summaries
derived around line 73 into `CatalogSummary`: id, name, label, icon,
category, description; `get_catalog_definition(id)` returns the full
definition or null). `tests/catalog-harness.ts` checks that every bundle
validates via `validateDefinition`, installs via `add_app` in a blank
store and holds its `stateSchema.initial`, that `list_catalog()` ids match
the directory contents exactly in alphabetical order, and that an unknown
id returns null. The harness is repo tooling outside `pkg/` (a Kody
publish syncs `pkg/` only).

Two directions converge on this restructure. First, recipes (Nov 6,
2026, user direction): every app is two parts, a `RECIPE.md` and a JSON
file; default is unattended install from the JSON alone; apps with a
non-trivial recipe get a new property: `installMode` `"recipe-or-json"`
(recipe for full configuration; JSON install also works) or
`"recipe-only"` (must be installed via the recipe; no current members).
The App Store is the example of a recipe-or-json app, and the starter
collection recipe installs it together with Help and About. Second, the
catalog sequence:
`catalog-out-of-pkg` (pending) moves the catalog to the repo root and
`public-pinned-catalog` publishes it — both need per-app directories and
an index rather than flat files. This change lands the directories and
the index while the catalog is still in `pkg/` and still statically
imported, so the later move is a directory move, not a redesign.

The empty-install change already landed (branch `main`, HEAD `dc062f6`):
a fresh install opens with an empty registry, no App Store seeded, and
the Apps page shows Help-style help text with two copy-paste prompts —
"Add your own apps" first, "Install the App Store" second, the latter
agent-only (`install_from_catalog('app-store')`, verified with
`list_apps`). This change keeps that shape and extends the App Store
prompt to the three apps the starter collection recipe installs.

## Goals / Non-Goals

Goals:

- Per-app directories: `pkg/catalog/<id>/definition.json` +
  `pkg/catalog/<id>/RECIPE.md` for all 20 apps; definitions moved
  unchanged, no `catalogVersion` bumps for the move.
- A generated `pkg/catalog/catalog.json` index (id, label,
  catalogVersion, fingerprint, installMode, definitionPath, recipePath),
  idempotent, enforced fresh by the harness.
- `installMode` declared in the definition, only on apps with a
  non-trivial recipe (`"recipe-or-json"` or `"recipe-only"`);
  fingerprints unchanged for every installed app.
- The recipe model recorded: a procedure of steps, each install step
  naming one app, several installs allowed in one recipe; two modes
  (`recipe-only`, `recipe-or-json`); the App Store recipe installs the
  Store alone; a separate starter collection recipe installs app-store
  + help + about; the empty-state prompt points at the collection
  recipe.
- `catalog.ts` repointed, index-driven listings, explicit import list kept.

Non-Goals:

- The out-of-`pkg/` catalog move, making anything public, the Store
  recipe-prompt UI, per-app READMEs, fetch-on-demand install (see
  proposal.md Impact).
- Where a custom (non-catalog) app's recipe is stored — open question,
  not decided here.
- Whether Store updates re-run recipes — open question, assumed
  install-time only (see Open Questions).

## Decisions

### Decision 1: installMode lives in the definition — DECIDED, with the exact code reason

The declaration lives in the definition, following the `catalogVersion`
precedent exactly. Read from `pkg/src/apps/registry.ts` (HEAD `dc062f6`):

- `validateDefinition` (line 565) validates known fields one by one; it
  does NOT reject unknown top-level fields (only the retired `kind` is
  rejected) — so an optional `installMode` field passes validation today,
  unvalidated. The change adds a clause: if present it must be `'json'`,
  `'recipe-only'`, or `'recipe-or-json'`, following the `catalogVersion`
  precedent. Safe on
  count (a): validation accepts the field, and the new clause makes it
  properly checked rather than silently ignored.
- `canonicalizeDefinition` (line 728) builds the stored form from an
  explicit whitelist — id, name, label, schemaVersion, icon, category,
  description, capabilities, bundle, ui, stateSchema, actions, plus
  `catalogVersion` when present. A field not in the whitelist is dropped
  from the stored/exported definition (the "unknown benign attributes are
  stripped" rule noted near line 122). So `installMode` must be added to
  the preserve list, like `catalogVersion`, or it would vanish on install.
- `fingerprintDefinition` (line 793) fingerprints the canonical form
  minus `catalogVersion`. Adding `delete canon['installMode']` on the same
  pattern keeps fingerprints stable. Status classification (~line 1975)
  compares fingerprints only, and install snapshots record the fingerprint
  of the stored definition — so excluding the field there keeps snapshots
  and update statuses byte-identical. Safe on count (b): adding the field
  cannot mark any installed app as needing an update, and no
  `catalogVersion` bump is needed for adding it.
- Type: `installMode?: 'json' | 'recipe-only' | 'recipe-or-json'` on
  `AppDefinition` (`pkg/src/apps/types.ts`) with a doc comment. Read time:
  absent means `'json'`.

Consequence: only 3 definitions carry the field (app-store, daily-feed,
generic-feed — all `"recipe-or-json"`); the other 17 get no new property.
`"recipe-only"` has no current members. This matches the user's
"the JSON declares" wording: the declaration sits with the definition it
describes, not in a side index that could drift from it.

### Decision 2: the catalogVersion bump rule carves out installMode

The canonical "Catalog version" rule says `catalogVersion` increments
"on any change to that app's definition file". Read literally, adding
`installMode` would demand a bump on the three apps. That is not done,
deliberately: the bump rule exists so installed apps learn their catalog
copy changed, via fingerprint comparison in update status — and
`installMode` is excluded from the fingerprint, so it cannot change any
installed app's status. A bump would be pure churn that marks three apps
as needing an update for a field that changes nothing about them. The
spec delta states the carve-out explicitly so the rule stays honest
instead of being silently violated.

### Decision 3: recipe model — a procedure of steps; two modes; collection recipes

User direction (Nov 6, 2026): a recipe is a procedure made of steps, and
an install step names one app, so one recipe may install any number of
apps. Steps after install may ask the user for input, fetch data, or set
app state. A recipe is a separate procedure: it does not change what the
definition is. The app-store definition is just the App Store UI (its
bundle, state, actions); its own RECIPE.md installs and verifies the
Store alone.

Two modes (user direction, Nov 6, 2026):

- `"recipe-only"`: the app MUST be installed via its recipe. It still
  shows up in the App Store list, but instead of one-tap install the
  Store shows the recipe prompt (selectable text for the user to supply
  to their agent). No current members — the mode is defined, nothing
  carries it today.
- `"recipe-or-json"`: the app has a non-trivial recipe for full
  configuration AND can be installed unattended from JSON. In the Store
  it installs without the prompt message (one-tap install works); it
  lands unconfigured and the app's built-in empty-state prompt guides
  setup, while the recipe fully configures it at install time. Current
  members: app-store, daily-feed, generic-feed.

A collection recipe is a standalone recipe that installs a set of apps
together. It is not an app: it has no definition, no fingerprint, and no
catalogVersion. Proposed home (for the user to correct in review):
`pkg/catalog/collections/<name>/RECIPE.md`. Proposed first collection
(for the user to correct in review): id `starter`, installing
`app-store`, `help`, and `about` (one `install_from_catalog` step per
app, in that order), then verifying all three with `list_apps`. The
catalog index lists it in a `collections` section (Decision 5). Help
and About themselves stay unattended JSON installs with no new property.

The empty-state "Install the App Store" prompt points at the collection
recipe, not at the app-store's own recipe: same three apps, same verify
step. The prompt is the recipe in the user's hands, so drift between
them is a bug — enforced by a store-harness prompt-sync check
(tasks §7) that asserts the prompt names app-store, help, and about
and the verify step, matching the collection recipe's install steps.

The Store bundle change that renders the recipe prompt for
`recipe-only` rows is a follow-up; this change lands the `installMode`
data it reads (see proposal.md Impact).

### Decision 4: which apps get non-trivial recipes (verified by inspection, Nov 6)

Each app's own definition, Help text, empty states, and prompts were
inspected; non-trivial only where setup beyond install is genuine:

- `app-store` (`recipe-or-json`): its definition is just the Store UI;
  one-tap install installs the Store alone. Its own recipe installs and
  verifies the Store alone. The Store plus Help and About is a separate
  collection recipe, not the app-store recipe (Decision 3).
- `daily-feed` (`recipe-or-json`): `feed` state starts empty; no feeds
  capability; the bundle empty state carries an agent prompt to push the
  first items via `set_feed` (read current state, prepend one new RSS
  item, newest first, at most 14 items, set the full feed; do not
  overwrite if the current feed cannot be read or parsed). Unattended
  install lands with an empty feed and the built-in prompt guides setup;
  the recipe fully configures it.
- `generic-feed` (`recipe-or-json`): `feed` starts empty; needs an RSS URL
  from the user, then fetch + `set_feed` (newest first, max 14; do not
  overwrite if fetch/parse/current-state read fails). Unattended install
  lands unconfigured and the built-in prompt (blank RSS URL) guides
  setup; the recipe fully configures it.
- `"recipe-only"`: no current members. The mode is defined (Decision 3)
  but nothing carries it today.
- Refuted, JSON-only: `hoodie-weather` ships a working default place
  (Seattle, WA) and a browser "Change place / Search for a city" UI
  (`set_location` with lat/lon/label, `restore_default`) — no agent
  setup required. `xkcd` fetches `https://xkcd.com/rss.xml` live via the
  feeds capability; `set_feed` is only a fallback "when live fetch is
  blocked". `news` uses fixed BBC feeds via the feeds capability and works
  out of the box. The other 14 apps (about, arrow-game, calculator,
  calendar, cellular-playground, clock, counter, eight-ball, help,
  link-drop, mac-puzzle, probe, settings, three-bit-art) are static,
  seeded, or self-contained.
- Trivial recipe (17 apps): install the sibling `definition.json` via
  `install_from_catalog('<id>')`, then verify with `list_apps`.

### Decision 5: the generated index

- Location `pkg/catalog/catalog.json`, generated by
  `scripts/build-catalog-index.ts` (repo tooling, outside `pkg/`; run with
  bun from the repo root). It walks `pkg/catalog/*/definition.json`, reads
  id/label/catalogVersion, computes the fingerprint with the existing
  `fingerprintDefinition` imported from `pkg/src/apps/index.ts` (never
  reimplement the hash), reads `installMode` (absent means `'json'`) and
  recipe presence, and writes entries sorted by id: id, label,
  catalogVersion, fingerprint, installMode, definitionPath, recipePath
  (paths relative to `pkg/catalog/`, e.g. `app-store/definition.json`,
  `app-store/RECIPE.md`). Deterministic: run twice, byte-identical (sha256).
  `pkg/catalog/README.md` states that editing an app requires re-running
  the generator; the harness fails on a stale index.
- Collections: the index also carries a `collections` section (proposed
  name), one entry per collection directory: id, recipePath, and the apps
  it installs in order (for example id `starter`, recipePath
  `collections/starter/RECIPE.md`, apps `["app-store", "help", "about"]`).
  A collection entry has no definition, fingerprint, or catalogVersion.
  Proposed: the home `pkg/catalog/collections/<name>/RECIPE.md` and the
  first collection id `starter`; both are proposed, for the user to
  correct in review. The generator walks `pkg/catalog/collections/*/`
  for the section; the harness fails if the section does not match the
  collections directories.
- Why an index at all while definitions stay statically imported: the
  listing summaries (`catalog.ts` ~line 73) currently re-derive id/label
  and friends from the imported definitions; the index becomes the single
  listing source the Store will later read on demand, and it is the seam
  `catalog-out-of-pkg` builds on. Definitions stay imported because the
  Worker cannot list a directory at runtime and install needs the full
  definition.

### Decision 6: catalog.ts keeps the explicit import list

Repoint the 20 imports to `<id>/definition.json`; import the generated
`catalog.json`; drive the listing summaries from the index (membership +
alphabetical order), filling name/icon/category/description from the
imported definitions; add `installMode` to `CatalogSummary` from the
index. Header comment rewritten (app dirs, generated index, explicit
import list still required — no directory listing in the Worker). No
dynamic import, no fetch: the index is the seam for later, not a fetch
mechanism now.

## Open Questions

- Updates: does a Store update of a recipe app re-run its recipe?
  Presumably install-time only — recipes set up first-run state, and
  re-running could clobber user state (e.g. daily-feed's feed). Left open
  for review; the implementation assumes install-time only and does not
  re-run recipes on update.
- Custom apps: where does a non-catalog (user-added) app's recipe live?
  Not decided; out of scope for this change (catalog apps only).
- `catalog-out-of-pkg` reconciliation: that change's manifest field list
  (id, name, label, icon, category, description, catalogVersion, bundle
  path, fingerprint) predates `installMode`, `recipePath`, and the
  `collections` section; when it is implemented its manifest must carry
  them (or the index moves with the dirs). Flagged, not fixed here.
- Version: MINOR recommended (new index + recipe files, no behaviour
  change for installed apps); decided in the implementation commit. Build
  +1 on publish either way, per `pkg/AGENTS.md`.

