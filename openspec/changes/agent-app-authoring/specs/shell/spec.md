## ADDED Requirements

### Requirement: Shell rendering contract for bundles

The shell SHALL render every app page as: bundle UI first, then one state readout per declared state field as `<p data-field="<name>"[ hidden]>` containing the field name and a plain `<span>` holding the escaped value (no `data-value` attribute), then one plain GET form per `ui.actions` entry (`form.app-action`, hidden `action` input plus `k`/`from` when present). `hideState: true` SHALL add `hidden` to the readout paragraph while keeping the span in the DOM. The shell client SHALL replay `form.app-action` submissions with `?format=json` where `fetch`/JSON parsing exist, patching only the `[data-field]` spans inside the nearest `[data-app-id]` scope from the returned state, and SHALL fall back to native form submission on any failure. The client SHALL never write to bundle-owned DOM or bundle variables. Future changes to this markup or patch scope SHALL update this requirement first. Note: the rendered state fields are current behavior; their original no-JS rationale is retired (2026-10-28) — JavaScript on the Scribe is assumed — and this requirement pins the markup only, not the rationale.

#### Scenario: State readout markup is exact
- **WHEN** an app page is fetched for an app with a declared integer field
- **THEN** the HTML contains `<p data-field="<name>"` with a child `<span>` holding the current value as text, and no `data-value` attribute on the paragraph or span.

#### Scenario: Hidden state stays in the DOM
- **WHEN** an app sets `ui.hideState: true`
- **THEN** the readout paragraph carries `hidden` and its span still holds the current value in the served HTML.

#### Scenario: Client patches spans only and falls back natively
- **WHEN** a shell action form is submitted in a capable browser and the fast path succeeds
- **THEN** only the `[data-field]` spans in scope update from the returned state, with no navigation; when the fast path fails, the form submits natively and the page reloads with the new state.

#### Scenario: Action forms are shell-owned GET forms
- **WHEN** an app declares `ui.actions` entries
- **THEN** each renders as a GET form to `/apps/<id>` with a hidden `action` input naming the declared action, and submitting it runs that action through the shared `act()` handler.

### Requirement: Shell provides the framework and adapter surface

The shell SHALL load the selected framework once per page, together with the shell-bridge adapter, in every placement where app sections render (page, widget, modal). The provided surface SHALL be exposed under one documented global namespace and SHALL carry a version that bundles can read (and that the docs record); a version change to the provided surface SHALL require a spec update and re-verification of the reference apps before it ships. The shell SHALL instantiate the adapter separately for each app section, scoped to that section's `[data-app-id]` scope. No app definition, storage key, or registry field is added by this requirement; apps persist state only through `act()`.

#### Scenario: Framework loads once per page in every placement
- **WHEN** a page renders two app sections and a widget renders a third
- **THEN** the framework code is loaded once, the adapter exists once per section, and each section's adapter reads only its own section's state span and forms.

#### Scenario: Provided surface is versioned
- **WHEN** a bundle reads the provided surface version
- **THEN** it finds a single version value matching the version recorded in the package docs, and a version bump in the shell is accompanied by a spec update.

### Requirement: Isolation between app sections sharing the shell-provided framework

App sections sharing one page and one provided framework SHALL be isolated from each other: no shared mutable framework or adapter state across sections; one section's top-level script declarations SHALL NOT collide with another section's; one section's styles SHALL NOT restyle another section's content except through the shared shell theme; and when the provided framework uses the Custom Elements registry, tag names SHALL be namespaced by app id so two apps cannot collide on a definition. An error thrown inside one section's framework or adapter code SHALL NOT prevent other sections from rendering or the shell client from patching spans; the affected section SHALL fall back to native form submission.

#### Scenario: Two sections share top-level names without colliding
- **WHEN** two app sections on one page each declare the same top-level variable name in their bundle code
- **THEN** each section keeps its own value and both sections behave as if rendered alone.

#### Scenario: Two apps cannot collide on a custom-element tag
- **WHEN** two apps each define an element under the provided framework's naming convention
- **THEN** both definitions register without throwing, each scoped to its app id, and each section upgrades only its own tags.

#### Scenario: One section's failure does not break its neighbors
- **WHEN** one section's framework code throws during an update
- **THEN** the other sections keep rendering and updating, the shell client keeps patching spans, and the failed section's forms still submit natively.
