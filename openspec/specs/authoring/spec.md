# authoring Specification

## Purpose
TBD - created by archiving change app-bundles. Update Purpose after archive.

## Requirements

### Requirement: Bundle authoring docs ship in the package
The Scribe capability findings SHALL live at `pkg/docs/scribe-limitations.md` (not only in dev-only root docs invisible to Kody), and `pkg/docs/adding-an-app.md`, `pkg/README.md`, and `pkg/AGENTS.md` SHALL link to it by relative path, so a Kody-connected agent can open every authoring doc by file path.

#### Scenario: Agent opens every authoring doc by file path
- **WHEN** an agent follows the guide's links from the published package
- **THEN** `docs/adding-an-app.md` and `docs/scribe-limitations.md` both resolve inside the package, and no authoring link escapes to repo-root-only paths.

### Requirement: Catalog apps are installable verbatim

`pkg/catalog/` SHALL contain the shipped app definitions (one
`*.bundle.json` per app, including the App Store itself) plus a README
stating the catalog membership rules and the `add_app` install steps. The
operator example SHALL install via `add_app` unchanged; each bundle SHALL
satisfy the bundle manifest shape (entry `index.html`, relative
`.html`/`.js`/`.css` only, within the 256 KiB cap). Each catalog definition
SHALL carry `catalogVersion` under the rule in the app-registry spec delta
(positive integer, starting at 1 on the app's first versioned release,
incremented by exactly 1 on any change to that app's definition file).
A catalog app joins the
store listing only when its file is added to the catalog import list (see
app-registry); the README SHALL state the file + import + harness checklist
(including the `catalogVersion` bump rule and the install-snapshot rule),
and the trust rule that installing a catalog app trusts its bundle code.
An installed app that is not a catalog definition carries no
`catalogVersion` requirement and appears in the combined list as Storage
only (see app-registry); `catalogVersion` is required only for catalog
definitions.

#### Scenario: Catalog apps install and render
- **WHEN** an agent submits each catalog definition to `add_app`
- **THEN** each returns `{ ok: true, id }`, and each bundle validates as well-formed and renders on its page.

#### Scenario: Catalog app without a version is not a valid catalog entry
- **WHEN** a catalog definition carries no valid `catalogVersion`
- **THEN** it fails catalog validation and is not offered as a versioned catalog app.
