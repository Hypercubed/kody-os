## Why

The Apps page is a launcher: tiles you tap to leave. Glanceable apps (clock, calendar) need the opposite — a landing page where pinned apps are already visible and running, no tap required. That page becomes the OS home.

## What Changes

- `/` becomes the widget dashboard: every pinned app rendered inline as a live widget in a grid (one document, one refresh). The Apps page moves behind a Home/Apps menu link; `/apps/:id` deep links are unchanged.
- Widgets render the app's own compact view with live state on every load, plus its action forms (same `act()` funnel, PRG back to `/`). A JS tick enhances time-based widgets where timers work; Scribe gets fresh-on-navigation snapshots.
- "Add to homepage" (per-app, from the Apps Edit mode) pins to the dashboard; up/down arrows reorder (no drag-and-drop — no mouse on Scribe). Hiding removes from All apps but keeps the widget.
- Empty dashboard (no homepage widgets) shows an honest empty state pointing at Apps → Edit → "add to homepage".
- Non-widget-capable pinned apps render on the dashboard as plain tiles linking out (assumption, see below).
- BREAKING: the landing page changes from Apps grid to widget dashboard. Old `/` content (Pinned/Recent/All sections) moves to the Apps page unchanged.

## Capabilities

### New Capabilities

- `widget-home`: the dashboard page — grid of live pinned-app widgets, ordering, empty state, widget-form POST behavior, JS tick enhancement.

### Modified Capabilities

- `shell`: `/` serves the widget dashboard instead of the Apps grid; Apps grid moves behind the menu link. Home tile rendering rules move with it unchanged.

## Impact

- `pkg/src/app.ts` (new `/` dashboard route, widget-section rendering, reorder/add/remove actions, old home moves to Apps route).
- `pkg/src/apps/client.ts` (widget builders reusing `renderAppSection`), `registry.ts`/`storage.ts` (homepage order list — assumed shared pinned list, see design).
- `pkg/public/styles.css` + `src/shell-css.ts` regen (grid, widget panels, up/down controls).
- No MCP surface changes (same exports; dashboard reads the same state). No export-format change. No migration: empty homepage list = empty dashboard with honest empty state.
