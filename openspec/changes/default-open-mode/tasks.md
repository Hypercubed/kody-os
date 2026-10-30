# Tasks

## 1. Schema and validation

- [ ] 1.1 Add `ui.openAs?: 'page' | 'modal'` to `UiDef` (and the
  app summary type tile rendering reads), defaulting to
  `'page'` on normalization; reject any other value in
  `validateDefinition` with `{ ok: false }` naming the bad
  value and no writes
- [ ] 1.2 Implement the `placements` derivation rule from
  design.md decision 3 (modal-only → modal, otherwise page;
  `openAs` wins on disagreement; unknown placements values
  still rejected), and normalize stored/exported definitions
  to carry `openAs` without `placements`

## 2. Rendering

- [ ] 2.1 Swap tile rendering and modal overlay collection from
  `placements`-contains-modal to `openAs === 'modal'`
  (client.ts tile link, app.ts modalIds/overlay sections);
  confirm direct `/apps/<id>` still renders the full page for
  a modal-default app
- [ ] 2.2 Leave home widget rendering and the homepage list
  untouched; confirm a page-default app and a modal-default
  app both render live widgets when pinned, with working
  forms, and that widget sections still carry `data-app-id`

## 3. Examples and docs

- [ ] 3.1 Update `pkg/examples/*.bundle.json`: Clock sets
  `openAs: "modal"`; remove `placements` from Calculator,
  Puzzle, and xkcd (they take the page default); Counter,
  Eight Ball, and Probe stay as-is (already omitted)
- [ ] 3.2 Update `pkg/docs/adding-an-app.md`: replace the
  `ui.placements` field-table row with `ui.openAs`, state
  plainly that the field is a default not a restriction, and
  note the `placements` derivation rule for old definitions

## 4. Verification

- [ ] 4.1 Compat matrix through `add_app` against a memory
  store, no writes on failure: omitted field → page tile;
  `openAs: "modal"` → modal tile + overlay; `openAs:
  "bogus"` → rejected; old `["modal"]` → modal;
  old `["page"]` → page; old `["widget"]` → page;
  both fields disagreeing → `openAs` wins;
  `export_app` output carries `openAs` and no `placements`
- [ ] 4.2 End-to-end through `kody dev` (or the hosted shell
  once published): Clock tile opens the overlay with live
  state and working forms and the back link hides it;
  Counter tile opens the full page; a pinned Clock and a
  pinned Counter both render live home widgets
- [ ] 4.3 Run the existing Counter harness and any placements
  render checks, plus the ES2019 ceiling scan on touched
  files, and verify `openspec validate --changes` passes
