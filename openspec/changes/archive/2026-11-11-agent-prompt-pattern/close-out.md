# Close-out: agent-prompt-pattern

Closed 2026-11-11. Implemented on branch close-v4-tail, uncommitted.
Archived per the repo's archive precedent
(openspec/changes/archive/<date>-<slug>/). App Store catalogVersion
26 to 27; package 4.2.0 / build 46.

## What was implemented

- pkg/OPERATIONS.md (new file, 58 lines, 10 sections): how to read,
  shared invariants, standalone path, Install, Update, Absorb,
  Overwrite, Restore, Remove, Add a new app. The Absorb steps moved
  here verbatim from the old prompt text; the standalone path states
  the explicit-catalogBase rule, the public base, and the pinned-tag
  form. 'Add a new app' is only the pointer to
  .agents/skills/adding-an-app/SKILL.md (package-relative path);
  adding-an-app itself is untouched.
- pkg/src/apps/remote-catalog.ts: the GitHub-raw parsing extracted
  from recipeUrlForBase into a shared helper; folderUrlForBase(base,
  id) added; recipeUrlForBase keeps its exact behavior and stays
  exported.
- pkg/src/apps/registry.ts: StoreRow.recipeUrl renamed to folderUrl
  (doc comment rewritten); set in buildStoreRows as folderUrl:
  catalogEntry ? folderUrlForBase(catalogBase, catalogEntry.id) :
  undefined. The manage API shape is unchanged apart from the
  rename (no new field).
- catalog/app-store/store.js: storeAgentPrompt(row) rewritten to the
  one-liner template — 'Read package:<slug>#OPERATIONS.md, then
  <verb> this app: <folder URL>' — with the slug from
  storePackageSlug() (derived from storeManageBase(), fallback
  'kody-os'); the recipe-only early return removed, so recipe-only
  not-installed rows gain the Install details; the controls span
  ('Ask an agent to install via its recipe.') is unchanged. No label
  or id text remains in any prompt; the Remove prompt no longer uses
  the bare id.
- pkg/src/apps/client.ts: renderEmptyHelp rewritten — the slug is
  derived from appBasePath (leading slash stripped, first segment,
  fallback 'kody-os'); the three gate-hints are the one-liners (Add
  with Name / What-it-does; Remove with [app id]; Install the App
  Catalog with the hardcoded main tree URL for app-store, per spec
  4.1). Intro and closing unchanged; /help still omits the closing
  line and empty Home/Apps keep it.
- Tests: catalog/tests/app-store-tests.cjs updated (header, the
  recipe-app fixture row to folderUrl, one-liner assertions per
  status, recipe-only Install details, no details for a row without
  a folderUrl); tests/store-harness.ts Help checks updated to the
  new one-liner wording.

## Verification (2026-11-11, branch close-v4-tail, branch-final run)

- bun run typecheck from pkg/: exit 0, 0 errors.
- bun tests/store-harness.ts: 187 PASS, 1 FAIL — the FAIL is the
  pre-existing stale hardcoded check expecting package version 4.1.3
  (not fixed here, per scope).
- bun tests/catalog-harness.ts: ALL PASSED (18 apps).
- bun tests/agent-tools-harness.ts: 40 PASS, 1 FAIL — the FAIL is the
  pre-existing 16-apps count (list_catalog returns 16 apps — got 18).
- bun catalog/tests/app-store-tests.cjs: 120 ok.
- Mock: the v27 Store was installed in the mock (dev stopped before
  the mock write, restarted after; the on-disk definition is
  catalogVersion 27 with a matching snapshot). GET /apps/app-store
  serves the new bundle: every row's details is the one-liner with
  the package:kody-os#OPERATIONS.md reference and a folder URL; the
  Counter row (behind-modified) shows the Absorb one-liner. GET
  /help serves the three rewritten prompts (37,734 bytes). The
  Counter row still reads behind-modified and the App Store row
  still reads modified-ahead (local v27 vs GitHub main v20); GET /
  and /apps list the installed apps with no empty state.

## Deviations

- Task 1.2: OPERATIONS.md contains 'kody-os' three times ('# kody-os
  operations' title; 'a kody-os install' in the prose; the public
  GitHub base URL). Those are the product name and the public catalog
  repo URL, not a package:<slug># reference; no hardcoded package
  entity reference exists in the file.
- Task 2.2: two recipeUrl mentions remain in pkg/src — the
  recipeUrlForBase export itself (remote-catalog.ts), deliberately
  kept exported per task 2.1, and its doc comment. The
  StoreRow.recipeUrl field is gone.

## Open follow-ups

- minPackageVersion is NOT set on the v27 Store definition. It must
  land before the catalog is merged to main: without it, a 4.1.11
  shell would offer and perform the v27 Store update, whose prompts
  reference OPERATIONS.md (missing in 4.1.11) and whose bundle
  expects folderUrl rows the 4.1.11 shell does not produce. With it
  set, 4.1.11 shells see needsNewerShell and the server refuses the
  update.
- Kody entity-resolution semantics remain unverified: whether two
  users' packages with the same leaf collide, and whether an
  @owner/leaf entity form is accepted. The design records what
  Kody's search.md says (package:{id}#<path>; {id} is a saved-package
  UUID or a package name leaf, resolved 'for the signed-in user').
  The dynamic-slug implementation stands either way, with the
  kody-os fallback.
- Canonical-spec drift: this change's MODIFIED absorb-prompt
  requirement (one-liners, the OPERATIONS.md reference, folderUrl)
  is recorded in this change's spec delta but has NOT been applied
  to the canonical openspec/specs/app-registry/spec.md — that file
  still describes the pre-pattern prompt form and has no
  OPERATIONS.md or folderUrl mention. A follow-up sync is owed.
