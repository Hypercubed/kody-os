# Spec Delta

## MODIFIED Requirements

### Requirement: App pages render definition plus live state
The shell SHALL render one page per app at `GET /apps/:id` showing the app's title (in the shell window's titlebar only — the panel itself SHALL NOT repeat a title header), its description when present, every state field, and one HTML form button per declared UI action. Unknown ids SHALL return the 404 page. Modal overlays SHALL keep the panel's own title header, since the underlying page chrome shows the Apps title, not the app's. The app page titlebar SHALL additionally carry a page-mode expand control at the far right, opposite the close box (see `App page expands to fill the window`).

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

## ADDED Requirements

### Requirement: App page expands to fill the window

The shell SHALL render an expand control in the titlebar of every app page
(`GET /apps/:id`), at the far right opposite the close box, and SHALL NOT render
it on the dashboard, Apps page, Help page, 404 page, modal overlay, or home
widget. Activating the control SHALL switch to a full-window view with no
JavaScript and without the browser Fullscreen API: the window SHALL span `100%`
of the viewport width with no side margin or border, its top SHALL be flush with
the top of the viewport, the menubar and status bar SHALL be hidden, and the
main-content gutter SHALL be removed so the app panel spans edge-to-edge. The
expanded view SHALL NOT force a viewport height; content height and scrolling
SHALL follow the app's content as on the normal page. The expanded state SHALL
be carried entirely in the URL fragment, requiring no server, storage, or
session state; a full navigation MAY drop it and return the normal page. In the
expanded view the control SHALL become a collapse affordance that restores the
normal centered chrome. Widget and modal expand boxes SHALL keep their current
behavior.

#### Scenario: Expand control appears only on app pages
- **WHEN** an app page is fetched
- **THEN** its titlebar shows the expand control at the far right, and when the
  dashboard, Apps page, Help page, a modal overlay, or a home widget is fetched
  no page-mode expand control is present.

#### Scenario: Expanding fills width and sits at the top
- **WHEN** the user activates the expand control on an app page
- **THEN** the window spans 100% of the viewport width with no side margin, its
  top is flush with the top of the viewport, the menubar and status bar are not
  displayed, and the app panel spans edge-to-edge.

#### Scenario: Collapsing restores the normal page
- **WHEN** the user activates the collapse control in the expanded view
- **THEN** the menubar and status bar return and the window returns to its
  centered, width-capped layout.

#### Scenario: Expansion works without JavaScript and without Fullscreen
- **WHEN** the page is loaded with JavaScript disabled
- **THEN** the expand and collapse controls still work through plain links, and
  the shell never calls the browser Fullscreen API.

#### Scenario: Expanded state is URL-only
- **WHEN** an app page is expanded
- **THEN** no storage, cookie, or server state is written, and a full navigation
  returns the normal page because the fragment is not submitted.

#### Scenario: Height follows content
- **WHEN** an app page is expanded and its content is taller than the viewport
- **THEN** the page scrolls normally with no forced viewport height or
  viewport-locked content region.
