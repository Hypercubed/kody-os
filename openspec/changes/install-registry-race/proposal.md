# Install registry race: derive the registry from definition keys

## Why

On 2026-11-08 the user installed several apps from the App Catalog on
`@hypercubed/kody-os-demo` and two of them — Calendar and 3-Bit Art —
did not show up in the Apps list, although neither was hidden. Live
checks confirmed the failure mode:

- `get_app('calendar')` and `get_app('three-bit-art')` both returned a
  definition and state, so both apps were installed in storage.
- `list_apps()` returned only 7 apps; Calendar and 3-Bit Art were
  missing from it. Nine definitions were present, seven registry
  entries.
- The hidden list was empty, and the pinned/homepage lists did not
  contain either id.

The cause is a read-modify-write race on a shared registry list.
`add_app` (`pkg/src/apps/registry.ts`) reads the registry
(`kody-os.apps.registry`), writes the definition and state, then
appends its id to the registry it read and writes the registry back.
Two installs that start from the same registry snapshot each write
back a registry containing only their own id: the last writer wins
and the other app's registry entry is lost, while its definition
and state remain. The Store bundle makes this easy to hit: it
disables only the Add button just clicked, so the other rows' Add
buttons stay live and several installs can run concurrently, each
as its own `GET /manage/install` fetch.

## Revision note (2026-11-09)

This change was first written as hardening: Store serialization plus
a re-read-and-verify loop in `add_app`. It was revised after Kody
answered the platform feedback filed for this bug
(`06e0067c-3f67-4b81-a5f1-68b74ec7549f`, resolved 2026-11-09):
`packageStorage()` offers no multi-key atomic update,
compare-and-swap, or transaction, and Kody's documented pattern is
to store one key (or one SQL row) per record and derive the index
from storage instead of keeping it in a shared value
(`kody-factory.md#concurrency-and-multi-key-updates`, PRs
kody-hq/kody#5029 and #5031). The hardening approach is abandoned
in favor of that pattern: the registry list is deleted as a
concept, not armored. The Store serialization and the
re-read-and-verify loop are both dropped — neither is needed once
no shared value is rewritten.

## What Changes

- **The installed list is derived, not stored.** `list_apps()` and
  every other registry reader enumerate installed apps with
  `list({ prefix: 'kody-os.apps.def.' })` — one key per definition
  — instead of reading `kody-os.apps.registry`. An install writes
  only its own definition and state keys, so concurrent installs
  for different apps cannot overwrite each other: there is no
  shared value left to race on. Orphaned definitions (definition
  present, registry entry missing — the exact state found on the
  demo) become installed automatically, because presence of the
  definition key is what installed means.
- **`KeyStore` gains `list()`.** The store interface
  (`pkg/src/apps/storage.ts`) exposes the paginated prefix list
  that `packageStorage()` already provides, in the shape Kody
  documents (`{ entries: [{ key, value }], estimatedBytes,
  truncated, nextStartAfter, pageSize }`, pageSize default 250,
  cap 1000, keys in key order). The hosted handle is returned
  today cast as a `KeyStore` that hides the method; the memory
  store and the mock store gain a real implementation.
- **`add_app` and `remove_app` stop touching the registry.**
  `add_app` writes definition and state only; `remove_app`
  deletes definition, state, and snapshot and scrubs the pinned /
  hidden / recent / homepage references, and decides "unknown app"
  from the definition key instead of the registry. Export,
  import, Store rows, and backup-restore enumerate installed ids
  from the derived list instead of the registry.
- **Retired apps are filtered at read time.** `pruneRetiredApps`
  becomes a pure filter over the derived list (`help`, `about`)
  instead of a read-modify-write that rewrites the registry; it
  still deletes the retired definitions and state.

## What does not change

- No install gate changes (`minPackageVersion`, schema floor, and
  their errors are unchanged).
- No catalog source model change (the Store still declares its
  base; the shell still holds no catalog source).
- No MCP export is added, removed, renamed, or reshaped.
- No App Store bundle change: the Store keeps its existing
  per-row busy button, and no cross-row serialization is added —
  it is not needed once installs touch only their own keys.
- `get_app_status` is unchanged: it already defines installed as
  "the definition exists", which is exactly the derived-list
  definition.
- The install export/import envelope is unchanged (`kody-os-install/1`:
  an apps array plus pinned/hidden/homepage; it carries no
  registry field), so old exports import into new code and new
  exports import into old code.
- The pinned, hidden, homepage, and recent lists are still shared
  arrays and still carry the same read-modify-write race; this
  change does not fix them, and it does not touch their data.
- No data migration. The per-record definition and state keys
  already exist in every install; absorb ports source only and
  leaves a fork's storage untouched, so a fork that absorbs this
  change reads the data it already has. The stale registry key is
  left in place, unread and unwritten (see design.md, Decision 5).
- No commit, push, or publish in this change.

## Capabilities

- app-registry

## Impact

- Registry (`pkg/src/apps/registry.ts`): `list_apps`,
  `add_app`, `remove_app`, `get_store_rows`, `export_install`,
  `import_install`, `pruneRetiredApps`, and backup-restore all
  stop reading or writing the registry key and enumerate from the
  derived list instead.
- Storage (`pkg/src/apps/storage.ts`): `KeyStore` gains `list()`;
  the memory store (and the mock store) implement it; the hosted
  handle's existing method is typed instead of cast away.
- The Apps list order changes: derived enumeration is in key
  order (alphabetical by id) instead of install order. Homepage
  order is a separate list and is unchanged. See design.md,
  Decision 1.
- No shell package version decision is made here; it is recorded
  at commit time per the version policy. No MCP export shape
  changes, so no MAJOR trigger is expected from this change alone.
- Builds on the catalog move and the remote catalog (the Store
  fetches definitions from its declared base); it does not change
  either.
