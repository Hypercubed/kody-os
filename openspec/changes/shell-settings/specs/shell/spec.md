# Spec Delta

## ADDED Requirements

### Requirement: Shell theme override is read fresh on every request

The shell's `fetch()` SHALL resolve the file theme exactly as today (including its once-per-publish cache), read the storage override fresh on every request via the theme module (never from the file cache), merge the two per field per the os-theme override requirement, and render the merged theme on every page. The override read SHALL NOT be cached across requests in v1.

#### Scenario: A set shows up on the next page render

- **WHEN** an override is set and the next page is requested without a republish
- **THEN** that page renders the new effective theme.

### Requirement: Agent access to the theme override

The package SHALL export `get_shell_theme`, `set_shell_theme`, and `reset_shell_theme`, and SHALL list all three in `main()`'s exports. `get_shell_theme` SHALL return `{ defaults, override, effective }`: `defaults` are the file-resolved values, `override` is the stored partial (only fields actually set), and `effective` is the per-field merge, all in file terms (`name`, `title`, `icon`, `background`). `set_shell_theme` SHALL take the partial payload defined by the os-theme override requirement and return `{ ok: true, override, effective }` or `{ ok: false, error }` with no write. `reset_shell_theme` SHALL take an optional `field` and return `{ ok: true, effective }`. Like every other MCP export, these SHALL NOT be routed through `fetch()`'s device gate.

#### Scenario: Agent reads what is overridden and what is not

- **WHEN** an agent calls `get_shell_theme` with only `background` overridden
- **THEN** the result's `override` holds only `background`, and `defaults` and `effective` differ only in that field.

#### Scenario: Invalid agent set writes nothing

- **WHEN** an agent calls `set_shell_theme` with one valid field and one invalid field
- **THEN** the result is `{ ok: false, error }` and the previously stored override is unchanged.

### Requirement: Capability-gated theme routes for apps

The shell SHALL serve `GET /theme/:app` (read) and GET-action routes `GET /theme/:app?action=set&...` and `GET /theme/:app?action=reset[&field=...]`, dispatched after the `/apps/` branches and alongside the `/feed/` route, so they inherit the device gate in `fetch()` and so an app id of `theme` still renders its app page. The read route SHALL return JSON `{ ok: true, defaults, override, effective }` with `no-store`. Set / reset SHALL return JSON `{ ok: true, override, effective }` when `format=json` is present, and otherwise 303 back to the `from` path, defaulting to the app's page. Set query parameters SHALL follow the os-theme set semantics, with a grid background passed as `background_grid` (eight comma-separated integers) when the caller needs it. No POST route SHALL be added for theme.

Every theme route SHALL resolve the `:app` slug, load that app's stored definition, and require `capabilities.theme.view` for reads and `capabilities.theme.set` for set / reset. Any gate failure — unknown app, malformed slug, app without the declaration, or a view-only app calling set / reset — SHALL return the feed-style plain 404, with no theme and no capability detail. A gated app with an invalid value SHALL get JSON `{ ok: false, error }` (400) and no write. An unauthenticated request to any theme route SHALL get the locked page, never theme. Mutation URLs SHALL never be rendered as plain `<a href>` links.

#### Scenario: Declared app reads, sets, and resets

- **WHEN** an app declaring `capabilities.theme: { view: true, set: true }` calls the read, set, and reset routes with a valid session
- **THEN** read returns the split values, set returns the new effective theme, and reset returns the file-default effective theme.

#### Scenario: Undeclared app gets a plain 404

- **WHEN** an app without the theme declaration, an unknown app, or a view-only app calling set requests a theme route
- **THEN** the response is a plain 404 with no theme and no capability detail, and storage is unchanged.

#### Scenario: No-JS set round-trips

- **WHEN** a plain GET form submits a set to a theme route without JavaScript and without `format=json`
- **THEN** the server responds 303 back to the app's page, and the next render shows the new effective theme.
