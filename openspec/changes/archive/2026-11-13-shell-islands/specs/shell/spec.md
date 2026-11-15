# shell — delta

## MODIFIED Requirements

### Requirement: Shell provides the framework and adapter surface

The shell SHALL load the selected renderer once per page, together with the shell-bridge adapter, in every placement where app sections render (page, widget, modal). The provided surface SHALL be exposed under one documented global namespace and SHALL carry a version that bundles can read (and that the docs record); a version change to the provided surface SHALL require a spec update and re-verification of the reference apps before it ships. The shell SHALL instantiate the adapter separately for each app section, scoped to that section's `[data-app-id]` scope, and the bridge SHALL own one store per section (durable/ephemeral/derived separate, durable changed only via `act()`).

**Amendment (shell-islands, 2026-11-09 — revisits `agent-app-authoring`
Decision #5):** the provided renderer IS Lit 3.3.3 (pinned), provided
via a single vendored downleveling step done once at package-build
time (esbuild bundles LitElement + lit-html into one file, `target:
'es2019'`, `format: 'iife'`, `minify: true`, ceiling-scanned with the
build failing loudly on any banned call or post-ES2019 syntax). The
"no downleveling pipeline" clause of the 2026-10-30 decision is
narrowed to the general per-app pipeline: no per-app downleveling
pipeline is funded, and no `add_app` compile step is added. An upgrade
of the pinned Lit version is a re-probe, not a silent bump. No app
definition, storage key, or registry field is added by this
requirement; apps persist state only through `act()`.

#### Scenario: Provided surface is Lit, vendored once
- **WHEN** a page renders app sections
- **THEN** the Lit code is loaded once (one vendored file, Lit 3.3.3), the adapter exists once per section, and each section's adapter reads only its own section's JSON seed and forms, with its own bridge-owned store.

#### Scenario: Provided surface is versioned
- **WHEN** a bundle reads the provided surface version
- **THEN** it finds a single version value matching the version recorded in the package docs, and a version bump in the shell is accompanied by a spec update.

## ADDED Requirements

### Requirement: Vendored Lit provision (transpile-once)

The shell SHALL vendor Lit 3.3.3 (pinned) as a single file, built once
at package-build time with esbuild (`target: 'es2019'`, `format:
'iife'`, `minify: true`), and SHALL load it once per page, exposing Lit
under one documented global in the pattern of `window.KodyBridge`.
The vendored file SHALL pass the ceiling scan on the built output: 0
post-ES2019 syntax and 0 banned calls (`replaceAll`,
`structuredClone`, `Object.hasOwn`, `.at()`, `WeakRef`,
`FinalizationRegistry`, `URLPattern`); the build SHALL fail loudly on
any violation. The vendored entry SHALL NOT import `ContextRoot` (the
only `WeakRef` in `@lit/context`, Chrome 84+); the scan SHALL prove
it is not in the bundle by per-output bytes, not by the
metafile-inputs list. The `adoptedStyleSheets` write inside Lit's
`adoptStyles` SHALL be recorded as `builtin-ok` (dead code for
light-DOM use; the API is native since Chrome 73), never a fail.
`@lit/context` / `@lit/task` SHALL NOT ship in the vendored file
unless the provision decision records otherwise, under the same
pinning + scan discipline.

#### Scenario: Vendored file is ceiling-clean
- **WHEN** the vendored Lit file is built
- **THEN** the built output contains 0 post-ES2019 syntax and 0 banned calls, its bytes/gzip are recorded, and any violation fails the build.

#### Scenario: Lit loads once per page
- **WHEN** a page renders two app sections and a widget renders a third
- **THEN** the vendored Lit file is loaded once, and every section uses the same provided copy.

#### Scenario: `ContextRoot` is not in the bundle
- **WHEN** the vendored file is scanned
- **THEN** `ContextRoot` contributes 0 bytes to the output, and no `new WeakRef(` call appears in the built file.

### Requirement: Shared `os-*` element library (light-DOM only)

The shell SHALL define shared custom elements once in its client,
under the `os-*` namespace, rendering into light DOM
(`createRenderRoot() { return this; }`). App bundles SHALL use the
tags and SHALL NOT define them. No shared element SHALL use a shadow
root, constructable stylesheets, or `adoptedStyleSheets` at runtime.
Shared elements SHALL keep the shell's shared theme CSS (light DOM)
and SHALL keep their content visible without JavaScript. The library
is versioned with the provided surface; its initial set is the set
the Counter port and the shell chrome's own app-row rendering need,
recorded at implementation.

#### Scenario: Shared element renders with the theme
- **WHEN** an app section uses an `os-*` tag
- **THEN** the element renders with the shell's shared theme classes, its content is visible in the served HTML without JavaScript, and no shadow root is created.

#### Scenario: Two apps cannot collide on a shared tag
- **WHEN** two app sections on one page each use the same `os-*` tag
- **THEN** both render from the single shell definition, with no redefinition throw.

### Requirement: Islands

Every app section (`section[data-app-id]`) SHALL be an island: the
server SHALL render the JSON state seed + skeleton HTML (the no-JS
content) before bundle scripts run, and the island's bundle SHALL
mount onto it (a LitElement or a lit-html `render()` call), adopting
its starting state from the JSON seed. Each island SHALL have one
bridge store instance, SHALL share no mutable state with another
island, and SHALL fail contained to its section with native form
submission as the fallback. Islands SHALL load at `DOMContentLoaded`.

#### Scenario: Island mounts from the seed
- **WHEN** an app section renders with a JSON seed
- **THEN** the island's bundle reads its initial state from the seed without waiting for `DOMContentLoaded` and without scraping a span, and renders its interactive UI over the server-rendered skeleton.

#### Scenario: Island failure is contained
- **WHEN** one island's bundle throws during mount or update
- **THEN** the other sections keep rendering and updating, the shell client keeps patching spans, and the failed section's forms still submit natively.

#### Scenario: Islands share no mutable state
- **WHEN** two islands on one page each hold state under the same field name
- **THEN** each island's store holds its own value, and an `act()` in one island does not change the other's rendered state.

### Requirement: Components read state only from the bridge store

A component written under this change SHALL read state ONLY from the
bridge store (a `KodyBridge.create(section)` subscription, or context
derived from it). The JSON seed SHALL be the initial handoff, read
once at mount. A component SHALL NOT read state from server-injected
DOM — no span scraping, no `data-value` attributes, no reading
server-rendered text as state. The `[data-field]` spans SHALL stay in
the served HTML as the no-JS content and the fallback; existing
span-reading bundles keep working until ported (dual-channel
migration). A component that reads server-injected DOM for state
SHALL fail the authoring check.

#### Scenario: Component ignores the spans
- **WHEN** a component mounts on a section whose served HTML contains `[data-field]` spans holding the current values
- **THEN** the component renders from its bridge store subscription, and changing the span text by hand does not change the component's rendered state.

#### Scenario: Seed is read once at mount
- **WHEN** a component mounts
- **THEN** it reads its initial state from the JSON seed exactly once, and all later state changes arrive through the bridge store.
