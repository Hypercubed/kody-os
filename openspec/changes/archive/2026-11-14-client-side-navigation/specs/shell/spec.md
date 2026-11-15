# shell — delta

## ADDED Requirements

### Requirement: Client-side navigation for shell pages

The shell SHALL navigate between its own pages (Home `/` and Apps
`/apps`) without a full page reload when JavaScript runs. The FE
(`pkg/src/client/index.ts`) SHALL intercept clicks on same-origin
links to Home and Apps, fetch the target page as HTML, and swap the
`#os-main` content in place, updating `document.title` and the nav
`aria-current` to match the fresh document, pushing the new URL with
`history.pushState`, and scrolling to the top. Back/forward
(`popstate`) SHALL fetch and swap the same way. Any failure SHALL
fall back to a native navigation (a full page load). App pages
(`GET /apps/:id`), Help, and About SHALL stay full-load. The BE
SHALL still render every page as a full HTML document, and
`shellChrome` SHALL stamp `id="os-main"` on the `<main>` element as
the stable swap target. Home and Apps SHALL carry no app state seeds,
so no bridge seed adoption is needed on a shell-page navigation.

#### Scenario: Home to Apps swaps without a reload
- **WHEN** the user clicks the Apps link on the Home page
- **THEN** the `<main>` content is replaced with the Apps page
  content, `document.title` reads the Apps title, the nav
  `aria-current` moves to Apps, the URL reads `/apps`, and no full
  page load happens.

#### Scenario: Back returns to Home without a reload
- **WHEN** the user goes back after navigating Home → Apps
- **THEN** the `<main>` content is replaced with the Home page
  content, `document.title` reads the Home title, the nav
  `aria-current` moves to Home, the URL reads `/`, and no full page
  load happens.

#### Scenario: A failed fetch falls back to native navigation
- **WHEN** the fetch for a shell-page navigation fails (or the
  fresh document has no `<main>`)
- **THEN** the browser navigates natively to the target URL (a full
  page load), and the page is not left half-updated.

#### Scenario: App pages stay full-load
- **WHEN** the user clicks a link to an app page (`/apps/:id`)
- **THEN** the browser performs a full page load (no client-side
  swap).
