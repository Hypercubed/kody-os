# Spec Delta

## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Single shared chrome

Every page SHALL use the same chrome: title bar with the page title and a close box (labeled with its destination, omitted on the dashboard); menu strip with the left cluster of brand mark plus product name from `os-theme.json` (default `kody-os`) followed immediately by Home and Apps links, then the menu-app links specified in `Top menu bar links` (no Refresh link, no static Help link); main content; footer with status text, the active auth path (`via kody`, `via cookie`, `via key`, or `locked`), and no home navigation; `data-pak-config` carrying the current phase; and a right-aligned date and time (server-rendered UTC on each navigation; a client tick SHALL keep it live in the browser's local time zone where JavaScript runs). The titlebar close box on an app page SHALL return to the opener (`/` or `/apps`, carried as a validated `from` param on the tile link); with no valid `from` it SHALL go Home. The dashboard at `GET /` SHALL omit the close box (it already is home) and every other page SHALL show it. The document title SHALL read `{page} · {title}` where `{title}` is the theme title when set, else the theme name. Body background and header mark SHALL likewise render from the theme file with current values as defaults.

#### Scenario: Unknown routes keep the chrome
- **WHEN** a request hits an unknown path
- **THEN** the shell responds 404 inside the full chrome with plain "Not found." text and no home link in the body; the titlebar close box is the way back.

#### Scenario: Header order and clock
- **WHEN** any page is fetched
- **THEN** the header reads brand, Home, Apps left to right with no Refresh link and no static Help link, then any installed menu-app links in label order, and shows a date + time on the far right.

#### Scenario: Defaults preserve current rendering
- **WHEN** no theme file is present
- **THEN** title, brand, and background are byte-identical to the pre-change shell.

#### Scenario: Footer names the auth path
- **WHEN** any page is fetched
- **THEN** the footer states which path authenticated the request (`via kody`, `via cookie`, `via key`, or `locked`).

#### Scenario: Close returns to the opener
- **WHEN** an app opened from the Apps page is closed via the titlebar box
- **THEN** the browser lands on the Apps page, not Home.

#### Scenario: Close from Home returns Home
- **WHEN** an app opened from a home widget is closed via the titlebar box
- **THEN** the browser lands on Home.

#### Scenario: Bad from falls back to Home
- **WHEN** an app page is opened with a missing or off-site `from` value
- **THEN** the close box links Home and no open redirect occurs.

### Requirement: App page expands to fill the window

The shell SHALL render an expand control in the titlebar of every app page
(`GET /apps/:id`), at the far right opposite the close box, and SHALL NOT render
it on the dashboard, Apps page, 404 page, modal overlay, or home widget.
Activating the control SHALL switch to a full-window view with no
JavaScript and without the browser Fullscreen API: the window SHALL span `100%`
of the viewport width with no side margin or border, its top SHALL be flush with
the top of the viewport, the menubar and status bar SHALL be hidden, and the
main-content gutter SHALL be removed so the app panel spans edge-to-edge. The
expanded view SHALL NOT force a viewport height; content height and scrolling
SHALL follow the app's content as on the normal page. The expanded state SHALL
be carried entirely in the URL fragment, requiring no server, storage, or
session state; a full navigation MAY drop it and return the normal page. In the
expanded view the control SHALL become a collapse affordance that restores the
normal centered chrome. Widget and modal expand boxes SHALL keep their current
behavior. The static Help page no longer exists, so the help app page at
`/apps/help` is an ordinary app page and SHALL carry the control.

#### Scenario: Expand control appears only on app pages
- **WHEN** an app page is fetched
- **THEN** its titlebar shows the expand control at the far right, and when the
  dashboard, Apps page, a modal overlay, or a home widget is fetched
  no page-mode expand control is present.

#### Scenario: Expanding fills width and sits at the top
- **WHEN** the user activates the expand control on an app page
- **THEN** the window spans 100% of the viewport width with no side margin, its
  top is flush with the top of the viewport, the menubar and status bar are not
  displayed, and the app panel spans edge-to-edge.

#### Scenario: Collapsing restores the normal page
- **WHEN** the user activates the collapse control in the expanded view
- **THEN** the menubar and status bar return and the window returns to its
  centered, width-capped layout.

#### Scenario: Expansion works without JavaScript and without Fullscreen
- **WHEN** the page is loaded with JavaScript disabled
- **THEN** the expand and collapse controls still work through plain links, and
  the shell never calls the browser Fullscreen API.

#### Scenario: Expanded state is URL-only
- **WHEN** an app page is expanded
- **THEN** no storage, cookie, or server state is written, and a full navigation
  returns the normal page because the fragment is not submitted.

#### Scenario: Height follows content
- **WHEN** an app page is expanded and its content is taller than the viewport
- **THEN** the page scrolls normally with no forced viewport height or
  viewport-locked content region.

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
