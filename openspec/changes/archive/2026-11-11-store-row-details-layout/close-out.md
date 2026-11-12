# Close-out: store-row-details-layout

Closed 2026-11-11. Implemented on branch close-v4-tail, uncommitted.
Archived per the repo's archive precedent
(openspec/changes/archive/<date>-<slug>/). App Store catalogVersion
22 to 23; package 4.2.0 / build 46.

## What was implemented

- catalog/app-store/store.js: the badge creation block moved to
  after the capabilities block, so the body order is description,
  capabilities, badge. The details creation and append moved out of
  .store-body: the details element is appended to li as the last
  child of the row (li.appendChild(details)); the old
  body.appendChild(details) is deleted.
- catalog/app-store/store.css: .store-row padding '0 0.7rem' became
  '0.7rem 0.7rem'; .store-details gained flex: 0 0 100% (display
  block and margin 0.4rem 0 0.2rem 0 kept). The summary (min-height
  48px, caret triangle) and the code block are unchanged.
- catalog/tests/app-store-tests.cjs: DOM checks that the badge sits
  after the capabilities element inside .store-body; the details
  element's parent is li.store-row (not .store-body) and it is the
  last child of the row; the row has top and bottom padding per the
  stylesheet text; the caret rules are still present.

## Verification (2026-11-11, branch close-v4-tail, branch-final run)

- bun run typecheck from pkg/: exit 0, 0 errors.
- bun tests/store-harness.ts: 187 PASS, 1 FAIL — the FAIL is the
  pre-existing stale hardcoded check expecting package version 4.1.3
  (not fixed here, per scope).
- bun tests/catalog-harness.ts: ALL PASSED (18 apps).
- bun catalog/tests/app-store-tests.cjs: 120 ok.
- Mock (by fetch, not a browser look): the Counter row reads
  behind-modified and the App Store row reads modified-ahead (local
  v27 vs GitHub main v20 at branch-final; v23 at this change's time);
  GET / shows no empty state and /apps lists the installed apps.

## Deviations and what was left unchecked

- The spec's button-mapping line numbers were flagged 'verify at
  implementation': the mapping is at store.js:285-300 in the current
  tree (the requirement / recipe-only / Add branches) with the
  details append at store.js:306 — verified present and unchanged in
  behavior. The line numbers cited in the spec are stale (the file
  grew with the absorb one-liners and the pattern rewrite), but the
  mapping itself is verified.
- Tasks 7.1 and 7.2 (browser checks: badge placement and caret on
  the live page; visible padding and full-width details) were not
  run — no live-browser verification is recorded for this change.
- Task 7.4 (served-page byte size and marker counts for v23) was not
  recorded at the time.

## Open follow-ups

None specific to this change. The layout section 2 top-pinning
question is recorded on the store-row-layout change, which is held,
not archived — this change does not depend on it.
