# Design: client-side navigation for shell pages

## Context

| File | Side | Role |
| ---- | ---- | ---- |
| `pkg/src/app.ts` | Kody (BE) | Fetch handler + `shellChrome` builds the HTML document. Routes: `GET /` (Home), `GET /apps` (Apps), `GET /apps/:id` (app page), `GET /help`, `GET /about`. |
| `pkg/src/apps/render.ts` | Kody (BE) | Renders app-section HTML server-side. `renderPinnedSection`, `renderRecentSection`, `renderAllSection` (list pages) do NOT call `renderStateSeed` or `renderAppSection` — Home/Apps carry no app state seeds. |
| `pkg/src/client/index.ts` | Browser (FE) | Shell client entry: loads the bridge, defines `os-*` elements, enhances forms. Already has the in-place HTML-swap pattern (Store controls swap `#store`, Edit toggles swap `.edit-list`, via `DOMParser` + `fetch`, falling back to native submit). Header comment states "no client routing" — this change adds it. |
| `pkg/src/client/bridge.js` | Browser (FE) | Bridge store. Reads state seeds (`script[data-kody-state-seed]`) at mount. Not involved in Home/Apps navigation (no seeds on those pages). |

## Decisions

### Decision 1: Intercept shell-page link clicks, fetch HTML, swap `<main>`

The FE intercepts clicks on same-origin links whose path is exactly
Home (`/` under the app base path) or Apps (`/apps`). It fetches the
target as HTML (`Accept: text/html`, `credentials: 'same-origin'`,
`redirect: 'follow'`), parses it with `DOMParser`, and swaps the
current `<main>` content with the fresh document's `<main>` content.
It updates `document.title` and the nav `aria-current` to match the
fresh document, calls `history.pushState` with the new URL, and
scrolls to the top. Back/forward (`popstate`) fetches and swaps the
same way.

This reuses the existing Store/Edit-toggle pattern (fetch HTML +
`DOMParser` + swap one section + fall back to native on any
failure). It does not introduce a framework, a router library, or a
JSON page-data endpoint. The BE still renders every page as a full
HTML document; the FE just reuses that document instead of letting
the browser reload it.

**Alternatives considered:**
- A JSON page-data endpoint (BE returns page data, FE renders it).
  Rejected: it would require the FE to render the shell chrome and
  list sections client-side, which is a larger change and moves
  toward the full SPA. Fetching the already-rendered HTML reuses
  the BE's rendering and keeps the change small.
- A client-side router library. Rejected: no framework is needed;
  two routes and a swap are a few dozen lines following an existing
  pattern.

### Decision 2: Scope is Home and Apps only

Only Home (`/`) and Apps (`/apps`) are client-routed. App pages
(`/apps/:id`) stay full-load — they carry app state seeds and full
app panels, and client-routing them (with a full reload when the
installed definition version changed) is a separate decision.
Help/About stay full-load for this change (low-traffic, follow-up if
wanted). The App Store is a data app and is not part of this change.

This scope is what makes the change safe: Home and Apps are list
pages with no app state seeds, so no bridge seed adoption is needed,
and no `form.app-action` setup is needed (those forms are on app
pages only). The only forms on Home/Apps (Edit toggles, Store
controls) are document-delegated, so they work in swapped-in content
automatically.

### Decision 3: `id="os-main"` on `<main>` as the stable swap target

`shellChrome` gains `id="os-main"` on the `<main>` element. The FE
swaps by `getElementById('os-main')` in both the current and the
fresh document. This matches the Store (`#store`) and Edit
(`#apps-edit`) swaps, which use ids. It is the only BE change to the
served HTML (one attribute). The alternative — `querySelector('main')`
— works (there is exactly one `<main>`), but an id is explicit and
robust against future markup changes.

### Decision 4: Fall back to native navigation on any failure

Any failure — fetch error, non-OK response, parse failure, missing
`<main>` in either document, cross-origin URL, or a missing
`history.pushState` — lets the browser navigate natively (a full
page load). The click handler does not `preventDefault()` until it
has confirmed the URL is a same-origin shell-page link; on any error
after that, it sets `window.location` to the target (a full load).
This matches the existing enhancement pattern (every FE enhancement
falls back to native on failure) and guarantees navigation never
breaks.

### Decision 5: Scroll to top on every client-side navigation

On a forward navigation (link click) and on back/forward
(`popstate`), the FE scrolls to the top after swapping. This matches
a native page load. Scroll restoration on back/forward (returning to
the previous scroll position) is a refinement, not part of this
change.

### Decision 6: Version MINOR

Client-side navigation is a new feature and nothing existing breaks
(the fallback is a native navigation). Per the package policy that is
MINOR. Target 4.4.0, assuming fe-be-separation (4.3.1) lands first.
The exact number depends on merge order. Build +1 on publish.

### Decision 8: Widget fallback (CodeRabbit review, Nov 14, 2026)

