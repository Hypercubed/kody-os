# Store list shape: normalize a bare-array `list()` result — design

## Context

Two shapes of `list()` are in play, and the code only speaks one:

- **Documented envelope** (Kody docs; `KeyStore.list` contract,
  `pkg/src/apps/storage.ts:21-27`): `{ entries: [{ key, value }],
  estimatedBytes, truncated, nextStartAfter, pageSize }`, `pageSize`
  default 250, cap 1000, entries in key order, prefix filtered
  server-side. `createMemoryStore()` (`storage.ts:43-80`)
  implements exactly this.
- **Bare array** (mock handle, verified live 2026-11-11): a plain
  `Array<{ key, value }>` of the whole `local:kody-os` namespace
  (55 entries in the live mock), prefix ignored, no pagination
  fields, no `pageSize`/`startAfter` handling observed.

`listInstalledIds` (`pkg/src/apps/registry.ts:335-355`) paginates
`list({ prefix: DEF_PREFIX })` and reads `result.entries.length`
(`registry.ts:343`). Against the bare array, `result.entries` is
`Array.prototype.entries`, a function, so `result.entries.length`
is `0`, the loop never runs, and the function returns `[]` with
no error. Every installed-enumeration path goes through
`listInstalledIds` (callers at `registry.ts:213, 403, 1466, 1650,
1714, 2003`, covering `list_apps`, `get_launcher_state`,
`get_store_rows`, export/import, and backup-restore reset), so
the homepage, the Apps page, and every derived list read empty
while `get()`-based paths (Store rows, app pages) still see the
apps. That is the whole of the "No apps installed yet" symptom.

The hosted `packageStorage().list()` shape is unverified live
from this environment and unknowable here. The design therefore
treats the envelope as the contract and the bare array as a
second shape to tolerate, never assuming which one arrives.

## Decisions

### Decision 1: the seam is `resolveStore()`'s hosted-handle passthrough

`resolveStore()` (`storage.ts:96-119`) returns the hosted handle
as a `KeyStore` at line 111 (`return store as KeyStore`). That
cast is the one place a foreign-shaped object enters typed code,
so it is the seam: when the handle has a `list()` function, return
a thin adapter object instead of the raw handle. The adapter
forwards `get` / `set` / `delete` to the handle's own methods
(called as methods of the handle, so the receiver is preserved)
and routes `list()` through the normalizer (Decision 2).

Alternatives rejected:

- Normalizing inside `listInstalledIds`: would fix enumeration
  only, while the contract breach is `KeyStore.list`'s. Every
  caller of `list()` deserves the documented shape.
- Normalizing in `createMemoryStore()` or the harness: the memory
  store already returns the envelope; the breach is the hosted /
  mock handle, not the fallback.
- Falling back to the shared memory store on a shape mismatch:
  that reads as an empty install — the exact failure being
  fixed. A shape mismatch must be normalized or fail loudly,
  never silently replaced with empty data.

A handle without `list()` passes through unchanged, exactly as
today, so `listInstalledIds`' existing loud error
(`registry.ts:336`, naming the store) still fires. Explicit
overrides (`storage.ts:97`) are trusted as-is: they are test
doubles that already implement the contract, and the harness
covers the bare-array shape through the exported normalizer
directly (Decision 2), not by smuggling a mock handle through
`resolveStore()`.

### Decision 2: one exported normalizer, `normalizeListResult`

`storage.ts` gains an exported

```ts
normalizeListResult(
  result: unknown,
  options: { prefix: string; pageSize?: number; startAfter?: string },
): { entries: Array<{ key: string; value: unknown }>; estimatedBytes: number; truncated: boolean; nextStartAfter: string | null; pageSize: number }
```

exported (not module-private) so the store harness can test both
shapes without a hosted runtime. Its rules, in order:

1. **Bare array** (`Array.isArray(result)`): filter to entries
   whose key is a string starting with `options.prefix`, then
   sort by key. The mock's own order is unverified, so the sort
   is defensive — the contract promises key order and callers
   (notably the alphabetical Apps list) depend on it. Entries
   without a string key are skipped, not fatal: one malformed
   entry must not take down enumeration of the rest.
