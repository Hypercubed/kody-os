# Spec Delta

## MODIFIED Requirements

### Requirement: Static Help page in full chrome

The shell SHALL serve a static Help page at `GET /help` in the full shell chrome explaining what the OS is and documenting how agents add apps via MCP `add_app`, pointing the reader to the README's recommended prompt. The page SHALL NOT list installed apps. The header SHALL link it as Help immediately after Apps. The Help page SHALL ALSO point to the setup guide (`pkg/docs/setup.md`) as the first-run/fork setup path, for a reader whose store is empty or who has just forked the package.

#### Scenario: Help explains adding apps
- **WHEN** `/help` is opened
- **THEN** it responds 200, omits an installed-apps list, and describes the agent add flow using the README prompt.

#### Scenario: Help points to the setup guide
- **WHEN** `/help` is opened
- **THEN** it names the setup guide as the path for first-run and fork setup, distinct from the agent add flow for custom apps.
