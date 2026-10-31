# Tasks

## 1. Schema and validation

- [x] 1.1 Add `ui.openAs?: 'page' | 'modal'` to `UiDef` (and the
  app summary type tile rendering reads), defaulting to
  `'page'` on normalization; reject any other value in
  `validateDefinition` with `{ ok: false }` naming the bad
  value and no writes DONE 2026-10-30: `OpenAs` type in types.ts, `UiDef.openAs`, `AppSummary.openAs` (replaces `placements` on the summary); validator error names the bad value; add_app returns ok:false before any store access.
- [x] 1.2 Implement the `placements` derivation rule from
  design.md decision 3 (modal-only → modal, otherwise page;
  `openAs` wins on disagreement; unknown placements values
  still rejected), and normalize stored/exported definitions
  to carry `openAs` without `placements` DONE 2026-10-30: exported `deriveOpenAs` in registry.ts; add_app writes `openAs` only; list_apps derives `openAs` for old stored definitions so they keep working without re-save; export_app inherits the stored normalized shape.

## 2. Rendering

- [x] 2.1 Swap tile rendering and modal overlay collection from
  `placements`-contains-modal to `openAs === 'modal'`
  (client.ts tile link, app.ts modalIds/overlay sections);
  confirm direct `/apps/<id>` still renders the full page for
  a modal-default app DONE 2026-10-30: `isModalApp` now reads `summary.openAs === 'modal'`; app.ts needs no change (it already collects via `isModalApp`); the app-page route never gated on placements, and the harness proves a modal-default app still renders its full-page section via renderAppSection.
- [x] 2.2 Leave home widget rendering and the homepage list
  untouched; confirm a page-default app and a modal-default
  app both render live widgets when pinned, with working
  forms, and that widget sections still carry `data-app-id` DONE 2026-10-30: no widget/homepage code touched (git diff clean for renderWidgetSection); home-widget-counter test passes (4/4) after fixing a stale pkg/examples/ path in that test left over from the step 1.1 rename — a test-only fix, not a widget change.

## 3. Examples and docs

- [x] 3.1 Update `pkg/catalog/*.bundle.json`: Clock sets
  `openAs: "modal"`; remove `placements` from Calculator,
  Puzzle, and xkcd (they take the page default); Counter,
  Eight Ball, and Probe stay as-is (already omitted) DONE 2026-10-30, verified by re-reading all 7 catalog ui objects.
- [x] 3.2 Update `pkg/docs/adding-an-app.md`: replace the
  `ui.placements` field-table row with `ui.openAs`, state
  plainly that the field is a default not a restriction, and
  note the `placements` derivation rule for old definitions DONE 2026-10-30: field table now has a `ui.openAs` row (default, not restriction; direct /apps/<id> always full page; widgets homepage-governed) plus a deprecated `ui.placements` row with the derivation rule and re-export note.

## 4. Verification

- [x] 4.1 Compat matrix through `add_app` against a memory
  store, no writes on failure: omitted field → page tile;
  `openAs: "modal"` → modal tile + overlay; `openAs:
  "bogus"` → rejected; old `["modal"]` → modal;
  old `["page"]` → page; old `["widget"]` → page;
  both fields disagreeing → `openAs` wins;
  `export_app` output carries `openAs` and no `placements` DONE 2026-10-30: new tests/open-mode-harness.ts (outside pkg/), ALL OPEN-MODE CHECKS PASSED, including the stored/exported migration checks and the full-page-section check.
- [ ] 4.2 End-to-end through `kody dev` (or the hosted shell
  once published): Clock tile opens the overlay with live
  state and working forms and the back link hides it;
  Counter tile opens the full page; a pinned Clock and a
  pinned Counter both render live home widgets
- [ ] 4.3 Run the existing Counter harness and any placements
  render checks, plus the ES2019 ceiling scan on touched
  files, and verify `openspec validate --changes` passes PARTIAL 2026-10-30: Counter harness ALL TESTS PASSED, catalog harness green, schema-migration harness green, home-widget + isolation tests green, added-lines scan clean for `?.`/`??` — but `openspec validate` could NOT run (no openspec binary in this environment), so this task stays open.
