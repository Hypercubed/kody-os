## Why

Every app opens as a full page today. Glanceable apps (clock) need a lighter-weight presentation: a modal overlay on home that opens without leaving the page and dismisses back to the tiles. Iframes were ruled out (second document, sizing fights, unneeded isolation); the shell already renders everything server-side in one document.

## What Changes

- App definitions gain an optional placement allowlist (`ui.placements`, default `["page"]`): which of page | modal the app supports. The `widget` value is reserved in the schema but has no renderer yet — the widget screen is a separate future change and explicitly out of scope here.
- Home renders a hidden overlay section per modal-capable app, opened by fragment link (`#app-<id>`) via CSS `:target`, closed by a back link. The app page at `/apps/:id` remains the full-page fallback with the same content.
- Modal content is the app's single compact view (same `renderAppSection`), not a second template. Apps declare compact-first design by opting into modal.
- BREAKING: none. Default placement is page-only; existing apps and routes are untouched.

## Capabilities

### New Capabilities

- `app-placements`: the placement allowlist on app definitions and the modal overlay rendering rules (fragment open/close, single-document, no-JS).

### Modified Capabilities

- `shell`: tiles for modal-capable apps link to fragment overlays; home includes inline modal sections; no change to page routes.

## Impact

- `pkg/src/apps/types.ts` (placements field + type), `pkg/src/apps/client.ts` (overlay section builder), `pkg/src/app.ts` (fragment links, inline modal sections on home).
- `pkg/public/styles.css` + `src/shell-css.ts` regen (overlay panel, dim backdrop via plain CSS, no animations).
- No MCP surface changes, no storage-key changes, no export-format changes. No migration: absent placements = page-only.
