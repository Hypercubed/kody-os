# App Registry (data-driven app layer)

## Purpose
Capture the shipped Phase 2 app-layer contract — schema, MCP interface, atomicity, export format — so new effect ops, templates, or Phase 3 vocabulary work extend it without breaking the dual UI/MCP rule.

## Requirements

### Requirement: App definition schema
Every app definition SHALL carry: `id` (stable slug `^[a-z0-9][a-z0-9-]{0,63}$`, used for routes and storage keys), `name` (display name), `label` (tile label, defaults to `name`), `schemaVersion` (integer matching the current `DEFINITION_SCHEMA_VERSION`), optional `icon` (plain-text glyph, never emoji, OR sanitized inline SVG), optional `category`, `bundle` (entry `index.html`, relative `.html`/`.js`/`.css` only, 256 KiB cap), `stateSchema` (typed fields plus initial), and `actions` (args schema plus generic `set`/`append` effects, atomic single-write).

#### Scenario: Invalid definition is rejected with a reason
- **WHEN** `add_app` receives a definition with a bad id, bad bundle path, undeclared state field, or a UI action referencing no declared action
- **THEN** it returns `{ ok: false, error }` naming the problem and writes nothing.

#### Scenario: Unknown template still rejected with reason
- **WHEN** `add_app` receives a definition with a template outside the closed set
- **THEN** it returns `{ ok: false, error }` naming the template and writes nothing.

#### Scenario: Stale version on a new id is rejected with the current version named
- **WHEN** `add_app` receives a new id whose `schemaVersion` is missing or older than current
- **THEN** it returns `{ ok: false, error }` naming the current version and writes nothing.

#### Scenario: Overwrite restamps to current
- **WHEN** `add_app` re-adds an existing id
- **THEN** the stored definition carries the current `schemaVersion` regardless of what was submitted.

#### Scenario: Unified app round-trips
- **WHEN** a unified app is exported then imported into a blank install
- **THEN** definition and state are deep-equal to the originals, including `schemaVersion`.

#### Scenario: Pre-version installs backfill on read
- **WHEN** an app installed before versioning is read back
- **THEN** it reports the current version if it validates against the current shape, else the oldest known version — so stale apps are listable.

#### Scenario: SVG icon accepted
- **WHEN** `add_app` receives a definition with a sanitized inline-SVG icon
- **THEN** it returns `{ ok: true, id }` and the icon renders as SVG on tiles.

### Requirement: MCP interface with shared state and handlers
The package SHALL expose `list_apps`, `get_app_state`, `act`, `add_app`, `remove_app`, `export_app` (plus `get_app` and `import_app`) with the same state and same handlers the UI uses: UI form submissions funnel through `actFromForm` into the same `act()` MCP calls.

#### Scenario: Add appears with no republish
- **WHEN** an agent calls `add_app` with a valid definition
- **THEN** it returns `{ ok: true, id }` and the app immediately appears in `list_apps()` and on the Apps page, with no package republish.

#### Scenario: UI and MCP see the same state
- **WHEN** an action is applied via a UI form submission and read back via MCP `get_app_state` (or vice versa)
- **THEN** both observe the identical updated state on refresh.

### Requirement: Actions validate before mutating (atomicity)
State SHALL live only in storage. Every action SHALL be validated (args coerced and range-checked against the schema, effect applied to a copy, result re-validated against the state schema) BEFORE any write. A bad action SHALL return `{ ok: false, error }` and change nothing — no partial state change. The single state write per action is the only mutation point.

#### Scenario: Out-of-range arg changes nothing
- **WHEN** `act` is called with an arg outside its declared max
- **THEN** it returns `{ ok: false }` with a naming error and a re-read of the state is byte-identical to before.

### Requirement: Export and re-import
`export_app` SHALL return a complete `kody-os-app/2` envelope: format tag, export timestamp, full definition, and a state snapshot. `import_app` SHALL install an export envelope (or bare definition) into a blank install with no code changes, restoring the snapshotted state when present and valid. `kody-os-app/1` (name-keyed) payloads SHALL import with id derived from name. Re-importing over an installed id without `overwrite: true` SHALL be rejected. `export_install` and `import_install` SHALL be public package exports: `export_install` SHALL return the full install envelope (apps, definitions, states, pins, hidden, homepage; recency excluded) and `import_install` SHALL install an envelope into a blank store. The install envelope SHALL carry a format tag so future app kinds restore without breaking current readers.

#### Scenario: Export then blank-install re-import round-trips
- **WHEN** an app is exported, imported into a fresh store, and its state is read back
- **THEN** the definition and state are deep-equal to the originals.

#### Scenario: Install envelope round-trips through a blank store
- **WHEN** an install with apps, states, pins, hidden flags, and homepage order is exported and imported into a blank store
- **THEN** definitions, states, pins, hidden flags, and homepage order match, and Recent starts empty.

### Requirement: Export carries user prefs, not recency

`export_app` SHALL remain definition + state only. Pin, hide, and homepage order membership SHALL export as part of the install (registry-level user prefs) and re-import restores them; the recency list SHALL NOT export (ephemeral per-install behavior).

#### Scenario: Re-import restores prefs but not recency
- **WHEN** an install with pins, hidden apps, homepage order, and recent use is exported and imported into a blank install
- **THEN** pins, hidden flags, and homepage order match, and Recent starts empty.

### Requirement: Storage layout and budget
Registry and state SHALL live under `packageStorage()` keys `kody-os.apps.registry` (id list), `kody-os.apps.def.<id>`, and `kody-os.apps.state.<id>`, within the 16 MiB durable-storage budget (definitions stay small JSON). Outside Kody (local runs, tests) the same code SHALL fall back to a shared in-memory store; `createMemoryStore()` SHALL provide isolated blank installs for round-trip tests.

#### Scenario: Keys are namespaced and portable
- **WHEN** two apps are installed and the storage keys are listed
- **THEN** every key starts with `kody-os.apps.` and the definitions remain small plain JSON with no code strings.

