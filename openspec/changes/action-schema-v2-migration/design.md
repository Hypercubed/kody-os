# Design

## Context

See proposal.md Why. Current state: `validateDefinition` checks one shape (`pkg/src/apps/registry.ts:140`); `ActionDef` carries a single `effect` (`pkg/src/apps/types.ts:108`); `add_app` rebuilds the definition and resets state to `initial` on every same-id re-add (`registry.ts:753`); `DEFINITION_SCHEMA_VERSION = 3` (`types.ts:149`); read backfill labels pre-version installs (`registry.ts:391`).

## Goals / Non-Goals

- Goals: factored v1→canonical normalization, version-selected validation (3 legacy / 4 effects-array), atomic validate-then-commit `add_app`, preserve-by-default overwrite with `resetState` / `migrate` options.
- Non-Goals: executing multi-effect actions at `act()` time (later v2 part); auto-migrating installed v3 apps to v4 (authors re-add); envelope format change (stays `kody-os-app/2`).

## Decisions

1. **Fold into definition eras (`schemaVersion: 4`), not a parallel field** — user decision 2026-10-27. Why: one version gate in `add_app`, one backfill path, matches the existing envelope-version pattern. Alternative (separate `actionVersion`) rejected: two version axes need a compat matrix for zero gain.
2. **Normalize at the boundary, validate the canonical shape** — `migrateAction` expands v1 single-effect to one-entry `effects[]` before validation, so the validator only ever sees one shape. Why: single validator to test, no v1/v2 branches in every check. Alternative (dual validators) rejected: doubles every future validation change.
3. **Overwrite = preserve declared + reset dropped, atomic with the definition write** — state merge computed during validation, committed in the same single state write. Why: a failed migrate leaves definition AND state untouched (no half-migrated app). Alternative (write definition first, then state) rejected: crash window leaves mismatched pair.
4. **`resetState` / `migrate` as call options, not definition fields** — they describe the write, not the app. Why: keeps stored definitions clean and the export envelope unchanged. Alternative (definition-level flags) rejected: flags would persist and confuse re-imports.
5. **Drop `ui.template` in v4, reject on write, tolerate on read** — the field is a frozen stub the renderer never branches on. Why: one less thing for new readers to puzzle over; the v4 bump is the only clean moment (stored v3 defs keep the field inertly until re-added). Alternative (leave it forever) rejected: permanent dead surface in types, validator, rebuild, and every example. Read path needs no backfill change — `backfillDefinition` passes the stored shape through and the renderer ignores the field either way.

## Risks / Trade-offs

- [Risk] Preserve-by-default surprises authors expecting the old wipe → Mitigation: `resetState: true` restores legacy behavior; docs call out the change; rejection/overwrite errors name the version.
- [Risk] Normalization masks a v1 definition that could never validate as v2 → Mitigation: normalization is structural only (wrap in array); semantic checks run after, on the canonical shape.
- [Risk] Bumping current to 4 rejects in-flight v3 `add_app` calls → Mitigation: same pattern as the 2→3 bump; error names version 4; example apps restamped in the same change.

## Migration Plan

1. Land types (bump + v2 effect types) + helpers + atomic `add_app` + preserve-by-default together (one coherent unit).
2. Restamp the five example apps (`clock`, `eight-ball`, `hello-counter`, `probe`, `mac-puzzle`) to `schemaVersion: 4`, stripping `ui.template` from each plus `test-app.ts`.
3. Rollback: republish prior commit; v4 definitions fail closed on old code (rejected, nothing written).

## Open Questions

- None taken into this part; parts 2–5 (act-time multi-effect execution and remaining v2 surface) are separate changes.
