# Tasks

Phases land in order: 1, then 2, then 3. No task in this file commits, pushes, or publishes anything.

## 1. Bundle and definition

- [x] 1.1 Rewrite the Pages section in `pkg/catalog/settings/index.html`: for each of Help and About, keep the "Now: shown/hidden" readout and badge, put the toggle button on its own line, and put the quiet reset link below it (move the reset form out of the `.st-segmented` flex row; remove the `.st-segmented` wrapper from the Pages rows). Add the immediate menu-bar update to the bundle JavaScript: after a successful toggle and on the initial render, hide or show the matching top menu-bar Help / About link (href ending in `/help` or `/about`, excluding `/apps/` links) by setting `display: none` when hidden and `''` when shown; do nothing if no matching link is found. Keep the toggle control, the plain-GET wiring, the "Now:" readout and badge, and the bundle constraints (ES2019, one inline `<style>`, inlined assets only, 48px targets, 256 KiB cap).
- [x] 1.2 Update the Settings definition (`pkg/catalog/settings/definition.json`): bump `catalogVersion` 3 → 4 and regenerate the catalog index (`bun scripts/build-catalog-index.ts` from the repo root). Do not hand-edit `catalog.json`.

## 2. Verify

- [x] 2.1 Catalog harness (`bun tests/catalog-harness.ts`): it SHALL pass, and the Settings entry SHALL show `catalogVersion` 4 with the manifest agreeing with the definition. The Settings tests and DOM tests SHALL be updated for the new Pages markup and the menu-bar update, and SHALL pass.
- [x] 2.2 Mock-dev verification: install the Settings app; the Pages rows SHALL show the toggle on its own line with the reset link below it (matching Background / Name / Icon). Toggling Help SHALL hide the top menu-bar Help link immediately, without navigating; toggling it back SHALL show the link again. The same SHALL hold for About. The "Now:" readout, badge, and toggle inversion SHALL update with the toggle. The plain-GET no-JavaScript path SHALL still work (303 back to the panel; the next render shows no menu link for the hidden page).
- [x] 2.3 Bundle constraints: the Settings bundle SHALL satisfy the existing bundle constraints (ES2019 script, one inline `<style>`, inlined assets only, zero external links, system fonts, high-contrast black-on-white, 48px minimum tap targets, icon per the existing icon rules, and the 256 KiB cap), and `bun build pkg/src/app.ts --target=browser --external 'kody:*'` SHALL succeed.

## 3. Close out

- [x] 3.1 Run `openspec validate settings-alignment-toggles` and whole-repo `openspec validate --changes`; the change SHALL be valid and the whole-repo result SHALL show no new failures against the pre-existing set (email-client, f-flat-minor-calculator, generic-rss-feed).
- [x] 3.2 Sync the delta into the canonical spec at `openspec/specs/settings-app/spec.md` and confirm it validates.
- [x] 3.3 Archive the change with a close-out note (no deviations recorded, or each deviation named with its reason).

## Close-out note (2026-11-07, archive)

Implemented and verified per the tasks above. Settings catalogVersion 3 → 4; bundle rewritten (Pages rows: toggle on its own line, reset below; immediate menu-bar update via stMenuLink after a successful toggle and on initial render). Catalog harness, Settings tests, and Settings DOM tests all pass (the DOM tests now cover the menu-bar update: hiding About hides the About link and leaves Help and app links shown). Live mock verified: Settings page v4 serves 200 with the Pages rows restructured and the menu-link code present; hiding About via the theme set route returns 303 and the next render shows no About menu link (Help still present); reset restores it. No shell code changed. One known limitation (by design, per the spec): if a page is already hidden when the Settings page loads, its menu link is not in the DOM, so unhiding it does not make the link appear until the next navigation — the toggle itself, the Now/badge, and the theme override all update immediately.
