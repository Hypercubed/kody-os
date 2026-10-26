# Design: no-home-link

## Context

See proposal.md (Why). "Back to home" links existed in four places: shell footer nav, app-page panel back row (`renderAppPanel` back link), Help panel back row (inline HTML), and the 404 body. The titlebar close box (`os-box`, links to `/`) already reaches home from every page. Constraints: ES2019, zero-JS baseline, single inline `<style>`.

## Goals / Non-Goals

- Goals: remove every "Back to home" link; keep exactly one way home (close box, labeled `Home`).
- Non-goals: removing the close box itself; touching overlay "Back to tiles" or widget "Open" links (different jobs, kept).

## Decisions

1. **Delete the footer nav entirely, not conditionally.** A previous step hid it only on `/`; the decision now is that no page needs it.
2. **Make the panel back row conditional in `renderAppPanel`.** Empty `backHref`/`backLabel` omits the `<p class="app-back">` row. The app page passes empty strings; the modal overlay keeps passing "Back to tiles".
3. **Plain-text 404.** Body becomes "Not found." with no link; chrome (including close box) still wraps it.
4. **Relabel, don't remove, the close box.** `aria-label`/`title` become `Home` so the phrase "Back to home" is gone while the control stays discoverable.

## Risks / Trade-offs

- [Risk] Users who relied on the footer/app back links must find the close box → Mitigation: it is present on every page in the same spot with a `Home` tooltip/name.
