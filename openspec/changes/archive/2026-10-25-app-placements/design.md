# Design: app-placements

## Context

See proposal.md (Why). Home renders tiles from `list_apps()`; each tile links to `/apps/:id`. Forms POST to `/apps/:id` and follow PRG back to the app page. Constraints: zero-JS baseline, ES2019, inline styles, no flexbox gap.

## Goals / Non-Goals

- Goals: modal open/close with zero JS; overlay content identical to the app-page section; forms inside the overlay work.
- Non-goals: widget screen (separate change); JS-driven dialog element; per-placement templates.

## Decisions

1. **CSS `:target` fragment overlays, not `<dialog>`.**
   *Why*: `<dialog>.showModal()` needs JS, which the Scribe path may lack; `:target` works with pure HTML+CSS on any browser back to old WebKit. Overlay section gets `id="app-<id>"`, tile links to `#app-<id>`, a close link points at `#` (or `#apps`). No animation (e-ink rule already bans it).
2. **Overlay markup rendered inline on home for modal-capable apps only.**
   *Why*: page-only apps pay nothing (no extra bytes); modal apps duplicate their section HTML once on home. Duplication is bounded (compact apps by design) and keeps one document / one refresh.
3. **Overlay form POSTs land on the app page (PRG as today), not back in the overlay.**
   *Why*: the server can't address a fragment on redirect-and-stay; returning to the full app page after acting is honest and consistent. Revisit only if user testing says the context loss hurts.
4. **Closed `page | modal | widget` string set in `ui.placements`, default `["page"]`.**
   *Why*: matches the existing `UiTemplate` closed-union style; unknown values fail validation like unknown templates do.

5. **Keep the shell's `<section class="app">`, strip the inner wrapper from `renderAppSection`.**
   *Why*: the shell wrapper carries the title bar, aria label, and back link; the inner bare `<section>` is a styling hook for nothing and renders as a box-in-a-box. Flattening applies to all callers at once (app page, overlay, future widget renderer), and the theme's `.app-body > section` selectors are updated in the same change.

## Risks / Trade-offs

- [Risk] Home page grows with one overlay section per modal app → Mitigation: modal apps are compact by design; cap is a non-issue at this scale.
- [Risk] Fragment links don't work if JS router ever intercepts them → Mitigation: no client router exists and none is planned; the enhancement script only hijacks form submits.

## Migration Plan

None: absent `placements` = page-only, byte-identical home. Rollback is a republish of the prior commit.

## Open Questions

None.
