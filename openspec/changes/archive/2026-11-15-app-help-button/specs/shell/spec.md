# Spec Delta

## Purpose

Give every app a per-app help button — `[?]` immediately left of the
expand box, shown only when the app defines help (`ui.help`, plain
text) — opening a server-rendered dialog with that
help. The button appears in both app headers: the shell window
titlebar on app pages and the panel titlebar in modal overlays. The
dialog opens via the shell client in place (JavaScript, no fragment,
no navigation), so opening help never refreshes the page and never
disturbs the overlay or expanded layout underneath.

## MODIFIED Requirements

### Requirement: Single shared chrome

The title-bar part of this requirement changes as follows; the rest
(menu strip, main content, footer, clock, close-box destinations,
document title) is unchanged. On an app page (`GET /apps/:id`) the
shell window titlebar SHALL carry a help box immediately to the left
of the expand box — in the slot at `right: 3rem`, with expand still
at `right: 0` — when and only when the app's stored definition
carries a non-empty `ui.help`. The help box SHALL be a `<button
type="button">` showing the literal text `?` in the same
outlined-square box as the close and expand boxes, with the same 48px
hit slot, `aria-label="Help"`, and `title="Help"`. On every other
page (dashboard, Apps page, Help and About pages, 404) the titlebar
SHALL show no help box. An app page for an app without `ui.help`
SHALL render a titlebar byte-identical to the pre-change one.

#### Scenario: Help box appears left of expand on an app page
- **WHEN** an app page is fetched for an app whose definition carries `ui.help`
- **THEN** its titlebar shows a `[?]` box immediately left of the expand box, and the close box, title, and expand box are otherwise unchanged.

#### Scenario: No help defined means no help box
- **WHEN** an app page is fetched for an app with no `ui.help`, or with an empty or whitespace-only `ui.help`
- **THEN** its titlebar shows no help box and is byte-identical to the pre-change titlebar.

#### Scenario: Help box appears nowhere else in the chrome
- **WHEN** the dashboard, the Apps page, the Help page, the About page, or a 404 page is fetched
- **THEN** no help box is present in the titlebar.

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

### Requirement: App pages render definition plus live state

The modal-overlay part of this requirement changes as follows; the
rest (one title per app view, description and state rendering, action
forms) is unchanged. A modal overlay's panel titlebar SHALL carry a
help box immediately to the left of the modal-expand box, with a
`has-help` class widening the bar's side padding to two 3rem slots
on both sides so the title plate is never covered and stays centered,
when and only when the app's
stored definition carries a non-empty `ui.help`. An overlay for an
app without `ui.help` SHALL render a panel header byte-identical to
the pre-change one.

#### Scenario: Help box appears left of modal-expand in an overlay
- **WHEN** a modal-capable app with `ui.help` is opened as an overlay
- **THEN** its panel titlebar shows a `[?]` box immediately left of the modal-expand box, and the title plate is fully visible.

#### Scenario: Overlay without help is unchanged
- **WHEN** a modal overlay is rendered for an app with no `ui.help`
- **THEN** its panel header shows no help box and is byte-identical to the pre-change header.

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

### Requirement: App page expands to fill the window

The expand requirement gains the following interaction with help;
the rest (expand only on app pages, full-window view,
URL-fragment state, collapse restores the normal page) is unchanged.
Opening or closing help SHALL leave the expanded layout untouched:
the help dialog opens in place over whichever layout is showing, the
URL fragment (including `#os-full`) is unchanged, and app state
SHALL be untouched by opening or closing help.

#### Scenario: Opening help from the expanded view keeps the layout
- **WHEN** the help button is activated while the app page is expanded
- **THEN** the help dialog opens over the expanded view, the window stays expanded, the URL is unchanged, and the app's stored state is unchanged.

#### Scenario: Expand control appears only on app pages
- **WHEN** an app page is fetched
- **THEN** its titlebar shows the expand control at the far right, and when the dashboard, Apps page, a modal overlay, a home widget, the Help page, or the About page is fetched no page-mode expand control is present.

#### Scenario: Expanding fills width and sits at the top
- **WHEN** the user activates the expand control on an app page
- **THEN** the window spans 100% of the viewport width with no side margin, its top is flush with the top of the viewport, the menubar and status bar are not displayed, and the app panel spans edge-to-edge.

#### Scenario: Collapsing restores the normal page
- **WHEN** the user activates the collapse control in the expanded view
- **THEN** the menubar and status bar return and the window returns to its centered, width-capped layout.

#### Scenario: Expansion works without JavaScript and without Fullscreen
- **WHEN** the page is loaded with JavaScript disabled
- **THEN** the expand and collapse controls still work through plain links, and the shell never calls the browser Fullscreen API.

#### Scenario: Expanded state is URL-only
- **WHEN** an app page is expanded
- **THEN** no storage, cookie, or server state is written, and a full navigation returns the normal page because the fragment is not submitted.

#### Scenario: Height follows content
- **WHEN** an app page is expanded and its content is taller than the viewport
- **THEN** the page scrolls normally with no forced viewport height or viewport-locked content region.

## ADDED Requirements

### Requirement: Per-app help button and dialog

An app definition MAY carry `ui.help`, a plain-text string (see the
app-registry delta). When it does, the shell SHALL render a help
button in the app's header (shell titlebar on the app page, panel
titlebar in a modal overlay) and a help dialog in the page, and when
it does not, the shell SHALL render neither. The dialog SHALL be
server-rendered in the page HTML, hidden by default via the `hidden`
attribute, and opened in place by the shell client with no fragment,
no navigation, and no page refresh. The dialog SHALL show a header
line reading `{app name} - Help` (bold, horizontally centered, no
borders of its own), the help text HTML-escaped with line breaks
preserved, and a normal auto-width Close button in a padded footer,
in a centered box with a double line border. Activating the help
button SHALL open the dialog over
the current view; activating Close or pressing Escape SHALL close it
and return focus to the opener. The dialog SHALL NOT be rendered in
home widgets, on tiles, or on any page without an app header. The
help text SHALL NOT be interpreted as HTML or markdown and SHALL NOT
contain links in this release. Opening or closing the dialog SHALL
write no storage, change no state, change no URL, and call no route.

#### Scenario: Help opens in a dialog
- **WHEN** the help button on an app page is activated
- **THEN** the dialog opens showing a `{app name} - Help` header line, the help text, and a Close button, and no navigation away from the app page occurs.

#### Scenario: Help text is escaped, never interpreted
- **WHEN** an app defines help containing markup (for example `<script>` or `<a href>`)
- **THEN** the dialog shows that markup as visible text and creates no element from it.

#### Scenario: Closing help returns to the app, not away from it
- **WHEN** the dialog's Close button is activated (or Escape is pressed) on an app page
- **THEN** the dialog closes, the app page underneath is unchanged, and the URL is unchanged; and when it is closed in a modal overlay, the overlay underneath is unchanged with its state intact.

#### Scenario: Help leaves URL and overlay state untouched
- **WHEN** a page carries an open modal overlay or an expanded app and the help dialog is opened and closed
- **THEN** the URL is unchanged throughout, the overlay stays open, the expanded layout stays expanded, and no other app's dialog or overlay is affected.

#### Scenario: Help writes nothing
- **WHEN** the help dialog is opened and closed
- **THEN** no storage key is written, no state field changes, the URL is unchanged, and no request beyond the page itself is made.
