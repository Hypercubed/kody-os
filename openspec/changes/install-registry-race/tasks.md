# Tasks

Fix the install registry race observed on kody-os-demo on 2026-11-08
(Calendar and 3-Bit Art installed but missing from the Apps list:
9 definitions, 7 registry entries) by deriving the installed list
from definition keys instead of maintaining a shared registry list,
following Kody's documented pattern
(`kody-factory.md#concurrency-and-multi-key-updates`, PRs
kody-hq/kody#5029 and #5031). No task in this file commits, pushes,
or publishes anything. No release/publish steps. No verify-on-Scribe
task: there is nothing Scribe-specific to verify here (no rendering,
ceiling, or e-ink behavior changes). No App Store bundle change and
no `catalogVersion` bump in this change.

## 1. `KeyStore.list()`

- [ ] 1.1 In `pkg/src/apps/storage.ts`, add `list(options: {
  prefix, pageSize?, startAfter? })` to the `KeyStore` interface
  with exactly Kody's documented result shape (`{ entries: [{
  key, value }], estimatedBytes, truncated, nextStartAfter,
  pageSize }`, pageSize default 250, cap 1000, keys in key
  order). Verify: the interface matches the documented shape
  field for field.
- [ ] 1.2 Implement `list()` in `createMemoryStore()` (filter the
  map by prefix, key order, paginate with `truncated` /
  `nextStartAfter`) and in the mock store used by `kody dev`.
  Verify: a memory store with keys under two prefixes returns
  only the requested prefix, in key order, across a page
  boundary (`pageSize: 2` over 3 keys returns `truncated: true`
  then the remainder).
- [ ] 1.3 In `resolveStore()`, replace the cast that hides the
  hosted handle's method with the typed `list()`: confirm the
  live `packageStorage()` handle exposes `list()` and that the
  pass-through returns entries in the documented shape. If the
  hosted handle does not expose `list()` in this environment,
  record that as a substitution naming the harness that stands
  in for it — do not mark it done. Verify: a hosted-store
  `list({ prefix: 'kody-os.apps.def.' })` returns the installed
  definitions.
- [ ] 1.4 `listInstalledIds(store)`: a new internal helper in
  `registry.ts` that paginates `list({ prefix:
  'kody-os.apps.def.' })` to completion and returns the id
  suffix of each key, in key order. A store without `list()`
  throws a clear error naming the store instead of returning an
  empty list. Verify: an install with more apps than one page
  enumerates all of them; a store without `list()` fails loudly.

## 2. Derive the installed list

- [ ] 2.1 `list_apps()` enumerates via `listInstalledIds`
  instead of the registry, then reads each definition exactly
  as today (skipping ids with no definition). Order is key
  order (alphabetical by id), not install order. Verify: the
  7-app demo state plus the 2 orphaned definitions lists all 9
  apps; order is alphabetical by id.
- [ ] 2.2 `get_store_rows()` takes its installed ids from
  `listInstalledIds`. `export_install()` enumerates via it.
  `import_install()` filters its restored pinned / hidden /
  homepage lists against it instead of the registry.
  Backup-restore's reset step enumerates via it to delete every
  definition, state, and snapshot before importing. Verify:
  Store rows, export, import, and backup-restore all see the
  same installed set as `list_apps()`.
- [ ] 2.3 `pruneRetiredApps` becomes a pure filter over the
  derived ids: it returns them minus `RETIRED_APP_IDS`
  (`help`, `about`) and deletes the retired definitions and
  state, with no registry read or rewrite. Verify: a store
  containing retired `help` / `about` definitions lists without
  them and their keys are deleted.
- [ ] 2.4 Any empty-install check (empty Apps help, App Store
  seed condition) reads emptiness from the derived list, not
  from the registry key. Verify: a blank store shows the
  empty-install help; a store with one app does not.

## 3. `add_app` and `remove_app` stop touching the registry

- [ ] 3.1 `add_app` drops the registry read and the registry
  write: it reads the existing definition and state (for the
  state-preservation rule), validates, then writes the
  definition key and the state key — and nothing else. The
  state-preservation rule and the Store install snapshot write
  are unchanged. Verify: a single install writes exactly two
  keys (plus the snapshot on a Store install) and appears in
  `list_apps()`; re-adding an existing id preserves state for
  fields still declared.
- [ ] 3.2 `remove_app` decides "unknown app" from the definition
  key instead of the registry, then deletes definition, state,
  and snapshot and scrubs pinned / hidden / recent / homepage
  references. Its docstring drops "registry" from the scrubbed
  lists. Verify: removing an installed app deletes its keys
  and scrubs its references; removing an unknown id returns
  `{ ok: false }` and writes nothing.
- [ ] 3.3 `manage_install`, `manage_update`, `manage_restore`,
  and `manage_remove` need no change beyond 3.1–3.2 and 2.2;
  confirm each reads no registry key. `get_app_status` is
  unchanged (it already defines installed as "the definition
  exists"). Verify: grep shows no `readRegistry` /
  `writeRegistry` / `REGISTRY_KEY` reference remains outside
  `storage.ts`'s deleted helpers — and `readRegistry` /
  `writeRegistry` are deleted from `storage.ts` so no future
  caller can reintroduce the shared list.
- [ ] 3.4 The stale registry key (`kody-os.apps.registry`) is
  left in place, unread and unwritten; no migration step, no
  deletion on a read path. Verify: a store that still carries a
  stale registry key lists correctly from the derived list, and
  the key is untouched afterwards.

## 4. Concurrency and orphans

- [ ] 4.1 Verify the original bug is gone structurally: two
  concurrent installs for different ids, started from the same
  state, both land in `list_apps()` with definitions and state
  intact — with no Store serialization and no re-read/verify
  loop in `add_app`. Verify: the same for an agent install
  racing a Store install.
- [ ] 4.2 Verify orphan self-healing: a store with a definition
  and state but no registry entry (the demo's Calendar state)
  lists the app with no repair step, and the Store row shows it
  installed with its correct update status.
- [ ] 4.3 Verify same-id last-write-wins: two concurrent installs
  of the same id resolve to one definition (the later `set`),
  with no cross-app loss and no orphan. Verify: the clicked
  button's existing busy state still prevents a double-click
  double-install from the Store UI.

## 5. Tests, version, and spec sync

- [ ] 5.1 Add harness coverage: the store harness gains checks
  for `list()` pagination and prefix filtering on the memory
  store, derived enumeration (including an orphaned definition
  and a retired id), concurrent different-id installs, and the
  stale-registry-key case. Verify: `bun tests/store-harness.ts`
  and `bun tests/catalog-harness.ts` pass.
- [ ] 5.2 Run the ES2019 scan clean and `bun build pkg/src/app.ts
  --target=browser --external 'kody:*'` succeeds. Record any
  check that could not run in this environment as substituted,
  naming the substitute and the reason — do not mark it done.
- [ ] 5.3 Sync the canonical specs: the app-registry delta in
  this change becomes canonical (see `specs/`). Record the shell
  package version decision in the implementation commit (no MCP
  export shape change; Apps list order change points at MINOR;
  no `catalogVersion` bump — no catalog definition or bundle
  changes).
- [ ] 5.4 Archive with a close-out note recording what was
  verified, what was substituted, and what was left open
  (including the remaining shared-array race in pinned / hidden
  / homepage / recent, and the downgrade note: old code reading
  a store written by new code sees a stale registry missing
  apps installed after the change).
