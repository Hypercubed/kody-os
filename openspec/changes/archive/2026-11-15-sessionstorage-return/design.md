# Design: sessionstorage-return

## Context

`from` is the shell's return address, and today it travels in the
URL and in a hidden form field. The full inventory, verified against
the tree at spec time (line numbers are pre-change):

**Renderers (`pkg/src/apps/client.ts`)**

- `tileItem` (line 286): tiles link to `/apps/<id>?from=<apps>`; modal
  tiles to `/apps/<id>?touch=1&from=<apps>`.
- `renderOverlaySection` (lines 243-244): the overlay panel's action
  forms carry `from=/apps#app-<id>` as their hidden field, and the
  modal-expand box links to `/apps/<id>?from=<apps>`.
- `renderHomeTiles` (line 488): home fallback list links to
  `/apps/<id>?from=</>`.
- `renderWidgetSection` (line 529): the widget expand box links to
  `/apps/<id>?from=</>`; line 516 renders the widget's action forms
  with `from=/`.
- `renderAppSection` (lines 139, 156-158) / `renderAppPanel` (lines
  195, 200): the `fromPath` parameter becomes the hidden
  `<input type="hidden" name="from">` in every action form.

**Server (`pkg/src/app.ts`)**

- `renderAppPage` (lines 605-612): `closeHref =
  safeNextPath(fromParam)`, label Apps / Home / Back by destination;
  the same value is passed into the panel as its form field.
- `appBody` (line 554): threads `fromParam` through; called with
  `query.get('from')` from the App Store branch (line 704) and the
  plain app-page branch (line 770).
- Touch (lines 721-727): `?touch=1` records the open in Recent,
  then 303s to `safeNextPath(from) + '#app-<id>'`.
- Action (lines 743-747, 766): `from` is stripped from the action
  arguments, and a successful action 303s to `safeNextPath(from)`
  (default the app page); a failed action from a widget
  (`from` present) re-renders the dashboard, otherwise the app page.
- Theme (lines 1113-1114): set/reset 303 back to
  `safeNextPath(from)` (default the app page).
- `safeNextPath` (line 465): the only validation — same-shell path,
  leading `/`, no `//`, no `\`, no `://`, no CR/LF, must sit under
  `appBasePath`.

**Client (`pkg/src/client/index.ts`)**

- The app-action fast path already fetches `?format=json` and
  patches state in place: a successful action never navigates and
  never uses `from`. `from` only matters on the native-submit
  fallback, on error, for touch/theme/close, and for the
  server-rendered close box.
- The shell chrome stamps `data-app-base` on `<html>`
  (`app.ts`, `shellChrome`), so the client can read the mount base
  without parsing links.

No catalog definition uses an action argument named `from`
(only `fromArg`, a different name), no bundle reads `from`, and no
MCP export takes or returns it. Removing it touches no app contract.

## Decisions

1. **Storage: one `sessionStorage` key, plain string value.**
   Key `kody-os:return`; value the return path exactly as a tile
   would have carried it (`/` for Home, `/apps` for Apps,
   `/apps#app-<id>` for an overlay return), mount prefix included.
   Rationale: a plain string keeps the read/write code trivial and
   the value inspectable in devtools; there is nothing else to
   store. One key (not per-app) is enough because the value is
   validated against the current app on read (Decision 4) — a
   stale fragment for another app is discarded, and a stale plain
   path (`/` or `/apps`) is a valid destination for any app.
2. **Write rule: store the current page on any app-link click.**
   A single delegated click listener on `document` matches links
   whose path is `<base>/apps/<id>` (tiles, widget expand, home
   tiles, overlay expand, menu links — one rule, no per-surface
   handlers) and, synchronously before navigation, stores
   `location.pathname + location.hash`. Rationale: the return is
   by definition "the page I came from", and the current page at
   click time is exactly that — including the overlay case, where
   the current page is `/apps#app-<id>` because the overlay is
   open, so the expand link needs no special case. Menu links are
   covered for free: opening an app from another app page stores
   that app page as the return.
3. **Read rule: app page only, validate, then set the close box.**
   On load, when a `section[data-app-id]` is present (an app page),
   the client reads the key, validates it (Decision 4), and sets
   the titlebar close box (`.os-titlebar a.os-box`) `href` and
   `aria-label`/`title` to Apps / Home / Back by the same rule the
   server used. The server renders the close box defaulting to
   Home, so before the client runs (or without JavaScript) the
   close box goes Home. Rationale: the close box is the only
   server-rendered element that needs the return; everything else
   that needed it (action redirect, touch, theme) either stays in
   place via the JSON fast path or takes a server default.
