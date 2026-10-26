# Design

## Context
See proposal.md Why. Current state: the export *envelope* is versioned (`kody-os-app/2` with a v1→v2 `migrateDefinition` importer in `registry.ts:942`), but the *definition* carries no version — `validateDefinition` checks only the current shape, so installed apps are indistinguishable by era.

## Goals / Non-Goals
- Goals: per-app version stamping at creation, current-version enforcement on new ids, restamp on overwrite, read-time backfill, no-version-query endpoint needed.
- Non-Goals: no auto-migration of stale apps (list them; authors re-add); no envelope format bump.

## Decisions
1. **Integer `schemaVersion`, single constant** — `DEFINITION_SCHEMA_VERSION = 3` beside `EXPORT_FORMAT`, history in a comment (1 = operator-only, 2 = +bundle kind, 3 = unified). Why: mirrors the existing envelope-version pattern; one place to bump.
2. **Enforce on write, backfill on read** — `add_app` rejects stale/missing versions for new ids and restamps overwrites; reads validate-then-label (pass = current, fail = 1). Why: writes stay strict while old installs remain readable and listable instead of bricking.
3. **Version rides in the definition, not the envelope** — export/import untouched. Why: the envelope already carries the whole definition; a second version field would need its own compat story for zero gain.
4. **No new endpoint** — `list_apps`/`get_app` return definitions, which now include the version. Why: "what needs updating" is a filter over data the caller already has.

## Risks / Trade-offs
- [Risk] Backfill mislabels a subtly-invalid old app as current → Mitigation: backfill runs full current validation, not a field-presence check.
- [Risk] Agents hardcode the version and break on the next bump → Mitigation: rejection error names the current version; guide tells authors to read it from `get_app` of any installed app or the error itself.

## Migration Plan
1. Land constant + field + `add_app` rules + backfill together (one coherent unit; strict from day one for new ids, backfill covers existing installs).
2. Backfill pass: re-add the four example apps so prod carries version 3.
3. Rollback: republish prior commit; version field is inert data to old code.

## Open Questions
- None.
