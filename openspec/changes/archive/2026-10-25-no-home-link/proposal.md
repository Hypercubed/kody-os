## Why

Every page carried a "Back to home" link (footer nav, app-panel back row, Help panel, 404 body) duplicating the titlebar close box, which already navigates home from everywhere. The duplication adds noise on small/Scribe screens for zero navigational value.

## What Changes

- Drop all "Back to home" links: the footer nav is gone entirely, the app-page panel renders no back row, the Help panel has no back row, and the 404 body is plain "Not found."
- The titlebar close box stays as the single way home and is relabeled `Home` (accessible name + title).
- Kept: the modal overlay's "Back to tiles" link (it closes the overlay, a different job) and widget "Open" links.
- Specs: `shell` "Single shared chrome" requirement + 404 scenario updated to the close-box-as-home chrome.

## Capabilities

### New Capabilities

None — pure removal, no new behavior.

### Modified Capabilities

- `shell`: chrome footer has no home navigation; 404 has no home link; close box labeled `Home`.
