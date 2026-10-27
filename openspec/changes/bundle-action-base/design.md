# Design

## Context

See proposal.md Why. Current state: `renderAppSection` (`pkg/src/apps/client.ts:117`) renders `<div class="bundle" data-bundle="<id>">` with no URL anchor; the counter bundle JS (`example-apps/hello-counter.json`) uses `window.location.pathname` + credentialless `fetch`. Template action forms already stamp per-app `action=` URLs, which is why Reset works from home while +1/-1 don't.

## Goals / Non-Goals

- Goals: page-independent action base for bundle scripts; counter works from dashboard under cookie and `?k=` auth; convention documented for future bundles.
- Non-Goals: no server routing changes (single `act()` path stays); no changes to template forms; no client.js interception magic.

## Decisions

1. **`data-action-base` on the container, read by bundle JS with pathname fallback** — shell stamps it wherever the bundle renders (page, overlay, widget); counter JS uses `closest('.bundle').dataset.actionBase || window.location.pathname`. Why: one anchor, three render sites, zero routing changes; fallback keeps old exported copies working on their app page. Alternative (`home=<id>` query routing on `/`) rejected: ambiguous with multiple widgets, second routing path.
2. **`credentials: 'same-origin'` on the bundle fetch** — Why: cookie-authenticated dashboards (and any no-`?k=` context) need the session cookie on fetch; same-origin keeps it tight. Fallback full-navigation already carries cookies natively.
3. **Convention documented, not enforced in validation** — `adding-an-app.md` tells bundle authors to use the container base, but `validateDefinition` doesn't inspect bundle JS. Why: static JS analysis is out of scope; the documented convention + reference bundle (hello-counter) is enough.

## Risks / Trade-offs

- [Risk] Third-party bundles ignore the convention and keep using `pathname` → Mitigation: they degrade exactly as today (work on app page, dead on dashboard); documented + reference implementation leads.
- [Risk] `dataset` on older engines → Mitigation: guard with `getAttribute('data-action-base')` fallback; Kindle ceiling is Chromium 75, which has `dataset`, but belt-and-braces costs one line.

## Migration Plan

1. Land shell stamp + counter JS + docs together.
2. Verify: pin counter home, +1/-1 update state under cookie auth; app page unchanged; overlay (clock? modal) unaffected.
3. Rollback: republish prior commit; `data-action-base` absent, counter falls back to pathname (today's behavior).

## Open Questions

- None.
