# Proposal

## Why

Opening an app from the Apps page and closing it via the titlebar os-box lands on Home, losing the user's place. The close box should return to where the app was opened from — Home or Apps.

## What Changes

- Tile and widget-expand links to `/apps/:id` carry the opener as a `from` query param (`/` or `/apps`, plus fragment-safe handling), reusing the existing `safeNextPath` allowlist.
- The app page titlebar os-box points at the validated `from` path instead of always Home; absent or invalid `from` falls back to Home exactly as today.
- Modal overlays are unchanged (fragment open/close already stays on the Apps page).
- No JS, no storage, no new routes: server-rendered links, Scribe-safe.

## Capabilities

### New Capabilities

(none — behavior change to an existing capability)

### Modified Capabilities

- `shell`: titlebar close-box destination becomes origin-aware (Home or Apps page) instead of always Home.

## Impact

- `pkg/src/apps/client.ts` (`tileItem`, widget expand link: append `from`), `pkg/src/app.ts` (app-page dispatch reads `from`, passes close target into chrome/panel; `safeNextPath` reused, no new validation code).
- No storage migration, no MCP surface change, no export format change. Unknown `from` values fall back to Home (open-redirect safe by construction).
