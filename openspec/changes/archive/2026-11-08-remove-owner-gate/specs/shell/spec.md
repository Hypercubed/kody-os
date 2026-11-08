# shell Specification Delta

## Purpose

Remove the shell's owner gate and its traces from the chrome: no locked page, no footer auth path, no device gate for routes to inherit. Access is decided by Kody's platform gate before shell code runs.

## MODIFIED Requirements

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
