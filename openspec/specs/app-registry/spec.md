# App Registry (data-driven app layer)

## Purpose
Capture the shipped Phase 2 app-layer contract — schema, MCP interface, atomicity, export format — so new effect ops, templates, or Phase 3 vocabulary work extend it without breaking the dual UI/MCP rule.

## Requirements

### Requirement: App definition schema
The canonical stored form of a definition SHALL be produced by
`compileDefinition` in `pkg/src/apps/definition.ts` (validate,
canonicalize — which migrates actions —, fingerprint), rather than
by separate `validateDefinition` / `canonicalizeDefinition` calls
inside `add_app`. The stored form itself is unchanged: same
restamp, same migration, same sanitization, same fingerprint for
the same input.

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
Definitions and state SHALL live under `packageStorage()` keys `kody-os.apps.def.<id>` and `kody-os.apps.state.<id>`, within the 16 MiB durable-storage budget (definitions stay small JSON). The installed list is derived from the definition keys, not stored: no code SHALL read or write a `kody-os.apps.registry` id list, and a stale key of that name SHALL be left in place, unread and unwritten, when present. Outside Kody (local runs, tests) the same code SHALL fall back to a shared in-memory store; `createMemoryStore()` SHALL provide isolated blank installs for round-trip tests.

#### Scenario: Keys are namespaced and portable
- **WHEN** two apps are installed and the storage keys are listed
- **THEN** every key starts with `kody-os.apps.` and the definitions remain small plain JSON with no code strings.

### Requirement: Installed apps are derived from definition keys

The installed list SHALL be derived, not stored: `list_apps()` and
every other installed-enumeration SHALL obtain installed ids by
paginating `list({ prefix: 'kody-os.apps.def.' })` and taking the id
suffix of each key, in key order (alphabetical by id). No shared
registry list SHALL be read or written: `kody-os.apps.registry`
SHALL be left in place, unread and unwritten, when present. A
definition whose key exists SHALL be installed, whether or not any
registry entry ever named it. Pagination SHALL run to completion
(`truncated` / `nextStartAfter`) and SHALL never assume one page
holds every app.

#### Scenario: Concurrent installs for different apps both land

- **WHEN** two installs for different ids run concurrently, with
  no Store serialization and no re-read/verify loop in `add_app`
- **THEN** both apps appear in `list_apps()` afterwards, with
  definitions and state intact.

#### Scenario: An orphaned definition is installed

- **WHEN** a definition and state exist but no registry entry
  names the id
- **THEN** the app appears in `list_apps()` and on the Apps page
  with no repair step, and its Store row shows it installed with
  its correct update status.

#### Scenario: The Apps list is alphabetical by id

- **WHEN** the derived list is rendered
- **THEN** apps appear in alphabetical-by-id order, not install
  order, matching the Store's catalog-only list order.

#### Scenario: Pagination covers the whole install

- **WHEN** the install holds more apps than one `list()` page
- **THEN** enumeration returns every installed app.

### Requirement: `KeyStore` lists keys by prefix

`KeyStore` SHALL expose `list(options: { prefix: string;
pageSize?: number; startAfter?: string })`, resolving to
`{ entries: [{ key, value }], estimatedBytes, truncated,
nextStartAfter, pageSize }` with `pageSize` defaulting to 250 and
capped at 1000, entries in key order. The hosted
`packageStorage()` handle SHALL back it directly; the memory
store and the mock store SHALL implement the same shape over
their keys. A store without `list()` SHALL fail loudly with an
error naming the store, never silently return an empty list.

`resolveStore()` SHALL normalize a `list()` result that arrives
as a bare array of `{ key, value }` pairs (the shape the mock
handle returns: the whole namespace, prefix ignored) into the
documented envelope before any caller sees it: keep only entries
whose key starts with the requested prefix, sort by key, and
derive pagination from `pageSize` / `startAfter` exactly as
`createMemoryStore()` does (`estimatedBytes` over the returned
page, `truncated` / `nextStartAfter` from the filtered set). A
result that is already the documented envelope SHALL pass
through untouched. A result that is neither a bare array nor an
envelope SHALL reject with an error naming the shape, never
return an empty list.

#### Scenario: Prefix filtering and paging

- **WHEN** `list()` is called with a prefix over keys under two
  prefixes, with a page size smaller than the result
