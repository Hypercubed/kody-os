# Store list shape: normalize a bare-array `list()` result

## Why

`http://127.0.0.1:4302/` shows "No apps installed yet" while
`/manage/rows` (which reads via `get()`) sees all 13 installed
apps. Root cause, verified live on 2026-11-11: the mock handle's
`packageStorage().list()` returns a bare 55-element array of
`{ key, value }` pairs — the entire `local:kody-os` namespace,
prefix ignored — instead of the Kody-documented envelope
`{ entries, estimatedBytes, truncated, nextStartAfter, pageSize }`
with server-side prefix filtering. `listInstalledIds`
(`pkg/src/apps/registry.ts:335`) reads `result.entries.length`,
which on an Array is `Array.prototype.entries` (a function, arity
0), so the loop never runs and it returns `[]` with no error.

The canonical spec (`openspec/specs/app-registry/spec.md`,
Requirement: `KeyStore` lists keys by prefix) says the hosted
handle backs `KeyStore.list()` directly and the mock store SHALL
implement the same shape. The mock does not. The hosted
`packageStorage().list()` shape was never verified live either,
so the fix must handle BOTH shapes defensively rather than
assuming one.

## What changes

- `resolveStore()` (`pkg/src/apps/storage.ts:96`) wraps the hosted
  handle's `list()` at the passthrough seam: a bare-array result
  is normalized into the documented envelope with the prefix
  filter applied client-side; a documented-envelope result passes
  through untouched; anything else rejects with a clear error.
- One new exported helper in `storage.ts`, `normalizeListResult`,
  so the store harness can test both shapes without a hosted
  runtime.
- `listInstalledIds` itself is unchanged: its pagination loop
  already follows `truncated` / `nextStartAfter` to completion.
- Canonical spec delta on the `KeyStore` lists-keys-by-prefix
  requirement (normalization rule + new scenarios).

## What does not change

- No change to the hosted handle, no change to the registry-key
  derivation (a definition key still means installed), no
  re-seed or reinstall of mock data, no change to `get()` /
  `set()` / `delete()`, no change to `listInstalledIds`'s
  pagination loop, no catalog app changes, no `catalogVersion`
  bump.
- No package version change of its own: this folds into the
  pending uncommitted 4.2.0 MINOR (design.md, Decision 5).

## Non-goals

- Fixing the mock handle itself. It is platform-owned, not in
  this repo; the shell must tolerate the shape it returns.
- Verifying the hosted `list()` shape live. There is no live
  hosted probe from this environment; the both-shapes design
  makes that question unnecessary.
- Changing the list-prefix derivation back to a registry key.
