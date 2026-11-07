# Proposal

## Why

Today the whole page scrolls as one document, so the menubar, window titlebar, and status bar scroll off-screen on long app pages. Locking the shell to the viewport with only the content region scrolling makes it feel like an OS window: chrome stays put, content moves.

## What Changes

- `body` becomes exactly `100vh` (not `dvh`: Chromium 75 predates it) with no page-level scroll; the existing `.os-window` flex column (titlebar + `main` + statusbar) takes the remaining viewport height.
- `main` becomes the single scroll region (`overflow-y: auto`); menubar, window titlebar, and statusbar stay visible on every page (Home, Apps, app pages, Help, locked/404).
- Modal overlays are untouched (already `position: fixed` with independent scroll).
- Probe gains an inner-scroll check so the riskiest bit (nested `overflow` on old WebKit) is proven before the CSS lands.

## Capabilities

### New Capabilities

(none — behavior change to an existing capability)

### Modified Capabilities

- `shell`: shell chrome is viewport-locked; `main` is the scroll region on all pages.

## Impact

- `pkg/public/styles.css` + `src/shell-css.ts` regen (body flex column, window flex sizing with `min-height: 0`, `main` overflow); `pkg/catalog/probe/definition.json` (inner-scroll beacon row).
- No markup changes, no storage change, no MCP surface change, no export format change. Per-URL browser scroll memory goes away (every navigation starts at top) — correct for a window metaphor, mitigated by search for long lists.
