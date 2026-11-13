# Tasks

No task in this file commits, pushes, publishes, tags, or
releases anything. Regenerating `catalog/catalog.json` is a
file write in the working tree, not a release; pushing it
and moving tag `4.2` are release acts needing their own
explicit direction naming the tag and the remote
(repository rule). The shell version bump rides in the
same commit as the change it describes — that commit
itself still needs direction before it happens.

## 1. Spec — manifest-driven Store rows

- [x] 1.1 Write this change: proposal (the drift and the
  fetch count), design (manifest fields, manifest-only
  listing, display-only capabilities, old-shell
  compatibility, PATCH call), tasks, and the spec delta
  for `app-registry` amending "Shipped catalog" and
  "Catalog index". No other spec delta: no MCP shape
  changes, no new capability, no shell-surface change.
  Done (2026-11-12 late evening): written, reviewed by
  the user ("Implement"), then corrected twice during
  implementation — `CatalogSummary` gains the additive
  `capabilities` field (the spec first claimed the shape
  was unchanged), and the "manifest missing a display
  field" scenario was corrected to the real fallback
  (cached manifest when one exists; otherwise the rows
  call rejects and the Store page shows its error state
  with Retry — verified against `readCatalogManifest`
  and the dispatch layer).

## 2. Generator — copy display fields into the index

- [x] 2.1 Extend `scripts/build-catalog-index.ts`:
  `IndexEntry` gains `name`, `icon`, `category`,
  `description`, `schemaVersion` (required),
  `minPackageVersion` (optional, omitted when the
  definition carries none), and `capabilities` (the
  `summarizeCapabilities` shape, computed with the
  existing `summarizeCapabilities` from
  `pkg/src/apps/definition.ts`). Regenerate
  `catalog/catalog.json` with
  `bun scripts/build-catalog-index.ts` (never hand-edit
  it). Verify: the regenerated index parses, every entry
  carries the new fields, no app's `catalogVersion` or
  fingerprint changed, and the file measures 17.7 KB
  (well under the 64 KiB manifest cap). No definition
  file changes in this task.
  Done (2026-11-12): index regenerated, 19 apps,
  17,729 bytes; fingerprints / catalogVersions / labels
  / installModes / bundleFiles all unchanged vs HEAD;
  capabilities summaries verified (app-store, news,
  xkcd, hoodie-weather, settings only). The generator
  fails loudly when a definition lacks a required
  display field. Note: the index in the tree also
  carries the alembic v4 entry (catalogVersion 4) from
  the concurrent alembic v4 work in another chat — that
  work is NOT part of this change (see close-out).

## 3. Fetch layer — listing reads the manifest only

- [x] 3.1 Extend `ManifestEntry` in
  `pkg/src/apps/remote-catalog.ts` with the new fields
  and extend `validateManifestEntry` to validate them
  (strings for name/icon/category/description, number
  for schemaVersion, valid version string for
  `minPackageVersion` when present, capabilities shape
  with host arrays). Keep ignoring unknown fields so a
  future enrichment does not break this shell.
  Done (2026-11-12). `validateCapabilitiesSummary`
  added; `minPackageVersion` validated with the existing
  `parsePackageVersion`.
