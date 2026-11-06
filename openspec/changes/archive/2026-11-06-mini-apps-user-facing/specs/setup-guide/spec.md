# Spec Delta

## ADDED Requirements

### Requirement: Setup guide uses mini-apps in user-facing prose

User-facing prose in the setup guide (`pkg/docs/setup.md`) and
in `pkg/README.md` SHALL call an installed unit a mini-app
("mini-apps" plural) and the Store the "Mini-App Store". Code,
MCP names, routes, and storage keys in those documents SHALL stay
`app`: `add_app`, `list_apps`, `get_app_state`, `/apps`,
`/apps/:id`, and `kody-os.apps.*` SHALL NOT be respelled. The
adding-an-app skill SHALL stay unchanged.

#### Scenario: Guide prose says mini-apps, code stays app
- **WHEN** the setup guide and README are read
- **THEN** their prose reads "Mini-apps are JSON definitions…", "the mini-app appears on the Mini-apps page", and "Add further mini-apps the same way", while their code samples and tool names still read `add_app`, `list_apps`, `/apps`, and `kody-os.apps.*`.

#### Scenario: Guide's first-app check still uses app tool names
- **WHEN** a user follows the guide's first-app verification step
- **THEN** the check still names `list_apps`, `get_app_state`, and `GET /apps/<id>`, and the Mini-apps page lists the new mini-app.
