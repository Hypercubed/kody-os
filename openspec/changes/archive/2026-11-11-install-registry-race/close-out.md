# Close-out: install-registry-race (list-prefix fix)

Closed 2026-11-11. Implemented on branch `close-v4-tail`, uncommitted.
Spec-only change became code + harness + canonical-spec sync; the
change directory was archived here per the repo's archive precedent
(`openspec/changes/archive/<date>-<slug>/`).

## What was implemented

- `pkg/src/apps/storage.ts`: `KeyStore.list()` (prefix filter, key
  order, pagination, pageSize default 250 / cap 1000 / floor 1,
  `estimatedBytes`, `truncated` / `nextStartAfter`); `REGISTRY_KEY`,
  `readRegistry`, `writeRegistry` deleted. `resolveStore()` passes the
  hosted handle's `list()` through and never falls back to the shared
  memory store when `list()` is absent.
- `pkg/src/apps/registry.ts`: new exported `listInstalledIds(store,
  pageSize?)` (paginates `list({ prefix: 'kody-os.apps.def.' })` to
  completion, throws when the store has no `list()`); `DEF_PREFIX`
  const; `pruneRetiredApps(ids, store)` is now a pure filter over
  derived ids; `list_apps`, `get_launcher_state`, `get_store_rows`,
  `export_install`, `import_install`, and backup-restore reset
  enumerate via `listInstalledIds`; `add_app` writes only the
  definition + state keys; `remove_app` decides "unknown app" from
  the definition key. No `readRegistry` / `writeRegistry` /
  `REGISTRY_KEY` reference remains in `pkg/src`, `tests`, `catalog`,
  or `scripts`.
- `pkg/src/apps/index.ts`: `listInstalledIds` re-exported.
- `pkg/src/apps/types.ts`: one prose line ("Adding an app is a
  registry write" -> writes its definition and state keys).
- `tests/store-harness.ts`: 15 new checks (list pagination + prefix
  filtering, multi-page `listInstalledIds`, orphaned definition
  lists, retired ids filtered at read time with keys deleted,
  concurrent installs both land, stale registry key ignored and
  left untouched); "registry" check labels and header copy updated
  to "installed list".
- `openspec/specs/app-registry/spec.md`: the change's 4 delta
  requirements added after "Storage layout and budget"; Storage
  layout, Pinned/hidden/recency, Homepage order, Same-id overwrite,
  management-API 404, and Empty-registry wording updated (empty =
  no `kody-os.apps.def.*` key).

## Verification (2026-11-11, branch close-v4-tail)

- `bun tests/store-harness.ts`: 145 PASS, 1 FAIL — the FAIL is the
  pre-existing stale hardcoded check expecting package version
  4.1.3 vs actual 4.1.12 (not fixed here, per task scope).
- `bun tests/catalog-harness.ts`: ALL PASSED (18 apps).
- `bun build pkg/src/app.ts --target=browser --external 'kody:*'`:
  succeeds, 247,261 bytes (baseline 245,738).
- `bun run typecheck` from `pkg/`: exit 0, 0 errors (baseline 0;
  the `pkg/AGENTS.md` record of 19 pre-existing errors is stale).

## Substituted, not verified live

- The hosted `packageStorage()` `list()` was not verified from this
  environment: no Kody handle is reachable here. The shape is
  Kody-documented (design.md cites `kody-factory.md#concurrency-
  and-multi-key-updates`, PRs #5029/#5031); the memory store
  implements the same shape, and the store harness covers it.
- The mock store: no mock-store implementation exists in the repo —
  the `kody dev --target mock` store is platform-provided by the
  Kody CLI, not in-repo code. Not verified; task 1.3 is not marked
  done.

## Left open / known notes

- The remaining shared-array race in pinned / hidden / homepage /
  recent is explicitly NOT fixed by this change.
- Downgrade note: old code reading a store written by new code sees
  a stale registry key missing apps installed after the change.
- `listInstalledIds`' optional `pageSize` parameter is a test-only
  extension (lets the harness verify multi-page enumeration).
- Only observable change: the Apps list order is now alphabetical
  by id (install order lost); homepage order is unchanged.
- Version decision recorded for commit time: MINOR (Apps list order
  change), no `catalogVersion` bump.

## What remains

Commit is a separate user decision. No publish step is part of this
change.
