# Design: definition-compiler

## Decisions

### Decision 1: The pure definition surface moves to `pkg/src/apps/definition.ts`

The new module owns everything in `registry.ts` that takes a value
and returns a value with no store, no network, and no runtime:

- Constants: `BUNDLE_CAP_BYTES`, `APPEND_CAP`,
  `APPEND_MAX_ENTRY_BYTES`, `SUPPORTED_SCHEMA_VERSIONS`,
  `MIN_SUPPORTED_SCHEMA_VERSION`.
- Exported pure functions: `isSvgIcon`, `sanitizeSvgIcon`,
  `assembleBundleFiles`, `validateBundleReferences`,
  `summarizeCapabilities`, `capabilityAdditions`,
  `parsePackageVersion`, `comparePackageVersions`,
  `migrateAction`, `migrateDefinition`, `deriveOpenAs`,
  `validateDefinition`, `validateCatalogDefinition`,
  `canonicalizeDefinition`, `fingerprintDefinition`.
- Pure helpers that move with them (unexported, except where the
  registry needs them): `isRecord`, `reqStr`, `byteLength`,
  `isBundlePath`, the SVG allowlists, `isNameChar`, `isSpaceChar`,
  `svgIconProblem`, `bundleReferenceAttrError`,
  `isExternalBundleRef`, `validateBundleManifest`,
  `validateUpstreamEntries`, `validateCapabilities`,
  `sanitizeUpstreamEntries`, `sanitizeCapabilities`,
  `upstreamHosts`, `validateSingleEffect`, `validateActionDef`,
  `jsonValueProblem`, `checkFieldValue`, `coerceArg`,
  `backfillDefinition`, `cloneState`, `stableStringify`.
- `NAME_RE` (`/^[a-z0-9][a-z0-9-]{0,63}$/`) moves too: it is used
  by `validateDefinition` (id), by `validateUpstreamEntries`
  (entry names), and by `isBackupName` in the registry (backup
  names). The registry imports it back for the backup-name check
  rather than the regex living in two places.

What stays in `registry.ts`: `EXPORT_FORMAT` / `EXPORT_FORMAT_V1`,
`RETIRED_APP_IDS`, `getRunningPackageVersion` (async, dynamic
`package.json` import, memoized promise — not pure),
`loadEntry` (storage I/O), and all the storage-backed operations
(`act`, `add_app`, `list_apps`, `get_app`, backup/restore, Store
rows, install snapshots). The registry imports the pure helpers it
still needs (`checkFieldValue`, `coerceArg`, `backfillDefinition`,
`cloneState`, `NAME_RE`) from `definition.ts` instead of defining
them.

### Decision 2: One typed entry point, `compileDefinition`

```ts
compileDefinition(def: unknown):
  | { ok: true; definition: AppDefinition; fingerprint: string }
  | { ok: false; error: string }
```The pipeline is exactly the normalization `add_app` applies today,
in this order:

1. `validateDefinition` — the submitted input must validate, exactly
   as `add_app` validates today; on failure the error string is
   returned unchanged. Validation deliberately runs on the input,
   not on a pre-migrated copy: the validator version-branches on
   `effect` vs `effects`, so pre-migrating would reject a valid v3
   single-`effect` definition and accept an invalid v5 single-`effect`
   one (verified during implementation). `migrateDefinition` /
   `migrateAction` stay exported helpers (used by `canonicalizeDefinition`
   and available to callers) but are not a separate compile step.
2. `canonicalizeDefinition` — schema restamp to the current
   version, per-action effects migration, icon sanitization,
   open-mode derivation, capability defaults, bundle stringification.
3. `fingerprintDefinition` — run on the canonical form, so the
   fingerprint in the result always matches the stored form.

Callers get a typed `AppDefinition` or one error string, instead of
calling `validateDefinition` (string-or-null) and then re-reading
raw string keys off the definition. The existing functions stay
exported from the new module with unchanged signatures, so
`compileDefinition` is additive: nothing that imports the
individual functions has to change.

### Decision 3: `add_app` calls the compiler; the gates do not move

`add_app` today calls `validateDefinition` then, after the
`minPackageVersion` check and the existing-id read,
`canonicalizeDefinition`. It SHALL call `compileDefinition` for
those two steps instead. The order around it is unchanged: the
schema-floor gate and the `minPackageVersion` gate still run where
they run today, and the new-id staleness check (a new id must carry
the current schema version; re-adding restamps) still runs after
compilation with its wording unchanged, reading the submitted
definition's version — the compiled form is always restamped to
current, so checking the compiled form would be vacuous.
Compilation does not decide installability; it only decides whether
a definition is well-formed and what its canonical form is.

### Decision 4: Re-exports keep every import path working

`registry.ts` re-exports every moved name it used to export, and
`pkg/src/apps/index.ts` / `pkg/src/index.ts` keep re-exporting them
from the same paths. No MCP export is added, removed, renamed, or
reshaped, and no caller (`app.ts`, catalog harnesses, `add-app`
scripts) changes its import. A caller that wants the new entry
point imports `compileDefinition` from `definition.ts` (via the
existing `apps/index.ts` barrel). The move is verified by
byte-identical behavior, not by updating callers: same validation
errors, same canonical forms, same fingerprints for the same
inputs.

### Decision 5: ES2019 ceiling and test surface

The new module obeys the same ES2019 ceiling as the file it comes
from (no `?.`, no `??`). The pure surface is directly testable
without a store: the schema-migration harness
(`tests/schema-migration.ts`) and the catalog harness exercise the
compiler through `add_app` as today, plus a direct unit check that
`compileDefinition` returns the canonical form and fingerprint for
a known definition and the validator's error for a known-bad one.
No new harness is introduced; the existing ones gain a direct
compiler case.

### Decision 6: Version decision deferred to publish

An internal refactor with no observable change is PATCH per the
version policy. No `pkg/package.json` change lands in this change;
the PATCH bump rides with the publish that carries it.
