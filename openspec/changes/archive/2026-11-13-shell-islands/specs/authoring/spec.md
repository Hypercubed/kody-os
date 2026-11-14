# authoring — delta

## ADDED Requirements

### Requirement: Provided surface is documented for app authors

The authoring docs SHALL document the concrete provided surface: the
global name and version of the vendored Lit, per-section
instantiation, the bridge-owned store and JSON seed, optimistic/rebase
behavior, the `os-*` naming convention, the bridge-only state rule,
and the `DOMContentLoaded` discipline. The docs SHALL state the
fallback rules: per-app vendoring or per-app compilation only as a
documented fallback with pinned version and update owner, never the
default path; a fallback app owns its own update story.

#### Scenario: Agent finds the provided surface in the docs
- **WHEN** an agent reads the adding-an-app skill before authoring a stateful bundle
- **THEN** it finds the vendored Lit global name and version, the `os-*` naming convention, and the rule that components read state only from the bridge store, with the Counter bundle cited as the reference implementation.

### Requirement: Pre-`add_app` checklist covers the provided surface and bridge-only state

The pre-`add_app` authoring checklist SHALL include: "stateful bundle
uses the provided surface, or records why not" and "its components
read state only from the bridge store (no span scraping, no
`data-value` attributes, no reading server-rendered text as state)".

#### Scenario: Checklist catches a span-reading component
- **WHEN** an author runs the checklist on a component that reads its state from a `[data-field]` span
- **THEN** the checklist fails the bridge-only state item, and the author ports the component to the bridge store before `add_app`.
