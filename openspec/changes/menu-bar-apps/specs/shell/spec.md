# Spec Delta

## MODIFIED Requirements

### Requirement: Top menu bar links

The shell SHALL render a top menu bar with a brand mark, a `<nav>`
with Home and Apps links, then menu-app links, then a clock at the
far right. Menu-app links SHALL be the installed apps whose
definition carries `ui.menuBar: true`, excluding hidden apps,
sorted by label case-insensitively with id as tiebreak, each
linking to `/apps/<id>`. The link for the app currently being
viewed SHALL carry `aria-current="page"`, matching Home and Apps.
Home, Apps, and app pages SHALL render menu-app links; locked,
404, logout-confirm, and unlocked pages SHALL render no menu-app
links. Logout SHALL NOT appear in the menu bar (it lives in the
footer with its confirm modal, per 1.3.2).

#### Scenario: Flagged apps appear in label order

- **WHEN** two flagged, non-hidden apps are installed (labels
  "About" and "Help")
- **THEN** Home, Apps, and app pages show About then Help in the
  nav after Apps, each linking to its `/apps/<id>` page.

#### Scenario: Hidden flagged apps stay out

- **WHEN** a flagged app is hidden
- **THEN** it appears in no menu-app link on any page, while
  remaining installed and reachable by direct URL.

#### Scenario: Uninstall removes the link

- **WHEN** a flagged app is removed via `remove_app`
- **THEN** its menu-app link disappears from every page with no
  further write, because the definition is gone.

#### Scenario: Viewed app is marked current

- **WHEN** a menu app's own page is opened
- **THEN** its menu link carries `aria-current="page"`.

#### Scenario: Locked pages leak no app names

- **WHEN** an unauthenticated visitor gets the locked page or a
  404 page
- **THEN** no menu-app link is rendered.

## ADDED Requirements

### Requirement: Menu apps are derived, not stored

The shell SHALL derive menu-app links from installed definitions
on each render. There SHALL be no menu storage key, no menu
order list, and no menu toggle in Apps Edit or anywhere else in
the browser UI. Installing a flagged app SHALL add its link on
the next render; no separate menu write SHALL exist.

#### Scenario: No menu write on install

- **WHEN** a flagged app is installed via `add_app`,
  `install_from_catalog`, or import
- **THEN** its link appears on the next Home, Apps, or app page
  render, and no menu-specific storage key is written.
