# app-registry Specification Delta

## ADDED Requirements

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

## MODIFIED Requirements

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
