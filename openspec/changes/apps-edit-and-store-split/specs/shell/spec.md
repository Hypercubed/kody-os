# Spec Delta

## ADDED Requirements

### Requirement: Apps page Edit mode

The Apps page SHALL offer an Edit mode, entered by a plain link
in the All apps header and shown only when at least one app is
installed. Edit mode SHALL list every installed app, including
hidden apps, alphabetical by label with id breaking ties, each
as a row showing its label, icon, and current pinned, hidden,
and homepage state in the control labels. Each row SHALL offer
Pin/Unpin, Hide/Unhide, and Add to home/Remove from home as
plain GET forms to the existing `/apps` mutation route, with no
JavaScript required. An Edit mutation SHALL 303 back to Edit
mode. Browse mode SHALL remain a launcher of Pinned, Recent,
and visible All tiles, unchanged.

#### Scenario: A hidden app is recovered from Edit alone

- **WHEN** all apps are hidden, so browse mode shows no tiles
- **THEN** Edit mode still lists every hidden app, and
  unhiding one from Edit returns it to browse mode.

#### Scenario: Edit mutations stay in Edit mode

- **WHEN** a user pins an app from Edit mode
- **THEN** the response redirects back to Edit mode, and the
  row now offers Unpin.

### Requirement: Store launcher params are an error

A Store request carrying `?pin=`, `?hide=`, or `?home=` SHALL
render the Store page with an inline error naming that
launcher management moved to Apps Edit, and SHALL change
nothing.

#### Scenario: An old Store pin link errors without writing

- **WHEN** a Store URL carrying `?pin=<id>&want=1` is requested
- **THEN** the Store page renders with the moved-management
  error, and the app's pinned state is unchanged.

## REMOVED Requirements

### Requirement: Store pin, hide, and home controls

The App Store combined list SHALL NOT offer Pin/Unpin,
Hide/Unhide, or Add to home/Remove from home controls, and the
Store route SHALL NOT handle `?pin=`, `?hide=`, or `?home=`
mutations. Store rows SHALL offer install, update, and restore
only, as their state allows, with status badges and
descriptions unchanged.

#### Scenario: Store rows show catalog controls only

- **WHEN** an installed app is viewed in the Store
- **THEN** its row offers no pin, hide, or home control, and
  offers Update or Restore only when its status allows it.