### Requirement: Pinned, hidden, and recency lists

The registry SHALL store three lists beside the app registry in `packageStorage()`: pinned app ids (user order), hidden app ids, and recent app ids (most recent first, capped at a fixed count). All three SHALL default to empty on a fresh install and SHALL live under the same `kody-os.apps.*` key namespace and 16 MiB budget as the registry.

#### Scenario: Fresh install has empty lists
- **WHEN** the lists are read before any pin, hide, or use
- **THEN** each returns empty and the Apps page renders as if the feature were absent.

### Requirement: Homepage order list

The registry SHALL store a homepage order list of app ids under `kody-os.apps.homepage`, defaulting to empty. Reordering SHALL persist the new order with a single write. Removing an app from the homepage list (without uninstalling) SHALL keep its pin, hidden state, definition, and state untouched.

#### Scenario: Order persists across loads
- **WHEN** homepage widgets are moved up and down and the page is reloaded
- **THEN** the order matches the last saved sequence.

### Requirement: Recency records on view and act

Every successful `act()` and every app page render SHALL move that app id to the front of the recency list (capped, duplicates collapsed), so UI and MCP use both count as use. Clearing SHALL empty the list without touching apps, pins, or hidden flags.

#### Scenario: MCP-only use appears in Recent
- **WHEN** an app is acted on via MCP without ever opening its page
- **THEN** it appears at the front of Recent on the next Apps page render.

### Requirement: Definitions are declarative, never eval'd
App definitions SHALL contain data only. The shell and registry SHALL never store or blindly evaluate JavaScript from an imported definition; only the four declared effect ops execute.

#### Scenario: Code strings are inert
- **WHEN** an imported definition contains string fields that look like code
- **THEN** they are rendered as escaped text and never executed.

### Requirement: remove_app uninstalls cleanly

`remove_app` SHALL delete the app's definition and state and scrub all of its references (pinned, hidden, recency, homepage order) atomically: either everything is gone or nothing changed. Removing an unknown id SHALL return `{ ok: false }` with a naming error and write nothing. Removing any installed app, including the App Store, SHALL be allowed exactly like any other app. `remove_app` SHALL be exposed only through the MCP surface; the browser shell SHALL NOT call it or render a removal control.

#### Scenario: Full uninstall leaves no references
- **WHEN** `remove_app` runs on an installed app that is pinned, hidden, and recently used
- **THEN** it returns `{ ok: true, id }`, the definition and state keys are gone, and no list anywhere in storage still names the id.

#### Scenario: Removing an unknown app is a clean error
- **WHEN** `remove_app` is called with an id that is not installed
- **THEN** it returns `{ ok: false }` naming the id and writes nothing.

### Requirement: Same-id overwrite preserves references
Re-adding an existing id via `add_app` SHALL overwrite the definition, preserve state by default (declared fields carried forward, dropped fields reset to `initial`), and leave registry order, pins, hidden flags, homepage placement, and recent entries untouched (only `remove_app` scrubs reference lists). Passing `resetState: true` SHALL reset state to `initial` instead. Passing `migrate` SHALL map old field names to new ones with validator-checked values: an unmappable field aborts the whole re-add with `{ ok: false }` and no state change.

#### Scenario: Re-added app keeps its route and pins
- **WHEN** an installed app (pinned, on homepage) is re-added under the same id
- **THEN** `GET /apps/<id>` renders the new definition and the id remains in the pinned and homepage lists.

#### Scenario: Re-add preserves state by default
- **WHEN** an installed app with user-modified state is re-added without options
- **THEN** declared fields keep their stored values and only dropped fields reset to `initial`.

#### Scenario: resetState restores the legacy wipe
- **WHEN** an installed app is re-added with `resetState: true`
- **THEN** state resets to `initial` exactly as the pre-v4 rule required.

#### Scenario: Unmappable migrate aborts without writing
- **WHEN** a re-add passes `migrate` with an old field that cannot map to the new shape
- **THEN** `add_app` returns `{ ok: false, error }` and stored state is byte-identical to before the call.

### Requirement: v4 drops the frozen ui.template stub
`ui.template` (`hello | generic | clock`) is render-ignored — the shell always renders bundle + state + forms and never branches on it. Version-4 definitions SHALL NOT carry `ui.template`: the v4 validator rejects a definition containing it, and the v4 restamp strips it from example apps. Stored v3 definitions keep working on read (the field rides along inertly); it disappears on re-add under v4.

#### Scenario: v4 definition with template rejected
- **WHEN** `add_app` receives a schemaVersion-4 definition containing `ui.template`
- **THEN** it returns `{ ok: false, error }` naming the removed field and writes nothing.

#### Scenario: Restamped apps carry no template
- **WHEN** the example apps are restamped to schemaVersion 4
- **THEN** no stored definition contains `ui.template` and a repo grep for `template` in `pkg/src` hits only the v3-legacy validator branch.

### Requirement: `ui.menuBar` definition flag

App definitions MAY carry `ui.menuBar`, a boolean. When true,
the app also appears in the top menu bar while installed (see
the shell spec delta); when absent or false, it does not. A
non-boolean `ui.menuBar` SHALL be rejected by
`validateDefinition` and SHALL write nothing. `add_app` SHALL
preserve `menuBar` through canonicalization, and export/import
SHALL round-trip it. `list_apps()` summaries SHALL always
carry `menuBar: boolean`, false when the field is absent.
Catalog install and update SHALL carry the flag with the
definition, like any other `ui` field.

#### Scenario: Flag validates and lists

- **WHEN** `add_app` receives a definition with
  `ui.menuBar: true`
- **THEN** it installs, and `list_apps()` shows that app with
  `menuBar: true`.

#### Scenario: Absent flag reads false

- **WHEN** an installed definition has no `ui.menuBar`
- **THEN** `list_apps()` shows it with `menuBar: false`, and
  no menu link is rendered for it.

#### Scenario: Bad flag writes nothing

