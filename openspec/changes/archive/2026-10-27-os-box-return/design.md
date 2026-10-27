# Design

## Context
See proposal.md Why. Current state (`pkg/src/app.ts:170`): the chrome os-box hardcodes Home on every non-dashboard page. A `from` + `safeNextPath` mechanism already exists for action PRG redirects (`app.ts:573-574`) but the app page render (`appBody`) never consumes it, and tiles (`client.ts tileItem`, widget expand link) never send it.

## Goals / Non-Goals
- Goals: origin-aware close box on app pages, zero-JS, no new validation code.
- Non-Goals: no history-API back (breaks without JS and on Scribe); no modal-overlay changes (fragments already stay in place); no per-app close customization.

## Decisions
1. **`from` query param on tile/expand links** — values are exactly `/` (dashboard widgets) or `/apps` (Apps grid). Why: server-rendered, bookmarkable, Scribe-safe. Alternative (JS `history.back()`) rejected: fails with JS off and after PRG redirects.
2. **Reuse `safeNextPath` verbatim** for the close target; invalid/missing → Home. Why: the open-redirect guard already exists and is tested by the action path; no second allowlist to drift.
3. **Thread `from` through action PRGs unchanged** — the existing `from` handling in the action path already returns there; the app page reads the same param for the chrome box. Why: one param, consistent round-trips (act on Apps-opened app → redirect back to `/apps` → close box still points at `/apps`).

## Risks / Trade-offs
- [Risk] Stale `from` after multi-hop navigation (Apps → app A → app B via in-app link) → Mitigation: in-app links don't exist (tiles are the only entries); widget expand sets `from=/` fresh. Worst case falls back to Home, never off-site.
- [Risk] Bookmark with `?from=` preserved → Mitigation: validated on every render, same as action path.

## Migration Plan
1. Land tile/expand `from` + close-target change.
2. Verify: Apps→app→close lands `/apps`; Home→app→close lands `/`; crafted `?from=https://evil` lands Home.
3. Rollback: republish prior commit; `from` params on old code are ignored (unknown query keys pass through).

## Open Questions
- None.
