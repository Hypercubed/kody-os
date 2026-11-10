# Spec Delta

## Purpose

Move the shell's return-to-opener from the URL (`?from=`) and the
hidden form field into `sessionStorage`, so app links are plain
`/apps/<id>`, action forms carry no return field, and the server
stops reading `from` entirely. Return navigation becomes a
JavaScript enhancement by explicit user direction (2026-11-09);
the rest of the no-JS baseline is unchanged.

## MODIFIED Requirements

### Requirement: Home launcher lists installed apps

The modal-tile part of this requirement changes as follows; the
rest (sections, tiles, empty states, overlays containing the same
section HTML) is unchanged. Each tile links to `/apps/<id>` — a
modal-capable app's tile links to `/apps/<id>?touch=1`, which the
server answers by recording the open and sending the browser to
the overlay (`/apps#app-<id>`); with JavaScript the shell client
intercepts the click, fetches `?touch=1&format=json`, and reveals
the overlay by setting the fragment without a navigation. The
overlay SHALL contain the same section HTML as the app page
(bundle UI, live state, action forms), fully present in the
server-rendered HTML; JS may enhance it.

#### Scenario: Modal tile opens overlay without leaving the Apps page
- **WHEN** a modal-capable app's tile is followed with JavaScript running
- **THEN** the overlay section becomes visible on the Apps page (no navigation), showing current state with working forms, and the back link hides it again.
- **WHEN** the same tile is followed with JavaScript disabled or the touch fetch fails
- **THEN** the browser navigates to the touch URL and the server redirects it back to the Apps page with the overlay fragment, and the open is recorded in Recent either way.

### Requirement: App pages render definition plus live state

The action-redirect part of this requirement changes as follows;
the rest (one title per app view, description and state rendering,
action forms) is unchanged. A valid action SHALL complete as a
plain form submission + redirect to the app page. The client fast
path MAY complete it in place with no navigation, as before.

#### Scenario: Bad action re-renders with an error
- **WHEN** a form posts an invalid action or args
- **THEN** the shell responds 400 and re-renders the same app page with an inline `role="alert"` error, and stored state is unchanged.

#### Scenario: Valid action redirects (PRG)
- **WHEN** a form posts a valid action
- **THEN** the shell applies it and responds 303 redirecting to the app page, which shows the new state.

### Requirement: Single shared chrome

The close-box part of this requirement changes as follows; the rest
(menu strip, main content, footer, clock, document title) is
unchanged. The titlebar close box on an app page SHALL return to
the opener (`/` or `/apps`, or `/apps#app-<id>` for an app expanded
from a modal overlay), carried in `sessionStorage` under key
`kody-os:return` and applied by the shell client; with no stored
value it SHALL go Home. The server SHALL render the close box
defaulting to Home and SHALL NOT read a `from` query value. The
dashboard at `GET /` SHALL omit the close box (it already is
home) and every other page SHALL show it.

#### Scenario: Close returns to the opener
- **WHEN** an app opened from the Apps page is closed via the titlebar box with JavaScript running
- **THEN** the browser lands on the Apps page, not Home.

#### Scenario: Close from Home returns Home
- **WHEN** an app opened from a home widget is closed via the titlebar box with JavaScript running
- **THEN** the browser lands on Home.

#### Scenario: Close from an overlay returns to the overlay
- **WHEN** an app expanded from a modal overlay is closed via the titlebar box with JavaScript running
- **THEN** the browser lands on the Apps page with that app's overlay open.

#### Scenario: No stored return goes Home
- **WHEN** an app page is opened by direct navigation, bookmark, or a new tab with no stored return, or with JavaScript disabled
- **THEN** the close box links Home.

#### Scenario: A legacy from value is adopted once, then gone
- **WHEN** an app page is opened with a `?from=` value in the URL
- **THEN** the client stores the validated value, the close box returns to it, and the visible URL no longer carries `from` after load; the server ignores the value entirely.

### Requirement: Pages are server-rendered

