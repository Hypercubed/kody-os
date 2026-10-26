# Design

## Context
See proposal.md Why. Current state: `body { min-height: 100vh }` with normal document flow; `.os-window` grows with content; menubar (`header.os-menubar`), titlebar, and `footer.os-statusbar` all scroll away. Chrome nesting (`pkg/src/app.ts:204-239`) is already `body > menubar + .os-window > titlebar + main + statusbar` — no markup change needed.

## Goals / Non-Goals
- Goals: viewport-locked shell, single scroll region (`main`), all pages, Scribe-safe CSS only.
- Non-Goals: no `dvh`/dynamic-viewport units (Chromium 75 predates them); no JS scroll management; no per-page scroll memory.

## Decisions
1. **Flex column on `body`, `flex: 1; min-height: 0` on `.os-window`, `overflow-y: auto` on `main`** — Why: pure CSS, matches existing nesting; `min-height: 0` is required or the window refuses to shrink below content height (the classic flexbox trap).
2. **`100vh`, never `dvh`** — Why: `dvh` doesn't exist on the Scribe's engine; desktop address-bar resize causes a small layout jump, acceptable, and the Scribe (fullscreen, no browser chrome) is immune.
3. **Probe inner-scroll check first** — add a scrollable-div + `scrollTop` beacon row to the probe before the CSS lands. Why: nested `overflow` on old WebKit is the one unproven bit; prove it on-device rather than after shipping.
4. **No change to overlay CSS** — overlays are already fixed-position with independent overflow. Why: nothing to fix.

## Risks / Trade-offs
- [Risk] Old WebKit ignores or mishandles nested scroll → Mitigation: probe check gates the CSS work (task order enforces this).
- [Risk] Desktop `vh` jump on address-bar show/hide → Mitigation: accepted; no JS measuring (would violate the no-JS-enhancement posture for layout).
- [Risk] Loss of per-URL browser scroll memory → Mitigation: every navigation starts at top, correct for a window metaphor; `apps-search` mitigates long-list navigation.

## Migration Plan
1. Land probe inner-scroll row; verify on Scribe.
2. Land flex-lock CSS + regen; verify chrome-fixed + inner-scroll on preview and device.
3. Rollback: republish prior commit; old CSS restores document scroll.

## Open Questions
- None.
