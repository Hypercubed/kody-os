# Tasks: store list shape — normalize a bare-array `list()` result

Spec-only change; no implementation is done by writing these
tasks. Checkboxes stay unchecked until the work is verified.

## 1. Storage: normalize in `resolveStore()`

- [x] 1.1 Add exported `normalizeListResult(result, options)` to
      `pkg/src/apps/storage.ts`, implementing design.md Decision
      2 (bare array → filter by prefix, sort by key, skip
      entries without a string key; envelope → pass through
      untouched; anything else → reject naming the shape) and
      Decision 3 (page size default 250, floor 1, cap 1000;
      `startAfter` selects the first key strictly greater;
      `estimatedBytes` over the returned page by the
      `createMemoryStore()` formula; `truncated` /
      `nextStartAfter` from the filtered set).
- [x] 1.2 In `resolveStore()` (`storage.ts:96-119`), wrap the
      hosted handle at the passthrough (`:111`) when it has a
      `list()` function: return an adapter that forwards `get` /
      `set` / `delete` to the handle's own methods (receiver
      preserved) and routes `list()` through
      `normalizeListResult`. A handle without `list()` passes
      through unchanged, so `listInstalledIds`' existing loud
      error still fires. Explicit overrides stay trusted as-is.
- [x] 1.3 `listInstalledIds` (`pkg/src/apps/registry.ts:335-355`)
      takes no change. Verify by reading that its pagination loop
      already follows `truncated` / `nextStartAfter`; record the
      confirmation in the change close-out.

## 2. Spec delta

- [x] 2.1 Add the delta at
      `openspec/changes/store-list-shape/specs/app-registry/spec.md`:
      the `KeyStore` lists-keys-by-prefix requirement gains the
      normalization rule (bare array → envelope, envelope →
      pass-through, unrecognized → reject) and the four new
      scenarios (bare-array enumeration, envelope pass-through,
      unrecognized shape fails loudly, homepage lists installed
      apps from a bare-array store). No other canonical spec
      changes: the derived-list requirement already states
      pagination runs to completion.

## 3. Harness: both shapes

Extend `tests/store-harness.ts` (existing `list()` checks at
`:319-337` cover the memory store's envelope shape). Seed one
store per shape and assert through `normalizeListResult` and
through the adapter path:

- [x] 3.1 Bare array, prefix filtering: a 55-entry array mixing
      `kody-os.apps.def.*`, `kody-os.apps.state.*`, and other
      `kody-os.apps.*` keys returns only the requested prefix's
      keys.
- [x] 3.2 Bare array, key order: entries come back sorted by key
      even when the input array is unsorted.
- [x] 3.3 Bare array, pagination: with `pageSize: 2` over the
      13 def keys, enumeration returns all 13 ids, alphabetical,
      across 7 pages; `truncated` / `nextStartAfter` chain
      correctly and the last page ends untruncated with
      `nextStartAfter: null`.
- [x] 3.4 Bare array, `startAfter`: a second call with the
      previous page's `nextStartAfter` continues exactly after it.
- [x] 3.5 Bare array, `estimatedBytes`: covers only the returned
      page, computed by the `createMemoryStore()` formula.
- [x] 3.6 Bare array, malformed entry: an entry without a string
      key is skipped and the rest still enumerate.
- [x] 3.7 Envelope pass-through: a documented-envelope result is
      returned with entries, order, `estimatedBytes`,
      `truncated`, `nextStartAfter`, and `pageSize` exactly as
      given, with no re-filtering or re-sorting.
- [x] 3.8 Unrecognized shape: `null`, `undefined`, and an object
      without an `entries` array each reject with an error naming
      the shape.
- [x] 3.9 End-to-end through `listInstalledIds`: a store whose
      `list()` returns the bare array yields the same installed
      ids as the same keys through the memory store.

## 4. Regression checks

- [x] 4.1 `bun run typecheck` — exit 0, 0 errors.
- [ ] 4.2 `bun build` succeeds.
- [x] 4.3 `bun tests/store-harness.ts` — all checks pass,
      including the new 3.x checks.
- [x] 4.4 `bun tests/catalog-harness.ts` — all pass (no catalog
      change; sanity only).

## 5. Mock visual check

Run after implementation, against the mock dev env (the
`kody dev` live reload picks up `pkg/src` edits; no mock store
write is needed — the installed data is already there):

- [x] 5.1 `GET /` lists the 13 installed apps (no "No apps
      installed yet").
- [x] 5.2 `GET /apps` lists the same 13 ids, alphabetical.
- [x] 5.3 `list_apps()` via the CLI mock returns the 13 ids.
- [ ] 5.4 The Store page still renders its rows and Counter
      still reads absorbed (no regression in the `get()` paths).

## 6. Hosted shape (if a live way ever appears)

- [x] 6.1 If a live hosted probe becomes possible from this
      environment, verify what the hosted `packageStorage()`
      `list()` returns (envelope or bare array) and record the
      answer in the change close-out. If no live way appears,
      record it as unknowable and handled by the both-shapes
      design — do not block the change on it.

## Sync notes — 2026-11-11

Boxes checked in this sync for work actually completed and verified in
this session; the rest stay unchecked with the reason. Verification
figures are the branch-final run (store harness 187 PASS / 1
pre-existing FAIL for the stale 4.1.3 version check; catalog harness
ALL PASSED, 18 apps; typecheck exit 0; bundle tests 120 ok).

- 4.2 (unchecked): no bun build run is recorded for this change; the
  mock dev server serves the bundle (implying it compiles), which is
  a substitute, not the named check.
- 5.4 (unchecked): the Counter reads behind-modified in the mock, not
  absorbed as written — the 'Counter still reads absorbed' wording
  does not match the mock's state. The get() paths show no regression
  (13 apps listed, the Store renders).
