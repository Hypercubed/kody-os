# Spec Delta

## MODIFIED Requirements

### Requirement: Home launcher lists installed apps

The shell SHALL render a home page at `GET /` showing the widget dashboard (see widget-home), and the Apps grid — Pinned, Recent, and All-apps sections, as a launcher, plus Edit mode — SHALL live behind the Apps menu link instead of at `/`. Launcher management (pin, hide, home) lives in Apps Edit (see below); catalog management (install, update, restore) lives in the App Store data app (see App Store page below). Deep links at `/apps/:id` SHALL be unchanged. The Apps page SHALL render the three sections in order: Pinned (user-chosen tiles, omitted when empty), Recent (behavior-driven tiles with a Clear control, omitted when empty), and All apps (every installed app except hidden ones; pinned apps included). The All-apps header SHALL offer a Search toggle left of Edit; activating it reveals a query box below the header that filters the All-apps browse list server-side (case-insensitive substring over label, name, id, and category). An empty match SHALL render an honest empty state with a clear-filter control. The query SHALL persist across pin/hide/clear redirects. Each tile links to `/apps/:id` — except modal-capable apps, whose tiles link to an inline overlay section on the same page opened by fragment (`#app-<id>`) via CSS `:target` and closed by a back link. The overlay SHALL contain the same section HTML as the app page (bundle UI, live state, action forms), fully present in the server-rendered HTML; JS may enhance it. Every tile SHALL show the app's icon glyph or sanitized SVG mark and label. A fresh install SHALL open with an empty registry — no apps are seeded, including no App Store; with no apps installed, both `/` and the Apps page SHALL render the same Help-style help text with two copy-paste prompts ("Add your own apps" first, "Install the App Store" second — the App Store prompt is agent-only and installs `app-store` only, via `install_from_catalog`, verified with `list_apps`), rendered from the same shared shell block. With apps installed but none on Home, `/` SHALL instead show a short message prompting the user to add apps to Home from the Apps page via Apps Edit's Add to home control.

#### Scenario: Empty registry is honest
- **WHEN** no apps are installed
- **THEN** both `/` and the Apps page respond 200 with honest empty states and guidance toward adding apps.

#### Scenario: Empty Apps page shows two prompts
- **WHEN** the Apps page is fetched with no apps installed
- **THEN** it shows Help-style help text with a prompt for adding your own apps first and a prompt for installing the App Store second, each as selectable text in a gate-hint code block, with no copy button and no Clipboard API use, and with no Edit button. The App Store prompt is agent-only: it installs `app-store` only (`install_from_catalog('app-store')`, verified with `list_apps`), per the app-store recipe; it SHALL NOT name a browser install path.

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

#### Scenario: Search toggle reveals the query box
- **WHEN** the Search toggle in the All-apps header is activated
- **THEN** a text box appears directly below the header, prefilled with the current query, with no page navigation beyond the toggle round-trip.

#### Scenario: Query filters the All-apps list only
- **WHEN** a query is submitted
- **THEN** the All-apps section shows only matching tiles (Pinned and Recent unchanged), and an empty match renders an honest empty state with a clear-filter control.

#### Scenario: Query survives pin and hide round-trips
- **WHEN** a pin, hide, or clear action runs while a query is active
- **THEN** the redirect preserves the query and the filtered list re-renders.
