# Spec Delta

## MODIFIED Requirements

### Requirement: Catalog apps are installable verbatim

`pkg/catalog/` SHALL contain the shipped app definitions (one
`*.bundle.json` per app, including the App Store itself) plus a README
stating the catalog membership rules and the `add_app` install steps. The
operator example SHALL install via `add_app` unchanged; each bundle SHALL
satisfy the bundle manifest shape (entry `index.html`, relative
`.html`/`.js`/`.css` only, within the 256 KiB cap). A catalog app joins the
store listing only when its file is added to the catalog import list (see
app-registry); the README SHALL state the file + import + harness checklist
and the trust rule that installing a catalog app trusts its bundle code.

#### Scenario: Catalog apps install and render
- **WHEN** an agent submits each catalog definition to `add_app`
- **THEN** each returns `{ ok: true, id }`, and each bundle validates as well-formed and renders on its page.