- **THEN** it returns only the requested prefix's keys, in key
  order, with `truncated: true` and a `nextStartAfter` that
  yields the remainder on the next call.

#### Scenario: A store without `list()` fails loudly

- **WHEN** installed enumeration runs against a store with no
  `list()` method
- **THEN** it throws an error naming the store instead of
  reporting an empty install.

#### Scenario: A bare-array list() result enumerates as the envelope

- **WHEN** `list({ prefix: 'kody-os.apps.def.' })` is called
  against a store whose handle returns a bare array holding keys
  under several prefixes, with a page size smaller than the
  filtered result
- **THEN** it returns only the requested prefix's keys, in key
  order, with `truncated: true` and a `nextStartAfter` that
  yields the remainder on the next call, and `estimatedBytes`
  covers only the returned page.

#### Scenario: A documented-envelope list() result passes through untouched

- **WHEN** `list()` is called against a store whose handle
  returns the documented envelope
- **THEN** the returned entries, order, `estimatedBytes`,
  `truncated`, `nextStartAfter`, and `pageSize` are exactly the
  handle's own values, with no re-filtering or re-sorting.

#### Scenario: An unrecognized list() result fails loudly

- **WHEN** `list()` returns neither a bare array nor an object
  with an `entries` array
- **THEN** enumeration rejects with an error naming the shape
  instead of reporting an empty install.

#### Scenario: The homepage lists installed apps from a bare-array store

- **WHEN** the install's definition keys are enumerated through
  a bare-array `list()` result
- **THEN** `list_apps()` returns every installed id and the
  homepage and Apps page list them, with no re-seed or reinstall.

### Requirement: `add_app` and `remove_app` write per-id keys only

`add_app` SHALL write only the definition key and the state key
for its own id (plus the install snapshot on a Store install,
which is itself a per-id key). It SHALL NOT read or write any
shared registry list. The state-preservation rule is unchanged.
`remove_app` SHALL decide "unknown app" from the definition key,
then delete the definition, state, and snapshot keys and scrub
the pinned / hidden / recent / homepage references, and SHALL
NOT read or write any shared registry list. Two concurrent
writers for the same id SHALL resolve to the last `set` for that
one key, with no cross-app loss and no orphan.

#### Scenario: A single install writes only its own keys

- **WHEN** one app is installed
- **THEN** exactly its definition and state keys are written
  (plus the snapshot on a Store install), it appears in
  `list_apps()`, and no shared key is touched.

#### Scenario: Re-adding preserves state

- **WHEN** an installed app is re-added
- **THEN** its state is preserved for fields still declared,
  exactly as before.

#### Scenario: Removing an app deletes only its keys

- **WHEN** an installed app is removed
- **THEN** its definition, state, and snapshot keys are deleted
  and its pinned / hidden / recent / homepage references are
  scrubbed, and no other app's keys change.

#### Scenario: Removing an unknown app writes nothing

- **WHEN** `remove_app` is called with an id that has no
  definition key
- **THEN** it returns `{ ok: false }` with a naming error and
  writes nothing.

### Requirement: Retired apps are filtered at read time

Retired ids (`help`, `about`) SHALL be filtered out of the
derived installed list at read time, and their definition and
state keys SHALL be deleted. No registry read or rewrite SHALL
take part in retiring an app.

#### Scenario: A retired definition is not listed

- **WHEN** the store contains retired `help` / `about`
  definitions
- **THEN** they do not appear in `list_apps()`, and their
  definition and state keys are deleted.

### Requirement: Pinned, hidden, and recency lists

The shell SHALL store three lists beside the installed apps in `packageStorage()`: pinned app ids (user order), hidden app ids, and recent app ids (most recent first, capped at a fixed count). All three SHALL default to empty on a fresh install and SHALL live under the same `kody-os.apps.*` key namespace and 16 MiB budget as the definitions.

#### Scenario: Fresh install has empty lists
- **WHEN** the lists are read before any pin, hide, or use
- **THEN** each returns empty and the Apps page renders as if the feature were absent.

### Requirement: Homepage order list

