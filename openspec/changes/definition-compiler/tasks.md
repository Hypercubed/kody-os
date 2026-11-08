# Tasks: definition-compiler

## 1. New module with the pure definition surface

- [ ] 1.1 Create `pkg/src/apps/definition.ts` and move the pure
  surface from `pkg/src/apps/registry.ts` (Decision 1): the five
  constants, the fifteen exported pure functions, the pure
  helpers, and `NAME_RE`. Keep every signature and every error
  string byte-identical. `getRunningPackageVersion`, `loadEntry`,
  `EXPORT_FORMAT` / `EXPORT_FORMAT_V1`, and `RETIRED_APP_IDS`
  stay in `registry.ts`.
- [ ] 1.2 Add `compileDefinition(def: unknown)` to the new module
  (Decision 2): `migrateDefinition` -> `validateDefinition` ->
  `canonicalizeDefinition` -> `fingerprintDefinition`, returning
  `{ ok: true, definition, fingerprint }` or
  `{ ok: false, error }` with the validator's error string
  unchanged.
- [ ] 1.3 `registry.ts`: import the moved names from
  `definition.ts` (including `checkFieldValue`, `coerceArg`,
  `backfillDefinition`, `cloneState`, and `NAME_RE` for the
  backup-name check), re-export every moved name it used to
  export, and delete the moved code. No other file changes its
  imports.

## 2. `add_app` calls the compiler

- [ ] 2.1 `add_app` in `registry.ts`: replace the
  `validateDefinition` + `canonicalizeDefinition` steps with one
  `compileDefinition` call (Decision 3). The schema-floor gate,
  the `minPackageVersion` gate, and the new-id staleness check
  stay in their current positions and wording, running on the
  compiled definition.
- [ ] 2.2 Confirm no caller changes: `pkg/src/app.ts`,
  `pkg/src/index.ts`, `pkg/src/apps/index.ts`, the catalog
  harnesses, and the `add-app` scripts keep their current
  imports and keep working.

## 3. Verify

- [ ] 3.1 Direct compiler check: `compileDefinition` on a known
  valid definition returns the same canonical form and the same
  fingerprint `add_app` stores today, and on a known-bad
  definition returns the validator's exact error string. A v1
  single-`effect` definition compiles to the `effects[]` form.
- [ ] 3.2 Behavior parity: for a fixed set of valid, invalid, and
  stale-schema definitions, validation results, canonical forms,
  and fingerprints are identical before and after the move
  (compare against the pre-move tree).
- [ ] 3.3 Harnesses: `bun tests/schema-migration.ts`,
  `bun tests/catalog-harness.ts`, and `bun tests/store-harness.ts`
  pass; ES2019 scan clean;
  `bun build pkg/src/app.ts --target=browser --external 'kody:*'`
  succeeds.
- [ ] 3.4 Verify in `kody dev` (mock target): install a valid app
  and confirm it appears and acts as before; submit an invalid
  definition and confirm the same refusal and error text.
  Substitute only with a recorded reason if a step cannot run as
  written.

## 4. Sync and archive

- [ ] 4.1 `openspec validate --changes` shows no new failures
  (name the pre-existing ones if they appear).
- [ ] 4.2 Sync the canonical specs: the app-registry delta in
  this change becomes canonical.
- [ ] 4.3 Archive with a close-out note recording what was
  verified and what was left open.
