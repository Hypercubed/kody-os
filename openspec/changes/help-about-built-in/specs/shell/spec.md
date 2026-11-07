# Spec Delta

## MODIFIED Requirements

### Requirement: Home launcher lists installed apps

The shell SHALL render a home page at `GET /` showing the widget dashboard (see widget-home), and the Apps grid — Pinned, Recent, and All-apps sections, as a launcher, plus Edit mode — SHALL live behind the Apps menu link instead of at `/`. Launcher management (pin, hide, home) lives in Apps Edit (see below); catalog management (install, update, restore) lives in the App Store data app (see App Store page below). Deep links at `/apps/:id` SHALL be unchanged. The Apps page SHALL render the three sections in order: Pinned (user-chosen tiles, omitted when empty), Recent (behavior-driven tiles with a Clear control, omitted when empty), and All apps (every installed app except hidden ones; pinned apps included). Each tile links to `/apps/:id` — except modal-capable apps, whose tiles link to an inline overlay section on the same page opened by fragment (`#app-<id>`) via CSS `:target` and closed by a back link. The overlay SHALL contain the same section HTML as the app page (bundle UI, live state, action forms), fully present in the server-rendered HTML; JS may enhance it. Every tile SHALL show the app's icon glyph or sanitized SVG mark and label. A fresh install SHALL open with an empty registry — no apps are seeded, including no App Store; with no apps installed, both `/` and the Apps page SHALL render the same Help-style help text with two copy-paste prompts (install the App Store, agent-only via the App Store recipe; add your own apps) instead of an empty tile list, rendered from the same shared shell block. With apps installed but none on Home, `/` SHALL instead show a short message prompting the user to add apps to Home from the Apps page via Apps Edit's Add to home control.

#### Scenario: Empty registry is honest
- **WHEN** no apps are installed
- **THEN** both `/` and the Apps page respond 200 with honest empty states and guidance toward adding apps.

#### Scenario: Empty Apps page shows two prompts
- **WHEN** the Apps page is fetched with no apps installed
- **THEN** it shows Help-style help text with a prompt for adding your own apps first and a prompt for installing the App Store second, each as selectable text in a gate-hint code block, with no copy button and no Clipboard API use, and with no Edit button. The App Store prompt is agent-only: it points at the App Store recipe (`pkg/catalog/app-store/RECIPE.md`) and stops there, with no inline install steps; it SHALL NOT name a browser install path.

#### Scenario: Empty Home page shows the same help
- **WHEN** `/` is fetched with no apps installed
- **THEN** it shows the same help text as the Apps page — same intro, same two prompts — rendered from the same shared shell block, not a second copy.

#### Scenario: Home with apps but none on Home prompts Add to home
- **WHEN** `/` is fetched with at least one app installed and an empty homepage list
- **THEN** it shows a short message prompting the user to add apps to Home from the Apps page via Apps Edit's Add to home control, and it does NOT show the two install prompts.

#### Scenario: Apps page offers Edit mode
- **WHEN** the Apps page is fetched with at least one app installed
- **THEN** the All apps header shows an Edit button (a GET form, matching the Clear control); with no apps installed it shows no Edit button.

#### Scenario: Landing is the dashboard
- **WHEN** apps are pinned to the homepage
- **THEN** `/` shows their live widgets, and the Apps grid (with pins on top) is one menu tap away.

#### Scenario: Sections render in order with an app installed and pinned
- **WHEN** one app is installed, pinned, and acted on
- **THEN** the Apps page shows it in Pinned, in Recent, and in All apps, in that section order.

#### Scenario: Modal tile opens overlay without leaving the Apps page
- **WHEN** a modal-capable app's tile is followed
- **THEN** the overlay section becomes visible on the Apps page (no navigation), showing current state with working forms, and the back link hides it again.

#### Scenario: Unified app renders UI plus state
- **WHEN** a unified app page is fetched
- **THEN** bundle UI, live state, and action forms all render in the single panel with no template branch.

#### Scenario: SVG tile renders mark
- **WHEN** an app with a sanitized SVG icon is listed
- **THEN** the tile shows the SVG mark at icon size with no color or animation.

### Requirement: Single shared chrome

