# App Placements

## Purpose

One view per app, three placements: page, modal, and (reserved) widget. The placement allowlist lets compact-designed apps like a clock open as overlays or tiles instead of only full pages, without a second template per app.

## Requirements

### Requirement: Placement allowlist on app definitions

The schema SHALL accept an optional `ui.placements` allowlist drawn from the closed set `page | modal | widget`, defaulting to `["page"]` when omitted. The `widget` value SHALL validate but render nothing; declaring it alone changes nothing visible.

#### Scenario: Default stays page-only
- **WHEN** a definition omits `placements`
- **THEN** its tile links to the full app page exactly as before, and validation passes.

#### Scenario: Unknown placement rejected
- **WHEN** `placements` contains anything outside page/modal/widget
- **THEN** `add_app` returns `{ ok: false }` naming the bad value and writes nothing.

### Requirement: Single shared section structure

`renderAppSection` SHALL return bare content (description, state fields, action forms) with no wrapper element of its own. The shell's `<section class="app">` SHALL be the single box on app pages, modal overlays, and (later) widgets.

#### Scenario: One box per app view
- **WHEN** an app page or modal overlay is rendered
- **THEN** the markup contains exactly one section element for the app panel, and the content renders identically in every placement.

### Requirement: Compact view renders in any placement

A modal-capable app SHALL render the same single compact view (the existing section HTML: description, state fields, action forms) inside the overlay. No per-placement template SHALL be required; designing compact is a content guideline, not a schema branch.

#### Scenario: Modal shows live state and working forms
- **WHEN** the overlay opens for an app with state and actions
- **THEN** it shows current values and its forms submit through the same `act()` path as the app page.
