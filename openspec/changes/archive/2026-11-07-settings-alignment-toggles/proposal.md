# Change: Settings alignment and page toggles

## Why

The Settings page redesign (archived 2026-11-07) shipped two defects the owner found by using it:

1. **Alignment.** In the Pages section, each row puts the toggle button and its quiet "Reset Help" / "Reset About" link side by side in one `.st-segmented` flex row. In every other section (Background, Name, Icon) the reset link sits below the primary control. The Pages rows look different from the rest of the page and the toggle and the text link do not line up as a row.
2. **The toggles do not visibly toggle.** Hiding Help or About sets the theme override and inverts the toggle button, but the top menu-bar Help / About link does not disappear until the next page navigation, because the menu bar is server-rendered per page load. The user clicks the toggle and sees no effect where it matters, so the button feels like it does nothing.

## What changes

- **Pages rows:** each page row keeps its "Now: shown/hidden" readout and badge, puts the toggle button on its own line, and puts the quiet reset link below it — the same layout as Background, Name, and Icon. The `.st-segmented` wrapper no longer holds the reset link.
- **Immediate menu-bar update:** after a successful toggle (and on the initial render), the Settings bundle JavaScript hides or shows the matching top menu-bar Help / About link in the page, so the effect is visible without navigating. The toggle control itself, the plain-GET no-JavaScript path, and the "Now:" readout and badge are unchanged.

## What does not change

- The toggle control (Apps Edit `.edit-toggle-btn`, eye-off icon, on = hidden) and its semantics.
- The theme set / reset routes and the plain-GET 303 round-trip (no JavaScript required).
- No shell code changes: the menu-bar update is done by the Settings bundle's JavaScript reaching the shell chrome links in the same document. The menu bar is still server-rendered correctly on the next navigation either way.
- No other Settings section changes. No other app changes.

## Impact

- Settings `catalogVersion` 3 → 4 (bundle change). Package version is deferred to publish, as usual.
- The canonical settings-app spec gains the row layout and the immediate menu-bar update.
