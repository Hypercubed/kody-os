# Store row details layout - tasks

No task in this file commits, pushes, or publishes anything. No release/publish steps. No verify-on-Scribe task: the CSS used here (flex-basis, flex-wrap, padding) all predate the Chromium 80 ceiling, and the rendering proof is the mock visual check (section 7), which runs in the same Chromium the Scribe uses. No App Store seed is required beyond the mock steps in section 7.

## 1. Badge below description and capabilities (store.js only)

- [x] 1.1 In render() (store.js:221-227), move the badge creation block to after the capabilities block (store.js:236-242), so the body order becomes description, capabilities, badge.
- [x] 1.2 Confirm: the badge rule is unchanged (shown only when the badge text is not Installed, Not installed, or Up to date); badge CSS (store.css:9) unchanged; rows without a badge render exactly as before.

## 2. Row padding top and bottom (store.css only)

- [x] 2.1 .store-row (store.css:3): padding '0 0.7rem' becomes '0.7rem 0.7rem'.
- [x] 2.2 Confirm: min-height 6.5rem, border, margins, flex-wrap, and align-items unchanged; no other rule gains padding.

## 3. Details spans the full row width under the controls (store.js + store.css)

- [x] 3.1 In render(), move the details creation and append out of .store-body: build the details element as today (store.js:244-251) but append it to li after .store-controls (li.appendChild(details) as the last child of the row). Delete the body.appendChild(details) at store.js:252.
- [x] 3.2 .store-details (store.css:18): add flex 0 0 100%; keep display block and margin 0.4rem 0 0.2rem 0.
- [x] 3.3 Confirm: the summary (min-height 48px, caret triangle, store.css:19-22) and the code block (store.css:23) are unchanged; the storeAgentPrompt summaries and prompt text are unchanged; no other store.js function is touched (storeAgentPrompt, the button mapping, and the confirm dialog are untouched).
## 4. Versioning

- [x] 4.1 catalog/app-store/definition.json: catalogVersion 22 to 23.
- [x] 4.2 Regenerate catalog/catalog.json (bun scripts/build-catalog-index.ts from the repo root) and confirm only the app-store entry changed.
- [x] 4.3 Confirm: no other app's catalogVersion changed; pkg/package.json stays 4.2.0 / build 46 (no pkg/src change). Note: the counter 5 to 6 change in the same tree is a mock-only demo bump and must be reverted before any real commit; it is not part of this change.

## 5. Bundle tests

- [x] 5.1 Extend catalog/tests/app-store-tests.cjs with DOM checks (fixture rows, jsdom check(cond,msg) pattern): the badge element sits after the capabilities element inside .store-body; the details element's parent is li.store-row (not .store-body) and it is the last child of the row; the row has top and bottom padding per the stylesheet text; the caret rules are still present.
- [x] 5.2 Run the bundle tests (bun catalog/tests/app-store-tests.cjs) and record the result; jsdom does not lay out, so pixel widths and the wrapped line are asserted on stylesheet text and DOM parentage, and the mock check (section 7) is the rendering proof.

## 6. Harnesses

- [x] 6.1 Run the store harness (bun tests/store-harness.ts) and the catalog harness (bun tests/catalog-harness.ts); record the results. The two known pre-existing failures (store harness stale 4.1.3 version check; agent-tools harness 16-apps count) are not to be fixed here.
- [x] 6.2 Run the typecheck (bun run typecheck from pkg/) and record the result.

## 7. Mock visual check (dev server, mock target)

- [ ] 7.1 With the mock dev server running the implemented change, open the Store page: the Counter row (behind-modified) shows its badge below the description and capabilities and above the 'Absorb with an agent' details; the details summary is visible with its caret; expanding it shows the Absorb prompt.
- [ ] 7.2 Confirm each row has visible padding above and below its content, the details prompt spans the full row width under the buttons, and the caret is still present on every details summary.
- [x] 7.3 Confirm the Counter row still reads behind-modified (unregressed) and the App Store row still reads modified-ahead (local catalogVersion 23 vs GitHub main v20); GET / shows no empty state and /apps lists the installed apps.
- [ ] 7.4 Record the served page byte size and the marker counts (summary::before, store-details, Absorb with an agent) as the rendering proof. Do not click Restore on the App Store row (it would restore the GitHub v20 copy).

## Sync notes — 2026-11-11

Boxes checked in this sync for work actually completed and verified in
this session; the rest stay unchecked with the reason. Verification
figures are the branch-final run (store harness 187 PASS / 1
pre-existing FAIL for the stale 4.1.3 version check; catalog harness
ALL PASSED, 18 apps; typecheck exit 0; bundle tests 120 ok).

- 7.1 (unchecked): browser check (Counter row badge below the
  description and capabilities and above the 'Absorb with an agent'
  details; details summary visible with its caret; expanding it shows
  the Absorb prompt) was not run — no live-browser verification is
  recorded for this change.
- 7.2 (unchecked): browser check (visible padding above and below
  each row's content; details prompt spanning the full row width
  under the buttons; caret on every details summary) was not run.
- 7.4 (unchecked): the v23 served-page byte size and marker counts
  (summary::before, store-details, Absorb with an agent) were not
  recorded at the time. The v27 page was verified by fetch in the
  agent-prompt-pattern work, but that is not this change's record.