The shell SHALL store a homepage order list of app ids under `kody-os.apps.homepage`, defaulting to empty. Reordering SHALL persist the new order with a single write. Removing an app from the homepage list (without uninstalling) SHALL keep its pin, hidden state, definition, and state untouched.

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
Re-adding an existing id via `add_app` SHALL overwrite the definition, preserve state by default (declared fields carried forward, dropped fields reset to `initial`), and leave pins, hidden flags, homepage placement, and recent entries untouched (only `remove_app` scrubs reference lists). Passing `resetState: true` SHALL reset state to `initial` instead. Passing `migrate` SHALL map old field names to new ones with validator-checked values: an unmappable field aborts the whole re-add with `{ ok: false }` and no state change.

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

A snapshot MAY also carry an optional `catalogFingerprint`: the
fingerprint of the catalog definition absorbed from, set only by
`absorb_from_catalog` (see "Absorb a modified catalog app"). A
successful absorb SHALL replace the snapshot with the catalog
version, the fingerprint of the merged definition as actually
stored, and the catalog fingerprint absorbed from. Snapshots
without the field behave exactly as before; no migration is
required.

#### Scenario: Store install records a snapshot
- **WHEN** a catalog app is installed from the store
- **THEN** a snapshot exists recording its `catalogVersion` and the fingerprint of its stored definition.

#### Scenario: Generic re-add does not move the snapshot
- **WHEN** an installed catalog app's definition is replaced through generic `add_app`
- **THEN** the snapshot still records the version and fingerprint from the store install, so the app now differs from its snapshot.

#### Scenario: Export does not carry the snapshot
- **WHEN** an installed catalog app is exported
- **THEN** the export contains its definition and state, but no snapshot, and importing it does not create a snapshot.

#### Scenario: Absorb records a snapshot with the catalog fingerprint
- **WHEN** an absorb succeeds
- **THEN** the snapshot records the catalog version, the fingerprint of the merged definition as stored, and the fingerprint of the catalog definition absorbed from.

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

When the snapshot carries a `catalogFingerprint` (set only by an
absorb), the absorbed cases take precedence over the branches
above: I == S and the snapshot's catalog fingerprint equals C
yields `absorbed` (Remove only, never Update, Overwrite, or
Restore); I == S and the snapshot's catalog fingerprint differs
from C yields `absorbed-behind` (Absorb again, or a confirmed
Overwrite, never a plain Update). I != S falls through to the
modified branches above, so an app edited after absorbing is
treated as modified again.

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
- **THEN** the store offers Overwrite, and confirming replaces its definition with the catalog copy, preserves state for surviving fields, and records a snapshot, so the app becomes managed afterwards.

#### Scenario: Update never runs on its own
- **WHEN** a republish ships a newer catalog definition
- **THEN** installed apps keep their stored definitions until the user chooses an update (or restore) from the store.

#### Scenario: Absorbed app reads absorbed, not catalog-differing
- **WHEN** an installed catalog app matches its snapshot at the catalog version, differs from the catalog copy, and its snapshot's catalog fingerprint equals the current catalog fingerprint
- **THEN** the store reads it as `absorbed`, offers Remove only, and never offers Update.

#### Scenario: Absorbed app with a moved catalog reads absorbed-behind
- **WHEN** an absorbed app's catalog definition changes
- **THEN** the store reads it as `absorbed-behind`, offers Absorb again and a confirmed Overwrite, and never offers a plain Update.

#### Scenario: App edited after absorbing reads modified again
- **WHEN** an absorbed app's installed definition is edited so it differs from its snapshot
- **THEN** the store derives its status from the modified branches, not from the absorbed cases.

### Requirement: Store row agent-prompt details

Every App Store row SHALL carry a copyable agent prompt for the action that row is about, inside a collapsed `<details class="store-details">` element at the bottom of the row's description (after badge, description, and capabilities), holding a `<summary>` naming the action and a `<code>` element with the prompt text. The prompt SHALL be plain selectable text, set via `textContent` (never `innerHTML` for text built from a row id or label), with no copy button and no Clipboard API use. The one-tap buttons stay as they are; the details element is an additional path, never a replacement.

The prompt is a one-liner naming the operations file and the app's catalog folder; the procedure lives in the file, not in the prompt. With `<ops>` the reference `Read package:<slug>#OPERATIONS.md` (the slug derived at render time from the running package's own mount, falling back to `kody-os`) and `<folder>` the row's `folderUrl`, the prompt per row status SHALL be:

