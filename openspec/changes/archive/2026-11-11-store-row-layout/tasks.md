# Store row layout — tasks

No task in this file commits, pushes, or publishes anything. No release/publish steps. No verify-on-Scribe task: the CSS used here (`::before`, border triangles, `transform`, `transition`, `[open]`, `calc()`, `ch`) all predate the Chromium 80 ceiling, and the rendering proof is the mock visual check (§7), which runs in the same Chromium the Scribe uses. No App Store seed is required beyond the mock steps in §7.

## 1. Caret on the agent-text `<details>` (store.css only, no store.js change)

- [x] 1.1 Hide the native marker: add `list-style: none` to `.store-details summary` and `summary::-webkit-details-marker { display: none; }`.
- [x] 1.2 Add the triangle: `summary::before` with `content: ""`, `flex-shrink: 0`, zero width/height, `0.5rem` right margin, `0.35em` transparent top/bottom borders and a `0.55em solid currentColor` left border.
- [x] 1.3 Add the open state: `.store-details[open] > summary::before { transform: rotate(90deg); }` with a `0.15s` transform transition on the `::before`.
- [x] 1.4 Confirm: the summary keeps `min-height: 48px` (store.css:19); no emoji, no image, no JavaScript for the caret; `store.js` untouched.

## 2. Pin icon, label, and buttons to the top of the row (store.css only)

> SUPERSEDED 2026-11-11: this section is superseded by the v24
> direct change (fixed heights `min-height: 4.85rem` + vertically
> centered content, `stretch`), made at the user's direction on
> 2026-11-11. Tasks 2.1-2.3 below are NOT completed — they are
> superseded, not done; their boxes stay unchecked on purpose. §2's
> intent is preserved: row content does not move when the details
> opens, because the details element sits on its own flex line
> (`flex: 0 0 100%`, store.css:18) below the columns, so opening it
> grows the second line, not the first, and the columns do not move.

- [ ] 2.1 `.store-row`: `align-items: center` → `flex-start` (store.css:3). [SUPERSEDED 2026-11-11 — see note above; not completed.]
- [ ] 2.2 `.store-main`: `align-self: stretch` → `flex-start`, `justify-content: center` → `flex-start` (store.css:4). Keep `width: 6.5rem` and `padding: 0.5rem`. [SUPERSEDED 2026-11-11 — see note above; not completed.]
- [ ] 2.3 Add explicit `align-self: flex-start` to `.store-body` (store.css:8) and `.store-controls` (store.css:12). [SUPERSEDED 2026-11-11 — see note above; not completed.]
- [x] 2.4 Confirm: row `min-height: 6.5rem`, `flex-wrap: wrap`, border, and margins unchanged; `pkg/public/styles.css` untouched.

## 3. One fixed width for every row action button (store.css only)

- [x] 3.1 `.store-controls button` (store.css:13): add `box-sizing: border-box; width: calc(12ch + 2rem + 2px); white-space: nowrap;` (12ch = longest busy label "Overwriting…", 2rem = 16px padding each side, 2px = 1px borders; basis in design.md Decision 3).
- [x] 3.2 Confirm: button labels, busy labels, and the status → button mapping (store.js:291-295) unchanged; dialog buttons (store.css:16) and Update All (store.css:17) unchanged per design.md Decision 4; the 48px tap-target height still comes from the `.bundle button` bare default.

## 4. Versioning

- [x] 4.1 `catalog/app-store/definition.json`: `catalogVersion` 21 → 22.
- [x] 4.2 Regenerate `catalog/catalog.json` (`bun scripts/build-catalog-index.ts` from the repo root) and confirm only the app-store entry changed.
- [x] 4.3 Confirm: no other app's `catalogVersion` changed; `pkg/package.json` stays 4.2.0 / build 46 (no `pkg/src` change).

## 5. Bundle tests

