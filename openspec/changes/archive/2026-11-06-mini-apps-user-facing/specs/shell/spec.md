# Spec Delta

## ADDED Requirements

### Requirement: User-facing display name is mini-app

User-facing text SHALL call an installed unit a mini-app, and
the Store "Mini-App Store". "Widget" SHALL keep meaning the
compact Home rendering of a mini-app, not the mini-app itself.
Internal identifiers SHALL stay `app`: MCP exports, routes,
storage keys, and type names SHALL NOT change. Covered surfaces
are listed in the scenarios below.

#### Scenario: Menu and Mini-apps page say mini-apps
- **WHEN** any shell page is fetched
- **THEN** the menu link reads "Mini-apps", the Mini-apps page title and section head read "Mini-apps", its sections read "All mini-apps" and "Edit mini-apps", and no user-facing bare "app" appears outside the allowlist in the scenarios below.

#### Scenario: Store page says Mini-App Store
- **WHEN** the Store page is fetched
- **THEN** its title, label, and description read "Mini-App Store" / "Install and update mini-apps from the catalog…", its intro, no-JavaScript note, loading and failure status, capability line, and confirm-dialog wording say mini-app(s), and its route is still `/apps/app-store` with id `app-store`.

#### Scenario: Help glossary states the mapping once
- **WHEN** the Help page is fetched
- **THEN** its intro states that a mini-app is an installed app, called a mini-app in the browser and an app by the agent tools, its heading reads "Adding mini-apps", and its add prompt prose says mini-app while its code keeps `add_app`, `list_apps`, and `get_app_state`.

#### Scenario: Home empty hint says mini-apps
- **WHEN** `/` is fetched with an empty homepage list
- **THEN** its empty hint reads "Install mini-apps from the Mini-App Store…" and points at the Store's "Add to home" control.

#### Scenario: Titles, headings, and prompts follow the same rule
- **WHEN** a page title, a Store or Help display string, or an empty-state prompt is rendered
- **THEN** document titles read "Mini-apps · {title}" or "Mini-App Store · {title}", the Store bundle's intro, no-JavaScript note, status, capability line, and confirm-dialog wording say mini-app(s), Help's add prompt prose says mini-app while its code keeps `add_app`, `list_apps`, and the adding-an-app skill path, the `empty-install` prompts use mini-app wording, and the Pinned and Recent headings are unchanged.

#### Scenario: Widget still means the Home rendering
- **WHEN** a mini-app is pinned to the homepage
- **THEN** `/` shows its widget, and the word "widget" refers to that Home rendering, not to the mini-app itself.

#### Scenario: Internal identifiers are unchanged
- **WHEN** the shell's MCP exports, routes, storage keys, and type names are listed
- **THEN** they still read `list_apps`, `add_app`, `remove_app`, `get_app_state`, `/apps`, `/apps/:id`, `kody-os.apps.*`, and `AppDefinition`, with no `mini-app` spelling in any of them.
