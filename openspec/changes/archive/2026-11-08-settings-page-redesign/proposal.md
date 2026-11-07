# Change: Settings page redesign

## Why
The Settings app is the shell's settings surface, but its page is a stack of six identical blocks. Every section repeats the same pattern — "Current: X (source)" in parentheses, then a row of equal-weight buttons, then a Reset button the same size as Save — so the page reads as a form dump, not a settings page. The source (file default vs override) is buried in parentheses, the Reset buttons compete with the primary actions, and the Title field duplicates Name (a blank title already means "show the name"). The Help and About controls are crammed into one Pages block as two Show/Hide button pairs. And when the app is installed it is only reachable from the Apps page, even though it is a shell-level surface.

A mockup (settings-redesign-mockup.html, revised twice with the owner) settles the new layout: shared black-bar section titles, a "Now: …" readout with a default/changed badge, one primary control per setting, quiet Reset links, the Apps Edit toggle button for Pages, Name kept and Title removed, and Reset all at the bottom. This change implements that mockup, and adds the Settings app to the top menu bar when installed, so it is reachable from anywhere.

## What changes
- The Settings bundle is rewritten to the mockup layout (Background, Name, Icon, Pages, Reset all; Title removed).
- The Settings definition sets `ui.menuBar: true`, so when installed it adds a "Settings" link to the top menu bar. The shell mechanism already exists (app-registry `ui.menuBar` flag); no shell code changes.
- The Settings app's `catalogVersion` goes 2 → 3.
- The canonical `settings-app` spec is updated to the new layout and the menu-bar link.

## What does not change
- The theme routes, the theme fields, and the GET-form wiring (plain GET forms to `/theme/<app>`, 303 back to the panel; JavaScript MAY enhance, never required). No grid or SVG editor. No change to the theme capability, the shell, or any other app.
- The Title override remains settable via the file or an agent; only the bundle field is removed.

## Impact
- A fresh install is unaffected (the Settings app is not seeded). An installed Settings app shows the new page on next render; the menu-bar link appears when installed and disappears when the app is hidden or removed.
- The package version decision is deferred to publish (owner applies it), consistent with the repo's practice; the app's `catalogVersion` 2 → 3 is the versioning that matters for the app.

## Open questions
- None. The layout is settled by the mockup (revised twice with the owner).
