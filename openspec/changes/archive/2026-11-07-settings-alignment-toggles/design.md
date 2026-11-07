# Design: Settings alignment and page toggles

## Decisions

### Decision 1 — Pages rows match the other sections

Each Pages row keeps its "Now: shown/hidden" readout and badge, puts the toggle button on its own line, and puts the quiet reset link below it. The reset form moves out of the `.st-segmented` flex row, so the toggle is alone in its row and the reset sits underneath — exactly as Background (Desk / Paper, then Reset background), Name (field + Save, then Reset name), and Icon do. The `.st-segmented` wrapper is no longer needed for a single toggle and is removed from the Pages rows. No other section's markup changes.

### Decision 2 — The toggle updates the menu bar immediately

After a successful toggle, and on the initial render, the Settings bundle JavaScript hides or shows the matching top menu-bar Help / About link in the current page, so the effect is visible without navigating. It finds the link by its href: the built-in menu links are `<base>/help` and `<base>/about` (where `<base>` is the app base path, possibly empty), while installed-app menu links are `<base>/apps/<id>`. The lookup matches a link whose href ends in `/help` or `/about` and does not contain `/apps/`, so it cannot pick up an app link. When the page is hidden the link gets `display: none`; when shown the display is restored to `''`. If no matching link is found (for example the page is rendered without a menu bar), nothing happens — the toggle still works and the next navigation renders the menu correctly.

This is a bundle-only change. The shell still renders the menu bar from the theme on every page load, so the immediate DOM update and the server render can never disagree for longer than one navigation: both read the same effective `showHelp` / `showAbout`.

### Decision 3 — The toggle control and the no-JavaScript path are unchanged

The toggle stays the Apps Edit `.edit-toggle-btn` (48px square, eye-off SVG, `role="switch"`, on = hidden), submitting as a plain GET form to `../theme/settings` with the hidden field-named param carrying the opposite value. The "Now:" readout and default/changed badge keep updating from the read route. JavaScript MAY enhance in place (fetch with `format=json`, then re-render), never required; without JavaScript the form round-trips with a 303 and the next render shows the new state and no menu link.

### Decision 4 — Version

Settings `catalogVersion` 3 → 4. Package version is deferred to publish, as usual.

## Open questions

None. The owner reported both defects from use; the fix is scoped to the Settings bundle.
