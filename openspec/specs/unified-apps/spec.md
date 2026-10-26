# Unified Apps

## Purpose

Define one app shape that pairs custom UI with server state so any author can ship behavior without package changes.

## Requirements

### Requirement: Single app type
The system SHALL accept one app shape: meta plus UI files plus state schema plus actions, with no `kind` discriminator and no template branch. Validation SHALL require `bundle.entry index.html`, relative paths only, 256 KiB cap, plus valid state schema and actions.

#### Scenario: Unified app installs
- **WHEN** `add_app` receives a unified definition with UI files, state, and actions
- **THEN** it returns `{ ok: true, id }` and the app renders UI with live state and working forms.

#### Scenario: Legacy kind rejected with guidance
- **WHEN** `add_app` receives a definition with `kind: bundle`
- **THEN** it returns `{ ok: false, error }` naming the unified shape and writes nothing.

### Requirement: Generic set-data actions
Actions SHALL be validated data writes: coerce args, apply `set`/`append` to a copy, re-validate against state schema, single write. `increment|toggle|reset` SHALL be treated as sugar over `set` during migration, then retire.

#### Scenario: Custom action without package change
- **WHEN** an author defines a new action using only `set` with args
- **THEN** `act` applies it with no package edit and UI + MCP observe the same state.

### Requirement: JS-to-act bridge
Bundle JS SHALL persist via `act()` from page forms and fetch, sharing the same handler and atomicity as MCP. Appended list writes SHALL cap length and entry bytes.

#### Scenario: Probe persists via bridge
- **WHEN** probe JS calls `act(probe, append, {tag,d})`
- **THEN** the report appears in `read_probe_reports` and survives reload.
