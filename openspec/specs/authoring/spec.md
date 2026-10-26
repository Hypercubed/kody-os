# authoring Specification

## Purpose
TBD - created by archiving change app-bundles. Update Purpose after archive.

## Requirements

### Requirement: Bundle authoring docs ship in the package
The Scribe capability findings SHALL live at `pkg/docs/scribe-limitations.md` (not only in dev-only root docs invisible to Kody), and `pkg/docs/adding-an-app.md`, `pkg/README.md`, and `pkg/AGENTS.md` SHALL link to it by relative path, so a Kody-connected agent can open every authoring doc by file path.

#### Scenario: Agent opens every authoring doc by file path
- **WHEN** an agent follows the guide's links from the published package
- **THEN** `docs/adding-an-app.md` and `docs/scribe-limitations.md` both resolve inside the package, and no authoring link escapes to repo-root-only paths.

### Requirement: Example apps are installable verbatim
`example-apps/` SHALL contain `hello-counter.json`, `eight-ball.bundle.json`, and `clock.bundle.json` (modal placement) plus a README with `add_app` install steps. The operator example SHALL install via `add_app` unchanged; each bundle SHALL satisfy the bundle manifest shape (entry `index.html`, relative `.html`/`.js`/`.css` only, within the 256 KiB cap).

#### Scenario: Examples install and render
- **WHEN** an agent submits each example to `add_app`
- **THEN** each returns `{ ok: true, id }`, the operator app renders on its page, and each bundle validates as well-formed.
