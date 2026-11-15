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

The shell SHALL render a home page at `GET /` showing the widget dashboard (see widget-home), and the Apps grid — Pinned, Recent, and All-apps sections, as a launcher, plus Edit mode — SHALL live behind the Apps menu link instead of at `/`. Launcher management (pin, hide, home) lives in Apps Edit (see below); catalog management (install, update, restore) lives in the App Store data app (see App Store page below). Deep links at `/apps/:id` SHALL be unchanged. The Apps page SHALL render the three sections in order: Pinned (user-chosen tiles, omitted when empty), Recent (behavior-driven tiles with a Clear control, omitted when empty), and All apps (every installed app except hidden ones; pinned apps included). Each tile links to `/apps/:id` — except modal-capable apps, whose tiles link to `/apps/:id?touch=1`, which the server answers by recording the open and sending the browser to the inline overlay section on the Apps page (`/apps#app-<id>`), opened by fragment via CSS `:target` and closed by a back link; with JavaScript the shell client intercepts that click, fetches `?touch=1&format=json`, and reveals the overlay by setting the fragment without a navigation. The overlay SHALL contain the same section HTML as the app page (bundle UI, live state, action forms), fully present in the server-rendered HTML; JS may enhance it. Every tile SHALL show the app's icon glyph or sanitized SVG mark and label. A fresh install SHALL open with an empty registry — no apps are seeded, including no App Store; with no apps installed, both `/` and the Apps page SHALL render the same Help-style help text with two copy-paste prompts (install the App Store, agent-only via the App Store folder; add your own apps) instead of an empty tile list, rendered from the same shared shell block. With apps installed but none on Home, `/` SHALL instead show a short message prompting the user to add apps to Home from the Apps page via Apps Edit's Add to home control.

#### Scenario: Empty registry is honest
- **WHEN** no apps are installed
- **THEN** both `/` and the Apps page respond 200 with honest empty states and guidance toward adding apps.

#### Scenario: Empty Apps page shows two prompts
- **WHEN** the Apps page is fetched with no apps installed
- **THEN** it shows Help-style help text with a prompt for adding your own apps first and a prompt for installing the App Store second, each as selectable text in a gate-hint code block, with no copy button and no Clipboard API use, and with no Edit button. The App Store prompt is agent-only: it points at the App Store folder (`https://github.com/Hypercubed/kody-os/tree/main/catalog/app-store`) and stops there, with no inline install steps; it SHALL NOT name a browser install path.

#### Scenario: Empty Home page shows the same help
- **WHEN** `/` is fetched with no apps installed
- **THEN** it shows the same help text as the Apps page — same intro, same two prompts — rendered from the same shared shell block, not a second copy.

#### Scenario: Home with apps but none on Home prompts Add to home
- **WHEN** `/` is fetched with at least one app installed and an empty homepage list
- **THEN** it shows a short message prompting the user to add apps to Home from the Apps page via Apps Edit's Add to home control, and it does NOT show the two install prompts.

#### Scenario: Apps page offers Edit mode
- **WHEN** the Apps page is fetched with at least one app installed
- **THEN** the All apps header shows an Edit button (a GET form, matching the Clear control); with no apps installed it shows no Edit button.

#### Scenario: Landing is the dashboard
- **WHEN** apps are pinned to the homepage
- **THEN** `/` shows their live widgets, and the Apps grid (with pins on top) is one menu tap away.

#### Scenario: Sections render in order with an app installed and pinned
- **WHEN** one app is installed, pinned, and acted on
- **THEN** the Apps page shows it in Pinned, in Recent, and in All apps, in that section order.

#### Scenario: Modal tile opens overlay without leaving the Apps page
- **WHEN** a modal-capable app's tile is followed with JavaScript running
- **THEN** the overlay section becomes visible on the Apps page (no navigation), showing current state with working forms, and the back link hides it again.
- **WHEN** the same tile is followed with JavaScript disabled or the touch fetch fails
- **THEN** the browser navigates to the touch URL and the server redirects it back to the Apps page with the overlay fragment, and the open is recorded in Recent either way.

#### Scenario: Unified app renders UI plus state
- **WHEN** a unified app page is fetched
- **THEN** bundle UI, live state, and action forms all render in the single panel with no template branch.

#### Scenario: SVG tile renders mark
- **WHEN** an app with a sanitized SVG icon is listed
- **THEN** the tile shows the SVG mark at icon size with no color or animation.