4. **Validation mirrors `safeNextPath`, plus a fragment guard.**
   A stored value is accepted only if: it is a string starting
   with `/`; it does not start with `//`; it contains no `\`, no
   `://`, no CR/LF; and it starts with the mount base read from
   `document.documentElement.dataset.appBase` (falling back to `/`
   when the attribute is absent). If it carries a `#app-<id>`
   fragment, `<id>` MUST equal the current app id (from
   `section[data-app-id]`); otherwise the fragment is dropped and
   the bare path is used if valid, else the value is discarded.
   Rationale: the client must not become an open redirect the
   server used to guard against — the rules are copied, not
   reinvented — and the fragment guard is what makes one shared
   key safe across apps (Decision 1).
5. **Legacy `?from=` is migrated once, then stripped.** On app-page
   load, a `from` query value, when present and valid under
   Decision 4, wins over the stored value, is written to storage,
   and is removed from the visible URL with
   `history.replaceState` (other query parameters preserved).
   Rationale: old bookmarks and shared links keep returning to
   their opener once, and the URL is clean from then on. This is
   the only use of the History API in the change: cleanup, not
   transport.
6. **Modal tiles keep the touch URL, minus `from`.** A modal tile's
   href becomes `/apps/<id>?touch=1`. With JavaScript the client
   intercepts the click, fetches `?touch=1&format=json`, and on
   success sets `location.hash = 'app-<id>'` to reveal the
   overlay without navigating. On fetch failure it falls through
   to the native touch URL, and the server 303s to
   `/apps#app-<id>`. Without JavaScript the native touch URL is
   the whole mechanism, unchanged in effect. Rationale: the touch
   round-trip exists because a fragment link alone never reaches
   the server, so the open would not count as used — that reason
   survives this change, and the touch destination is derivable
   server-side from the app id alone, so `from` adds nothing.
7. **Touch answers JSON when asked.** The touch handler gains a
   `format=json` branch returning `{ ok: true }` after recording
   the open (same `record_use`, same failure tolerance as the 303
   path: a failed record still answers success, as today). No
   other touch behavior changes. Rationale: the intercepting
   client needs an answer that is not a redirect to another page;
   fetching the 303 and following it would fetch the whole Apps
   page HTML for nothing.
8. **Server defaults replace `from` everywhere else.** Action
   success 303s to the app page; action error always re-renders
   the app page (the widget-dashboard error branch goes away);
   theme set/reset 303 to the app page; the App Store branch
   passes no return. Rationale: with the JSON fast path, a
   successful action does not navigate at all, so the server
   redirect is only the fallback path — and the fallback landing
   on the app page is the honest default, not a wrong page.
9. **Widget forms lose the hidden field; their return is the fast
   path.** Widget action forms submit to the same `act()` path
   with no `from`. With JavaScript they patch in place and stay
   on `/`, exactly as today. Without JavaScript a widget submit
   lands on the app page (success or error), per the accepted
   no-JS scope in the proposal. Rationale: there is no
   server-side way to tell a widget submit from an app-page
   submit once `from` is gone, and inventing a replacement marker
   would be `from` under another name.
10. **All storage access is guarded and silent on failure.**
    Every `sessionStorage` read/write is wrapped in try/catch,
    guarded by `typeof sessionStorage !== 'undefined'`, and any
    failure behaves as "no stored value" (close stays Home).
    Rationale: storage can throw (disabled storage, private mode,
    Scribe quirks) and a return address must never break the page.
11. **Delete `safeNextPath` and the `fromPath`/`fromParam`
    plumbing; keep ignoring `from` in action arguments.** Once
    nothing reads `from`, the validator, the parameters, and the
    hidden field are deleted rather than left as dead code — a
    leftover `from` reader would be a second, divergent return
    mechanism. The one exception: the action handler keeps
    excluding `from` from the arguments passed to `act()`, so a
    legacy `?from=` on an old action link is ignored instead of
    injected as an unexpected action argument. That exclusion is
    legacy tolerance, documented as such in a comment, not a
    feature.
12. **Rejected: `history.state` as transport.** A navigation
    creates a new history entry whose state is null, so the state
    cannot cross a normal link click. It would require client
    routing (fetch the page, swap the DOM, `pushState`), which is
    out of scope (see Non-goals). History is used only for the
    legacy-strip in Decision 5.
