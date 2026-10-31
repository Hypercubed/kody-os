# Spec Delta

## MODIFIED Requirements

### Requirement: Single shared chrome

Every page SHALL use the same chrome: title bar with the page
title and a close box (labeled with its destination, omitted on
the dashboard); menu strip with the left cluster of brand mark
plus product name from `os-theme.json` (default `kody-os`)
followed immediately by Home, Apps, and Help links (no Refresh
link); main content; footer with status text, the active auth
path (`via kody`, `via cookie`, or `locked`), and no home
navigation; `data-pak-config` carrying the current phase; and a
right-aligned date and time (server-rendered UTC on each
navigation; a client tick SHALL keep it live in the browser's
local time zone where JavaScript runs). The Logout link SHALL
appear only on cookie-authenticated pages. The `via key` auth
path SHALL NOT appear anywhere in the chrome. (All other chrome
behavior is unchanged from the base spec.)

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

### Requirement: Home launcher lists installed apps

The shell SHALL render a home page at `GET /` showing the widget
dashboard (see widget-home), and the Apps grid — Pinned, Recent,
and All-apps sections with edit mode — SHALL live behind the
Apps menu link instead of at `/`. Deep links at `/apps/:id`
SHALL be unchanged. No tile link, form, or redirect SHALL carry
a credential (`?k=` or any successor); authenticated sessions
are carried by the cookie (see auth-transport). (All other
launcher behavior is unchanged from the base spec.)
