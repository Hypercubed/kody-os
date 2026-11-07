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
`export_app` SHALL return a complete `kody-os-app/2` envelope: format tag, export timestamp, full definition, and a state snapshot. `import_app` SHALL install an export envelope (or bare definition) into a blank install with no code changes, restoring the snapshotted state when present and valid. `kody-os-app/1` (name-keyed) payloads SHALL import with id derived from name. Re-importing over an installed id without `overwrite: true` SHALL be rejected.

#### Scenario: Export then blank-install re-import round-trips
- **WHEN** an app is exported, imported into a fresh store, and its state is read back
- **THEN** the definition and state are deep-equal to the originals.

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

The package SHALL ship a catalog: every
`pkg/catalog/<id>/definition.json` file is an app definition the user can
install from the browser, and every `pkg/catalog/<id>/` directory also
carries a `RECIPE.md` (see App recipe). The catalog SHALL be enumerated
by an explicit import list in package code (alphabetical by id), not by
runtime directory listing; a directory in `pkg/catalog/` without an
import entry SHALL NOT be listed. The listing summaries SHALL be driven
by the generated index at `pkg/catalog/catalog.json` (see Catalog index);
the full definitions SHALL still be statically imported for install.
Every catalog definition SHALL validate through `validateDefinition` and
install through `add_app`, satisfying the bundle manifest shape (entry
`index.html`, relative `.html`/`.js`/`.css` only, within the 256 KiB cap)
and the 16 MiB storage budget. Catalog definitions are publisher-shipped
and trusted like any `add_app` definition: installing one trusts its
bundle code, which runs same-origin with session authority.

#### Scenario: Every catalog file validates and installs
- **WHEN** each `definition.json` in `pkg/catalog/<id>/` is submitted to `add_app` in a blank store
- **THEN** each returns `{ ok: true, id }` and appears in `list_apps()`.

#### Scenario: Unimported file is not listed
- **WHEN** an app directory exists in `pkg/catalog/` with no import-list entry
- **THEN** the App Store listing omits it.

#### Scenario: Catalog listing order is deterministic
- **WHEN** the catalog is listed
- **THEN** entries appear in import-list order (alphabetical by id).

### Requirement: Catalog index

The package SHALL ship a generated catalog index at `pkg/catalog/catalog.json`, listing every catalog app sorted by id. Each entry SHALL carry: id, label, catalogVersion, fingerprint, installMode, definitionPath, recipePath. definitionPath and recipePath are relative to `pkg/catalog/` (for example `app-store/definition.json`, `app-store/RECIPE.md`). The index SHALL be generated by `scripts/build-catalog-index.ts` from the app directories, never hand-written; the generator SHALL compute each fingerprint with the existing `fingerprintDefinition` and SHALL read installMode from the definition (absent means `json`). Regenerating the index from unchanged definitions SHALL produce byte-identical output. The catalog harness SHALL fail if the index does not match the directories and the definitions (ids, alphabetical order, catalogVersions, fingerprints, install modes).

#### Scenario: Index lists every app once, sorted
- **WHEN** the generator runs over the app directories
- **THEN** `pkg/catalog/catalog.json` has one entry per app directory, sorted by id, each with id, label, catalogVersion, fingerprint, installMode, definitionPath, and recipePath.

#### Scenario: Generator is idempotent
- **WHEN** the generator runs twice over unchanged definitions
- **THEN** both outputs are byte-identical.

#### Scenario: Stale index fails the harness
- **WHEN** a definition changes without re-running the generator (or an app directory is added without an index entry)
- **THEN** the catalog harness reports the index mismatch and fails.

#### Scenario: Index lists collection recipes
- **WHEN** the generator runs over the app directories
- **THEN** `pkg/catalog/catalog.json` has no `collections` section and lists no collection recipes — collection recipes no longer exist.

### Requirement: App recipe