A page whose `#os-main` contains a bundle section
(`section[data-app-id]`, i.e. a Home widget) is never swapped in.
The widget's bundle script must run to mount the bundle, and scripts
in swapped HTML do not execute, so swapping such a page would leave
the widget showing static markup with dead controls. The navigation
code checks the fresh `#os-main` for a bundle section before
swapping; if one is present, it falls back to a native full load so
the bundle mounts. The Apps page carries no bundle sections (it is a
list of tiles), so it swaps normally. Home swaps only when it has no
widgets; Home with widgets loads fully. This corrects the earlier
claim that "Home/Apps carry no bundles" — Home widgets DO carry
bundles.

### Decision 9: Navigation ownership token (CodeRabbit review, Nov 14, 2026; refined Nov 15, 2026)

Overlapping navigations are discarded. Each navigation attempt
(click, popstate) takes an incrementing sequence number, and a
response (or failure) from an older navigation is ignored once a
newer one has started. A same-page click also increments the
sequence, cancelling any pending navigation — the user is staying
here, so a stale response must not swap in another page afterwards.
Without this, clicking Apps then Home before the Apps response
arrives would leave the Apps content under the Home URL.

Refinement (Nov 15, CodeRabbit follow-up): a same-page click is
judged against the *rendered* page, not the URL. A Back navigation
changes the URL immediately while the old page is still rendered,
so during a pending Back to Home the URL already says Home while
Apps is still displayed — a click on the Home link is then a click
to the page being navigated to, not a same-page click, and cancelling
the pending Home navigation would leave Apps displayed under the
Home URL. The client therefore tracks the rendered page
(`renderedUrl`) separately from the URL, and the in-flight
navigation's target (`pendingUrl`). A click on a link to a URL that
is already being navigated to does nothing (the pending navigation
is allowed to finish); a click on the rendered page cancels any
pending navigation and restores the browser URL to the rendered
page; anything else starts a navigation.

Refinement (Nov 15, CodeRabbit follow-up `r4576655058`): a
same-page cancel restores the browser URL to the rendered page.
Cancelling the pending navigation stops the fetch but does not by
itself fix the URL, which Back already changed to the destination.
Without the restore, the old page stays displayed under the
destination URL — the state this design says must not occur. The
cancel branch therefore calls `history.replaceState` with the
rendered page URL when the current URL differs from it; when the
URLs already match, the call does nothing.

### Decision 10: pushState failure falls back to native navigation (CodeRabbit review, Nov 14, 2026)

If `history.pushState` throws after the swap, the handler does a
native navigation to the requested URL instead of leaving the new
content under the old URL. Reload and Back would otherwise operate
on the wrong history entry. The documented fallback (a full load on
any failure) requires it.

### Decision 11: Chrome Close box syncs on a swap (user-reported bug, Nov 14, 2026)

The swap replaces `#os-main` only, so the shell chrome outside it —
including the titlebar Close box (`.os-titlebar a.os-box`) — keeps
the previous page's destination. After closing an app to a shell
page, the stale box points at the page just rendered, and the
same-page check swallows the click: the Close button appears dead.
(The panel Close box lives inside `#os-main`, so it is swapped with
the content; only the chrome box needs syncing.)

The post-swap step (`syncNavCurrent`) now also syncs the chrome
Close box from the fetched page: it copies `href`, `aria-label`,
and `title` when both pages have one; inserts a copy before the
title when the destination has one and the current page does not
(e.g. Home -> Apps); and removes it when the destination has none
(e.g. Apps -> Home, where Home renders no Close box). A sync
failure never breaks navigation, matching the nav sync.

### Decision 7: Post-swap step (research, Nov 14, 2026)

After swapping `<main>`, the FE runs a post-swap step. It updates
`document.title` and the nav `aria-current`, and scrolls to the top.
That step is also the hook where seed adoption would go: if a future
shell page carries JSON state-seed scripts
(`script[data-kody-state-seed]`), the step would read them from the
fresh document and hand them to the bridge. Home/Apps carry no
seeds, so no seed adoption is implemented in this change — the hook
is the post-swap step itself, not a separate mechanism.

Two facts from the research shape this step. First, scripts in
swapped HTML do not execute (per the HTML spec, `innerHTML` and
`DOMParser`-moved nodes never run scripts), so all behaviour stays
in the persistent bundle and a seed would have to be read explicitly
from the parsed document (`querySelector` + `JSON.parse`) — it
cannot be relied on to "run". Second, islands inside `<main>` are
destroyed on a swap, so any state an island holds only inside itself
is lost unless it lives in the bridge (outside `<main>`) or is
re-derived from the new page's seed in the post-swap step.

