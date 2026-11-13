# Tasks

No task in this file commits, pushes, publishes, tags, or
releases anything. Cutting or moving a tag, moving the
pin, publishing the shell, and updating the live Store
are release acts, not tasks in this change. A tag move
is a force-push of one tag by name and needs its own
explicit direction naming the tag and the remote
(repository rule).

## 1. Spec — dynamic loading URL

- [x] 1.1 Write this change: proposal (the stale static
  text, the `info` action, the fallback), design
  (Decisions 1–5, failure modes), tasks, and spec
  deltas for `app-registry` (the `info` action) and
  `shell` (the loading text). No `authoring` delta:
  the catalog rules for the Store definition are
  unchanged.

## 2. Shell — `info` management action

- [x] 2.1 Add `manage_info` in `pkg/src/apps/registry.ts`:
  resolve the Store's bases (`resolveManagedBases`),
  return `{ ok: true, listingUrl, discoveryUrl,
  discoveryRef, pinnedLabel }` with the display URLs
  per design Decision 1 (GitHub tree form via
  `folderUrlForBase`, no trailing slash; nulls when
  no catalog source is declared). No upstream fetch.
  Add the `info` branch to the `/manage/` route in
  `pkg/src/app.ts` under the same permission rule as
  `rows` (undeclared caller gets the plain 404).
  Display-URL helper `catalogDirUrl` lives in
  `pkg/src/apps/remote-catalog.ts` (exported via
  `pkg/src/apps/index.ts`); it strips trailing
  slashes because `folderUrlForBase(base, '')`
  double-slashes a base that already ends in `/`.
- [x] 2.2 Bump the shell version per the version policy
  (new feature, nothing breaks — MINOR):
  `pkg/package.json` `4.2.1` → `4.3.0`, build `48` →
  `49`, in the same commit as the change. Update the
  `pkg/AGENTS.md` header to the new version in the
  same commit. (`pkg/README.md` carries no version
  string — verified 2026-11-12 — so there is nothing
  to update there.) Also updated the
  `capabilities.manageApps` line in `pkg/AGENTS.md`
  to list the `info` action.

## 3. Store bundle — dynamic loading text

- [x] 3.1 Change `catalog/app-store/index.html`: the
  static `.store-status` text becomes "Loading
  apps…" with no URL. Change `catalog/app-store/store.js`:
  `load()` fetches `info` first, then `rows`; on
  `info` success the loading text reads
  "Loading apps from \<listingUrl\>…" while rows
  load; on `info` failure it falls back to today's
  behavior (generic text, corrected from row
  folder URLs after the first load). Remove the seed
  scrape (the regex over `.store-status`). The
  self-update section's "Catalog source:" link uses
  the same URL as before.
- [x] 3.2 Bump the Store definition:
  `catalog/app-store/definition.json`
  `catalogVersion` `30` → `31` (one +1 for the
  definition change). `minPackageVersion` stays
  `4.2.0` (the fallback in design Decision 2 needs
  no gate). Regenerate `catalog/catalog.json` with
  `bun scripts/build-catalog-index.ts` (never
  hand-edit it).

## 4. Verify

- [x] 4.1 Run typecheck, the catalog harness, the
  store harness, and the app-store bundle tests from
  the repository root and record the results. The
  store harness gains checks for the `info` action
  (both URLs match the declared bases; nulls when no
  catalog source is declared; undeclared caller gets
  the plain 404). The app-store tests gain checks
  for the loading text (real URL from `info` while
  rows load; generic text and folder-URL correction
  when `info` fails; static text carries no URL).
  Do not mark a step done if it was not run. Note
  (2026-11-12): `bunx` is missing in this
  environment — typecheck runs via `bun x --package
  typescript@5.9.3 tsc --noEmit` (recorded
  substitution).
  Results (2026-11-12, late evening): typecheck
  clean, exit 0 (baseline before the change was
  also clean — no new errors). Catalog harness ALL
  PASSED (19 apps). Store harness ALL PASSED
  (including the 5 new `manage_info` checks and
  the v31 updates). App-store tests ALL PASSED
  (including the new loading-text and fallback
  checks). Alembic tests (separate change, same
  tree): 45 passed, 0 failed. Agent-tools harness:
  1 pre-existing failure ("list_catalog returns 16
  apps — got 19", a stale count) — verified
  identical on a clean checkout of `cace3b51`,
  so it is not caused by this change.
  Schema-migration harness could not run: it reads
  `/tmp/kody-live-defs.json`, which does not exist
  (`/tmp` was wiped); unrelated to this change.
  Open-mode harness not run: no open-mode code was
  touched, and its 12 failures are pre-existing per
  the November 12 verification.
  Substitutions: jsdom was reinstalled durably at
  `~/workspace/.scratch/jsdom-test` (`/tmp` was
  wiped) and the bundle tests run with `NODE_PATH`
  pointing there. The store harness's local server
  is closed at line 763, so the no-source
  `manage_info` check uses a minimal inline
  definition (not a fetched one) in the split-base
  section, where `KODY_CATALOG_BASE` is deleted —
  the dev override would otherwise mask the nulls.

## 5. Close-out

- [x] 5.1 Add a close-out note to this file recording
  what was verified, what was substituted, and what
  was left open. This change is done when the note is
  written; the shell publish and the live Store
  self-update to v31 are the user's call afterwards
  and are not part of this change.

## Close-out (2026-11-12, late evening)

Implemented and verified as recorded under 4.1. The
change is done in the working tree; it is not yet
committed, pushed, published, or tagged — those are
release acts needing the user's direction. What was
verified: typecheck clean; catalog, store, and
app-store harnesses all pass; alembic tests pass
(45/0, god set removed). What was substituted:
`bun x` for missing `bunx`; durable jsdom at
`~/workspace/.scratch/jsdom-test` for wiped
`/tmp/jsdom-test`; the no-source `manage_info`
check uses a minimal inline definition (see 4.1).
What was left open: the shell publish (4.3.0 build
49) and the live Store self-update to v31 are the
user's call; the tag `4.2` move (to include alembic
v2 and Store v31 in the listing) needs its own
explicit direction naming the tag and the remote;
the agent-tools harness's stale 16-app count is a
pre-existing failure, not fixed here; the
catalog-tags-semver-line spec change is still
uncommitted and its README procedure rewrite is
still pending (separate change).

## Revert (2026-11-12, same evening — this change was reverted)

Pushed to main as `ef6d1f2` (parent `00767d5`) the same
evening, then reverted at the user's direction ("OK.
Drop it. Update the loading text to be generic.").
Reason, in his words: the shell should not care about
the app catalog — the Store's definition knows where
it reads the catalog data from, so there is no reason
for the Store to ask the shell for its own bases.
The `info` action had the shell resolving the Store's
own catalog URLs and handing them back, which cost a
shell MINOR bump (4.3.0) for a Store display string.
The loading text is now generic ("Loading apps…"
until rows arrive; the real URL comes from the row
folder URLs once rows load). The revert removes
`manage_info` and `catalogDirUrl`, restores the shell
to 4.2.1 build 48, and takes the Store to v32 (the
bundle no longer fetches `info`). Shell 4.3.0 build 49
was pushed to GitHub but never published to Kody, so
the 4.3.0/49 pair was never live and is free to reuse;
the repo now matches the live shell (4.2.1 build 48)
exactly. The hardcoded-text alternative (update the
static loading text when the pin changes) was
discussed and not taken: the text would duplicate the
pin, and updating it on every catalog change would
re-couple app adds to Store updates. This spec is
archived as the record of what was tried and why it
was reverted; do not rewrite it to make the past look
cleaner.
