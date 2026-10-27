# OS Shell

## Purpose
Capture the shipped Phase 2 browser shell so future changes (theme, routing, Scribe hardening) verify against it instead of re-deriving from code.

## Requirements

### Requirement: Home launcher lists installed apps

The shell SHALL render a home page at `GET /` showing the widget dashboard (see widget-home), and the Apps grid — Pinned, Recent, and All-apps sections with edit mode — SHALL live behind the Apps menu link instead of at `/`. Deep links at `/apps/:id` SHALL be unchanged. The Apps page SHALL render the three sections in order: Pinned (user-chosen tiles, omitted when empty), Recent (behavior-driven tiles with a Clear control, omitted when empty), and All apps (every installed app except hidden ones; pinned apps included). Each tile links to `/apps/:id` — except modal-capable apps, whose tiles link to an inline overlay section on the same page opened by fragment (`#app-<id>`) via CSS `:target` and closed by a back link. The overlay SHALL contain the same section HTML as the app page (bundle UI, live state, action forms), fully present in the server-rendered HTML; JS may enhance it. Every tile SHALL show the app's icon glyph or sanitized SVG mark and label. With no apps installed at all, both `/` and the Apps page SHALL render honest empty states with guidance toward adding apps.

#### Scenario: Empty registry is honest
- **WHEN** no apps are installed
- **THEN** both `/` and the Apps page respond 200 with honest empty states and guidance toward adding apps.

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

### Requirement: Pinned section

The shell SHALL render a Pinned section above Recent listing pinned apps in pin order. A pinned app that is also hidden SHALL still appear in Pinned. An empty pinned list SHALL omit the section entirely.

#### Scenario: Hidden pinned app stays visible in Pinned only
- **WHEN** a pinned app is hidden via edit mode
- **THEN** it remains in the Pinned section and disappears from the All apps section.

### Requirement: Recent section with Clear

The shell SHALL render a Recent section listing the most recently used apps (most recent first, capped at a fixed count), with a Clear control inline in its header that empties it. An app counts as used when its page is opened or one of its actions succeeds. An empty recent list SHALL omit the section entirely.

#### Scenario: Clear empties Recent without touching apps
- **WHEN** Clear is submitted
- **THEN** the Recent section disappears and installed apps, pins, and hidden flags are unchanged.

### Requirement: Edit mode with pin and hide toggles

The All apps section SHALL offer an Edit control inline in its header that switches the section into edit mode: it lists every installed app including hidden and pinned ones with their current pin/hide/homepage state, each with a pin toggle, a hide toggle, and an add/remove-from-homepage toggle that persist immediately. Exiting edit mode SHALL return to the normal filtered view. The edit UI SHALL NOT expose a remove or delete control; removal is MCP-only via `remove_app`.

#### Scenario: Edit shows hidden apps that browsing hides
- **WHEN** an app is hidden and edit mode is opened
- **THEN** the app appears in the edit list with its hidden state set, while the normal All apps section omits it.

#### Scenario: Edit mode offers no removal control
- **WHEN** edit mode is opened for any installed app
- **THEN** the row offers pin, hide, and homepage toggles, with no remove or delete control.

### Requirement: App pages render definition plus live state
The shell SHALL render one page per app at `GET /apps/:id` showing the app's title (in the shell window's titlebar only — the panel itself SHALL NOT repeat a title header), its description when present, every state field, and one HTML form button per declared UI action. Unknown ids SHALL return the 404 page. Modal overlays SHALL keep the panel's own title header, since the underlying page chrome shows the Apps title, not the app's.

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

### Requirement: One route set for UI and synthetic traffic
The shell SHALL route mount-tolerantly: it slices the request path from the first `/apps/` occurrence so mounted, synthetic (`packageAppFetch`), and stripped requests route identically. The HTTP method match SHALL be case-insensitive.

#### Scenario: Mounted and stripped paths route the same
- **WHEN** the handler receives `/kody-os/apps/hello-counter` or `/apps/hello-counter`
- **THEN** both render the same app page with the same state.

### Requirement: Single shared chrome

Every page SHALL use the same chrome: title bar with the page title and a close box (labeled `Home`, omitted on the dashboard); menu strip with the left cluster of brand mark plus product name from `os-theme.json` (default `kody-os`) followed immediately by Home, Apps, and Help links (no Refresh link); main content; footer with status text, the active auth path (`via kody`, `via cookie`, `via key`, or `locked`), and no home navigation; `data-pak-config` carrying the current phase; and a right-aligned date and time (server-rendered UTC on each navigation; a client tick SHALL keep it live in the browser's local time zone where JavaScript runs). The titlebar close box SHALL be the titlebar's way home; the dashboard at `GET /` SHALL omit it (it already is home) and every other page SHALL show it. The document title SHALL read `{page} · {title}` where `{title}` is the theme title when set, else the theme name. Body background and header mark SHALL likewise render from the theme file with current values as defaults.

#### Scenario: Unknown routes keep the chrome
- **WHEN** a request hits an unknown path
- **THEN** the shell responds 404 inside the full chrome with plain "Not found." text and no home link in the body; the titlebar close box is the way back.

#### Scenario: Header order and clock
- **WHEN** any page is fetched
- **THEN** the header reads brand, Home, Apps, Help left to right with no Refresh link, and shows a date + time on the far right.

#### Scenario: Defaults preserve current rendering
- **WHEN** no theme file is present
- **THEN** title, brand, and background are byte-identical to the pre-change shell.

#### Scenario: Footer names the auth path
- **WHEN** any page is fetched
- **THEN** the footer states which path authenticated the request (`via kody`, `via cookie`, `via key`, or `locked`).

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
`GET /apps/:id` SHALL render the existing shell chrome (title, nav, inlined theme, single `<style>`, zero external assets) with the bundle's `index.html` content inlined into the app panel (or overlay for modal placement). Bundle `<script>` and `<style>` content SHALL be inlined with the entry. Any shell-side hosting code SHALL meet the ES2019 ceiling.

#### Scenario: Bundle page renders in chrome
- **WHEN** a unified app page is fetched
- **THEN** the response carries the normal chrome plus the inlined bundle entry, exactly one `<style>` block, and zero `<link rel="stylesheet">` tags.

#### Scenario: Actions keep PRG behavior
- **WHEN** a form posts a valid or invalid action on a bundle app page
- **THEN** it responds 303 to the app page on success or 400 with an inline error on failure, same as any app.

### Requirement: Bundle failures degrade, never blank
Unknown ids SHALL still 404. Bundle render failures SHALL degrade to the server-rendered page, never a blank response.

#### Scenario: Broken bundle degrades gracefully
- **WHEN** a bundle entry fails to render
- **THEN** the page still returns the shell chrome with an explanatory message and a working close/back control.
