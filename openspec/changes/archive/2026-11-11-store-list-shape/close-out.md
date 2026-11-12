# Close-out: store-list-shape (normalize a bare-array list() result)

Closed 2026-11-11. Implemented on branch close-v4-tail, uncommitted.
Archived per the repo's archive precedent
(openspec/changes/archive/<date>-<slug>/). No catalogVersion bump
(no catalog definition or bundle change); package 4.2.0 / build 46.

## What was implemented

- pkg/src/apps/storage.ts: exported normalizeListResult(result,
  options) — a bare array filters by prefix, sorts by key, and skips
  entries without a string key; a documented envelope passes through
  untouched; anything else rejects with an error naming the shape.
  Page size defaults to 250, floor 1, cap 1000; startAfter selects
  the first key strictly greater; estimatedBytes covers the returned
  page by the createMemoryStore() formula; truncated /
  nextStartAfter derive from the filtered set.
- pkg/src/apps/storage.ts: resolveStore() wraps the hosted handle at
  the passthrough when it has a list() function, returning an adapter
  that forwards get / set / delete to the handle's own methods
  (receiver preserved) and routes list() through
  normalizeListResult. A handle without list() passes through
  unchanged, so listInstalledIds' existing loud error still fires.
- pkg/src/apps/registry.ts: listInstalledIds takes no change.
  Confirmation (required by task 1.3): its pagination loop follows
  truncated / nextStartAfter to completion and rejects a truncated
  page that arrives without nextStartAfter.
- Spec delta at openspec/changes/store-list-shape/specs/app-registry/
  spec.md: the KeyStore lists-keys-by-prefix requirement gains the
  normalization rule, with six scenarios (prefix filtering and
  paging; a store without list() fails loudly; bare-array
  enumeration; envelope pass-through; unrecognized shape fails
  loudly; the homepage lists installed apps from a bare-array
  store).
- tests/store-harness.ts: both-shapes checks (tasks 3.1-3.9) —
  55-entry bare array prefix filtering, key order, pagination
  across 7 pages (13 ids), startAfter continuation, estimatedBytes
  per page, malformed entry skipped, envelope pass-through,
  unrecognized shape rejects naming the shape, and end-to-end
  through listInstalledIds.

## Verification (2026-11-11, branch close-v4-tail, branch-final run)

- bun run typecheck from pkg/: exit 0, 0 errors.
- bun tests/store-harness.ts: 187 PASS, 1 FAIL — the FAIL is the
  pre-existing stale hardcoded check expecting package version 4.1.3
  (not fixed here, per scope).
- bun tests/catalog-harness.ts: ALL PASSED (18 apps).
- bun catalog/tests/app-store-tests.cjs: 120 ok.
- Mock: GET / lists the 13 installed apps (no 'No apps installed
  yet'); GET /apps lists the same 13 ids, alphabetical; list_apps()
  via the mock returns the 13 ids; the Store page still renders its
  rows and the get() paths show no regression.

## Deviations and what was left unchecked

- Task 1.2: the no-list() pass-through is code-confirmed
  (storage.ts, resolveStore) but has no dedicated harness check; the
  loud error itself is the race change's task 1.4, also unchecked
  for the same reason (see that change's close-out).
- Task 4.2 (bun build) has no recorded run for this change; the mock
  dev server serves the bundle (implying it compiles), which is a
  substitute, not the named check.
- Task 5.4: the Counter reads behind-modified in the mock, not
  absorbed as written — the wording does not match the mock's state.

## Open follow-ups

- Hosted shape (task 6.1): no live hosted probe was possible from
  this environment, so what the hosted packageStorage() list()
  returns (envelope or bare array) remains unknowable here. It is
  handled by the both-shapes design — do not block on it. Note: the
  mock store's list() returns a bare array (that is what this
  normalizer was built for), but the mock is platform-provided and
  need not match hosted.
