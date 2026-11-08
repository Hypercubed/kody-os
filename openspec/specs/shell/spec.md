# OS Shell

## Purpose
Capture the shipped Phase 2 browser shell so future changes (theme, routing, Scribe hardening) verify against it instead of re-deriving from code.

## Requirements

### Requirement: Home launcher lists installed apps

The shell SHALL render a home page at `GET /` showing the widget dashboard (see widget-home), and the Apps grid — Pinned, Recent, and All-apps sections, as a launcher, plus Edit mode — SHALL live behind the Apps menu link instead of at `/`. Launcher management (pin, hide, home) lives in Apps Edit (see below); catalog management (install, update, restore) lives in the App Store data app (see App Store page below). Deep links at `/apps/:id` SHALL be unchanged. The Apps page SHALL render the three sections in order: Pinned (user-chosen tiles, omitted when empty), Recent (behavior-driven tiles with a Clear control, omitted when empty), and All apps (every installed app except hidden ones; pinned apps included). Each tile links to `/apps/:id` — except modal-capable apps, whose tiles link to an inline overlay section on the same page opened by fragment (`#app-<id>`) via CSS `:target` and closed by a back link. The overlay SHALL contain the same section HTML as the app page (bundle UI, live state, action forms), fully present in the server-rendered HTML; JS may enhance it. Every tile SHALL show the app's icon glyph or sanitized SVG mark and label. A fresh install SHALL open with an empty registry — no apps are seeded, including no App Store; with no apps installed, both `/` and the Apps page SHALL render the same Help-style help text with two copy-paste prompts (install the App Store, agent-only via the App Store recipe; add your own apps) instead of an empty tile list, rendered from the same shared shell block. With apps installed but none on Home, `/` SHALL instead show a short message prompting the user to add apps to Home from the Apps page via Apps Edit's Add to home control.

#### Scenario: Empty registry is honest
- **WHEN** no apps are installed
- **THEN** both `/` and the Apps page respond 200 with honest empty states and guidance toward adding apps.

#### Scenario: Empty Apps page shows two prompts
- **WHEN** the Apps page is fetched with no apps installed
- **THEN** it shows Help-style help text with a prompt for adding your own apps first and a prompt for installing the App Store second, each as selectable text in a gate-hint code block, with no copy button and no Clipboard API use, and with no Edit button. The App Store prompt is agent-only: it points at the App Store recipe (`catalog/app-store/RECIPE.md`) and stops there, with no inline install steps; it SHALL NOT name a browser install path.

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

### Requirement: User-facing display name is app

User-facing text SHALL call an installed unit an app, and
the Store "App Store". "Widget" SHALL keep meaning the
compact Home rendering of an app, not the app itself.
Internal identifiers SHALL stay `app`: MCP exports, routes,
storage keys, and type names SHALL NOT change. Covered surfaces
are listed in the scenarios below.

(Reversed 2026-11-06: the user-facing term was briefly the hyphenated diminutive form (change mini-apps-user-facing, archived 2026-11-06); the user chose plain "Apps" instead, and the hyphenated wording was removed throughout. The top menu bar link reads "Apps", as does the Apps page.)

(Note: this delta's "Home empty hint says mini-apps" scenario is NOT carried here — it is
superseded by the empty-install two-state Home rendering merged above: with apps
installed but none on Home, `/` shows "No widgets yet" with the Add-to-home prompt, not a
Store install hint.)

#### Scenario: Menu and Apps page say apps
- **WHEN** any shell page is fetched
- **THEN** the menu link reads "Apps", the Apps page title and section head read "Apps", and its sections read "All apps" and "Edit apps".

#### Scenario: Store page says App Store
- **WHEN** the Store page is fetched
- **THEN** its title, label, and description read "App Store" / "Install and update apps from the catalog…", its intro, no-JavaScript note, loading and failure status, capability line, and confirm-dialog wording say app(s), and its route is still `/apps/app-store` with id `app-store`.

#### Scenario: Help states adding apps
- **WHEN** the Help page is fetched
- **THEN** its heading reads "Adding apps", and its add prompt prose says app while its code keeps `add_app`, `list_apps`, and `get_app_state`.

