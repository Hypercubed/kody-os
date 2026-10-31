# Help Page Specification

## Purpose
A static in-OS reference so a human holding the device (or an agent describing it) can answer "what is this, how do apps get here" without leaving the shell.

## Requirements

### Requirement: Help is a catalog app, not a static page

The shell SHALL NOT serve a static Help page at `GET /help`.
Instead, Help SHALL be a catalog app (`help`, stateless, no
actions, page, `ui.menuBar: true`) whose bundle carries the
reference content: what the OS is, how agents add apps via MCP
`add_app` with the README's recommended prompt, and the setup
guide (`pkg/docs/setup.md`) as the first-run/fork setup path.
The help app page SHALL NOT list installed apps. `GET /help`
SHALL respond 303 to `/apps/help`, preserving the request's
query string. The header SHALL link Help only when the help
app is installed, as a menu-app link in label order — there
SHALL be no static Help link in the shell chrome, and a fresh
install without the help app installed SHALL show no Help link.

#### Scenario: Help explains adding apps, as an app

- **WHEN** the help app is installed and `/apps/help` is opened
- **THEN** it responds 200, omits an installed-apps list, and
  describes the agent add flow using the README prompt.

#### Scenario: Help points to the setup guide

- **WHEN** `/apps/help` is opened
- **THEN** it names the setup guide as the path for first-run
  and fork setup, distinct from the agent add flow for custom
  apps.

#### Scenario: Old Help URL redirects, query preserved

- **WHEN** `/help?k=<code>` is opened
- **THEN** it responds 303 to `/apps/help?k=<code>`.

#### Scenario: No help app, no Help link

- **WHEN** the help app is not installed
- **THEN** Home, Apps, and app pages show no Help link.

#### Scenario: Help app page is an ordinary app page

- **WHEN** `/apps/help` is opened
- **THEN** it renders like any app page, including the page-mode
  expand control. The old shell rule "no expand control on the
  Help page" referred to the static `/help` page, which no
  longer exists; it does not apply to the help app page.
