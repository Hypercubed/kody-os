# Client-side navigation for shell pages

## Summary

Navigate between the shell's own pages (Home and Apps) without a full
page reload. The FE intercepts same-origin clicks on shell-page links,
fetches the target page as HTML, and swaps the `<main>` content in
place, updating the document title, the nav `aria-current`, and the
browser history. Any failure falls back to a native navigation (a full
page load), so the shell never breaks for lack of the enhancement.

This is the middle ground's "less full page load on actions" want
(Nov 9, 2026): the shell stays server-rendered (the initial page load
is still a full HTML document from the BE), but moving between its own
pages no longer costs a full reload. App pages stay full-load.

## Context

The shell is a multi-page app: every navigation is a full page load.
The BE renders each page as a complete HTML document (`shellChrome` in
`app.ts`), and the browser fetches and renders it from scratch. That
costs a full reload (new document, new client module, new bridge, new
element definitions) on every Home ↔ Apps move, even though the shell
chrome is identical and only the `<main>` content changes.

The FE already has the pattern for in-place swaps. The Store controls
and the Apps Edit toggles (`pkg/src/client/index.ts`) intercept form
submits, fetch the target as HTML, and swap one section in place
(`#store`, `.edit-list`) with `DOMParser`, falling back to a native
submit on any failure. Client-side navigation extends that same
pattern from form submits to link clicks, and from one section to the
page's `<main>` content.

The scope is deliberately narrow (Nov 9 middle-ground shape):
islands + client-side navigation for shell pages only (home/apps).
App pages full-load. The full SPA is not the target.

## What Changes

**Client-side navigation for Home and Apps.** The FE intercepts
clicks on same-origin links to Home (`/`) and Apps (`/apps`) — the
shell nav links and any in-page links to those URLs. It fetches the
target as HTML (`Accept: text/html`, `credentials: 'same-origin'`,
`redirect: 'follow'`), parses it with `DOMParser`, and swaps the
current `<main>` content with the fresh one. It updates
`document.title` and the nav `aria-current` to match the fresh
document, pushes the new URL with `history.pushState`, and scrolls to
the top (like a native page load). Back/forward (`popstate`) fetches
and swaps the same way. Any failure — fetch error, parse failure,
missing `<main>`, cross-origin URL — lets the browser navigate
natively (a full page load). The enhancement never breaks navigation.

**A stable swap target.** `shellChrome` gains `id="os-main"` on the
`<main>` element, so the FE has a stable selector for the swap. This
is the only BE change to the served HTML: one attribute. The Store
(`#store`) and Edit (`#apps-edit`) swaps already use ids; this matches
that pattern.

**No bridge seed adoption is needed.** Home and Apps are list pages
(tiles/links). Their sections (`renderPinnedSection`,
`renderRecentSection`, `renderAllSection`) do not call
`renderStateSeed` or `renderAppSection`, so those pages carry no app
state seeds. The bridge has nothing to adopt on a Home ↔ Apps move.
App pages — which do carry seeds — stay full-load, so the seed
problem does not arise. This is why the scope stops at shell pages.

**Forms in swapped content keep working.** Home and Apps carry no
`form.app-action` (those are on app pages only). The forms they do
carry (Edit toggles, Store controls) are handled by
document-delegated `submit` listeners, which work for swapped-in
content automatically. No re-setup is needed after a swap.

**`os-*` elements upgrade automatically.** The shell defines them
once at load. Any `<os-*>` tag in swapped-in content upgrades when
it is inserted, since the definitions are already registered. No
re-definition is needed.

## Non-goals

- App pages (`/apps/:id`) — stay full-load. Client-routing them
  (with a full reload when the installed definition version changed)
  is a separate decision.
- Help (`/help`) and About (`/about`) — built-in shell pages, but
  low-traffic. Out of scope for this change; a follow-up if wanted.
- The App Store (`/apps/app-store`) — a data app. Its controls
  already swap in place; not part of this change.
- Reducing embedded HTML — a separate v5 FE item.
- Scroll restoration on back/forward — the first version scrolls to
  the top on every client-side navigation (forward and back), like a
  native page load.
- Full SPA — not the target (Nov 9 decision).

## Impact

- `pkg/src/client/index.ts` — the navigation enhancement (click
  interception, HTML fetch + swap, `pushState`/`popstate`). New
  code, in the FE, following the existing Store/Edit-toggle pattern.
- `pkg/src/app.ts` — `shellChrome` gains `id="os-main"` on `<main>`.
  One attribute in the served HTML; no route or content change.
- `pkg/AGENTS.md` and the adding-an-app SKILL.md — the navigation
  behaviour is recorded in the FE/BE boundary section (the FE may
  navigate shell pages client-side; the BE still renders every page
  as a full document).
- Canonical spec — a new "Client-side navigation for shell pages"
  requirement in `openspec/specs/shell/spec.md` (spec delta in this
  change).
- Tests — a new jsdom harness for the navigation (swap, title,
  `pushState`, `popstate`, fallback). The existing harnesses
  (catalog, store, counter, link-drop, lit-isolation) must stay
  green.
- Version — MINOR (new feature, nothing existing breaks). Target
  4.4.0, assuming fe-be-separation (4.3.1) lands first. The exact
  number depends on merge order.
- Scribe verification — navigate Home → Apps → Home on the Scribe
  and confirm the content swaps without a full reload (URL updates,
  title updates, no flash of a blank page). This is a specific
  Scribe behaviour (the point of the change is the feel on the
  Scribe), so a verify-on-Scribe task is appropriate here.

## Open questions

1. Should Help/About be included in client-side navigation, or stay
   full-load? (Leaning: stay full-load for this change; they are
   low-traffic.)
2. Should back/forward restore scroll position, or scroll to top
   like a native load? (Leaning: scroll to top for the first
   version; restoration is a refinement.)