- Not installed: `Read <ops>, then install this app: <folder>`.
- Behind-clean or catalog-differing: `Read <ops>, then update this app to the latest catalog version: <folder>`.
- Behind-modified, modified-current, or absorbed-behind: `Read <ops>, then absorb the catalog changes into this app, keeping my local customizations: <folder>` (see "Absorb a modified catalog app").
- Modified-ahead: `Read <ops>, then restore this app to the catalog copy: <folder>`.
- Snapshot-less: `Read <ops>, then overwrite this app with the catalog copy: <folder>`.
- Up-to-date or absorbed: `Read <ops>, then remove this app: <folder>`.

No prompt SHALL name a label, an id, or an MCP call. A row without a `folderUrl` (no catalog entry) SHALL show no Install details.

No details element SHALL appear on a row blocked by a requirement (`needsNewerShell` / `needsNewerSchema`, which show the requirement instead of any control) or on a `storage-only` / `storage-only-formerly` row. A not-installed `recipe-only` row SHALL show the Install details like any other not-installed row (the recipe prompt is the Install one-liner; the controls span explaining that there is no Add button stays).

#### Scenario: Not-installed row shows the install one-liner

- **WHEN** a Store row is not installed
- **THEN** the row offers one-tap Add (or, when `recipe-only`, the recipe span in place of Add) and also shows a collapsed details element whose prompt is `Read package:<slug>#OPERATIONS.md, then install this app: <folder>`, with no label, id, or MCP call named.

#### Scenario: Behind-clean row shows the update one-liner

- **WHEN** a Store row is behind-clean
- **THEN** the row offers Update and also shows a collapsed details element whose prompt is the update one-liner, with no MCP call named.

#### Scenario: Behind-modified row shows the absorb one-liner, not an overwrite prompt

- **WHEN** a Store row is behind-modified
- **THEN** the row offers confirmed Overwrite and shows a collapsed details element whose prompt is the absorb one-liner, and shows no overwrite prompt.

#### Scenario: Up-to-date row shows the remove one-liner

- **WHEN** a Store row is up-to-date
- **THEN** the row offers Remove and also shows a collapsed details element whose prompt is `Read package:<slug>#OPERATIONS.md, then remove this app: <folder>`.

#### Scenario: Requirement-blocked row shows no details element

- **WHEN** a Store row needs a newer shell or schema
- **THEN** the row shows the requirement instead of any control and shows no details element.

#### Scenario: Recipe-only not-installed row shows the Install details

- **WHEN** a Store row is not installed and its `installMode` is `recipe-only`
- **THEN** the row shows the recipe span in place of Add and also shows a collapsed details element with the Install one-liner.

#### Scenario: Prompt is selectable text, no copy button, no Clipboard API

- **WHEN** a Store row renders its details prompt
- **THEN** the prompt is selectable text in a `<code>` element, the row has no copy button for it, and the bundle uses no Clipboard API for it.

### Requirement: Absorb a modified catalog app

An installed catalog app modified in both places (its installed
definition differs from its snapshot, and the catalog has moved)
SHALL be absorbable by an agent: the agent merges the catalog
changes into the installed definition, keeping the user's local
customizations, and finishes with the new MCP export
`absorb_from_catalog`. The absorb is a two-way merge — the stored
snapshot holds only a fingerprint, never the base definition, so
there is no base to diff against — and the agent SHALL work from
the installed definition (`export_app`) and the catalog definition
(`get_catalog_definition`), following the procedure in
`pkg/OPERATIONS.md` (backup first, field-by-field compare, merge
plan, ask before writing, verify by re-exporting). The prompt
itself SHALL be the Absorb one-liner; the procedure SHALL NOT be
inlined in the prompt.

`absorb_from_catalog(id, definition, catalogBase?)` SHALL validate
the agent-supplied merged definition through the `add_app` path,
write it through `add_app` (state preserved by the existing rule;
pins, hidden flags, homepage placement, and recency untouched),
and record a new install snapshot at the catalog version carrying
the catalog fingerprint absorbed from. It SHALL refuse with no
write unless the app is installed, is in the catalog, and its
status is `behind-modified`, `modified-current`, or
`absorbed-behind`, and unless the merged definition's
`catalogVersion` equals the catalog's. It SHALL resolve the
catalog base the same way `install_from_catalog` does, and refuse
with a no-source error when no catalog source exists. It SHALL be
an MCP export (name + `useWhen` in the package export list).

