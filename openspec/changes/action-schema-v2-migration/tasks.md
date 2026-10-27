# Tasks

## 1. Version bump and migration helpers

- [ ] 1.1 Bump `DEFINITION_SCHEMA_VERSION` 3 → 4 with era history in `pkg/src/apps/types.ts`, add v2 `effects[]` types, and verify `node --experimental-strip-types --check` passes
- [ ] 1.2 Add `migrateAction` / `migrateDefinition` plus version-selected validation in `pkg/src/apps/registry.ts` and verify v1 single-effect normalizes, v2 passes through, and unknown versions reject naming supported versions

## 2. Atomic add_app with preserve-by-default

- [ ] 2.1 Rewrite `add_app` as validate-all-first then single-registry-write + single-state-write, with `resetState` / `migrate` options, and verify each failure mode leaves storage byte-identical plus targeted preserve/reset/migrate-abort checks
- [ ] 2.2 Restamp the five example apps (`clock`, `eight-ball`, `hello-counter`, `probe`, `mac-puzzle`) to `schemaVersion: 4` and verify `list_apps` shows version 4 on each

## 3. Docs and verify

- [ ] 3.1 Document v4 + preserve-by-default + `resetState`/`migrate` in `pkg/docs/adding-an-app.md` and verify ES2019 grep zero hits for `?.`/`??`/`replaceAll`/`.at(` plus `openspec validate --changes` passes
