# Spec Delta

## ADDED Requirements

### Requirement: Declared capabilities in bundle definitions

A bundle definition MAY declare capabilities in a
structured `capabilities` object: `manageApps` as a
boolean, and `proxy` as a list of named upstream
entries (`name`, HTTPS URL, `ttlSeconds`, `maxBytes`),
shaped like feed declarations. A definition without
these fields declares no new abilities. `feeds`
behavior is unchanged unless the implementation
generalizes feeds into `proxy` under design.md
Decision 2, in which case every existing feed
declaration MUST still validate and behave as
before.

#### Scenario: A valid capability declaration round-trips

- **WHEN** a definition declaring `manageApps` and one
  proxy host is installed and then exported
- **THEN** the export carries both capabilities intact.

### Requirement: Capability validation rejects unknown keys

Install-time validation SHALL reject a definition
carrying an unknown capability key, a malformed
proxy entry, a non-HTTPS proxy URL, a proxy URL
with credentials, or an out-of-range TTL or size
cap, with no write. Sanitization SHALL store only
the validated, defaults-applied capability fields.

#### Scenario: An unknown capability fails install

- **WHEN** a definition declares a capability key the
  shell does not know
- **THEN** install fails with an error and nothing is
  written.

### Requirement: Capabilities are disclosed before install

The Store SHALL show an app's declared capabilities
in plain words before install, and the agent
`add_app` verification path SHALL surface the same
list. No capability SHALL be installable without
being shown.

#### Scenario: A managing app's ability is visible

- **WHEN** an app declaring `manageApps` is viewed in
  the Store before install
- **THEN** its listing states in plain words that it
  can install and update other apps.

### Requirement: Capability expansion on update requires confirmation

An update that would add `manageApps`, a new proxy
host, or any new capability key to an installed
app's stored capabilities SHALL NOT apply until
the installer confirms a prompt naming exactly
what is new. Declining SHALL change nothing.
Removing a capability, or changing only TTL/size
parameters, SHALL NOT require this gate.

#### Scenario: A silent privilege growth is blocked

- **WHEN** an installed app is updated to a version
  adding a new proxy host
- **THEN** the update is held for confirmation naming
  the new host, and declining leaves the old
  definition installed.

### Requirement: Server allowlist for management and proxy

The shell SHALL refuse a management call from an
app whose stored definition does not declare
`manageApps`, and SHALL refuse a proxy request for
an undeclared name, returning the feed-style plain
404 with no capability detail and no write.

#### Scenario: An undeclared app gets a plain 404

- **WHEN** an app without declared `manageApps` calls
  the management API with a valid session
- **THEN** the response is a plain 404, and no
  registry write occurs.
