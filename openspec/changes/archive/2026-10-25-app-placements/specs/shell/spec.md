## MODIFIED Requirements

### Requirement: Home launcher lists installed apps

The shell SHALL render a home page with three sections in order: Pinned (user-chosen tiles, omitted when empty), Recent (behavior-driven tiles with a Clear control, omitted when empty), and All apps (every installed app except hidden ones; pinned apps included). Each tile links to `/apps/:id` — except modal-capable apps, whose tiles link to an inline overlay section on the same page opened by fragment (`#app-<id>`) via CSS `:target` and closed by a back link. The overlay SHALL contain the same section HTML as the app page (description, live state, action forms) and SHALL work with JavaScript disabled. With no apps installed at all, the shell SHALL render the honest "no apps yet" empty state instead.

#### Scenario: Empty registry is honest
- **WHEN** no apps are installed
- **THEN** the home page responds 200 and shows the dashed "no apps yet" tile plus a hint that an agent member can add an app via MCP `add_app` with no republish.

#### Scenario: Sections render in order with an app installed and pinned
- **WHEN** one app is installed, pinned, and acted on
- **THEN** the home page shows it in Pinned, in Recent, and in All apps, in that section order.

#### Scenario: Modal tile opens overlay without leaving home
- **WHEN** a modal-capable app's tile is followed
- **THEN** the overlay section becomes visible on the home page (no navigation), showing current state with working forms, and the back link hides it again.