Each catalog app SHALL ship a `RECIPE.md` beside its `definition.json` in `pkg/catalog/<id>/`. A recipe is a procedure made of steps: each install step names exactly one app, and a recipe installs only its own app: one install step, naming the sibling definition. Steps after install MAY ask the user for input, fetch data, or set app state. The default recipe is trivial: install the sibling `definition.json` via `install_from_catalog('<id>')`, then verify with `list_apps`. A non-trivial recipe SHALL exist only where the app genuinely needs setup beyond install. An app's own recipe covers that app alone: the App Store recipe installs `app-store` and verifies it with `list_apps`. Help and About are not catalog apps: they are built-in shell pages with no definition and no recipe (see Help is a built-in shell page). A recipe SHALL NOT install any app other than its own; there is no collection recipe.

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

A catalog definition MAY carry `installMode`: `"json"`, `"recipe-only"`, or `"recipe-or-json"`. Absent means `"json"` — unattended install from the JSON alone. `"recipe-only"` means the app MUST be installed via its recipe: it still appears in the App Store list, but the Store shows the recipe prompt (selectable text for the user to supply to their agent) in place of one-tap install. `"recipe-or-json"` means the app has a non-trivial recipe for full configuration AND can be installed unattended from JSON: in the Store it installs without the prompt message (one-tap install works); it lands unconfigured and the app's built-in empty-state prompt guides setup, while the recipe fully configures it at install time. Only an app with a non-trivial recipe SHALL carry `installMode`; most definitions SHALL carry no such property. A definition with `installMode` present SHALL fail validation unless the value is `"json"`, `"recipe-only"`, or `"recipe-or-json"`. The canonical stored definition SHALL preserve `installMode` through `add_app` normalization, and `installMode` SHALL be excluded from the definition fingerprint, exactly like `catalogVersion`, so adding it SHALL NOT change any installed app's fingerprint, snapshot, or update status.

#### Scenario: Unattended install is the default
- **WHEN** a catalog definition carries no `installMode`
- **THEN** it installs from the JSON alone with no recipe step, and its listing reports install mode `json`.

#### Scenario: Recipe-only app declares its mode
- **WHEN** a catalog definition carries `"installMode": "recipe-only"`
- **THEN** it validates, its stored definition preserves the field, its listing reports install mode `recipe-only`, and the Store lists it with the recipe prompt in place of one-tap install.

#### Scenario: Recipe-or-json app declares its mode and installs unattended
- **WHEN** a catalog definition carries `"installMode": "recipe-or-json"`
- **THEN** it validates, its stored definition preserves the field, its listing reports install mode `recipe-or-json`, and it installs unattended from the JSON alone without the prompt message, landing unconfigured with its built-in empty-state prompt guiding setup.

#### Scenario: No app is recipe-only today
- **WHEN** the catalog is listed
- **THEN** no entry reports install mode `recipe-only`; `daily-feed` and `generic-feed` report `recipe-or-json` and the other 16 report `json`.

#### Scenario: Invalid install mode fails validation
- **WHEN** a definition carries an `installMode` other than `"json"`, `"recipe-only"`, or `"recipe-or-json"`
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

Every catalog definition SHALL carry `catalogVersion`: a positive integer, starting at 1 on that app's first versioned release, incremented by exactly 1 on any change to that app's definition file, never reused, never decreased, and never bumped for an unrelated app or a shell change. `catalogVersion` is distinct from `schemaVersion` (definition format era) and from the shell's package version. A catalog definition without a valid `catalogVersion` SHALL fail catalog validation. The canonical stored definition SHALL preserve `catalogVersion` through `add_app` normalization. Adding `installMode` to a definition SHALL NOT require a `catalogVersion` bump: the field is excluded from the definition fingerprint, so it cannot change any installed app's update status (see Recipe install mode). Removing `installMode` from a definition SHALL NOT require a `catalogVersion` bump either, for the same reason.

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
