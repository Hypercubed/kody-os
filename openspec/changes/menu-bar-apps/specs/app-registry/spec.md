# Spec Delta

## ADDED Requirements

### Requirement: `ui.menuBar` definition flag

App definitions MAY carry `ui.menuBar`, a boolean. When true,
the app also appears in the top menu bar while installed (see
the shell spec delta); when absent or false, it does not. A
non-boolean `ui.menuBar` SHALL be rejected by
`validateDefinition` and SHALL write nothing. `add_app` SHALL
preserve `menuBar` through canonicalization, and export/import
SHALL round-trip it. `list_apps()` summaries SHALL always
carry `menuBar: boolean`, false when the field is absent.
Catalog install and update SHALL carry the flag with the
definition, like any other `ui` field.

#### Scenario: Flag validates and lists

- **WHEN** `add_app` receives a definition with
  `ui.menuBar: true`
- **THEN** it installs, and `list_apps()` shows that app with
  `menuBar: true`.

#### Scenario: Absent flag reads false

- **WHEN** an installed definition has no `ui.menuBar`
- **THEN** `list_apps()` shows it with `menuBar: false`, and
  no menu link is rendered for it.

#### Scenario: Bad flag writes nothing

- **WHEN** `add_app` receives `ui.menuBar: "yes"`
- **THEN** it returns an error and storage is untouched.

#### Scenario: Flag survives export and import

- **WHEN** a flagged app is exported and imported into a
  blank store
- **THEN** the imported definition still carries
  `ui.menuBar: true`.
