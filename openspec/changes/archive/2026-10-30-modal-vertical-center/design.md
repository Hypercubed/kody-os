# Design

## Context
See proposal.md Why. Current state (`pkg/public/styles.css:657-676`): `.overlay:target` is a fixed full-viewport block with `overflow: auto`; `.overlay-panel` is `margin: 1.5rem auto 0` — top-anchored.

## Goals / Non-Goals
- Goals: vertically centered modal panel when content fits; no clipped content when it doesn't; pure CSS, old-WebKit-safe.
- **Update Oct 30, 2026:** centering is superseded — the goal is now a panel top at 25vh (upper, not centered), with tall content still scrolling with its top reachable. See task 1.4.
- Non-Goals: no change to open/close mechanics, backdrop, panel width, or scrolling model.

## Decisions
1. **`margin: auto` on the panel inside a flex overlay** — `.overlay:target { display: flex }` + `.overlay-panel { margin: auto }`. Why: the classic technique that both centers short content AND keeps tall content reachable (unlike `align-items: center`, which can clip the top of overflowing flex children in old browsers — the exact Chromium-75-era bug to avoid). No `gap`, no `dvh`, no transforms.
2. **Keep `overflow: auto` on the overlay** — Why: tall content falls back to today's scroll path byte-for-byte; the only changed case is short content, which now centers.

## Risks / Trade-offs
- [Risk] Old-WebKit flex quirk on the overlay → Mitigation: flex `display` + auto margins is the oldest supported centering pattern (predates the buggy `align-items: center` overflow behavior); verify on preview + device.
- [Risk] Interaction with fixed-shell-scroll (viewport-locked shell) → Mitigation: overlay is `position: fixed` relative to the viewport, independent of the `main` scroll container; no shared code path beyond the theme file.

## Migration Plan
1. Land the two-rule CSS change + `shell-css.ts` regen.
2. Verify: short modal centers (clock), tall modal scrolls with reachable top, open/close/backdrop unchanged, desktop + Scribe.
3. Rollback: republish prior commit.

## Open Questions
- None.
