# Proposal

## Why

The live v1 action schema forces every action to declare exactly one effect, so multi-field writes, computed values, and time-stamping need one action per field. Action Schema v2 lifts that limit with an `effects` array — but v2 definitions must coexist with installed v1 apps, and re-adding a definition must never silently destroy user state. This change (part 1) delivers the migration + atomic write path that every later v2 part builds on.

## What Changes

- New `app-migration` capability: factored `migrateAction` / `migrateDefinition` helpers that normalize external definitions (v1 single-`effect` and v2 `effects[]`) into one canonical validator input, plus a validator selector keyed on the definition version.
- `add_app` becomes fully atomic (`pkg/src/apps/registry.ts`): validate everything first (definition, overwrite policy, migration, candidate state), then commit with a single registry write and a single state write. A failed call leaves storage byte-identical.
- Same-id overwrite semantics change: preserve state by default, carrying forward only declared fields and resetting dropped fields to `initial`. **BREAKING** vs the archived rule (reset-to-initial on every re-add); explicit `resetState: true` restores the old behavior, and `migrate` maps/renames fields with validator-checked values.
- Version reconciliation (per user decision 2026-10-27): the pasted spec's `schemaVersion: 1|2` action-schema selector collides with the shipped definition eras (`DEFINITION_SCHEMA_VERSION = 3`, `add_app` rejects ≠ 3). This change folds the action-schema generation into the definition era scheme: **v2 action shape ships as definition `schemaVersion: 4`**, `DEFINITION_SCHEMA_VERSION` bumps 3 → 4, and the validator selector keys on the definition version (3 = legacy single-effect, 4 = effects array).
- Pre-version installs (no `schemaVersion`) keep the existing read backfill (pass = current, fail = 1).

## Capabilities

### New Capabilities

- `app-migration`: factored definition/action migration helpers plus atomic `add_app` commit semantics (validate-all-first, single registry write + single state write, storage untouched on failure).

### Modified Capabilities

- `app-registry`: same-id overwrite now preserves state by default (declared fields carried forward, dropped fields reset to `initial`) instead of resetting to `initial`; new `resetState` / `migrate` options; `schemaVersion: 4` accepted as current; rejection error names the new version.

## Impact

- `pkg/src/apps/types.ts` (`DEFINITION_SCHEMA_VERSION` 3 → 4 with era history, v2 effect types if not already present).
- `pkg/src/apps/registry.ts` (`migrateAction` / `migrateDefinition` helpers, validator selector, atomic `add_app` rewrite).
- `pkg/docs/adding-an-app.md` (v4 + preserve-by-default + `resetState`/`migrate` docs).
- `example-apps/*.json` restamped to `schemaVersion: 4` where the shape is v2-clean.
- Later v2 parts (2–5, not in this change) build on the migration helpers and atomic commit proven here.
