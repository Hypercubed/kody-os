# Spec Delta

## ADDED Requirements

### Requirement: Bootstrap choice after forking

The setup guide SHALL present, after fork,
publish, empty-registry confirmation, and OTP
unlock, a choice: install nothing, or bootstrap
About, Help, and the Store. Installing nothing
SHALL be presented as a supported choice with
its honest empty states stated, and bootstrap
SHALL be presented as encouraged, never
required.

#### Scenario: A fork owner chooses nothing

- **WHEN** a fork owner follows setup and
  chooses to install nothing
- **THEN** Home shows the no-widgets empty
  state, Apps shows the no-apps empty state,
  and the setup is complete, not broken.

### Requirement: Bootstrap procedure from the pinned release

Bootstrap SHALL be an agent/script procedure
that fetches the About, Help, and Store
bundles from the pinned public release,
validates each before writing, installs each
via `add_app`, and verifies with `list_apps`
and by opening each app page, stopping and
asking on any failed check. Bootstrap SHALL
NOT be presented as shell seeding.

#### Scenario: Bootstrap installs all three apps

- **WHEN** a fork owner runs the documented
  bootstrap procedure
- **THEN** `list_apps` shows `about`, `help`,
  and `app-store`, each app page opens, and
  the Store lists catalog apps from the pinned
  release.

### Requirement: Bootstrap apps are ordinary installs

About, Help, and Store installed by bootstrap
SHALL be ordinary registry installs, removable
by an agent via `remove_app`, manageable from
Apps Edit like any other app, and reinstallable
by the same fetch-and-`add_app` path.

#### Scenario: A bootstrap app is removed and restored

- **WHEN** the Store is removed and the
  Store-alone procedure is followed
- **THEN** the Store is reinstalled without
  requiring About or Help to be bootstrapped.

### Requirement: Store-alone recovery procedure

The setup guide SHALL give, separately from
full bootstrap, a Store-alone procedure:
fetch only the Store bundle from the pinned
release, install via `add_app`, and open the
Store.

#### Scenario: A Store-less shell gets a Store

- **WHEN** a shell with no Store follows the
  Store-alone procedure
- **THEN** the Store is installed and lists
  catalog apps, with no other app required.

## REMOVED Requirements

### Requirement: Bundled-examples first-app path

The setup guide SHALL NOT present installing a
first app from bundled examples in `pkg/catalog/`
as the setup path, and SHALL NOT describe the
App Store as specified but not yet implemented.
The catalog source in setup and authoring docs
SHALL be the public repo's pinned release.
