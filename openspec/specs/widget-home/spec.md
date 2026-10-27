# Widget Home

## Purpose

A landing page where pinned apps are visible and running — glanceable state and working actions without opening each app — replacing the Apps grid as the OS home.

## Requirements

### Requirement: Widget dashboard as landing page

`GET /` SHALL render a grid of live widgets, one per homepage-pinned app in homepage order. Each widget SHALL show the app's current state rendered from its own compact view plus its action forms, and SHALL include up/down reorder controls and a link to the full app page. An empty homepage list SHALL render an honest empty state pointing at Apps → Edit → "add to homepage".

#### Scenario: Widgets show live state
- **WHEN** the dashboard loads with pinned apps holding state
- **THEN** each widget shows current values and working forms, and submitting a widget form applies the action and re-renders the dashboard with the new state.

#### Scenario: Empty dashboard guides to Apps
- **WHEN** no apps are pinned to the homepage
- **THEN** `/` responds 200 with an honest empty state linking to the Apps page edit flow.

### Requirement: Widget actions use the shared handler

Widget forms SHALL submit to the same `act()` path as app pages and the MCP interface, with PRG back to `/`. Bundle buttons in widgets SHALL resolve their action URLs against the widget bundle container's `data-action-base`, so they act on the owning app from the dashboard. A bad widget action SHALL re-render the dashboard with an inline error and unchanged state.

#### Scenario: Bundle buttons act from the dashboard
- **WHEN** a widget bundle button (e.g. counter +1) is activated on `/`
- **THEN** the owning app's state updates and the dashboard reflects the new state, exactly as if the button had been pressed on the app page.

#### Scenario: Bad widget action is clean
- **WHEN** a widget form posts an invalid action
- **THEN** the dashboard re-renders showing the error, and a state re-read is unchanged.

### Requirement: JS tick enhances time-based widgets only

A client tick MAY re-render time-based widget content where timers work. The dashboard SHALL be complete and current as of load from the server-rendered HTML.

#### Scenario: Dashboard is complete without the tick
- **WHEN** the client tick does not run
- **THEN** every widget shows current-as-of-load state with working forms, and no tick code runs.
