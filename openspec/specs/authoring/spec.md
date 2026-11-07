# authoring Specification

## Purpose
TBD - created by archiving change app-bundles. Update Purpose after archive.

## Requirements

### Requirement: Bundle authoring docs ship in the package
The Scribe capability findings SHALL live at `pkg/docs/scribe-limitations.md` (not only in dev-only root docs invisible to Kody), and `pkg/.agents/skills/adding-an-app/SKILL.md`, `pkg/README.md`, and `pkg/AGENTS.md` SHALL link to it by relative path, so a Kody-connected agent can open every authoring doc by file path.

#### Scenario: Agent opens every authoring doc by file path
- **WHEN** an agent follows the guide's links from the published package
- **THEN** `.agents/skills/adding-an-app/SKILL.md` and `docs/scribe-limitations.md` both resolve inside the package, and no authoring link escapes to repo-root-only paths.

### Requirement: Catalog apps are installable verbatim

`pkg/catalog/` SHALL contain the shipped app definitions (one per-app
directory `<id>/`, including the App Store itself), each holding
`definition.json`, `index.html`, and any optional `.js` / `.css` bundle
files, plus a `RECIPE.md` stating the install steps, plus a README
stating the catalog membership rules and the `add_app` install steps and
the rule that editing an app requires re-running the catalog-index
generator. The operator example SHALL install via `add_app` unchanged;
each bundle SHALL satisfy the bundle manifest shape (entry `index.html`,
relative `.html`/`.js`/`.css` only, within the 256 KiB cap), in either
form: the inline files map or the on-disk manifest (see app-registry,
Bundle files on disk).
Each catalog definition SHALL carry `catalogVersion` under the rule in the
app-registry spec delta (positive integer, starting at 1 on the app's
first versioned release, incremented by exactly 1 on any change to that
app's definition file). A catalog app joins the store listing only when
its file is added to the catalog import list (see app-registry); the
README SHALL state the file + import + harness checklist (including the
`catalogVersion` bump rule and the install-snapshot rule), and the trust
rule that installing a catalog app trusts its bundle code. An installed
app that is not a catalog definition carries no `catalogVersion`
requirement and does not appear in the Store list (see app-registry);
`catalogVersion` is required only for catalog definitions.

#### Scenario: Catalog apps install and render
- **WHEN** an agent submits each catalog definition to `add_app`
- **THEN** each returns `{ ok: true, id }`, and each bundle validates as well-formed and renders on its page.

#### Scenario: Catalog app without a version is not a valid catalog entry
- **WHEN** a catalog definition carries no valid `catalogVersion`
- **THEN** it fails catalog validation and is not offered as a versioned catalog app.

#### Scenario: Catalog app directory holds definition and recipe
- **WHEN** an agent opens a catalog app directory
- **THEN** it contains `definition.json` and `RECIPE.md`, and the README states the generator rule for the catalog index.

#### Scenario: Catalog app directory holds the entry file
- **WHEN** an agent opens a catalog app directory
- **THEN** it contains `definition.json`, `RECIPE.md`, and `index.html`.

#### Scenario: On-disk app installs verbatim
- **WHEN** an agent submits an on-disk catalog definition to `add_app`
- **THEN** each returns `{ ok: true, id }` and the bundle renders.

### Requirement: Capability authoring rules

An app author SHALL declare capabilities only as `feeds`, `proxy`,
or `manageApps` under the app-registry capability rules: unknown keys
fail validation, upstream entries are bare HTTPS URLs with TTL
60..86400 and maxBytes 1024..262144, and `manageApps` is a boolean.
An author writing a managing app SHALL declare `manageApps` and
SHALL use the documented management API routes, not the bridge, and
SHALL render its own confirmation UI for modified apps and
capability expansion. Capabilities SHALL be described in plain words
for installers, never as a promise of sandboxing.

#### Scenario: A managing bundle declares manageApps
- **WHEN** a bundle calls the management API
- **THEN** its stored definition declares `manageApps`, or the API returns a plain 404.

### Requirement: Theme capability declaration for apps

App definitions SHALL support `capabilities.theme: { view: boolean, set: boolean }`, next to `capabilities.feeds`, `capabilities.proxy`, and `capabilities.manageApps`. `view` SHALL allow the theme read route; `set` SHALL allow the theme set and reset routes. A route SHALL check exactly the flag it needs. A definition with neither flag true SHALL be treated as not declaring theme. Any other shape SHALL fail definition validation, and install-time sanitizing SHALL normalize missing flags to `false`. Existing `feeds`, `proxy`, and `manageApps` declarations and validation SHALL be unchanged.

`act()` SHALL be unchanged by this change: no shell-theme effect operator is added, and an app's actions SHALL continue to write only that app's own state. Apps reach the theme override through the theme routes, not through `act()`.

#### Scenario: View-only app cannot set

- **WHEN** an app declaring only `capabilities.theme: { view: true }` calls a theme set route
- **THEN** it gets the plain 404 defined by the shell theme-route requirement, and storage is unchanged.

#### Scenario: Malformed declaration fails validation

- **WHEN** a definition carries `capabilities.theme` in any shape other than `{ view: boolean, set: boolean }`
- **THEN** validation fails and nothing is installed.

#### Scenario: Act does not touch theme

- **WHEN** an app acts on its own state
- **THEN** the theme override is unchanged, and the theme routes still report the previous override.
