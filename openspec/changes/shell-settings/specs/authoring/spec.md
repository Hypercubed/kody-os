# Spec Delta

## ADDED Requirements

### Requirement: Theme capability declaration for apps

App definitions SHALL support `capabilities.theme: { view: boolean, set: boolean }`, next to `capabilities.feeds` and `capabilities.email`. `view` SHALL allow the theme read route; `set` SHALL allow the theme set and reset routes. A route SHALL check exactly the flag it needs. A definition with neither flag true SHALL be treated as not declaring theme. Any other shape SHALL fail definition validation, and install-time sanitizing SHALL normalize missing flags to `false`. Existing `feeds` and `email` declarations and validation SHALL be unchanged.

`act()` SHALL be unchanged by this change: no shell-theme effect operator is added, and an app's actions SHALL continue to write only that app's own state. Apps reach the theme override through the theme routes, not through `act()`.

#### Scenario: View-only app cannot set

- **WHEN** an app declaring only `capabilities.theme: { view: true }` calls a theme set route
- **THEN** it gets the plain 404 defined by the shell theme-route requirement, and storage is unchanged.

#### Scenario: Malformed declaration fails validation

- **WHEN** a definition carries `capabilities.theme` in any shape other than `{ view: boolean, set: boolean }`
- **THEN** validation fails and nothing is installed.

#### Scenario: Act does not touch theme

- **WHEN** an app acts on its own state
- **THEN** the theme override is unchanged, and the theme routes still report the previous override.
