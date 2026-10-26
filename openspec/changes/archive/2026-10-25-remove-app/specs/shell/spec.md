## MODIFIED Requirements

### Requirement: Edit mode with pin and hide toggles

The All apps section SHALL offer an Edit control inline in its header that switches the section into edit mode: it lists every installed app including hidden and pinned ones with their current pin/hide state, each with a pin toggle and a hide toggle that persist immediately. Exiting edit mode SHALL return to the normal filtered view. The edit UI SHALL NOT expose a remove or delete control; removal is MCP-only via `remove_app`.

#### Scenario: Edit shows hidden apps that browsing hides
- **WHEN** an app is hidden and edit mode is opened
- **THEN** the app appears in the edit list with its hidden state set, while the normal All apps section omits it.

#### Scenario: Edit mode offers no removal control
- **WHEN** edit mode is opened for any installed app
- **THEN** the row offers pin and hide toggles only, with no remove or delete control.
