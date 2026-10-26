# Design

## Context
See proposal.md Why. Current state: kody-os declares no `kody.dependencies` (flat `kody.app` block only); app pages render definition + `packageStorage()` state with no external reads. Handoff exposes `listTasks({status, forAgent, limit})` / `getTask({taskId})` as importable exports (`kody:@hypercubed/handoff/...`), queue shared account-wide.

## Goals / Non-Goals
- Goals: prove the static-dependency read path end to end (declare, import, render, snapshot, publish, verify on prod); read-only board.
- Non-Goals: no claim/complete from the board (deferred follow-up); no generic external-data framework; no raw cross-package key reads.

## Decisions
1. **Static dependency, not key reads** — `package.json#kody.dependencies` pins `@hypercubed/handoff`; page render imports `listTasks`. Why: versioned, approved, capability-fingerprinted; raw `handoff.*` key reads are unversioned and their store scoping is unverified.
2. **Read at render, snapshot on Refresh** — GET renders live; Refresh is a normal `set` action whose `fromArg` carries the fetched listing (passed through the action args, validated by the state schema like any other write). Why: zero new effect ops; export/import works unchanged; the board is honest about staleness via a taken-at field.
3. **Failure isolation at the board boundary** — the external read is wrapped; throw/timeout → inline error section, HTTP 200, rest of shell untouched. Why: one flaky dependency must not 500 the OS.
4. **Read-only for this test** — no `claimTask`/`completeTask` wiring even though the actions exist. Why: the question under test is visibility, not control; mutations need their own auth/UX design.

## Risks / Trade-offs
- [Risk] Capability approval blocks publish (new cross-package import) → Mitigation: the test's job is partly to surface this; record the exact approval flow in tasks.
- [Risk] Handoff breaking change pins us to a stale version (no auto-republish of dependents) → Mitigation: pin deliberately, note the staleness date in the guide.
- [Risk] Runs-as identity confusion (reads run as publisher, not viewer) → Mitigation: single-owner setup makes this moot; document it.

## Migration Plan
1. Declare dep, build board behind the existing app contract, verify on preview (including handoff-down simulation).
2. Publish (expect and record the approval flow), install, verify live on prod.
3. Rollback: `remove_app` the board + republish without the dep; no storage migration involved.

## Open Questions
- None (mutation UX is deferred scope, not an unknown).
