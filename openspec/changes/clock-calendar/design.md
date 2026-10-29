# Design: clock-calendar

## Context

See proposal.md (Why). The registry validates effects and applies them atomically in `act()`; the shell renders any definition generically. Widget rendering belongs to the widget-home change — these apps are its test doubles and MUST NOT depend on template-specific rendering.

## Goals / Non-Goals

- Goals: `fromNow` time source on `set`; one deterministic `calendar` month-grid effect; two generic test apps proving both.
- Non-goals: template cleanup (follows separately), event storage/sync, JS ticking (progressive enhancement, out of scope here), widget-home rendering itself.

## Decisions

1. **`fromNow` as a `set`-effect flag, not a new op.** The op stays `set`; only the value source is new. Rationale: validation, atomicity, and the single-write path are untouched — the flag just selects "current ISO 8601 UTC time" at apply time. Alternative (a `now()` arg expression language) rejected: it opens the door to an expression grammar, violating declarative-only.
2. **New `calendar` effect op for the month grid** (fields: offset source integer, target string). Rationale: the grid is deterministic pure data (year/month → monospaced text) needing no storage reads beyond the offset; an op keeps navigation as ordinary actions (prev/next month) with the same validation + atomicity. Alternative (renderer-side derivation at display time) rejected: the grid must persist in state so MCP reads, export snapshots, and re-imports all see the same value — render-time derivation would diverge across surfaces.
3. **Grid format: fixed-width monospace text block** (e.g. 7-column weeks, leading blanks, today left unmarked — no highlight state to keep). Rationale: renders identically in generic `<p>`/`<pre>`-style output, Scribe-safe, byte-comparable for round-trip tests.
4. **Test apps live next to `counterDefinition` in `test-app.ts`.** Rationale: established pattern; keeps fixtures out of the shipped registry until an agent adds them.

## Risks / Trade-offs

- [Risk] Clock time goes stale between actions (no push, no timers on Scribe) → Mitigation: documented Refresh-action pattern; value is always labeled as-of what the state holds.
- [Risk] `calendar` op bakes presentation (monospace layout) into state → Mitigation: accepted; the grid is content, and plain-text keeps it portable across UI and MCP.

## Migration Plan

None — additive, defaults preserve existing definitions. Rollback is a republish of the prior commit.

## Open Questions

None — grid-as-data vs derived-values was resolved in explore (grid-as-data won); ticking is explicitly out of scope.