### Requirement: App pages render definition plus live state
The shell SHALL render one page per app at `GET /apps/:id` showing the app's title (in the shell window's titlebar only — the panel itself SHALL NOT repeat a title header), its description when present, every state field, and one HTML form button per declared UI action. Unknown ids SHALL return the 404 page. Modal overlays SHALL keep the panel's own title header, since the underlying page chrome shows the Apps title, not the app's. The app page titlebar SHALL additionally carry a page-mode expand control at the far right, opposite the close box (see `App page expands to fill the window`). A valid action SHALL complete as a plain form submission + redirect to the app page; the client fast path MAY complete it in place with no navigation.

#### Scenario: Bad action re-renders with an error
- **WHEN** a form posts an invalid action or args
- **THEN** the shell responds 400 and re-renders the same app page with an inline `role="alert"` error, and stored state is unchanged.

#### Scenario: Valid action redirects (PRG)
- **WHEN** a form posts a valid action
- **THEN** the shell applies it and responds 303 redirecting to the app page, which shows the new state.

#### Scenario: Exactly one title bar per app view
- **WHEN** an app page is fetched
- **THEN** the rendered HTML contains exactly one title header for the app (the shell window's), and the panel body starts directly with the description or first state field.
- **WHEN** a modal overlay for the same app is rendered
- **THEN** the overlay panel retains its own title header, since the underlying page chrome does not name the app.

### Requirement: Single shared chrome

Every page SHALL use the same chrome: title bar with the page title and a close box (labeled with its destination, omitted on the dashboard); menu strip with the left cluster of brand mark plus product name from `settings.json` (default `kody-os`) followed immediately by Home and Apps links, then the menu-app links specified in `Top menu bar links`, then the built-in Help and About links when their pages are enabled (no Refresh link); main content; footer with status text and no home navigation — and NO auth path element, because the shell performs no access check and there is no `via kody` / `locked` to report; `data-pak-config` carrying the current phase; and a right-aligned date and time (server-rendered UTC on each navigation; a client tick SHALL keep it live in the browser's local time zone where JavaScript runs). The titlebar close box on an app page SHALL return to the opener (`/` or `/apps`, or `/apps#app-<id>` for an app expanded from a modal overlay), carried in `sessionStorage` under key `kody-os:return` and applied by the shell client; with no stored value it SHALL go Home. The server SHALL render the close box defaulting to Home and SHALL NOT read a `from` query value. The dashboard at `GET /` SHALL omit the close box (it already is home) and every other page SHALL show it. The document title SHALL read `{page} · {title}` where `{title}` is the theme title when set, else the theme name. Body background and header mark SHALL likewise render from the settings file with current values as defaults.

#### Scenario: Unknown routes keep the chrome
- **WHEN** a request hits an unknown path
- **THEN** the shell responds 404 inside the full chrome with plain "Not found." text and no home link in the body; the titlebar close box is the way back.

#### Scenario: Header order and clock
- **WHEN** any page is fetched
- **THEN** the header reads brand, Home, Apps left to right with no Refresh link, then any installed menu-app links in label order, then the built-in Help and About links when enabled, and shows a date + time on the far right.

#### Scenario: Defaults preserve current rendering
- **WHEN** no settings file is present
- **THEN** title, brand, and background are byte-identical to the pre-change shell.

#### Scenario: Footer carries no auth path
- **WHEN** any page is fetched
- **THEN** the footer shows status text, date, and time, and does NOT state an auth path — the strings `via kody` and `locked` SHALL NOT appear in any served page.

#### Scenario: Footer names the auth path
- **WHEN** any page is fetched
- **THEN** RETIRED by this change (see "Footer carries no auth path" above): the footer SHALL NOT state an auth path, because the shell performs no access check.

#### Scenario: Close returns to the opener
- **WHEN** an app opened from the Apps page is closed via the titlebar box with JavaScript running
- **THEN** the browser lands on the Apps page, not Home.

#### Scenario: Close from Home returns Home
- **WHEN** an app opened from a home widget is closed via the titlebar box with JavaScript running
- **THEN** the browser lands on Home.

#### Scenario: Close from an overlay returns to the overlay
- **WHEN** an app expanded from a modal overlay is closed via the titlebar box with JavaScript running
- **THEN** the browser lands on the Apps page with that app's overlay open.

#### Scenario: Bad from falls back to Home
- **WHEN** an app page is opened with a missing or off-site `from` value
- **THEN** RETIRED by this change (see "No stored return goes Home" and "A legacy from value is adopted once, then gone" below): the server no longer reads a `from` query value, so the close box links Home with or without one and no open redirect occurs.

#### Scenario: No stored return goes Home
- **WHEN** an app page is opened by direct navigation, bookmark, or a new tab with no stored return, or with JavaScript disabled
- **THEN** the close box links Home.

#### Scenario: A legacy from value is adopted once, then gone
- **WHEN** an app page is opened with a `?from=` value in the URL
- **THEN** the client stores the validated value, the close box returns to it, and the visible URL no longer carries `from` after load; the server ignores the value entirely.

### Requirement: Pages are server-rendered

Every action SHALL complete as a plain form submission + redirect. The client module (`src/client/index.ts`) MAY enhance forms in place when `fetch` is available and MUST fall back to native submit on any failure. The enhancement MAY read the access key from `localStorage` and attach it to enhancement requests; rendered links and forms SHALL NOT depend on it. Rendered links and forms SHALL NOT carry a return address in the URL or a hidden field. The client module SHALL NOT import `kody:` or `node:` modules.

#### Scenario: Plain increment round-trips without the fast path
- **WHEN** the fetch fast path is unavailable or fails and the Increment form is submitted
- **THEN** the form submits natively and the server responds 303 to the app page, which shows the incremented count.

#### Scenario: Stored key keeps links clean
- **WHEN** the enhancement runs with a stored key and the server accepts it
- **THEN** subsequent pages render without `?k=` in links while native-submit fallback keeps working with `?k=` stamped.

### Requirement: Capability-gated theme routes for apps

The shell SHALL serve `GET /theme/:app` (read) and GET-action routes `GET /theme/:app?action=set&...` and `GET /theme/:app?action=reset[&field=...]`, dispatched after the `/feed/` route (dispatch order is `/apps/` branches, then `/manage/`, then `/proxy/`, then `/feed/`, then the 404 fallthrough), so an app id of `theme` still renders its app page. There is no shell gate in `fetch()` for these routes to inherit; who reaches them is decided by Kody's platform gate before shell code runs. The read route SHALL return JSON `{ ok: true, defaults, override, effective }` with `no-store`. Set / reset SHALL return JSON `{ ok: true, override, effective }` when `format=json` is present, and otherwise 303 back to the app's page. No `from` value SHALL be read on any theme route. Set query parameters SHALL follow the os-theme set semantics, with a grid background passed as `background_grid` (eight comma-separated integers) when the caller needs it. No POST route SHALL be added for theme.

Every theme route SHALL resolve the `:app` slug, load that app's stored definition, and require `capabilities.theme.view` for reads and `capabilities.theme.set` for set / reset. Any gate failure — unknown app, malformed slug, app without the declaration, or a view-only app calling set / reset — SHALL return the feed-style plain 404, with no theme and no capability detail. A gated app with an invalid value SHALL get JSON `{ ok: false, error }` (400) and no write. There is no locked page: a request the platform does not admit never reaches the shell, and a request that does reach it is served. Mutation URLs SHALL never be rendered as plain `<a href>` links.

#### Scenario: Declared app reads, sets, and resets
- **WHEN** an app declaring `capabilities.theme: { view: true, set: true }` calls the read, set, and reset routes signed in to Kody
- **THEN** read returns the split values, set returns the new effective theme, and reset returns the file-default effective theme.

#### Scenario: Undeclared app gets a plain 404
- **WHEN** an app without the theme declaration, an unknown app, or a view-only app calling set requests a theme route
- **THEN** the response is a plain 404 with no theme and no capability detail, and storage is unchanged.

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
`/` when absent). It SHALL also contain no `..` path segment (a
traversal guard on top of the former server rules, since the
value now arrives from browser storage rather than a server-read
query). A `#app-<id>` fragment SHALL be kept only when `<id>`
equals the current app id; otherwise the bare path is used when
valid, else the value is discarded and the close box stays Home.
Every `sessionStorage` access SHALL be guarded
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
- **WHEN** the stored value is an absolute URL, protocol-relative, contains a backslash or line break, or contains a `..` path segment
- **THEN** the close box stays Home and no navigation to the stored value occurs.

#### Scenario: Storage failure leaves the page working
- **WHEN** `sessionStorage` throws on read or write
- **THEN** the app page renders normally and the close box stays Home.
