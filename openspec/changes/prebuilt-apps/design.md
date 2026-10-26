# Design: prebuilt-apps

## Context

See proposal.md (Why). The registry resolves stores via `resolveStore()` (hosted `packageStorage()` with in-memory fallback) and already validates + applies atomically in `act()`; `export_app`/`import_app` round-trip definitions. Nothing seeds a blank install. (Removal lives in the separate `remove-app` change.)

## Goals / Non-Goals

- Goals: lazy first-run seeding from the bundled set; same validation + atomicity guarantees as every other registry write.
- Non-goals: gallery/catalog UI (explicitly declined), seeded-app update mechanics (a republish ships a new bundle; existing installs keep their state). Removal lives in the `remove-app` change.

## Decisions

1. **Lazy seeding on first read, not an explicit seed step**: any registry read path checks for an empty registry and installs the seed set first (guarded so concurrent calls seed once). Rationale: no lifecycle hook exists to run install-time code, and lazy seeding makes blank stores (tests, fresh installs, new devices) behave identically without a separate step. Alternative (explicit `seed_apps()` the shell must call) rejected: it adds a call every new surface must remember, and a missed call yields the old empty home.
2. **Seed set = the validation apps bundled at publish time** (`hello-counter` today; clock/calendar once built), installed via the same `add_app` path (so validation applies to seeds too). A corrupt seed definition fails closed like any bad definition.
## Risks / Trade-offs

- [Risk] Lazy seeding adds reads on every cold path → Mitigation: a single registry-key read; the seeded marker is the registry itself being non-empty, so steady state costs one extra read only on truly blank stores.
- [Risk] A seeded app the user deleted returns after republish with a new bundle → Mitigation: seeding only fires on *empty* registries, never merges; per-app version upgrades are out of scope.
- [Risk] Concurrent first reads double-seed → Mitigation: seed writes are idempotent (same ids, `add_app` overwrites identically); worst case is redundant identical writes.

## Migration Plan

None — additive API, no existing data shape changes. Blank stores self-populate on next read; populated stores are untouched. Rollback is a republish of the prior commit.

## Open Questions

None.
