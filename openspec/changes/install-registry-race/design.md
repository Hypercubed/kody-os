# Design: Install registry race

## Context

The install path is `manage_install` (browser Store, `GET
/manage/install`) → `store_install_from_catalog` → `installFromCatalogBase`
→ `add_app`, and `install_from_catalog` (agent) → the same
`installFromCatalogBase` → `add_app`. `add_app`
(`pkg/src/apps/registry.ts`) does, in order:

1. Read the definition, the existing state, and the registry
   (`Promise.all` at the start).
2. Write the definition key, then the state key.
3. If the id was not in the registry read in step 1, append it and
   write the registry key (`kody-os.apps.registry`).

The store is a `KeyStore` (`pkg/src/apps/storage.ts`): `get` / `set` /
`delete` per key — no list, no transaction, no compare-and-swap.
`list_apps()` reads the registry and then the definition per id
(skipping ids with no definition); `get_app_status()` reads the
definition directly to decide `installed`; `remove_app()` reads
the registry to decide whether the id is known. Those disagree
about an id whose definition exists but whose registry entry is
missing — the exact orphan state observed on 2026-11-08 (9
definitions, 7 registry entries on kody-os-demo).

Kody's answer to the platform feedback for this bug
(`06e0067c-3f67-4b81-a5f1-68b74ec7549f`, resolved 2026-11-09,
docs-only PRs kody-hq/kody#5029 and #5031) is that
`packageStorage()` offers no multi-key atomicity, CAS, or
transaction, and the fix needs no extra API: store one key per
record and derive the index from storage. `packageStorage()`
already exposes two operations the shell does not use: a paginated
prefix list — `list({ prefix, pageSize, startAfter })` resolving
to `{ entries: [{ key, value }], estimatedBytes, truncated,
nextStartAfter, pageSize }`, pageSize default 250, cap 1000, keys
in key order — and `sql(...)` for a SQL table with an idempotent
upsert. This change adopts the list pattern; the SQL pattern is
not adopted (see Alternatives).

## Decisions

### Decision 1 — The installed list is derived from definition keys

A new internal helper, `listInstalledIds(store)`, enumerates
installed ids by paginating `list({ prefix: 'kody-os.apps.def.'
})` and returning the id suffix of each key, in key order —
alphabetical by id. Every current registry reader uses it:

- `list_apps()` enumerates via the helper instead of
  `pruneRetiredApps`'s registry read, then reads each definition
  exactly as today (skipping ids with no definition).
- `get_store_rows()` takes its installed ids from the helper.
- `export_install()` enumerates via the helper.
- `import_install()` filters its restored pinned / hidden /
  homepage lists against the helper's ids instead of the
  registry's.
- Backup-restore's reset step enumerates via the helper to
  delete every definition, state, and snapshot before importing.

Consequences, all intended:

- **No shared value is rewritten on install**, so the race is
  gone structurally, not narrowed. Two concurrent installs for
  different ids touch disjoint keys. Two concurrent writers for
  the same id resolve to the last `set` for that one key, which
  is Kody's documented semantics for a single key.
- **Orphans self-heal.** A definition whose registry entry was
  lost appears in `list_apps()` the moment the new code runs,
  with no repair step and no agent.
- **Order changes.** The Apps list is alphabetical by id instead
  of install order. This matches the Store's catalog-only list,
  which is already alphabetical by id, and the Apps Edit order
  is governed by the homepage list, which is unchanged. No
  install-order information is preserved anywhere after this
  change; nothing in the shell reads install order except the
  registry itself.
- **Pagination is real.** The helper pages with `truncated` /
  `nextStartAfter` until the list is complete; it never assumes
  one page holds every app. Each listed entry counts as one row
  read, per Kody's metering.

### Decision 2 — `KeyStore` gains `list()`

`KeyStore` (`pkg/src/apps/storage.ts`) gains:

```ts
list(options: { prefix: string; pageSize?: number; startAfter?: string }): Promise<{
  entries: Array<{ key: string; value: unknown }>
  estimatedBytes: number
  truncated: boolean
  nextStartAfter: string | null
  pageSize: number
}>
```

The shape mirrors Kody's documented `list()` result exactly, so
the hosted implementation is a pass-through: `resolveStore`
returns the raw `packageStorage()` handle today cast as a
`KeyStore` that hides the method; after this change the cast is
replaced by the typed method. `createMemoryStore()` implements
`list()` over its map (keys filtered by prefix, in key order,
paged the same way); the mock store used by `kody dev` gets the
same implementation. A store without `list()` is a programming
error, not a fallback case: `listInstalledIds` throws a clear
error naming the store instead of silently returning an empty
list (an empty list would look like an empty install and could
trigger the empty-install help or an App Store seed).

`sql()` is NOT added to `KeyStore`. Only the list pattern is
adopted; adding the SQL surface would widen the store contract
for no use in this change.

### Decision 3 — `add_app` and `remove_app` write per-id keys only

`add_app` drops the registry read and the registry write
entirely. It reads the existing definition and state (for the
state-preservation rule and the `isNew` distinction, which no
longer gates a registry write), validates, then writes the
definition key and the state key — and nothing else. The
state-preservation rule is unchanged, and the snapshot write for
a Store install is unchanged (a snapshot is a per-id key,
`kody-os.apps.snapshot.<id>`).

`remove_app` decides "unknown app" from the definition key
instead of the registry, then deletes definition, state, and
snapshot and scrubs the pinned / hidden / recent / homepage
references, exactly as today minus the registry. Its docstring
drops "registry" from the scrubbed-lists list.

`manage_install`, `manage_update`, `manage_restore`, and
`manage_remove` need no change beyond what `add_app` /
`remove_app` / `get_store_rows` already do: they never read the
registry directly. `get_app_status` needs no change at all: it
already defines installed as "the definition exists".

### Decision 4 — Retired apps are filtered at read time

`pruneRetiredApps` becomes a pure filter: given the derived ids,
it returns them minus `RETIRED_APP_IDS` (`help`, `about`) and
deletes the retired definitions and state, exactly as today —
but it no longer reads or rewrites the registry. `get_app`'s
existing refusal of retired ids ("unknown app") is unchanged.

### Decision 5 — The stale registry key is left in place

After this change nothing reads or writes
`kody-os.apps.registry`. It is left in storage as a dead key:
deleting it would need a write on a read path (or a one-time
migration step) for bytes that are negligible, and leaving it
preserves the downgrade story — old code reading a store written
by new code sees a stale registry that is missing apps installed
after the change, which is the same staleness the bug produced
and is honest about what a downgrade is. A future cleanup change
may delete the key; this change does not. `readRegistry` /
`writeRegistry` are deleted from `storage.ts` (not left as dead
helpers) so no future caller can quietly reintroduce the shared
list.

### Decision 6 — No Store serialization

The earlier revision's Store-wide button disabling is dropped,
not kept as defense in depth. It existed to stop two installs
from starting from the same registry snapshot; with no registry
there is no snapshot to share, and the only remaining same-id
race resolves to last-write-wins on that id's own keys — the
documented semantics. The clicked button's existing busy state
(`storeBusyButton`: "Adding…", etc.) stays, and Update All's
existing sequential stepping stays. The App Store bundle does
not change at all in this change, so its `catalogVersion` does
not bump.

## Version decision

Deferred to publish per the version policy. No MCP export is
added, removed, renamed, or reshaped, and no install gate
changes, so no MAJOR trigger is expected from this change alone.
The Apps list order change (install order to alphabetical by id)
is an observable behavior change, which points at MINOR rather
than PATCH; the decision is recorded at commit time. No
`catalogVersion` bump: no catalog definition or bundle changes.

## Alternatives considered

- **SQL table with idempotent upsert (Kody Pattern 2).**
  Rejected for this change: it would replace the key-value
  definition/state storage with a table, a larger redesign of
  every reader, for no additional correctness over the list
  pattern at this scale (tens of apps, pageSize 1000 covers the
  whole install in one page). The list pattern keeps the existing
  per-record keys and only changes how they are enumerated.
- **Hardening the registry write (the earlier revision).**
  Rejected after Kody's answer: re-read-and-verify narrows the
  race window but cannot close it without a platform primitive
  Kody says it does not offer, and it leaves the orphan state
  possible. Deriving the list removes the shared value instead.
- **Single-key registry blob.** Storing the whole install
  (definitions + states) in one key would make an install one
  atomic `set`, but every install would rewrite every app and
  every concurrent install would lose the other's app entirely
  — the same race, larger blast radius. Rejected.
- **Keep the registry as a cache, rebuilt from the list.**
  Rejected: a cached copy reintroduces a second source of truth
  that can disagree with the derived list, which is exactly the
  bug. The derived list is the only source.
- **Registry first, definition second.** Rejected in the earlier
  revision and still rejected: it changes the abort failure mode
  but does not fix the concurrent-write race.
