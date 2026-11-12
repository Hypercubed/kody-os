# Close-out: store-row-layout (Store row layout: caret, top-pinning, fixed button width)

Closed 2026-11-11 (superseded-in-part). Implemented on branch
close-v4-tail, uncommitted. Archived per the repo's archive precedent
(openspec/changes/archive/2026-11-11-store-row-layout/). App Store
catalogVersion 21 → 22; package 4.2.0 / build 46.

## What was implemented

- store.css: caret on the agent-text `<details>` summary — native
  marker suppressed (`list-style: none`,
  `summary::-webkit-details-marker { display: none; }`),
  `summary::before` border triangle (0.35em transparent top/bottom
  borders, 0.55em solid currentColor left border, 0.5rem right
  margin), rotating 90° on `[open]`; 48px summary tap target kept.
- store.css: one fixed width for every row action button —
  `calc(12ch + 2rem + 2px)` on `.store-controls button`, longest
  label "Overwriting…" (12 chars).
- catalog/app-store/definition.json: catalogVersion 21 → 22;
  catalog/catalog.json regenerated (only the app-store entry changed).
- The confirm-dialog buttons and "Update All" are unchanged (out of
  scope, per design.md Decision 4); no canonical spec delta (no
  app-store spec exists).

## Section 2 — SUPERSEDED 2026-11-11

Section 2 (pin icon, label, and buttons to the top of the row with
flex-start) was NOT implemented as written. The v24 direct change
(fixed heights `min-height: 4.85rem` + vertically centered content,
`stretch`), made at the user's direction on 2026-11-11, replaced
flex-start with stretch + centered content, so store.css now carries
no flex-start at all. Tasks 2.1–2.3 are recorded as superseded, not
completed; their boxes stay unchecked on purpose. §2's intent is
preserved: row content does not move when the details opens,
because the details element sits on its own flex line
(`flex: 0 0 100%`, store.css:18) below the columns, so opening it
grows the second line, not the first, and the columns do not move.
The change is therefore closed as superseded-in-part per the user's
2026-11-11 decision, not as fully implemented as specified.

## Verification (2026-11-11, branch close-v4-tail, branch-final run)

- bun run typecheck from pkg/: exit 0, 0 errors.
- bun tests/store-harness.ts: 187 PASS, 1 FAIL — the FAIL is the
  pre-existing stale hardcoded check expecting package version 4.1.3
  (not fixed here, per scope).
- bun tests/catalog-harness.ts: ALL PASSED (18 apps).
- bun catalog/tests/app-store-tests.cjs: 120 ok.
- Mock: v22 Store installed and verified in the mock (served page
  contained `summary::before` ×2 and `calc(12ch + 2rem + 2px)` ×1;
  §7.1–7.2 checked). The browser checks 7.3–7.5 (live caret
  direction, no-move on open, equal button widths) were not run —
  no live-browser verification is recorded for this change.

## Deviations and what was left unchecked

- Tasks 2.1–2.3: superseded by v24 (see above); not completed.
- Task 5.1: the caret and fixed-width assertions are in the bundle
  tests and pass; the flex-start alignment assertion is absent —
  the tests assert stretch instead.
- Tasks 7.3–7.5: browser checks not run (see Verification).