- [ ] 5.1 Extend `catalog/tests/app-store-tests.cjs` (jsdom, `check(cond, msg)` pattern, fixture rows already cover every status): assert the store.css text contains the caret rules (native-marker suppression, `::before` triangle, `[open]` rotation) and the `flex-start` alignment rules and the fixed-width rule with the `calc(12ch + 2rem + 2px)` value; assert no button label, prompt summary, or badge text changed (existing checks keep passing).
- [x] 5.2 Record in the test file's header comment that jsdom does not lay out: pixel widths and caret rendering are not asserted here — the mock visual check (§7) is the rendering proof.

## 6. Harnesses

- [x] 6.1 `bun tests/store-harness.ts` passes (from the repo root). The one known pre-existing failure (stale hardcoded 4.1.3 version check) is out of scope; any NEW failure blocks the change.
- [x] 6.2 `bun tests/catalog-harness.ts` passes (all 18 apps).

## 7. Mock visual check (verification task, not run by this spec)

- [x] 7.1 Precondition: the mock Store must be on v21 first — at spec time the live mock serves the v20 bundle with no absorb UI at all (read-only check 2026-11-11: served page has no `storeAgentPrompt`, no `store-details`, no `Absorbed`; on-disk installed app-store definition is `catalogVersion` 20). Re-update the mock Store to v21 from the local catalog with the stopped-dev sequence (`kody dev` stopped before the `install_from_catalog` mock write, restarted after), and verify the served page contains `storeAgentPrompt` before proceeding.
- [x] 7.2 Install the v22 Store the same way (stop dev → `install_from_catalog` app-store from the local catalog → restart dev → verify `/__kody/dev/status` is 200 and the served page contains the new rules).
- [ ] 7.3 In the browser, on the Store page: every `<details>` summary shows a caret pointing right when closed and down when open.
- [ ] 7.4 Open a details element and confirm the icon, label, and buttons of that row do not move; repeat on a row whose controls wrap.
- [ ] 7.5 Confirm every row action button is the same width, the longest label fits, and clicking a button (busy label) does not resize it; confirm the dialog confirm/cancel buttons and Update All are unchanged.

## Sync notes — 2026-11-11

Boxes checked in this sync for work actually completed and verified in
this session; the rest stay unchecked with the reason. This change IS
archived as superseded-in-part (2026-11-11): its section 2
implementation (top-pinning) is not in the tree — see 2.1-2.3 below. Verification figures are the
branch-final run (store harness 187 PASS / 1 pre-existing FAIL for the
stale 4.1.3 version check; catalog harness ALL PASSED, 18 apps;
typecheck exit 0; bundle tests 120 ok).

- 2.1 (unchecked): NOT in the tree. store.css carries no flex-start
  at all; .store-row is align-items: stretch. The v24 spec-less
  direct change (fixed heights min-height: 4.85rem + centering) set
  the stretch values, and the bundle tests now assert stretch
  ('store row stretches children to the line height') instead of the
  flex-start rule this change specified.
- 2.2 (unchecked): NOT in the tree. .store-main is align-self:
  stretch (not flex-start) with centered content. Same cause as 2.1.
- 2.3 (unchecked): NOT in the tree. .store-body and .store-controls
  are align-self: stretch (not flex-start). Same cause as 2.1.
  Decision (2026-11-11, user direction): record 2.1-2.3 as
  superseded by v24; the change is archived as superseded-in-part.
  Note: the
  'do not move when details opens' behavior is preserved anyway,
  because the details element sits on its own flex line (flex:
  0 0 100%) — opening it grows the second line, not the first — but
  the columns are vertically centered, not top-pinned.
- 5.1 (unchecked): the caret and fixed-width assertions are in the
  bundle tests and pass; the flex-start alignment assertion is
  absent — the tests assert stretch instead (see 2.1-2.3).
- 7.3 (unchecked): browser check (carets pointing right when closed
  and down when open, on the live Store page) was not run — no
  live-browser verification is recorded for this change.
- 7.4 (unchecked): browser check (icon, label, and buttons do not
  move when a details element opens, including on a row whose
  controls wrap) was not run.
- 7.5 (unchecked): browser check (every row action button the same
  width, longest label fits, clicking a button does not resize it;
  dialog and Update All buttons unchanged) was not run.
