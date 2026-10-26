# Design: widget-home

## Context

See proposal.md (Why). Home currently renders Pinned/Recent/All sections from `list_apps()` plus pinned/hidden lists (home-sections, planned). App rendering helper is `renderAppSection()` (compact view, same HTML everywhere). Constraints: ES2019, inline single `<style>`, no flexbox gap, zero-JS baseline with JS enhancement only.

## Goals / Non-Goals

- Goals: `/` becomes the live widget dashboard; Apps grid moves behind the menu link unchanged; one shared pinned list drives both renderings.
- Non-goals: a separate homepage-membership list (rejected — one list, see below); drag-and-drop reorder; per-widget custom templates; live push/websockets.

## Decisions

1. **One pinned list drives both pages** (no separate homepage list; `kody-os.apps.pinned` order doubles as dashboard order).
   *Why*: "add to homepage" and "pin" are the same user intent — keep-this-app-close. Two lists would drift out of sync with no UI to explain the difference. A pinned app with the `widget` placement renders live; without it, renders as a tile linking out (consistent with the app-placements compact-view rule).
2. **Dashboard reuses `renderAppSection` per widget, wrapped in grid markup.**
   *Why*: same renderer = same HTML as the app page section = one code path for state, forms, and errors. No widget-specific templates.
3. **Widget forms POST to `/apps/:id` and PRG back to `/`.**
   *Why*: reuses the existing validated funnel unchanged; the dashboard needs no new action route. The follow-up GET re-renders all widgets fresh, which doubles as the refresh mechanism.
4. **Up/down arrows per widget (plain form POSTs), no drag-and-drop.**
   *Why*: Scribe has no mouse; arrow buttons work with tap and without JS. Reorder writes the pinned list once.
5. **JS tick is scoped to elements marked time-based and never required.**
   *Why*: Scribe timers are broken per scribe-limitations; the tick only re-renders text content client-side and the page is already complete without it.

## Risks / Trade-offs

- [Risk] Dashboard with many pinned apps grows tall/heavy → Mitigation: compact views by design (app-placements compact rule); grid caps width, page scrolls like any other.
- [Risk] Tick/no-tick divergence confuses (clock static on Scribe, live on desktop) → Mitigation: widgets always show as-of-load time with no tick promise in markup; ticking is silent enhancement.
- [Risk] Overlap with home-sections Pinned section (same list, two renderings) → Mitigation: intended — one list, tiles on Apps, widgets on Home; documented in both changes' specs.

## Migration Plan

None: empty pinned list = empty dashboard with honest empty state. Rollback is a republish of the prior commit.

## Open Questions

None.
