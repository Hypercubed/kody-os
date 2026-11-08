# Proposal: definition-compiler

## Why

`pkg/src/apps/registry.ts` is 3,104 lines and the most-churned file in
the shell (about 3,700 lines changed since Oct 1, 2026, across 20
commits). It holds two different concerns in one file: the pure
definition language — validate, migrate, canonicalize, fingerprint a
definition, coerce an action arg, check a state value — and the
storage I/O that reads and writes the registry (`act`, `add_app`,
`list_apps`, backup/restore, Store rows).

The pure half is the part that churns most. Every schema change
(schemaVersions 3, 4, 5 today), every new effect operator, every
validation fix lands in the same file as the I/O, so a schema edit
and a storage edit review together and test together. The pure
functions are also the test surface: they take a value and return a
value, with no store, no network, and no runtime — but today they
can only be tested by importing the whole registry, I/O included.

The fix is to move the pure half into its own module,
`pkg/src/apps/definition.ts`, behind one typed entry point,
`compileDefinition`. Callers stop doing raw string-key reads on
definitions (`def['actions']`, `def['stateSchema']`) and instead get
a compiled, canonical `AppDefinition` or a single error string.
The registry keeps only the I/O: it imports the compiler, calls it
from `add_app`, and keeps `act`'s arg/state checks by importing the
same pure helpers.

## What changes

- New module `pkg/src/apps/definition.ts` owning the pure
  definition surface now in `registry.ts`: validation, migration,
  canonicalization, fingerprinting, capability summaries, SVG icon
  sanitization, bundle assembly/reference checks, package-version
  parsing/comparison, and the pure helpers `act` also needs
  (`checkFieldValue`, `coerceArg`, `backfillDefinition`, `cloneState`).
- One new typed entry point, `compileDefinition(def: unknown)`:
  `migrateDefinition` -> `validateDefinition` ->
  `canonicalizeDefinition` -> `fingerprintDefinition`, returning
  `{ ok: true, definition, fingerprint }` or
  `{ ok: false, error }`.
- `registry.ts` imports from `definition.ts` and re-exports the
  moved names, so the MCP surface and every existing import path
  (`pkg/src/apps/index.ts`, `pkg/src/index.ts`, `pkg/src/app.ts`)
  keep working unchanged. `add_app` calls `compileDefinition`
  where it today calls `validateDefinition` then
  `canonicalizeDefinition`.
- Nothing else moves: the portability-adapter work (candidate 3)
  and the shell-page composition work (candidate 2) are out of
  scope; the Kody runtime touchpoints (`packageStorage()` in
  `storage.ts`, `metaGetCurrentUser` in `auth.ts`) are untouched.

## What does not change

- No observable behavior: no definition that validates today stops
  validating, no stored definition changes form, no fingerprint
  changes, no MCP export is added, removed, renamed, or reshaped,
  and no error string changes.
- The install gates stay where they are: the schema-floor gate and
  the `minPackageVersion` gate in `add_app`, and the new-id
  staleness check (a new id must carry the current schema version;
  re-adding an existing id restamps it) are untouched by the move.
  `compileDefinition` does the validate-and-canonicalize steps
  only; it does not decide whether an app may install.
- `getRunningPackageVersion` stays in `registry.ts`: it is async,
  dynamically imports `package.json`, and memoizes a promise, so
  it is not pure and does not move.
- No commit, push, publish, or version bump in this change; the
  version decision is deferred to publish (PATCH per the version
  policy: internal refactor with no observable change).
