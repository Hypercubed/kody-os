# Proposal

## Why

Home-page widgets each carry two full-size 3rem Up/Down buttons in a strip below the content. They dominate small widgets, eat vertical space on e-ink screens, and Up/Down misdescribes the action on wide layouts where widgets sit side by side. Compact corner controls fix the visual weight without changing what the buttons do.

## What Changes

- Replace the `.widget-controls` strip (two large Up/Down buttons) with two compact arrow controls styled like the titlebar os-box: a small outlined box (CSS-drawn, inverting on hover/active like os-box) containing a left-pointing or right-pointing arrow, pinned to the widget's bottom-left and bottom-right corners (widget-relative absolute positioning, always visible with the widget). No text labels; aria-labels carry "Move <name> left/right".
- Keep the order model unchanged: single homepage list, same `?home=<id>&move=-1|+1` submits, first widget's Left disabled, last widget's Right disabled.
- Keep the 3rem minimum hit area (Kindle ceiling) — the visual button shrinks, the tap target does not.
- Update `widget-home` spec text that currently mandates "up/down reorder controls".

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `widget-home`: widget reorder controls change from large Up/Down strip buttons to compact Left/Right corner buttons; order model, submits, and disabled boundaries unchanged.

## Impact

- `pkg/src/apps/client.ts` (`renderWidgetSection`, ~lines 418-492): button labels, classes, corner placement hooks.
- `pkg/public/styles.css` (`.widget-controls`, `.widget-move`, ~lines 579-599) + regen `pkg/src/shell-css.ts`.
- `openspec/specs/widget-home/spec.md`: "up/down reorder controls" wording.
