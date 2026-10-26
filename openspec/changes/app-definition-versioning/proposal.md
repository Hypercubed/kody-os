# Proposal

## Why

Breaking schema changes today are invisible: installed apps carry no record of which definition shape they conform to, so after a change (operator → bundle → unified) there is no way to list which apps need updating. Stamping every app with the schema version at creation, and bumping that version on breaking changes, turns "what's stale?" into a query.

## What Changes

- `AppDefinition` gains required integer `schemaVersion`; a `DEFINITION_SCHEMA_VERSION` constant (current: `3` — 1 = operator-only, 2 = bundle kind, 3 = unified) is the single source of truth.
- `add_app` stamps/validates: new definitions must carry the current version (missing or older on a *new id* is rejected with the current version named); re-adding an existing id overwrites and restamps to current.
- Pre-version installed apps backfill on read: validate against current shape — pass means current version, fail means oldest known (`1`).
- `list_apps`/`get_app` already return the definition, so per-app versions are visible with no new endpoints; export envelopes carry the version inside the definition (no envelope format bump).
- Breaking schema changes bump the constant and ship a migration where one exists (same pattern as the v1→v2 importer); `pkg/docs/adding-an-app.md` gains a versioning section.

## Capabilities

### New Capabilities

(none — behavior change to an existing capability)

### Modified Capabilities

- `app-registry`: definition schema gains `schemaVersion`; `add_app` enforces current version on new ids and restamps on overwrite; reads backfill pre-version installs.

## Impact

- `pkg/src/apps/types.ts` (`schemaVersion` field + history comment), `pkg/src/apps/registry.ts` (constant, `add_app` validation/stamping, read backfill, `list_apps` summaries carry version), `pkg/docs/adding-an-app.md` (versioning section).
- No storage migration (version lives inside the existing definition JSON); no new MCP endpoints; export format unchanged (version rides in the definition). **BREAKING** for definition authors: new `add_app` calls without the current `schemaVersion` are rejected — agents must send it.
