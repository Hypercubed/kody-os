## MODIFIED Requirements

### Requirement: Home launcher lists installed apps

The shell SHALL render a home page with three sections in order: Pinned (user-chosen tiles, omitted when empty), Recent (behavior-driven tiles with a Clear control, omitted when empty), and All apps (every installed app except hidden ones; pinned apps included). Each tile links to `/apps/:id` and shows the app's icon glyph and label. With no apps installed at all, the shell SHALL render the honest "no apps yet" empty state instead.

#### Scenario: Empty registry is honest
- **WHEN** no apps are installed
- **THEN** the home page responds 200 and shows the dashed "no apps yet" empty state instead of any section.

#### Scenario: Sections render in order with an app installed and pinned
- **WHEN** one app is installed, pinned, and acted on
- **THEN** the home page shows it in Pinned, in Recent, and in All apps, in that section order.

## ADDED Requirements

### Requirement: Pinned section

The shell SHALL render a Pinned section above Recent listing pinned apps in pin order. A pinned app that is also hidden SHALL still appear in Pinned. An empty pinned list SHALL omit the section entirely.

#### Scenario: Hidden pinned app stays visible in Pinned only
- **WHEN** a pinned app is hidden via edit mode
- **THEN** it remains in the Pinned section and disappears from the All apps section.

### Requirement: Recent section with Clear

The shell SHALL render a Recent section listing the most recently used apps (most recent first, capped at a fixed count), with a Clear control inline in its header that empties it. An app counts as used when its page is opened or one of its actions succeeds. An empty recent list SHALL omit the section entirely.

#### Scenario: Clear empties Recent without touching apps
- **WHEN** Clear is submitted
- **THEN** the Recent section disappears and installed apps, pins, and hidden flags are unchanged.

### Requirement: Edit mode with pin and hide toggles

The All apps section SHALL offer an Edit control inline in its header that switches the section into edit mode: it lists every installed app including hidden and pinned ones with their current pin/hide state, each with a pin toggle and a hide toggle that persist immediately. Exiting edit mode SHALL return to the normal filtered view.

#### Scenario: Edit shows hidden apps that browsing hides
- **WHEN** an app is hidden and edit mode is opened
- **THEN** the app appears in the edit list with its hidden state set, while the normal All apps section omits it.
