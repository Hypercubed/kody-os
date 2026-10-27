# Spec Delta

## Purpose

Same as the shell delta: bundle buttons in home widgets must act on the owning app, not the dashboard path.

## MODIFIED Requirements

### Requirement: Widget actions use the shared handler

Widget forms SHALL submit to the same `act()` path as app pages and the MCP interface, with PRG back to `/`. Bundle buttons in widgets SHALL resolve their action URLs against the widget bundle container's `data-action-base`, so they act on the owning app from the dashboard. A bad widget action SHALL re-render the dashboard with an inline error and unchanged state.

#### Scenario: Bundle buttons act from the dashboard

- **WHEN** a widget bundle button (e.g. counter +1) is activated on `/`
- **THEN** the owning app's state updates and the dashboard reflects the new state, exactly as if the button had been pressed on the app page.

#### Scenario: Bad widget action is clean

- **WHEN** a widget form posts an invalid action
- **THEN** the dashboard re-renders showing the error, and a state re-read is unchanged.
