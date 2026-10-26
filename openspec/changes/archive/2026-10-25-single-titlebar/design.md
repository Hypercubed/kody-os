# Design: single-titlebar

## Context

See proposal.md (Why). `renderAppPanel` in `pkg/src/apps/client.ts` always emits its own striped `<h2 class="app-titlebar">`, and the shell window chrome (`os-titlebar` in `pkg/src/app.ts`) already shows the same title — so app pages render the title twice. Modal overlays reuse `renderAppPanel` on the home page, where the chrome names the OS, not the app.

## Goals / Non-Goals

- Goals: exactly one app title per view in every placement, no visual change to overlays, help/gate/404 pages untouched.
- Non-goals: restyling either titlebar, changing overlay open/close mechanics, touching the theme beyond spacing fallout from the removed header.

## Decisions

1. **Flag on `renderAppPanel` (e.g. `withHeader`), defaulting to current behavior.** App page call site passes headerless; overlay call site keeps the header. Rationale: the alternative — stripping the header in the renderer unconditionally — would leave overlay panels titleless on the home page, where nothing else names the app.
2. **No CSS-first fix (e.g. hiding one header with a selector).** Rationale: both titlebars would still ship in the HTML (wasted bytes on e-ink, confusing DOM); removing the duplicate at render time is cleaner and testable by string count.
3. **Spacing fallout handled in the same change, if any.** If removing the header leaves the panel body flush against the panel border in a way the theme didn't anticipate, adjust `.app-body` top padding in `public/styles.css` + regen `src/shell-css.ts`. Verify by render, not by guessing.

## Risks / Trade-offs

- [Risk] Overlay and page diverge if the flag logic drifts → Mitigation: single renderer function with an explicit parameter; the spec's exactly-one-title scenario covers both paths.
- [Risk] Third `renderAppPanel` caller added later without considering the flag → Mitigation: default preserves current (header) behavior, so new call sites are safe unless they opt out.

## Migration Plan

None — pure rendering change, no data or storage impact. Rollback is a republish of the prior commit.

## Open Questions

None — the only unknown (whether spacing needs a touch-up) is resolved by rendering during implementation.
