# Proposal

## Why

Every app link in the shell carries its return address in the URL as
`?from=/apps` or `?from=/`, and every app action form carries it again
as a hidden `from` field. The parameter exists for one job: after an
action, or when the titlebar close box is used, send the browser back
to the page the app was opened from (Home or Apps, or the modal
overlay it was expanded from). It works, but it leaks navigation
state into every link, every form, and every shared or bookmarked
app URL, and the server has to validate and thread it through five
separate places (`app.ts` close box, action redirect, touch
redirect, theme redirect, and the App Store branch) plus the hidden
form field in `client.ts`.

The return address is browser state, not server state: the server
never needs it except to echo it back as a redirect. This change
moves it into `sessionStorage`, written by the shell client when an
app link is followed and read back on the app page to set the close
box. App links become plain `/apps/<id>`, action forms lose the
hidden `from` field, and the server stops reading `from` entirely.

## What Changes

**Client — return is stored on navigation, read on arrival.**
`sessionStorage` key `kody-os:return` holds one plain-string return
path (`/`, `/apps`, or `/apps#app-<id>` for an overlay return). A
delegated click handler in the shell client (`pkg/src/client/index.ts`)
stores the current page (`location.pathname + location.hash`) before
following any shell link to `/apps/<id>` — tiles, widget expand
links, home-tile links, overlay expand links, and menu links all
follow the same rule, so there is no per-surface bookkeeping. On an
app page the client reads the stored value, validates it with the
client-side mirror of the server's `safeNextPath` rules, and sets
the titlebar close box href and label (Apps / Home / Back). A legacy
`?from=` still present in a bookmarked or shared URL wins over the
stored value, is stored, and is then stripped from the visible URL
with `history.replaceState`.

**Server — `from` is removed, destinations become defaults.** Tile,
widget-expand, home-tile, and overlay-expand links render as plain
`/apps/<id>`. The hidden `from` field leaves the action forms. The
action handler's redirect default becomes the app page itself
(`/apps/<id>`), which is what a successful in-place (JSON fast-path)
action already amounts to. The close box defaults to Home. The
modal touch redirect is derived server-side (`/apps#app-<id>`)
instead of echoed from `from`. Theme set/reset default back to the
app page. `safeNextPath` is deleted once nothing reads it; its
validation rules live on as the client-side validator. A `from`
query value arriving on an old link is ignored by the server (and
kept out of action arguments), never acted on.

**Modal tiles — touch without `from`, recorded via JSON.** A modal
tile's href stays the touch URL (`/apps/<id>?touch=1`), so opening
a modal still reaches the server and counts as used with no
JavaScript. With JavaScript the client intercepts the click,
fetches `?touch=1&format=json` (new: the touch handler answers
JSON), and sets `location.hash` to open the overlay without a
navigation. If that fetch fails, the click falls through to the
native touch URL and the server 303s to the overlay as today.

**No-JS scope — return navigation becomes JS-only, by direction.**
The user directed on 2026-11-09 that the no-JavaScript fallback is
not a requirement for this change. That narrows, but does not
remove, the shell's no-JS baseline: plain action submission,
fragment expand/collapse, and `:target` overlays still work without
JavaScript, and modal open still works via the touch redirect. What
changes without JavaScript is only the return: the close box goes
Home (the server default), a native widget submit lands on the app
page instead of the dashboard, and a native app action lands on the
app page instead of the opener. This is recorded here so a future
reader does not "fix" it back silently; if the no-JS return is ever
reinstated as a requirement, the version call below must be
revisited.

## Capabilities

### New Capabilities

- `sessionstorage-return`: return-to-opener carried in
  `sessionStorage` (`kody-os:return`), set on app-link click and
  applied to the app-page close box by the shell client, with
  legacy `?from=` migration on load.

### Modified Capabilities

- `shell`: tile, widget-expand, home-tile, and overlay-expand
  links lose `?from=`; the action redirect, close box, touch
  redirect, and theme redirect lose their `from` inputs; the
  `?from=` query value is ignored server-side.
- `widget-home`: widget action forms lose the hidden `from`
  field; the dashboard return on widget actions is the JS fast
  path staying in place, and the native-submit fallback lands on
  the app page.

## Impact

- Code: `pkg/src/client/index.ts` (click handler, app-page read,
  client-side validator, touch intercept, legacy `?from=`
  migration); `pkg/src/app.ts` (drop `fromParam` from `appBody` /
  `renderAppPage`, action dest, touch dest + `format=json`, theme
  dest, App Store branch, delete `safeNextPath`); `pkg/src/apps/client.ts`
  (drop `?from=` from `tileItem`, `renderOverlaySection`,
  `renderHomeTiles`, `renderWidgetSection`; drop the `fromPath`
  parameters and hidden field from `renderAppSection` /
  `renderAppPanel` / `renderOverlaySection` / `renderWidgetSection`).
- Data: none. No stored definition, state field, storage key, or
  catalog entry changes. `sessionStorage` is per-tab browser state
  that dies with the tab; nothing is written to package storage.
- Version: MINOR at implementation — a new client capability with
  the server `from` contract removed; no bundle, definition, MCP
  export, or route depends on `from`, and old `?from=` links still
  open the app page (the client migrates them on load). The
  no-JS close destination changes (opener to Home), which would
  otherwise push this to MAJOR; it stays MINOR only because the
  user explicitly waived the no-JS return for this change
  (2026-11-09, recorded above). If that waiver is withdrawn, the
  version call must be revisited before implementation. This
  spec-only change bumps nothing, and build increments by one only
  on a Kody publish, per `pkg/AGENTS.md`.
- BREAKING: none within the new contract. Outside it, one accepted
  degradation: without JavaScript the close box returns Home
  instead of the opener, and a native widget submit lands on the
  app page instead of the dashboard (see "No-JS scope" above).

## Dependencies

None. The change touches only the shell client and the shell's
server render/redirect paths. It does not depend on any open change,
and no open change depends on it. It is independent of
`app-help-button` (open): that change adds a header box whose close
link returns to the app page / overlay, not to the opener, so the
two do not interact; if help lands first, this change's close-box
work picks up the help box's presence with no extra step.

## Non-goals

- Client-side routing: no fetch-and-swap page loads, no
  `history.pushState` navigation. Links still navigate normally;
  only the return address moves to storage.
- `history.state` as the transport: a new history entry starts
  with null state, so it cannot carry the return across a normal
  link click without client routing (see design).
- `localStorage`: shared across tabs and persistent, so a stale
  value from another tab could send the close box to the wrong
  page (see design).
- A cookie return: server-visible without a URL, but stateful on
  every navigation with the same cross-tab staleness (see design).
- Reinstating a no-JS return: out of scope by the direction above.
- Release or publish steps. The release decision stays the user's.