- **WHEN** `add_app` receives `ui.menuBar: "yes"`
- **THEN** it returns an error and storage is untouched.

#### Scenario: Flag survives export and import

- **WHEN** a flagged app is exported and imported into a
  blank store
- **THEN** the imported definition still carries
  `ui.menuBar: true`.

### Requirement: Shipped catalog

The Store's catalog SHALL be the manifest (`catalog/catalog.json`)
and definitions fetched server-side from a catalog source declared
by the calling Store, not from definitions shipped in `pkg/`, and not from a catalog source hardcoded
in the shell. The shell SHALL hold no catalog source of its own: no
repo, release, or base URL is a constant in the shell source. The
Store SHALL display the declared catalog source it is reading. The
manifest's `installMode` SHALL drive the Store row: a `recipe-only`
row shows the agent prompt instead of one-tap install. Fetching
SHALL be HTTPS-only with an 8,000 ms timeout; the definition fetch
SHALL allow at least 256 KiB; definition and recipe paths SHALL come
from the manifest entry only, never from a request parameter.
Install snapshots SHALL continue to record install-time
`catalogVersion` plus a content-only fingerprint, and Store status
classification SHALL continue to compare installed definitions and
snapshots against the remote definitions with no change to the status
set or its rules. If the catalog manifest fetch fails, the Store
SHALL show installed apps with their known status plus an honest
catalog error with retry, and SHALL NOT show a blank Store; any
cached manifest used as fallback SHALL be labeled as cached with its
source. `list_catalog` and `get_catalog_definition` are async (the
remote fetch is necessarily async); MCP catalog tools keep their
shapes.

#### Scenario: Declared catalog source is used
- **WHEN** the calling Store declares a catalog base of
  `https://raw.githubusercontent.com/Hypercubed/kody-os/main/catalog/`
- **THEN** the manifest and definitions are fetched from under that
  base.

#### Scenario: No hardcoded catalog source
- **WHEN** the shell source is searched for a catalog repo, release,
  or base URL constant
- **THEN** none is found.

#### Scenario: Every catalog file validates and installs
- **WHEN** each `definition.json` in `catalog/<id>/` is submitted to `add_app` in a blank store
- **THEN** each returns `{ ok: true, id }` and appears in `list_apps()`.

#### Scenario: Unimported file is not listed
- **WHEN** an app directory exists in `catalog/` with no manifest entry
- **THEN** the App Store listing omits it and the catalog harness fails.

#### Scenario: Catalog listing order is deterministic
- **WHEN** the catalog is listed
- **THEN** entries appear in manifest order (alphabetical by id).

#### Scenario: On-disk layout
- **WHEN** an agent opens a catalog app directory
- **THEN** it holds `definition.json`, `RECIPE.md`, and `index.html`.

#### Scenario: Assembled definition installs
- **WHEN** a catalog definition with on-disk bundle files is submitted to `add_app` in a blank store
- **THEN** it returns `{ ok: true, id }` and the bundle renders with its referenced files inlined.
### Requirement: Bundle files on disk

A catalog app's bundle files SHALL live on disk as real files in the app directory: `index.html` (required, the entry) plus zero or more `.js` / `.css` files, flat next to `definition.json` and `RECIPE.md`. `definition.json`'s `bundle` SHALL be a manifest `{ entry: "index.html", files: [...] }` listing the file paths; the loader SHALL assemble the runtime files map from the on-disk files (via the catalog-index generator for the manifest, and via remote bundle-file fetches for install). The inline form (`files` as a map of contents) SHALL stay valid for `add_app` transport and stored definitions; a definition carrying both forms is an error. The fingerprint SHALL hash the assembled canonical form, unchanged.

#### Scenario: Manifest assembles to the runtime map
- **WHEN** a definition carries a manifest listing `index.html` and `app.js`
- **THEN** the assembled files map holds both contents and validates.

#### Scenario: Inline form still validates
- **WHEN** a definition carries `files` as an inline map of contents
- **THEN** it validates and installs unchanged.

#### Scenario: Both forms is an error
- **WHEN** a definition carries both a file list and a files map
- **THEN** validation rejects it as ambiguous.

#### Scenario: Fingerprint is content-based
- **WHEN** the same bundle content is extracted from inline to on-disk form
- **THEN** the assembled fingerprint is unchanged.

### Requirement: Bundle references resolve by inlining

The entry HTML SHALL reference its JS/CSS files explicitly by relative path (`<script src="app.js">`, `<link rel="stylesheet" href="style.css">`). The loader SHALL inline each referenced file at serve time, so the served document is a single self-contained HTML document. A reference that does not resolve to a manifest file is an error; an unreferenced `.js` / `.css` file is an error; an unreferenced `.html` file other than the entry is ignored. The append fallback (executing unreferenced files) is removed; only referenced assets execute.

#### Scenario: Script reference inlines
- **WHEN** the entry has `<script src="app.js"></script>` and the manifest lists `app.js`
- **THEN** the served document carries the script inline with no `src` attribute.

#### Scenario: Stylesheet reference inlines
- **WHEN** the entry has `<link rel="stylesheet" href="style.css">` and the manifest lists `style.css`
- **THEN** the served document carries the style inline.

#### Scenario: Dangling reference is an error
- **WHEN** the entry references `app.js` and the manifest does not list it
- **THEN** validation rejects the definition.

#### Scenario: Dead file is an error
- **WHEN** the manifest lists `app.js` and the entry does not reference it
- **THEN** validation rejects the definition.

#### Scenario: Unreferenced HTML is ignored
- **WHEN** the manifest lists an extra `.html` file
- **THEN** it is not served and validation passes.

#### Scenario: Absolute URL is rejected
- **WHEN** a reference uses an absolute or external URL
- **THEN** validation rejects the definition.

### Requirement: Catalog index

