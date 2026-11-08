# app-registry Specification Delta

## ADDED Requirements

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