#### Scenario: Titles, headings, and prompts follow the same rule
- **WHEN** a page title, a Store or Help display string, or an empty-state prompt is rendered
- **THEN** document titles read "Apps · {title}" or "App Store · {title}", the Store bundle's intro, no-JavaScript note, status, capability line, and confirm-dialog wording say app(s), Help's add prompt prose says app while its code keeps `add_app`, `list_apps`, and the adding-an-app skill path, the `empty-install` prompts use app wording, and the Pinned and Recent headings are unchanged.

#### Scenario: Widget still means the Home rendering
- **WHEN** an app is pinned to the homepage
- **THEN** `/` shows its widget, and the word "widget" refers to that Home rendering, not to the app itself.

#### Scenario: Internal identifiers are unchanged
- **WHEN** the shell's MCP exports, routes, storage keys, and type names are listed
- **THEN** they still read `list_apps`, `add_app`, `remove_app`, `get_app_state`, `/apps`, `/apps/:id`, `kody-os.apps.*`, and `AppDefinition`, with no `app` spelling in any of them.

### Requirement: Pinned section

The shell SHALL render a Pinned section above Recent listing pinned apps in pin order. A pinned app that is also hidden SHALL still appear in Pinned. An empty pinned list SHALL omit the section entirely. Pinned tiles SHALL span two grid columns (three per row at full width) at the standard tile height, with the icon fixed left and the label plus description stacked right. Every tile link on the Apps screen (Pinned, Recent, All apps) SHALL carry the app description as a `title` tooltip.

#### Scenario: Hidden pinned app stays visible in Pinned only
- **WHEN** a pinned app is hidden via Apps Edit
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

The shell SHALL render an expand control in the titlebar of every app page (`GET /apps/:id`), at the far right opposite the close box, and SHALL NOT render it on the dashboard, Apps page, 404 page, modal overlay, home widget, Help page, or About page. Activating the control SHALL switch to a full-window view with no JavaScript and without the browser Fullscreen API: the window SHALL span `100%` of the viewport width with no side margin or border, its top SHALL be flush with the top of the viewport, the menubar and status bar SHALL be hidden, and the main-content gutter SHALL be removed so the app panel spans edge-to-edge. The expanded view SHALL NOT force a viewport height; content height and scrolling SHALL follow the app's content as on the normal page. The expanded state SHALL be carried entirely in the URL fragment, requiring no server, storage, or session state; a full navigation MAY drop it and return the normal page. In the expanded view the control SHALL become a collapse affordance that restores the normal centered chrome. Widget and modal expand boxes SHALL keep their current behavior. Help and About are built-in shell pages, not app pages, so they SHALL NOT carry the control.

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

### Requirement: One route set for UI and synthetic traffic
The shell SHALL route mount-tolerantly: it slices the request path from the first `/apps/` occurrence so mounted, synthetic (`packageAppFetch`), and stripped requests route identically. The HTTP method match SHALL be case-insensitive.

#### Scenario: Mounted and stripped paths route the same
- **WHEN** the handler receives `/kody-os/apps/counter` or `/apps/counter`
- **THEN** both render the same app page with the same state.

### Requirement: Single shared chrome