The repo SHALL carry a generated catalog index at `catalog/catalog.json`, listing every catalog app sorted by id. Each entry SHALL carry: id, label, catalogVersion, fingerprint, installMode, definitionPath, recipePath, bundleFiles (the bundle file paths, sorted, relative to the app directory). definitionPath and recipePath are relative to `catalog/` (for example `app-store/definition.json`, `app-store/RECIPE.md`). The index SHALL be generated by `scripts/build-catalog-index.ts` from the app directories, never hand-written; the generator SHALL assemble each definition's bundle files from disk before fingerprinting (failing on a missing or unresolvable bundle file), compute each fingerprint with the existing `fingerprintDefinition`, and SHALL read installMode from the definition (absent means `json`). Regenerating the index from unchanged definitions SHALL produce byte-identical output. The catalog harness SHALL fail if the index does not match the directories and the definitions (ids, alphabetical order, catalogVersions, fingerprints, install modes, bundle files).

#### Scenario: Index lists every app once, sorted
- **WHEN** the generator runs over the app directories
- **THEN** `catalog/catalog.json` has one entry per app directory, sorted by id, each with id, label, catalogVersion, fingerprint, installMode, definitionPath, recipePath, and bundleFiles.

#### Scenario: Generator is idempotent
- **WHEN** the generator runs twice over unchanged definitions
- **THEN** both outputs are byte-identical.

#### Scenario: Stale index fails the harness
- **WHEN** a definition changes without re-running the generator (or an app directory is added without an index entry)
- **THEN** the catalog harness reports the index mismatch and fails.

#### Scenario: Index records bundle files
- **WHEN** the generator runs over the app directories
- **THEN** each entry carries `bundleFiles` listing the manifest files, sorted.

#### Scenario: Missing bundle file fails generation
- **WHEN** a manifest lists a file that is not on disk
- **THEN** the generator fails and writes no index.

#### Scenario: Index lists collection recipes
- **WHEN** the generator runs over the app directories
- **THEN** `catalog/catalog.json` has no `collections` section and lists no collection recipes — collection recipes no longer exist.

### Requirement: App recipe

Each catalog app SHALL ship a `RECIPE.md` beside its `definition.json` in `catalog/<id>/`. A recipe is a procedure made of steps: each install step names exactly one app, and a recipe installs only its own app: one install step, naming the sibling definition. Steps after install MAY ask the user for input, fetch data, or set app state. The default recipe is trivial: install the sibling `definition.json` via `install_from_catalog('<id>')`, then verify with `list_apps`. A non-trivial recipe SHALL exist only where the app genuinely needs setup beyond install. An app's own recipe covers that app alone: the App Store recipe installs `app-store` and verifies it with `list_apps`. Help and About are not catalog apps: they are built-in shell pages with no definition and no recipe (see Help is a built-in shell page). A recipe SHALL NOT install any app other than its own; there is no collection recipe.

#### Scenario: Every app directory has a recipe
- **WHEN** the catalog directories are listed
- **THEN** each `<id>/` contains `definition.json` and `RECIPE.md`.

#### Scenario: Trivial recipe installs and verifies
- **WHEN** an agent follows a trivial recipe
- **THEN** the app is installed from its sibling `definition.json` and appears in `list_apps()`.

#### Scenario: An app recipe installs its own app alone
- **WHEN** an agent follows the App Store recipe
- **THEN** `app-store` is installed and verified with `list_apps()`, and no other app is installed.

### Requirement: Recipe install mode

A catalog definition MAY carry `installMode`: `"json"` or `"recipe-only"`. Absent means `"json"` — unattended install from the JSON alone. `"recipe-only"` means the app MUST be installed via its recipe: it still appears in the App Store list, but the Store shows the recipe prompt (selectable text for the user to supply to their agent) in place of one-tap install. Only an app with a non-trivial recipe SHALL carry `installMode`; most definitions SHALL carry no such property. A definition with `installMode` present SHALL fail validation unless the value is `"json"` or `"recipe-only"`. The canonical stored definition SHALL preserve `installMode` through `add_app` normalization, and `installMode` SHALL be excluded from the definition fingerprint, exactly like `catalogVersion`, so adding it SHALL NOT change any installed app's fingerprint, snapshot, or update status.

#### Scenario: Unattended install is the default
- **WHEN** a catalog definition carries no `installMode`
- **THEN** it installs from the JSON alone with no recipe step, and its listing reports install mode `json`.

#### Scenario: Recipe-only app declares its mode
- **WHEN** a catalog definition carries `"installMode": "recipe-only"`
- **THEN** it validates, its stored definition preserves the field, its listing reports install mode `recipe-only`, and the Store lists it with the recipe prompt in place of one-tap install.

#### Scenario: No app is recipe-only today
- **WHEN** the catalog is listed
- **THEN** no entry reports install mode `recipe-only`; all 18 report `json`.

#### Scenario: Invalid install mode fails validation
- **WHEN** a definition carries an `installMode` other than `"json"` or `"recipe-only"`
- **THEN** validation rejects it.

#### Scenario: installMode does not change fingerprints
- **WHEN** the fingerprint of an app's definition is computed with and without its `installMode` field
- **THEN** the two fingerprints are identical, and no installed copy of the app changes update status.

### Requirement: Install from the catalog without an agent

Installing a catalog app SHALL read its bundled definition and load it into
the data store through the validated `add_app` path, with no agent, MCP
call, or republish. The install helper SHALL return `{ ok: false }` naming
an unknown id and write nothing. Installing an app that is already
installed SHALL preserve its state by default (the `add_app` rule) and
SHALL NOT reset state, pin the app, add it to the homepage, or add it to
the recency list. An installed catalog app SHALL act, export, and
re-import exactly like any other app.

#### Scenario: Browser install loads definition and initial state
- **WHEN** a catalog app that is not installed is installed from the store
- **THEN** its definition and `stateSchema.initial` state are stored, and it appears in `list_apps()` and on the Apps page.

#### Scenario: Unknown catalog id installs nothing
- **WHEN** install is requested for an id with no catalog definition
- **THEN** it returns `{ ok: false }` naming the id and storage is byte-identical to before.

