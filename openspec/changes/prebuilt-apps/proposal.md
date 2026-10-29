# Proposal

## Why

Every fresh install starts empty with no way to ship a working out-of-box set. Seeding the bundled validation apps on first run makes a new OS immediately useful. (Removal lives in the separate `remove-app` change.)

## What Changes

- Fresh installs auto-seed a bundled set of definitions on first run (empty registry only; never overwrites user state). Seed set = the package's bundled validation apps at publish time (`counter` today; clock/calendar once built).
- Explicit non-goal: no gallery, no catalog, no install-from-list UI. Removal lives in the `remove-app` change.
- BREAKING: none. Additive API; existing installs and exports are unaffected.

## Capabilities

### New Capabilities

(none — both behaviors extend the registry lifecycle)

### Modified Capabilities

- `app-registry`: lifecycle gains first-run seeding from the bundled set. Validation, atomicity, and export rules apply unchanged.

## Impact

- `pkg/src/apps/registry.ts` (seed routine), `storage.ts` (no new keys beyond the existing namespace), seeded definitions install via `pkg/examples/*.bundle.json`.
- First-run detection reads the (empty) registry; no migration needed. No MCP surface removals; no new exports (seeding is internal wiring).
- No theme/client changes expected beyond what already renders empty vs populated states.