The redirect-destination part of this requirement changes as
follows; the rest (plain submission + redirect, client fast path
with native-submit fallback, no `kody:`/`node:` imports) is
unchanged. Every action SHALL complete as a plain form submission
+ redirect to the app page. The client module (`src/client/index.ts`)
MAY enhance forms in place when `fetch` is available and MUST fall
back to native submit on any failure. Rendered links and forms
SHALL NOT carry a return address in the URL or a hidden field.

#### Scenario: Plain increment round-trips without the fast path
- **WHEN** the fetch fast path is unavailable or fails and the Increment form is submitted
- **THEN** the form submits natively and the server responds 303 to the app page, which shows the incremented count.

#### Scenario: Stored key keeps links clean
- **WHEN** the enhancement runs with a stored key and the server accepts it
- **THEN** subsequent pages render without `?k=` in links while native-submit fallback keeps working with `?k=` stamped.

### Requirement: Capability-gated theme routes for apps

The redirect part of this requirement changes as follows; the rest
(read/set/reset routes, capability gates, plain-404 failures, no
POST route) is unchanged. Set / reset SHALL return JSON
`{ ok: true, override, effective }` when `format=json` is present,
and otherwise 303 back to the app's page. No `from` value is read
on any theme route.

#### Scenario: No-JS set round-trips
- **WHEN** a plain GET form submits a set to a theme route without JavaScript and without `format=json`
- **THEN** the server responds 303 back to the app's page, and the next render shows the new effective theme.

## ADDED Requirements

### Requirement: Return-to-opener via sessionStorage

The shell client SHALL carry the return-to-opener in
`sessionStorage` under the single key `kody-os:return`, holding
one plain-string return path (`/` for Home, `/apps` for Apps, or
`/apps#app-<id>` for a modal-overlay return), mount prefix
included. The client SHALL write the value synchronously on any
shell link to `/apps/<id>` (tiles, widget expand links, home-tile
links, overlay expand links, menu links), storing the current
page (`location.pathname + location.hash`) before the navigation.
On an app page the client SHALL read the value, validate it, and
set the titlebar close box href and label (Apps when it equals
the Apps path, Home when it equals the home path, Back otherwise).
The server SHALL NOT read, render, or redirect on any return
value: no `?from=` on any link, no hidden `from` field in any
form, no `from` input to any redirect.

The stored value SHALL be accepted only when: it is a string
starting with `/`; it does not start with `//`; it contains no
`\`, no `://`, no CR/LF; and it starts with the mount base from
the `<html>` element's `data-app-base` attribute (falling back to
`/` when absent). A `#app-<id>` fragment SHALL be kept only when
`<id>` equals the current app id; otherwise the bare path is used
when valid, else the value is discarded and the close box stays
Home. Every `sessionStorage` access SHALL be guarded
(`typeof sessionStorage !== 'undefined'`, try/catch) and any
failure SHALL behave as no stored value. The client SHALL NOT use
`localStorage`, a cookie, or `history.state` to carry the return.

#### Scenario: Tile from Apps stores Apps, close returns there
- **WHEN** an app tile on the Apps page is followed
- **THEN** the app page's close box links to the Apps page with label Apps.

#### Scenario: Expand from Home stores Home, close returns there
- **WHEN** a home widget's expand box is followed
- **THEN** the app page's close box links Home with label Home.

#### Scenario: Expand from an overlay stores the overlay
- **WHEN** an app is expanded from its modal overlay
- **THEN** the app page's close box links to the Apps page with that app's overlay fragment, and following it reopens the overlay.

#### Scenario: A stale fragment for another app is discarded
- **WHEN** the stored value carries `#app-<other-id>` for an app other than the one open
- **THEN** the close box links to the bare stored path, or Home when the bare path is invalid.

#### Scenario: A hostile stored value is rejected
- **WHEN** the stored value is an absolute URL, protocol-relative, or contains a backslash or line break
- **THEN** the close box stays Home and no navigation to the stored value occurs.

#### Scenario: Storage failure leaves the page working
- **WHEN** `sessionStorage` throws on read or write
- **THEN** the app page renders normally and the close box stays Home.