After a successful absorb the row SHALL read `absorbed`, never
still-modified and never `catalog-differing`, and a plain Update
SHALL never be offered for it. A later catalog change SHALL move
the row to `absorbed-behind`, where Absorb is offered again (or a
confirmed Overwrite), never a plain Update.

#### Scenario: Behind-modified app absorbs and reads absorbed

- **WHEN** an agent merges a behind-modified app's installed definition with its catalog definition, keeping a local field change and taking a catalog field change, and calls `absorb_from_catalog` with the merged definition at the catalog version
- **THEN** the stored definition is the merged one, state is preserved for surviving fields, the snapshot records the catalog version and the merged fingerprint, and the row reads `absorbed` with Remove as its only control.

#### Scenario: Absorb refuses a non-absorbable status

- **WHEN** `absorb_from_catalog` is called for an up-to-date app
- **THEN** it returns `{ ok: false }` naming the status and writes nothing.

#### Scenario: Absorb refuses a mismatched catalog version

- **WHEN** `absorb_from_catalog` is called with a merged definition whose `catalogVersion` is not the catalog's
- **THEN** it returns `{ ok: false }` and writes nothing.

#### Scenario: Absorbed app is not offered an update

- **WHEN** an absorbed app's row renders
- **THEN** it offers Remove only, and Update All skips it.

#### Scenario: Catalog moves after absorb

- **WHEN** the catalog changes after an absorb
- **THEN** the row reads `absorbed-behind`, offers Absorb again (and a confirmed Overwrite), and never offers a plain Update.

#### Scenario: Absorb asks before writing

- **WHEN** the absorb prompt is followed
- **THEN** the agent takes a backup first, shows the merge plan, and asks the user before writing anything, and asks which value to keep for any field in conflict, per `pkg/OPERATIONS.md`.

### Requirement: Store row folder URL

`StoreRow` SHALL carry `folderUrl?: string`: the full URL of the app's catalog folder in GitHub tree form (`https://github.com/<owner>/<repo>/tree/<ref>/catalog/<id>`), set when the row came from a catalog entry. `CatalogSummary` SHALL carry `recipePath: string`, the manifest-relative recipe path (for example `app-store/RECIPE.md`); the manifest SHALL require it (a missing or unsafe `recipePath` drops the entry). `folderUrlForBase(base, id)` SHALL derive the folder URL from the resolved catalog base the same way `recipeUrlForBase` derives the recipe URL: a GitHub raw base converts to the tree form with the same ref (a pinned tag lands in it instead of `main`); any other base yields `base + id + '/'`. `buildStoreRows` SHALL set `folderUrl: catalogEntry ? folderUrlForBase(catalogBase, catalogEntry.id) : undefined`. `recipeUrlForBase` SHALL keep its exact behavior. The previous `StoreRow.recipeUrl` field is removed; it was never documented in this spec.

#### Scenario: Row carries the folder URL

- **WHEN** a Store row is built from a catalog entry resolved against a GitHub raw base
- **THEN** its `folderUrl` is the tree URL for that app's folder at the base's ref.

#### Scenario: Pinned tag lands in the folder URL

- **WHEN** a Store row is built against a catalog base pinned to a tag
- **THEN** its `folderUrl` names that tag, not `main`.

#### Scenario: Non-GitHub base yields the base folder path

- **WHEN** a Store row is built against a loopback base
- **THEN** its `folderUrl` is the base plus the app id plus a trailing slash.

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
- **THEN** the response is a plain 404, and no definition or state write occurs.

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

A shell request against an empty registry SHALL NOT install any app. Removing the last installed app SHALL leave the registry empty on the next shell request; no seeding, flag, or explicit-removal state SHALL re-install anything. Empty means no `kody-os.apps.def.*` key exists: a stale `kody-os.apps.registry` key, when present, is never consulted.

#### Scenario: Fresh install stays empty
- **WHEN** a blank store receives its first authenticated shell request
- **THEN** `list_apps` still returns an empty list and no app is installed.

#### Scenario: Removing the last app stays empty
- **WHEN** every app including the App Store has been removed and a shell request arrives
- **THEN** the installed list is still empty and no catalog app is installed.

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

