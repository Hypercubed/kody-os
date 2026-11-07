# Spec Delta

## MODIFIED Requirements

### Requirement: Single shared chrome

Every page SHALL use the same chrome: title bar with the page
title and a close box (labeled with its destination, omitted on
the dashboard); menu strip with the left cluster of brand mark
plus product name from `pkg/settings.json` (default `kody-os`)
followed immediately by Home and Apps links, then menu-app links,
with built-in Help and About appended when enabled (no Refresh
link); main content; footer with status text, the active auth
path (`via kody`, `via cookie`, or `locked`), and no home
navigation; `data-pak-config` carrying the current phase; and a
right-aligned date and time (server-rendered UTC on each
navigation; a client tick SHALL keep it live in the browser's
local time zone where JavaScript runs). The Logout link SHALL
appear only on cookie-authenticated pages. The `via key` auth
path SHALL NOT appear anywhere in the chrome. (All other chrome
behavior is unchanged from the base spec.)

#### Scenario: Unknown routes keep the chrome
- **WHEN** a request hits an unknown path
- **THEN** the shell responds 404 inside the full chrome with plain "Not found." text and no home link in the body; the titlebar close box is the way back.

#### Scenario: Header order and clock
- **WHEN** any page is fetched
- **THEN** the header reads brand, Home, Apps, menu-app links, Help, About left to right (Help/About omitted when disabled) with no Refresh link, and shows a date + time on the far right.

#### Scenario: Defaults preserve current rendering
- **WHEN** no theme file is present
- **THEN** title, brand, and background are byte-identical to the pre-change shell.

#### Scenario: Close returns to the opener
- **WHEN** an app opened from the Apps page is closed via the titlebar box
- **THEN** the browser lands on the Apps page, not Home.

#### Scenario: Close from Home returns Home
- **WHEN** an app opened from a home widget is closed via the titlebar box
- **THEN** the browser lands on Home.

#### Scenario: Bad from falls back to Home
- **WHEN** an app page is opened with a missing or off-site `from` value
- **THEN** the close box links Home and no open redirect occurs.

#### Scenario: Footer names the auth path
- **WHEN** any page is fetched
- **THEN** the footer states which path authenticated the request
  (`via kody`, `via cookie`, or `locked`); `via key` SHALL NOT
  appear.

### Requirement: Pages are server-rendered

Every action SHALL complete as a plain form submission + redirect.
The client module (`src/client/index.ts`) MAY enhance forms in
place when `fetch` is available and MUST fall back to native
submit on any failure. The enhancement SHALL NOT read, store, or
attach any credential from `localStorage` or the DOM: the
hidden-field and `?k=`-URL key fallbacks are removed, and the
stored session-token attach is removed as well (Open Question 2
resolution, design.md Decision 4: the server accepts `?k=` only
as an OTP submission, so a session token attached as `?k=` could
not authenticate and would count toward the failure cap).
Same-origin fetches authenticate with the session cookie. Rendered links
and forms SHALL NOT carry any credential and SHALL NOT depend on
enhancement. The client module SHALL NOT import `kody:` or
`node:` modules. No tile link, form, or redirect SHALL carry a
credential (`?k=` or any successor); authenticated sessions are
carried by the cookie (see auth-transport). The unlock form's
`?k=` GET submission is the sole exception, as a single-use
OTP submission transport: the value is consumed on submit and
SHALL NOT appear in any rendered output afterward.

#### Scenario: Plain increment round-trips without the fast path
- **WHEN** the fetch fast path is unavailable or fails and the Increment form is submitted
- **THEN** the form submits natively and the server responds 303 to the app page, which shows the incremented count.

#### Scenario: No credential in rendered output
- **WHEN** any authenticated shell page is fetched
- **THEN** its HTML contains no `?k=`, no hidden `k` field, and
  no credential in any link, form, or redirect.

#### Scenario: Enhancement never attaches a code
- **WHEN** an app action form is enhanced in place
- **THEN** the fetch URL carries no credential at all: the
  session cookie authenticates the same-origin fetch, and no
  stored value is attached (the server accepts `?k=` only as
  an OTP submission).

#### Scenario: Stored key keeps links clean
- **WHEN** the enhancement runs with a stored key and the server accepts it
- **THEN** RETIRED by this change (see No credential in rendered output): enhancement SHALL NOT read, store, or attach any key material; authenticated enhancement relies on the cookie only.

### Requirement: Home launcher lists installed apps

The shell SHALL render a home page at `GET /` showing the widget
dashboard (see widget-home), and the Apps grid — Pinned, Recent,
and All-apps sections with edit mode — SHALL live behind the
Apps menu link instead of at `/`. Deep links at `/apps/:id`
SHALL be unchanged. No tile link, form, or redirect SHALL carry
a credential (`?k=` or any successor); authenticated sessions
are carried by the cookie (see auth-transport). (All other
launcher behavior is unchanged from the base spec.)

#### Scenario: Empty registry is honest
- **WHEN** no apps are installed
- **THEN** both `/` and the Apps page respond 200 with honest empty states and guidance toward adding apps.

#### Scenario: Empty Apps page shows two prompts
- **WHEN** the Apps page is fetched with no apps installed
- **THEN** it shows Help-style help text with a prompt for adding your own apps first and a prompt for installing the App Store second, each as selectable text in a gate-hint code block, with no copy button and no Clipboard API use, and with no Edit button. The App Store prompt is agent-only: it installs `app-store` only (`install_from_catalog('app-store')`, verified with `list_apps`), per the app-store recipe; it SHALL NOT name a browser install path.

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
- **WHEN** a modal-capable app's tile is followed
- **THEN** the overlay section becomes visible on the Apps page (no navigation), showing current state with working forms, and the back link hides it again.

#### Scenario: Unified app renders UI plus state
- **WHEN** a unified app page is fetched
- **THEN** bundle UI, live state, and action forms all render in the single panel with no template branch.

#### Scenario: SVG tile renders mark
- **WHEN** an app with a sanitized SVG icon is listed
- **THEN** the tile shows the SVG mark at icon size with no color or animation.
