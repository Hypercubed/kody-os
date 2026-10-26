# Proposal

## Why

Modal apps currently open pinned to the top of the viewport (`margin: 1.5rem auto 0`), leaving a large empty checkerboard below short content like the clock. Centering the panel vertically makes modals read as dialogs instead of dropped-down sheets.

## What Changes

- The modal overlay centers its panel on both axes when the content fits the viewport; content taller than the viewport keeps the current scroll behavior with the panel top reachable (no clipped content).
- No change to open/close mechanics (fragment `:target`, back link, close box), backdrop, panel width cap, or non-modal placements.
- Pure CSS, no JS, no new markup.

## Capabilities

### New Capabilities

(none — behavior change to an existing capability)

### Modified Capabilities

- `shell`: modal overlay vertically centers its panel.

## Impact

- `pkg/public/styles.css` + `src/shell-css.ts` regen (overlay centering rules only).
- No markup change, no storage change, no MCP surface change, no export format change. Old-WebKit-safe: no `dvh`, no flexbox `gap`, no transforms for positioning.