### Requirement: Pure definition surface lives in its own module

The pure definition operations SHALL live in
`pkg/src/apps/definition.ts`, not in `registry.ts`: definition
validation (`validateDefinition`,
`validateCatalogDefinition`), migration (`migrateAction`,
`migrateDefinition`), canonicalization
(`canonicalizeDefinition`), fingerprinting
(`fingerprintDefinition`), capability summaries
(`summarizeCapabilities`, `capabilityAdditions`), SVG icon
checks (`isSvgIcon`, `sanitizeSvgIcon`), bundle assembly and
reference checks (`assembleBundleFiles`,
`validateBundleReferences`), package-version parsing and
comparison (`parsePackageVersion`, `comparePackageVersions`),
open-mode derivation (`deriveOpenAs`), the schema constants
(`SUPPORTED_SCHEMA_VERSIONS`,
`MIN_SUPPORTED_SCHEMA_VERSION`), the bundle caps
(`BUNDLE_CAP_BYTES`, `APPEND_CAP`,
`APPEND_MAX_ENTRY_BYTES`), and the pure helpers `act` also
needs (`checkFieldValue`, `coerceArg`, `backfillDefinition`,
`cloneState`). `registry.ts` SHALL import those names from
`definition.ts` and re-export every one it used to export, so
no MCP export and no existing import path changes.
`getRunningPackageVersion` SHALL stay in `registry.ts`: it is
async, dynamically imports `package.json`, and memoizes a
promise, so it is not pure.

#### Scenario: Pure surface imports without the registry I/O
- **WHEN** a caller imports `validateDefinition` from the
  definition module
- **THEN** it gets the same function with the same behavior,
  without importing any storage operation.

#### Scenario: Registry re-exports keep old imports working
- **WHEN** an existing caller imports a moved name from
  `registry.ts` (or via `pkg/src/apps/index.ts` /
  `pkg/src/index.ts`)
- **THEN** the import resolves and behaves as before the move.

### Requirement: `compileDefinition` is the typed compile entry point

`compileDefinition(def: unknown)` SHALL compile one definition
in this order: `validateDefinition` on the submitted input (exactly
as `add_app` validates today), then `canonicalizeDefinition`
(which migrates single-`effect` actions to `effects[]` per-action,
restamps the schema version, sanitizes the icon, derives the open
mode, and applies capability defaults), then `fingerprintDefinition`
on the canonical form. Validating the input — not a pre-migrated
copy — preserves version-branching: a valid v3 single-`effect`
definition keeps validating, and a v5 single-`effect` definition
keeps failing, exactly as before. It SHALL return
`{ ok: true, definition, fingerprint }` on success, where
`definition` is the canonical stored form (schema restamped to
the current version, actions in `effects[]` form, icon
sanitized, open mode derived, capability defaults applied), or
`{ ok: false, error }` with the validator's error string
unchanged on failure. `add_app` SHALL call `compileDefinition`
for its validate-and-canonicalize steps. Compilation SHALL NOT
decide installability: the schema-floor gate, the
`minPackageVersion` gate, and the new-id staleness check in
`add_app` SHALL stay in their current positions and wording.

#### Scenario: Valid definition compiles to its stored form
- **WHEN** `compileDefinition` receives a valid definition
- **THEN** it returns `{ ok: true }` whose `definition` is
  deep-equal to the definition `add_app` stores for the same
  input, and whose `fingerprint` equals
  `fingerprintDefinition` of that stored form.

#### Scenario: Invalid definition returns the validator's error
- **WHEN** `compileDefinition` receives a definition the
  validator rejects
- **THEN** it returns `{ ok: false }` with the exact error
  string `validateDefinition` returns for the same input, and
  no canonical form.

#### Scenario: v1 single-effect definition compiles to effects form
- **WHEN** `compileDefinition` receives a definition with a
  v1 single-`effect` action
- **THEN** the compiled definition carries that action as a
  one-entry `effects[]` array.

#### Scenario: Compile does not bypass the install gates
- **WHEN** a definition that compiles cleanly is submitted to
  `add_app` with a below-floor schema or a
  `minPackageVersion` above the running shell
- **THEN** `add_app` still refuses it with the gate's error,
  and writes nothing.
