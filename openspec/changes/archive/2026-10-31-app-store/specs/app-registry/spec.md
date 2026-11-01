# Spec Delta

## ADDED Requirements

### Requirement: Shipped catalog

The package SHALL ship a catalog: every `*.bundle.json` file in
`pkg/catalog/` is an app definition the user can install from the browser.
The catalog SHALL be enumerated by an explicit import list in package code
(alphabetical by id), not by runtime directory listing; a file in
`pkg/catalog/` without an import entry SHALL NOT be listed. Every catalog
definition SHALL validate through `validateDefinition` and install through
`add_app`, satisfying the bundle manifest shape (entry `index.html`,
relative `.html`/`.js`/`.css` only, within the 256 KiB cap) and the 16 MiB
storage budget. Catalog definitions are publisher-shipped and trusted like
any `add_app` definition: installing one trusts its bundle code, which runs
same-origin with session authority.

#### Scenario: Every catalog file validates and installs
- **WHEN** each file in `pkg/catalog/` is submitted to `add_app` in a blank store
- **THEN** each returns `{ ok: true, id }` and appears in `list_apps()`.

#### Scenario: Unimported file is not listed
- **WHEN** a bundle file exists in `pkg/catalog/` with no import-list entry
- **THEN** the App Store listing omits it.

#### Scenario: Catalog listing order is deterministic
- **WHEN** the catalog is listed
- **THEN** entries appear in import-list order (alphabetical by id).

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

Every catalog definition SHALL carry `catalogVersion`: a positive
integer, starting at 1 on that app's first versioned release, incremented
by exactly 1 on any change to that app's definition file, never reused,
never decreased, and never bumped for an unrelated app or a shell change.
`catalogVersion` is distinct from `schemaVersion` (definition format era)
and from the shell's package version. A catalog definition without a
valid `catalogVersion` SHALL fail catalog validation. The canonical
stored definition SHALL preserve `catalogVersion` through `add_app`
normalization.

#### Scenario: Catalog definition carries a version
- **WHEN** a catalog definition is validated
- **THEN** it is rejected if `catalogVersion` is missing, non-integer, or less than 1.

#### Scenario: Installed copy keeps its catalog version
- **WHEN** a catalog app is installed through `add_app`
- **THEN** the stored definition carries the catalog definition's `catalogVersion`.

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

- I == C: up to date, clean; no update is offered.
- I == S and Iv < Cv: behind, clean; an Update control is offered.
- I == S, Iv == Cv, and I != C: catalog-differing (the catalog changed
  without a version bump); an Update control is offered with no
  modification warning.
- I != S and I != C: modified; behind and modified when Iv < Cv,
  modified at the current version when Iv == Cv, and modified and ahead
  when Iv > Cv. A modified app SHALL never be offered a plain Update
  control, and a catalog copy SHALL never be offered as an Update to an
  ahead app.
- No snapshot: no status is claimed and no update control is offered
  under this scheme (see design.md, Decision 11).

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
- **THEN** the store does not offer a plain Update control; it offers a confirmed update whose confirmation states that definition changes will be lost while state for surviving fields is preserved.

#### Scenario: Modified current app offers restore, not update
- **WHEN** an installed catalog app differs from its snapshot at the catalog's version
- **THEN** the store offers Restore catalog version (with the same confirmation and warning), not Update.

#### Scenario: Ahead app is not offered an update
- **WHEN** an installed catalog app's version is higher than the catalog's
- **THEN** the store does not offer it as an update to the catalog copy.

#### Scenario: Snapshot-less app claims no status
- **WHEN** an installed catalog app has no snapshot
- **THEN** the store shows its existing Installed row and offers no update control under this scheme.

#### Scenario: Update never runs on its own
- **WHEN** a republish ships a newer catalog definition
- **THEN** installed apps keep their stored definitions until the user chooses an update (or restore) from the store.

### Requirement: Single combined list

The store SHALL present a single combined list: one row per id from the
union of catalog ids and installed ids, deduplicated by id, in
alphabetical-by-id order. Each row's badge and controls SHALL follow its
state under the update-status requirement, plus these rules:

