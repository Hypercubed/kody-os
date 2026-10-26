# Spec Delta

## MODIFIED Requirements

### Requirement: Home launcher lists installed apps

The shell SHALL render a home page at `GET /` showing the widget dashboard (see widget-home), and the Apps grid — Pinned, Recent, and All-apps sections with edit mode — SHALL live behind the Apps menu link instead of at `/`. Deep links at `/apps/:id` SHALL be unchanged. The Apps page SHALL render the three sections in order: Pinned (user-chosen tiles, omitted when empty), Recent (behavior-driven tiles with a Clear control, omitted when empty), and All apps (every installed app except hidden ones; pinned apps included). The All-apps header SHALL offer a Search toggle left of Edit; activating it reveals a query box below the header that filters the All-apps browse list server-side (case-insensitive substring over label, name, id, and category). An empty match SHALL render an honest empty state with a clear-filter control. The query SHALL persist across pin/hide/clear redirects. Each tile links to `/apps/:id` — except modal-capable apps, whose tiles link to an inline overlay section on the same page opened by fragment (`#app-<id>`) via CSS `:target` and closed by a back link. The overlay SHALL contain the same section HTML as the app page (bundle UI, live state, action forms), fully present in the server-rendered HTML; JS may enhance it. Every tile SHALL show the app's icon glyph or sanitized SVG mark and label. With no apps installed at all, both `/` and the Apps page SHALL render honest empty states with guidance toward adding apps.

#### Scenario: Empty registry is honest
- **WHEN** no apps are installed
- **THEN** both `/` and the Apps page respond 200 with honest empty states and guidance toward adding apps.

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

#### Scenario: Search toggle reveals the query box
- **WHEN** the Search toggle in the All-apps header is activated
- **THEN** a text box appears directly below the header, prefilled with the current query, with no page navigation beyond the toggle round-trip.

#### Scenario: Query filters the All-apps list only
- **WHEN** a query is submitted
- **THEN** the All-apps section shows only matching tiles (Pinned and Recent unchanged), and an empty match renders an honest empty state with a clear-filter control.

#### Scenario: Query survives pin and hide round-trips
- **WHEN** a pin, hide, or clear action runs while a query is active
- **THEN** the redirect preserves the query and the filtered list re-renders.
