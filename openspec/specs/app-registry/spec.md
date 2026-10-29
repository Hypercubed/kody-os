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

`remove_app` SHALL delete the app's definition and state and scrub all of its references (pinned, hidden, recency, homepage order) atomically: either everything is gone or nothing changed. Removing an unknown id SHALL return `{ ok: false }` with a naming error and write nothing. Removing a seeded/prebuilt app SHALL be allowed exactly like any other app. `remove_app` SHALL be exposed only through the MCP surface; the browser shell SHALL NOT call it or render a removal control.

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
`ui.template` (`hello | generic | clock`) is render-ignored — the shell always renders bundle + state + forms and never branches on it. Version-4 definitions SHALL NOT carry `ui.template`: the v4 validator rejects a definition containing it, and the v4 restamp strips it from example apps and `test-app.ts`. Stored v3 definitions keep working on read (the field rides along inertly); it disappears on re-add under v4.

#### Scenario: v4 definition with template rejected
- **WHEN** `add_app` receives a schemaVersion-4 definition containing `ui.template`
- **THEN** it returns `{ ok: false, error }` naming the removed field and writes nothing.

#### Scenario: Restamped apps carry no template
- **WHEN** the example apps are restamped to schemaVersion 4
- **THEN** no stored definition contains `ui.template` and a repo grep for `template` in `pkg/src` hits only the v3-legacy validator branch.