Custom elements in the swapped content upgrade automatically (their
definitions are already registered), so no re-definition is needed —
and re-defining a tag throws, so the definitions must stay in the
persistent bundle loaded once per full page load. `connectedCallback`
can run more than once (an element moved or re-inserted), so island
setup must be idempotent; `os-stepper` already guards this with its
`_cleared` flag, and any future `os-*` element must do the same.
Islands must tear down global listeners, timers, and observers in
`disconnectedCallback`, since the old `<main>`'s islands are
disconnected on a swap and anything they registered on
`window`/`document` would otherwise leak or double-fire.

## Layout

```
pkg/src/
  app.ts                  # shellChrome gains id="os-main" on <main> (one attribute)
  client/
    index.ts              # + navigation enhancement (click interception,
                          #   HTML fetch + <main> swap, pushState/popstate)
                          #   Existing: bridge load, os-* definitions,
                          #   app-action fast path, Store/Edit swaps,
                          #   clock, widget tick
    bridge.js             # unchanged (no seeds on Home/Apps)
    os-elements.ts        # unchanged (definitions already registered;
                          #   swapped-in <os-*> tags upgrade automatically)
    os-stepper.ts         # unchanged
```

The navigation code lives in `index.ts` alongside the other
enhancements (it is FE code, in the FE entry). It does not import
any BE module and does not read `packageStorage`. It uses only
`fetch`, `DOMParser`, `history.pushState`, and DOM APIs — all
available under the ES2019 ceiling.

## Risks

- **A swap that leaves the page half-updated.** If the fetch
  succeeds but the swap fails partway (e.g. `<main>` missing in the
  fresh document), the page could be left in a broken state.
  Mitigation: validate the fresh document (has `<main>` with
  content, has a `<title>`) BEFORE swapping anything, and fall back
  to native navigation if validation fails. The swap itself is a
  single `innerHTML` assignment, so it is atomic.
- **State lost when an island is destroyed.** Islands inside
  `<main>` are destroyed on a swap. Any state an island holds only
  inside itself (input values, open/closed, fetched data) is lost
  unless it lives in the bridge (outside `<main>`) or is re-derived
  from the new page's seed in the post-swap step (Decision 7).
  Home/Apps currently carry no islands with state, so this is a
  future-proofing concern, not a blocker for this change.
- **A `connectedCallback` that is not idempotent.** An element
  moved or re-inserted runs `connectedCallback` again. If setup is
  not guarded, listeners double-fire (e.g. a form submitting
  twice). Mitigation: `os-stepper` already guards with its
  `_cleared` flag; any future `os-*` element must do the same, and
  global listeners/timers/observers must be torn down in
  `disconnectedCallback`.
- **Stale `aria-current` or title.** If the nav/title update is
  missed, the page shows the wrong current-page indicator or title.
  Mitigation: update title and `aria-current` from the fresh
  document in the same step as the swap, and cover it in the
  harness (assert title and `aria-current` after a navigation).
- **A form in swapped content that is not enhanced.** Home/Apps
  carry no `form.app-action`, and their Edit/Store forms are
  document-delegated. If a future change adds an `app-action` form
  to Home/Apps, the navigation code would need to re-run the
  app-action setup after a swap. Recorded as a known limitation in
  the close-out, not handled in this change.
- **The `popstate` handler firing on a hash change.** `pushState`
  with the same URL plus a fragment, or a fragment-only link, can
  fire `popstate` in some browsers. Mitigation: the `popstate`
  handler ignores events where the URL path is unchanged from the
  current page (only the fragment changed), letting the browser
  handle fragment scrolling natively.
- **Double-fetch on back/forward.** The browser may have the page
  in its back-forward cache (bfcache), so a `popstate` fetch could
  be redundant. This is acceptable for the first version (a fetch
  is cheap and the result is correct); bfcache interaction is a
  refinement.

## Open questions

1. Should Help/About be included in client-side navigation, or stay
   full-load? (Leaning: stay full-load for this change.)
2. Should back/forward restore scroll position, or scroll to top?
   (Leaning: scroll to top for the first version.)

## Verification

- Typecheck clean (`cd pkg && bun run typecheck`, exit 0).
- New jsdom harness (`tests/client-nav.cjs`, run with node +
  `JSDOM_PATH`): loads a Home page, clicks the Apps link, and
  asserts the `<main>` content swaps, `document.title` updates,
  the nav `aria-current` moves to Apps, `history.pushState` was
  called with `/apps`, and no full navigation happened. A
  `popstate` case (back to Home) and a fallback case (fetch fails
  → native navigation) are covered.
- Existing harnesses green: counter-tests, link-drop-tests,
  link-drop-dom-tests, lit-isolation, catalog harness (19 apps),
  store harness. (hoodie-tests and home-widget-counter have
  pre-existing failures, verified on the base — see
  fe-be-separation close-out; they are not caused by this change.)
- Scribe verification: navigate Home → Apps → Home on the Scribe
  and confirm the content swaps without a full reload (URL updates,
  title updates, no blank flash). This is a specific Scribe
  behaviour, so a verify-on-Scribe task is included.
- `openspec validate` passes for this change.
