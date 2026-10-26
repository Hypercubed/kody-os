## 1. Remove Back to home links

- [x] 1.1 Delete the footer "Back to home" nav from `shellChrome` and verify no page renders a footer nav
- [x] 1.2 Make the `renderAppPanel` back row conditional on non-empty href/label, pass empty from the app page, and verify the overlay "Back to tiles" still renders
- [x] 1.3 Drop the Help panel back row and the 404 body link, relabel the close box to `Home`, and verify zero "Back to home" hits on `/`, `/apps`, app page, Help, and 404

## 2. Verify

- [x] 2.1 Full pass: all pages return their correct statuses, close box present everywhere, `openspec validate no-home-link` green
