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

`catalog/` SHALL contain the shipped app definitions (one per-app
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
its manifest entry agrees with its directory (see app-registry); the
README SHALL state the file + manifest + harness checklist (including the
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

### Requirement: Catalog definitions may declare a minimum shell version

A catalog definition MAY carry `minPackageVersion` (see
app-registry, App definition may declare a minimum shell version):
an optional `MAJOR.MINOR.PATCH` string declaring the minimum
kody-os package (shell) version the app requires. Absent means no
minimum. Adding or changing it is a definition change and requires
a `catalogVersion` +1 by the existing rule. The adding-an-app skill
SHALL document the field and its rule.

#### Scenario: Catalog app declares a minimum
- **WHEN** a catalog definition carries a valid `minPackageVersion`
- **THEN** it validates, and the shell refuses to install it on a shell older than that minimum (see app-registry, Install refuses an app the shell is too old for).

### Requirement: A Store declares its catalog source

A Store app SHALL declare its catalog source in its own definition
as a `capabilities.proxy` entry named `catalog` whose `url` is the
catalog base URL (the directory containing `catalog.json`). The
shell SHALL fetch that Store's catalog only from the declared base.
A different Store SHALL declare a different base to read a different
catalog. The `catalog` proxy entry is a declaration of the base; the
shell's catalog fetch derives the manifest, definition, bundle, and
recipe URLs under it. Adding or changing the `catalog` entry is a
definition change and SHALL bump the Store's `catalogVersion` by 1
under the existing rule.

#### Scenario: Store declares its catalog base
- **WHEN** the App Store's definition carries a `proxy` entry named
  `catalog` with url
  `https://raw.githubusercontent.com/Hypercubed/kody-os/main/catalog/`
- **THEN** the Store's catalog is fetched from under that base.

#### Scenario: Different Store, different catalog
- **WHEN** a second Store declares a `proxy` entry named `catalog`
  with a different base URL
- **THEN** that Store's catalog is fetched from its own base, and
  the first Store's catalog is unaffected.

#### Scenario: No catalog entry means no catalog
- **WHEN** a Store's definition declares no `proxy` entry named
  `catalog`
- **THEN** that Store shows installed apps only, never a blank Store.

### Requirement: A Store's catalog base tracks the latest commit

A Store SHALL declare its catalog base as the `main` branch URL,
not a fixed release tag, so the Store follows the latest catalog
and can discover its own updates. The `catalog` proxy entry's `url`
SHALL be the `main` branch catalog base
(`https://raw.githubusercontent.com/Hypercubed/kody-os/main/catalog/`
for the shipped App Store). Changing the base URL is a definition
change and SHALL bump the Store's `catalogVersion` by 1 under the
existing rule. The agent path is unaffected: an agent supplies its
own base and may point at a specific tag for a stable snapshot.

#### Scenario: Store base is the main branch
- **WHEN** the App Store's definition is read
- **THEN** its `catalog` proxy entry url is the `main` branch
  catalog base.

#### Scenario: Base change bumps the version
- **WHEN** the Store's `catalog` proxy entry url changes from a
  fixed tag to the `main` branch base
- **THEN** the Store's `catalogVersion` increments by exactly 1.