Every page SHALL use the same chrome: title bar with the page title and a close box (labeled with its destination, omitted on the dashboard); menu strip with the left cluster of brand mark plus product name from `settings.json` (default `kody-os`) followed immediately by Home and Apps links, then the menu-app links specified in `Top menu bar links`, then the built-in Help and About links when their pages are enabled (no Refresh link); main content; footer with status text and no home navigation — and NO auth path element, because the shell performs no access check and there is no `via kody` / `locked` to report; `data-pak-config` carrying the current phase; and a right-aligned date and time (server-rendered UTC on each navigation; a client tick SHALL keep it live in the browser's local time zone where JavaScript runs). The titlebar close box on an app page SHALL return to the opener (`/` or `/apps`, carried as a validated `from` param on the tile link); with no valid `from` it SHALL go Home. The dashboard at `GET /` SHALL omit the close box (it already is home) and every other page SHALL show it. The document title SHALL read `{page} · {title}` where `{title}` is the theme title when set, else the theme name. Body background and header mark SHALL likewise render from the settings file with current values as defaults.

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

The shell SHALL derive menu-app links from installed definitions on each render. There SHALL be no menu storage key, no menu order list, and no menu toggle in Apps Edit or anywhere else in the browser UI. Installing a flagged app SHALL add its link on the next render; no separate menu write SHALL exist. The built-in Help and About links are the only menu links not derived from installed apps: they are shell-owned, shown when their pages are enabled, and never stored.

#### Scenario: No menu write on install
- **WHEN** a flagged app is installed via `add_app`, `install_from_catalog`, or import
- **THEN** its link appears on the next Home, Apps, or app page render, and no menu-specific storage key is written.

#### Scenario: Built-in links need no install
- **WHEN** no apps are installed and Help is enabled
- **THEN** the menu still shows the Help link (and About, when enabled), and no menu-specific storage key is written.

### Requirement: Apps Edit

The Apps page SHALL offer Edit mode at `GET /apps?edit=1`, shown only when at least one app is installed. Edit mode SHALL list every installed app, including hidden ones, alphabetical by label with id as tie-break, each row with Pin, Hide, and Home state toggles as plain GET forms through the `/apps` mutation route, each responding 303 back to `?edit=1`. Toggles are icon-only buttons: `aria-checked` carries the current state and the submitted `want` value is the opposite, so no JavaScript is required. Pinned and Recent SHALL stay tiles in both modes. The "All apps are hidden" hint SHALL point at Apps Edit, not at the App Store. A Store request carrying `?pin=`, `?hide=`, or `?home=` SHALL render an inline error naming that launcher management moved to Apps Edit, and SHALL change nothing.

#### Scenario: Edit lists a hidden app and unhiding returns it to browse
- **WHEN** Edit mode is opened with a hidden app installed
- **THEN** the hidden app appears as a row with its Hide toggle in the on state, and submitting it 303s back to Edit mode with the app visible in browse mode.

#### Scenario: Edit mutations stay in Edit mode
- **WHEN** a Pin, Hide, or Home control is submitted from Edit mode
- **THEN** the response is a 303 back to `/apps?edit=1`, not to browse mode.

#### Scenario: Empty registry shows no Edit toggle
- **WHEN** the Apps page is fetched with no apps installed
- **THEN** it shows the honest empty state with no Edit button.

### Requirement: App Store page is a data app

The App Store app page (`GET /apps/app-store`) SHALL be the generic app page for the installed store bundle, not a shell special case. The bundle SHALL render a catalog-only list as defined in the app-registry spec: one row per catalog id, in alphabetical-by-id order, each row showing the app's icon, label, and description, with a status badge where its status is not plain not-installed (not-installed rows carry no badge). The App Store itself appears as a row like any other app; it is not excluded from its own list. The list is unfiltered, so hidden apps appear in it. Rows SHALL be fetched through the shell management API, and install/update/restore SHALL be management API calls (see app-registry), re-rendering the rows on success and showing an error on failure without changing storage for a failed id. A row for an app that is not installed SHALL offer an Add control and no Open link, no Pin, Hide, or Home control, and no Update or Restore control — no launching from the catalog. An installed catalog app with a snapshot SHALL additionally show its update status under the app-registry spec: behind-and-clean and catalog-differing rows offer an Update control; behind-and-modified rows offer a confirmed Overwrite control (see below), not a plain Update control; modified-at-current-version rows offer Restore catalog version; ahead rows offer Restore catalog version, never Update; up-to-date rows offer a Remove control. A row for an installed catalog app without a snapshot SHALL show Installed and offer a confirmed Overwrite control under this scheme. Installed apps with no catalog entry do not appear in the list. The Store SHALL require JavaScript: without it, the page shows a note pointing at agent `add_app`, with no rows. The Store SHALL display the declared catalog source it is reading, labeling a cached manifest as cached with its source. When the store app is not installed, the page SHALL render a short fallback note plus the Store install path, with no rows and no other controls. The Help page SHALL present the App Store as the browser path for installing shipped apps, with the agent/`add_app` path retained for custom apps. While a row action, Update All, or the confirm dialog's Confirm is in flight, its button SHALL be disabled and show a working label naming the action (Adding…, Updating…, Overwriting…, Restoring…, Removing…, Updating all…, Confirming…); when the action settles without re-rendering the rows, the button SHALL be re-enabled with its original label. No rotating or timer-driven spinner is used: the shell forbids animation.

#### Scenario: Behind-and-clean row offers update
- **WHEN** an installed catalog app matches its snapshot at a lower version than the catalog
- **THEN** its row shows Update, and submitting it updates the app and re-renders the rows.

#### Scenario: Snapshot-less row offers Overwrite
- **WHEN** an installed catalog app has no snapshot
- **THEN** its row shows Installed and offers Overwrite, and confirming replaces its definition with the catalog copy and records a snapshot.

#### Scenario: Store list shows catalog apps once each
- **WHEN** the App Store page is fetched with catalog apps installed and uninstalled, plus an installed app with no catalog entry, plus the App Store itself
- **THEN** every catalog id appears exactly once, in alphabetical-by-id order, with its icon, label, and description, and a status badge where applicable — including `app-store` itself — and the installed app with no catalog entry does not appear.

#### Scenario: Catalog-only row has no launch control
- **WHEN** a catalog app that is not installed is rendered in the Store list
- **THEN** its row offers Add and no link to its app page, since there is nothing installed to open.

#### Scenario: Store requires JavaScript
- **WHEN** the App Store page is fetched with JavaScript unavailable
- **THEN** it shows a note pointing at agent `add_app`, with no rows, and changes nothing.

#### Scenario: Installed rows offer no Install or launcher control
- **WHEN** an installed catalog app's row is rendered
- **THEN** it shows its status and no Add form for that id, and no Pin, Hide, or Home control.

#### Scenario: Unknown install id is a clean error
- **WHEN** an install is requested for an unknown id
- **THEN** the Store shows an error, the rows still render, and storage is unchanged.

#### Scenario: Store page keeps shell constraints
- **WHEN** the App Store page is fetched
- **THEN** it carries the normal chrome, exactly one `<style>` block, zero external stylesheets, and no mutating POST form.

#### Scenario: A row action button is busy while its request runs
- **WHEN** a row's Add button is pressed and its install request is still in flight
- **THEN** that button is disabled and reads "Adding…", a second press fires no second request, and when the request fails the button is re-enabled reading "Add" while the error is shown.

### Requirement: Confirmed update for a modified app

Submitting an update (or restore) for a modified catalog app SHALL NOT apply the update immediately. It SHALL first show the Store bundle's confirmation UI, backed by a management API needs-confirmation response, stating that updating will replace the app's definition — bundle files, stateSchema, actions, capabilities, and metadata — with the catalog copy and that the user's custom definition changes will be lost and cannot be recovered afterwards unless the app was exported first, and stating that state is preserved for fields still declared in the new definition while dropped fields reset to their initial values. Only an explicit confirmation submission in that UI SHALL apply the update, through the registry update path, and re-render the rows. Declining or leaving the confirmation UI SHALL change nothing. An update or restore for an unknown id, an uninstalled id, or a non-catalog id SHALL show an error in the Store and change nothing. A Store update that adds a capability (see app-registry) SHALL also require confirmation naming the additions.

#### Scenario: Modified update waits for confirmation
- **WHEN** a confirmed update is requested for a modified catalog app
- **THEN** the store shows its confirmation UI with the loss and state-preservation wording, and storage is unchanged until confirmation.

#### Scenario: Confirmed update replaces definition and keeps surviving state
- **WHEN** the confirmation is submitted for a modified catalog app
- **THEN** its definition is replaced with the catalog copy, state for surviving fields is preserved, dropped fields reset, pins and homepage placement are untouched, and a new snapshot is recorded.

#### Scenario: Declined update changes nothing
- **WHEN** the confirmation UI is left without confirming
- **THEN** the installed definition, state, and snapshot are unchanged.

#### Scenario: Ahead app offers restore, not update
- **WHEN** an installed catalog app is modified and ahead of the catalog
- **THEN** its row offers Restore catalog version with the confirmation and warning, never an Update control.

### Requirement: Shell theme override is read fresh on every request

The shell's `fetch()` SHALL resolve the file theme exactly as today (including its once-per-publish cache), read the storage override fresh on every request via the theme module (never from the file cache), merge the two per field per the os-theme override requirement, and render the merged theme on every page. The override read SHALL NOT be cached across requests in v1.

#### Scenario: A set shows up on the next page render

- **WHEN** an override is set and the next page is requested without a republish
- **THEN** that page renders the new effective theme.

### Requirement: Agent access to the theme override

The package SHALL export `get_shell_theme`, `set_shell_theme`, and `reset_shell_theme`, and SHALL list all three in `main()`'s exports. `get_shell_theme` SHALL return `{ defaults, override, effective }`: `defaults` are the file-resolved values, `override` is the stored partial (only fields actually set), and `effective` is the per-field merge, all in file terms (`name`, `title`, `icon`, `background`, `showHelp`, `showAbout`). `set_shell_theme` SHALL take the partial payload defined by the os-theme override requirement and return `{ ok: true, override, effective }` or `{ ok: false, error }` with no write. `reset_shell_theme` SHALL take an optional `field` and return `{ ok: true, effective }`. Like every other MCP export, these SHALL NOT be routed through `fetch()` at all (there is no shell gate in `fetch()` any more).

#### Scenario: Agent reads what is overridden and what is not
- **WHEN** an agent calls `get_shell_theme` with only `background` overridden
- **THEN** the result's `override` holds only `background`, and `defaults` and `effective` differ only in that field.

#### Scenario: Invalid agent set writes nothing
- **WHEN** an agent calls `set_shell_theme` with one valid field and one invalid field
- **THEN** the result is `{ ok: false, error }` and the previously stored override is unchanged.

### Requirement: Capability-gated theme routes for apps

The shell SHALL serve `GET /theme/:app` (read) and GET-action routes `GET /theme/:app?action=set&...` and `GET /theme/:app?action=reset[&field=...]`, dispatched after the `/feed/` route (dispatch order is `/apps/` branches, then `/manage/`, then `/proxy/`, then `/feed/`, then the 404 fallthrough), so an app id of `theme` still renders its app page. There is no shell gate in `fetch()` for these routes to inherit; who reaches them is decided by Kody's platform gate before shell code runs. The read route SHALL return JSON `{ ok: true, defaults, override, effective }` with `no-store`. Set / reset SHALL return JSON `{ ok: true, override, effective }` when `format=json` is present, and otherwise 303 back to the `from` path, defaulting to the app's page. Set query parameters SHALL follow the os-theme set semantics, with a grid background passed as `background_grid` (eight comma-separated integers) when the caller needs it. No POST route SHALL be added for theme.

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

### Requirement: About is a built-in shell page

The shell SHALL serve a built-in About page at `GET /about` rendering the About content — the same content the about catalog app rendered (the "About kody-os" description, the donation links for GitHub Sponsors, Ko-fi, and Buy Me a Coffee, the QR code, and a referral note at the bottom) — as a shell page in the shared chrome, not a catalog app. `GET /apps/about` SHALL fall through to the existing unknown-app handling (plain 404). About SHALL NOT appear in the Apps list, Edit mode, pin/hide/home controls, home widgets, or the App Store list. When About is disabled via the settings file, `GET /about` SHALL respond 404 and the menu SHALL show no About link. The About page is a shell page, not an app page, so it SHALL NOT carry the page-mode expand control.

#### Scenario: About renders the About content
- **WHEN** `/about` is opened with About enabled
- **THEN** it responds 200 with the About description, donation links, QR code, and referral note, inside the shared chrome.

#### Scenario: About shows the Kody referral note
- **WHEN** `/about` is opened
- **THEN** the bottom of the page invites readers signing up for a Kody Pro account to use the referral code `hypercubed`.

#### Scenario: About app URL is unknown
- **WHEN** `/apps/about` is opened
- **THEN** the shell responds 404 (unknown app), and About appears in no app listing.

#### Scenario: Disabled About hides page and link
- **WHEN** About is disabled and `/about` is opened
- **THEN** it responds 404, and no page shows an About menu link.