- [x] 3.2 Rewrite `list_catalog` to build each
  `CatalogSummary` from its manifest entry with no
  `fetchDefinitionJson` call. `CatalogSummary` gains
  one additive field, `capabilities` (the manifest
  entry's capabilities summary). `fetchDefinitionJson`,
  `get_catalog_definition_meta`, and
  `get_catalog_definition` stay as-is for single-app and
  install paths.
  Done (2026-11-12). Also updated the module header
  comment (listing is manifest-only now) and the
  `get_catalog_definition_meta` doc (single-app/agent
  reads, no longer row display).
- [x] 3.3 Verify: `bun tests/catalog-harness.ts` passes,
  and a counted run of `list_catalog` against the mock
  (or a stubbed fetch) shows 1 manifest fetch and 0
  definition fetches. ES2019 only.
  Done (2026-11-12): catalog harness ALL PASSED, and
  the new counted check in the harness passes
  (manifest=1, definitions=0). Typecheck clean
  (`bun x --package typescript@5.9.3 tsc --noEmit`;
  note `bun run typecheck` fails in this environment
  because `bunx` is not installed — use `bun x`).

## 4. Registry — rows and self-update from the summary

- [x] 4.1 In `buildStoreRows`
  (`pkg/src/apps/registry.ts`), drop the per-row
  `get_catalog_definition_meta` call. Read
  `minPackageVersion`, `schemaVersion`, and
  `capabilities` from the `CatalogSummary` already
  passed in. Keep the installed-definition precedence
  for label / name / icon / category / description.
  The `capabilities` summary is used as-is (it is
  already summarized at generation time); do not
  re-summarize from a fetched definition.
  Done (2026-11-12). The `installMode` fallback to the
  fetched definition is gone too (the summary always
  carries it); `get_catalog_definition_meta` removed
  from the registry import.
- [x] 4.2 In `getStoreSelfUpdate`, replace the
  `get_catalog_definition_meta('app-store', discovery)`
  call with a read of the App Store entry from the
  discovery manifest (`readCatalogManifest` +
  entry lookup, or the manifest-derived summary):
  `catalogVersion` and `minPackageVersion` both come
  from the entry. The self-update error, gating, and
  `hasUpdate` logic are unchanged.
  Done (2026-11-12): `readCatalogManifest` + entry
  lookup, same error message on failure.
- [x] 4.3 Verify: typecheck clean; `bun
  tests/catalog-harness.ts` and `bun
  tests/store-harness.ts` pass; a counted Store rows
  load shows 2 outbound fetches (listing manifest +
  discovery manifest) and 0 definition fetches.
  Record the agent-tools harness's 1 pre-existing
  failure (stale 16-app count, verified identical on
  clean `main`) as pre-existing, not fixed here.
  A `kody dev` check that could not run in this
  environment is recorded as substituted — by which
  harness, and why — not marked done.
  Done (2026-11-12): typecheck clean; catalog + store
  harnesses ALL PASSED; app-store bundle tests ALL
  PASSED; counted `manage_rows` via throwaway script
  `/tmp/count-rows-fetch.ts`: ok, 18 rows, latest Store
  catalogVersion 32, 2 manifest fetches, 0 definition,
  0 other. Agent-tools harness: exactly the 1 known
  pre-existing failure ("list_catalog returns 16 apps —
  got 19"). Open-mode harness: 12 failures, verified
  byte-identical to clean `main` at `24f6c3a`
  (pre-existing). `kody dev` check: not run (no `kody`
  CLI in this environment); substituted by the counted
  stub-fetch script plus the store harness's loopback
  catalogs. Store-harness fixtures had to be updated
  for the new manifest shape (see close-out).

## 5. Harness — index checks cover the new fields

- [x] 5.1 Extend `tests/catalog-harness.ts`:
  `IndexEntry` gains the new fields, and the
  "index entries match the definitions" check gains
  name, icon, category, description, schemaVersion,
  minPackageVersion (presence and value), and the
  capabilities summary (compared via
  `summarizeCapabilities` of the assembled
  definition). A stale index fails, as today.
  Done (2026-11-12): check passes on the regenerated
  index.
- [x] 5.2 Verify the failure mode on purpose: delete
  one new field from a scratch copy of the index and
  confirm the harness fails and the Store falls back
  to installed apps plus a catalog error (do not
  commit the broken copy).
  Done (2026-11-12): deleting `capabilities` from the
  alembic entry makes the harness FAIL
  ("alembic:capabilities"); the broken copy was
  restored, not committed. The Store-fallback half was
  verified by code read, not a live run: a manifest
  failing validation falls back to a cached manifest
  when one exists (`readCatalogManifest`), otherwise
  the rows call rejects and the Store page shows its
  error state with Retry (dispatch has no catch around
  `manage_rows`; the bundle's Retry control is the
  retry). No live `kody dev` run was possible here.

## 6. Version and docs

- [x] 6.1 PATCH bump: shell 4.2.1 → 4.2.2, build 48 →
  49, in `pkg/package.json` plus the `pkg/AGENTS.md`
  and `pkg/README.md` headers, in the same commit as
  the change. No app `catalogVersion` moves.
  Done (2026-11-12): `pkg/package.json` (4.2.2/49) and
  `pkg/AGENTS.md` header (v4.2.2). `pkg/README.md`
  states no version anywhere, so there was no header
  to update there. No app `catalogVersion` moved for
  this change (alembic v4 in the tree is the other
  chat's work).
- [x] 6.2 Update `catalog/README.md` line 56 (the
  enumerated index-entry fields) to list the new
  fields. No other doc change: no pin move, no tag
  procedure change.
  Done (2026-11-12).
- [x] 6.3 Close-out note: record what was actually
  verified, what was substituted, and what was left
  open. Then archive the change to
  `openspec/changes/archive/<YYYY-MM-DD>-manifest-driven-store-rows/`
  when done.
  Done (2026-11-12): close-out below; archived to
  `openspec/changes/archive/2026-11-12-manifest-driven-store-rows/`.

## Close-out (2026-11-12, late evening)

What was verified:
- Typecheck clean (`bun x --package typescript@5.9.3
  tsc --noEmit`, exit 0) before and after the change.
- Catalog harness ALL PASSED (19 apps), including the
  new index-field checks and the counted `list_catalog`
  check (1 manifest fetch, 0 definition fetches).
- Store harness ALL PASSED after its fixtures were
  updated for the new manifest shape: `buildCatalogCopy`
  and `p1RebuildIndex` now emit the display fields
  (via `summarizeCapabilities`), the below-floor
  fixture edits the manifest entry's `schemaVersion`
  as well as the definition's, and the "running package
  version" expectation moved to 4.2.2. The store
  harness failure that surfaced this was verified
  NOT pre-existing (base `24f6c3a` in a clean worktree
  passes it).
- App-store bundle tests ALL PASSED.
- Counted `manage_rows` (throwaway
  `/tmp/count-rows-fetch.ts`, stub fetch over two
  bases): ok, 18 rows, latest Store catalogVersion 32,
  2 manifest fetches, 0 definition fetches, 0 other.
- Agent-tools harness: 1 pre-existing failure (stale
  16-app count). Open-mode harness: 12 failures,
  identical on clean base. Neither was fixed here.
- Canonical specs synced: `openspec/specs/app-registry/spec.md`
  ("Shipped catalog" + "Catalog index") carries the
  amendments and the new scenarios.

What was substituted:
- `kody dev` (mock) verification: no `kody` CLI in
  this environment, so the counted stub-fetch script
  plus the store harness's loopback catalogs stand in
  for it. No live-Scribe check (none needed: no
  Scribe-specific behavior changed).
- `bun run typecheck` does not work here (`bunx`
  missing); `bun x` was used instead.

What was left open:
- Commit / push / tag move / Kody publish: the user
  directed "commit, push and publish", but the working
  tree also holds the concurrent alembic v4 work from
  another chat (definition + bundle + tests, uncommitted,
  needs its own direction) and `catalog/catalog.json`
  mixes both changes. Committing only this change's
  files is impossible without either dragging the
  alembic v4 index entry in without its definition or
  reverting the index — so the commit was NOT made and
  is waiting on the user's scope decision.
- The tag `4.2` move (needed BEFORE the publish: the
  new shell requires the enriched manifest, which only
  goes live at the tag after the move) needs its own
  explicit direction naming the tag and the remote.
- The publish itself (Kody git lane: `packageGetGitRemote`
  → sync `pkg/` → `packagePublishExternalPush` →
  verify `published_commit`) waits on the tag move.
