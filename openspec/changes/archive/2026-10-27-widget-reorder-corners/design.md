# Design

## Context

See proposal.md Why. Current state: `renderWidgetSection` (`pkg/src/apps/client.ts:431-488`) emits a `.widget-controls` strip with two full-size Up/Down submit buttons (`?home=<id>&move=∓1`); CSS at `pkg/public/styles.css:579-599` lays them out as a flex row with 3rem buttons.

## Goals / Non-Goals

- Goals: compact Left/Right corner buttons, same order model and submits, 3rem tap targets kept, disabled boundaries kept, zero-JS (plain GET forms as today).
- Non-Goals: no change to the homepage order model (still a single list, no drag-and-drop, no 2D grid positioning); no change to edit-mode pin/hide/homepage toggles on the Apps page.

## Decisions

1. **Arrows in os-box-style boxes, keep `move=-1|+1` values** — visible text becomes CSS-drawn arrow marks inside os-box-style outlined boxes (no text labels); aria-labels stay "Move <name> left/right"; the submits, dispatch, and PRG path are untouched, so the diff is labels + classes + CSS only. Why: matches your call (arrows, os-box look); CSS triangles avoid font-coverage risk on e-ink. Alternative (glyph characters) rejected: font-dependent, can render as tofu on constrained devices.
2. **Widget-relative absolute corners, arrow boxes mirror os-box construction** — `.widget` gets `position: relative`; arrow controls `position: absolute; bottom: X; left/right: X`, built like `.os-box::before` (small outlined square, inverts on hover/active) with a CSS-triangle arrow inside. Why: controls stay with their widget while scrolling; same visual language as the chrome. Alternative (keep the strip, just shrink buttons) rejected: doesn't answer the visual-weight complaint.
3. **Visual size shrinks, hit area stays 3rem** — smaller text/padding with transparent padding or `min-width/min-height: 3rem` retained. Why: the Kindle-ceiling 3rem rule exists for touch/stylus; shrinking the hit area would regress usability. No alternative considered.
4. **Disabled boundaries preserved verbatim, dimmed like os-box idle** — same `index <= 0` / `index >= total - 1` conditions, `disabled` + reduced opacity (existing `.widget-move button:disabled` rule carries over). Why: no reason to change; keeps the spec's boundary scenario trivially true.

## Risks / Trade-offs

- [Risk] Absolute corners overlap widget content on short widgets → Mitigation: reserve bottom padding in `.widget .app-body` (or the controls row) equal to button height + margin, so content never slides under the buttons.
- [Risk] Left/Right misdescribes vertical-stack movement → Mitigation: accepted as the requester's explicit preference; the aria-labels stay descriptive ("Move <name> earlier/later" if desired at build time — spec scenarios only require the visible behavior).
- [Risk] `shell-css.ts` regen forgotten → Mitigation: task step asserts byte-identity with `public/styles.css`.

## Migration Plan

1. Land client.ts + CSS + regen together.
2. Verify on preview: pin 2+ apps, Left/Right reorder, boundaries disable, tap-size check.
3. Rollback: republish prior commit; old strip buttons return, `move` values unchanged so bookmarks keep working.

## Open Questions

- None blocking. Aria-label wording ("Move X left" vs "Move X earlier") left to build time.
