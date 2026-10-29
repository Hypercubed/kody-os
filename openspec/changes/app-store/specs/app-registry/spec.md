# Spec Delta

## ADDED Requirements

### Requirement: Shipped catalog

The package SHALL ship a catalog: every `*.bundle.json` file in
`pkg/catalog/` is an app definition the user can install from the browser.
The catalog SHALL be enumerated by an explicit import list in package code
(alphabetical by id), not by runtime directory listing; a file in
`pkg/catalog/` without an import entry SHALL NOT be listed. Every catalog
definition SHALL validate through `validateDefinition` and install through
`add_app`, satisfying the bundle manifest shape (entry `index.html`,
relative `.html`/`.js`/`.css` only, within the 256 KiB cap) and the 16 MiB
storage budget. Catalog definitions are publisher-shipped and trusted like
any `add_app` definition: installing one trusts its bundle code, which runs
same-origin with session authority.

#### Scenario: Every catalog file validates and installs
- **WHEN** each file in `pkg/catalog/` is submitted to `add_app` in a blank store
- **THEN** each returns `{ ok: true, id }` and appears in `list_apps()`.

#### Scenario: Unimported file is not listed
- **WHEN** a bundle file exists in `pkg/catalog/` with no import-list entry
- **THEN** the App Store listing omits it.

#### Scenario: Catalog listing order is deterministic
- **WHEN** the catalog is listed
- **THEN** entries appear in import-list order (alphabetical by id).

### Requirement: Install from the catalog without an agent

Installing a catalog app SHALL read its bundled definition and load it into
the data store through the validated `add_app` path, with no agent, MCP
call, or republish. The install helper SHALL return `{ ok: false }` naming
an unknown id and write nothing. Installing an app that is already
installed SHALL preserve its state by default (the `add_app` rule) and
SHALL NOT reset state, pin the app, add it to the homepage, or add it to
the recency list. An installed catalog app SHALL act, export, and
re-import exactly like any other app.

#### Scenario: Browser install loads definition and initial state
- **WHEN** a catalog app that is not installed is installed from the store
- **THEN** its definition and `stateSchema.initial` state are stored, and it appears in `list_apps()` and on the Apps page.

#### Scenario: Unknown catalog id installs nothing
- **WHEN** install is requested for an id with no catalog definition
- **THEN** it returns `{ ok: false }` naming the id and storage is byte-identical to before.

#### Scenario: Re-install preserves state
- **WHEN** an installed catalog app with user-modified state is installed again
- **THEN** its stored state is unchanged and its pins, hidden flags, and homepage placement are untouched.

#### Scenario: Install has no launcher side effects
- **WHEN** a catalog app is installed from the store
- **THEN** it is neither pinned, nor on the homepage, nor in Recent until the user pins it, adds it to home, or uses it.

### Requirement: First use seeds only the App Store

On the first authenticated shell request against an empty registry, the
shell SHALL install exactly one app — the App Store (`app-store`), whose
definition ships in `pkg/catalog/` — through the validated `add_app` path,
before serving the request. "First use" means after the package has been
forked and published as a live saved package; a fork's storage starts
empty (source-only copy), so the first shell request is the first moment
seeding can run. Kody's "adopt" step (owner-only secret-access grant) is
a separate action and is NOT the seeding trigger. Seeding SHALL never run when the registry is
non-empty, SHALL never install any other catalog app, and SHALL be
idempotent (re-running it against a store that already holds the App Store
changes nothing). Seeding SHALL NOT run from MCP registry reads or from
`import_install` into a blank store. Removing the App Store via
`remove_app` SHALL be allowed exactly like any other app; if the registry
later becomes empty, the next shell request SHALL seed the App Store again.

#### Scenario: Blank install opens with only the App Store
- **WHEN** a blank store receives its first authenticated shell request
- **THEN** exactly one app is installed (`app-store`), and subsequent shell requests show it without re-seeding.

#### Scenario: Seeding never overwrites user state
- **WHEN** the registry already contains any app
- **THEN** seeding does not run and the user's registry is untouched.

#### Scenario: Empty registry restores the store
- **WHEN** every app including the App Store has been removed and a shell request arrives
- **THEN** the App Store is installed again and no other catalog app is installed.

#### Scenario: MCP reads do not seed
- **WHEN** `list_apps` is called against a blank store with no shell request having run
- **THEN** it returns an empty list and the store is byte-identical before and after the call.
