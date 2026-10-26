## 1. Schema and validation

- [x] 1.1 Add `placements` to the `UiDef` type and validation (closed page/modal/widget set, default page-only), and verify `add_app` accepts modal, defaults an omitted field, and rejects an unknown value with no writes
- [x] 1.2 Export the new type through the package index and verify the MCP import surface lists it

## 2. Overlay rendering

- [x] 2.1 Add the overlay section builder (same section HTML inside a `:target`-revealed panel with back link) and verify a node render contains the overlay markup with current state
- [x] 2.2 Wire home tiles for modal-capable apps to fragment links and inline their overlay sections, and verify page-only apps render byte-identical tiles to before
- [x] 2.3 Add overlay CSS (panel, dim backdrop via flat color, close affordance, no animations) plus `shell-css.ts` regen, and verify one inline `<style>`, zero `<link>`, no flexbox gap
- [x] 2.4 Flatten the app panel to a single `<section class="app">` (bare content from `renderAppSection`, theme selectors updated) and verify node renders of app page and overlay each contain exactly one app-panel section

## 3. Verify

- [x] 3.1 Full pass: node render of home (tile + overlay present), app page unchanged, no-JS form submit from overlay lands on the app page with new state, `openspec validate app-placements` green, and verify each observable in the response