#### Scenario: Re-install preserves state
- **WHEN** an installed catalog app with user-modified state is installed again
- **THEN** its stored state is unchanged and its pins, hidden flags, and homepage placement are untouched.

#### Scenario: Install has no launcher side effects
- **WHEN** a catalog app is installed from the store
- **THEN** it is neither pinned, nor on the homepage, nor in Recent until the user pins it, adds it to home, or uses it.

### Requirement: Catalog version

Every catalog definition SHALL carry `catalogVersion`: a positive integer, starting at 1 on that app's first versioned release, incremented by exactly 1 on any change to that app's definition file, never reused, never decreased, and never bumped for an unrelated app or a shell change. `catalogVersion` is distinct from `schemaVersion` (definition format era) and from the shell's package version. A catalog definition without a valid `catalogVersion` SHALL fail catalog validation. The canonical stored definition SHALL preserve `catalogVersion` through `add_app` normalization. Adding `installMode` to a definition SHALL NOT require a `catalogVersion` bump: the field is excluded from the definition fingerprint, so it cannot change any installed app's update status (see Recipe install mode). Removing `installMode` from a definition SHALL NOT require a `catalogVersion` bump either, for the same reason. Extracting bundle files from the inline form to on-disk files SHALL NOT require a `catalogVersion` bump: the assembled canonical definition is byte-identical, so the fingerprint is unchanged and no installed copy is marked as needing an update (see Bundle files on disk).

#### Scenario: Catalog definition carries a version
- **WHEN** a catalog definition is validated
- **THEN** it is rejected if `catalogVersion` is missing, non-integer, or less than 1.

#### Scenario: Installed copy keeps its catalog version
- **WHEN** a catalog app is installed through `add_app`
- **THEN** the stored definition carries the catalog definition's `catalogVersion`.

#### Scenario: Adding installMode needs no version bump
- **WHEN** `"installMode": "recipe-only"` is added to a catalog definition with no other change
- **THEN** its `catalogVersion` stays the same, its fingerprint is unchanged, and no installed copy is marked as needing an update.

#### Scenario: Removing installMode needs no version bump
- **WHEN** `installMode` is removed from a catalog definition with no other change
- **THEN** its `catalogVersion` stays the same, its fingerprint is unchanged, and no installed copy is marked as needing an update.

#### Scenario: Extraction needs no version bump
- **WHEN** a catalog definition's bundle files are extracted from inline to on-disk form with byte-identical contents and no other change
- **THEN** its `catalogVersion` stays the same, its fingerprint is unchanged, and no installed copy is marked as needing an update.

### Requirement: Install snapshot

A store install or store update of a catalog app SHALL record a snapshot
separate from the definition, containing the `catalogVersion` at install
time and a deterministic fingerprint of the definition as actually stored
(after `add_app` normalization, never of the raw catalog file). Generic
`add_app` and `import_app` SHALL NOT write the snapshot, and the snapshot
SHALL NOT be part of an exported definition. `remove_app` SHALL delete
the snapshot with the app. A store update SHALL replace the snapshot
with the new version and fingerprint after a successful update.

#### Scenario: Store install records a snapshot
- **WHEN** a catalog app is installed from the store
- **THEN** a snapshot exists recording its `catalogVersion` and the fingerprint of its stored definition.

#### Scenario: Generic re-add does not move the snapshot
- **WHEN** an installed catalog app's definition is replaced through generic `add_app`
- **THEN** the snapshot still records the version and fingerprint from the store install, so the app now differs from its snapshot.

#### Scenario: Export does not carry the snapshot
- **WHEN** an installed catalog app is exported
- **THEN** the export contains its definition and state, but no snapshot, and importing it does not create a snapshot.

### Requirement: Update status and confirmed updates

For an installed catalog app with a snapshot, the store SHALL derive its
status from the installed definition's fingerprint (I), the snapshot
fingerprint (S), the current catalog definition's fingerprint (C,
canonicalized the same way), the installed `catalogVersion` (Iv), and
the catalog `catalogVersion` (Cv):

- I == C: up to date, clean; no update is offered. A Remove control is offered.
- I == S and Iv < Cv: behind, clean; an Update control is offered.
- I == S, Iv == Cv, and I != C: catalog-differing (the catalog changed
  without a version bump); an Update control is offered with no
  modification warning.
- I != S and I != C: modified; behind and modified when Iv < Cv,
  modified at the current version when Iv == Cv, and modified and ahead
  when Iv > Cv. A modified app SHALL never be offered a plain Update
  control; a behind-modified app is offered a confirmed Overwrite
  control instead, and a catalog copy SHALL never be offered as an
  Update to an ahead app.
- No snapshot: no status is claimed, but the store offers a confirmed
  Overwrite control: the installed definition is replaced with the
  catalog copy only after an explicit user confirmation, and a
  successful overwrite records a snapshot, so the app becomes managed
  afterwards.

