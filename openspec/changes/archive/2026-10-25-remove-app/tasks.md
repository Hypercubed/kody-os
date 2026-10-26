## 1. remove_app

- [x] 1.1 Add `remove_app` validation (installed id required, clear error otherwise, no writes on failure) and verify unknown ids return `{ ok: false }` without touching storage
- [x] 1.2 Implement atomic removal (definition + state keys deleted, all reference lists scrubbed in the same write set) and verify a pinned, hidden, recently-used app vanishes completely with one call
- [x] 1.3 Export `remove_app` from the package index and verify it is callable alongside the existing registry surface

## 2. Verification

- [x] 2.1 Run the full change checks (remove unknown id, remove seeded app still installed at the time, blank-store round trip unaffected) and verify `openspec validate` passes for the change
