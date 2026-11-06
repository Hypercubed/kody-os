# Spec Delta

## ADDED Requirements

### Requirement: Display name maps to internal app

The display name of an installed unit SHALL be "mini-app"
("mini-apps" plural); its internal name SHALL stay "app". The
mapping is display-only: it SHALL NOT change the definition
schema, the MCP interface, storage layout, catalog behaviour, or
the export format. Only the Help and App Store catalog definitions
change for this requirement, each with catalogVersion +1. The
adding-an-app skill name and path SHALL stay unchanged.

#### Scenario: Display name is mini-app, internal name is app
- **WHEN** a user reads the browser and an agent reads the MCP interface for the same installed unit
- **THEN** the browser calls it a mini-app and the agent interface calls it an app, and both refer to the same definition, state, and id.

#### Scenario: Store display name changes, id does not
- **WHEN** the Store is listed in its own catalog list and fetched at its route
- **THEN** its row and page read "Mini-App Store", its id is still `app-store`, its route is still `/apps/app-store`, and `install_from_catalog('app-store')` still installs it.

#### Scenario: No other catalog definition is bumped
- **WHEN** the catalog is listed after this change
- **THEN** only the Help and App Store definitions have a higher catalogVersion than before, each by exactly 1, and every other catalog definition is byte-identical to before.
