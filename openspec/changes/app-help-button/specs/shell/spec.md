# Spec Delta

## Purpose

Give every app a per-app help button — `[?]` immediately left of the
expand box, shown only when the app defines help (`ui.help`, plain
text) — opening a server-rendered, no-JavaScript dialog with that
help. The button appears in both app headers: the shell window
titlebar on app pages and the panel titlebar in modal overlays.

## MODIFIED Requirements

### Requirement: Single shared chrome

The title-bar part of this requirement changes as follows; the rest
(menu strip, main content, footer, clock, close-box destinations,
document title) is unchanged. On an app page (`GET /apps/:id`) the
shell window titlebar SHALL carry a help box immediately to the left
of the expand box — in the slot at `right: 3rem`, with expand still
at `right: 0` — when and only when the app's stored definition
carries a non-empty `ui.help`. The help box SHALL show the literal
text `?` in the same outlined-square box as the close and expand
boxes, with the same 48px hit slot, `aria-label="Help"`, and
`title="Help"`. On every other page (dashboard, Apps page, Help and
About pages, 404) the titlebar SHALL show no help box. An app page
for an app without `ui.help` SHALL render a titlebar byte-identical
to the pre-change one.

#### Scenario: Help box appears left of expand on an app page
- **WHEN** an app page is fetched for an app whose definition carries `ui.help`
- **THEN** its titlebar shows a `[?]` box immediately left of the expand box, and the close box, title, and expand box are otherwise unchanged.

#### Scenario: No help defined means no help box
- **WHEN** an app page is fetched for an app with no `ui.help`, or with an empty or whitespace-only `ui.help`
- **THEN** its titlebar shows no help box and is byte-identical to the pre-change titlebar.

#### Scenario: Help box appears nowhere else in the chrome
- **WHEN** the dashboard, the Apps page, the Help page, the About page, or a 404 page is fetched
- **THEN** no help box is present in the titlebar.

### Requirement: App pages render definition plus live state

The modal-overlay part of this requirement changes as follows; the
rest (one title per app view, description and state rendering, action
forms) is unchanged. A modal overlay's panel titlebar SHALL carry a
help box immediately to the left of the modal-expand box, with a
`has-help` class widening the bar's right padding for two 3rem slots
so the title plate is never covered, when and only when the app's
stored definition carries a non-empty `ui.help`. An overlay for an
app without `ui.help` SHALL render a panel header byte-identical to
the pre-change one.

#### Scenario: Help box appears left of modal-expand in an overlay
- **WHEN** a modal-capable app with `ui.help` is opened as an overlay
- **THEN** its panel titlebar shows a `[?]` box immediately left of the modal-expand box, and the title plate is fully visible.

#### Scenario: Overlay without help is unchanged
- **WHEN** a modal overlay is rendered for an app with no `ui.help`
- **THEN** its panel header shows no help box and is byte-identical to the pre-change header.

### Requirement: App page expands to fill the window

The expand requirement gains the following interaction with help;
the rest (expand only on app pages, full-window view, no-JS,
URL-fragment state, collapse restores the normal page) is unchanged.
Expand state lives in the `#os-full` fragment and help lives in the
`#help-<id>` fragment, and a URL carries one fragment: following
the help link from the expanded view SHALL return the window to its
normal layout. The dialog SHALL work identically in either layout,
and app state SHALL be untouched by opening or closing help.

#### Scenario: Opening help from the expanded view collapses the window
- **WHEN** the help button is activated while the app page is expanded
- **THEN** the help dialog opens, the window returns to its normal centered layout, and the app's stored state is unchanged.

## ADDED Requirements

### Requirement: Per-app help button and dialog

An app definition MAY carry `ui.help`, a plain-text string (see the
app-registry delta). When it does, the shell SHALL render a help
button in the app's header (shell titlebar on the app page, panel
titlebar in a modal overlay) and a help dialog in the page, and when
it does not, the shell SHALL render neither. The dialog SHALL be
server-rendered in the page HTML, hidden by default, and revealed
only when its fragment matches (`:target`); it SHALL work without
JavaScript. The dialog SHALL show the app title, the help text
HTML-escaped with line breaks preserved, and a close link. The help
button SHALL link to `#help-<id>`; the close link SHALL return to
the view that opened it — the app page URL without a fragment on an
app page, `#app-<id>` in an overlay. The dialog SHALL NOT be
rendered in home widgets, on tiles, or on any page without an app
header. The help text SHALL NOT be interpreted as HTML or markdown
and SHALL NOT contain links in this release. Opening or closing the
dialog SHALL write no storage, change no state, and call no route.

#### Scenario: Help opens in a dialog without JavaScript
- **WHEN** the help button on an app page is followed with JavaScript disabled
- **THEN** the dialog opens showing the app title and the help text, with a close link, and no navigation away from the app page occurs.

#### Scenario: Help text is escaped, never interpreted
- **WHEN** an app defines help containing markup (for example `<script>` or `<a href>`)
- **THEN** the dialog shows that markup as visible text and creates no element from it.

#### Scenario: Closing help returns to the app, not away from it
- **WHEN** the dialog's close link is followed on an app page
- **THEN** the browser shows the app page with the dialog closed; and when it is followed in a modal overlay, the browser shows the overlay with the dialog closed.

#### Scenario: Help fragments do not collide
- **WHEN** a page carries an open modal overlay, an expanded app, and a help dialog
- **THEN** `#help-<id>`, `#app-<id>`, and `#os-full` are distinct fragments and activating one does not reveal another app's dialog or overlay.

#### Scenario: Help writes nothing
- **WHEN** the help dialog is opened and closed
- **THEN** no storage key is written, no state field changes, and no request beyond the page itself is made.