Every page SHALL use the same chrome: title bar with the page title and a close box (labeled with its destination, omitted on the dashboard); menu strip with the left cluster of brand mark plus product name from `settings.json` (default `kody-os`) followed immediately by Home and Apps links, then the menu-app links specified in `Top menu bar links`, then the built-in Help and About links when their pages are enabled (no Refresh link); main content; footer with status text, the active auth path (`via kody`, `via cookie`, `via key`, or `locked`), and no home navigation; `data-pak-config` carrying the current phase; and a right-aligned date and time (server-rendered UTC on each navigation; a client tick SHALL keep it live in the browser's local time zone where JavaScript runs). The titlebar close box on an app page SHALL return to the opener (`/` or `/apps`, carried as a validated `from` param on the tile link); with no valid `from` it SHALL go Home. The dashboard at `GET /` SHALL omit the close box (it already is home) and every other page SHALL show it. The document title SHALL read `{page} · {title}` where `{title}` is the theme title when set, else the theme name. Body background and header mark SHALL likewise render from the settings file with current values as defaults.

#### Scenario: Unknown routes keep the chrome
- **WHEN** a request hits an unknown path
- **THEN** the shell responds 404 inside the full chrome with plain "Not found." text and no home link in the body; the titlebar close box is the way back.

#### Scenario: Header order and clock
- **WHEN** any page is fetched
- **THEN** the header reads brand, Home, Apps left to right with no Refresh link, then any installed menu-app links in label order, then the built-in Help and About links when enabled, and shows a date + time on the far right.

#### Scenario: Defaults preserve current rendering
- **WHEN** no settings file is present
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

### Requirement: Menu apps are derived, not stored

The shell SHALL derive menu-app links from installed definitions on each render. There SHALL be no menu storage key, no menu order list, and no menu toggle in Apps Edit or anywhere else in the browser UI. Installing a flagged app SHALL add its link on the next render; no separate menu write SHALL exist. The built-in Help and About links are the only menu links not derived from installed apps: they are shell-owned, shown when their pages are enabled, and never stored.

#### Scenario: No menu write on install
- **WHEN** a flagged app is installed via `add_app`, `install_from_catalog`, or import
- **THEN** its link appears on the next Home, Apps, or app page render, and no menu-specific storage key is written.

#### Scenario: Built-in links need no install
- **WHEN** no apps are installed and Help is enabled
- **THEN** the menu still shows the Help link (and About, when enabled), and no menu-specific storage key is written.

### Requirement: App page expands to fill the window

The shell SHALL render an expand control in the titlebar of every app page (`GET /apps/:id`), at the far right opposite the close box, and SHALL NOT render it on the dashboard, Apps page, 404 page, modal overlay, home widget, Help page, or About page. Activating the control SHALL switch to a full-window view with no JavaScript and without the browser Fullscreen API: the window SHALL span `100%` of the viewport width with no side margin or border, its top SHALL be flush with the top of the viewport, the menubar and status bar SHALL be hidden, and the main-content gutter SHALL be removed so the app panel spans edge-to-edge. The expanded view SHALL NOT force a viewport height; content height and scrolling SHALL follow the app's content as on the normal page. The expanded state SHALL be carried entirely in the URL fragment, requiring no server, storage, or session state; a full navigation MAY drop it and return the normal page. In the expanded view the control SHALL become a collapse affordance that restores the normal centered chrome. Widget and modal expand boxes SHALL keep their current behavior. Help and About are built-in shell pages, not app pages, so they SHALL NOT carry the control.

#### Scenario: Expand control appears only on app pages
- **WHEN** an app page is fetched
- **THEN** its titlebar shows the expand control at the far right, and when the dashboard, Apps page, a modal overlay, a home widget, the Help page, or the About page is fetched no page-mode expand control is present.

#### Scenario: Expanding fills width and sits at the top
- **WHEN** the user activates the expand control on an app page
- **THEN** the window spans 100% of the viewport width with no side margin, its top is flush with the top of the viewport, the menubar and status bar are not displayed, and the app panel spans edge-to-edge.

#### Scenario: Collapsing restores the normal page
- **WHEN** the user activates the collapse control in the expanded view
- **THEN** the menubar and status bar return and the window returns to its centered, width-capped layout.

#### Scenario: Expansion works without JavaScript and without Fullscreen
- **WHEN** the page is loaded with JavaScript disabled
- **THEN** the expand and collapse controls still work through plain links, and the shell never calls the browser Fullscreen API.

#### Scenario: Expanded state is URL-only
- **WHEN** an app page is expanded
- **THEN** no storage, cookie, or server state is written, and a full navigation returns the normal page because the fragment is not submitted.

#### Scenario: Height follows content
- **WHEN** an app page is expanded and its content is taller than the viewport
- **THEN** the page scrolls normally with no forced viewport height or viewport-locked content region.

## ADDED Requirements

### Requirement: About is a built-in shell page

The shell SHALL serve a built-in About page at `GET /about` rendering the About content — the same content the about catalog app rendered (the "About kody-os" description, the donation links for GitHub Sponsors, Ko-fi, and Buy Me a Coffee, and the QR code) — as a shell page in the shared chrome, not a catalog app. `GET /apps/about` SHALL fall through to the existing unknown-app handling (plain 404). About SHALL NOT appear in the Apps list, Edit mode, pin/hide/home controls, home widgets, or the App Store list. When About is disabled via the settings file, `GET /about` SHALL respond 404 and the menu SHALL show no About link. The About page is a shell page, not an app page, so it SHALL NOT carry the page-mode expand control.

#### Scenario: About renders the About content
- **WHEN** `/about` is opened with About enabled
- **THEN** it responds 200 with the About description, donation links, and QR code, inside the shared chrome.

#### Scenario: About app URL is unknown
- **WHEN** `/apps/about` is opened
- **THEN** the shell responds 404 (unknown app), and About appears in no app listing.

#### Scenario: Disabled About hides page and link
- **WHEN** About is disabled and `/about` is opened
- **THEN** it responds 404, and no page shows an About menu link.
