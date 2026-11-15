# Spec Delta

## Purpose

Widget action forms lose the hidden `from` field with the rest of
the shell's return mechanism. A widget action's return to the
dashboard is the JavaScript fast path staying in place; the
native-submit fallback lands on the app page instead of the
dashboard, per the accepted no-JS scope of this change.

## MODIFIED Requirements

### Requirement: Widget actions use the shared handler

Widget forms SHALL submit to the same `act()` path as app pages
and the MCP interface, with no return field and no return query
value. With the JavaScript fast path they SHALL patch in place and
stay on `/`. A bad widget action SHALL show an inline error in the
widget with unchanged state when the fast path runs, and SHALL
re-render the app page with an inline error when it falls back to
a native submit. Bundle buttons in widgets SHALL resolve their
action URLs against the widget bundle container's
`data-action-base`, so they act on the owning app from the
dashboard.

#### Scenario: Bundle buttons act from the dashboard
- **WHEN** a widget bundle button (e.g. counter +1) is activated on `/`
- **THEN** the owning app's state updates and the dashboard reflects the new state, exactly as if the button had been pressed on the app page.

#### Scenario: Bad widget action is clean
- **WHEN** a widget form posts an invalid action with JavaScript running
- **THEN** the dashboard shows the error in place, and a state re-read is unchanged.
- **WHEN** the same form posts without JavaScript
- **THEN** the app page re-renders showing the error, and a state re-read is unchanged.
