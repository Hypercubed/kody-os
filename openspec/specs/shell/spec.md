# OS Shell

## Purpose
Capture the shipped Phase 2 browser shell so future changes (theme, routing, Scribe hardening) verify against it instead of re-deriving from code.

## Requirements

### Requirement: Home launcher lists installed apps

The shell SHALL render a home page at `GET /` showing the widget dashboard (see widget-home), and the Apps grid — Pinned, Recent, and All-apps sections, as a launcher only, with no Edit mode — SHALL live behind the Apps menu link instead of at `/`. App management (pin, hide, home, install, update, restore) lives on the App Store combined list (see App Store page below); the Apps page's former Edit mode is retired. Deep links at `/apps/:id` SHALL be unchanged. The Apps page SHALL render the three sections in order: Pinned (user-chosen tiles, omitted when empty), Recent (behavior-driven tiles with a Clear control, omitted when empty), and All apps (every installed app except hidden ones; pinned apps included). Each tile links to `/apps/:id` — except modal-capable apps, whose tiles link to an inline overlay section on the same page opened by fragment (`#app-<id>`) via CSS `:target` and closed by a back link. The overlay SHALL contain the same section HTML as the app page (bundle UI, live state, action forms), fully present in the server-rendered HTML; JS may enhance it. Every tile SHALL show the app's icon glyph or sanitized SVG mark and label. A fresh install SHALL open with the App Store installed (see app-registry); with no apps installed at all (seeding has failed or not yet run), both `/` and the Apps page SHALL render honest empty states with guidance toward adding apps, including the App Store path.

#### Scenario: Empty registry is honest
- **WHEN** no apps are installed
- **THEN** both `/` and the Apps page respond 200 with honest empty states and guidance toward adding apps.

#### Scenario: Fresh install opens with the App Store
- **WHEN** a blank install receives its first shell request
- **THEN** the Apps page shows the App Store tile, and `/` shows its honest no-widgets state (the store is not on the homepage by default).

#### Scenario: Apps page has no Edit mode
- **WHEN** the Apps page is fetched
- **THEN** it shows Pinned, Recent, and All tiles with no Edit control; pin, hide, and home controls are on the App Store combined list instead.

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

### Requirement: Pinned section

The shell SHALL render a Pinned section above Recent listing pinned apps in pin order. A pinned app that is also hidden SHALL still appear in Pinned. An empty pinned list SHALL omit the section entirely. Pinned tiles SHALL span two grid columns (three per row at full width) at the standard tile height, with the icon fixed left and the label plus description stacked right. Every tile link on the Apps screen (Pinned, Recent, All apps) SHALL carry the app description as a `title` tooltip.

#### Scenario: Hidden pinned app stays visible in Pinned only
- **WHEN** a pinned app is hidden via the App Store combined list
- **THEN** it remains in the Pinned section and disappears from the All apps section.

#### Scenario: Pinned tiles are double-wide with descriptions
- **WHEN** the Apps page renders with pinned apps
- **THEN** each pinned tile is twice as wide as a standard tile at the same height, showing the icon left and label plus description right, three per row.

#### Scenario: Tiles carry tooltips
- **WHEN** any Apps-screen tile is inspected
- **THEN** its link carries a `title` attribute with the app description, with no visual change.

### Requirement: Recent section with Clear

The shell SHALL render a Recent section listing the most recently used apps (most recent first, capped at a fixed count), with a Clear control inline in its header that empties it. An app counts as used when its page is opened or one of its actions succeeds. An empty recent list SHALL omit the section entirely.

#### Scenario: Clear empties Recent without touching apps
- **WHEN** Clear is submitted
- **THEN** the Recent section disappears and installed apps, pins, and hidden flags are unchanged.

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

### Requirement: App page expands to fill the window

The shell SHALL render an expand control in the titlebar of every app page
(`GET /apps/:id`), at the far right opposite the close box, and SHALL NOT render
it on the dashboard, Apps page, 404 page, modal overlay, or home widget.
Activating the control SHALL switch to a full-window view with no
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
behavior. The static Help page no longer exists, so the help app page at
`/apps/help` is an ordinary app page and SHALL carry the control.

#### Scenario: Expand control appears only on app pages
- **WHEN** an app page is fetched
- **THEN** its titlebar shows the expand control at the far right, and when the
  dashboard, Apps page, a modal overlay, or a home widget is fetched
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

