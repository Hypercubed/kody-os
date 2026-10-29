# Tasks

## 1. Dependency and board read path

- [ ] 1.1 Declare `@hypercubed/handoff` in `pkg/package.json#kody.dependencies` (pinned) and verify the static import resolves in a local typecheck plus preview boot with no capability errors
- [ ] 1.2 Add the board read path in `pkg/src/app.ts` (live `listTasks` at render, wrapped with failure isolation to an inline error) and verify the board renders the queue plus an honest error when handoff is simulated down
- [ ] 1.3 Create `pkg/examples/handoff-board.bundle.json` (bundle UI, stateSchema for snapshot + taken-at, `set`-only Refresh) and verify it installs via `add_app` and renders on preview

## 2. Snapshot, docs, publish proof

- [ ] 2.1 Verify Refresh snapshots the listing into ordinary state (export/import round-trips) and the taken-at marker distinguishes live from snapshot
- [ ] 2.2 Document the external-data app pattern in `pkg/docs/adding-an-app.md` (declare dep, read at render, snapshot via `set`, pinning + staleness + runs-as notes) and verify ES2019 grep zero hits for `?.`/`??`/`replaceAll`/`.at(` plus `openspec validate --changes` passes
- [ ] 2.3 Publish and record the exact capability-approval flow encountered (or its absence), install the board on Kody prod, and verify live queue + snapshot + outage degradation end to end
