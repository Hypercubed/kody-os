# Proposal

## Why

As the installed list grows, finding an app in All Apps means visual scanning. A filter box next to Edit narrows the grid to matching tiles without leaving the page or needing JavaScript.

## What Changes

- All Apps `section-head` gains a Search toggle button left of Edit. Activating it (`?search=1`) renders a text box directly below the header, prefilled with the current query.
- Submitting filters the All-apps browse list server-side (case-insensitive substring over label, name, id, and category); Pinned and Recent sections are unaffected.
- Empty match renders an honest empty state ("No apps match …") with a clear-filter control; the query persists across pin/hide/clear redirects via the existing `?edit=1`-style chaining.
- Edit mode is unaffected: opening Edit shows the full list; the search box lives only on the browse header.
- Pure GET forms, no JS: the same `edit=1` toggle precedent the shell already uses. Enhancement may add live filtering later without changing the contract.

## Capabilities

### New Capabilities

(none — behavior change to an existing capability)

### Modified Capabilities

- `shell`: All-apps browse section gains a toggleable query filter.

## Impact

- `pkg/src/apps/client.ts` (`renderAllSection`: Search toggle + textbox + empty-match state), `pkg/src/app.ts` (`/apps` dispatch: `search`/`q` params, server-side filtering, query preservation across pin/hide/clear/edit redirects).
- No storage change (query is URL-only, never persisted), no MCP surface change, no export format change. Scribe-safe: zero JS required.
