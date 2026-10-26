## Why

The home screen is a single flat list that will not scale past a handful of apps and offers no way to organize it. ReKindle solves this with featured/favorites/hidden filtering over one registry; the OS should do the same with Pinned, Recent, and All-apps sections plus an edit mode.

## What Changes

- Home page gains three sections in order: Pinned (user-chosen tiles), Recent (behavior-driven, capped, clearable), All apps (complete inventory minus hidden, pinned included and marked).
- Recency updates on every app page view and every successful `act()`, so UI and MCP use both count.
- Edit mode (toggled from the All-apps section) lists every app including hidden and pinned, with per-app pin and hide toggles.
- Hiding a pinned app keeps it in Pinned but removes it from All apps.
- Pinned, hidden, and recency lists live in `packageStorage()` beside the registry. Export carries pinned + hidden (user prefs); recency stays local.
- No change to the act/validation path, export format, or theme system.

## Capabilities

### New Capabilities

(none — this change extends existing capabilities)

### Modified Capabilities

- `shell`: home rendering changes from one tile list to three sections plus an edit mode with pin/hide toggles, Clear for recent, and empty/hidden-only states.
- `app-registry`: new stored lists (pinned ids, hidden ids, capped recency with timestamps); recency records on `act()` success and app page render; export includes pinned + hidden; `list_apps` callers can filter hidden.

## Impact

- `pkg/src/app.ts` (home rendering, edit-mode routes/forms, recency writes on page view).
- `pkg/src/apps/registry.ts`, `storage.ts`, `types.ts` (lists, recency hook, export payload).
- `pkg/src/apps/client.ts` (section/tile/edit HTML builders).
- `pkg/public/styles.css` + `src/shell-css.ts` regen (section headings, edit toggles, pinned markers).
- No MCP surface changes (same exports; new behavior inside existing functions). No migration: fresh keys default to empty.
