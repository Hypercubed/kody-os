# Proposal

## Why

kody-os apps only show their own stored state today. Proving an app can display and snapshot another package's live data (`@hypercubed/handoff` task queue) establishes the pattern for kody-os managing other packages — dashboards over the whole account, not one package at a time.

## What Changes

- New `handoff-board` example app: bundle UI listing handoff tasks (title, status, agent), backed by a static dependency on `@hypercubed/handoff`.
- Page render reads the queue live via `listTasks` (declared in `package.json#kody.dependencies`); a Refresh action snapshots the listing into the app's own state via the standard `set` effect so the board survives handoff outages and exports cleanly.
- Scope is read-only for this test: list + detail view + snapshot. Claiming/completing tasks from the board is explicitly deferred.
- Handoff unreachable at render time degrades to an honest inline error; the OS shell and all other apps are unaffected.

## Capabilities

### New Capabilities

- `external-package-apps`: apps whose page render reads another package's exports through a declared static dependency, with snapshot-to-state via standard actions.

### Modified Capabilities

- `shell`: app pages MAY show live externally-sourced data alongside stored state and snapshot it through standard actions.

## Impact

- `pkg/package.json` (new `kody.dependencies` entry for `@hypercubed/handoff`), `pkg/src/app.ts` (board read path with failure isolation), `pkg/examples/handoff-board.bundle.json` (new installable example), `pkg/docs/adding-an-app.md` (external-data app pattern).
- No change to the app definition schema, MCP surface, or export format (snapshots export as ordinary state). Static-dependency version pinning + capability approval + runs-as identity per prior analysis; test will surface the actual approval flow.
