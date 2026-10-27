# Tasks

## 1. Version field and enforcement

- [x] 1.1 Add required integer `schemaVersion` to `AppDefinition` plus `DEFINITION_SCHEMA_VERSION = 3` with era history in `pkg/src/apps/types.ts` and verify `node --experimental-strip-types --check` passes
- [x] 1.2 Enforce in `add_app` (`pkg/src/apps/registry.ts`): reject missing/stale versions on new ids naming the current version, restamp on overwrite, backfill pre-version installs on read (validate-then-label), and verify each rule with targeted `validateDefinition`/`add_app`/`get_app` checks

## 2. Docs, examples, verify

- [x] 2.1 Re-add the four example apps so stored definitions carry version 3 and verify `list_apps` shows `schemaVersion: 3` on each
- [x] 2.2 Document the versioning contract in `pkg/docs/adding-an-app.md` (send current `schemaVersion`, rejection names it, breaking changes bump it) and verify ES2019 grep zero hits for `?.`/`??`/`replaceAll`/`.at(` plus `openspec validate --changes` passes