- Not installed (catalog only): Install only. No Pin, Hide, Home, Update,
  Restore, or Open control.
- Installed: Pin/Unpin, Hide/Unhide, and Add to home/Remove from home
  controls, which change only their launcher lists and never the
  definition, state, or snapshot; plus Update, Restore, or neither
  according to the update-status requirement.
- Installed with no catalog entry: Storage only badge and launcher
  controls only; no Install, Update, or Restore control. Where a
  snapshot exists for such an id the row MAY be labelled formerly in
  the catalog; where none exists it is custom/storage-only. Neither
  variant claims a modified or update status.
- Installed catalog app with no snapshot: Installed badge and launcher
  controls only; no update control under this scheme.
- The App Store itself (`app-store`) appears as a row like any other
  app when installed; it is not excluded from its own list.
- The list is unfiltered: hidden apps appear in it, so a hidden app
  (including a hidden App Store) can be unhidden from the list. Hide
  affects the Apps launcher tiles only.
- No launching from the catalog: a row for an app that is not installed
  SHALL offer no Open link to `/apps/:id`; a row for an installed app
  MAY link to its app page.

#### Scenario: Union deduplicates by id
- **WHEN** an app is both in the catalog and installed
- **THEN** it appears exactly once in the combined list, with its installed status and controls.

#### Scenario: Catalog-only row offers install only
- **WHEN** a catalog app is not installed
- **THEN** its row offers Install and no Pin, Hide, Home, Update, Restore, or Open control.

#### Scenario: Storage-only row offers launcher controls only
- **WHEN** an installed app has no catalog entry
- **THEN** its row shows Storage only with Pin, Hide, and Home controls, and no Install, Update, or Restore control.

#### Scenario: Hidden app still appears in the combined list
- **WHEN** an installed app is hidden
- **THEN** its row still appears in the combined list with an Unhide control, even though it is absent from the Apps launcher tiles.

#### Scenario: Combined list is alphabetical by id
- **WHEN** the combined list is rendered with catalog-only, installed, and storage-only apps
- **THEN** rows appear in alphabetical-by-id order regardless of state.

#### Scenario: Update preserves launcher placement
- **WHEN** a pinned, homepage app is updated or restored from the combined list
- **THEN** its pin and homepage placement are unchanged afterwards.

### Requirement: First use seeds only the App Store

On the first authenticated shell request against an empty registry, the
shell SHALL install exactly one app — the App Store (`app-store`), whose
definition ships in `pkg/catalog/` — through the validated `add_app` path,
before serving the request. "First use" means after the package has been
forked and published as a live saved package; a fork's storage starts
empty (source-only copy), so the first shell request is the first moment
seeding can run. Kody's "adopt" step (owner-only secret-access grant) is
a separate action and is NOT the seeding trigger. Seeding SHALL never run when the registry is
non-empty, SHALL never install any other catalog app, and SHALL be
idempotent (re-running it against a store that already holds the App Store
changes nothing). Seeding SHALL NOT run from MCP registry reads or from
`import_install` into a blank store. Removing the App Store via
`remove_app` SHALL be allowed exactly like any other app; if the registry
later becomes empty, the next shell request SHALL seed the App Store again.

#### Scenario: Blank install opens with only the App Store
- **WHEN** a blank store receives its first authenticated shell request
- **THEN** exactly one app is installed (`app-store`), and subsequent shell requests show it without re-seeding.

#### Scenario: Seeding never overwrites user state
- **WHEN** the registry already contains any app
- **THEN** seeding does not run and the user's registry is untouched.

#### Scenario: Empty registry restores the store
- **WHEN** every app including the App Store has been removed and a shell request arrives
- **THEN** the App Store is installed again and no other catalog app is installed.

#### Scenario: MCP reads do not seed
- **WHEN** `list_apps` is called against a blank store with no shell request having run
- **THEN** it returns an empty list and the store is byte-identical before and after the call.
