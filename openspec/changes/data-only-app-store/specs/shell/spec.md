# Spec Delta

## ADDED Requirements

### Requirement: Bundle management API

The shell SHALL expose a management API for bundles
declaring `manageApps`: read store rows (the
`get_store_rows()` shape: id, label, name, icon,
category, description, installed, inCatalog, status,
modified) and write install, update, and restore
through the existing registry paths, with snapshot,
state-preservation, and status rules unchanged.
The API SHALL be GET-based, dispatched inside the
device gate, with no POST route. An app whose
stored definition does not declare `manageApps`
SHALL receive the feed-style plain 404 with no
write and no capability detail.

#### Scenario: A declared Store reads and installs

- **WHEN** the store bundle, declaring `manageApps`,
  calls the management API with a valid session
- **THEN** it receives the store rows, and an
  install call installs a catalog app through the
  validated registry path with an install snapshot.

#### Scenario: An undeclared app is refused

- **WHEN** an app without declared `manageApps`
  calls the management API with a valid session
- **THEN** the response is a plain 404, and no
  registry write occurs.

### Requirement: Modified-app confirmation lives in the bundle

For a behind-modified app, the management API
SHALL return a needs-confirmation response naming
what updating will lose, and SHALL NOT apply the
update until the bundle submits an explicit
confirmation. Declining SHALL change nothing.

#### Scenario: A modified update waits for confirmation

- **WHEN** the Store bundle requests an update for a
  behind-modified app
- **THEN** the API returns needs-confirmation, the
  bundle shows its own confirm UI, and only a
  confirm submission applies the update.

### Requirement: Not-installed Store fallback

`GET /apps/app-store` when the store app is not
installed SHALL render a short note plus the Store
install path, with no store rows and no other
controls, instead of a bare 404.

#### Scenario: A removed Store is recoverable from its URL

- **WHEN** the store app is removed and its URL is
  opened
- **THEN** the page explains the Store is not
  installed and offers the install path for the
  Store itself.

## REMOVED Requirements

### Requirement: Shell-rendered Store page

The shell SHALL NOT intercept `GET /apps/app-store`
before the generic app route, SHALL NOT render a
combined Store list, and SHALL NOT render a Store
confirmation page. The Store page SHALL be the
generic app page for the installed store bundle,
and its list and confirmation UI SHALL be bundle
code calling the management API.

#### Scenario: Replacing the store definition changes the Store

- **WHEN** the store bundle definition is replaced
  via `add_app` with a different managing bundle
- **THEN** the Store page renders that bundle's UI,
  not the shell's former combined list.
