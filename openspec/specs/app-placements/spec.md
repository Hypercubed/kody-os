# App Placements

## Purpose

One view per app, with a default open mode: page or modal. The default open mode lets compact-designed apps like a clock open as overlays or tiles instead of only full pages, without a second template per app. It is a default, not a restriction: every app is allowed in every context.

## Requirements

### Requirement: Default open mode on app definitions

The schema SHALL accept an optional `ui.openAs` drawn from the closed set `page | modal`, defaulting to `"page"` when omitted. `openAs` defines only how the app opens by default when opened from the Apps page: `"page"` links the tile to the full app page, `"modal"` links the tile to the inline overlay section on the Apps page. It is a default, not a restriction: every app is allowed in every context, and direct navigation to `/apps/<id>` SHALL render the full page for every app regardless of its `openAs` value. Home widget presence SHALL be governed by the homepage list, not by this field.

#### Scenario: Default stays page
- **WHEN** a definition omits `openAs`
- **THEN** its tile links to the full app page exactly as before, and validation passes.

#### Scenario: Modal default opens the overlay
- **WHEN** a definition declares `openAs: "modal"`
- **THEN** its Apps-page tile opens the inline overlay section on the Apps page (no navigation), showing current state with working forms, and the back link hides it again.

#### Scenario: Unknown open mode rejected
- **WHEN** `openAs` contains anything outside page/modal
- **THEN** `add_app` returns `{ ok: false }` naming the bad value and writes nothing.

#### Scenario: Old placements definitions keep working
- **WHEN** a definition carries the deprecated `ui.placements` but no `openAs`
- **THEN** it installs and opens as before: `["modal"]` (without `"page"`) derives `"modal"`, any other placements value derives `"page"`, and when both fields are present `openAs` wins.

#### Scenario: Exported definitions migrate
- **WHEN** a definition is stored or exported after this change
- **THEN** it carries `openAs` and no longer needs `placements`.

### Requirement: Single shared section structure

`renderAppSection` SHALL return bare content (description, state fields, action forms) with no wrapper element of its own. The shell's `<section class="app">` SHALL be the single box on app pages and modal overlays, and the home widget section SHALL carry the same content with `data-app-id`, so the content renders identically in every context.

#### Scenario: One box per app view
- **WHEN** an app page, modal overlay, or home widget is rendered
- **THEN** the markup contains exactly one section element for the app view, and the content renders identically in every context.

### Requirement: Compact view renders in any context

A modal-default app SHALL render the same single compact view (the existing section HTML: description, state fields, action forms) inside the overlay. No per-context template SHALL be required; designing compact is a content guideline, not a schema branch.

#### Scenario: Modal shows live state and working forms
- **WHEN** the overlay opens for an app with state and actions
- **THEN** it shows current values and its forms submit through the same `act()` path as the app page.