2. **Documented envelope** (a non-array object whose `entries`
   is an array): return it untouched — no re-filtering, no
   re-sorting, no recomputed `estimatedBytes`. Hosted behavior
   is preserved exactly when the hosted handle returns the
   envelope.
3. **Anything else** (`null`, `undefined`, a non-object, an
   object with no `entries` array): reject with an `Error`
   naming the shape (e.g. `store list() returned an
   unrecognized shape`), never return an empty list. This is
   the same fail-loudly stance as the no-`list()` rule in the
   canonical spec.

Pagination on the bare-array path (Decision 3) is derived
client-side from the filtered, sorted set.

### Decision 3: pagination derivation mirrors `createMemoryStore()`

For the bare-array path, the effective page size is
`options.pageSize ?? 250`, floored at 1 and capped at 1000 —
the same rule as `createMemoryStore()` (`storage.ts:51-53`).
`startAfter` selects the first filtered key strictly greater
than it; when no key is greater, the page is empty. The returned
page is the slice from that start. Then:

- `estimatedBytes` is computed over the returned page only, with
  the same formula as `createMemoryStore()` (`storage.ts:70-73`):
  the sum of `key.length` plus the value length (string values
  counted directly; a non-string value counted by its
  `JSON.stringify` length; a missing value counting 0).
- `truncated` is true exactly when unreturned filtered keys
  remain (`start + page.length < filtered.length`).
- `nextStartAfter` is the last returned key when truncated,
  else `null`.
- `pageSize` is the effective size.

`listInstalledIds` (`registry.ts:345-349`) already follows
`truncated` / `nextStartAfter` to completion, so a multi-page
bare-array result enumerates fully with no change there. The
live mock's numbers shape the harness case: 55 namespace entries,
13 of them under `kody-os.apps.def.` — with `pageSize: 2` that is
7 pages of def entries, ids alphabetical.

### Decision 4: what the adapter never does

No re-fetch, no caching, no mutation of the handle, no writing.
The adapter is a pure shape translation on the read path. In
particular it does not re-read keys with `get()` to fill in a
missing value: the bare array already carries the values, and
the envelope contract carries them too.

### Decision 5: version call — folds into the pending 4.2.0 MINOR

No version change of its own. The package is at 4.2.0 / build 46
(`pkg/package.json`, uncommitted on branch `close-v4-tail`, never
published). This change fixes a regression introduced by the
uncommitted list-prefix change (`install-registry-race`), which
is itself part of that pending 4.2.0 MINOR: deriving the installed
list from `list()` is what exposed the mock's bare-array shape.

Against the repo version policy (`AGENTS.md`, Version policy):
a PATCH is a bug fix restoring documented behavior — which this
is — but there is no released 4.2.0 to patch. Bumping to 4.2.1
would spend a version number on a regression no release ever
contained. The highest bump any part of the pending work
triggers is already the 4.2.0 MINOR, so this fix ships inside
4.2.0; `build` still increments by exactly 1 on publish. No
`catalogVersion` bump: no catalog app changes.

## Open questions

- **Hosted `list()` shape**: never verified live from this
  environment; no live hosted probe exists here. Unknowable, and
  the design makes it unnecessary to know: the envelope path is
  a pure pass-through, so hosted behavior is untouched if the
  hosted handle returns the envelope, and tolerated if it
  returns the bare array. A task records a hosted check if a
  live way to run one ever appears (tasks.md, task 6).
- **Mock array order**: unverified; the design sorts defensively
  rather than depending on it.
- **Whether the mock handle also ignores `pageSize` /
  `startAfter`**: the observed return was the full 55-entry
  array with no paging fields. The adapter applies pagination
  client-side regardless, so the answer does not change the
  design.
- **Probe's `snapshot-less` status**: probe derives
  `snapshot-less` despite a snapshot row on disk. Unrelated to
  this change and unexplained; flagged in the
  `store-row-layout` spec, not theorized here.