### Requirement: One route set for UI and synthetic traffic
The shell SHALL route mount-tolerantly: it slices the request path from the first `/apps/` occurrence so mounted, synthetic (`packageAppFetch`), and stripped requests route identically. The HTTP method match SHALL be case-insensitive.

#### Scenario: Mounted and stripped paths route the same
- **WHEN** the handler receives `/kody-os/apps/counter` or `/apps/counter`
- **THEN** both render the same app page with the same state.

### Requirement: Single shared chrome

Every page SHALL use the same chrome: title bar with the page title and a close box (labeled with its destination, omitted on the dashboard); menu strip with the left cluster of brand mark plus product name from `os-theme.json` (default `kody-os`) followed immediately by Home and Apps links, then the menu-app links specified in `Top menu bar links` (no Refresh link, no static Help link); main content; footer with status text, the active auth path (`via kody`, `via cookie`, `via key`, or `locked`), and no home navigation; `data-pak-config` carrying the current phase; and a right-aligned date and time (server-rendered UTC on each navigation; a client tick SHALL keep it live in the browser's local time zone where JavaScript runs). The titlebar close box on an app page SHALL return to the opener (`/` or `/apps`, carried as a validated `from` param on the tile link); with no valid `from` it SHALL go Home. The dashboard at `GET /` SHALL omit the close box (it already is home) and every other page SHALL show it. The document title SHALL read `{page} · {title}` where `{title}` is the theme title when set, else the theme name. Body background and header mark SHALL likewise render from the theme file with current values as defaults.

#### Scenario: Unknown routes keep the chrome
- **WHEN** a request hits an unknown path
- **THEN** the shell responds 404 inside the full chrome with plain "Not found." text and no home link in the body; the titlebar close box is the way back.

#### Scenario: Header order and clock
- **WHEN** any page is fetched
- **THEN** the header reads brand, Home, Apps left to right with no Refresh link and no static Help link, then any installed menu-app links in label order, and shows a date + time on the far right.

#### Scenario: Defaults preserve current rendering
- **WHEN** no theme file is present
- **THEN** title, brand, and background are byte-identical to the pre-change shell.

#### Scenario: Footer names the auth path
- **WHEN** any page is fetched
- **THEN** the footer states which path authenticated the request (`via kody`, `via cookie`, `via key`, or `locked`).

#### Scenario: Close returns to the opener
- **WHEN** an app opened from the Apps page is closed via the titlebar box
- **THEN** the browser lands on the Apps page, not Home.

#### Scenario: Close from Home returns Home
- **WHEN** an app opened from a home widget is closed via the titlebar box
- **THEN** the browser lands on Home.

#### Scenario: Bad from falls back to Home
- **WHEN** an app page is opened with a missing or off-site `from` value
- **THEN** the close box links Home and no open redirect occurs.

### Requirement: Scribe-ready styles, inlined
The shell SHALL inline the full theme in a single `<style>` tag on every page and emit zero external stylesheet `<link>` tags. `src/shell-css.ts` is generated from `public/styles.css` (the authoring source of truth) and MUST be regenerated after any theme edit so the two stay byte-identical.

#### Scenario: No external stylesheets anywhere
- **WHEN** any shell page is fetched
- **THEN** its HTML contains exactly one `<style>` block, zero `<link rel="stylesheet">` tags, and the inlined CSS is byte-identical to `public/styles.css`.

### Requirement: Kindle ceiling (Chromium 75)
Shell and client code SHALL be ES2019 only: no `?.`, no `??`, no `replaceAll`, no `.at()`. Styles SHALL use no flexbox `gap` (grid `gap` is allowed), system fonts only, zero emojis, minimum 3rem (48px) tap targets, no animations or transitions, `color-scheme: light` only.

#### Scenario: Static ceilings hold
- **WHEN** the tree is grepped for `?.`, `??`, flexbox `gap`, or non-system emoji
- **THEN** zero matches are found outside comments, and every interactive element keeps a 3rem minimum target.

### Requirement: Pages are server-rendered
Every action SHALL complete as a plain form submission + redirect. The client module (`src/client/index.ts`) MAY enhance forms in place when `fetch` is available and MUST fall back to native submit on any failure. The enhancement MAY read the access key from `localStorage` and attach it to enhancement requests; rendered links and forms SHALL NOT depend on it. The client module SHALL NOT import `kody:` or `node:` modules.

#### Scenario: Plain increment round-trips without the fast path
- **WHEN** the fetch fast path is unavailable or fails and the Increment form is submitted
- **THEN** the form submits natively and the server responds 303 to the app page, which shows the incremented count.

#### Scenario: Stored key keeps links clean
- **WHEN** the enhancement runs with a stored key and the server accepts it
- **THEN** subsequent pages render without `?k=` in links while native-submit fallback keeps working with `?k=` stamped.

### Requirement: Bundle hosting in shell chrome
`GET /apps/:id` SHALL render the existing shell chrome (title, nav, inlined theme, single `<style>`, zero external assets) with the bundle's `index.html` content inlined into the app panel (or overlay for modal placement). Bundle `<script>` and `<style>` content SHALL be inlined with the entry. The shell SHALL stamp `data-action-base="/apps/<id>"` on the bundle container so bundle scripts can resolve action URLs against the owning app without reading the page path. Any shell-side hosting code SHALL meet the ES2019 ceiling.

#### Scenario: Bundle page renders in chrome
- **WHEN** a unified app page is fetched
- **THEN** the response carries the normal chrome plus the inlined bundle entry, exactly one `<style>` block, and zero `<link rel="stylesheet">` tags.

#### Scenario: Actions keep PRG behavior
- **WHEN** a form posts a valid or invalid action on a bundle app page
- **THEN** it responds 303 to the app page on success or 400 with an inline error on failure, same as any app.

#### Scenario: Bundle container carries the action base
- **WHEN** any page renders a bundle (app page, overlay, or home widget)
- **THEN** the `.bundle` container carries `data-action-base` naming the owning app's `/apps/<id>` path.

### Requirement: Bundle failures degrade, never blank
Unknown ids SHALL still 404. Bundle render failures SHALL degrade to the server-rendered page, never a blank response.

#### Scenario: Broken bundle degrades gracefully
- **WHEN** a bundle entry fails to render
- **THEN** the page still returns the shell chrome with an explanatory message and a working close/back control.

### Requirement: Menu apps are derived, not stored

The shell SHALL derive menu-app links from installed definitions
on each render. There SHALL be no menu storage key, no menu
order list, and no menu toggle in Apps Edit or anywhere else in
the browser UI. Installing a flagged app SHALL add its link on
the next render; no separate menu write SHALL exist.

#### Scenario: No menu write on install

- **WHEN** a flagged app is installed via `add_app`,
  `install_from_catalog`, or import
- **THEN** its link appears on the next Home, Apps, or app page
  render, and no menu-specific storage key is written.

### Requirement: App Store page is the single combined list

The App Store app page (`GET /apps/app-store`) SHALL render, server-side in the normal shell chrome, a single combined list as defined in the app-registry spec: one row per id from the union of catalog ids and installed ids, deduplicated by id, in alphabetical-by-id order, each row showing the app's icon, label, description, and status badge. The App Store itself appears as a row like any other app; it is not excluded from its own list. The list is unfiltered, so hidden apps appear in it. A row for an app that is not installed SHALL offer an Install control as a plain GET form (`?install=<id>`, no `app-action` class, authentication via the session cookie, no credential field) and no Open link, no Pin, Hide, or Home control, and no Update or Restore control — no launching from the catalog. A row for an installed app SHALL show its status and Pin/Unpin, Hide/Unhide, and Add to home/Remove from home controls as plain GET forms (no `app-action` class), each responding 303 back to the store page; installed rows offer no Open link (the Apps page is the launcher). An installed catalog app with a snapshot SHALL additionally show its update status under the app-registry spec: behind-and-clean and catalog-differing rows offer an Update control; behind-and-modified rows offer a confirmed update (see below), not a plain Update control; modified-at-current-version rows offer Restore catalog version; ahead rows offer Restore catalog version, never Update; up-to-date rows offer neither. A row for an installed catalog app without a snapshot SHALL show Installed with no update control under this scheme. A row for an installed app with no catalog entry SHALL show Storage only (formerly in the catalog where a snapshot exists, otherwise custom/storage-only) with launcher controls only. Submitting an Install form SHALL install the app through the registry's install-from-catalog path and respond 303 back to the store page. An unknown `install` id SHALL respond 400, re-render the store page with an inline `role="alert"` error, and change nothing. The listing SHALL require no JavaScript. The Help page SHALL present the App Store as the browser path for installing shipped apps and for managing installed apps, with the agent/`add_app` path retained for custom apps.

#### Scenario: Behind-and-clean row offers update
- **WHEN** an installed catalog app matches its snapshot at a lower version than the catalog
- **THEN** its row shows Update, and submitting it updates the app and returns 303 to the store page.

#### Scenario: Snapshot-less row offers no update
- **WHEN** an installed catalog app has no snapshot
- **THEN** its row shows Installed and no Update or Restore control.

#### Scenario: Combined list shows catalog, installed, and storage-only apps once each
- **WHEN** the App Store page is fetched with catalog apps installed and uninstalled, plus an installed app with no catalog entry, plus the App Store itself
- **THEN** every id from the union appears exactly once, in alphabetical-by-id order, with its icon, label, description, and status badge — including `app-store` itself.

#### Scenario: Catalog-only row has no launch control
- **WHEN** a catalog app that is not installed is rendered in the combined list
- **THEN** its row offers Install and no link to its app page, since there is nothing installed to open.

#### Scenario: Install round-trips without JavaScript
- **WHEN** an Install form is submitted with JavaScript unavailable
- **THEN** the server responds 303 to the store page, the app is installed, and its row now shows Installed.

#### Scenario: Installed rows offer no Install control
- **WHEN** an installed catalog app's row is rendered
- **THEN** it shows Installed and no Install form for that id.

#### Scenario: Installed row offers launcher controls
- **WHEN** an installed app's row is rendered in the combined list
- **THEN** it offers Pin/Unpin, Hide/Unhide, and Add to home/Remove from home controls, each responding 303 back to the store page without changing its definition, state, or snapshot.

#### Scenario: Storage-only row offers launcher controls only
- **WHEN** an installed app with no catalog entry is rendered in the combined list
- **THEN** its row shows Storage only with launcher controls, and no Install, Update, Restore, or catalog status control.

#### Scenario: Unknown install id is a clean error
- **WHEN** the store page is requested with an unknown `install` id
- **THEN** it responds 400 with an inline error, the store page still renders, and storage is unchanged.

#### Scenario: Store page keeps shell constraints
- **WHEN** the App Store page is fetched
- **THEN** it carries the normal chrome, exactly one `<style>` block, zero external stylesheets, and no mutating POST form.

### Requirement: Confirmed update for a modified app

Submitting an update (or restore) for a modified catalog app SHALL NOT apply the update immediately. It SHALL first render a confirmation page (server-rendered, no JavaScript required, normal shell chrome) stating that updating will replace the app's definition — bundle files, stateSchema, actions, capabilities, and metadata — with the catalog copy and that the user's custom definition changes will be lost and cannot be recovered afterwards unless the app was exported first, and stating that state is preserved for fields still declared in the new definition while dropped fields reset to their initial values. Only an explicit confirmation submission on that page SHALL apply the update, through the registry update path, and respond 303 back to the store page. Declining or leaving the confirmation page SHALL change nothing. An update or restore for an unknown id, an uninstalled id, or a non-catalog id SHALL respond 400, re-render the store page with an inline `role="alert"` error, and change nothing.

#### Scenario: Modified update waits for confirmation
- **WHEN** a confirmed update is requested for a modified catalog app
- **THEN** the store renders the confirmation page with the loss and state-preservation wording, and storage is unchanged until confirmation.

#### Scenario: Confirmed update replaces definition and keeps surviving state
- **WHEN** the confirmation is submitted for a modified catalog app
- **THEN** its definition is replaced with the catalog copy, state for surviving fields is preserved, dropped fields reset, pins and homepage placement are untouched, and a new snapshot is recorded.

#### Scenario: Declined update changes nothing
- **WHEN** the confirmation page is left without confirming
- **THEN** the installed definition, state, and snapshot are unchanged.

#### Scenario: Ahead app offers restore, not update
- **WHEN** an installed catalog app is modified and ahead of the catalog
- **THEN** its row offers Restore catalog version with the confirmation and warning, never an Update control.
