# Spec Delta

## MODIFIED Requirements

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

- Not installed (catalog only): Install only. No Pin, Hide, Home, Update,
  Restore, or Open control.
- Installed: Update, Overwrite, Restore, or neither according to the
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
- **THEN** its row offers Install and no Pin, Hide, Home, Update, Restore, or Open control.

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
