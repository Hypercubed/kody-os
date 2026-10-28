# Tasks

## 1. Corner reorder buttons

- [x] 1.1 Restyle to os-box-like arrow controls in `renderWidgetSection` (`pkg/src/apps/client.ts`): arrow-mark buttons (no text labels, aria "Move <name> left/right"), corner hooks, keep `move=-1|+1` submits and disabled boundaries, and verify `node --experimental-strip-types --check` passes
- [x] 1.2 Restyle `.widget-controls`/`.widget-move` to widget-relative absolute bottom corners with os-box-style outlined arrow boxes (CSS triangles, invert on hover/active) plus reserved content padding in `pkg/public/styles.css`, regen `pkg/src/shell-css.ts` byte-identical, and verify 3rem tap targets hold

## 2. Verify and spec wording

- [x] 2.1 Verify on preview with 2+ pinned apps: left arrow moves earlier, right arrow moves later, first-left and last-right disabled, and `openspec validate --changes` passes
