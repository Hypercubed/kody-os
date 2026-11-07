# authoring Specification Delta

## MODIFIED Requirements

### Requirement: Catalog apps are installable verbatim

`pkg/catalog/` SHALL contain the shipped app definitions (one per-app directory `<id>/`, including the App Store itself), each holding `definition.json`, `index.html`, and any optional `.js` / `.css` bundle files, plus a `RECIPE.md` stating the install steps, plus a README stating the catalog membership rules and the `add_app` install steps and the rule that editing an app requires re-running the catalog-index generator. The operator example SHALL install via `add_app` unchanged; each bundle SHALL satisfy the bundle manifest shape (entry `index.html`, relative `.html`/`.js`/`.css` only, within the 256 KiB cap), in either form: the inline files map or the on-disk manifest (see app-registry, Bundle files on disk). Each catalog definition SHALL carry `catalogVersion` under the rule in the app-registry spec delta (positive integer, starting at 1 on the app's first versioned release, incremented by exactly 1 on any change to that app's definition file). A catalog app joins the store listing only when its file is added to the catalog import list (see app-registry); the README SHALL state the file + import + harness checklist (including the `catalogVersion` bump rule and the install-snapshot rule), and the trust rule that installing a catalog app trusts its bundle code. An installed app that is not a catalog definition carries no `catalogVersion` requirement and does not appear in the Store list (see app-registry); `catalogVersion` is required only for catalog definitions.

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