13. **Rejected: `localStorage`.** Shared across tabs and
    persistent: two tabs on different apps overwrite each other,
    and a value from yesterday can outlive the navigation that
    wrote it. `sessionStorage` is per-tab and dies with the tab,
    which matches "where did I come from in this tab".
14. **Rejected: a cookie.** A cookie would be server-visible
    without a URL, but it makes the return server state on every
    navigation, with the same cross-tab staleness as
    `localStorage`, and it would need a `Set-Cookie` on pages that
    today set none. The client already owns this value; keeping
    it client-side is simpler.
15. **Rejected: `history.back()` as the return.** It is correct
    only when the app was reached by navigation in the same tab.
    A bookmarked, deep-linked, or new-tab app page has nothing
    safe to go back to, and an intermediate navigation (menu link
    to another app) makes "back" mean something the opener never
    was. The stored path is explicit where back is a guess.
16. **Version: MINOR.** A new client capability; the server drops
    a query contract no bundle, definition, MCP export, or route
    depends on; old `?from=` links still open the app page and
    are migrated client-side. The no-JS close destination change
    is accepted per the user's 2026-11-09 direction (proposal);
    if that direction is withdrawn, revisit as MAJOR before
    implementing.

## Goals / Non-Goals

- Goals: plain `/apps/<id>` links; no `from` in any URL, form, or
  server redirect; close returns to the opener for JavaScript
  users, including the overlay return; old `?from=` links keep
  working once via migration; modal opens still count as used.
- Non-goals: client-side routing; `history.state` or
  `localStorage` or cookie transport; a no-JS return; changing
  what an action does, what `act()` accepts, or any definition,
  state, or MCP surface.

## Risks / Trade-offs

- [Risk] A stale stored value sends the close box somewhere the
  user did not come from (direct navigation after an earlier tile
  click in the same tab) → Mitigation: Decision 4's fragment
  guard kills the only harmful stale case (another app's
  overlay); a stale plain `/` or `/apps` is a valid shell root
  either way, and the close box is one tap from anywhere via the
  menu.
- [Risk] The click handler misses a navigation (middle-click,
  open-in-new-tab, long-press menu, keyboard-modified click) so
  no value is stored → Mitigation: the close box falls back to
  Home, and a new tab's `sessionStorage` may or may not carry a
  copy depending on the browser — the spec does not rely on it.
  This is a degraded close destination, not a broken page.
- [Risk] Storage throws on the Scribe (or is disabled) and the
  close box silently stays Home → Mitigation: Decision 10, guard
  everything; the Scribe verification task checks storage
  explicitly on the device.
- [Risk] The touch JSON fetch and the hash set race (user taps a
  second tile before the first fetch returns) → Mitigation: the
  fetch is for one app id and the hash set names that same id;
  a second tap supersedes the first by setting its own hash, and
  both opens are recorded. No shared mutable state is involved.
- [Risk] Deleting `safeNextPath` removes the server's open-redirect
  guard, and a future return mechanism reintroduces an unvalidated
  echo → Mitigation: the client validator (Decision 4) carries
  the same rules, and the tasks grep-verify no server echo of a
  request-supplied path remains.
- [Risk] `app-help-button` (open) lands first and the close-box
  work in this change has to account for the help box → Mitigation:
  none needed — help's close returns to the app/overlay, not the
  opener, and this change only sets the shell titlebar close box's
  href/label, which the help box does not touch.

## Migration Plan

None for stored data: no package-storage key changes, no
definition or state migration, no catalog work. The only
migration is in the browser: legacy `?from=` links are adopted
once on load (Decision 5) and old bookmarks keep opening the app
page. Server-side, `?from=` becomes an ignored query value on
app, action, and theme routes.

## Open Questions

1. **Should the stored value expire?** `sessionStorage` dies
   with the tab, and Decision 4 handles staleness within a tab,
   so no expiry is specified. If a long-lived tab accumulates a
   misleading plain value (e.g. opened from Home hours ago, then
   deep-linked to an app), the close box goes Home — arguably
   still right. An expiry timestamp is a later refinement if that
   ever proves wrong.
2. **Should menu-link clicks store the current page, or only
   tiles/widgets?** This spec says any app link (Decision 2),
   which makes a menu hop from one app page return to that app
   page. If that reads as wrong in review, the write rule can be
   narrowed to tiles/widgets/overlay-expand only, and menu clicks
   would leave the stored value untouched.
