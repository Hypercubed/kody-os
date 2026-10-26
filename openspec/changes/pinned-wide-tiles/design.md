# Design

## Context
See proposal.md Why. Current state: Pinned, Recent, and All apps all render through one shared `tilesList` (`pkg/src/apps/client.ts:249`) into one `.tiles` grid (`repeat(auto-fill, minmax(6.5rem, 1fr))`, 6 across at full width, 2 across under 30rem). Tile markup is icon-over-label with no description and no `title`.

## Goals / Non-Goals
- Goals: pinned-only wide variant (span 2, same height, horizontal icon+text), tooltips on all Apps-screen tiles, stale clock description fix.
- Non-Goals: no change to Recent/All-apps layout, no change to tile navigation targets, no edit-mode row changes.

## Decisions
1. **Span, don't re-grid** — pinned `li` gets `grid-column: span 2` in the existing grid. Why: 3-per-row falls out of the current 6-column grid with zero grid redefinition; under the 30rem 2-column breakpoint each pinned tile takes the full row with no extra rule.
2. **Pinned-only tile variant in the shared renderer** — `tilesList` takes a variant (or Pinned calls a pinned tile function) adding a description span; Recent/All keep current markup. Why: one renderer, smallest diff; description comes from the existing `AppSummary.description`, no data plumbing.
3. **Horizontal layout via flex-direction row on the pinned variant** — icon keeps its plate, text stacks right, tile keeps `min-height: 6.5rem`. Why: same-height constraint is automatic when only width changes.
4. **`title` set to the escaped description on every tile link** — Why: one-line change per tile builder, invisible on Scribe, real tooltips on desktop.

## Risks / Trade-offs
- [Risk] Long descriptions overflow the wide tile → Mitigation: keep pinned descriptions short (one line); CSS clamps with ellipsis (no animation, e-ink safe).
- [Risk] Span-2 in odd grid counts leaves a trailing gap (e.g., 4 pinned apps = 2 rows of 2+... 4 apps fill 2 rows of... 4 × 2 cols = 8 cols = 1 full row + 2 cols) → Mitigation: acceptable grid behavior, same as any spanned grid; no orphan handling.

## Migration Plan
1. Land tile variant + span rule + tooltips + description fix together.
2. Verify on preview: 3-per-row pinned, same height, tooltips present in markup, narrow breakpoint stacks full-row.
3. Rollback: republish prior commit.

## Open Questions
- None.