Updating a modified app SHALL replace its definition with the catalog
copy only after an explicit user confirmation (see the shell spec delta
for the confirmation's required wording). The update SHALL preserve
state by the existing `add_app` rule (fields still declared carry
forward, dropped fields reset to `initial`) and SHALL NOT change pins,
hidden flags, homepage placement, or recency. The store SHALL never
auto-update an installed app.

#### Scenario: Clean behind app can update
- **WHEN** an installed catalog app matches its snapshot and its version is lower than the catalog's
- **THEN** the store offers Update, and updating replaces its definition, preserves state for surviving fields, and records a new snapshot.

#### Scenario: Modified behind app needs confirmation
- **WHEN** an installed catalog app differs from its snapshot and its version is lower than the catalog's
- **THEN** the store does not offer a plain Update control; it offers a confirmed Overwrite control whose confirmation states that definition changes will be lost while state for surviving fields is preserved.

#### Scenario: Modified current app offers restore, not update
- **WHEN** an installed catalog app differs from its snapshot at the catalog's version
- **THEN** the store offers Restore catalog version (with the same confirmation and warning), not Update.

#### Scenario: Ahead app is not offered an update
- **WHEN** an installed catalog app's version is higher than the catalog's
- **THEN** the store does not offer it as an update to the catalog copy.

#### Scenario: Snapshot-less app offers a confirmed Overwrite
- **WHEN** an installed catalog app has no snapshot
- **THEN** the store offers Overwrite, and confirming replaces its definition with the catalog copy, preserves state for surviving fields, and records a snapshot, so the app is managed afterwards.

#### Scenario: Update never runs on its own
- **WHEN** a republish ships a newer catalog definition
- **THEN** installed apps keep their stored definitions until the user chooses an update (or restore) from the store.

### Requirement: Catalog-only list

The store SHALL present a catalog-only list: one row per catalog id,
in alphabetical-by-id order. Each row's badge and controls SHALL
follow its state under the update-status requirement, plus these
rules:

- Not installed (catalog only): Add only. No Pin, Hide, Home, Update,
  Restore, or Open control.
- Installed: Update, Overwrite, Restore, or Remove according to the
  update-status requirement. Pin, Hide, and Home live in Apps Edit,
  not in the Store list.
- Installed with no catalog entry: no row. Such apps are managed
  from Apps Edit and by agents, not from the Store list.
- The App Store itself (`app-store`) appears as a row like any other
  app when installed; it is not excluded from its own list.
- The list is unfiltered: hidden apps appear in it. Hide affects
  the Apps launcher tiles only; unhiding happens in Apps Edit, not
  in the Store list.
- No launching from the catalog: a row for an app that is not installed
  SHALL offer no Open link to `/apps/:id`; a row for an installed app
  MAY link to its app page.

#### Scenario: Catalog ids appear once each
- **WHEN** an app is both in the catalog and installed
- **THEN** it appears exactly once in the list, with its installed status and controls.

#### Scenario: Catalog-only row offers install only
- **WHEN** a catalog app is not installed
- **THEN** its row offers Add and no Pin, Hide, Home, Update, Restore, or Open control.

#### Scenario: Storage-only app does not appear
- **WHEN** an installed app has no catalog entry
- **THEN** it has no row in the Store list.

#### Scenario: Hidden app still appears in the list
- **WHEN** an installed catalog app is hidden
- **THEN** its row still appears in the list, even though it is absent from the Apps launcher tiles, and it can be unhidden from Apps Edit.

#### Scenario: List is alphabetical by id
- **WHEN** the list is rendered with installed and uninstalled catalog apps
- **THEN** rows appear in alphabetical-by-id order regardless of state.

#### Scenario: Update preserves launcher placement
- **WHEN** a pinned, homepage app is updated or restored from the list
- **THEN** its pin and homepage placement are unchanged afterwards.

### Requirement: Bundle management API

The shell SHALL expose a GET-only management API for bundles declaring
`manageApps`: read store rows, install, update, and restore, reusing
the store install/update paths with snapshot, state-preservation, and
status rules unchanged. The acting app SHALL be named by the request,
and an app whose stored definition does not declare `manageApps`
SHALL receive the feed-style plain 404 with no write and no
capability detail. A behind-modified update, a snapshot-less
overwrite, any restore, and any update adding a capability SHALL
return a needs-confirmation response naming what is at stake, and
SHALL NOT apply until the bundle submits an explicit confirmation.
The management API is a browser path only; agents keep using
`install_from_catalog` / `update_from_catalog`, and the agent is
the installer that surfaces capabilities before calling them.

#### Scenario: An undeclared app is refused
- **WHEN** an app without declared `manageApps` calls the management API
- **THEN** the response is a plain 404, and no registry write occurs.

#### Scenario: A modified update waits for confirmation
- **WHEN** the Store requests an update for a behind-modified app
- **THEN** the API returns needs-confirmation, and only a confirm submission applies the update.

#### Scenario: A snapshot-less overwrite waits for confirmation
- **WHEN** the Store requests an update for a snapshot-less app
- **THEN** the API returns needs-confirmation, and only a confirm submission applies the overwrite and records a snapshot.

### Requirement: Declared capabilities

An app definition MAY declare `capabilities`: `feeds` (up to 8
allowlisted HTTPS upstream feeds, as before), `proxy` (up to 8
allowlisted generic HTTPS upstreams, same limits as feeds, served
via `GET /proxy/<app>/<name>`), and `manageApps` (boolean). Unknown
capability keys, non-boolean `manageApps`, non-HTTPS or credentialed
upstream URLs, duplicate upstream names, and out-of-range TTL/size
values SHALL fail validation with no write. Sanitization SHALL store
the canonical defaults-applied form. Store rows SHALL disclose
declared capabilities in plain words (manageApps as a statement,
feed and proxy hosts listed) before install. An update adding a
capability — `manageApps`, a new feed host, or a new proxy host —
SHALL require confirmation naming the additions; removing a
capability or changing only TTL/size parameters SHALL NOT.

#### Scenario: Unknown capability key fails validation
- **WHEN** a definition declares an unknown capability key
- **THEN** validation fails and nothing is written.

#### Scenario: Capability expansion requires confirmation
- **WHEN** a Store update would add a new proxy host
- **THEN** the API returns needs-confirmation naming that host, and declining changes nothing.

### Requirement: Empty registry stays empty

A shell request against an empty registry SHALL NOT install any app. Removing the last installed app SHALL leave the registry empty on the next shell request; no seeding, flag, or explicit-removal state SHALL re-install anything.

#### Scenario: Fresh install stays empty
- **WHEN** a blank store receives its first authenticated shell request
- **THEN** `list_apps` still returns an empty list and no app is installed.

#### Scenario: Removing the last app stays empty
- **WHEN** every app including the App Store has been removed and a shell request arrives
- **THEN** the registry is still empty and no catalog app is installed.

### Requirement: Display name is app

The display name of an installed unit SHALL be "app"
("apps" plural), the same as its internal name. The name SHALL
NOT change the definition schema, the MCP interface, storage
layout, catalog behaviour, or the export format. Only the Help
and App Store catalog definitions change for this requirement,
each with catalogVersion +1. The adding-an-app skill name and
path SHALL stay unchanged.

(Reversed 2026-11-06: the display name was briefly the hyphenated
diminutive form; the user chose plain "Apps" instead.)

#### Scenario: Display name is app, internal name is app
- **WHEN** a user reads the browser and an agent reads the MCP interface for the same installed unit
- **THEN** the browser calls it an app and the agent interface calls it an app, and both refer to the same definition, state, and id.

#### Scenario: Store display name changes, id does not
- **WHEN** the Store is listed in its own catalog list and fetched at its route
- **THEN** its row and page read "App Store", its id is still `app-store`, its route is still `/apps/app-store`, and `install_from_catalog('app-store')` still installs it.

#### Scenario: No other catalog definition is bumped
- **WHEN** the catalog is listed after this change
- **THEN** only the Help and App Store definitions have a higher catalogVersion than before, each by exactly 1, and every other catalog definition is byte-identical to before.

### Requirement: Launcher lists are readable through the package root

The package SHALL expose the launcher lists through the same root import agents already use for every other registry read: `get_pinned`, `get_hidden`, `get_recent`, and `get_homepage`, plus an aggregate `get_launcher_state()` returning `{ pinned, hidden, recent, homepage }`. Each reader SHALL return the stored ordered id list for its key, and `[]` when the key is missing, without writing anything. The aggregate SHALL return the four lists in their stored orders, equal to the four individual reader results. The readers SHALL be listed in `main()`'s `exports` array.

#### Scenario: Agent imports the readers from the package root
- **WHEN** an agent imports `get_pinned`, `get_hidden`, `get_recent`, `get_homepage`, `get_launcher_state`, and `clear_recent` from `kody:@hypercubed/kody-os` via `execute`
- **THEN** every import resolves and each call returns an array (or the aggregate object) with no bundle/import error.

#### Scenario: Aggregate matches the individual readers
- **WHEN** a store holds known pinned, hidden, recent, and homepage lists
- **THEN** `get_launcher_state()` returns exactly those four lists, in stored order, equal to the four individual reader results.

#### Scenario: Blank store reads empty without writing
- **WHEN** the readers and the aggregate are called against a blank store
- **THEN** each returns `[]` (aggregate: four empty lists) and the store is byte-identical before and after the calls.

#### Scenario: Readers track UI changes and removal scrubbing
- **WHEN** an app is pinned, hidden, and added to the homepage through the shell UI, then removed via `remove_app`
- **THEN** before removal the readers report it in the pinned, hidden, and homepage lists (matching what `/` and `/apps` render), and after removal no reader lists it in any list, while the other apps' memberships are unchanged.

#### Scenario: Reads are ungated like other registry reads
- **WHEN** an agent calls the readers over MCP
- **THEN** no credential is required, matching `list_apps` and `get_app_state`.

### Requirement: Agents can clear the recency list

The package SHALL expose `clear_recent()` through the package root and list it in `main()`'s `exports` array. Calling it SHALL empty the recency list and nothing else: apps, pins, hidden flags, and the homepage list are untouched, and the other three readers return the same lists before and after the call. It SHALL be ungated like the other registry writes.

#### Scenario: Agent clears recency from the package root
- **WHEN** an agent imports `clear_recent` from `kody:@hypercubed/kody-os` via `execute` and calls it on a store with a known recent list
- **THEN** the call resolves, `get_recent()` afterwards returns `[]`, and `get_pinned()`, `get_hidden()`, and `get_homepage()` return the same lists as before the call.

### Requirement: App definition may declare a minimum shell version

An app definition MAY carry an optional top-level
`minPackageVersion`: a string `MAJOR.MINOR.PATCH` (numeric parts, no
pre-release, no build metadata) declaring the minimum kody-os
package (shell) version the app requires. Absent means no minimum —
the app installs on any shell version, as today. A present but
malformed value SHALL fail definition validation, and nothing is
installed. `minPackageVersion` is fingerprinted definition content
(unlike `installMode`, which is fingerprint-excluded): adding it to
a definition, or changing it, is a definition change and requires a
`catalogVersion` +1 by the existing rule.

#### Scenario: Absent minimum installs on any shell
- **WHEN** `add_app` receives a definition with no `minPackageVersion`
- **THEN** the minimum-version check does not apply, and the install proceeds as today.

#### Scenario: Malformed minimum fails validation
- **WHEN** `add_app` receives a definition whose `minPackageVersion` is not numeric `MAJOR.MINOR.PATCH`
- **THEN** it returns `{ ok: false, error }` naming the problem and writes nothing.

#### Scenario: Adding a minimum is a definition change
- **WHEN** `minPackageVersion` is added to a catalog definition with no other change
- **THEN** its `catalogVersion` is incremented by exactly 1 and its fingerprint changes, so installed copies are marked as needing an update.

### Requirement: Install refuses an app the shell is too old for

`add_app` SHALL compare the running shell version against an app's
`minPackageVersion` (when present) before installing. The running
version is read from `pkg/package.json` via `getPackageMeta()` — the
same source the status bar reads — and the comparison uses `version`
only (`MAJOR.MINOR.PATCH`, numeric, in order); the integer `build`
is ignored. When the running shell version is older than the app's
minimum, `add_app` SHALL return `{ ok: false, error }` naming the
app, the required minimum, and the running shell version, and SHALL
write nothing. Equal to the minimum, or newer than it, is
compatible. This check is the single enforcement point: the Store's
install/update and the agent's `install_from_catalog` both funnel
through `add_app`, so it binds both paths. An update is an install
of a newer definition, so the same check applies to updates. The
check runs at install/update time only; an already-installed app
keeps running even if the shell is later older than its minimum. The
Store SHALL NOT offer a one-tap install or update for an app whose
minimum is newer than the running shell; it shows the requirement
and the running shell version instead.

#### Scenario: Too-old shell is refused with both versions named
- **WHEN** `add_app` receives an app whose `minPackageVersion` is newer than the running shell
- **THEN** it returns `{ ok: false, error }` naming the app, the required minimum, and the running shell version, and writes nothing.

#### Scenario: Equal version installs
- **WHEN** `add_app` receives an app whose `minPackageVersion` equals the running shell version
- **THEN** it returns `{ ok: true, id }` and the app installs.

#### Scenario: Newer shell installs
- **WHEN** `add_app` receives an app whose `minPackageVersion` is older than the running shell
- **THEN** it returns `{ ok: true, id }` and the app installs.

#### Scenario: Update that raises the minimum is refused
- **WHEN** a store update is attempted to a definition whose `minPackageVersion` is newer than the running shell
- **THEN** the update is refused with the required minimum and the running shell version named, and the installed definition is unchanged.

#### Scenario: Store does not offer an incompatible install
- **WHEN** the Store lists an app whose `minPackageVersion` is newer than the running shell
- **THEN** its row shows the requirement and the running shell version instead of a one-tap install control.

### Requirement: Catalog source is declared by the caller

The catalog fetch functions SHALL take the catalog base URL as a
parameter: the base URL of the catalog directory (the directory
containing `catalog.json`). The manifest SHALL be fetched at
`<base>catalog.json`, a definition at `<base><id>/definition.json`,
a bundle file at `<base><id>/<file>`, and a recipe at
`<base><id>/RECIPE.md`. The base SHALL be validated on every use:
HTTPS-only, or loopback `http` for local dev (the `KODY_CATALOG_BASE`
override, kept as-is). A non-HTTPS, non-loopback base SHALL be
refused before any fetch. The in-memory manifest cache SHALL be
keyed by base, so different callers with different catalogs do not
share a cache entry. `get_catalog_source` SHALL take the base and
report it (plus a label derived from it) for the Store display.

#### Scenario: Base parameter drives the fetch
- **WHEN** the catalog is fetched with base
  `https://example.com/catalog/`
- **THEN** the manifest is requested at
  `https://example.com/catalog/catalog.json`.

#### Scenario: Non-HTTPS base is refused
- **WHEN** the catalog is fetched with base
  `http://example.com/catalog/`
- **THEN** the fetch is refused before any network request.

#### Scenario: Cache is keyed by base
- **WHEN** two different bases are fetched
- **THEN** each has its own manifest cache entry.

### Requirement: Agent install supplies its catalog source

`install_from_catalog` SHALL accept an optional `catalogBase`
parameter. When the agent supplies it, that base SHALL be used.
When omitted, the registry SHALL use the installed App Store's
declared base if an App Store is installed. When neither a parameter
nor an installed Store base exists, the call SHALL be refused with a
clear error naming that no catalog source was given, and nothing
SHALL be written. The refusal SHALL name the app id.

#### Scenario: Explicit base is used
- **WHEN** `install_from_catalog` is called with a `catalogBase`
  pointing at a catalog containing the app
- **THEN** the app installs from that catalog.

#### Scenario: No source is refused
- **WHEN** `install_from_catalog` is called with no `catalogBase`
  and no App Store is installed
- **THEN** it returns `{ ok: false }` with an error naming that no
  catalog source was given, and nothing is written.

### Requirement: Store follows the latest catalog

The App Store's declared catalog base SHALL be the `main` branch
catalog base
(`https://raw.githubusercontent.com/Hypercubed/kody-os/main/catalog/`),
so the Store follows the latest catalog (the latest commit) and can
discover its own updates. A fixed release tag SHALL NOT be the
Store's declared base: a Store pinned to a tag only ever sees that
tag's catalog, where the Store is itself, and can never discover a
newer catalog or a newer Store. The Store's own update SHALL be
gated by `minPackageVersion`: when the new Store version requires a
newer shell than the one running, the update SHALL be refused, the
same as any other app.

#### Scenario: Store sees its own update
- **WHEN** the catalog at `main` holds a Store definition newer
  than the installed Store, and the running shell meets that
  definition's `minPackageVersion`
- **THEN** the Store offers its own update.

#### Scenario: Store update refused when shell is too old
- **WHEN** the catalog at `main` holds a Store definition whose
  `minPackageVersion` is above the running shell
- **THEN** the Store update is refused with the required and running
  versions named.

#### Scenario: Fixed tag does not freeze the Store
- **WHEN** the App Store's declared catalog base is read
- **THEN** it is the `main` branch base, not a fixed release tag.

### Requirement: Install refuses an app whose schema is below the shell floor

The shell SHALL name its minimum supported schema version as
`MIN_SUPPORTED_SCHEMA_VERSION` (currently 3, the minimum of
`SUPPORTED_SCHEMA_VERSIONS`). `add_app` SHALL refuse an app whose
`definition.schemaVersion` is below that floor, returning
`{ ok: false, error }` naming the app, its schema version, and the
minimum supported schema version, and writing nothing. The gate
SHALL cover install and update, Store and agent, since all funnel
through `add_app`. An app whose schema version equals the floor
SHALL install. This gate is in addition to `validateDefinition`'s
supported-list check: validation ensures the definition is
well-formed, and this gate is the compatibility check alongside
`minPackageVersion`, with a consistent error shape.

#### Scenario: Below-floor schema is refused
- **WHEN** an app with `schemaVersion` 2 is submitted to `add_app`
  and the floor is 3
- **THEN** it returns `{ ok: false }` with an error naming the app,
  schema 2, and the floor 3, and nothing is written.

#### Scenario: At-floor schema installs
- **WHEN** an app with `schemaVersion` equal to the floor is
  submitted to `add_app`
- **THEN** it returns `{ ok: true, id }`.

#### Scenario: Update to a below-floor schema is refused
- **WHEN** an installed app is re-added with a definition whose
  `schemaVersion` is below the floor
- **THEN** the update is refused and the installed definition is
  unchanged.

#### Scenario: Store hides install below the floor
- **WHEN** a Store row is for an app whose `schemaVersion` is below
  the shell's floor
- **THEN** the row shows the schema requirement instead of any
  install control.
