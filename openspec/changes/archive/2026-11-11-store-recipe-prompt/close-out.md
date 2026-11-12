# Store recipe prompt rendering — close-out (2026-11-11)

Closed on branch 'next' (HEAD a7943cc) at the user's direction, following the store-row-layout archive pattern. Nothing was committed, pushed, or published by this close-out; the archived change moves with the branch.

## What was done

Section 0 — the 'recipe-or-json' removal — shipped in public v4.1.11 (commit 5283ca6, Nov 7). Verified on this branch: installMode type is 'json' | 'recipe-only' (pkg/src/apps/types.ts:261); no 'recipe-or-json' in the registry validation; daily-feed and generic-feed definitions carry no installMode; catalog.json entries report 'json' for both (all 18 apps report 'json'); the generator run twice is byte-identical (sha e103b6b5bffdc9e0dcdc44293f8e235cce400d25842d441fe860c19b953f9a07); catalog harness ALL PASSED (18 apps). Boxes 0.1, 0.2, 0.3, 0.5 checked. 0.4 is NOT checked: its literal wording is not met (see below).

Section 1 — rows carry installMode — verified and checked (1.1, 1.2, 1.3): StoreRow.installMode exists; the row assembly copies it (registry.ts:1691 catalog rows, :1745 installed rows, default 'json'); the bundle fixture (daily-feed 'recipe-only', app-store-tests.cjs:313) and checks (:378-380) treat a recipe-only row as recipe-only; the bundle treats a missing installMode as 'json' (store.js:297 strict equality — undefined falls through to Add). Note: 1.2's temp-definition live check was not run as a separate procedure; verification is by code reading plus the bundle fixture.

## What was superseded

Section 2 (the span element with class store-recipe-prompt, scoped CSS, Decision-1 prompt text) — superseded by the v27 agent-prompt pattern. Recipe-only rows now get the same one-liner Install prompt as any not-installed row; the span and the recipe-only early return were removed (no occurrence of the class in store.js/store.css). The properties 2.4/2.5 name hold under the pattern (no copy button, 0 Clipboard occurrences in store.js; the Install one-liner appears only on not-installed rows), but the tasks as written are superseded, not done. No live app is 'recipe-only' (all 18 catalog apps are 'json'), so the recipe-only behavior is bundle-test-only, not visible live in the mock.

Section 3 (App Store 13 to 14) — superseded by events; the Store is v28. Section 4 (span-prompt bundle fixtures) — superseded by the pattern's bundle tests; the current app-store tests (138 checks, all pass under node) cover recipe-only rows gaining Install details. Section 6 — superseded: the canonical app-registry spec carries the pattern form, not this change's recipe-prompt form; the two-state 'Recipe install mode' sync has landed (no 'recipe-or-json' in openspec/specs/app-registry/spec.md); the version decision is moot (Store v28).

## What was not done, and why

0.4 — literal wording unmet. 'recipe-or-json' still appears in prose in openspec/changes/generic-rss-feed/design.md:89 and tasks.md:34 (describing this removal and its sequencing with this change) and in the archived 2026-11-06-catalog-restructure record. Live code and data are clean. Left unchecked on purpose.

5.1 — store harness: 1 FAIL, the pre-existing stale 4.1.3 version check ('running package version is 4.1.3 in this tree — 4.2.0'). The task expects all pass. Left unchecked.

5.3 — open-mode harness: 12 FAILED (modal/openAs/placements install failures; first: 'modal-default app renders full-page section — install failed') and tests/owner-check-harness.ts does not exist in the tree. Left unchecked.

5.6 — the branch diff is the whole 4.2.0 batch (v4 tail + Phase 1), not only this change's files. Left unchecked.

## Verification summary (2026-11-11, branch 'next')

- Catalog harness: ALL CATALOG CHECKS PASSED (18 apps, 0 collections), exit 0. Covers 0.5 and 5.2.
- Store harness: 1 check FAILED — only the pre-existing stale 4.1.3 version check.
- Agent-tools harness: exactly 1 FAIL — 'list_catalog returns 16 apps — got 18', the expected pre-existing one. Covers 5.4.
- Open-mode harness: 12 FAILED (see 5.3 above). Owner-check harness: file absent.
- bun build (pkg/src/app.ts, --target=browser, --external 'kody:*'): exit 0, 258.48 KB. Covers 5.5.
- App-store bundle tests under node: 138 checks, ALL PASSED.
- Catalog regenerations byte-identical across runs (see Section 0).

## Open items this close-out surfaces

- generic-rss-feed's design (Decision 7) and tasks (5.2) still describe this change's removal as a prerequisite for its 'Recipe install mode' delta; the canonical spec no longer carries 'recipe-or-json', so that sequencing note is now stale and generic-rss-feed's archive-time reconciliation should note it.
- The open-mode harness failures (12) and the missing owner-check harness are pre-existing tree issues unrelated to this change, recorded here because 5.3 named them.
