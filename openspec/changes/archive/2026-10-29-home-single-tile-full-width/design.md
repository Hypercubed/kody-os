# Design

## Context

See proposal.md Why. Current Home dashboard grid (`pkg/public/styles.css`, `.widgets`): `repeat(auto-fill, minmax(16rem, 1fr))` inside a `48rem` max container, so desktop fits at most 2 columns. Narrow breakpoint (`max-width: 30rem`) collapses to `1fr`, already full width. `pkg/src/shell-css.ts` is a generated mirror of that file and must be regenerated after any theme edit.

## Goals / Non-Goals

**Goals:**
- Lone widget in its row spans the full dashboard grid width on multi-column viewports.
- Zero change to server markup, state, or action paths.

**Non-Goals:**
- No change to Apps page `.tiles` grid.
- No responsive breakpoint changes; no new breakpoints.
- No server-side column knowledge or per-widget markup flags.

## Decisions

- CSS-only rule on `.widgets` (desktop scope): `.widgets > :last-child:nth-child(odd)` gets `grid-column: 1 / -1`. Pure viewport truth, no guessing from the server; covers both the single-widget case (`:only-child` is also odd-last) and the odd-count last row.
- Alternative rejected — server marks last widget: server cannot know column count (viewport dependent), would misfire on resize.
- Alternative rejected — flex `flex-grow`: uneven stretch across all rows, breaks the current even 2-col grid.
- Alternative rejected — `:only-child` alone: misses the 3-of-3, 5-of-5 cases; the odd-last selector is a strict superset.
- Rule lives above the `30rem` media query so the single-column layout is unaffected (spanning a 1-col grid is a no-op but keeps the override out of the way).

## Risks / Trade-offs

- [Risk] Widened widget content reflows awkwardly at full width → Mitigation: grid stretch already makes widgets fill row height; bundle content is fluid and centered rules exist for short widgets.
- [Risk] Generated `shell-css.ts` drifts from source → Mitigation: regeneration is an explicit task with a diff check.

## Migration Plan

CSS-only, no data migration. Rollback is deleting the rule and regenerating.
