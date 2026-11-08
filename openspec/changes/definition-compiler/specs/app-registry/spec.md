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
in this order: `migrateDefinition`, then `validateDefinition`,
then `canonicalizeDefinition`, then `fingerprintDefinition` on
the canonical form. It SHALL return
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
`compileDefinition` in `pkg/src/apps/definition.ts` (migrate,
validate, canonicalize, fingerprint), rather than by separate
`validateDefinition` / `canonicalizeDefinition` calls inside
`add_app`. The stored form itself is unchanged: same restamp,
same migration, same sanitization, same fingerprint for the same
input.
