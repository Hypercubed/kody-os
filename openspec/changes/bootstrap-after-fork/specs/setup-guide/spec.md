# Spec Delta

## ADDED Requirements

### Requirement: Bootstrap choice after forking

The setup guide SHALL present, after fork,
publish, empty-registry confirmation, and OTP
unlock, a choice: install nothing, or install the
Store. Installing nothing SHALL be presented
as a supported choice with the shared help
text and its two prompts stated, and
installing the Store SHALL be presented as
encouraged, never required.

#### Scenario: A fork owner chooses nothing

- **WHEN** a fork owner follows setup and
  chooses to install nothing
- **THEN** Home and Apps show the shared help text
  with its two prompts, and the setup is
  complete, not broken.

### Requirement: Bootstrap procedure from the pinned release

Bootstrap SHALL be an agent/script procedure
that fetches the Store bundle from the pinned
public release, validates it before writing,
installs it via `add_app`, and verifies with
`list_apps` and by opening the Store page,
stopping and asking on any failed check.
Bootstrap SHALL NOT be presented as shell
seeding.

#### Scenario: Bootstrap installs the Store

- **WHEN** a fork owner runs the documented
  bootstrap procedure
- **THEN** `list_apps` shows `app-store`, the Store
  page opens, and the Store lists catalog apps
  from the pinned release.

### Requirement: Bootstrap apps are ordinary installs

The Store installed by bootstrap SHALL be
an ordinary registry install, removable by an
agent via `remove_app`, manageable from Apps
Edit like any other app, and reinstallable by
the same fetch-and-`add_app` path. About and
Help are not installs — they are built-in
shell pages and cannot be removed.

#### Scenario: A bootstrap app is removed and restored

- **WHEN** the Store is removed and the
  bootstrap procedure is followed
- **THEN** the Store is reinstalled.

## REMOVED Requirements

### Requirement: Bundled-examples first-app path

The setup guide SHALL NOT present installing a
first app from bundled examples in `pkg/catalog/`
as the setup path, and SHALL NOT describe the
App Store as specified but not yet implemented.
The catalog source in setup and authoring docs
SHALL be the public repo's pinned release.
